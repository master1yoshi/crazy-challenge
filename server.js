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

// 1. BASE DE DONNÉES (Sécurisée avec variables d'environnement)
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'crazychallenge-achrafmalki448-c95d.l.aivencloud.com',
    port: process.env.DB_PORT || 13187,
    user: process.env.DB_USER || 'avnadmin',
    password: process.env.DB_PASSWORD || 'AVNS_urj7HOP6C8wvfRmHmIa', 
    database: process.env.DB_DATABASE || 'defaultdb',
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

// 2. CONFIGURATION DE L'IA GEMINI
const GEMINI_KEY = process.env.GEMINI_API_KEY || "AIzaSyCmxmaPnEioJNjFHyjQQ_XxuupAoEfIKOY";
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// 3. STRUCTURE DE STOCKAGE MULTI-CAMPUS
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
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Generate 5 quiz questions about "${theme}" in JSON format: [{"type": "${theme}", "text": "...", "options": ["A", "B", "C", "D"], "answer": 0}]`;
    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, "").trim();
        const questions = JSON.parse(text);
        questions.forEach(q => {
            db.query('INSERT INTO questions (type, text, option_a, option_b, option_c, option_d, answer) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [q.type, q.text, q.options[0], q.options[1], q.options[2], q.options[3], q.answer]);
        });
        return questions;
    } catch (e) { 
        console.error("Gemini Error:", e);
        return []; 
    }
}

// 4. ROUTAGE DES PAGES HTML SÉCURISÉES
app.get('/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/:roomId/spectateur', (req, res) => {
    res.sendFile(path.join(__dirname, 'spectateur.html'));
});

app.get('/:roomId/host-secure-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'host.html'));
});

// 5. LOGIQUE TEMPS RÉEL MULTI-CAMPUS (SOCKET.IO)
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

        io.to(currentRoomId).emit('status_message', "AI generating questions...");
        room.gameQuestions = await generateQuestionsWithAI(theme);
        
        if (room.gameQuestions.length > 0) { 
            room.currentQuestionIndex = 0; 
            sendQuestion(currentRoomId); 
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
    io.to(roomId).emit('new_question_intro', { type: q.type, text: q.text });
    setTimeout(() => { 
        room.canBuzz = true; 
        io.to(roomId).emit('show_options', { options: [q.option_a, q.option_b, q.option_c, q.option_d] }); 
    }, 3000);
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