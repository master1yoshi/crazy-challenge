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
            lockedPlayers: [],
            status: 'lobby',
            currentTheme: 'Programmation', // <-- LE FIX EST ICI
            nextTheme: 'Programmation',    // <-- LE FIX EST ICI
            buzzedPlayerId: null
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

            if (role === 'player') {
                activeGames[pin].players[socket.id] = { name, score: 0 };
                io.to(activeGames[pin].admin).emit('update_players', activeGames[pin].players);
            }
            socket.emit('join_success', { role });
        }
    });

    // Le Host change le thème pour la SUIVANTE
    socket.on('change_theme', (data) => {
        const { pin, theme } = data;
        if (activeGames[pin]) {
            activeGames[pin].nextTheme = theme;
            io.to(pin).emit('theme_notification', theme);
        }
    });

    socket.on('admin_action_next', async (data) => {
        const { pin } = data;
        const game = activeGames[pin];
        if (!game) return;

        // Appliquer le changement de thème s'il y en a eu un
        game.currentTheme = game.nextTheme;
        game.lockedPlayers = []; // Réinitialiser les pénalités
        game.buzzedPlayerId = null;

        try {
            const result = await pool.query('SELECT * FROM questions WHERE theme = $1 ORDER BY RANDOM() LIMIT 1', [game.currentTheme]);
            if (result.rows.length > 0) {
                const q = result.rows[0];
                game.status = 'reading';

                io.to(game.admin).emit('admin_display_question', q);
                
                const safeQ = { question_text: q.question_text, choice_a: q.choice_a, choice_b: q.choice_b, choice_c: q.choice_c, choice_d: q.choice_d };
                io.to(pin).emit('display_question', safeQ);

                setTimeout(() => { if (activeGames[pin]) activeGames[pin].status = 'waiting_for_buzz'; }, 4000);
            } else {
                // LA SÉCURITÉ : Si la base de données est vide pour ce thème !
                io.to(game.admin).emit('admin_error', `Aucune question trouvée pour le thème : ${game.currentTheme}. Avez-vous exécuté node seed.js ?`);
            }
        } catch (err) { console.error(err); }
    });

    socket.on('buzz', () => {
        const pin = socket.gamePin;
        const game = activeGames[pin];
        // Bloquer si le jeu n'est pas en attente, ou si le joueur a déjà eu faux à cette question
        if (!game || game.status !== 'waiting_for_buzz' || game.lockedPlayers.includes(socket.id)) return;

        game.status = 'answering';
        game.buzzedPlayerId = socket.id;
        
        io.to(pin).emit('buzzer_hit', { winnerId: socket.id, name: game.players[socket.id].name }); 
    });

    socket.on('submit_answer', (answer) => {
        const pin = socket.gamePin;
        const game = activeGames[pin];
        if (!game || game.status !== 'answering' || game.buzzedPlayerId !== socket.id) return;
        
        io.to(game.admin).emit('player_answered', { name: game.players[socket.id].name, answer });
        io.to(pin).emit('spectator_answer_locked', { name: game.players[socket.id].name, answer });
    });

    socket.on('admin_validate', (data) => {
        const { pin, isCorrect } = data;
        const game = activeGames[pin];
        const pId = game.buzzedPlayerId;
        const pName = game.players[pId].name;

        if (isCorrect) {
            game.players[pId].score += 1;
            if (game.players[pId].score >= 10) {
                io.to(pin).emit('game_over', { name: pName, score: game.players[pId].score });
                game.status = 'finished';
            } else {
                io.to(pin).emit('answer_correct', { name: pName, score: game.players[pId].score });
                game.status = 'lobby';
            }
            io.to(game.admin).emit('update_players', game.players);
        } else {
            game.players[pId].score -= 1;
            game.lockedPlayers.push(pId); // Il ne peut plus buzzer sur cette question
            io.to(pin).emit('answer_wrong', { name: pName, score: game.players[pId].score, lockedId: pId });
            io.to(game.admin).emit('update_players', game.players);
            
            game.status = 'waiting_for_buzz'; // Relance pour les autres
            game.buzzedPlayerId = null;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));