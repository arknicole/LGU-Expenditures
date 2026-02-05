const express = require('express');
const router = express.Router();
const db = require('../db');

// ADD NEW VOUCHER
router.post('/add-voucher', async (req, res) => {
    const { date, dv_no, check_no, office_id, items, type, payable_type_id } = req.body;

    // VALIDATION
    if (!date || !dv_no || !check_no || !office_id || !items || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Missing required fields. Date, DV No, Check No, and Items are mandatory.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const insertQuery = `
            INSERT INTO expenses 
            (date, dv_no, check_no, office_id, payable_type_id, category_id, sub_category_id, sub_sub_category_id, 
             particulars, gross, net, type)
            VALUES ?
        `;

        const values = items.map(item => {
            return [
                date,
                dv_no,
                check_no,
                office_id,
                payable_type_id || null, // <--- SAVING THE SELECTED CATEGORY ID
                item.category_id || null,
                null,
                null,
                item.particulars,
                item.gross,
                item.net,
                type || 'Expense' 
            ];
        });

        await connection.query(insertQuery, [values]);

        await connection.commit();
        res.json({ success: true, message: 'Transaction saved successfully!' });

    } catch (err) {
        await connection.rollback();
        console.error("Error adding voucher:", err);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;