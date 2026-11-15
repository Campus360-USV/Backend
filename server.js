const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken'); // Adăugat pentru KAN-2
const bcrypt = require('bcrypt');    // Adăugat pentru KAN-2

const app = express();
app.use(express.json());

// Cheia secretă pentru generarea token-urilor (KAN-2)
const SECRET_KEY = "cheie_secreta_pentru_jwt_schimba_in_productie"; 

// Configurarea de bază
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '' 
};

let pool;

// Funcție care creează automat baza de date și tabelele la pornirea serverului
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

        // 1. Tabela Echipamente (existentă)
        const createEchipamenteSql = `
            CREATE TABLE IF NOT EXISTS echipamente (
                id INT PRIMARY KEY,
                nume VARCHAR(100) NOT NULL,
                tip VARCHAR(50)
            )
        `;
        await pool.execute(createEchipamenteSql);

        // 2. Tabela Utilizatori (Pentru KAN-2 Autentificare și KAN-3 Roluri)
        const createUsersSql = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                parola VARCHAR(255) NOT NULL,
                rol ENUM('student', 'profesor', 'admin') DEFAULT 'student'
            )
        `;
        await pool.execute(createUsersSql);

        // 3. Tabela Rezervari (Pentru KAN-18 și restul operațiilor pe cereri)
        const createRezervariSql = `
            CREATE TABLE IF NOT EXISTS rezervari (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_utilizator INT,
                laborator VARCHAR(255) NOT NULL,
                data_rezervare DATE NOT NULL,
                interval_orar VARCHAR(50) NOT NULL,
                scop TEXT,
                stare ENUM('în așteptare', 'aprobată', 'respinsă') DEFAULT 'în așteptare',
                motiv_respingere TEXT,
                FOREIGN KEY (id_utilizator) REFERENCES users(id) ON DELETE CASCADE
            )
        `;
        await pool.execute(createRezervariSql);

        console.log("Baza de date și tabelele au fost inițializate cu succes!");
        
        // Creăm un cont de admin default dacă nu există
        const [admins] = await pool.execute("SELECT * FROM users WHERE email = 'admin@usv.ro'");
        if (admins.length === 0) {
            const hashedPw = await bcrypt.hash('admin123', 10);
            await pool.execute("INSERT INTO users (email, parola, rol) VALUES (?, ?, ?)", ['admin@usv.ro', hashedPw, 'admin']);
            console.log("Cont de admin de test creat: admin@usv.ro / admin123");
        }

        // Creăm un cont de student default pentru teste
        const [students] = await pool.execute("SELECT * FROM users WHERE email = 'student@usv.ro'");
        if (students.length === 0) {
            const hashedPw = await bcrypt.hash('student123', 10);
            await pool.execute("INSERT INTO users (email, parola, rol) VALUES (?, ?, ?)", ['student@usv.ro', hashedPw, 'student']);
            console.log("Cont de student de test creat: student@usv.ro / student123");
        }

        connection.destroy();
    } catch (err) {
        console.error("Eroare la inițializarea bazei de date:", err.message);
    }
}

// Apelăm funcția de inițializare
initDB();


// ==========================================
// KAN-2: AUTENTIFICARE (LOGIN CU JWT)
// ==========================================
app.post('/api/login', async (req, res) => {
    try {
        const { email, parola } = req.body;
        
        // 1. Căutăm utilizatorul în baza de date
        const [users] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Email sau parolă incorectă.' });
        }
        
        const user = users[0];
        
        // 2. Verificăm dacă parola introdusă se potrivește cu cea criptată din baza de date
        const validPassword = await bcrypt.compare(parola, user.parola);
        if (!validPassword) {
            return res.status(401).json({ message: 'Email sau parolă incorectă.' });
        }
        
        // 3. Generăm token-ul JWT (returnarea unui token JWT confom KAN-2)
        const token = jwt.sign(
            { id: user.id, rol: user.rol, email: user.email }, 
            SECRET_KEY, 
            { expiresIn: '2h' } // Token valabil 2 ore
        );
        
        res.status(200).json({ 
            message: 'Autentificare reușită!',
            token: token,
            rol: user.rol 
        });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// OPERAȚII CRUD ECHIPAMENTE (Inițiale)
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