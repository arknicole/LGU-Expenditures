const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/login', async (req, res) => {
    // 1. Trim whitespace to prevent " invisible space " errors
    const username = req.body.username.trim();
    const password = req.body.password.trim();

    console.log(`--- LOGIN ATTEMPT ---`);
    console.log(`Trying to log in as: "${username}"`);

    try {
        const [users] = await db.query('SELECT * FROM admin WHERE username = ?', [username]);

        if (users.length === 0) {
            console.log("❌ Result: User not found in database.");
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        const user = users[0];

        // --- DEBUGGING LOGS ---
        console.log(`✅ User found: ID ${user.id}`);
        console.log(`Input Password:  "${password}"`);
        console.log(`Stored Password: "${user.password}"`);
        // ----------------------

        // Plain text comparison
        if (password === user.password) {
            console.log("✅ Password MATCHES! Login successful.");
            res.json({ success: true, message: 'Login successful' });
        } else {
            console.log("❌ Password MISMATCH.");
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;