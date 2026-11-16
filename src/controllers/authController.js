const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// KAN-2: login cu email/parolă, întoarce un token JWT.
// POST /api/login  body: { "email": "...", "parola": "..." }
async function login(req, res) {
    const { email, parola } = req.body ?? {};
    if (!email || !parola) {
        return res.status(400).json({ error: 'Câmpurile "email" și "parola" sunt obligatorii.' });
    }

    const user = await User.findByEmail(String(email).trim().toLowerCase());
    // Același mesaj pentru email greșit și parolă greșită (nu dezvăluim care e greșit).
    if (!user || !(await bcrypt.compare(String(parola), user.parola))) {
        return res.status(401).json({ error: 'Email sau parolă incorectă.' });
    }

    const token = jwt.sign(
        { id: user.id, rol: user.rol, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
    );

    res.status(200).json({ message: 'Autentificare reușită!', token, rol: user.rol });
}

module.exports = { login };
