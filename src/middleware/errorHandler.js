// Rută inexistentă -> 404
function notFound(req, res) {
    res.status(404).json({ error: `Ruta ${req.method} ${req.originalUrl} nu există.` });
}

// Orice eroare neprevăzută ajunge aici. Detaliile rămân în consola serverului,
// clientul primește doar un mesaj generic (nu expunem erori SQL).
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Body-ul cererii nu este JSON valid.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Eroare internă a serverului.' });
}

module.exports = { notFound, errorHandler };
