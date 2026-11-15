const express = require('express');
const controller = require('../controllers/echipamentController');

// Rutele doar leagă URL-ul + metoda HTTP de funcția din controller.
const router = express.Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
