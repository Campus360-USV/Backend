const Laborator = require('../models/laboratorModel');
const Echipament = require('../models/echipamentModel');

// KAN-11: API pentru laboratoare (doar citire).

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/laboratoare -> lista tuturor laboratoarelor
async function getAll(req, res) {
    const laboratoare = await Laborator.findAll();
    res.status(200).json(laboratoare);
}

// GET /api/laboratoare/:id -> detaliile unui laborator + echipamentele lui
async function getById(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalid.' });

    const laborator = await Laborator.findById(id);
    if (!laborator) return res.status(404).json({ error: 'Laboratorul nu a fost găsit.' });

    const echipamente = await Echipament.findAll({ laboratorId: id });
    res.status(200).json({ ...laborator, echipamente });
}

module.exports = { getAll, getById };
