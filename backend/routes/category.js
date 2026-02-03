const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db');

router.get('/search', async (req, res) => {
    const { term, object } = req.query;
    const searchTerm = term || '';

    if (!object) {
        return res.json({ success: true, results: [] }); 
    }

    try {
        const sql = `
            SELECT DISTINCT ppa 
            FROM categories
            WHERE object_of_expenditure = ?
            AND ppa LIKE ?
            ORDER BY ppa ASC
            LIMIT 100  -- INCREASED LIMIT FROM 20 TO 100
        `;
        const searchPattern = `%${searchTerm}%`;
        const [results] = await db.query(sql, [object, searchPattern]);

        res.json({ success: true, results: results });

    } catch (err) {
        console.error('Error searching categories:', err);
        res.status(500).json({ success: false, results: [] });
    }
});

// ROUTE: Get all categories (List)
router.get('/list', async (req, res) => {
    try {
        const { object } = req.query;
        let sql = 'SELECT * FROM categories';
        let params = [];
        
        if (object) {
            sql += ' WHERE object_of_expenditure = ?';
            params.push(object);
        }
        
        sql += ' ORDER BY object_of_expenditure, ppa, sub_ppa, sub_sub_ppa';
        
        const [results] = await db.query(sql, params);
        res.json({ success: true, categories: results });
    } catch (err) {
        console.error("DB error fetching categories:", err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// ROUTE: Create Category
router.post('/add', [
    body('object_of_expenditure').isIn(['PS', 'MOOE', 'CO']),
    body('ppa').isString().trim().notEmpty(),
    body('sub_ppa').optional({ checkFalsy: true }).isString().trim(),
    body('sub_sub_ppa').optional({ checkFalsy: true }).isString().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        let { object_of_expenditure, ppa, sub_ppa, sub_sub_ppa } = req.body;
        const sql = `INSERT INTO categories (object_of_expenditure, ppa, sub_ppa, sub_sub_ppa) VALUES (?, ?, ?, ?)`;
        await db.query(sql, [object_of_expenditure, ppa, sub_ppa || null, sub_sub_ppa || null]);
        res.json({ success: true, message: 'Category added successfully.' });
    } catch (err) {
        console.error("DB error adding category:", err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// ROUTE: Update Category
router.put('/update/:id', async (req, res) => {
    const { id } = req.params;
    try {
        let { object_of_expenditure, ppa, sub_ppa, sub_sub_ppa } = req.body;
        const sql = `UPDATE categories SET object_of_expenditure = ?, ppa = ?, sub_ppa = ?, sub_sub_ppa = ? WHERE id = ?`;
        await db.query(sql, [object_of_expenditure, ppa, sub_ppa || null, sub_sub_ppa || null, id]);
        res.json({ success: true, message: 'Category updated successfully.' });
    } catch (err) {
        console.error("DB error updating category:", err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// ROUTE: Delete Category
router.delete('/delete/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("DELETE FROM categories WHERE id = ?", [id]);
        res.json({ success: true, message: 'Category deleted successfully.' });
    } catch (err) {
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ success: false, message: 'Cannot delete: Category is in use.' });
        }
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

module.exports = router;