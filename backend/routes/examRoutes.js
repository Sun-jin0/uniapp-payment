const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { auth } = require('../middleware/auth');
const { paginationValidation, idValidation } = require('../middleware/validation');

router.get('/questions', auth, paginationValidation, examController.getQuestions);
router.get('/questions/:id', auth, idValidation, examController.getQuestionById);
router.post('/practice/submit', auth, examController.submitPractice);
router.post('/exam/submit', auth, examController.submitExam);
router.get('/exam/result', auth, examController.getExamResult);

module.exports = router;
