const express = require('express');
const controller = require('../controllers/rezervareController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Public: intervalele ocupate pentru calendar (KAN-17). Trebuie înainte de '/:id'.
router.get('/ocupate', controller.getOcupate);

// Utilizator autentificat
router.get('/', requireAuth, controller.getAll);
router.get('/:id', requireAuth, controller.getById);
router.post('/', requireAuth, controller.create);
router.delete('/:id', requireAuth, controller.remove);

module.exports = router;
