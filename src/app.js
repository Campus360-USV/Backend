const express = require('express');
const echipamentRoutes = require('./routes/echipamentRoutes');
const laboratorRoutes = require('./routes/laboratorRoutes');
const authRoutes = require('./routes/authRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(express.json());

// Verificare rapidă că serverul răspunde
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', authRoutes); // POST /api/login
app.use('/api/laboratoare', laboratorRoutes);
app.use('/api/echipamente', echipamentRoutes);

// Trebuie să fie ultimele
app.use(notFound);
app.use(errorHandler);

module.exports = app;
