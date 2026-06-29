const express = require('express');
const router = express.Router();
const { checkTextContent, checkImageContent } = require('../utils/contentSecurity');
const { successResponse, errorResponse } = require('../utils/response');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'security-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制5MB
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

/**
 * POST /api/security/check-text
 * 检测文本内容
 * 需要登录
 */
router.post('/check-text', auth, async (req, res) => {
  try {
    const { content, scene = 2 } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.json(successResponse({ isSafe: true, message: '内容为空' }));
    }
    
    const userId = req.userId;
    // 这里可以从数据库获取用户的openid
    const openid = req.body.openid || '';
    
    const result = await checkTextContent(content, openid, scene);
    
    res.json(successResponse(result));
  } catch (error) {
    console.error('文本检测接口错误:', error);
    res.status(500).json(errorResponse('检测服务暂时不可用'));
  }
});

/**
 * POST /api/security/check-image
 * 检测图片内容
 * 需要登录
 */
router.post('/check-image', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('请上传图片'));
    }
    
    const imagePath = req.file.path;
    
    const result = await checkImageContent(imagePath);
    
    // 删除临时文件
    try {
      fs.unlinkSync(imagePath);
    } catch (err) {
      console.error('删除临时文件失败:', err);
    }
    
    res.json(successResponse(result));
  } catch (error) {
    console.error('图片检测接口错误:', error);
    res.status(500).json(errorResponse('检测服务暂时不可用'));
  }
});

/**
 * POST /api/security/check-content
 * 同时检测文本和图片
 * 需要登录
 */
router.post('/check-content', auth, upload.array('images', 9), async (req, res) => {
  try {
    const { content, scene = 2 } = req.body;
    const openid = req.body.openid || '';
    const images = req.files || [];
    
    // 检测文本
    let textResult = { isSafe: true, message: '内容为空' };
    if (content && content.trim()) {
      textResult = await checkTextContent(content, openid, scene);
    }
    
    if (!textResult.isSafe) {
      // 删除所有临时文件
      images.forEach(img => {
        try {
          fs.unlinkSync(img.path);
        } catch (err) {}
      });
      return res.json(successResponse(textResult));
    }
    
    // 检测图片
    const imageResults = [];
    for (const image of images) {
      const result = await checkImageContent(image.path);
      imageResults.push(result);
      
      // 删除临时文件
      try {
        fs.unlinkSync(image.path);
      } catch (err) {}
      
      if (!result.isSafe) {
        return res.json(successResponse({
          isSafe: false,
          message: result.message,
          textResult,
          imageResults
        }));
      }
    }
    
    res.json(successResponse({
      isSafe: true,
      message: '所有内容检测通过',
      textResult,
      imageResults
    }));
  } catch (error) {
    console.error('内容检测接口错误:', error);
    // 删除所有临时文件
    if (req.files) {
      req.files.forEach(img => {
        try {
          fs.unlinkSync(img.path);
        } catch (err) {}
      });
    }
    res.status(500).json(errorResponse('检测服务暂时不可用'));
  }
});

module.exports = router;
