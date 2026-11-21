const express = require('express');
const controller = require('../controllers/rezervareController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public: intervalele ocupate pentru calendar (KAN-17). Trebuie înainte de '/:id'.
router.get('/ocupate', controller.getOcupate);

// Utilizator autentificat
router.get('/', requireAuth, controller.getAll);
router.get('/:id', requireAuth, controller.getById);
router.post('/', requireAuth, controller.create);
router.delete('/:id', requireAuth, controller.remove);

// Doar admin: decizia asupra cererilor (KAN-24, KAN-25)
router.put('/:id/aproba', requireAuth, requireRole('admin'), controller.aproba);
router.put('/:id/respinge', requireAuth, requireRole('admin'), controller.respinge);

module.exports = router;
