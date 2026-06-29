const WrongQuestion = require('../models/WrongQuestion');
const Favorite = require('../models/Favorite');
const Question = require('../models/Question');
const AnswerRecord = require('../models/AnswerRecord');
const User = require('../models/User');
const pool = require('../config/mysql');
const { successResponse, errorResponse } = require('../utils/response');

const getWrongQuestions = async (req, res) => {
  try {
    const { subjectId, page = 1, size = 20 } = req.query;
    const userId = req.userId;
    const query = { userId, isActive: 1 };
    
    if (subjectId) {
      query.subjectId = subjectId;
    }
    
    const skip = (page - 1) * size;
    const wrongQuestions = await WrongQuestion.find({
      ...query,
      skip,
      limit: parseInt(size)
    });
    
    const total = await WrongQuestion.countDocuments(query);
    
    res.json(successResponse({ list: wrongQuestions, total }));
  } catch (error) {
    console.error('获取错题失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getStudyStats = async (req, res) => {
  try {
    const userId = req.userId;

    // 今日总刷题数 (包含所有科目)
    const [totalRecords] = await pool.query(
      'SELECT SUM(totalQuestions) as totalQuestions FROM answer_records WHERE userId = ? AND DATE(createdAt) = CURDATE()',
      [userId]
    );

    // 今日准确率统计 (排除数学刷题 subjectId = 4)
    const [accuracyRecords] = await pool.query(
      'SELECT SUM(totalQuestions) as totalQuestions, SUM(correctQuestions) as totalCorrect FROM answer_records WHERE userId = ? AND DATE(createdAt) = CURDATE() AND subjectId != 4',
      [userId]
    );

    const stats = {
      todayQuestions: totalRecords[0].totalQuestions || 0,
      todayAccuracy: accuracyRecords[0].totalQuestions > 0 
        ? Math.round((accuracyRecords[0].totalCorrect / accuracyRecords[0].totalQuestions) * 100) 
        : null // 改为 null 表示没有统计数据
    };

    res.json(successResponse(stats));
  } catch (error) {
    console.error('获取学习统计失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getLeaderboard = async (req, res) => {
  let sql = '';
  let rankSql = '';
  
  try {
    const { type = 'questions', period = 'week' } = req.query;
    const userId = req.userId;
    
    console.log('getLeaderboard called:', { type, period, userId });
    
    // 测试数据库连接
    try {
      const [testResult] = await pool.query('SELECT 1 as test');
      console.log('Database connection test:', testResult);
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
      return res.status(500).json(errorResponse('数据库连接失败: ' + dbError.message));
    }

    // 根据类型选择统计字段
    // users表使用 total_questions, answer_records表使用 totalQuestions
    let valueField = '';
    if (type === 'points') {
      valueField = 'totalScore';
    } else {
      // 题目数量：users表用 total_questions, answer_records表用 totalQuestions
      valueField = period === 'all' ? 'total_questions' : 'totalQuestions';
    }
    
    console.log('valueField:', valueField, 'period:', period);
    
    if (period === 'all') {
      // 全部时间：直接从 users 表获取，只查询参与排行榜的用户
      sql = `
        SELECT u.id, u.username, u.nickname, u.avatar, u.avatar_frame_id, u.level, ` + valueField + ` as value
        FROM users u
        WHERE u.status = 1 AND u.participate_ranking = 1
        ORDER BY ` + valueField + ` DESC
        LIMIT 50
      `;
    } else {
      // 按时间段：从 answer_records 表统计，只查询参与排行榜的用户
      const days = period === 'week' ? 7 : (period === 'day' ? 1 : 30);
      sql = `
        SELECT u.id, u.username, u.nickname, u.avatar, u.avatar_frame_id, u.level, COALESCE(SUM(a.` + valueField + `), 0) as value
        FROM users u
        LEFT JOIN answer_records a ON u.id = a.userId AND a.createdAt >= DATE_SUB(CURDATE(), INTERVAL ` + days + ` DAY)
        WHERE u.status = 1 AND u.participate_ranking = 1
        GROUP BY u.id, u.username, u.nickname, u.avatar, u.avatar_frame_id, u.level
        ORDER BY value DESC
        LIMIT 50
      `;
    }

    const [rankList] = await pool.query(sql);

    // 获取当前用户排名 - 使用兼容MySQL 5.7的写法
    if (period === 'all') {
      // 全部时间：使用子查询计算排名（只统计参与排行榜的用户）
      rankSql = `
        SELECT 
          (SELECT COUNT(*) + 1 FROM users u2 WHERE u2.` + valueField + ` > u.` + valueField + ` AND u2.status = 1 AND u2.participate_ranking = 1) as \`rank\`,
          u.` + valueField + ` as value,
          u.avatar,
          u.avatar_frame_id,
          u.participate_ranking
        FROM users u
        WHERE u.id = ? AND u.status = 1
      `;
      console.log('period=all rankSql:', rankSql);
    } else {
      // 按时间段：使用子查询计算排名（只统计参与排行榜的用户）
      const days = period === 'week' ? 7 : (period === 'day' ? 1 : 30);
      rankSql = `
        SELECT 
          (SELECT COUNT(DISTINCT userId) + 1 FROM (
            SELECT a.userId, SUM(a.` + valueField + `) as total
            FROM answer_records a
            JOIN users u ON a.userId = u.id
            WHERE a.createdAt >= DATE_SUB(CURDATE(), INTERVAL ` + days + ` DAY) AND u.participate_ranking = 1
            GROUP BY a.userId
            HAVING total > COALESCE((SELECT SUM(` + valueField + `) FROM answer_records WHERE userId = ? AND createdAt >= DATE_SUB(CURDATE(), INTERVAL ` + days + ` DAY)), 0)
          ) t) as \`rank\`,
          COALESCE((SELECT SUM(` + valueField + `) FROM answer_records WHERE userId = ? AND createdAt >= DATE_SUB(CURDATE(), INTERVAL ` + days + ` DAY)), 0) as value,
          (SELECT avatar FROM users WHERE id = ?) as avatar,
          (SELECT avatar_frame_id FROM users WHERE id = ?) as avatar_frame_id,
          (SELECT participate_ranking FROM users WHERE id = ?) as participate_ranking
      `;
    }
    
    // 如果没有 userId，不查询用户排名
    let userRank = [{ rank: '-', value: 0, participate_ranking: 1 }];
    if (userId) {
      let rankParams;
      if (period === 'all') {
        rankParams = [userId];
      } else {
        // period !== 'all' 时需要5个参数：userId用于rank计算, userId用于value计算, userId用于avatar, userId用于avatar_frame_id, userId用于participate_ranking
        rankParams = [userId, userId, userId, userId, userId];
      }
      const [rankResult] = await pool.query(rankSql, rankParams);
      userRank = rankResult;
    }

    res.json(successResponse({
      list: rankList,
      myRank: userRank[0] || { rank: '-', value: 0, participate_ranking: 1 }
    }));
  } catch (error) {
    console.error('获取排行榜失败:', error);
    console.error('错误详情:', error.message);
    console.error('SQL:', sql);
    console.error('rankSql:', rankSql);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 更新参与排行榜设置
const updateParticipateRanking = async (req, res) => {
  try {
    const userId = req.userId;
    const { participate } = req.body;
    
    if (participate === undefined || participate === null) {
      return res.status(400).json(errorResponse('参数错误：participate 不能为空'));
    }
    
    const participateValue = participate ? 1 : 0;
    
    await pool.query(
      'UPDATE users SET participate_ranking = ? WHERE id = ?',
      [participateValue, userId]
    );
    
    res.json(successResponse({ 
      participate: participateValue === 1,
      message: participateValue === 1 ? '已开启排行榜显示' : '已关闭排行榜显示'
    }));
  } catch (error) {
    console.error('更新参与排行榜设置失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

// 获取参与排行榜设置
const getParticipateRanking = async (req, res) => {
  try {
    const userId = req.userId;
    
    const [rows] = await pool.query(
      'SELECT participate_ranking FROM users WHERE id = ?',
      [userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json(errorResponse('用户不存在'));
    }
    
    res.json(successResponse({ 
      participate: rows[0].participate_ranking === 1
    }));
  } catch (error) {
    console.error('获取参与排行榜设置失败:', error);
    res.status(500).json(errorResponse('服务器错误: ' + error.message));
  }
};

const getRecentLearning = async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 8 } = req.query;
    
    // 使用子查询进行分组去重，按科目和章节分组，并计算总题数
    const [rows] = await pool.query(
      `SELECT 
        MAX(a.id) as id,
        a.userId,
        a.subjectId,
        a.chapterId,
        MAX(a.chapterName) as chapterName,
        MAX(e.title) as examTitle,
        MAX(CASE 
          WHEN a.subjectId >= 17 THEN a.subjectName 
          ELSE COALESCE(n.name, a.subjectName) 
        END) as subjectName,
        SUM(a.totalQuestions) as totalQuestions,
        MAX(a.createdAt) as createdAt
       FROM answer_records a 
       LEFT JOIN exams e ON a.examId = e.id 
       LEFT JOIN nav_subjects n ON a.subjectId = n.id
       WHERE a.userId = ? 
       GROUP BY a.subjectId, a.chapterId, a.examId, a.subjectName, DATE(a.createdAt)
       ORDER BY createdAt DESC 
       LIMIT ?`,
      [userId, parseInt(limit)]
    );
    res.json(successResponse(rows));
  } catch (error) {
    console.error('获取最近学习失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const deleteWrongQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    const wrongQuestion = await WrongQuestion.findOne({ id, userId });
    if (!wrongQuestion) {
      return res.status(404).json(errorResponse('错题不存在'));
    }
    
    await WrongQuestion.updateById(id, { isActive: 0 });
    
    res.json(successResponse({}));
  } catch (error) {
    console.error('删除错题失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getFavorites = async (req, res) => {
  try {
    const { examTypeId, subjectId, chapterId, page = 1, size = 20 } = req.query;
    const userId = req.userId;
    const query = { userId, isActive: 1 };
    
    if (examTypeId) {
      query.examTypeId = examTypeId;
    }
    
    if (subjectId) {
      query.subjectId = subjectId;
    }
    
    if (chapterId) {
      query.chapterId = chapterId;
    }
    
    const skip = (page - 1) * size;
    const favorites = await Favorite.find({
      ...query,
      skip,
      limit: parseInt(size)
    });
    
    const total = await Favorite.countDocuments(query);
    
    res.json(successResponse({ list: favorites, total }));
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const addFavorite = async (req, res) => {
  try {
    const { questionId } = req.body;
    const userId = req.userId;
    
    console.log('添加收藏 - userId:', userId, 'questionId:', questionId);
    
    if (!questionId) {
      console.log('题目ID为空');
      return res.status(400).json(errorResponse('题目ID不能为空'));
    }
    
    const question = await Question.findById(questionId);
    if (!question) {
      console.log('题目不存在:', questionId);
      return res.status(404).json(errorResponse('题目不存在'));
    }
    
    console.log('找到题目:', question._id, 'examTypeId:', question.examTypeId, 'subjectId:', question.subjectId);
    
    const existingFavorite = await Favorite.findOne({
      userId,
      questionId,
      isActive: 1,
    });
    
    if (existingFavorite) {
      console.log('已收藏该题目');
      return res.status(400).json(errorResponse('已收藏该题目'));
    }
    
    const favorite = await Favorite.create({
      userId,
      questionId,
      examTypeId: question.examTypeId,
      subjectId: question.subjectId,
      chapterId: question.chapterId,
      content: question.content,
      isActive: 1,
    });
    
    console.log('收藏成功:', favorite._id);
    res.json(successResponse({ id: favorite._id }));
  } catch (error) {
    console.error('添加收藏失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const deleteFavorite = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    const favorite = await Favorite.findOne({ _id: id, userId });
    if (!favorite) {
      return res.status(404).json(errorResponse('收藏不存在'));
    }
    
    await Favorite.updateById(id, { isActive: 0 });
    
    res.json(successResponse({}));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getStudyHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { period = 'week' } = req.query; // week, month, three_months

    let days = 7;
    if (period === 'month') days = 30;
    if (period === 'three_months') days = 90;

    const [rows] = await pool.query(
      `SELECT 
        DATE_FORMAT(createdAt, '%m-%d') as date,
        SUM(totalQuestions) as count
       FROM answer_records 
       WHERE userId = ? AND createdAt >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE_FORMAT(createdAt, '%m-%d')
       ORDER BY MIN(createdAt) ASC`,
      [userId, days]
    );

    res.json(successResponse(rows));
  } catch (error) {
    console.error('获取学习历史失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getHomeOverview = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 1. 今日统计
    const [totalRecords] = await pool.query(
      'SELECT SUM(totalQuestions) as totalQuestions FROM answer_records WHERE userId = ? AND DATE(createdAt) = CURDATE()',
      [userId]
    );
    const [accuracyRecords] = await pool.query(
      'SELECT SUM(totalQuestions) as totalQuestions, SUM(correctQuestions) as totalCorrect FROM answer_records WHERE userId = ? AND DATE(createdAt) = CURDATE() AND subjectId != 4',
      [userId]
    );
    
    const todayStats = {
      todayQuestions: totalRecords[0].totalQuestions || 0,
      todayAccuracy: accuracyRecords[0].totalQuestions > 0 
        ? Math.round((accuracyRecords[0].totalCorrect / accuracyRecords[0].totalQuestions) * 100) 
        : null
    };

    // 2. 最近学习 - 增加分组逻辑，避免重复标题
    const [recentLearning] = await pool.query(
      `SELECT 
        MAX(a.id) as id,
        a.userId,
        a.subjectId,
        a.chapterId,
        MAX(a.chapterName) as chapterName,
        MAX(e.title) as examTitle,
        MAX(CASE 
          WHEN a.subjectId >= 17 THEN a.subjectName 
          ELSE COALESCE(n.name, a.subjectName) 
        END) as subjectName,
        SUM(a.totalQuestions) as totalQuestions,
        MAX(a.createdAt) as createdAt
       FROM answer_records a 
       LEFT JOIN exams e ON a.examId = e.id 
       LEFT JOIN nav_subjects n ON a.subjectId = n.id
       WHERE a.userId = ? 
       GROUP BY a.subjectId, a.chapterId, a.examId, a.subjectName, DATE(a.createdAt)
       ORDER BY createdAt DESC 
       LIMIT 8`,
      [userId]
    );

    // 3. 排行榜 (今日题数榜)
    const [rankList] = await pool.query(`
      SELECT u.id, u.username, u.avatar, SUM(a.totalQuestions) as value 
      FROM answer_records a 
      JOIN users u ON a.userId = u.id 
      WHERE DATE(a.createdAt) = CURDATE()
      GROUP BY u.id, u.username, u.avatar
      ORDER BY value DESC 
      LIMIT 5
    `);
    
    // 获取用户排名（兼容低版本 MySQL，不使用窗口函数）
    let userRankResult = { rank: 0, value: 0 };
    try {
      const [userStats] = await pool.query(`
        SELECT SUM(totalQuestions) as value
        FROM answer_records
        WHERE userId = ? AND DATE(createdAt) = CURDATE()
      `, [userId]);
      
      if (userStats[0] && userStats[0].value) {
        const userValue = userStats[0].value;
        const [rankResult] = await pool.query(`
          SELECT COUNT(*) + 1 as \`rank\`
          FROM (
            SELECT userId, SUM(totalQuestions) as total
            FROM answer_records
            WHERE DATE(createdAt) = CURDATE()
            GROUP BY userId
            HAVING total > ?
          ) as t
        `, [userValue]);
        userRankResult = { rank: rankResult[0].rank, value: userValue };
      }
    } catch (e) {
      console.error('获取用户排名失败:', e);
    }

    // 4. 学习历史 (周)
    const [history] = await pool.query(
      `SELECT 
        DATE_FORMAT(createdAt, '%m-%d') as date,
        SUM(totalQuestions) as count
       FROM answer_records 
       WHERE userId = ? AND createdAt >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE_FORMAT(createdAt, '%m-%d')
       ORDER BY MIN(createdAt) ASC`,
      [userId]
    );

    res.json(successResponse({
      todayStats,
      recentLearning,
      leaderboard: {
        list: rankList,
        userRank: userRankResult
      },
      history
    }));
  } catch (error) {
    console.error('获取首页概览失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

module.exports = {
  getWrongQuestions,
  deleteWrongQuestion,
  getFavorites,
  addFavorite,
  deleteFavorite,
  getStudyStats,
  getLeaderboard,
  getParticipateRanking,
  updateParticipateRanking,
  getRecentLearning,
  getStudyHistory,
  getHomeOverview
};
