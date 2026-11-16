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

module.exports = { requireAuth, requireRole };
