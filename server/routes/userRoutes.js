const express = require('express');
const router = express.Router();
const { getMe, updateProfile, searchUsers } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
// const multer = require('multer'); // For file uploads
// const upload = multer({ dest: 'uploads/' }); // Configure multer

router.get('/me', protect, getMe);
// router.put('/profile', protect, upload.single('profilePicture'), updateProfile); // With file upload
router.put('/profile', protect, updateProfile); // Without file upload for now
router.get('/search', protect, searchUsers);

module.exports = router;