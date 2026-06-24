const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// === CONNEXION À LA VRAIE BASE DE DONNÉES POSTGRESQL (Obligatoire pour la note) ===
const pool = new Pool({
    // On met le lien en dur pour garantir que ça marche partout (PC et Render) sans erreur
    connectionString: "postgresql://neondb_owner:npg_c5Qx4uYTzrGL@ep-gentle-breeze-astxg7t4.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require",
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
            currentTheme: 'Programmation',
            nextTheme: 'Programmation',
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
                io.to(pin).emit('update_players', activeGames[pin].players);
                io.to(activeGames[pin].admin).emit('update_players', activeGames[pin].players);
            }
            socket.emit('join_success', { role });
        }
    });

    socket.on('change_theme', (data) => {
        const { pin, theme } = data;
        if (activeGames[pin]) {
            activeGames[pin].nextTheme = theme;
            io.to(pin).emit('theme_notification', theme);
        }
    });

    // C'EST ICI QUE LE SERVEUR VA CHERCHER DANS TA BASE DE DONNÉES NEON
    socket.on('admin_action_next', async (data) => {
        const { pin } = data;
        const game = activeGames[pin];
        if (!game) return;

        game.currentTheme = game.nextTheme;
        game.lockedPlayers = [];
        game.buzzedPlayerId = null;

        try {
            // Requête SQL pour tirer une question aléatoire du thème choisi
            const result = await pool.query('SELECT * FROM questions WHERE theme = $1 ORDER BY RANDOM() LIMIT 1', [game.currentTheme]);
            
            if (result.rows.length > 0) {
                const q = result.rows[0];
                game.status = 'reading';

                // Formatage des données
                const formattedQ = {
                    question_text: q.question_text,
                    choice_a: q.choice_a,
                    choice_b: q.choice_b,
                    choice_c: q.choice_c,
                    choice_d: q.choice_d,
                    correct_answer: q.correct_answer
                };

                io.to(game.admin).emit('admin_display_question', formattedQ);
                
                const safeQ = { 
                    question_text: formattedQ.question_text, 
                    choice_a: formattedQ.choice_a, 
                    choice_b: formattedQ.choice_b, 
                    choice_c: formattedQ.choice_c, 
                    choice_d: formattedQ.choice_d 
                };
                io.to(pin).emit('display_question', safeQ);

                setTimeout(() => { if (activeGames[pin]) activeGames[pin].status = 'waiting_for_buzz'; }, 4000);
            } else {
                 io.to(game.admin).emit('admin_error', `Aucune question dans la base de données pour le thème : ${game.currentTheme}`);
            }
        } catch (error) {
            console.error("Erreur DB:", error);
            io.to(game.admin).emit('admin_error', "Erreur de base de données : " + error.message);
        }
    });

    socket.on('buzz', () => {
        const pin = socket.gamePin;
        const game = activeGames[pin];
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
        
        if(!pId || !game.players[pId]) return;

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
            io.to(pin).emit('update_players', game.players);
            io.to(game.admin).emit('update_players', game.players);
        } else {
            game.players[pId].score -= 1;
            game.lockedPlayers.push(pId);
            
            io.to(pin).emit('update_players', game.players);
            io.to(game.admin).emit('update_players', game.players);

            const totalPlayers = Object.keys(game.players).length;
            if (totalPlayers <= 1 || game.lockedPlayers.length >= totalPlayers) {
                io.to(pin).emit('answer_wrong_all', { name: pName, score: game.players[pId].score });
                game.status = 'lobby'; 
                game.buzzedPlayerId = null;
            } else {
                io.to(pin).emit('answer_wrong', { name: pName, score: game.players[pId].score, lockedId: pId });
                game.status = 'waiting_for_buzz';
                game.buzzedPlayerId = null;
            }
        }
    });
    
    socket.on('disconnect', () => {
        const pin = socket.gamePin;
        if (pin && activeGames[pin] && activeGames[pin].players[socket.id]) {
            delete activeGames[pin].players[socket.id];
            io.to(pin).emit('update_players', activeGames[pin].players);
            io.to(activeGames[pin].admin).emit('update_players', activeGames[pin].players);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));