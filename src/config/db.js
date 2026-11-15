const mysql = require('mysql2/promise');
const { createTables, seedData } = require('./schema');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
};
const dbName = process.env.DB_NAME || 'campus360_db';

let pool;

// Creează baza de date (dacă nu există), pool-ul de conexiuni și tabelele.
// Se apelează o singură dată, la pornirea serverului, ÎNAINTE de app.listen.
async function initDB() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    } finally {
        await connection.end();
    }

    pool = mysql.createPool({
        ...dbConfig,
        database: dbName,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    await createTables(pool);
    await seedData(pool);
}

function getPool() {
    if (!pool) throw new Error('Baza de date nu a fost inițializată.');
    return pool;
}

module.exports = { initDB, getPool };
