const express = require('express');
const controller = require('../controllers/laboratorController');
const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Citire: oricine (KAN-11)
router.get('/', controller.getAll);
router.get('/:id', optionalAuth, controller.getById); // KAN-13: echipamentele speciale doar pentru profesor/admin

// Administrare: doar admin (KAN-26)
router.post('/', requireAuth, requireRole('admin'), controller.create);
router.put('/:id', requireAuth, requireRole('admin'), controller.update);
router.delete('/:id', requireAuth, requireRole('admin'), controller.remove);

module.exports = router;
