const express = require('express');
const router = express.Router();
const db = require('../db');

// --- 1. GET LIST (Read) ---
router.get('/list', async (req, res) => {
    const { sector } = req.query;
    try {
        let sql = 'SELECT id, office_name, sector FROM offices';
        const params = [];
        if (sector) {
            sql += ' WHERE sector = ?';
            params.push(sector);
        }
        sql += ' ORDER BY sector, office_name ASC';
        const [offices] = await db.query(sql, params);
        res.json({ success: true, offices });
    } catch (error) {
        console.error('Error fetching offices:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- 2. GET UNIQUE SECTORS (Helper) ---
router.get('/sectors', async (req, res) => {
    try {
        const [sectors] = await db.query('SELECT DISTINCT sector FROM offices WHERE sector IS NOT NULL AND sector != "" ORDER BY sector');
        res.json({ success: true, sectors: sectors.map(s => s.sector) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- 3. ADD OFFICE (Create) ---
router.post('/add', async (req, res) => {
    const { office_name, sector } = req.body;
    if (!office_name || !sector) return res.status(400).json({ success: false, message: 'Name and Sector required' });

    try {
        await db.query('INSERT INTO offices (office_name, sector) VALUES (?, ?)', [office_name, sector]);
        res.json({ success: true, message: 'Office added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// --- 4. UPDATE OFFICE (Update) ---
router.put('/update/:id', async (req, res) => {
    const { id } = req.params;
    const { office_name, sector } = req.body;

    try {
        await db.query('UPDATE offices SET office_name = ?, sector = ? WHERE id = ?', [office_name, sector, id]);
        res.json({ success: true, message: 'Office updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// --- 5. DELETE OFFICE (Delete) ---
router.delete('/delete/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM offices WHERE id = ?', [id]);
        res.json({ success: true, message: 'Office deleted successfully' });
    } catch (error) {
        console.error(error);
        // This usually happens if the office is already used in expenses/allotments
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(400).json({ success: false, message: 'Cannot delete: This office has existing records.' });
        } else {
            res.status(500).json({ success: false, message: 'Database error' });
        }
    }
});

module.exports = router;