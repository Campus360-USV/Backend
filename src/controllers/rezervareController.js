const Rezervare = require('../models/rezervareModel');
const Laborator = require('../models/laboratorModel');
const { parseId } = require('../utils/validare');

// Rezervări (KAN-17 calendar și prevenirea suprapunerilor, KAN-18 creare,
// KAN-19 rezervările proprii, KAN-21 anulare, KAN-24 aprobare, KAN-25 respingere cu motiv).

const ORA = /^([01]\d|2[0-3]):([0-5]\d)$/;   // "08:00" ... "23:59"
const DATA = /^\d{4}-\d{2}-\d{2}$/;           // "2026-11-20"
const MAX_ZILE_CALENDAR = 62;

function text(value) {
    return value === undefined || value === null ? '' : String(value).trim();
}

// Data de azi pe ora serverului, ca "YYYY-MM-DD"
function azi() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function esteDataValida(valoare) {
    if (!DATA.test(valoare)) return false;
    const [an, luna, zi] = valoare.split('-').map(Number);
    const d = new Date(Date.UTC(an, luna - 1, zi));
    return d.getUTCFullYear() === an && d.getUTCMonth() === luna - 1 && d.getUTCDate() === zi;
}
// Sâmbăta (6) și duminica (0) laboratoarele sunt închise
function esteWeekend(data) {
    const [an, luna, zi] = data.split('-').map(Number);
    const ziSaptamana = new Date(Date.UTC(an, luna - 1, zi)).getUTCDay();
    return ziSaptamana === 0 || ziSaptamana === 6;
}

function adaugaZile(data, zile) {
    const [an, luna, zi] = data.split('-').map(Number);
    const d = new Date(Date.UTC(an, luna - 1, zi + zile));
    return d.toISOString().slice(0, 10);
}

function esteAdmin(req) {
    return req.user?.rol === 'admin';
}

// Acceptă intervalul fie ca "ora_inceput" + "ora_sfarsit", fie ca "interval_orar": "10:00-12:00"
// (formatul trimis de frontend).
function citesteIntervalul(body) {
    let oraInceput = text(body?.ora_inceput);
    let oraSfarsit = text(body?.ora_sfarsit);
    if ((!oraInceput || !oraSfarsit) && body?.interval_orar) {
        [oraInceput = '', oraSfarsit = ''] = text(body.interval_orar).split('-').map(s => s.trim());
    }
    return { oraInceput, oraSfarsit };
}

// Validează body-ul pentru POST. Întoarce { error } sau { data }.
async function validateBody(body) {
    const laboratorId = parseId(body?.laborator_id ?? body?.laborator);
    const data = text(body?.data_rezervare);
    const { oraInceput, oraSfarsit } = citesteIntervalul(body);
    const scop = text(body?.scop);
    const tipActivitate = text(body?.tip_activitate ?? body?.tip) || null;
    const participanti = body?.participanti === undefined || body?.participanti === '' ? 1 : Number(body.participanti);

    if (!laboratorId) return { error: 'Câmpul "laborator_id" este obligatoriu.' };
    if (!esteDataValida(data)) return { error: 'Câmpul "data_rezervare" trebuie să fie o dată validă (AAAA-LL-ZZ).' };
    if (data < azi()) return { error: 'Nu se pot face rezervări pentru o dată din trecut.' };
    if (esteWeekend(data)) return { error: 'Laboratoarele se pot rezerva doar de luni până vineri.' };
    if (!ORA.test(oraInceput) || !ORA.test(oraSfarsit)) {
        return { error: 'Intervalul orar trebuie să fie de forma "10:00-12:00" (sau ora_inceput și ora_sfarsit).' };
    }
    if (oraInceput >= oraSfarsit) return { error: 'Ora de început trebuie să fie înaintea orei de sfârșit.' };
    if (scop.length > 1000) return { error: 'Câmpul "scop" poate avea maxim 1000 de caractere.' };
    if (tipActivitate && tipActivitate.length > 50) return { error: 'Câmpul "tip" poate avea maxim 50 de caractere.' };
    if (!Number.isInteger(participanti) || participanti < 1) {
        return { error: 'Câmpul "participanti" trebuie să fie un număr întreg mai mare ca 0.' };
    }

    const laborator = await Laborator.findById(laboratorId);
    if (!laborator) return { error: `Laboratorul cu id ${laboratorId} nu există.` };
    if (participanti > laborator.capacitate) {
        return { error: `Laboratorul ${laborator.nume} are capacitatea de ${laborator.capacitate} locuri.` };
    }

    return { data: { laboratorId, data, oraInceput, oraSfarsit, scop: scop || null, participanti, tipActivitate } };
}

// GET /api/rezervari  (autentificat)
// admin -> toate rezervările; ceilalți -> doar rezervările proprii (KAN-19)
// ?stare=în așteptare | aprobată | respinsă  (opțional)
async function getAll(req, res) {
    const stare = req.query.stare !== undefined ? text(req.query.stare) : undefined;
    if (stare !== undefined && !['în așteptare', 'aprobată', 'respinsă'].includes(stare)) {
        return res.status(400).json({ error: 'Starea poate fi: în așteptare, aprobată sau respinsă.' });
    }
    const idUtilizator = esteAdmin(req) ? undefined : req.user.id;
    res.status(200).json(await Rezervare.findAll({ idUtilizator, stare }));
}

// GET /api/rezervari/:id  (autentificat: proprietarul sau adminul)
async function getById(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalid.' });

    const rezervare = await Rezervare.findById(id);
    if (!rezervare || (!esteAdmin(req) && rezervare.id_utilizator !== req.user.id)) {
        return res.status(404).json({ error: 'Rezervarea nu a fost găsită.' });
    }
    res.status(200).json(rezervare);
}

// GET /api/rezervari/ocupate?laborator_id=2&de_la=2026-11-16&pana_la=2026-11-22  (public)
// KAN-17: intervalele ocupate ale unui laborator, pentru calendar. Fără date personale.
async function getOcupate(req, res) {
    const laboratorId = parseId(req.query.laborator_id);
    if (!laboratorId) return res.status(400).json({ error: 'Parametrul "laborator_id" este obligatoriu.' });

    const deLa = req.query.de_la !== undefined ? text(req.query.de_la) : azi();
    const panaLa = req.query.pana_la !== undefined ? text(req.query.pana_la) : adaugaZile(deLa, 6);
    if (!esteDataValida(deLa) || !esteDataValida(panaLa)) {
        return res.status(400).json({ error: '"de_la" și "pana_la" trebuie să fie date valide (AAAA-LL-ZZ).' });
    }
    if (deLa > panaLa) return res.status(400).json({ error: '"de_la" trebuie să fie înainte de "pana_la".' });
    if (panaLa > adaugaZile(deLa, MAX_ZILE_CALENDAR)) {
        return res.status(400).json({ error: `Intervalul poate avea maxim ${MAX_ZILE_CALENDAR} de zile.` });
    }
    if (!(await Laborator.exists(laboratorId))) {
        return res.status(404).json({ error: 'Laboratorul nu a fost găsit.' });
    }

    const ocupate = await Rezervare.findOcupate({ laboratorId, deLa, panaLa });
    res.status(200).json({ laborator_id: laboratorId, de_la: deLa, pana_la: panaLa, ocupate });
}

// POST /api/rezervari  (autentificat)
// KAN-18 + KAN-17: cererea se creează "în așteptare", doar dacă intervalul e liber.
async function create(req, res) {
    const { error, data } = await validateBody(req.body);
    if (error) return res.status(400).json({ error });

    const rezultat = await Rezervare.createFaraSuprapunere({ ...data, idUtilizator: req.user.id });
    if (rezultat.conflict) {
        const c = rezultat.conflict;
        return res.status(409).json({
            error: `Intervalul se suprapune cu o rezervare ${c.stare} (${c.ora_inceput}-${c.ora_sfarsit}). Alege alt interval.`
        });
    }

    const rezervare = await Rezervare.findById(rezultat.id);
    res.status(201).json({ message: 'Cererea de rezervare a fost trimisă și este în așteptare.', id: rezultat.id, rezervare });
}

// DELETE /api/rezervari/:id  (autentificat)
// KAN-21: utilizatorul își anulează propria rezervare (adminul poate anula orice rezervare).
// Rezervările din trecut nu se mai pot anula.
async function remove(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalid.' });

    const rezervare = await Rezervare.findById(id);
    if (!rezervare || (!esteAdmin(req) && rezervare.id_utilizator !== req.user.id)) {
        return res.status(404).json({ error: 'Rezervarea nu a fost găsită.' });
    }
    if (!esteAdmin(req) && rezervare.data_rezervare < azi()) {
        return res.status(409).json({ error: 'O rezervare din trecut nu mai poate fi anulată.' });
    }

    await Rezervare.remove(id);
    res.status(200).json({ message: 'Rezervarea a fost anulată.' });
}

// Răspunsul comun pentru aprobare / respingere
async function trimiteDecizia(res, id, rezultat, mesaj) {
    if (rezultat.negasita) return res.status(404).json({ error: 'Rezervarea nu a fost găsită.' });
    if (rezultat.dejaProcesata) {
        return res.status(409).json({ error: `Cererea a fost deja procesată (stare: ${rezultat.dejaProcesata}).` });
    }
    if (rezultat.conflict) {
        const c = rezultat.conflict;
        return res.status(409).json({
            error: `Nu se poate aproba: există deja o rezervare aprobată în intervalul ${c.ora_inceput}-${c.ora_sfarsit}.`
        });
    }
    res.status(200).json({ message: mesaj, rezervare: await Rezervare.findById(id) });
}

// PUT /api/rezervari/:id/aproba  (admin) - KAN-24
async function aproba(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalid.' });

    const rezultat = await Rezervare.decide(id, { stareNoua: 'aprobată' });
    return trimiteDecizia(res, id, rezultat, 'Cererea a fost aprobată.');
}

// PUT /api/rezervari/:id/respinge  (admin) - KAN-25
// body: { "motiv": "..." }  - motivul este obligatoriu și apare utilizatorului.
async function respinge(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalid.' });

    const motiv = text(req.body?.motiv ?? req.body?.motiv_respingere);
    if (!motiv) return res.status(400).json({ error: 'Motivul respingerii este obligatoriu.' });
        if (motiv.length < 10) {
        return res.status(400).json({ error: 'Motivul respingerii trebuie să aibă cel puțin 10 caractere, ca utilizatorul să înțeleagă decizia.' });
    }
    if (motiv.length > 500) return res.status(400).json({ error: 'Motivul poate avea maxim 500 de caractere.' });

    const rezultat = await Rezervare.decide(id, { stareNoua: 'respinsă', motiv });
    return trimiteDecizia(res, id, rezultat, 'Cererea a fost respinsă.');
}

module.exports = { getAll, getById, getOcupate, create, remove, aproba, respinge };
