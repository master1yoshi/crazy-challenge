require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const activeGames = {};

io.on('connection', (socket) => {
    
    socket.on('admin_create_game', () => {
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        activeGames[pin] = {
            admin: socket.id,
            players: {},
            status: 'lobby',
            currentQuestion: null
        };
        socket.join(pin);
        socket.emit('game_created', { pin });
    });

    socket.on('join_game', (data) => {
        const { pin, name, role } = data;
        if (activeGames[pin]) {
            socket.join(pin);
            socket.gamePin = pin;
            socket.role = role;
            socket.playerName = name;

            if (role === 'player') {
                activeGames[pin].players[socket.id] = { name, score: 0 };
                io.to(activeGames[pin].admin).emit('player_joined', name);
            }
            socket.emit('join_success', { role });
        }
    });

    socket.on('admin_action_next', async (data) => {
        const { pin } = data;
        if (!activeGames[pin]) return;

        try {
            const result = await pool.query('SELECT * FROM questions ORDER BY RANDOM() LIMIT 1');
            if (result.rows.length > 0) {
                const q = result.rows[0];
                activeGames[pin].status = 'reading';
                activeGames[pin].currentQuestion = q;

                // 1. Envoyer la question COMPLÈTE (avec solution) à l'Admin
                io.to(activeGames[pin].admin).emit('admin_display_question', q);

                // 2. Envoyer la question SÉCURISÉE (sans solution) aux joueurs/spectateurs
                const safeQ = { 
                    question_text: q.question_text, 
                    choice_a: q.choice_a, choice_b: q.choice_b, 
                    choice_c: q.choice_c, choice_d: q.choice_d 
                };
                io.to(pin).emit('display_question', safeQ);

                setTimeout(() => {
                    if (activeGames[pin]) activeGames[pin].status = 'waiting_for_buzz';
                }, 4000);
            }
        } catch (err) { console.error(err); }
    });

    // Le joueur appuie sur le Buzz
    socket.on('buzz', () => {
        const pin = socket.gamePin;
        if (!pin || !activeGames[pin] || activeGames[pin].status !== 'waiting_for_buzz') return;

        activeGames[pin].status = 'answering'; // Bloque les autres buzzers
        const playerName = activeGames[pin].players[socket.id].name;
        
        io.to(pin).emit('buzzer_hit', socket.id); 
        io.to(activeGames[pin].admin).emit('player_buzzed', playerName);
    });

    // Le joueur sélectionne A, B, C ou D après avoir buzzé
    socket.on('submit_answer', (answer) => {
        const pin = socket.gamePin;
        if (!pin || !activeGames[pin] || activeGames[pin].status !== 'answering') return;
        
        const playerName = activeGames[pin].players[socket.id].name;
        io.to(activeGames[pin].admin).emit('player_answered', { name: playerName, answer });
        io.to(pin).emit('spectator_answer_locked', { name: playerName, answer }); // Pour l'écran géant
    });

    socket.on('admin_validate', (data) => {
        const { pin, isCorrect } = data;
        io.to(pin).emit('answer_result', isCorrect);
        if (activeGames[pin]) activeGames[pin].status = 'lobby'; 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));