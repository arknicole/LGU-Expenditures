const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/list', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM payable_types ORDER BY fund_group, type_name');
        res.json({ success: true, types: results });
    } catch (err) {
        console.error("DB error fetching payable types:", err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

router.post('/add', async (req, res) => {
    const { fund_group, type_name } = req.body;
    if (!fund_group || !type_name) {
        return res.status(400).json({ success: false, message: 'Both fund group and type name are required.' });
    }
    try {
        await db.query('INSERT INTO payable_types (fund_group, type_name) VALUES (?, ?)', [fund_group, type_name]);
        res.json({ success: true, message: 'New payable type added successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to add new type.' });
    }
});

// THIS IS THE FIX: The route is now explicitly '/delete/:id'
router.delete('/delete/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM payable_types WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Type not found.' });
        }
        res.json({ success: true, message: 'Payable type deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete type.' });
    }
});

module.exports = router;