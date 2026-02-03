const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'mto-server',
  user: 'root',
  password: 'MTOTublayServerDB',
  database: 'lgu_expenditure_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log("MySQL Connection Pool created.");

module.exports = pool.promise();