// server/server.js
const express = require('express');
const http = require('http'); // Use this for creating the server
const { Server } = require('socket.io');
const dotenv = require('dotenv');
dotenv.config(); // Load .env variables at the top

const cors = require('cors');
const connectDB = require('./config/db');
const socketHandler = require('./socket/socketHandler');

const multer = require('multer'); // Still needed for the direct /api/files/upload route
const path = require('path');
const fs = require('fs');

// Import file routes AFTER dotenv.config()
const fileRoutes = require('./routes/fileRoutes');

const chatController = require('./controllers/chatController'); // If you were planning to use setSocketIO


connectDB();
const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer storage for regular file uploads (to server/uploads)
const mainUploadsStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'uploads');
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
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: function(req, file, cb) { cb(null, true); } // Basic filter
}).single('file');

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.send('API Running! CloudConvert Ready.'));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));
app.use('/api/files', fileRoutes); // Handles /api/files/convert

app.post('/api/files/upload', (req, res) => {
    mainUpload(req, res, function (err) {
        if (err) { /* ... multer error handling ... */ 
            console.error('Direct upload multer error:', err);
            return res.status(400).json({ message: err.message || "Upload failed."});
        }
        if (!req.file) return res.status(400).json({ message: 'No file for direct upload.' });
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.status(200).json({
            message: 'File uploaded successfully!',
            fileUrl: fileUrl,
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
            fileSize: req.file.size,
        });
    });
});

const PORT = process.env.PORT || 5001;
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    }
});
socketHandler(io);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    const uploadsDir = path.join(__dirname, 'uploads');
    const tempUploadsDir = path.join(__dirname, '..', 'temp_uploads'); // project_root/temp_uploads
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    if (!fs.existsSync(tempUploadsDir)) fs.mkdirSync(tempUploadsDir, { recursive: true });
    if (!process.env.CLOUDCONVERT_API_KEY) {
        console.warn("WARNING: CLOUDCONVERT_API_KEYis not set in .env file. File conversion will fail.");
    }
});
