const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.json());

app.use('/socket.io', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 13187,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false }
});

db.connect((err) => {
    if (err) return console.error('Aiven Connection Error:', err);
    console.log('Connected to Aiven MySQL!');
    const sql = `CREATE TABLE IF NOT EXISTS questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50), text TEXT,
        option_a VARCHAR(255), option_b VARCHAR(255),
        option_c VARCHAR(255), option_d VARCHAR(255), answer INT
    )`;
    db.query(sql, (err) => {
        if (err) console.error("Table creation failed:", err);
        else console.log("Database Table is Ready!");
    });
});

const GEMINI_KEY = process.env.GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(GEMINI_KEY || "NO_KEY");

let rooms = {}; 

function getOrCreateRoom(roomId) {
    if (!rooms[roomId]) {
        rooms[roomId] = { 
            gameQuestions: [],
            currentQuestionIndex: -1,
            teams: {},
            currentBuzzer: null,
            buzzedThisRound: [],
            canBuzz: false
        };
    }
    return rooms[roomId];
}

async function generateQuestionsWithAI(theme) {
    if (!GEMINI_KEY || GEMINI_KEY === "") {
        console.log("No API Key detected, using fallback questions.");
        return getFallbackQuestions(theme);
    }

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });
        
        const prompt = `Generate a JSON array containing exactly 10 multiple-choice quiz questions in French about the theme "${theme}". 
        Each object in the array must follow this exact structure:
        {"type": "${theme}", "text": "La question en français", "options": ["Option A", "Option B", "Option C", "Option D"], "answer": 0}
        Note: The "answer" field must be an integer (0 for A, 1 for B, 2 for C, 3 for D).`;
        
        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();
        const questions = JSON.parse(text);
        
        questions.forEach(q => {
            db.query('INSERT INTO questions (type, text, option_a, option_b, option_c, option_d, answer) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [q.type, q.text, q.options[0], q.options[1], q.options[2], q.options[3], q.answer]);
        });
        
        return questions;
    } catch (e) { 
        console.error("Gemini API Error, switching to fallback:", e);
        return getFallbackQuestions(theme);
    }
}

function getFallbackQuestions(theme) {
    let fallbackQuestions = [];
    for (let i = 1; i <= 10; i++) {
        fallbackQuestions.push({
            type: theme,
            text: `Question de secours ${i} sur le thème ${theme}. Quelle est la bonne réponse ?`,
            options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
            answer: 0
        });
    }
    return fallbackQuestions;
}

app.get('/', (req, res) => {
    res.send("<h1 style='text-align:center; font-family:sans-serif; margin-top:50px;'>Bienvenue sur Crazy Challenge !</h1>");
});

app.get('/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/:roomId/spectateur', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'spectateur.html'));
});

app.get('/:roomId/host-secure-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

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
        const room = getOrCreateRoom(currentRoomId);
        room.teams = {}; 
        io.to(currentRoomId).emit('update_teams', room.teams); 
    });

    socket.on('start_game_ai', async (theme) => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);

        // --- AUDIO 1 : Lancement au démarrage (20s avant la 1ère question) ---
        io.to(currentRoomId).emit('play_sound', { track: 'start_game' });

        io.to(currentRoomId).emit('status_message', "L'IA génère les questions...");
        room.gameQuestions = await generateQuestionsWithAI(theme);
        
        if (room.gameQuestions && room.gameQuestions.length > 0) { 
            room.currentQuestionIndex = 0; 
            setTimeout(() => sendQuestion(currentRoomId), 20000); 
        }
    });

    socket.on('buzz', () => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);

        if (room.canBuzz && !room.currentBuzzer && !room.buzzedThisRound.includes(socket.id)) {
            room.currentBuzzer = socket.id;
            room.canBuzz = false;
            io.to(currentRoomId).emit('lock_buzz', { name: room.teams[socket.id].name, id: socket.id });
        }
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
        if (!currentRoomId) return;
        const room = rooms[currentRoomId];
        if (room && room.teams[socket.id]) {
            delete room.teams[socket.id];
            io.to(currentRoomId).emit('update_teams', room.teams);
        }
    });
});

function sendQuestion(roomId) {
    const room = rooms[roomId];
    room.canBuzz = false;
    const q = room.gameQuestions[room.currentQuestionIndex];
    
    // --- AUDIO 2 : Juste avant d'afficher la question (5s avant buzzer) ---
    io.to(roomId).emit('play_sound', { track: 'pre_question' });
    
    io.to(roomId).emit('new_question_intro', { type: q.type, text: q.text });
    
    setTimeout(() => { 
        room.canBuzz = true; 
        // --- AUDIO 3 : Timer 30s de réponse ---
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));