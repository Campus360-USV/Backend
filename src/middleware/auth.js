const jwt = require('jsonwebtoken');

// Verifică token-ul JWT din header-ul "Authorization: Bearer <token>".
// Dacă e valid, pune datele utilizatorului în req.user (id, rol, email).
function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const [tip, token] = header.split(' ');
    if (tip !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Trebuie să fii autentificat.' });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Token invalid sau expirat.' });
    }
}

// Pentru rutele publice care arată mai multe date utilizatorilor autentificați (KAN-13).
// Dacă cererea are un token valid, pune datele în req.user. Altfel, continuă ca vizitator
// (un token lipsă sau expirat nu blochează pagina, doar nu primește date suplimentare).
function optionalAuth(req, res, next) {
    const [tip, token] = (req.headers.authorization || '').split(' ');
    if (tip === 'Bearer' && token) {
        try {
            req.user = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            req.user = undefined;
        }
    }
    next();
}

// Permite accesul doar rolurilor date. Se folosește DUPĂ requireAuth.
// Exemplu: router.post('/', requireAuth, requireRole('admin'), controller.create)
function requireRole(...roluri) {
    return (req, res, next) => {
        if (!req.user || !roluri.includes(req.user.rol)) {
            return res.status(403).json({ error: 'Nu ai drepturi pentru această operație.' });
        }
        next();
    };
}

// KAN-13: echipamentele speciale sunt vizibile doar profesorilor și adminilor.
// req.user există doar dacă cererea a venit cu un token valid.
function poateVedeaSpeciale(req) {
    return Boolean(req.user) && ['profesor', 'admin'].includes(req.user.rol);
}

module.exports = { requireAuth, requireRole, optionalAuth, poateVedeaSpeciale };
