const Laborator = require('../models/laboratorModel');
const Echipament = require('../models/echipamentModel');
const { poateVedeaSpeciale } = require('../middleware/auth');
const { parseId } = require('../utils/validare');

// KAN-11: API pentru laboratoare (citire)
// KAN-26: adăugare, editare, ștergere (doar admin)

function text(value) {
    return value === undefined || value === null ? '' : String(value).trim();
}

// Validează body-ul pentru POST/PUT. Întoarce { error } sau { data }.
function validateBody(body) {
    const nume = text(body?.nume);
    const locatie = text(body?.locatie);
    const capacitate = Number(body?.capacitate);

    if (!nume) return { error: 'Câmpul "nume" este obligatoriu.' };
    if (nume.length > 100) return { error: 'Câmpul "nume" poate avea maxim 100 de caractere.' };
    if (!locatie) return { error: 'Câmpul "locatie" este obligatoriu.' };
    if (locatie.length > 150) return { error: 'Câmpul "locatie" poate avea maxim 150 de caractere.' };
    if (!Number.isInteger(capacitate) || capacitate < 1) {
        return { error: 'Câmpul "capacitate" trebuie să fie un număr întreg mai mare ca 0.' };
    }

    return {
        data: {
            nume,
            locatie,
            capacitate,
            responsabil: text(body?.responsabil) || null,
            reguli: text(body?.reguli) || null
        }
    };
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

    // KAN-13: echipamentele speciale apar doar pentru profesori și admini
    const echipamente = await Echipament.findAll({ laboratorId: id, includeSpeciale: poateVedeaSpeciale(req) });
    res.status(200).json({ ...laborator, echipamente });
}

// POST /api/laboratoare (admin)
async function create(req, res) {
    const { error, data } = validateBody(req.body);
    if (error) return res.status(400).json({ error });

    try {
        const id = await Laborator.create(data);
        res.status(201).json({ message: 'Laborator adăugat cu succes!', id });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: `Există deja un laborator cu numele "${data.nume}".` });
        }
        throw err;
    }
}

// PUT /api/laboratoare/:id (admin)
async function update(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalid.' });

    const { error, data } = validateBody(req.body);
    if (error) return res.status(400).json({ error });

    try {
        const updated = await Laborator.update(id, data);
        if (!updated) return res.status(404).json({ error: 'Laboratorul nu a fost găsit.' });
        res.status(200).json({ message: 'Laborator actualizat!' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: `Există deja un laborator cu numele "${data.nume}".` });
        }
        throw err;
    }
}

// DELETE /api/laboratoare/:id (admin)
async function remove(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalid.' });

    // Nu ștergem un laborator care are rezervări active (s-ar pierde odată cu el).
    const rezervariActive = await Laborator.countRezervariActive(id);
    if (rezervariActive > 0) {
        return res.status(409).json({
            error: `Laboratorul are ${rezervariActive} rezervări active (în așteptare sau aprobate). Anulează-le sau respinge-le înainte de ștergere.`
        });
    }

    const deleted = await Laborator.remove(id);
    if (!deleted) return res.status(404).json({ error: 'Laboratorul nu a fost găsit.' });
    res.status(200).json({ message: 'Laborator șters, împreună cu echipamentele lui.' });
}

module.exports = { getAll, getById, create, update, remove };
