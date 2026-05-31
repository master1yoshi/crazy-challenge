const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const fs = require('fs');

// Chargement des questions depuis le fichier JSON
const questionsData = JSON.parse(fs.readFileSync('./questions.json', 'utf8'));

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 13187,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false }
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
        return getFallbackQuestions(theme);
    }
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const result = await model.generateContent(`Generate 10 questions about "${theme}" in JSON: [{"type": "${theme}", "text": "...", "options": ["A", "B", "C", "D"], "answer": 0}]`);
        return JSON.parse(result.response.text());
    } catch (e) { return getFallbackQuestions(theme); }
}

function getFallbackQuestions(theme) {
    return Array.from({length: 10}, (_, i) => ({
        type: theme,
        text: `Question de secours ${i+1}`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        answer: 0
    }));
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
        room.teams[socket.id] = { name, score: 0 };
        io.to(currentRoomId).emit('update_teams', room.teams);
    });

    socket.on('change_theme', (theme) => {
        if (!currentRoomId) return;
        if (questionsData[theme]) {
            const room = getOrCreateRoom(currentRoomId);
            const all = [...questionsData[theme]];
            room.gameQuestions = all.sort(() => 0.5 - Math.random()).slice(0, 20);
            room.currentQuestionIndex = 0;
            io.to(currentRoomId).emit('status_message', `Le Host a choisi le thème : ${theme.toUpperCase()}`);
            sendQuestion(currentRoomId);
        }
    });

    socket.on('buzz', () => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);
        if (room.canBuzz && !room.currentBuzzer && !room.buzzedThisRound.includes(socket.id)) {
            room.currentBuzzer = socket.id;
            room.canBuzz = false;
            io.to(currentRoomId).emit('play_sound', { track: 'buzz_sound' });
            io.to(currentRoomId).emit('lock_buzz', { name: room.teams[socket.id].name, id: socket.id });
        }
    });

    socket.on('submit_answer', (choiceIndex) => {
        if (!currentRoomId || room.currentBuzzer !== socket.id) return;
        const room = getOrCreateRoom(currentRoomId);
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
            }
        }
        io.to(currentRoomId).emit('update_teams', room.teams);
    });
});

function sendQuestion(roomId) {
    const room = rooms[roomId];
    room.canBuzz = false;
    const q = room.gameQuestions[room.currentQuestionIndex];
    io.to(roomId).emit('play_sound', { track: 'pre_question' });
    io.to(roomId).emit('game_state_update', { question: q.text, options: q.options, type: q.type, teams: room.teams });
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
    if (room.currentQuestionIndex < room.gameQuestions.length) sendQuestion(roomId);
    else io.to(roomId).emit('game_over');
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));