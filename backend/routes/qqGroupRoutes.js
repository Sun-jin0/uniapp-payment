const express = require('express');
const router = express.Router();
const qqGroupController = require('../controllers/qqGroupController');
const { auth, adminAuth } = require('../middleware/auth');

// 公开接口 - 获取Q群列表
router.get('/list', qqGroupController.getQQGroups);

// 获取机构列表
router.get('/organizations', qqGroupController.getOrganizations);

// 用户置顶/取消置顶
router.post('/toggle-pin', auth, qqGroupController.togglePin);

// 管理员接口
router.get('/admin/list', adminAuth, qqGroupController.adminGetQQGroups);
router.get('/admin/:id', adminAuth, qqGroupController.getQQGroup);
router.post('/admin', adminAuth, qqGroupController.createQQGroup);
router.put('/admin/:id', adminAuth, qqGroupController.updateQQGroup);
router.delete('/admin/:id', adminAuth, qqGroupController.deleteQQGroup);

module.exports = router;
