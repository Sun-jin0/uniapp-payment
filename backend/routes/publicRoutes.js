const express = require('express');
const router = express.Router();
const appConfigController = require('../controllers/appConfigController');
const publicController = require('../controllers/publicController');
const panResourceController = require('../controllers/panResourceController');
const { auth, adminAuth } = require('../middleware/auth');

// Pan Resource routes
router.get('/pan-resources', panResourceController.getPanResources);
router.get('/pan-resources/categories', panResourceController.getPanCategories);
router.post('/pan-resources/sync', panResourceController.syncPanResources);

// Admin Resource Management routes
router.get('/admin/pan-resources', adminAuth, panResourceController.adminGetResources);
router.post('/admin/pan-resources/add', adminAuth, panResourceController.adminAddResource);
router.post('/admin/pan-resources/update', adminAuth, panResourceController.adminUpdateResource);
router.post('/admin/pan-resources/delete', adminAuth, panResourceController.adminDeleteResource);
router.post('/admin/pan-resources/categories/add', adminAuth, panResourceController.createPanCategory);
router.post('/admin/pan-resources/categories/update/:id', adminAuth, panResourceController.updatePanCategory);
router.post('/admin/pan-resources/categories/delete/:id', adminAuth, panResourceController.deletePanCategory);

// Feedback routes
router.post('/question-bank/feedback', auth, publicController.submitFeedback);

// Admin Management routes
router.get('/admin/question-bank/feedbacks', adminAuth, publicController.adminGetFeedbacks);
router.post('/admin/question-bank/feedbacks/status', adminAuth, publicController.adminUpdateFeedbackStatus);
router.get('/admin/question-bank/books', adminAuth, publicController.adminGetBooks);
router.post('/admin/question-bank/books/add', adminAuth, publicController.adminAddBook);
router.post('/admin/question-bank/books/update', adminAuth, publicController.adminUpdateBook);
router.post('/admin/question-bank/books/delete', adminAuth, publicController.adminDeleteBook);
router.post('/admin/question-bank/books/toggle-status', adminAuth, publicController.adminToggleBookStatus);

// 章节管理
router.get('/admin/question-bank/chapters', adminAuth, publicController.adminGetChapters);
router.post('/admin/question-bank/chapters/add', adminAuth, publicController.adminAddChapter);
router.post('/admin/question-bank/chapters/update', adminAuth, publicController.adminUpdateChapter);
router.post('/admin/question-bank/chapters/delete', adminAuth, publicController.adminDeleteChapter);

// 分类管理
router.get('/admin/question-bank/categories', adminAuth, publicController.adminGetCategories);
router.post('/admin/question-bank/categories/add', adminAuth, publicController.adminAddCategory);
router.post('/admin/question-bank/categories/update', adminAuth, publicController.adminUpdateCategory);
router.post('/admin/question-bank/categories/delete', adminAuth, publicController.adminDeleteCategory);

router.get('/admin/question-bank/questions/search', adminAuth, publicController.adminSearchQuestions);
router.get('/admin/question-bank/questions/:id', adminAuth, publicController.adminGetQuestionDetail);
router.post('/admin/question-bank/questions/update', adminAuth, publicController.adminUpdateQuestion);
router.post('/admin/question-bank/questions/add', adminAuth, publicController.adminAddQuestion);
router.post('/admin/question-bank/questions/delete', adminAuth, publicController.adminDeleteQuestion);

// Banner routes
router.get('/banners', publicController.getBanners);

// Notice routes
router.get('/notices', publicController.getNotices);
router.get('/notices/:id', publicController.getNoticeById);
router.post('/notices/:id/view', publicController.incrementNoticeViewCount);

// Exam and Subject routes
router.get('/exams', publicController.getExams);
router.get('/subjects', publicController.getSubjects);
router.get('/exam-types', publicController.getExamTypes);

// Public Question Bank routes
router.get('/question-bank/categories', publicController.getCategories);
router.get('/question-bank/books', publicController.getBooks);
router.get('/question-bank/questions', auth, publicController.getQuestions);
router.post('/question-bank/submit-answer', auth, publicController.submitAnswer);
router.post('/question-bank/toggle-favorite', auth, publicController.toggleFavorite);
router.post('/question-bank/update-progress', auth, publicController.updatePracticeProgress);
router.post('/question-bank/clear-record', auth, publicController.clearPracticeRecord);
router.get('/question-bank/related-articles', publicController.getRelatedArticles);
router.get('/question-bank/notes', auth, publicController.getQuestionNotes);
router.get('/question-bank/notes/replies', auth, publicController.getNoteReplies);
router.post('/question-bank/notes', auth, publicController.addQuestionNote);
router.put('/question-bank/notes', auth, publicController.updateQuestionNote);
router.delete('/question-bank/notes', auth, publicController.deleteQuestionNote);
router.post('/question-bank/notes/toggle-like', auth, publicController.toggleNoteLike);
router.post('/question-bank/import', publicController.importData);
router.post('/question-bank/preview-import', publicController.previewImport);
router.post('/question-bank/structure', publicController.structureBook);
router.get('/question-bank/chapters', publicController.getBookChapters);
router.get('/question-bank/book-types', publicController.getBookTypes);

// Public config route
router.get('/config/countdown', appConfigController.getPublicConfig);

module.exports = router;
