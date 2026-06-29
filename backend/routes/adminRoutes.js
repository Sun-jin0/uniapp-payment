const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth, adminAuth } = require('../middleware/auth');
const { paginationValidation, idValidation } = require('../middleware/validation');

// 用户管理
router.get('/users', auth, adminAuth, paginationValidation, adminController.getUsers);
router.post('/users', auth, adminAuth, adminController.createUser);
router.get('/users/:id/stats', auth, adminAuth, adminController.getUserStats);
router.get('/users/:id/redeemed-videos', auth, adminAuth, adminController.getUserRedeemedVideos);
router.put('/users/:id/status', auth, adminAuth, adminController.updateUserStatus);
router.put('/users/:id', auth, adminAuth, adminController.updateUser);

// 题目管理
router.get('/questions', auth, adminAuth, paginationValidation, adminController.getQuestions);
router.post('/questions', auth, adminAuth, adminController.createQuestion);
router.put('/questions/:id', auth, adminAuth, adminController.updateQuestion);
router.delete('/questions/:id', auth, adminAuth, adminController.deleteQuestion);

// 试卷管理
router.get('/exams', auth, adminAuth, paginationValidation, adminController.getExams);
router.post('/exams', auth, adminAuth, adminController.createExam);
router.put('/exams/:id', auth, adminAuth, adminController.updateExam);
router.delete('/exams/:id', auth, adminAuth, adminController.deleteExam);

// 轮播图管理
router.get('/banners', auth, adminAuth, paginationValidation, adminController.getBanners);
router.post('/banners', auth, adminAuth, adminController.createBanner);
router.put('/banners/:id', auth, adminAuth, adminController.updateBanner);
router.delete('/banners/:id', auth, adminAuth, adminController.deleteBanner);
router.put('/banners/:id/status', auth, adminAuth, adminController.updateBannerStatus);

// 系统配置管理
const appConfigController = require('../controllers/appConfigController');
router.get('/configs', auth, adminAuth, appConfigController.getAdminConfigs);
router.post('/configs', auth, adminAuth, appConfigController.updateConfig);

// 公告管理
router.get('/notices', auth, adminAuth, paginationValidation, adminController.getNotices);
router.get('/notices/categories', auth, adminAuth, adminController.getNoticeCategories);
router.post('/notices/categories', auth, adminAuth, adminController.createCategory);
router.put('/notices/categories/:id', auth, adminAuth, adminController.updateCategory);
router.delete('/notices/categories/:id', auth, adminAuth, adminController.deleteCategory);
router.get('/notices/:id', auth, adminAuth, adminController.getNoticeById);
router.post('/notices', auth, adminAuth, adminController.createNotice);
router.put('/notices/:id', auth, adminAuth, adminController.updateNotice);
router.put('/notices/:id/status', auth, adminAuth, adminController.updateNoticeStatus);
router.delete('/notices/:id', auth, adminAuth, adminController.deleteNotice);
router.post('/articles/parse-link', auth, adminAuth, adminController.parseArticleLink);

// 考试类型管理
router.get('/exam-types', auth, adminAuth, paginationValidation, adminController.getExamTypes);
router.post('/exam-types', auth, adminAuth, adminController.createExamType);
router.put('/exam-types/:id', auth, adminAuth, adminController.updateExamType);
router.delete('/exam-types/:id', auth, adminAuth, adminController.deleteExamType);

// 科目管理
router.get('/subjects', auth, adminAuth, paginationValidation, adminController.getSubjects);
router.post('/subjects', auth, adminAuth, adminController.createSubject);
router.put('/subjects/:id', auth, adminAuth, adminController.updateSubject);
router.delete('/subjects/:id', auth, adminAuth, adminController.deleteSubject);

// 练习页面导航管理 (MySQL)
const navManagementController = require('../controllers/navManagementController');
const medAdminController = require('../controllers/medAdminController');
const panResourceController = require('../controllers/panResourceController');

router.get('/med/files', auth, adminAuth, medAdminController.getMedFiles);
router.post('/med/import', auth, adminAuth, medAdminController.importMedFile);

// AI 代码格式化
router.post('/ai/format-code', auth, adminAuth, adminController.aiFormatCode);

// 网盘资源管理
router.get('/pan-resources', auth, adminAuth, panResourceController.getPanResources);
router.post('/pan-resources', auth, adminAuth, panResourceController.createPanResource);
router.put('/pan-resources/:id', auth, adminAuth, panResourceController.updatePanResource);
router.delete('/pan-resources/:id', auth, adminAuth, panResourceController.deletePanResource);
router.post('/pan-resources/parse', auth, adminAuth, panResourceController.parsePanResources);
router.post('/pan-resources/import', auth, adminAuth, panResourceController.importPanResources);
router.post('/pan-resources/batch-delete', auth, adminAuth, panResourceController.batchDeletePanResources);
router.post('/pan-resources/batch-update', auth, adminAuth, panResourceController.batchUpdatePanResources);
router.post('/pan-resources/batch-update-category', auth, adminAuth, panResourceController.batchUpdatePanResourcesCategory);
router.put('/pan-resources/:id/top', auth, adminAuth, panResourceController.updatePanResourceTop);
router.put('/pan-resources/:id/sort', auth, adminAuth, panResourceController.updatePanResourceSort);

// 网盘分类管理
router.get('/pan-categories', auth, adminAuth, panResourceController.getPanCategories);
router.post('/pan-categories', auth, adminAuth, panResourceController.createPanCategory);
router.put('/pan-categories/:id', auth, adminAuth, panResourceController.updatePanCategory);
router.delete('/pan-categories/:id', auth, adminAuth, panResourceController.deletePanCategory);

router.get('/nav-subjects', auth, adminAuth, navManagementController.getNavSubjects);
router.post('/nav-subjects', auth, adminAuth, navManagementController.createNavSubject);
router.put('/nav-subjects/:id', auth, adminAuth, navManagementController.updateNavSubject);
router.delete('/nav-subjects/:id', auth, adminAuth, navManagementController.deleteNavSubject);

router.get('/nav-categories', auth, adminAuth, navManagementController.getNavCategories);
router.post('/nav-categories', auth, adminAuth, navManagementController.createNavCategory);
router.put('/nav-categories/:id', auth, adminAuth, navManagementController.updateNavCategory);
router.delete('/nav-categories/:id', auth, adminAuth, navManagementController.deleteNavCategory);

// 公共题库类目管理
router.post('/public-categories', auth, adminAuth, navManagementController.createPublicCategory);
router.put('/public-categories/:id', auth, adminAuth, navManagementController.updatePublicCategory);
router.delete('/public-categories/:id', auth, adminAuth, navManagementController.deletePublicCategory);

// 章节管理
router.get('/chapters', auth, adminAuth, paginationValidation, adminController.getChapters);
router.post('/chapters', auth, adminAuth, adminController.createChapter);
router.put('/chapters/:id', auth, adminAuth, adminController.updateChapter);
router.delete('/chapters/:id', auth, adminAuth, adminController.deleteChapter);

// 统计信息
router.get('/stats', auth, adminAuth, adminController.getStats);

module.exports = router;
