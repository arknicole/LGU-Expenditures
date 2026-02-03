const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/allotment/add - Handles all allotment types
router.post('/add', async (req, res) => {
    const { type, year, description, office_id, ppas, from_items, to_items } = req.body;
    const connection = await db.getConnection(); // Get a connection from the pool
    try {
        await connection.beginTransaction();

        if (type === 'Allotment' || type === 'Supplemental') {
            if (!office_id || !ppas || ppas.length === 0) throw new Error('Office and at least one PPA are required.');
            const [result] = await connection.query('INSERT INTO allotments (year, office_id, type, description) VALUES (?, ?, ?, ?)', [year, office_id, type, description]);
            const allotment_id = result.insertId;
            const detailInserts = ppas.map(p => [allotment_id, null, p.category_id, p.amount]);
            if (detailInserts.length > 0) {
                await connection.query('INSERT INTO allotment_details (allotment_id, is_from, category_id, amount) VALUES ?', [detailInserts]);
            }
        } else if (type === 'Realignment') {
            if (!from_items || from_items.length === 0 || !to_items || to_items.length === 0) throw new Error('FROM and TO items are required for realignment.');
            
            // Group from_items by office_id and create a debit record for each
            const fromOfficeGroups = from_items.reduce((acc, item) => {
                (acc[item.office_id] = acc[item.office_id] || []).push(item);
                return acc;
            }, {});

            for (const from_office_id in fromOfficeGroups) {
                const desc_from = `${description} (Source)`;
                const [fromResult] = await connection.query('INSERT INTO allotments (year, office_id, type, description) VALUES (?, ?, ?, ?)', [year, from_office_id, type, desc_from]);
                const from_allotment_id = fromResult.insertId;
                const fromDetailInserts = fromOfficeGroups[from_office_id].map(p => [from_allotment_id, 1, p.category_id, p.amount]);
                if (fromDetailInserts.length > 0) {
                    await connection.query('INSERT INTO allotment_details (allotment_id, is_from, category_id, amount) VALUES ?', [fromDetailInserts]);
                }
            }
            
            // Group to_items by office_id and create a credit record for each
            const toOfficeGroups = to_items.reduce((acc, item) => {
                (acc[item.office_id] = acc[item.office_id] || []).push(item);
                return acc;
            }, {});

            for (const to_office_id in toOfficeGroups) {
                const desc_to = `${description} (Destination)`;
                const [toResult] = await connection.query('INSERT INTO allotments (year, office_id, type, description) VALUES (?, ?, ?, ?)', [year, to_office_id, type, desc_to]);
                const to_allotment_id = toResult.insertId;
                const toDetailInserts = toOfficeGroups[to_office_id].map(p => [to_allotment_id, 0, p.category_id, p.amount]);
                if (toDetailInserts.length > 0) {
                    await connection.query('INSERT INTO allotment_details (allotment_id, is_from, category_id, amount) VALUES ?', [toDetailInserts]);
                }
            }
        }

        await connection.commit();
        res.json({ success: true, message: `${type} recorded successfully.` });
    } catch (error) {
        await connection.rollback();
        console.error('Error during allotment transaction:', error);
        res.status(500).json({ success: false, message: 'Failed to record allotment. ' + error.message });
    } finally {
        connection.release();
    }
});

// GET /api/allotment/existing-amount
router.get('/existing-amount', async (req, res) => {
    const { category_id, office_id, year } = req.query;
    if (!category_id || !office_id || !year) {
        return res.status(400).json({ success: false, message: 'Missing required parameters.' });
    }
    try {
        const sql = `
            SELECT SUM(CASE WHEN ad.is_from = 1 THEN -ad.amount ELSE ad.amount END) AS total_amount
            FROM allotment_details ad
            JOIN allotments a ON ad.allotment_id = a.id
            WHERE ad.category_id = ? AND a.office_id = ? AND a.year = ?;
        `;
        const [results] = await db.query(sql, [category_id, office_id, year]);
        res.json({ success: true, amount: results[0].total_amount || 0 });
    } catch (err) {
        console.error('DB error on /existing-amount:', err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// UPDATED LIST ROUTE (Includes Detail ID for editing)
router.get('/list', async (req, res) => {
    try {
        const sql = `
            SELECT 
                ad.id as detail_id, 
                a.year, a.type, o.office_name, 
                c.ppa, c.sub_ppa, c.sub_sub_ppa, 
                ad.amount, ad.is_from
            FROM allotment_details ad
            JOIN allotments a ON ad.allotment_id = a.id
            JOIN offices o ON a.office_id = o.id
            JOIN categories c ON ad.category_id = c.id
            ORDER BY ad.id DESC LIMIT 50
        `;
        const [results] = await db.query(sql);
        res.json({ success: true, allotments: results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// NEW: UPDATE SINGLE ITEM
router.post('/update', async (req, res) => {
    const { id, amount } = req.body;
    try {
        await db.query("UPDATE allotment_details SET amount = ? WHERE id = ?", [amount, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// NEW: DELETE SINGLE ITEM
router.post('/delete', async (req, res) => {
    const { id } = req.body;
    try {
        await db.query("DELETE FROM allotment_details WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;