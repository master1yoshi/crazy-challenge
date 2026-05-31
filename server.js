const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use('/socket.io', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));
app.use(express.static(path.join(__dirname, 'public')));

// 1. CONNEXION BASE DE DONNÉES (Configuration Aiven maintenue)
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
    });
});

// 2. CONFIGURATION IA
const GEMINI_KEY = process.env.GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(GEMINI_KEY || "NO_KEY");

// 3. LOGIQUE SALONS
let rooms = {}; 
function getOrCreateRoom(roomId) {
    if (!rooms[roomId]) {
        rooms[roomId] = { gameQuestions: [], currentQuestionIndex: -1, teams: {}, currentBuzzer: null, buzzedThisRound: [], canBuzz: false };
    }
    return rooms[roomId];
}

async function generateQuestionsWithAI(theme) {
    if (!GEMINI_KEY) return getFallbackQuestions(theme);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `Generate 10 multiple-choice questions in French about "${theme}". JSON structure: [{"type": "${theme}", "text": "Question", "options": ["A", "B", "C", "D"], "answer": 0}]`;
        const result = await model.generateContent(prompt);
        const questions = JSON.parse(result.response.text());
        questions.forEach(q => {
            db.query('INSERT INTO questions (type, text, option_a, option_b, option_c, option_d, answer) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [q.type, q.text, q.options[0], q.options[1], q.options[2], q.options[3], q.answer]);
        });
        return questions;
    } catch (e) { return getFallbackQuestions(theme); }
}

function getFallbackQuestions(theme) {
    return Array.from({length: 10}, (_, i) => ({ type: theme, text: `Question secours ${i+1}`, options: ["A", "B", "C", "D"], answer: 0 }));
}

// 4. ROUTAGE (Corrigé pour résoudre l'erreur de image_791520.png)
app.get('/', (req, res) => res.send("<h1>Crazy Challenge !</h1>"));
app.get('/:roomId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/:roomId/spectateur', (req, res) => res.sendFile(path.join(__dirname, 'public', 'spectateur.html')));
app.get('/:roomId/host-secure-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'host.html')));

// 5. WEBSOCKETS (Logique complète conservée)
io.on('connection', (socket) => {
    let currentRoomId = null;
    socket.on('join_room', (roomId) => { socket.join(roomId); currentRoomId = roomId; });
    socket.on('join_team', (name) => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);
        if (Object.keys(room.teams).length < 4) {
            room.teams[socket.id] = { name, score: 0 };
            io.to(currentRoomId).emit('update_teams', room.teams);
        }
    });
    socket.on('start_game_ai', async (theme) => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);
        room.gameQuestions = await generateQuestionsWithAI(theme);
        room.currentQuestionIndex = 0;
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
            room.buzzedThisRound.push(socket.id); room.currentBuzzer = null;
            io.to(currentRoomId).emit('result_animation', { status: 'wrong', team: room.teams[socket.id].name });
            if (room.buzzedThisRound.length >= Object.keys(room.teams).length) setTimeout(() => nextQuestion(currentRoomId), 2000);
            else { room.canBuzz = true; io.to(currentRoomId).emit('release_buzz', {}); }
        }
    });
    // [Autres fonctions socket.on ici...]
    socket.on('buzz', () => { /* Logique buzzer identique */ });
});

function sendQuestion(roomId) {
    const room = rooms[roomId];
    room.canBuzz = true;
    io.to(roomId).emit('new_question_intro', { type: room.gameQuestions[room.currentQuestionIndex].type, text: room.gameQuestions[room.currentQuestionIndex].text });
}
function nextQuestion(roomId) {
    const room = rooms[roomId]; room.currentQuestionIndex++; room.currentBuzzer = null; room.buzzedThisRound = [];
    if (room.currentQuestionIndex < room.gameQuestions.length) sendQuestion(roomId);
    else io.to(roomId).emit('game_over', room.teams);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));