const express = require('express');
const router = express.Router();
const db = require('../db');

// GET LIST
router.get('/list', async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM payable_types ORDER BY name ASC");
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ADD TYPE
router.post('/add', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    try {
        await db.query("INSERT INTO payable_types (name) VALUES (?)", [name]);
        res.json({ success: true, message: 'Added successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE TYPE
router.post('/delete', async (req, res) => {
    const { id } = req.body;
    try {
        await db.query("DELETE FROM payable_types WHERE id = ?", [id]);
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;