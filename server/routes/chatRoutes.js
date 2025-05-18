const express = require('express');
const router = express.Router();
const {
    accessChat,
    fetchChats,
    getChatMessages,
    createGroupChat,
    renameGroup,
    addToGroup,
    removeFromGroup,
    addTaskToGroup,
    updateGroupTask,
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(protect, accessChat).get(protect, fetchChats);
router.route('/:chatId/messages').get(protect, getChatMessages);

// Group routes
router.route('/group').post(protect, createGroupChat);
router.route('/group/rename').put(protect, renameGroup);
router.route('/group/add').put(protect, addToGroup);
router.route('/group/remove').put(protect, removeFromGroup);

// Group tasks/calendar routes
router.route('/group/:chatId/task').post(protect, addTaskToGroup);
router.route('/group/:chatId/task/:taskId').put(protect, updateGroupTask);


module.exports = router;