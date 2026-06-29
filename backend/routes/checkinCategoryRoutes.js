const express = require('express');
const router = express.Router();
const checkinCategoryController = require('../controllers/checkinCategoryController');
const { auth } = require('../middleware/auth');

// 公开接口
router.get('/categories', checkinCategoryController.getCategories);
router.get('/categories/:id', checkinCategoryController.getCategoryDetail);
router.get('/categories/:categoryId/dynamics', checkinCategoryController.getDynamics);

// 需要登录的接口
router.get('/categories/:categoryId/my-records', auth, checkinCategoryController.getMyRecords);
router.post('/records', auth, checkinCategoryController.createRecord);
router.put('/records/:id', auth, checkinCategoryController.updateRecord);
router.delete('/records/:id', auth, checkinCategoryController.deleteRecord);

// 预报名
router.post('/categories/:categoryId/pre-register', auth, checkinCategoryController.preRegister);

// 管理员接口 - 类别管理
router.post('/categories', auth, checkinCategoryController.createCategory);
router.put('/categories/:id', auth, checkinCategoryController.updateCategory);
router.delete('/categories/:id', auth, checkinCategoryController.deleteCategory);

// 管理员接口 - 记录和评论管理
router.get('/admin/categories', auth, checkinCategoryController.adminGetCategories);
router.get('/admin/records', auth, checkinCategoryController.adminGetRecords);
router.get('/admin/comments', auth, checkinCategoryController.adminGetComments);
router.delete('/admin/records/:id', auth, checkinCategoryController.adminDeleteRecord);
router.delete('/admin/comments/:commentId', auth, checkinCategoryController.adminDeleteComment);

// 管理员接口 - 预报名和用户记录
router.get('/admin/categories/:categoryId/pre-registers', auth, checkinCategoryController.getPreRegisters);
router.get('/admin/categories/:categoryId/users/:targetUserId/records', auth, checkinCategoryController.getUserRecordsByCategory);
router.get('/admin/export', auth, checkinCategoryController.exportRecords);

// 点赞
router.post('/records/:recordId/like', auth, checkinCategoryController.toggleLike);

// 评论
router.get('/records/:recordId/comments', checkinCategoryController.getComments);
router.post('/records/:recordId/comments', auth, checkinCategoryController.createComment);
router.put('/comments/:commentId', auth, checkinCategoryController.updateComment);
router.delete('/comments/:commentId', auth, checkinCategoryController.deleteComment);

module.exports = router;
