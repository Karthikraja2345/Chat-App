// server/server.js
const express = require('express');
const http = require('http'); // Use this for creating the server
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const socketHandler = require('./socket/socketHandler');
const chatController = require('./controllers/chatController'); // If you were planning to use setSocketIO

dotenv.config();
connectDB();

const app = express();

// Create HTTP server
const httpServer = http.createServer(app); // Renamed to avoid confusion

app.use(cors({
    origin: "http://localhost:5173", // Good to be specific
    // methods: ["GET", "POST", "PUT", "DELETE"], // Add other methods if needed by CORS
    // credentials: true // If you use cookies/sessions with CORS
}));
app.use(express.json());

// Make io instance available to controllers via req.app.get('socketio')
// This needs to be done BEFORE routes that might use it are defined,
// but io is initialized AFTER httpServer, so this is tricky for direct app.set here.
// A common pattern is to pass `io` to route handlers if they need it,
// or use `app.set` *after* `io` is initialized if routes don't need it during setup.
// For `req.app.get('socketio')` to work in controllers, `io` needs to be set on `app`.
// Let's initialize io and then set it.

const io = new Server(httpServer, { // Pass httpServer here
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST", "PUT", "DELETE"] // Allow PUT for your admin routes
    }
});

// Now that io is initialized, set it on the app so controllers can access it
app.set('socketio', io);
// If you had a setSocketIO function in chatController:
// chatController.setSocketIO(io);


app.get('/', (req, res) => res.send('API Running'));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/chats', require('./routes/chatRoutes')); // Correctly mounted

socketHandler(io);

const PORT = process.env.PORT || 5001;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`)); // Use httpServer to listen