const express = require('express');
const router = express.Router();
const db = require('../db');


router.post('/add-voucher', async (req, res) => {
    const { date, dv_no, check_no, office_id, items } = req.body;

    if (!date || !office_id || !items || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        for (const item of items) {
            // 1. SMART LOOKUP: Find Category ID based on the names selected in the frontend
            let category_id = null;
            if (item.object && item.ppa) {
                const [catRows] = await connection.query(
                    'SELECT id FROM categories WHERE object_of_expenditure = ? AND ppa = ? AND (sub_ppa = ? OR sub_ppa IS NULL) AND (sub_sub_ppa = ? OR sub_sub_ppa IS NULL) LIMIT 1',
                    [item.object, item.ppa, item.sub || null, item.subsub || null]
                );
                if (catRows.length > 0) category_id = catRows[0].id;
            }

            // 2. Insert the Expense
            const deductions = item.deductions || {};
            
            const sql = `
                INSERT INTO expenses 
                (date, dv_no, check_no, office_id, category_id, particulars, 
                 gross, ewt, vat_pt, municipal_tax, warranty, damages, pag_ibig, others, net, type) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Expense')
            `;
            
            await connection.query(sql, [
                date, dv_no, check_no, office_id, category_id, item.particulars,
                item.gross || 0, 
                deductions.ewt || 0, 
                deductions.vat_pt || 0,
                deductions.municipal_tax || 0, 
                deductions.warranty || 0, 
                deductions.damages || 0,
                deductions.pag_ibig || 0, 
                deductions.others || 0, 
                item.net || 0
            ]);
        }

        await connection.commit();
        res.json({ success: true, message: 'Voucher saved successfully!' });
    } catch (error) {
        await connection.rollback();
        console.error('Error saving voucher:', error);
        res.status(500).json({ success: false, message: 'Database error saving voucher.' });
    } finally {
        connection.release();
    }
});

// ROUTE: Add Accounts Payable (Direct)
router.post('/add-payable', async (req, res) => {
    const { date, dv_no, particulars, object_of_expenditure, total_amount, payable_type } = req.body;
    try {
        const sql = `
            INSERT INTO expenses (date, dv_no, particulars, type, object_of_expenditure, payable_type, gross, net)
            VALUES (?, ?, ?, 'Accounts Payable', ?, ?, ?, ?);
        `;
        await db.query(sql, [date, dv_no, particulars, object_of_expenditure, payable_type, total_amount, total_amount]);
        res.json({ success: true, message: 'Accounts Payable saved.' });
    } catch (error) {
        console.error('Error adding Accounts Payable:', error);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// ROUTE: List Expenses
router.get('/list', async (req, res) => {
    try {
        const sql = `
            SELECT e.*, o.office_name,
            CONCAT(c.ppa, IFNULL(CONCAT(' > ', c.sub_ppa), ''), IFNULL(CONCAT(' > ', c.sub_sub_ppa), '')) as category_name
            FROM expenses e
            LEFT JOIN offices o ON e.office_id = o.id
            LEFT JOIN categories c ON e.category_id = c.id
            ORDER BY e.date DESC;
        `;
        const [results] = await db.query(sql);
        res.json({ success: true, expenses: results });
    } catch (err) {
        console.error('DB error fetching expenses:', err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

module.exports = router;