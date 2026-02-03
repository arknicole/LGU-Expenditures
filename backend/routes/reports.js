const express = require('express');
const router = express.Router();
const db = require('../db');

// ROUTE: Get all distinct years with data
router.get('/available-years', async (req, res) => {
    try {
        const sql = `
            SELECT DISTINCT year FROM allotments
            UNION
            SELECT DISTINCT YEAR(date) as year FROM expenses
            ORDER BY year DESC;
        `;
        const [results] = await db.query(sql);
        const years = results.map(row => row.year);
        res.json({ success: true, years: years });
    } catch (err) {
        console.error('DB error fetching available years:', err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// ROUTE: Get all distinct sectors with data
router.get('/available-sectors', async (req, res) => {
    try {
        const sql = `
            SELECT DISTINCT o.sector
            FROM offices o
            WHERE o.id IN (SELECT office_id FROM allotments UNION SELECT office_id FROM expenses)
            ORDER BY o.sector;
        `;
        const [results] = await db.query(sql);
        const sectors = results.map(row => row.sector);
        res.json({ success: true, sectors: sectors });
    } catch (err) {
        console.error('DB error fetching available sectors:', err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// ROUTE: Get all distinct offices in a sector with data
router.get('/available-offices', async (req, res) => {
    const { sector } = req.query;
    if (!sector) {
        return res.status(400).json({ success: false, message: 'Sector is required.' });
    }
    try {
        const sql = `
            SELECT DISTINCT o.id, o.office_name
            FROM offices o
            WHERE o.sector = ? AND o.id IN (SELECT office_id FROM allotments UNION SELECT office_id FROM expenses)
            ORDER BY o.office_name;
        `;
        const [results] = await db.query(sql, [sector]);
        res.json({ success: true, offices: results });
    } catch (err) {
        console.error('DB error fetching available offices:', err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// ROUTE: Record of Expenditures (Ledger)
router.get('/record-of-expenditures', async (req, res) => {
    const { year, office_id, start_date, end_date } = req.query;
    
    if (!year || !office_id) {
        return res.status(400).json({ success: false, message: 'Year and Office ID are required.' });
    }

    const sDate = start_date || `${year}-01-01`;
    const eDate = end_date || `${year}-12-31`;

    try {
        // Step 1: Get Categories
        const categoriesSql = `
            SELECT c.id, c.object_of_expenditure, c.ppa, c.sub_ppa, c.sub_sub_ppa
            FROM categories c
            WHERE c.id IN (
                SELECT category_id FROM allotment_details ad JOIN allotments a ON ad.allotment_id = a.id WHERE a.year = ? AND a.office_id = ?
                UNION
                SELECT category_id FROM expenses e WHERE YEAR(e.date) = ? AND e.office_id = ?
            )
            ORDER BY CASE c.object_of_expenditure WHEN 'PS' THEN 1 WHEN 'MOOE' THEN 2 WHEN 'CO' THEN 3 ELSE 4 END, c.ppa, c.sub_ppa, c.sub_sub_ppa;
        `;
        const [categories] = await db.query(categoriesSql, [year, office_id, year, office_id]);

        // Step 2: Build Header Structure
        const ppa_structure = {};
        const flat_headers = [];
        categories.forEach(cat => {
            if (!cat.ppa) return;
            let objNode = ppa_structure[cat.object_of_expenditure] = ppa_structure[cat.object_of_expenditure] || {};
            let ppaNode = objNode[cat.ppa] = objNode[cat.ppa] || {};
            if (cat.sub_ppa) {
                let subPpaNode = ppaNode[cat.sub_ppa] = ppaNode[cat.sub_ppa] || {};
                if (cat.sub_sub_ppa) {
                    let subSubPpaNode = subPpaNode[cat.sub_sub_ppa] = subPpaNode[cat.sub_sub_ppa] || {};
                    subSubPpaNode.id = cat.id;
                } else { subPpaNode.id = cat.id; }
            } else { ppaNode.id = cat.id; }
            flat_headers.push({ id: cat.id, name: `${cat.ppa}${cat.sub_ppa ? ' > ' + cat.sub_ppa : ''}${cat.sub_sub_ppa ? ' > ' + cat.sub_sub_ppa : ''}` });
        });

        // Step 3: Get Allotments
        const uniqueAllotmentsSql = `SELECT * FROM allotments WHERE year = ? AND office_id = ? ORDER BY id;`;
        const [allotment_transactions] = await db.query(uniqueAllotmentsSql, [year, office_id]);
        const allotmentIds = allotment_transactions.map(a => a.id);
        let allotment_details = [];
        if (allotmentIds.length > 0) {
            const allotmentDetailsSql = `SELECT * FROM allotment_details WHERE allotment_id IN (?);`;
            [allotment_details] = await db.query(allotmentDetailsSql, [allotmentIds]);
        }
        
        // Step 4: Realignment details
        const realignmentDescriptions = allotment_transactions.filter(t => t.type === 'Realignment').map(t => t.description.split(' (')[0]);
        const realignmentMap = {};
        if (realignmentDescriptions.length > 0) {
            const counterpartSql = `SELECT a.description, o.office_name FROM allotments a JOIN offices o ON a.office_id = o.id WHERE a.year = ? AND SUBSTRING_INDEX(a.description, ' (', 1) IN (?);`;
            const [counterparts] = await db.query(counterpartSql, [year, realignmentDescriptions]);
            counterparts.forEach(c => { realignmentMap[c.description] = c.office_name; });
        }

        // Step 5: Combine Allotments
        allotment_transactions.forEach(allotment => {
            allotment.details = allotment_details.filter(d => d.allotment_id === allotment.id);
            if (allotment.type === 'Realignment') {
                const baseDesc = allotment.description.split(' (')[0];
                const isSource = allotment.description.includes('(Source)');
                const counterpartKey = isSource ? `${baseDesc} (Destination)` : `${baseDesc} (Source)`;
                allotment.other_office_name = realignmentMap[counterpartKey] || 'Unknown Office';
                allotment.is_from = allotment.details.length > 0 ? allotment.details[0].is_from : 0;
            }
        });

        // Step 6: Get Expenses
        const expenseSql = `
            SELECT e.date, e.dv_no, e.particulars, e.net, e.category_id
            FROM expenses e
            WHERE e.office_id = ? AND e.date BETWEEN ? AND ?
            ORDER BY e.date, e.id;
        `;
        const [expenses] = await db.query(expenseSql, [office_id, sDate, eDate]);

        res.json({
            success: true,
            data: { ppa_structure, flat_headers, allotment_transactions, expenses }
        });
    } catch (err) {
        console.error('DB error fetching record of expenditures:', err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// ROUTE: Summary of Appropriations
router.get('/summary-appropriations', async (req, res) => {
    const { start_date, end_date } = req.query; 
    
    if (!start_date || !end_date) {
        return res.status(400).json({ success: false, message: 'Start and end dates are required.' });
    }

    try {
        const reportYear = start_date.substring(0, 4);

        const sql = `
            WITH AppropriationTotals AS (
                SELECT
                    a.office_id,
                    COALESCE(SUM(CASE WHEN c.object_of_expenditure = 'PS' THEN CASE WHEN a.type = 'Realignment' AND ad.is_from = 1 THEN -ad.amount ELSE ad.amount END ELSE 0 END), 0) AS appropriation_ps,
                    COALESCE(SUM(CASE WHEN c.object_of_expenditure = 'MOOE' THEN CASE WHEN a.type = 'Realignment' AND ad.is_from = 1 THEN -ad.amount ELSE ad.amount END ELSE 0 END), 0) AS appropriation_mooe,
                    COALESCE(SUM(CASE WHEN c.object_of_expenditure = 'CO' THEN CASE WHEN a.type = 'Realignment' AND ad.is_from = 1 THEN -ad.amount ELSE ad.amount END ELSE 0 END), 0) AS appropriation_co
                FROM allotments a
                JOIN allotment_details ad ON a.id = ad.allotment_id
                JOIN categories c ON ad.category_id = c.id
                WHERE a.year = ? 
                GROUP BY a.office_id
            ),
            ExpenditureTotals AS (
                SELECT
                    e.office_id,
                    COALESCE(SUM(CASE WHEN c.object_of_expenditure = 'PS' THEN e.net ELSE 0 END), 0) AS expenditure_ps,
                    COALESCE(SUM(CASE WHEN c.object_of_expenditure = 'MOOE' THEN e.net ELSE 0 END), 0) AS expenditure_mooe,
                    COALESCE(SUM(CASE WHEN c.object_of_expenditure = 'CO' THEN e.net ELSE 0 END), 0) AS expenditure_co
                FROM expenses e
                LEFT JOIN categories c ON e.category_id = c.id
                WHERE 
                    DATE(e.date) BETWEEN ? AND ? 
                    AND (e.type = 'Expense' OR e.type LIKE '%Account%Payable%')
                GROUP BY e.office_id
            )
            SELECT 
                o.sector, o.office_name,
                COALESCE(apt.appropriation_ps, 0) AS appropriation_ps,
                COALESCE(apt.appropriation_mooe, 0) AS appropriation_mooe,
                COALESCE(apt.appropriation_co, 0) AS appropriation_co,
                COALESCE(ext.expenditure_ps, 0) AS expenditure_ps,
                COALESCE(ext.expenditure_mooe, 0) AS expenditure_mooe,
                COALESCE(ext.expenditure_co, 0) AS expenditure_co
            FROM offices o
            LEFT JOIN AppropriationTotals apt ON o.id = apt.office_id
            LEFT JOIN ExpenditureTotals ext ON o.id = ext.office_id
            ORDER BY
                CASE o.sector
                    WHEN 'GENERAL PUBLIC SERVICES' THEN 1
                    WHEN 'SOCIAL SERVICES AND PUBLIC WELFARE' THEN 2
                    WHEN 'ECONOMIC SERVICES' THEN 3
                    WHEN 'SPECIAL EDUCATION FUND' THEN 4
                    ELSE 5
                END,
                o.office_name;
        `;
        
        const [results] = await db.query(sql, [reportYear, start_date, end_date]);
        res.json({ success: true, data: results });
    } catch (err) {
        console.error('DB error fetching summary of appropriations:', err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// ROUTE: Records of Accounts Payable
router.get('/accounts-payable', async (req, res) => {
    const { start_date, end_date, payable_type } = req.query;
    
    if (!start_date || !end_date) {
        return res.status(400).json({ success: false, message: 'Start and end dates are required.' });
    }

    try {
        let typeFilter = "";
        const params = [start_date, end_date];

        if (payable_type && payable_type !== 'All') {
            typeFilter = " AND e.payable_type = ? ";
            params.push(payable_type);
        }

        const sql = `
            SELECT 
                e.date, e.dv_no, e.particulars, e.payable_type, e.object_of_expenditure, e.net,
                pt.fund_group,
                CASE e.object_of_expenditure WHEN 'PS' THEN e.net ELSE 0 END AS ps,
                CASE e.object_of_expenditure WHEN 'MOOE' THEN e.net ELSE 0 END AS mooe,
                CASE e.object_of_expenditure WHEN 'CO' THEN e.net ELSE 0 END AS co,
                e.net AS total
            FROM expenses e
            LEFT JOIN payable_types pt ON e.payable_type = pt.type_name
            WHERE 
              e.type LIKE '%Account%Payable%'
              AND DATE(e.date) BETWEEN ? AND ?
              ${typeFilter} 
            ORDER BY pt.fund_group, e.date, e.dv_no;
        `;
        
        const [results] = await db.query(sql, params);
        res.json({ success: true, data: results });
    } catch (err) {
        console.error('DB error fetching accounts payable report:', err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// ROUTE: Records of Checks
router.get('/records-of-cheques', async (req, res) => {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
        return res.status(400).json({ success: false, message: 'Start and end date are required.' });
    }

    try {
        const sql = `
            SELECT 
                e.id,
                e.date, 
                e.check_no, 
                e.dv_no, 
                e.particulars, 
                o.office_name,
                
                CASE 
                    WHEN (e.payable_type IS NOT NULL AND e.payable_type != '') THEN 'Accounts Payable'
                    WHEN e.type LIKE '%Account%Payable%' THEN 'Accounts Payable'
                    ELSE CONCAT(c.ppa, IFNULL(CONCAT(' > ', c.sub_ppa), ''), IFNULL(CONCAT(' > ', c.sub_sub_ppa), ''))
                END as category_name,
                
                e.gross,
                e.ewt,
                e.vat_pt,
                e.municipal_tax,
                e.warranty,
                e.damages,
                e.pag_ibig,
                e.sss,
                e.others,
                e.net
            FROM expenses e
            LEFT JOIN offices o ON e.office_id = o.id
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE 
                DATE(e.date) BETWEEN ? AND ?
                AND (
                    (e.check_no IS NOT NULL AND e.check_no != '')
                    OR 
                    (e.type LIKE '%Account%Payable%' OR (e.payable_type IS NOT NULL AND e.payable_type != ''))
                )
            ORDER BY e.date ASC, e.check_no ASC;
        `;
        
        const [results] = await db.query(sql, [start_date, end_date]);
        res.json({ success: true, data: results });
    } catch (err) {
        console.error('DB error fetching records of checks:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
});

// GET /api/reports/dashboard-stats
router.get('/dashboard-stats', async (req, res) => {
    try {
        const year = new Date().getFullYear(); // Default to current year

        // 1. Calculate Total Appropriations (Budget)
        // FIXED: We use a CASE statement to SUBTRACT if is_from = 1 (Source)
        const sqlAppropriations = `
            SELECT 
                COALESCE(SUM(
                    CASE 
                        WHEN ad.is_from = 1 THEN -ad.amount 
                        ELSE ad.amount 
                    END
                ), 0) as total
            FROM allotments a
            JOIN allotment_details ad ON a.id = ad.allotment_id
            WHERE a.year = ?
        `;

        // 2. Calculate Total Obligations (Expenses)
        const sqlObligations = `
            SELECT COALESCE(SUM(net), 0) as total
            FROM expenses
            WHERE YEAR(date) = ?
        `;

        // 3. Calculate Pending Payables (Accounts Payable)
        // Assuming payables are tracked or just the sum of unreleased checks/expenses
        // You might need to adjust this query based on your specific 'Payables' logic
        // For now, let's assume it's expenses marked as 'payable' or similar. 
        // If you don't have a specific table, we can leave it as 0 or calculate difference.
        // Let's assume Pending Payables logic isn't the issue, but here is a placeholder:
        const sqlPayables = `
            SELECT COALESCE(SUM(net), 0) as total
            FROM expenses 
            WHERE check_no IS NULL OR check_no = '' -- Example: No check number yet
            AND YEAR(date) = ?
        `;

        const [appResult] = await db.query(sqlAppropriations, [year]);
        const [oblResult] = await db.query(sqlObligations, [year]);
        
        // Execute payables query if you have specific logic, otherwise 0
        // const [payResult] = await db.query(sqlPayables, [year]); 

        const total_appropriations = parseFloat(appResult[0].total || 0);
        const total_obligations = parseFloat(oblResult[0].total || 0);
        const remaining_balance = total_appropriations - total_obligations;

        res.json({
            success: true,
            data: {
                total_appropriations,
                total_obligations,
                remaining_balance,
                pending_payables: 0 // Replace with real value if available
            }
        });

    } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// --- CRUD ACTIONS (For Editing Reports) ---

// 1. DELETE an Expense (Used in Reports)
router.post('/delete-expense', async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'ID is required.' });

    try {
        await db.query("DELETE FROM expenses WHERE id = ?", [id]);
        res.json({ success: true, message: 'Transaction deleted.' });
    } catch (err) {
        console.error('Error deleting expense:', err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// 2. UPDATE an Expense (Used in Reports)
router.post('/update-expense', async (req, res) => {
    const { id, date, check_no, dv_no, particulars, amount } = req.body;
    
    if (!id) return res.status(400).json({ success: false, message: 'ID is required.' });

    try {
        
        const sql = `
            UPDATE expenses 
            SET date = ?, check_no = ?, dv_no = ?, particulars = ?, net = ?, gross = ? 
            WHERE id = ?
        `;
        
        await db.query(sql, [date, check_no, dv_no, particulars, amount, amount, id]);
        res.json({ success: true, message: 'Transaction updated.' });
    } catch (err) {
        console.error('Error updating expense:', err);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});
module.exports = router;