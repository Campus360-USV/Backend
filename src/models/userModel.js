const { getPool } = require('../config/db');

// Modelul pentru tabela users. Doar interogări SQL.

async function findByEmail(email) {
    const [rows] = await getPool().execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
}

module.exports = { findByEmail };
