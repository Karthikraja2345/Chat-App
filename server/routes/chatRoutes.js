// server/routes/chatRoutes.js
const express = require('express');
const router = express.Router();

// Ensure promoteToGroupAdmin is listed here and NOT commented out
const {
    accessChat,
    fetchChats,
    getChatMessages,
    createGroupChat,
    renameGroup,
    addToGroup,
    removeFromGroup,
    promoteToGroupAdmin, // <--- MAKE SURE THIS IS UNCOMMENTED AND CORRECTLY IMPORTED
    demoteFromGroupAdmin,
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

// Group Admin Management Routes

// !!!!! REMOVE OR COMMENT OUT THE TEMPORARY TEST ROUTE HANDLER !!!!!
/*
router.route('/group/admin/add').put((req, res) => {
    console.log("!!!!!! TEST /group/admin/add ROUTE HANDLER HIT !!!!!!");
    console.log("Request Body:", req.body);
    res.status(200).json({ message: "TEST promote admin route reached!", data: req.body });
});
*/

// !!!!! RESTORE THE ORIGINAL ROUTE WITH `protect` AND `promoteToGroupAdmin` !!!!!
router.route('/group/admin/add').put(protect, promoteToGroupAdmin);

router.route('/group/admin/remove').put(protect, demoteFromGroupAdmin);


// Group tasks/calendar routes
router.route('/group/:chatId/task').post(protect, addTaskToGroup);
router.route('/group/:chatId/task/:taskId').put(protect, updateGroupTask);

module.exports = router;