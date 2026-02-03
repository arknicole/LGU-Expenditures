const express = require('express');
const cors = require('cors');
const path = require('path'); 
const app = express();

app.use(cors());
app.use(express.json());

// --- CORRECT PATH FOR YOUR FOLDER STRUCTURE ---
// Your structure: backend/server.js and frontend/ are siblings.
// So we go UP one level ('..') to get out of 'backend', then into 'frontend'.
const frontendPath = path.join(__dirname, '..', 'frontend');

console.log('------------------------------------------------');
console.log('Serving frontend from:', frontendPath);
console.log('------------------------------------------------');

app.use(express.static(frontendPath));

// --- API Routes ---
const db = require('./db');
// Make sure all these files exist in backend/routes/
const authRoutes = require('./routes/auth'); 
const categoryRoutes = require('./routes/category');
const expenseRoutes = require('./routes/expense');
const officeRoutes = require('./routes/office');
const allotmentRoutes = require('./routes/allotment');
const reportRoutes = require('./routes/reports');
const payableTypesRoutes = require('./routes/payable_types');  

app.use('/api/auth', authRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/expense', expenseRoutes);
app.use('/api/office', officeRoutes);
app.use('/api/allotment', allotmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/payable-types', payableTypesRoutes);

// Fallback to index.html for any other request
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(3005, () => {
  console.log('Server running on http://localhost:${PORT}');
});