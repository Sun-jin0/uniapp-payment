const User = require('../models/User');
const AnswerRecord = require('../models/AnswerRecord');
const ImageManagement = require('../models/ImageManagement');
const { generateToken } = require('../utils/jwt');
const { successResponse, errorResponse } = require('../utils/response');
const pool = require('../config/mysql');
const axios = require('axios');
const { uploadToOSS } = require('../utils/ossUpload');
const fs = require('fs');
const FormData = require('form-data');

// ImgBB API配置
const IMGBB_API_KEY = '490bd6f9af092465ecc79c99895beba7';
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

/**
 * 上传图片到ImgBB
 */
async function uploadToImgBB(filePath) {
  if (!IMGBB_API_KEY) {
    console.log('⚠️ 未配置ImgBB API Key');
    return null;
  }
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64Image = fileBuffer.toString('base64');
    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', base64Image);
    
    const response = await axios.post(IMGBB_UPLOAD_URL, formData, {
      headers: { ...formData.getHeaders() },
      timeout: 30000
    });
    
    if (response.data?.success) {
      return {
        url: response.data.data.url,
        deleteUrl: response.data.data.delete_url,
        imgbbId: response.data.data.id
      };
    }
    return null;
  } catch (error) {
    console.error('ImgBB上传失败:', error.message);
    return null;
  }
}

const wechatLogin = async (req, res) => {
  try {
    const { code, userInfo, inviteCode } = req.body;
    if (!code) {
      return res.status(400).json(errorResponse('Code is required'));
    }

    const appId = process.env.WX_APP_ID;
    const appSecret = process.env.WX_APP_SECRET;

    console.log('微信登录请求:', { appId, codeLength: code?.length, hasUserInfo: !!userInfo });

    // 1. 调用微信 API 获取 openid
    const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: appId,
        secret: appSecret,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    console.log('微信登录响应:', wxRes.data);

    const { openid, session_key, errcode, errmsg } = wxRes.data;

    if (errcode) {
      console.error('WeChat API error:', { errcode, errmsg, appId });
      return res.status(500).json(errorResponse(`微信登录失败: ${errmsg}`));
    }

    // 2. 确保 openid 字段存在 (自动迁移)
    try {
      await pool.query('ALTER TABLE users ADD COLUMN openid VARCHAR(255) UNIQUE AFTER phone');
    } catch (e) {
      // Ignore if column exists
    }

    // 3. 查找或创建用户
    let user = await User.findOne({ openid });
    let isNewUser = false;

    if (!user) {
      // 一键注册
      isNewUser = true;
      const username = userInfo?.nickName || `微信用户_${openid.slice(-6)}`;
      const avatar = userInfo?.avatarUrl || null;
      
      user = await User.create({
        username,
        openid,
        avatar,
        role: 'user',
        status: 1,
        loginType: 'wechat' // 标记为微信登录
      });
      
      // 邀请功能已删除
    }

    // 4. 更新最后登录时间
    await User.updateById(user.id, { lastLoginDate: new Date() });

    // 5. 生成 Token
    const token = generateToken(user.id);

    res.json(successResponse({
      token,
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      avatar_frame_id: user.avatar_frame_id,
      role: user.role,
      openid: user.openid
    }));

  } catch (error) {
    console.error('wechatLogin error:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

const login = async (req, res) => {
  try {
    const { username, studentId, password } = req.body;
    console.log('Login attempt received body:', req.body);
    
    // 支持用户名或学号登录
    const user = await User.findOne({ 
      $or: [
        { username: username },
        { studentId: studentId || username } // 兼容两种传参方式
      ],
      status: 1 
    });
    
    if (!user) {
      console.log('User not found or inactive for:', { username, studentId });
      return res.status(401).json(errorResponse('用户名或密码错误'));
    }
    
    console.log('User found in DB:', user.username, 'ID:', user.id);
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('Password mismatch for user:', user.username);
      return res.status(401).json(errorResponse('用户名或密码错误'));
    }
    
    await User.updateById(user.id, { lastLoginDate: new Date() });
    
    const token = generateToken(user.id);
    console.log('Login successful for user:', user.username);
    
    res.json(successResponse({
      token,
      userId: user.id,
      username: user.username,
      avatar_frame_id: user.avatar_frame_id,
      role: user.role,
    }));
  } catch (error) {
    console.error('Login error details:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

const register = async (req, res) => {
  try {
    const { username, password, phone, studentId } = req.body;
    
    const existingUser = await User.findOne({ 
      $or: [{ username }, { studentId }] 
    });
    
    if (existingUser) {
      return res.status(409).json(errorResponse('用户名或学号已存在'));
    }
    
    const user = await User.create({
      username,
      password,
      phone,
      studentId,
      loginType: 'password' // 标记为账号密码登录
    });
    
    // 邀请功能已删除
    
    const token = generateToken(user.id);
    
    res.json(successResponse({
      userId: user.id,
      username: user.username,
      token,
    }));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getUserInfo = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json(errorResponse('用户不存在'));
    }
    
    // 计算用户等级：10级以前每20个题加一个等级，超过10级每50个题加一个等级
    const calcLevel = (questions) => {
      if (questions < 200) {
        return Math.floor(questions / 20) + 1;
      } else {
        return 10 + Math.floor((questions - 200) / 50);
      }
    };
    const level = user.level || calcLevel(user.total_questions || 0);
    
    res.json(successResponse({
      userId: user.id,
      username: user.username,
      nickname: user.nickname || user.username,
      studentId: user.studentId,
      phone: user.phone,
      avatar: user.avatar,
      avatar_frame_id: user.avatar_frame_id,
      role: user.role,
      level: level,
      totalQuestions: user.total_questions || 0,
      studyDays: user.study_days || 0,
      correctRate: user.total_questions > 0 ? Math.round((user.total_correct / user.total_questions) * 100) : 0,
      selectedSubjectId: user.SelectedSubjectID,
    }));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updateUserInfo = async (req, res) => {
  try {
    const { nickname, avatar, gender, region } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json(errorResponse('用户不存在'));
    }
    
    const updateData = {};
    if (nickname) {
      if (nickname !== user.username) {
        const existingUser = await User.findOne({ username: nickname, id: { $ne: req.userId } });
        if (existingUser) {
          return res.status(409).json(errorResponse('该昵称已被使用'));
        }
      }
      updateData.username = nickname;
    }
    if (avatar) updateData.avatar = avatar;
    if (gender !== undefined) updateData.gender = gender;
    if (region) updateData.region = region;

    await User.updateById(req.userId, updateData);
    
    res.json(successResponse(null, '更新成功'));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json(errorResponse('用户不存在'));
    }
    
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json(errorResponse('旧密码错误'));
    }
    
    await User.updateById(req.userId, { password: newPassword });
    
    res.json(successResponse({}, '密码修改成功'));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getAnswerRecords = async (req, res) => {
  try {
    const records = await AnswerRecord.find({ userId: req.userId });
    res.json(successResponse({ list: records, total: records.length }));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updateSelectedSubject = async (req, res) => {
  try {
    const { subjectId } = req.body;
    if (!subjectId) {
      return res.status(400).json(errorResponse('subjectId is required'));
    }

    await User.updateById(req.userId, { SelectedSubjectID: subjectId });
    res.json(successResponse(null, '更新成功'));
  } catch (error) {
    console.error('updateSelectedSubject error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getUserProgressStats = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json(errorResponse('用户不存在'));
    }

    // 计算坚持天数 (基于创建日期)
    const createDate = new Date(user.createTime || new Date());
    const today = new Date();
    const diffTime = Math.abs(today - createDate);
    const daysPersisted = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // 计算考研倒计时 (假设 2026-12-21 为下一次考研日期)
    const examDate = new Date('2026-12-21');
    const timeToExam = examDate - today;
    const daysRemaining = Math.max(0, Math.ceil(timeToExam / (1000 * 60 * 60 * 24)));

    res.json(successResponse({
      daysPersisted,
      daysRemaining,
      totalQuestions: user.totalQuestions || 0,
      correctRate: user.correctRate || 0
    }));
  } catch (error) {
    console.error('getUserProgressStats error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getUserSettings = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM user_settings WHERE userId = ?', [req.userId]);
    if (rows.length === 0) {
      // 返回默认设置
      return res.json(successResponse({
        autoNext: true,
        nightMode: false,
        fontSize: 30,
        fontSizeLevel: 'standard',
        recitationMode: false,
        autoRemoveWrong: true
      }));
    }
    const settings = rows[0];
    // 确保返回布尔值
    settings.autoNext = !!settings.autoNext;
    settings.nightMode = !!settings.nightMode;
    settings.recitationMode = !!settings.recitationMode;
    settings.autoRemoveWrong = !!settings.autoRemoveWrong;
    res.json(successResponse(settings));
  } catch (error) {
    console.error('getUserSettings error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updateUserSettings = async (req, res) => {
  try {
    const { autoNext, nightMode, fontSize, fontSizeLevel, recitationMode, autoRemoveWrong } = req.body;
    
    // 使用 INSERT INTO ... ON DUPLICATE KEY UPDATE
    await pool.query(`
      INSERT INTO user_settings (userId, autoNext, nightMode, fontSize, fontSizeLevel, recitationMode, autoRemoveWrong)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      autoNext = VALUES(autoNext),
      nightMode = VALUES(nightMode),
      fontSize = VALUES(fontSize),
      fontSizeLevel = VALUES(fontSizeLevel),
      recitationMode = VALUES(recitationMode),
      autoRemoveWrong = VALUES(autoRemoveWrong)
    `, [
      req.userId, 
      autoNext ? 1 : 0, 
      nightMode ? 1 : 0, 
      fontSize || 30, 
      fontSizeLevel || 'standard',
      recitationMode ? 1 : 0,
      autoRemoveWrong ? 1 : 0
    ]);

    res.json(successResponse(null, '设置更新成功'));
  } catch (error) {
    console.error('updateUserSettings error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};
const increaseQuestionCount = async (req, res) => {
  try {
    const { isCorrect, bookId, type } = req.body;
    const userId = req.userId;

    // 更新用户总题数和正确数（level 由数据库生成列自动计算）
    await pool.query(
      `UPDATE users SET
        total_questions = total_questions + 1,
        total_correct = total_correct + ?
      WHERE id = ?`,
      [isCorrect ? 1 : 0, userId]
    );

    // 记录答题记录
    try {
      // 检查表是否存在并添加缺失字段
      await pool.query(`
        CREATE TABLE IF NOT EXISTS answer_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          bookId INT,
          type VARCHAR(255),
          totalQuestions INT DEFAULT 0,
          correctQuestions INT DEFAULT 0,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_book_type_date (userId, bookId, type, createdAt)
        )
      `);

      // 尝试添加 type 字段（如果不存在）
      try {
        await pool.query('ALTER TABLE answer_records ADD COLUMN type VARCHAR(255) AFTER bookId');
      } catch (e) {
        // 字段可能已存在，忽略错误
      }

      await pool.query(
        `INSERT INTO answer_records (userId, bookId, type, totalQuestions, correctQuestions) 
         VALUES (?, ?, ?, 1, ?) 
         ON DUPLICATE KEY UPDATE 
         totalQuestions = totalQuestions + 1, 
         correctQuestions = correctQuestions + ?,
         updatedAt = CURRENT_TIMESTAMP`,
        [userId, bookId || 0, type || 'default', isCorrect ? 1 : 0, isCorrect ? 1 : 0]
      );
    } catch (recordError) {
      console.error('更新 answer_records 失败:', recordError);
      // 记录错误但不中断主流程
    }

    // 获取更新后的用户信息
    const [updatedUser] = await pool.query('SELECT total_questions, total_correct, study_days FROM users WHERE id = ?', [userId]);
    const userInfo = updatedUser[0];

    const [stats] = await pool.query(
      'SELECT SUM(totalQuestions) as todayQuestions, SUM(correctQuestions) as todayCorrect FROM answer_records WHERE userId = ? AND DATE(createdAt) = CURDATE()',
      [userId]
    );

    const todayQuestions = stats[0].todayQuestions || 0;
    const todayAccuracy = stats[0].todayQuestions > 0 
      ? Math.round((stats[0].todayCorrect / stats[0].todayQuestions) * 100) 
      : 0;

    res.json(successResponse({
      totalQuestions: userInfo.total_questions,
      totalCorrect: userInfo.total_correct,
      studyDays: userInfo.study_days,
      accuracy: userInfo.total_questions > 0 ? Math.round((userInfo.total_correct / userInfo.total_questions) * 100) : 0,
      todayQuestions,
      todayAccuracy
    }, '刷题计数已增加'));
  } catch (error) {
    console.error('increaseQuestionCount error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('请选择要上传的头像'));
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname || req.file.filename;
    const fileSize = req.file.size;
    const fileExt = fileName.split('.').pop().toLowerCase();
    
    console.log('开始上传头像:', filePath);
    
    // 计算文件哈希（仅用于记录）
    const imageHash = ImageManagement.calculateHash(filePath);
    
    // 同时上传到OSS和ImgBB
    const results = {
      oss: { success: false, url: null },
      imgbb: { success: false, url: null, deleteUrl: null, imgbbId: null }
    };
    
    // OSS上传
    try {
      results.oss.url = await uploadToOSS(filePath);
      results.oss.success = true;
      console.log('✅ OSS上传成功:', results.oss.url);
    } catch (error) {
      console.error('❌ OSS上传失败:', error.message);
    }
    
    // ImgBB上传
    try {
      const imgbbData = await uploadToImgBB(filePath);
      if (imgbbData) {
        results.imgbb.url = imgbbData.url;
        results.imgbb.deleteUrl = imgbbData.deleteUrl;
        results.imgbb.imgbbId = imgbbData.imgbbId;
        results.imgbb.success = true;
        console.log('✅ ImgBB上传成功:', results.imgbb.url);
      }
    } catch (error) {
      console.error('❌ ImgBB上传失败:', error.message);
    }
    
    // 检查至少有一个上传成功
    if (!results.oss.success && !results.imgbb.success) {
      throw new Error('OSS和ImgBB都上传失败');
    }

    // 保存到图片管理表
    const imageId = await ImageManagement.create({
      imageName: fileName,
      imageType: fileExt,
      imageSize: fileSize,
      imageHash: imageHash,
      ossUrl: results.oss.url,
      ossBucket: 'hi168-26998-7111ilq6',
      ossObjectKey: results.oss.url ? results.oss.url.split('/').pop() : null,
      ossStatus: results.oss.success ? 1 : 0,
      imgbbUrl: results.imgbb.url,
      imgbbDeleteUrl: results.imgbb.deleteUrl,
      imgbbId: results.imgbb.imgbbId,
      imgbbStatus: results.imgbb.success ? 1 : 0,
      sourceType: 'avatar',
      sourceId: req.userId,
      userId: req.userId
    });
    
    console.log('头像已保存到图片管理表，ID:', imageId);

    // 记录图片使用
    await ImageManagement.recordUsage(imageId, 'user_avatar', req.userId, results.oss.url || results.imgbb.url);

    // 更新用户头像（优先使用OSS URL）
    const avatarUrl = results.oss.url || results.imgbb.url;
    await User.updateById(req.userId, { avatar: avatarUrl });

    // 删除临时文件
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('✅ 临时文件已删除:', filePath);
      }
    } catch (err) {
      console.error('❌ 删除临时文件失败:', err.message);
    }

    res.json(successResponse({
      avatar: avatarUrl
    }, '头像上传成功'));
  } catch (error) {
    console.error('头像上传失败:', error);
    
    // 发生错误时也要删除临时文件
    try {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('✅ 错误后临时文件已删除:', req.file.path);
      }
    } catch (err) {
      console.error('❌ 删除临时文件失败:', err.message);
    }
    
    res.status(500).json(errorResponse('头像上传失败: ' + error.message));
  }
};

module.exports = {
  wechatLogin,
  login,
  register,
  getUserInfo,
  updateUserInfo,
  changePassword,
  getAnswerRecords,
  updateSelectedSubject,
  getUserProgressStats,
  getUserSettings,
  updateUserSettings,
  increaseQuestionCount,
  uploadAvatar,
};
