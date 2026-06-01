const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Charger les questions depuis le fichier JSON local
let allQuestions = {};
try {
    allQuestions = JSON.parse(fs.readFileSync('./questions.json', 'utf8'));
} catch (err) {
    console.error("Erreur lecture questions.json :", err);
}

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

    socket.on('reset_teams', () => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);
        room.teams = {};
        io.to(currentRoomId).emit('update_teams', room.teams);
    });

    socket.on('start_game_ai', (theme) => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);
        
        if (allQuestions[theme]) {
            room.gameQuestions = allQuestions[theme];
            room.currentQuestionIndex = 0;
            room.buzzedThisRound = [];
            room.currentBuzzer = null;
            sendQuestion(currentRoomId);
        }
    });

    socket.on('buzz', () => {
        if (!currentRoomId) return;
        const room = getOrCreateRoom(currentRoomId);
        if (room.canBuzz && !room.currentBuzzer && !room.buzzedThisRound.includes(socket.id)) {
            room.currentBuzzer = socket.id;
            room.canBuzz = false;
            io.to(currentRoomId).emit('lock_buzz', { name: room.teams[socket.id]?.name || "Joueur", id: socket.id });
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
                io.to(currentRoomId).emit('release_buzz', {});
            }
        }
        io.to(currentRoomId).emit('update_teams', room.teams);
    });

    socket.on('disconnect', () => {
        if (currentRoomId && rooms[currentRoomId] && rooms[currentRoomId].teams[socket.id]) {
            delete rooms[currentRoomId].teams[socket.id];
            io.to(currentRoomId).emit('update_teams', rooms[currentRoomId].teams);
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
        io.to(roomId).emit('show_options', { options: q.options });
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

server.listen(process.env.PORT || 3000, () => console.log(`Server running on port ${process.env.PORT || 3000}`));