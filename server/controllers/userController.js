// server/controllers/userController.js
const User = require('../models/User');

// Function to escape special characters for regex
function escapeRegExp(string) {
    if (typeof string !== 'string') { // Ensure it's a string
        return '';
    }
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// @desc    Get current user's profile
// ... (getMe function as before) ...
exports.getMe = async (req, res) => {
    console.log('Backend getMe: Fetching profile for user ID:', req.user ? req.user.id : 'UNKNOWN (req.user missing)');
    try {
        if (!req.user || !req.user.id) {
            console.error('Backend getMe: req.user or req.user.id is undefined. Auth middleware issue?');
            return res.status(401).json({ message: 'Not authorized, user context missing' });
        }
        const user = await User.findById(req.user.id).select('-otp -otpExpires');
        if (!user) {
            console.log('Backend getMe: User not found in DB for ID:', req.user.id);
            return res.status(404).json({ message: 'User not found' });
        }
        console.log('Backend getMe: Profile found and sending:', { id: user.id, name: user.name, phoneNumber: user.phoneNumber });
        res.json(user);
    } catch (error) {
        console.error('Backend getMe: Server Error:', error);
        res.status(500).json({ message: 'Server Error fetching profile' });
    }
};


// @desc    Update user profile (name, profile picture, status)
// ... (updateProfile function as before) ...
exports.updateProfile = async (req, res) => {
    const { name, status } = req.body;
    console.log('Backend updateProfile: Request to update profile for user ID:', req.user ? req.user.id : 'UNKNOWN (req.user missing)');
    console.log('Backend updateProfile: Received data - name:', name, 'status:', status);

    try {
        if (!req.user || !req.user.id) {
            console.error('Backend updateProfile: req.user or req.user.id is undefined. Auth middleware issue?');
            return res.status(401).json({ message: 'Not authorized, user context missing' });
        }
        const user = await User.findById(req.user.id);
        if (!user) {
            console.log('Backend updateProfile: User not found in DB for ID:', req.user.id);
            return res.status(404).json({ message: 'User not found' });
        }

        let updated = false;
        if (name !== undefined) {
            user.name = name;
            updated = true;
        }
        if (status !== undefined) {
            user.status = status;
            updated = true;
        }

        await user.save();
        console.log('Backend updateProfile: User profile updated and saved.');
        
        res.json({
            id: user.id,
            phoneNumber: user.phoneNumber,
            name: user.name,
            profilePicture: user.profilePicture,
            status: user.status,
            isVerified: user.isVerified,
            needsProfileSetup: !user.name
        });
    } catch (error) {
        console.error('Backend updateProfile: Server Error:', error);
        res.status(500).json({ message: 'Server error updating profile' });
    }
};


// @desc    Search users by name or phone number
// @route   GET /api/users/search?q=searchTerm
// @access  Private
exports.searchUsers = async (req, res) => {
    const rawSearchTerm = req.query.q;
    console.log('Backend searchUsers: Received raw search query ->', rawSearchTerm);

    if (!req.user || !req.user.id) {
        console.error('Backend searchUsers: req.user or req.user.id is undefined. Auth middleware issue?');
        return res.status(401).json({ message: 'Not authorized, user context missing for search' });
    }
    const loggedInUserId = req.user.id;
    console.log('Backend searchUsers: Logged-in user ID (to exclude) ->', loggedInUserId);

    if (!rawSearchTerm || typeof rawSearchTerm !== 'string' || rawSearchTerm.trim() === "") {
        console.log('Backend searchUsers: No valid search term provided or term is empty. Returning empty array.');
        return res.json([]);
    }

    const escapedSearchTerm = escapeRegExp(rawSearchTerm.trim()); // <--- ESCAPE THE SEARCH TERM
    console.log('Backend searchUsers: Escaped search term ->', escapedSearchTerm);


    const keywordQuery = {
        $or: [
            { name: { $regex: escapedSearchTerm, $options: 'i' } },
            { phoneNumber: { $regex: escapedSearchTerm, $options: 'i' } }
        ],
        _id: { $ne: loggedInUserId }
    };

    console.log('Backend searchUsers: Constructed MongoDB query object ->', JSON.stringify(keywordQuery));

    try {
        const users = await User.find(keywordQuery)
            .limit(10)
            .select('id name profilePicture phoneNumber');

        console.log('Backend searchUsers: MongoDB find query executed. Number of users found ->', users.length);
        if (users.length > 0) {
            console.log('Backend searchUsers: Details of found users ->', users.map(u => ({ id: u.id, name: u.name, phone: u.phoneNumber })));
        }

        res.json(users);
    } catch (error) {
        // This specific "Regular expression is invalid" error might be caught here if the escape isn't perfect
        // or if MongoDB's regex engine has its own issues with a very malformed (even if escaped) pattern.
        if (error.message && error.message.toLowerCase().includes('regular expression is invalid')) {
            console.error('Backend searchUsers: Regex construction error AFTER escape (unlikely but possible) ->', error.message);
            // Potentially return an empty array or a specific error message to the client
            return res.status(400).json({ message: 'Invalid search pattern.', users: [] });
        }
        console.error('Backend searchUsers: Server Error during find operation ->', error.message);
        console.error('Backend searchUsers: Full error object ->', error);
        res.status(500).send('Server Error during user search');
    }
};