const { getPool } = require('../config/db');

// Modelul conține DOAR interogările SQL. Nu știe nimic despre req/res.

async function findAll() {
    const [rows] = await getPool().execute('SELECT * FROM echipamente');
    return rows;
}

async function findById(id) {
    const [rows] = await getPool().execute('SELECT * FROM echipamente WHERE id = ?', [id]);
    return rows[0] || null;
}

async function create({ id, nume, tip }) {
    await getPool().execute(
        'INSERT INTO echipamente (id, nume, tip) VALUES (?, ?, ?)',
        [id, nume, tip ?? null]
    );
}

async function update(id, { nume, tip }) {
    const [result] = await getPool().execute(
        'UPDATE echipamente SET nume = ?, tip = ? WHERE id = ?',
        [nume, tip ?? null, id]
    );
    return result.affectedRows > 0;
}

async function remove(id) {
    const [result] = await getPool().execute('DELETE FROM echipamente WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

module.exports = { findAll, findById, create, update, remove };
