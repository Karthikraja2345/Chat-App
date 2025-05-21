// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
dotenv.config(); // Load .env variables at the very top

const cors = require('cors');
const connectDB = require('./config/db');
const socketHandler = require('./socket/socketHandler');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const fileRoutes = require('./routes/fileRoutes'); // For CloudConvert and other file operations

// Connect to Database
connectDB();

const app = express();

// CORS Configuration
// Using the more specific origin from the first file, but allowing credentials from the second.
// Make CLIENT_URL in .env match your frontend URL (e.g., http://localhost:5173)
const clientURL = process.env.CLIENT_URL || "http://localhost:5173";
app.use(cors({
    origin: clientURL,
    methods: ["GET", "POST", "PUT", "DELETE"], // Explicitly list methods
    credentials: true // Important if your frontend sends credentials (cookies, auth headers)
}));

// Middlewares
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Multer storage configuration for direct file uploads to the server
const mainUploadsStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'uploads');
        // Ensure the directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const mainUpload = multer({
    storage: mainUploadsStorage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit, adjust as needed
    fileFilter: function(req, file, cb) {
        // Add more sophisticated file filtering if needed
        cb(null, true);
    }
}).single('file'); // Expects a single file with fieldname 'file'

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic Route
app.get('/', (req, res) => res.send('API Running! File uploads and CloudConvert features ready.'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/files', fileRoutes); // Handles /api/files/convert and other file-related routes

// Direct file upload endpoint (moved from inside app.use for clarity)
app.post('/api/files/upload', (req, res) => {
    mainUpload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            console.error('Direct upload Multer error:', err);
            return res.status(400).json({ message: `Multer error: ${err.message}` });
        } else if (err) {
            // An unknown error occurred when uploading.
            console.error('Direct upload unknown error:', err);
            return res.status(500).json({ message: err.message || "Upload failed due to an unknown error." });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        // Construct the file URL
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.status(200).json({
            message: 'File uploaded successfully!',
            fileUrl: fileUrl,
            fileName: req.file.originalname, // Original name for display
            filePath: req.file.path,      // Server path to the file
            fileType: req.file.mimetype,
            fileSize: req.file.size,
        });
    });
});


// Create HTTP server and initialize Socket.IO
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: clientURL,
        methods: ["GET", "POST", "PUT", "DELETE"] // Ensure Socket.IO also allows these methods
        // credentials: true // Usually not needed for Socket.IO unless specific auth mechanisms are used
    },
    // Optional: Increase pingTimeout and pingInterval if experiencing frequent disconnects
    // pingTimeout: 60000,
    // pingInterval: 25000,
});

// Make io instance available to controllers/services if needed
// This allows access via req.app.get('socketio') in route handlers
app.set('socketio', io);

// Initialize Socket.IO event handling
socketHandler(io);

const PORT = process.env.PORT || 5001;

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Client URL configured for: ${clientURL}`);

    // Ensure necessary directories exist on startup
    const uploadsDir = path.join(__dirname, 'uploads');
    const tempUploadsDir = path.join(__dirname, '..', 'temp_uploads'); // For temporary CloudConvert files

    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log(`Created directory: ${uploadsDir}`);
    }
    if (!fs.existsSync(tempUploadsDir)) {
        fs.mkdirSync(tempUploadsDir, { recursive: true });
        console.log(`Created directory: ${tempUploadsDir}`);
    }

    // Warning for CloudConvert API Key
    if (!process.env.CLOUDCONVERT_API_KEY) {
        console.warn("\nWARNING: CLOUDCONVERT_API_KEY is not set in .env file. File conversion features will fail.\n");
    }
    if (!process.env.CLOUDCONVERT_SANDBOX || process.env.CLOUDCONVERT_SANDBOX !== 'false') {
        console.info("INFO: CloudConvert is likely running in SANDBOX mode. Ensure CLOUDCONVERT_SANDBOX=false in .env for live processing.");
    }
});