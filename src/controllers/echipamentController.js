const Echipament = require('../models/echipamentModel');
const Laborator = require('../models/laboratorModel');
const { poateVedeaSpeciale } = require('../middleware/auth');

// Controller-ul: citește cererea, validează, apelează modelul, trimite răspunsul.
// În Express 5, erorile aruncate din funcții async ajung automat la errorHandler.

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// Validează body-ul pentru POST/PUT. Întoarce { error } sau { data }.
async function validateBody(body) {
    const { nume, tip, cantitate = 1, este_special = false } = body ?? {};
    const laborator_id = parseId(body?.laborator_id);

    if (!laborator_id) return { error: 'Câmpul "laborator_id" este obligatoriu (număr întreg pozitiv).' };
    if (!nume || !String(nume).trim()) return { error: 'Câmpul "nume" este obligatoriu.' };
    if (!Number.isInteger(Number(cantitate)) || Number(cantitate) < 1) {
        return { error: 'Câmpul "cantitate" trebuie să fie un număr întreg mai mare ca 0.' };
    }
    if (typeof este_special !== 'boolean') return { error: 'Câmpul "este_special" trebuie să fie true sau false.' };
    if (!(await Laborator.exists(laborator_id))) return { error: `Laboratorul cu id ${laborator_id} nu există.` };

    return {
        data: {
            laborator_id,
            nume: String(nume).trim(),
            tip: tip ? String(tip).trim() : null,
            cantitate: Number(cantitate),
            este_special
        }
    };
}

// GET /api/echipamente            -> toate echipamentele
// GET /api/echipamente?laborator_id=2 -> doar echipamentele laboratorului 2
async function getAll(req, res) {
    let laboratorId;
    if (req.query.laborator_id !== undefined) {
        laboratorId = parseId(req.query.laborator_id);
        if (!laboratorId) return res.status(400).json({ error: 'laborator_id invalid.' });
    }
    const includeSpeciale = poateVedeaSpeciale(req);
    res.status(200).json(await Echipament.findAll({ laboratorId, includeSpeciale }));
}

async function getById(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalid.' });

    const echipament = await Echipament.findById(id);
    // Un echipament special apare ca inexistent pentru cine nu are voie să-l vadă.
    if (!echipament || (echipament.este_special && !poateVedeaSpeciale(req))) {
        return res.status(404).json({ error: 'Echipamentul nu a fost găsit.' });
    }
    res.status(200).json(echipament);
}

async function create(req, res) {
    const { error, data } = await validateBody(req.body);
    if (error) return res.status(400).json({ error });

    const id = await Echipament.create(data);
    res.status(201).json({ message: 'Echipament adăugat cu succes!', id });
}

async function update(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalid.' });

    const { error, data } = await validateBody(req.body);
    if (error) return res.status(400).json({ error });

    const updated = await Echipament.update(id, data);
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
