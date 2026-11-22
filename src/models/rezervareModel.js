const { getPool } = require('../config/db');

// Modelul pentru tabela rezervari. Doar interogări SQL.
//
// Datele și orele sunt formatate direct în SQL ("2026-11-20", "10:00"), ca să nu
// fie transformate de JavaScript în alt fus orar.

const STARI_ACTIVE = ['în așteptare', 'aprobată'];

const SELECT_REZERVARE = `
    SELECT r.id,
           r.id_utilizator,
           u.email,
           r.laborator_id,
           r.laborator_id AS id_laborator,
           l.nume AS laborator_nume,
           DATE_FORMAT(r.data_rezervare, '%Y-%m-%d') AS data_rezervare,
           TIME_FORMAT(r.ora_inceput, '%H:%i') AS ora_inceput,
           TIME_FORMAT(r.ora_sfarsit, '%H:%i') AS ora_sfarsit,
           CONCAT(TIME_FORMAT(r.ora_inceput, '%H:%i'), '-', TIME_FORMAT(r.ora_sfarsit, '%H:%i')) AS interval_orar,
           r.scop,
           r.participanti,
           r.tip_activitate,
           r.stare,
           r.motiv_respingere,
           r.created_at
    FROM rezervari r
    JOIN users u ON u.id = r.id_utilizator
    JOIN laboratoare l ON l.id = r.laborator_id
`;

// Toate rezervările (admin) sau doar ale unui utilizator. Opțional, filtrate după stare.
async function findAll({ idUtilizator, stare } = {}) {
    const conditii = [];
    const params = [];
    if (idUtilizator) {
        conditii.push('r.id_utilizator = ?');
        params.push(idUtilizator);
    }
    if (stare) {
        conditii.push('r.stare = ?');
        params.push(stare);
    }
    let sql = SELECT_REZERVARE;
    if (conditii.length > 0) sql += ' WHERE ' + conditii.join(' AND ');
    const [rows] = await getPool().query(sql + ' ORDER BY r.data_rezervare DESC, r.ora_inceput DESC', params);
    return rows;
}

async function findById(id) {
    const [rows] = await getPool().query(SELECT_REZERVARE + ' WHERE r.id = ?', [id]);
    return rows[0] || null;
}

// KAN-17: intervalele ocupate (rezervări în așteptare sau aprobate) ale unui laborator,
// între două date. Nu conține date personale, doar intervalele.
async function findOcupate({ laboratorId, deLa, panaLa }) {
    const [rows] = await getPool().query(
        `SELECT r.id,
                r.laborator_id,
                DATE_FORMAT(r.data_rezervare, '%Y-%m-%d') AS data_rezervare,
                TIME_FORMAT(r.ora_inceput, '%H:%i') AS ora_inceput,
                TIME_FORMAT(r.ora_sfarsit, '%H:%i') AS ora_sfarsit,
                r.stare
         FROM rezervari r
         WHERE r.laborator_id = ?
           AND r.data_rezervare BETWEEN ? AND ?
           AND r.stare IN (?)
         ORDER BY r.data_rezervare, r.ora_inceput`,
        [laboratorId, deLa, panaLa, STARI_ACTIVE]
    );
    return rows;
}

// KAN-17: caută o rezervare activă care se suprapune cu intervalul dat.
// Două intervale [a, b) și [c, d) se suprapun dacă a < d și c < b.
// (10:00-12:00 și 12:00-14:00 NU se suprapun: una se termină exact când începe cealaltă.)
// `exceptId` exclude rezervarea verificată (folosit la aprobare).
async function findSuprapunere(conn, { laboratorId, data, oraInceput, oraSfarsit, stari = STARI_ACTIVE, exceptId = 0 }) {
    const [rows] = await conn.query(
        `SELECT id, TIME_FORMAT(ora_inceput, '%H:%i') AS ora_inceput, TIME_FORMAT(ora_sfarsit, '%H:%i') AS ora_sfarsit, stare
         FROM rezervari
         WHERE laborator_id = ?
           AND data_rezervare = ?
           AND stare IN (?)
           AND id <> ?
           AND ora_inceput < ?
           AND ? < ora_sfarsit
         LIMIT 1`,
        [laboratorId, data, stari, exceptId, oraSfarsit, oraInceput]
    );
    return rows[0] || null;
}

// KAN-17: creează rezervarea DOAR dacă nu se suprapune cu alta.
// Totul se face într-o tranzacție care blochează rândul laboratorului (FOR UPDATE),
// ca două cereri trimise în același timp să nu poată rezerva amândouă același interval.
// Întoarce { id } sau { conflict }.
async function createFaraSuprapunere({ idUtilizator, laboratorId, data, oraInceput, oraSfarsit, scop, participanti, tipActivitate }) {
    const conn = await getPool().getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('SELECT id FROM laboratoare WHERE id = ? FOR UPDATE', [laboratorId]);

        const conflict = await findSuprapunere(conn, { laboratorId, data, oraInceput, oraSfarsit });
        if (conflict) {
            await conn.rollback();
            return { conflict };
        }

        const [result] = await conn.query(
            `INSERT INTO rezervari
                (id_utilizator, laborator_id, data_rezervare, ora_inceput, ora_sfarsit, scop, participanti, tip_activitate)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [idUtilizator, laboratorId, data, oraInceput, oraSfarsit, scop, participanti, tipActivitate]
        );
        await conn.commit();
        return { id: result.insertId };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

// KAN-24 / KAN-25: aprobarea sau respingerea unei cereri de către admin.
// Se poate decide doar asupra unei cereri "în așteptare". La aprobare se verifică din nou
// să nu existe deja o rezervare APROBATĂ suprapusă (în aceeași tranzacție, cu blocare).
// Întoarce { ok }, { negasita }, { dejaProcesata: stare } sau { conflict }.
async function decide(id, { stareNoua, motiv = null }) {
    const conn = await getPool().getConnection();
    try {
        await conn.beginTransaction();
        const [[rezervare]] = await conn.query(
            `SELECT id, laborator_id, DATE_FORMAT(data_rezervare, '%Y-%m-%d') AS data_rezervare,
                    TIME_FORMAT(ora_inceput, '%H:%i') AS ora_inceput, TIME_FORMAT(ora_sfarsit, '%H:%i') AS ora_sfarsit, stare
             FROM rezervari WHERE id = ? FOR UPDATE`,
            [id]
        );
        if (!rezervare) {
            await conn.rollback();
            return { negasita: true };
        }
        if (rezervare.stare !== 'în așteptare') {
            await conn.rollback();
            return { dejaProcesata: rezervare.stare };
        }

        if (stareNoua === 'aprobată') {
            await conn.query('SELECT id FROM laboratoare WHERE id = ? FOR UPDATE', [rezervare.laborator_id]);
            const conflict = await findSuprapunere(conn, {
                laboratorId: rezervare.laborator_id,
                data: rezervare.data_rezervare,
                oraInceput: rezervare.ora_inceput,
                oraSfarsit: rezervare.ora_sfarsit,
                stari: ['aprobată'],
                exceptId: id
            });
            if (conflict) {
                await conn.rollback();
                return { conflict };
            }
        }

        await conn.query(
            'UPDATE rezervari SET stare = ?, motiv_respingere = ? WHERE id = ?',
            [stareNoua, stareNoua === 'respinsă' ? motiv : null, id]
        );
        await conn.commit();
        return { ok: true };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

async function remove(id) {
    const [result] = await getPool().query('DELETE FROM rezervari WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

module.exports = { STARI_ACTIVE, findAll, findById, findOcupate, findSuprapunere, createFaraSuprapunere, decide, remove };
