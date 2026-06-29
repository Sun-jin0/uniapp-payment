const express = require('express');
const router = express.Router();
const politicsController = require('../controllers/politicsController');
const { auth, adminAuth } = require('../middleware/auth');

// 公共接口
router.get('/politics/sections', politicsController.getSections);

// 管理员接口
router.get('/admin/politics/sections', auth, adminAuth, politicsController.adminGetSections);
router.post('/admin/politics/sections', auth, adminAuth, politicsController.adminCreateSection);
router.put('/admin/politics/sections/:id', auth, adminAuth, politicsController.adminUpdateSection);
router.delete('/admin/politics/sections/:id', auth, adminAuth, politicsController.adminDeleteSection);

// 分类关联书籍
router.get('/politics/sections/:sectionId/books', politicsController.getSectionBooks);
router.get('/admin/politics/sections/:sectionId/books', auth, adminAuth, politicsController.getSectionBooks);
router.post('/admin/politics/sections/:sectionId/books', auth, adminAuth, politicsController.adminAddBookToSection);
router.delete('/admin/politics/sections/:sectionId/books/:bookId', auth, adminAuth, politicsController.adminRemoveBookFromSection);

module.exports = router;
