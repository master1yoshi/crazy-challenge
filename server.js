const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const questionsData = JSON.parse(fs.readFileSync('./questions.json', 'utf8'));
let game = { teams: {}, canBuzz: false, currentBuzzer: null, currentQuestion: null };

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        game.teams[socket.id] = { name, score: 0 };
        io.emit('update_teams', Object.values(game.teams));
    });

    socket.on('start_game', (theme) => {
        game.canBuzz = true;
        game.currentBuzzer = null;
        const themeQs = questionsData[theme] || [];
        game.currentQuestion = themeQs[Math.floor(Math.random() * themeQs.length)];
        io.emit('new_question', game.currentQuestion);
    });

    socket.on('buzz', () => {
        if (game.canBuzz && !game.currentBuzzer) {
            game.canBuzz = false;
            game.currentBuzzer = socket.id;
            io.emit('buzzer_hit', game.teams[socket.id].name);
        }
    });

    socket.on('answer', (isCorrect) => {
        if (isCorrect && game.currentBuzzer) game.teams[game.currentBuzzer].score += 10;
        game.currentBuzzer = null;
        game.canBuzz = true;
        io.emit('update_teams', Object.values(game.teams));
        io.emit('answer_result', isCorrect);
    });
});

server.listen(3000, () => console.log('Serveur Chamak Chalo actif'));