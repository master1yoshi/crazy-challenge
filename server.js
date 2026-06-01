const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use('/socket.io', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));
app.use(express.static(path.join(__dirname, 'public')));

let db;

async function initDB() {
    try {
        db = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT) || 13187,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            ssl: { rejectUnauthorized: false }
        });

        // Suppression de l'ancienne table si elle bloque la structure
        // Décommente la ligne suivante SI tu veux réinitialiser proprement la table :
        // await db.execute(`DROP TABLE IF EXISTS questions`);

        await db.execute(`CREATE TABLE IF NOT EXISTS questions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(50), 
            text TEXT,
            option_a VARCHAR(255), 
            option_b VARCHAR(255),
            option_c VARCHAR(255), 
            option_d VARCHAR(255), 
            answer INT
        )`);

        const [rows] = await db.execute('SELECT COUNT(*) as count FROM questions');
        
        if (rows[0].count === 0) {
            console.log("Base de données vide. Importation des questions depuis questions.json...");
            const filePath = path.join(__dirname, 'questions.json');
            
            if (!fs.existsSync(filePath)) {
                console.error("Erreur : Le fichier questions.json est introuvable au chemin :", filePath);
                return;
            }

            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            for (const [type, questions] of Object.entries(data)) {
                for (const q of questions) {
                    await db.execute(
                        'INSERT INTO questions (type, text, option_a, option_b, option_c, option_d, answer) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [type, q.text, q.options[0], q.options[1], q.options[2], q.options[3], q.answer]
                    );
                }
            }
            console.log("Importation réussie !");
        } else {
            console.log(`Log : Nombre de questions actuellement en BDD : ${rows[0].count}`);
        }
    } catch (error) {
        console.error("Erreur critique lors de l'initialisation de la BDD :", error);
    }
}

initDB().then(() => console.log("System Ready."));

let rooms = {};

function getOrCreateRoom(roomId) {
    if (!rooms[roomId]) {
        rooms[roomId] = { gameQuestions: [], currentQuestionIndex: -1, teams: {}, currentBuzzer: null, buzzedThisRound: [], canBuzz: false };
    }
    return rooms[roomId];
}

async function getQuestionsFromDB(theme) {
    try {
        const [rows] = await db.execute('SELECT * FROM questions WHERE type = ? ORDER BY RAND() LIMIT 10', [theme]);
        console.log(`Questions trouvées pour le thème [${theme}] : ${rows.length}`);
        return rows.map(q => ({
            type: q.type, 
            text: q.text,
            options: [q.option_a, q.option_b, q.option_c, q.option_d],
            answer: q.answer
        }));
    } catch (error) {
        console.error("Erreur lors de la récupération des questions :", error);
        return [];
    }
}

io.on('connection', (socket) => {
    let currentRoomId = null;

    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        currentRoomId = roomId;
    });

    socket.on('join_team', (name) => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);
        if (Object.keys(room.teams).length < 4) {
            room.teams[socket.id] = { name, score: 0 };
            io.to(currentRoomId).emit('update_teams', room.teams);
        }
    });

    socket.on('reset_teams', () => {
        if (!currentRoomId) return;
        rooms[currentRoomId].teams = {};
        io.to(currentRoomId).emit('update_teams', {});
    });

    socket.on('buzz', () => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);
        if (room.canBuzz && !room.currentBuzzer && !room.buzzedThisRound.includes(socket.id) && room.teams[socket.id]) {
            room.currentBuzzer = socket.id;
            room.canBuzz = false;
            io.to(currentRoomId).emit('play_sound', { track: 'buzz_sound' });
            io.to(currentRoomId).emit('lock_buzz', { name: room.teams[socket.id].name, id: socket.id });
        }
    });

    socket.on('start_game_ai', async (theme) => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);
        io.to(currentRoomId).emit('play_sound', { track: 'start_game' });
        
        // CORRECTION : Récupération et assignation des questions
        room.gameQuestions = await getQuestionsFromDB(theme);
        
        if (room.gameQuestions.length === 0) {
            console.error(`Aucune question trouvée pour le thème : ${theme}`);
            return;
        }

        room.currentQuestionIndex = 0;
        // Lancement immédiat de la première question au lieu d'attendre 20 secondes !
        sendQuestion(currentRoomId); 
    });

    socket.on('submit_answer', (choiceIndex) => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);
        if (room.currentBuzzer !== socket.id) return;
        const q = room.gameQuestions[room.currentQuestionIndex];
        
        if (choiceIndex === q.answer) {
            room.teams[socket.id].score += 10;
            io.to(currentRoomId).emit('result_animation', { status: 'correct', team: room.teams[socket.id].name });
            setTimeout(() => nextQuestion(currentRoomId), 2000);
        } else {
            room.teams[socket.id].score -= 5;
            room.buzzedThisRound.push(socket.id);
            room.currentBuzzer = null;
            io.to(currentRoomId).emit('result_animation', { status: 'wrong', team: room.teams[socket.id].name });
            if (room.buzzedThisRound.length >= Object.keys(room.teams).length) {
                setTimeout(() => nextQuestion(currentRoomId), 2000);
            } else {
                room.canBuzz = true;
                io.to(currentRoomId).emit('release_buzz', { buzzedThisRound: room.buzzedThisRound });
            }
        }
        io.to(currentRoomId).emit('update_teams', room.teams);
    });

    socket.on('disconnect', () => {
        if (currentRoomId && rooms[currentRoomId]?.teams[socket.id]) {
            delete rooms[currentRoomId].teams[socket.id];
            io.to(currentRoomId).emit('update_teams', rooms[currentRoomId].teams);
        }
    });
});

function sendQuestion(roomId) {
    const room = rooms[roomId];
    room.canBuzz = false;
    const q = room.gameQuestions[room.currentQuestionIndex];
    io.to(roomId).emit('play_sound', { track: 'pre_question' });
    io.to(roomId).emit('new_question_intro', { text: q.text });
    setTimeout(() => {
        room.canBuzz = true;
        io.to(roomId).emit('play_sound', { track: 'question_timer' });
        io.to(roomId).emit('show_options', { options: q.options });
    }, 5000);
}

function nextQuestion(roomId) {
    const room = rooms[roomId];
    room.currentQuestionIndex++;
    room.currentBuzzer = null;
    room.buzzedThisRound = [];
    if (room.currentQuestionIndex < room.gameQuestions.length) {
        sendQuestion(roomId);
    } else {
        io.to(roomId).emit('game_over', room.teams);
    }
}

server.listen(3000, () => console.log('Server running on port 3000'));