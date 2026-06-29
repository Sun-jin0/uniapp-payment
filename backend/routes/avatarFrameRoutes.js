const express = require('express');
const router = express.Router();
const avatarFrameController = require('../controllers/avatarFrameController');
const { auth, adminAuth } = require('../middleware/auth');

// 公开接口 - 获取用户可用的头像框
router.get('/user/avatar-frames', auth, avatarFrameController.getUserAvatarFrames);

// 用户设置自己的头像框
router.put('/user/avatar-frame', auth, avatarFrameController.setUserAvatarFrame);

// 管理员接口
router.get('/admin/avatar-frames', adminAuth, avatarFrameController.getAvatarFrames);
router.get('/admin/avatar-frames/:id', adminAuth, avatarFrameController.getAvatarFrame);
router.post('/admin/avatar-frames', adminAuth, avatarFrameController.createAvatarFrame);
router.put('/admin/avatar-frames/:id', adminAuth, avatarFrameController.updateAvatarFrame);
router.delete('/admin/avatar-frames/:id', adminAuth, avatarFrameController.deleteAvatarFrame);
router.put('/admin/avatar-frames/batch-status', adminAuth, avatarFrameController.batchUpdateAvatarFrameStatus);

module.exports = router;
