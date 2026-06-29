/**
 * 内容安全检测工具
 * 使用微信小程序官方内容安全接口
 * 必须在服务器端调用
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// 小程序配置（从环境变量读取）
const APPID = process.env.WX_APP_ID || '';
const SECRET = process.env.WX_APP_SECRET || '';

let accessToken = '';
let tokenExpireTime = 0;

/**
 * 获取小程序 access_token
 */
const getAccessToken = async () => {
  // 如果 token 未过期，直接返回
  if (accessToken && Date.now() < tokenExpireTime) {
    return accessToken;
  }
  
  if (!APPID || !SECRET) {
    console.error('未配置小程序 APPID 或 SECRET');
    throw new Error('未配置小程序信息');
  }
  
  try {
    const response = await axios.get(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${SECRET}`
    );
    
    if (response.data && response.data.access_token) {
      accessToken = response.data.access_token;
      // token 有效期 7200 秒，提前 300 秒刷新
      tokenExpireTime = Date.now() + (response.data.expires_in - 300) * 1000;
      console.log('获取 access_token 成功');
      return accessToken;
    } else {
      console.error('获取 access_token 失败:', response.data);
      throw new Error('获取 access_token 失败: ' + (response.data.errmsg || '未知错误'));
    }
  } catch (error) {
    console.error('获取 access_token 错误:', error.message);
    throw error;
  }
};

/**
 * 检测文本内容是否违规
 * @param {string} content - 要检测的文本内容
 * @param {string} openid - 用户openid（可选，版本2需要）
 * @param {number} scene - 场景（1资料 2评论 3论坛 4社交日志）
 * @returns {Promise<{isSafe: boolean, message: string, detail: object}>}
 */
const checkTextContent = async (content, openid = '', scene = 2) => {
  if (!content || content.trim().length === 0) {
    return { isSafe: true, message: '内容为空' };
  }
  
  // 限制文本长度（微信接口限制2500字）
  if (content.length > 2500) {
    content = content.substring(0, 2500);
  }
  
  try {
    const token = await getAccessToken();
    
    // 使用版本1接口（不需要openid）
    const response = await axios.post(
      `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${token}`,
      {
        content: content
        // 版本1不需要 version, scene, openid 参数
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    const result = response.data;
    
    // errcode: 0-正常，87014-内容含有违法违规内容
    if (result.errcode === 0) {
      return { isSafe: true, message: '内容正常', detail: result };
    } else if (result.errcode === 87014) {
      return { 
        isSafe: false, 
        message: '内容含有违法违规内容，请修改后重试',
        detail: result
      };
    } else {
      console.error('文本检测接口错误:', result);
      // 接口错误时，默认放行，避免影响用户体验
      return { isSafe: true, message: '检测服务暂时不可用' };
    }
  } catch (error) {
    console.error('文本内容检测错误:', error.message);
    // 出错时默认放行
    return { isSafe: true, message: '检测出错' };
  }
};

/**
 * 检测图片内容是否违规
 * @param {string} imagePath - 图片本地路径
 * @returns {Promise<{isSafe: boolean, message: string}>}
 */
const checkImageContent = async (imagePath) => {
  if (!imagePath || !fs.existsSync(imagePath)) {
    return { isSafe: true, message: '图片不存在' };
  }
  
  try {
    const token = await getAccessToken();
    
    const formData = new FormData();
    formData.append('media', fs.createReadStream(imagePath));
    
    const response = await axios.post(
      `https://api.weixin.qq.com/wxa/img_sec_check?access_token=${token}`,
      formData,
      {
        headers: {
          ...formData.getHeaders()
        }
      }
    );
    
    const result = response.data;
    
    // errcode: 0-正常，87014-内容含有违法违规内容
    if (result.errcode === 0) {
      return { isSafe: true, message: '图片正常' };
    } else if (result.errcode === 87014) {
      return { 
        isSafe: false, 
        message: '图片含有违法违规内容，请更换后重试'
      };
    } else {
      console.error('图片检测接口错误:', result);
      return { isSafe: true, message: '检测服务暂时不可用' };
    }
  } catch (error) {
    console.error('图片内容检测错误:', error.message);
    return { isSafe: true, message: '检测出错' };
  }
};

/**
 * 检测媒体内容（图片URL）
 * @param {string} mediaUrl - 图片URL
 * @returns {Promise<{isSafe: boolean, message: string}>}
 */
const checkMediaContent = async (mediaUrl) => {
  if (!mediaUrl) {
    return { isSafe: true, message: 'URL为空' };
  }
  
  try {
    const token = await getAccessToken();
    
    const response = await axios.post(
      `https://api.weixin.qq.com/wxa/media_check_async?access_token=${token}`,
      {
        media_url: mediaUrl,
        media_type: 2, // 1:音频 2:图片
        version: 2,
        scene: 2,
        openid: ''
      }
    );
    
    const result = response.data;
    
    if (result.errcode === 0) {
      // 异步检测，返回任务ID
      return { 
        isSafe: true, 
        message: '图片检测任务已创建',
        traceId: result.trace_id
      };
    } else {
      console.error('媒体检测接口错误:', result);
      return { isSafe: true, message: '检测服务暂时不可用' };
    }
  } catch (error) {
    console.error('媒体内容检测错误:', error.message);
    return { isSafe: true, message: '检测出错' };
  }
};

module.exports = {
  checkTextContent,
  checkImageContent,
  checkMediaContent,
  getAccessToken
};
