const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

// Configurarea de bază (user root, fără parolă - standard pentru mediul local)
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '' 
};

let pool;

// Funcție care creează automat baza de date și tabela la pornirea serverului
async function initDB() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Creăm baza de date dacă nu există
        await connection.query("CREATE DATABASE IF NOT EXISTS laborator_db");
        
        // Configurăm pool-ul final legat de baza de date
        pool = mysql.createPool({
            ...dbConfig,
            database: 'laborator_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Creăm tabela pe baza scriptului tău inițial (adaptat pentru MySQL)
        const createTableSql = `
            CREATE TABLE IF NOT EXISTS echipamente (
                id INT PRIMARY KEY,
                nume VARCHAR(100) NOT NULL,
                tip VARCHAR(50)
            )
        `;
        await pool.execute(createTableSql);
        console.log("Baza de date și tabela au fost inițializate cu succes!");
        
        connection.destroy();
    } catch (err) {
        console.error("Eroare la inițializarea bazei de date:", err.message);
    }
}

// Apelăm funcția de inițializare
initDB();

// ==========================================
// OPERAȚII CRUD
// ==========================================

app.post('/api/echipamente', async (req, res) => {
    try {
        const { id, nume, tip } = req.body;
        const sql = `INSERT INTO echipamente (id, nume, tip) VALUES (?, ?, ?)`;
        await pool.execute(sql, [id, nume, tip]);
        res.status(201).json({ message: 'Echipament adăugat cu succes!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/echipamente', async (req, res) => {
    try {
        const sql = `SELECT * FROM echipamente`;
        const [rows] = await pool.execute(sql);
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/echipamente/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { nume, tip } = req.body;
        const sql = `UPDATE echipamente SET nume = ?, tip = ? WHERE id = ?`;
        const [result] = await pool.execute(sql, [nume, tip, id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Echipamentul nu a fost găsit.' });
        res.status(200).json({ message: 'Echipament actualizat!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/echipamente/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const sql = `DELETE FROM echipamente WHERE id = ?`;
        const [result] = await pool.execute(sql, [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Echipamentul nu a fost găsit.' });
        res.status(200).json({ message: 'Echipament șters!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Serverul backend rulează pe http://localhost:${PORT}`);
});