const { getPool } = require('../config/db');

// Modelul pentru tabela laboratoare. Doar interogări SQL.

async function findAll() {
    const [rows] = await getPool().execute('SELECT * FROM laboratoare ORDER BY nume');
    return rows;
}

async function findById(id) {
    const [rows] = await getPool().execute('SELECT * FROM laboratoare WHERE id = ?', [id]);
    return rows[0] || null;
}

async function exists(id) {
    const [rows] = await getPool().execute('SELECT 1 FROM laboratoare WHERE id = ?', [id]);
    return rows.length > 0;
}

module.exports = { findAll, findById, exists };
