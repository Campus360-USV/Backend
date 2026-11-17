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

// KAN-26: operații de administrare

// Întoarce id-ul generat automat de MySQL
async function create({ nume, locatie, capacitate, responsabil, reguli }) {
    const [result] = await getPool().execute(
        'INSERT INTO laboratoare (nume, locatie, capacitate, responsabil, reguli) VALUES (?, ?, ?, ?, ?)',
        [nume, locatie, capacitate, responsabil, reguli]
    );
    return result.insertId;
}

async function update(id, { nume, locatie, capacitate, responsabil, reguli }) {
    const [result] = await getPool().execute(
        'UPDATE laboratoare SET nume = ?, locatie = ?, capacitate = ?, responsabil = ?, reguli = ? WHERE id = ?',
        [nume, locatie, capacitate, responsabil, reguli, id]
    );
    return result.affectedRows > 0;
}

// Rezervări active = în așteptare sau aprobate, de azi încolo.
// Un laborator cu rezervări active nu se poate șterge (vezi controller-ul).
async function countRezervariActive(id) {
    const [[{ total }]] = await getPool().query(
        `SELECT COUNT(*) AS total FROM rezervari
         WHERE laborator_id = ?
           AND stare IN ('în așteptare', 'aprobată')
           AND data_rezervare >= CURDATE()`,
        [id]
    );
    return total;
}

// Echipamentele laboratorului (și rezervările vechi/respinse) se șterg automat (ON DELETE CASCADE)
async function remove(id) {
    const [result] = await getPool().execute('DELETE FROM laboratoare WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

module.exports = { findAll, findById, exists, create, update, remove, countRezervariActive };
