const { getPool } = require('../config/db');

// Modelul pentru tabela echipamente. Doar interogări SQL.
// MySQL întoarce BOOLEAN ca 0/1, așa că îl transformăm în true/false.
function toEchipament(row) {
    return { ...row, este_special: Boolean(row.este_special) };
}

// includeSpeciale = false -> se întorc doar echipamentele implicite (KAN-13)
async function findAll({ laboratorId, includeSpeciale = true } = {}) {
    const conditii = [];
    const params = [];
    if (laboratorId) {
        conditii.push('laborator_id = ?');
        params.push(laboratorId);
    }
    if (!includeSpeciale) {
        conditii.push('este_special = FALSE');
    }
    let sql = 'SELECT * FROM echipamente';
    if (conditii.length > 0) sql += ' WHERE ' + conditii.join(' AND ');
    const [rows] = await getPool().execute(sql + ' ORDER BY id', params);
    return rows.map(toEchipament);
}

async function findById(id) {
    const [rows] = await getPool().execute('SELECT * FROM echipamente WHERE id = ?', [id]);
    return rows[0] ? toEchipament(rows[0]) : null;
}

// Întoarce id-ul generat automat de MySQL (AUTO_INCREMENT)
async function create({ laborator_id, nume, tip, cantitate, este_special }) {
    const [result] = await getPool().execute(
        'INSERT INTO echipamente (laborator_id, nume, tip, cantitate, este_special) VALUES (?, ?, ?, ?, ?)',
        [laborator_id, nume, tip, cantitate, este_special]
    );
    return result.insertId;
}

async function update(id, { laborator_id, nume, tip, cantitate, este_special }) {
    const [result] = await getPool().execute(
        'UPDATE echipamente SET laborator_id = ?, nume = ?, tip = ?, cantitate = ?, este_special = ? WHERE id = ?',
        [laborator_id, nume, tip, cantitate, este_special, id]
    );
    return result.affectedRows > 0;
}

async function remove(id) {
    const [result] = await getPool().execute('DELETE FROM echipamente WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

module.exports = { findAll, findById, create, update, remove };
