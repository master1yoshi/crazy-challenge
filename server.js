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

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 13187,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
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

// ROUTAGE COMPLET
app.get('/', (req, res) => res.send("Bienvenue sur Crazy Challenge."));
app.get('/:roomId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/:roomId/spectateur', (req, res) => res.sendFile(path.join(__dirname, 'public', 'spectateur.html')));
app.get('/:roomId/host-secure-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'host.html')));

// LOGIQUE JEU COMPLETE
function sendQuestion(roomId) {
    const room = rooms[roomId];
    room.canBuzz = true;
    const q = room.gameQuestions[room.currentQuestionIndex];
    io.to(roomId).emit('new_question', {
        question: q.text,
        options: q.options,
        type: q.type,
        current: room.currentQuestionIndex + 1,
        total: room.gameQuestions.length,
        teams: room.teams
    });
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

    socket.on('start_game_ai', async (theme) => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);
        // Ici, tu remets ta fonction de génération complète
        room.currentQuestionIndex = 0;
        sendQuestion(currentRoomId);
    });

    socket.on('buzz', () => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);
        if (room.canBuzz && !room.currentBuzzer) {
            room.currentBuzzer = socket.id;
            room.canBuzz = false;
            io.to(currentRoomId).emit('lock_buzz', { name: room.teams[socket.id].name, id: socket.id });
        }
    });

    socket.on('submit_answer', (choiceIndex) => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);
        if (room.currentBuzzer !== socket.id) return;
        
        // Logique score
        room.teams[socket.id].score += 10;
        io.to(currentRoomId).emit('update_teams', room.teams);
        
        setTimeout(() => nextQuestion(currentRoomId), 2000);
    });
});

server.listen(process.env.PORT || 3000);