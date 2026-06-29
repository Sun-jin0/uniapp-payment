const express = require('express');
const router = express.Router();
const studyController = require('../controllers/studyController');
const { auth } = require('../middleware/auth');
const { idValidation, paginationValidation, questionIdValidation } = require('../middleware/validation');

router.get('/wrong-questions', auth, paginationValidation, studyController.getWrongQuestions);
router.delete('/wrong-questions/:id', auth, idValidation, studyController.deleteWrongQuestion);
router.get('/favorites', auth, paginationValidation, studyController.getFavorites);
router.post('/favorites', auth, questionIdValidation, studyController.addFavorite);
router.delete('/favorites/:id', auth, idValidation, studyController.deleteFavorite);
router.get('/study/stats', auth, studyController.getStudyStats);
router.get('/study/leaderboard', auth, studyController.getLeaderboard);
router.get('/study/participate-ranking', auth, studyController.getParticipateRanking);
router.put('/study/participate-ranking', auth, studyController.updateParticipateRanking);
router.get('/study/recent', auth, studyController.getRecentLearning);
router.get('/study/history', auth, studyController.getStudyHistory);
router.get('/study/overview', auth, studyController.getHomeOverview);

module.exports = router;
