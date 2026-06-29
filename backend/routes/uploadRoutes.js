const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const upload = require('../middleware/upload');
const { adminAuth } = require('../middleware/auth');

// 上传图片 - 支持 'image' 和 'file' 两个字段名
router.post('/upload/image', (req, res, next) => {
  // 尝试使用 'image' 字段
  upload.single('image')(req, res, (err) => {
    if (err && err.message && err.message.includes('Unexpected field')) {
      // 如果失败，尝试使用 'file' 字段
      upload.single('file')(req, res, next);
    } else {
      next(err);
    }
  });
}, uploadController.uploadImage);

// 获取统计信息（管理员）- 必须放在 /:id 路由之前
router.get('/admin/images/stats', adminAuth, uploadController.getStats);

// 获取图片列表（管理员）
router.get('/admin/images', adminAuth, uploadController.getImageList);

// 获取图片详情（管理员）
router.get('/admin/images/:id', adminAuth, uploadController.getImageDetail);

// 删除图片（管理员）
router.delete('/admin/images/:id', adminAuth, uploadController.deleteImage);

// 批量删除图片（管理员）
router.post('/admin/images/batch-delete', adminAuth, uploadController.batchDeleteImages);

// 替换图片（管理员）
router.post('/admin/images/:id/replace', adminAuth, upload.single('image'), uploadController.replaceImage);

// 扫描所有数据表中的图片链接（管理员）
router.get('/upload/admin/scan-all-images', adminAuth, uploadController.scanAllImages);

module.exports = router;
