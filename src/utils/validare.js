// Funcții de validare folosite de mai multe controllere.

// Transformă un parametru (din URL sau body) într-un id valid.
// Întoarce numărul, sau null dacă nu e un întreg pozitiv.
function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

module.exports = { parseId };
