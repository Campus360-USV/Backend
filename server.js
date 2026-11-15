const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken'); 
const bcrypt = require('bcrypt');    

// Încărcăm variabilele de mediu (modificarea venită de la colegul tău)
try {
    process.loadEnvFile();
} catch {
    console.warn('Fișierul .env nu a fost găsit - se folosesc valorile implicite.');
}

const app = express();
app.use(express.json());

const SECRET_KEY = "cheie_secreta_pentru_jwt_schimba_in_productie"; 

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '' 
};

let pool;

async function initDB() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        await connection.query("CREATE DATABASE IF NOT EXISTS laborator_db");
        
        pool = mysql.createPool({
            ...dbConfig,
            database: 'laborator_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        const createEchipamenteSql = `
            CREATE TABLE IF NOT EXISTS echipamente (
                id INT PRIMARY KEY,
                nume VARCHAR(100) NOT NULL,
                tip VARCHAR(50)
            )
        `;
        await pool.execute(createEchipamenteSql);

        const createUsersSql = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                parola VARCHAR(255) NOT NULL,
                rol ENUM('student', 'profesor', 'admin') DEFAULT 'student'
            )
        `;
        await pool.execute(createUsersSql);

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
        
        const [admins] = await pool.execute("SELECT * FROM users WHERE email = 'admin@usv.ro'");
        if (admins.length === 0) {
            const hashedPw = await bcrypt.hash('admin123', 10);
            await pool.execute("INSERT INTO users (email, parola, rol) VALUES (?, ?, ?)", ['admin@usv.ro', hashedPw, 'admin']);
            console.log("Cont de admin de test creat: admin@usv.ro / admin123");
        }

        const [students] = await pool.execute("SELECT * FROM users WHERE email = 'student@usv.ro'");
        if (students.length === 0) {
            const hashedPw = await bcrypt.hash('student123', 10);
            await pool.execute("INSERT INTO users (email, parola, rol) VALUES (?, ?, ?)", ['student@usv.ro', hashedPw, 'student']);
            console.log("Cont de student de test creat: student@usv.ro / student123");
        }

        connection.destroy();
    } catch (err) {
        console.error('Nu s-a putut conecta la baza de date:', err.message);
        process.exit(1);
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
        
        const [users] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Email sau parolă incorectă.' });
        }
        
        const user = users[0];
        
        const validPassword = await bcrypt.compare(parola, user.parola);
        if (!validPassword) {
            return res.status(401).json({ message: 'Email sau parolă incorectă.' });
        }
        
        const token = jwt.sign(
            { id: user.id, rol: user.rol, email: user.email }, 
            SECRET_KEY, 
            { expiresIn: '2h' }
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
// OPERAȚII CRUD ECHIPAMENTE
// ==========================================

app.post('/api/echipamente', async (req, res) => {
    try {
        const { id, nume, tip } = req.body;
        await pool.execute(`INSERT INTO echipamente (id, nume, tip) VALUES (?, ?, ?)`, [id, nume, tip]);
        res.status(201).json({ message: 'Echipament adăugat cu succes!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/echipamente', async (req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM echipamente`);
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/echipamente/:id', async (req, res) => {
    try {
        const [result] = await pool.execute(`UPDATE echipamente SET nume = ?, tip = ? WHERE id = ?`, [req.body.nume, req.body.tip, req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Echipamentul nu a fost găsit.' });
        res.status(200).json({ message: 'Echipament actualizat!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/echipamente/:id', async (req, res) => {
    try {
        const [result] = await pool.execute(`DELETE FROM echipamente WHERE id = ?`, [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Echipamentul nu a fost găsit.' });
        res.status(200).json({ message: 'Echipament șters!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Pornire server
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
    console.log(`Serverul backend rulează pe http://localhost:${PORT}`);
});