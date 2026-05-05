// config/db.js
require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestura',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection((err, conn) => {
  if (err) console.error('DB connection failed:', err);
  else {
    console.log('Database connected.');
    conn.release();
  }
});

// Promisified helper for async/await usage
const promisePool = pool.promise();
pool.queryAsync = promisePool.query.bind(promisePool);

module.exports = pool;
