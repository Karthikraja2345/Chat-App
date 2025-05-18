// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const socketHandler = require('./socket/socketHandler');

// Load env vars
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors()); // Configure specific origins in production
app.use(express.json()); // To accept JSON data

// Basic Route
app.get('/', (req, res) => res.send('API Running'));

// Define Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));
// app.use('/api/groups', require('./routes/groupRoutes')); // if you separate group logic fully

const PORT = process.env.PORT || 5001;

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // Your React app's URL
        methods: ["GET", "POST"]
    }
});

// Socket.IO connection handling
socketHandler(io);


server.listen(PORT, () => console.log(`Server running on port ${PORT}`));