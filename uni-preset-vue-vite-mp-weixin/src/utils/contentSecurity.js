/**
 * 内容安全检测工具
 * 通过后端 API 调用微信内容安全接口
 */

import request from '@/api/request.js';

/**
 * 检测文本内容是否违规
 * @param {string} content - 要检测的文本内容
 * @param {number} scene - 场景（1资料 2评论 3论坛 4社交日志）
 * @returns {Promise<{isSafe: boolean, message: string}>}
 */
export const checkTextContent = async (content, scene = 2) => {
  if (!content || content.trim().length === 0) {
    return { isSafe: true, message: '内容为空' };
  }
  
  try {
    const res = await request.post('/security/check-text', {
      content: content,
      scene: scene
    });
    
    if (res.code === 0) {
      return res.data;
    } else {
      console.error('文本检测失败:', res.message);
      // 检测失败时默认放行
      return { isSafe: true, message: '检测服务暂时不可用' };
    }
  } catch (error) {
    console.error('文本检测请求错误:', error);
    // 出错时默认放行
    return { isSafe: true, message: '检测出错' };
  }
};

/**
 * 检测单张图片内容是否违规
 * @param {string} imagePath - 图片本地路径
 * @returns {Promise<{isSafe: boolean, message: string}>}
 */
export const checkImageContent = async (imagePath) => {
  if (!imagePath) {
    return { isSafe: true, message: '图片路径为空' };
  }
  
  try {
    // 上传图片到后端进行检测
    const uploadRes = await uni.uploadFile({
      url: request.BASE_URL + '/security/check-image',
      filePath: imagePath,
      name: 'image',
      header: {
        'Authorization': uni.getStorageSync('token') || ''
      }
    });
    
    const data = JSON.parse(uploadRes.data);
    
    if (data.code === 0) {
      return data.data;
    } else {
      console.error('图片检测失败:', data.message);
      return { isSafe: true, message: '检测服务暂时不可用' };
    }
  } catch (error) {
    console.error('图片检测请求错误:', error);
    return { isSafe: true, message: '检测出错' };
  }
};

/**
 * 批量检测多张图片
 * @param {string[]} imagePaths - 图片路径数组
 * @returns {Promise<{isSafe: boolean, message: string, unsafeImages: number[]}>}
 */
export const checkMultipleImages = async (imagePaths) => {
  if (!imagePaths || imagePaths.length === 0) {
    return { isSafe: true, message: '没有图片需要检测', unsafeImages: [] };
  }
  
  const unsafeImages = [];
  
  for (let i = 0; i < imagePaths.length; i++) {
    const result = await checkImageContent(imagePaths[i]);
    if (!result.isSafe) {
      unsafeImages.push(i);
    }
  }
  
  if (unsafeImages.length > 0) {
    return {
      isSafe: false,
      message: `第 ${unsafeImages.map(i => i + 1).join('、')} 张图片含有违规内容，请更换后重试`,
      unsafeImages
    };
  }
  
  return { isSafe: true, message: '所有图片正常', unsafeImages: [] };
};

/**
 * 检测用户发布的内容（文本+图片）
 * @param {Object} options - 检测选项
 * @param {string} options.text - 文本内容
 * @param {string[]} options.images - 图片路径数组
 * @param {number} options.scene - 场景值
 * @returns {Promise<{isSafe: boolean, message: string}>}
 */
export const checkUserContent = async (options = {}) => {
  const { text = '', images = [], scene = 2 } = options;
  
  // 先检测文本
  if (text && text.trim()) {
    const textResult = await checkTextContent(text, scene);
    if (!textResult.isSafe) {
      return textResult;
    }
  }
  
  // 再检测图片
  if (images && images.length > 0) {
    const imageResult = await checkMultipleImages(images);
    if (!imageResult.isSafe) {
      return imageResult;
    }
  }
  
  return { isSafe: true, message: '内容检测通过' };
};

export default {
  checkTextContent,
  checkImageContent,
  checkMultipleImages,
  checkUserContent
};
