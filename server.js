require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static('public'));

// PostgreSQL Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for cloud databases like Render/Neon
});

// In-Memory Game State Tracker (Super fast, handles the buzzer races)
const activeGames = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // 1. Admin creates a room
    socket.on('admin_create_game', () => {
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        activeGames[pin] = {
            admin: socket.id,
            players: [],
            status: 'lobby', // lobby, reading, waiting_for_buzz, answered
            currentQuestion: null
        };
        socket.join(pin);
        socket.emit('game_created', { pin });
        console.log(`Game created with PIN: ${pin}`);
    });

    // 2. Players & Spectators join a room
    socket.on('join_game', (data) => {
        const { pin, name, role } = data;
        
        if (activeGames[pin]) {
            socket.join(pin);
            socket.gamePin = pin;
            socket.role = role;

            if (role === 'player') {
                activeGames[pin].players.push({ id: socket.id, name, score: 0 });
                io.to(activeGames[pin].admin).emit('player_joined', name);
            }
            socket.emit('join_success', { role });
        } else {
            socket.emit('error', 'PIN Invalide');
        }
    });

    // 3. Admin shows a question (Fetches from DB and broadcasts)
    socket.on('admin_action_next', async (data) => {
        const { pin } = data;
        if (!activeGames[pin]) return;

        try {
            // Fetch a random question from PostgreSQL
            const result = await pool.query('SELECT * FROM questions ORDER BY RANDOM() LIMIT 1');
            if (result.rows.length > 0) {
                const questionData = result.rows[0];
                activeGames[pin].status = 'reading';
                activeGames[pin].currentQuestion = questionData;

                // Send to room
                io.to(pin).emit('display_question', questionData);

                // Unlock buzzers exactly when choices finish revealing (4 seconds)
                setTimeout(() => {
                    if (activeGames[pin]) activeGames[pin].status = 'waiting_for_buzz';
                }, 4000);
            }
        } catch (err) {
            console.error("DB Error:", err);
        }
    });

    // 4. Handle the Buzzer Race
    socket.on('buzz', () => {
        const pin = socket.gamePin;
        if (!pin || !activeGames[pin]) return;

        // The Gatekeeper: Ignore if not in the right state
        if (activeGames[pin].status !== 'waiting_for_buzz') return;

        // First to pass the gatekeeper locks the state!
        activeGames[pin].status = 'answered';
        io.to(pin).emit('buzzer_hit', socket.id); 
        io.to(activeGames[pin].admin).emit('player_buzzed', socket.id); // Tell admin who won
    });

    // 5. Admin validates the answer
    socket.on('admin_validate', (data) => {
        const { pin, isCorrect } = data;
        io.to(pin).emit('answer_result', isCorrect);
        // Reset state for next question
        if (activeGames[pin]) activeGames[pin].status = 'lobby'; 
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Additional logic can be added here to remove players from activeGames array
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});