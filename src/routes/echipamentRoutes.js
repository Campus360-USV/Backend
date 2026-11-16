const express = require('express');
const controller = require('../controllers/echipamentController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Rutele doar leagă URL-ul + metoda HTTP de funcția din controller.
const router = express.Router();

// Citire: oricine
router.get('/', controller.getAll);
router.get('/:id', controller.getById);

// Administrare: doar admin (KAN-26)
router.post('/', requireAuth, requireRole('admin'), controller.create);
router.put('/:id', requireAuth, requireRole('admin'), controller.update);
router.delete('/:id', requireAuth, requireRole('admin'), controller.remove);

module.exports = router;
