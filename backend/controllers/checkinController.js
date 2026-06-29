const CheckinRecord = require('../models/CheckinRecord');
const PointsRecord = require('../models/PointsRecord');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');

const checkin = async (req, res) => {
  try {
    const userId = req.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingRecord = await CheckinRecord.findOne({
      userId,
      date: today,
    });
    
    if (existingRecord) {
      return res.status(400).json(errorResponse('今日已签到'));
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const yesterdayRecord = await CheckinRecord.findOne({
      userId,
      date: yesterday,
    });
    
    let consecutiveDays = 1;
    if (yesterdayRecord) {
      consecutiveDays = yesterdayRecord.consecutiveDays + 1;
    }
    
    let points = 10;
    if (consecutiveDays >= 7) {
      points = 20;
    } else if (consecutiveDays >= 30) {
      points = 30;
    }
    
    await CheckinRecord.create({
      userId,
      date: today,
      points,
      consecutiveDays,
    });
    
    await PointsRecord.create({
      userId,
      points,
      type: 1,
      description: '每日签到',
    });
    
    const pool = require('../config/mysql');
    await pool.query(
      'UPDATE users SET totalScore = totalScore + ?, practiceDays = practiceDays + 1 WHERE id = ?',
      [points, userId]
    );
    
    res.json(successResponse({ points, consecutiveDays }));
  } catch (error) {
    console.error('Checkin error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getCheckinRecords = async (req, res) => {
  try {
    const userId = req.userId;
    
    const records = await CheckinRecord.find({ 
      userId,
      limit: 30
    });
    
    const consecutiveDays = records.length > 0 ? records[0].consecutiveDays : 0;
    const totalDays = await CheckinRecord.countDocuments({ userId });
    
    res.json(successResponse({
      consecutiveDays,
      totalDays,
      records: records.map(r => ({
        date: r.checkinDate,
        points: r.points,
      })),
    }));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 自定义打卡
const customCheckin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { checkinType, studyCount, content, images } = req.body;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 检查今日是否已打卡
    const [existing] = await pool.query(
      'SELECT id FROM custom_checkin_records WHERE userId = ? AND checkinDate = ? AND checkinType = ?',
      [userId, today, checkinType]
    );
    
    if (existing.length > 0) {
      return res.status(400).json(errorResponse('今日已打卡'));
    }
    
    // 创建打卡记录
    const [result] = await pool.query(
      'INSERT INTO custom_checkin_records (userId, checkinType, studyCount, content, images, checkinDate) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, checkinType, studyCount || 0, content || '', JSON.stringify(images || []), today]
    );
    
    res.json(successResponse({
      id: result.insertId,
      message: '打卡成功'
    }));
  } catch (error) {
    console.error('Custom checkin error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取自定义打卡记录
const getCustomCheckinRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    const offset = (page - 1) * limit;
    
    // 获取打卡记录
    const [records] = await pool.query(
      'SELECT * FROM custom_checkin_records WHERE userId = ? ORDER BY checkinDate DESC, checkinTime DESC LIMIT ? OFFSET ?',
      [userId, parseInt(limit), parseInt(offset)]
    );
    
    // 获取总数
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM custom_checkin_records WHERE userId = ?',
      [userId]
    );
    
    // 处理记录数据
    const processedRecords = records.map(r => ({
      ...r,
      images: r.images ? JSON.parse(r.images) : []
    }));
    
    res.json(successResponse({
      records: processedRecords,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    }));
  } catch (error) {
    console.error('Get custom checkin records error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 获取今日打卡状态
const getTodayCheckinStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 获取今日打卡记录
    const [records] = await pool.query(
      'SELECT * FROM custom_checkin_records WHERE userId = ? AND checkinDate = ?',
      [userId, today]
    );
    
    // 获取连续打卡天数
    const [consecutiveResult] = await pool.query(
      `SELECT COUNT(*) as consecutiveDays 
       FROM custom_checkin_records 
       WHERE userId = ? 
       AND checkinDate >= DATE_SUB(?, INTERVAL 30 DAY)
       ORDER BY checkinDate DESC`,
      [userId, today]
    );
    
    res.json(successResponse({
      todayRecords: records.map(r => ({
        ...r,
        images: r.images ? JSON.parse(r.images) : []
      })),
      consecutiveDays: consecutiveResult[0].consecutiveDays,
      hasCheckedIn: records.length > 0
    }));
  } catch (error) {
    console.error('Get today checkin status error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// 分享打卡
const shareCheckin = async (req, res) => {
  try {
    const { checkinId } = req.params;
    
    // 更新分享次数
    await pool.query(
      'UPDATE custom_checkin_records SET isShared = TRUE, shareCount = shareCount + 1 WHERE id = ?',
      [checkinId]
    );
    
    res.json(successResponse({ message: '分享成功' }));
  } catch (error) {
    console.error('Share checkin error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

module.exports = {
  checkin,
  getCheckinRecords,
  customCheckin,
  getCustomCheckinRecords,
  getTodayCheckinStatus,
  shareCheckin
};
