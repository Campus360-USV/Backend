// KAN-10: Modelul de date pentru laboratoare și echipamente.
// KAN-2: tabelele users și rezervari (mutate din server.js).
const bcrypt = require('bcrypt');
// Tabelele se creează automat la pornirea serverului (dacă nu există deja).

const createLaboratoare = `
    CREATE TABLE IF NOT EXISTS laboratoare (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nume VARCHAR(100) NOT NULL UNIQUE,
        locatie VARCHAR(150) NOT NULL,
        capacitate INT UNSIGNED NOT NULL,
        responsabil VARCHAR(100),
        reguli TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`;

// Un echipament aparține unui singur laborator (relație 1 la N).
// este_special = TRUE  -> echipament special, vizibil doar profesorilor (KAN-13)
// este_special = FALSE -> echipament implicit, vizibil tuturor
// ON DELETE CASCADE: dacă se șterge laboratorul, se șterg și echipamentele lui.
const createEchipamente = `
    CREATE TABLE IF NOT EXISTS echipamente (
        id INT AUTO_INCREMENT PRIMARY KEY,
        laborator_id INT NOT NULL,
        nume VARCHAR(100) NOT NULL,
        tip VARCHAR(50),
        cantitate INT UNSIGNED NOT NULL DEFAULT 1,
        este_special BOOLEAN NOT NULL DEFAULT FALSE,
        CONSTRAINT fk_echipamente_laborator
            FOREIGN KEY (laborator_id) REFERENCES laboratoare(id)
            ON DELETE CASCADE
    )
`;

// KAN-2: utilizatori și roluri (student / profesor / admin)
const createUsers = `
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        parola VARCHAR(255) NOT NULL,
        rol ENUM('student', 'profesor', 'admin') DEFAULT 'student'
    )
`;

// Cererile de rezervare (KAN-18 și următoarele).
// laborator_id face legătura cu tabela laboratoare.
// KAN-17: intervalul e păstrat ca două coloane TIME (ora_inceput, ora_sfarsit),
// ca să putem verifica în SQL dacă două rezervări se suprapun.
const createRezervari = `
    CREATE TABLE IF NOT EXISTS rezervari (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_utilizator INT NOT NULL,
        laborator_id INT NOT NULL,
        data_rezervare DATE NOT NULL,
        ora_inceput TIME NOT NULL,
        ora_sfarsit TIME NOT NULL,
        scop TEXT,
        participanti INT UNSIGNED NOT NULL DEFAULT 1,
        tip_activitate VARCHAR(50),
        stare ENUM('în așteptare', 'aprobată', 'respinsă') DEFAULT 'în așteptare',
        motiv_respingere TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_utilizator) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (laborator_id) REFERENCES laboratoare(id) ON DELETE CASCADE,
        INDEX idx_rezervari_laborator_data (laborator_id, data_rezervare)
    )
`;

// Conturi de test (parolele sunt salvate criptat cu bcrypt)
const utilizatoriTest = [
    ['admin@usv.ro', 'admin123', 'admin'],
    ['profesor@usv.ro', 'profesor123', 'profesor'],
    ['student@usv.ro', 'student123', 'student']
];

// Date de test, inserate doar dacă tabela laboratoare e goală.
const laboratoareTest = [
    ['C201', 'Corp C, etaj 2', 30, 'Prof. Popescu', 'Accesul doar cu cadru didactic. Fără mâncare și băutură.'],
    ['C305', 'Corp C, etaj 3', 24, 'Prof. Ionescu', 'Calculatoarele se închid la final.'],
    ['A104 - Electronică', 'Corp A, parter', 16, 'Prof. Rusu', 'Echipamentul de protecție este obligatoriu.']
];

const echipamenteTest = [
    // [nume laborator, nume echipament, tip, cantitate, este_special]
    ['C201', 'Calculator PC', 'IT', 30, false],
    ['C201', 'Videoproiector', 'Multimedia', 1, false],
    ['C305', 'Calculator PC', 'IT', 24, false],
    ['C305', 'Tablă interactivă', 'Multimedia', 1, false],
    ['C305', 'Server rack', 'IT', 1, true],
    ['A104 - Electronică', 'Osciloscop', 'Electronică', 8, true],
    ['A104 - Electronică', 'Sursă de alimentare', 'Electronică', 8, false]
];

// Tabela "echipamente" din aplicația de start avea altă structură (fără laborator_id).
// Dacă o găsim, o redenumim în "echipamente_vechi" ca să putem crea tabela nouă,
// fără să pierdem datele vechi.
async function migrateOldEchipamente(pool) {
    const [tabela] = await pool.query("SHOW TABLES LIKE 'echipamente'");
    if (tabela.length === 0) return;

    const [coloana] = await pool.query("SHOW COLUMNS FROM echipamente LIKE 'laborator_id'");
    if (coloana.length > 0) return;

    await pool.query('DROP TABLE IF EXISTS echipamente_vechi');
    await pool.query('RENAME TABLE echipamente TO echipamente_vechi');
    console.warn('Tabela veche "echipamente" a fost redenumită în "echipamente_vechi".');
}

// KAN-17: tabela rezervari din varianta anterioară avea intervalul ca text (interval_orar,
// ex. "10:00-12:00"). Dacă o găsim, o aducem la structura nouă fără să pierdem datele.
async function migrateRezervari(pool) {
    const [tabela] = await pool.query("SHOW TABLES LIKE 'rezervari'");
    if (tabela.length === 0) return;

    const [coloane] = await pool.query('SHOW COLUMNS FROM rezervari');
    const nume = coloane.map(c => c.Field);

    if (!nume.includes('ora_inceput')) {
        await pool.query('ALTER TABLE rezervari ADD COLUMN ora_inceput TIME NULL AFTER data_rezervare, ADD COLUMN ora_sfarsit TIME NULL AFTER ora_inceput');
        if (nume.includes('interval_orar')) {
            await pool.query(`UPDATE rezervari SET
                ora_inceput = STR_TO_DATE(TRIM(SUBSTRING_INDEX(interval_orar, '-', 1)), '%H:%i'),
                ora_sfarsit = STR_TO_DATE(TRIM(SUBSTRING_INDEX(interval_orar, '-', -1)), '%H:%i')`);
        }
        await pool.query("UPDATE rezervari SET ora_inceput = COALESCE(ora_inceput, '08:00'), ora_sfarsit = COALESCE(ora_sfarsit, '10:00')");
        await pool.query('ALTER TABLE rezervari MODIFY ora_inceput TIME NOT NULL, MODIFY ora_sfarsit TIME NOT NULL');
        console.warn('Tabela "rezervari" a fost actualizată: interval_orar -> ora_inceput / ora_sfarsit.');
    }
    if (nume.includes('interval_orar')) {
        await pool.query('ALTER TABLE rezervari DROP COLUMN interval_orar');
    }
    if (!nume.includes('participanti')) {
        await pool.query('ALTER TABLE rezervari ADD COLUMN participanti INT UNSIGNED NOT NULL DEFAULT 1 AFTER scop');
    }
    if (!nume.includes('tip_activitate')) {
        await pool.query('ALTER TABLE rezervari ADD COLUMN tip_activitate VARCHAR(50) NULL AFTER participanti');
    }
    if (!nume.includes('created_at')) {
        await pool.query('ALTER TABLE rezervari ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    }
}

async function createTables(pool) {
    await migrateOldEchipamente(pool);
    await pool.execute(createLaboratoare);
    await pool.execute(createEchipamente);
    await pool.execute(createUsers);
    await migrateRezervari(pool);
    await pool.execute(createRezervari);
}

async function seedUsers(pool) {
    for (const [email, parola, rol] of utilizatoriTest) {
        const [existent] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existent.length > 0) continue;
        const hash = await bcrypt.hash(parola, 10);
        await pool.execute('INSERT INTO users (email, parola, rol) VALUES (?, ?, ?)', [email, hash, rol]);
        console.log(`Cont de test creat: ${email} / ${parola} (${rol})`);
    }
}

async function seedData(pool) {
    await seedUsers(pool);

    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM laboratoare');
    if (total > 0) return;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const idDupaNume = {};
        for (const [nume, locatie, capacitate, responsabil, reguli] of laboratoareTest) {
            const [result] = await conn.execute(
                'INSERT INTO laboratoare (nume, locatie, capacitate, responsabil, reguli) VALUES (?, ?, ?, ?, ?)',
                [nume, locatie, capacitate, responsabil, reguli]
            );
            idDupaNume[nume] = result.insertId;
        }
        for (const [lab, nume, tip, cantitate, special] of echipamenteTest) {
            await conn.execute(
                'INSERT INTO echipamente (laborator_id, nume, tip, cantitate, este_special) VALUES (?, ?, ?, ?, ?)',
                [idDupaNume[lab], nume, tip, cantitate, special]
            );
        }
        await conn.commit();
        console.log('Date de test adăugate: 3 laboratoare și 7 echipamente.');
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = { createTables, seedData };
