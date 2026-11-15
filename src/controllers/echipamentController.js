const Echipament = require('../models/echipamentModel');

// Controller-ul: citește cererea, validează, apelează modelul, trimite răspunsul.
// În Express 5, erorile aruncate din funcții async ajung automat la errorHandler.

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

async function getAll(req, res) {
    const echipamente = await Echipament.findAll();
    res.status(200).json(echipamente);
}

async function getById(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalid.' });

    const echipament = await Echipament.findById(id);
    if (!echipament) return res.status(404).json({ error: 'Echipamentul nu a fost găsit.' });
    res.status(200).json(echipament);
}

async function create(req, res) {
    const { nume, tip } = req.body ?? {};
    const id = parseId(req.body?.id);
    if (!id) return res.status(400).json({ error: 'Câmpul "id" trebuie să fie un număr întreg pozitiv.' });
    if (!nume || !String(nume).trim()) return res.status(400).json({ error: 'Câmpul "nume" este obligatoriu.' });

    try {
        await Echipament.create({ id, nume: String(nume).trim(), tip });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: `Există deja un echipament cu id ${id}.` });
        }
        throw err;
    }
    res.status(201).json({ message: 'Echipament adăugat cu succes!' });
}

async function update(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalid.' });

    const { nume, tip } = req.body ?? {};
    if (!nume || !String(nume).trim()) return res.status(400).json({ error: 'Câmpul "nume" este obligatoriu.' });

    const updated = await Echipament.update(id, { nume: String(nume).trim(), tip });
    if (!updated) return res.status(404).json({ error: 'Echipamentul nu a fost găsit.' });
    res.status(200).json({ message: 'Echipament actualizat!' });
}

async function remove(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalid.' });

    const deleted = await Echipament.remove(id);
    if (!deleted) return res.status(404).json({ error: 'Echipamentul nu a fost găsit.' });
    res.status(200).json({ message: 'Echipament șters!' });
}

module.exports = { getAll, getById, create, update, remove };
