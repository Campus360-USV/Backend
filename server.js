// Citește variabilele din fișierul .env (funcție inclusă în Node.js >= 20.12,
// nu e nevoie de pachetul dotenv). Dacă .env lipsește, se folosesc valorile implicite.
try {
    process.loadEnvFile();
} catch {
    console.warn('Fișierul .env nu a fost găsit - se folosesc valorile implicite.');
}

const app = require('./src/app');
const { initDB } = require('./src/config/db');

const PORT = Number(process.env.PORT) || 3000;

// Pornim serverul DOAR după ce baza de date e gata.
async function start() {
    try {
        await initDB();
        console.log('Baza de date a fost inițializată cu succes!');
        app.listen(PORT, () => {
            console.log(`Serverul backend rulează pe http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Nu s-a putut conecta la baza de date:', err.message);
        process.exit(1);
    }
}

start();
