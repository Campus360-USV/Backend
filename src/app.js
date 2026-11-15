const express = require('express');
const echipamentRoutes = require('./routes/echipamentRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(express.json());

// Verificare rapidă că serverul răspunde
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/echipamente', echipamentRoutes);

// Trebuie să fie ultimele
app.use(notFound);
app.use(errorHandler);

module.exports = app;
