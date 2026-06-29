const express = require('express');
const router = express.Router();
const essayController = require('../controllers/essayController');
const { auth } = require('../middleware/auth');
const { paginationValidation } = require('../middleware/validation');

router.post('/correct', auth, essayController.submitEssay);
router.get('/records', auth, paginationValidation, essayController.getEssayRecords);

module.exports = router;
