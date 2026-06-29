const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { auth, adminAuth } = require('../middleware/auth');
const { idValidation, paginationValidation } = require('../middleware/validation');

router.post('/', auth, feedbackController.submitFeedback);
router.post('/question', auth, feedbackController.submitQuestionFeedback);
router.get('/', adminAuth, paginationValidation, feedbackController.getFeedbacks);
router.put('/:id/status', adminAuth, idValidation, feedbackController.updateFeedbackStatus);

module.exports = router;
