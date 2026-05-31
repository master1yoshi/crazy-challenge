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
app.use(express.static(path.join(__dirname, 'public')));

// Connexion MySQL
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false }
});

db.connect(err => {
    if (err) console.error('Aiven Connection Error:', err);
    else {
        console.log('Connected to Aiven MySQL!');
        db.query(`CREATE TABLE IF NOT EXISTS questions (
            id INT AUTO_INCREMENT PRIMARY KEY, type VARCHAR(50), text TEXT,
            option_a VARCHAR(255), option_b VARCHAR(255),
            option_c VARCHAR(255), option_d VARCHAR(255), answer INT
        )`);
    }
});

// IA Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function generateQuestionsWithAI(theme) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Génère 10 questions de quiz en français sur "${theme}". Réponds UNIQUEMENT en JSON avec ce format: [{"text": "Question", "options": ["A", "B", "C", "D"], "answer": 0}]`;
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '');
        return JSON.parse(text);
    } catch (e) {
        console.error("Erreur Gemini:", e);
        return Array.from({length: 10}, (_, i) => ({ text: `Question secours ${i+1}`, options: ["A", "B", "C", "D"], answer: 0 }));
    }
}

// Logique Jeu
let rooms = {};
io.on('connection', (socket) => {
    let currentRoomId = null;
    socket.on('join_room', (roomId) => { 
        socket.join(roomId); 
        currentRoomId = roomId; 
        if(!rooms[roomId]) rooms[roomId] = { teams: {}, questions: [], index: -1 };
    });
    
    socket.on('start_game_ai', async (theme) => {
        const room = rooms[currentRoomId];
        room.questions = await generateQuestionsWithAI(theme);
        room.index = 0;
        io.to(currentRoomId).emit('new_question', room.questions[0]);
    });

    socket.on('submit_answer', (idx) => {
        const room = rooms[currentRoomId];
        const correct = room.questions[room.index].answer === idx;
        io.to(currentRoomId).emit('answer_result', { correct });
        if(correct) {
            room.index++;
            if(room.index < room.questions.length) io.to(currentRoomId).emit('new_question', room.questions[room.index]);
            else io.to(currentRoomId).emit('game_over');
        }
    });
});

server.listen(process.env.PORT || 10000, () => console.log("Server running"));