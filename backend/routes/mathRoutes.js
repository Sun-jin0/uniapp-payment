const express = require('express');
const router = express.Router();
const mathController = require('../controllers/mathController');
const { auth } = require('../middleware/auth');

router.get('/math/subjects', mathController.getSubjects);
router.get('/math/books/all', mathController.getAllBooks);
router.get('/math/books-by-subject', mathController.getBooksBySubject);
router.get('/math/book-details', mathController.getBookDetails);
router.get('/math/book-preview-with-text', mathController.getBookPreview);
router.get('/math/books/:bookId', mathController.getBookDetails);
router.post('/math/books/:bookId/increment-learner', mathController.incrementLearnerCount);
router.get('/math/books/:bookId/preview', mathController.getBookPreview);
router.get('/math/books/:bookId/full', mathController.getFullQuestionsByBook);
router.get('/math/books/:bookId/questions', mathController.getQuestionsByBook);
router.get('/math/book-chapters/:bookId', mathController.getBookChapters);
router.get('/math/book-questions/:bookId/:chapterName', mathController.getBookQuestionsByChapter);
router.get('/math/single-question-data', mathController.getQuestionDetails);
router.get('/math/batch-question-data', mathController.getBatchQuestionDetails);
router.post('/math/questions/batch', mathController.getQuestionsBatch);

// 考点刷题相关（简化版）- 必须放在 /math/questions/:questionId 之前
router.get('/math/knowledge-categories', mathController.getKnowledgeCategories);
router.get('/math/knowledge-point-level4', mathController.getKnowledgePointLevel4);
router.get('/math/questions/count-by-knowledge-point', mathController.getQuestionCountByKnowledgePoint);
router.get('/math/questions/by-knowledge-point', mathController.getQuestionsByKnowledgePoint);

router.get('/math/questions/:questionId', mathController.getQuestionDetails);
router.get('/math/user-progress', auth, mathController.getUserProgress);
router.post('/math/update-progress', auth, mathController.updateProgress);
router.get('/math/get-all-new-count', mathController.getNewCount);
router.get('/math/new-count', mathController.getNewCount);

// 收藏夹相关
router.post('/math/favorites/toggle', auth, mathController.toggleFavorite);
router.get('/math/favorites', auth, mathController.getFavorites);
router.get('/math/favorites/check', auth, mathController.checkFavorite);

// 收藏分类相关
router.get('/math/favorite-categories', auth, mathController.getFavoriteCategories);
router.post('/math/favorite-categories', auth, mathController.createFavoriteCategory);
router.delete('/math/favorite-categories/:categoryId', auth, mathController.deleteFavoriteCategory);

// 书架管理
router.get('/math/bookshelf', auth, mathController.getUserBookshelf);
router.post('/math/bookshelf/add', auth, mathController.addToBookshelf);
router.post('/math/bookshelf/batch-add', auth, mathController.batchAddToBookshelf);
router.post('/math/bookshelf/remove', auth, mathController.removeFromBookshelf);

// 智能组卷相关
router.get('/math/paper-permission', auth, mathController.getUserPaperPermission);
router.get('/math/print-permission', auth, mathController.getUserPrintPermission);
router.post('/math/generate-print-link', auth, mathController.generatePrintLink);
router.get('/math/verify-print-link', mathController.verifyPrintLink);
router.post('/math/paper/:paperId/share-code', auth, mathController.getOrGeneratePaperCode);
router.get('/math/paper-by-code/:code', mathController.getPaperByCode);
router.post('/math/claim-paper/:code', auth, mathController.claimPaperByCode);
router.post('/math/smart-paper/generate', auth, mathController.generateSmartPaper);
router.get('/math/smart-papers', auth, mathController.getUserGeneratedPapers);
router.get('/math/smart-paper/:paperId', auth, mathController.getGeneratedPaper);
router.get('/math/smart-paper/:paperId/print', mathController.getPrintPaper);
router.put('/math/smart-paper/:paperId/title', auth, mathController.updatePaperTitle);
router.delete('/math/smart-paper/:paperId', auth, mathController.deleteGeneratedPaper);
router.post('/math/smart-paper/:paperId/replace-question', auth, mathController.replacePaperQuestion);
router.put('/math/smart-paper/:paperId/reorder', auth, mathController.reorderPaperQuestions);
router.put('/math/questions/:id/kps', mathController.updateQuestionKps);

// 纠错反馈
router.post('/math/corrections', mathController.submitCorrection);

// 相关题目
router.get('/math/related-questions/:questionId', mathController.getRelatedQuestions);

// 考点分类管理
router.get('/admin/math/knowledge-categories', mathController.getAdminKnowledgeCategories);
router.put('/admin/math/knowledge-categories/:id', mathController.updateKnowledgeCategory);
router.post('/admin/math/knowledge-categories', mathController.createKnowledgeCategory);
router.delete('/admin/math/knowledge-categories/:id', mathController.deleteKnowledgeCategory);

module.exports = router;
