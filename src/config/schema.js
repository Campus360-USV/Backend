// KAN-10: Modelul de date pentru laboratoare și echipamente.
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

async function createTables(pool) {
    await migrateOldEchipamente(pool);
    await pool.execute(createLaboratoare);
    await pool.execute(createEchipamente);
}

async function seedData(pool) {
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
