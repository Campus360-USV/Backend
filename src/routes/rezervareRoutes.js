const express = require('express');
const controller = require('../controllers/rezervareController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public: intervalele ocupate pentru calendar (KAN-17). Trebuie înainte de '/:id'.
router.get('/ocupate', controller.getOcupate);

// Utilizator autentificat
router.get('/', requireAuth, controller.getAll);
router.get('/:id', requireAuth, controller.getById);
// Doar studenții și profesorii fac rezervări; adminul doar le aprobă/respinge
router.post('/', requireAuth, requireRole('student', 'profesor'), controller.create);
router.delete('/:id', requireAuth, controller.remove);

module.exports = router;
