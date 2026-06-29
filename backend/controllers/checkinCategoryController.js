const pool = require('../config/mysql');
const { successResponse, errorResponse } = require('../utils/response');
const XLSX = require('xlsx');

const getCategories = async (req, res) => {
  try {
    const [categories] = await pool.query(`
      SELECT c.*, 
        (SELECT COUNT(DISTINCT user_id) FROM checkin_records_new WHERE category_id = c.id) as join_count,
        (SELECT COUNT(*) FROM checkin_records_new WHERE category_id = c.id) as checkin_count,
        (SELECT COUNT(*) FROM checkin_pre_registers WHERE category_id = c.id) as pre_register_count
      FROM checkin_categories c
      WHERE c.status = 1
      ORDER BY c.sort_order ASC
    `);

    res.json(successResponse(categories));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getCategoryDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId || null;

    const [categories] = await pool.query(`
      SELECT c.*, 
        (SELECT COUNT(DISTINCT user_id) FROM checkin_records_new WHERE category_id = c.id) as join_count,
        (SELECT COUNT(*) FROM checkin_records_new WHERE category_id = c.id) as checkin_count,
        (SELECT COUNT(*) FROM checkin_pre_registers WHERE category_id = c.id) as pre_register_count
      FROM checkin_categories c
      WHERE c.id = ?
    `, [id]);

    if (categories.length === 0) {
      return res.status(404).json(errorResponse('类别不存在'));
    }

    const category = categories[0];

    if (userId) {
      const [stats] = await pool.query(`
        SELECT 
          COUNT(DISTINCT DATE(checkin_date)) as total_checkins,
          (SELECT COUNT(*) FROM checkin_records_new r2 
           WHERE r2.user_id = r1.user_id 
           AND r2.category_id = r1.category_id
           AND r2.checkin_date >= DATE_SUB(r1.checkin_date, INTERVAL 
             (SELECT DATEDIFF(MAX(checkin_date), DATE_SUB(MAX(checkin_date), INTERVAL 1 YEAR))
              FROM checkin_records_new WHERE user_id = ? AND category_id = ?)
             DAY)) as consecutive_days
        FROM checkin_records_new r1
        WHERE user_id = ? AND category_id = ?
      `, [userId, id, userId, id]);

      const [simpleStats] = await pool.query(`
        SELECT 
          COUNT(DISTINCT DATE(checkin_date)) as total_checkins,
          MAX(checkin_date) as last_checkin_date
        FROM checkin_records_new
        WHERE user_id = ? AND category_id = ?
      `, [userId, id]);

      let consecutiveDays = 0;
      if (simpleStats[0].total_checkins > 0) {
        const [consecutiveResult] = await pool.query(`
          SELECT COUNT(*) as consecutive_days FROM (
            SELECT DISTINCT DATE(checkin_date) as checkin_date_only,
                   @rn := @rn + 1 as rn,
                   DATEDIFF(CURDATE(), DATE(checkin_date)) as diff
            FROM checkin_records_new, (SELECT @rn := 0) r
            WHERE user_id = ? AND category_id = ?
            ORDER BY DATE(checkin_date) DESC
          ) t
          WHERE diff <= rn
        `, [userId, id]);
        consecutiveDays = consecutiveResult[0]?.consecutive_days || 1;
      }

      category.userStats = {
        total_checkins: simpleStats[0].total_checkins || 0,
        consecutive_days: consecutiveDays
      };

      const [preRegCheck] = await pool.query(`
        SELECT id FROM checkin_pre_registers WHERE category_id = ? AND user_id = ?
      `, [id, userId]);
      category.is_pre_registered = preRegCheck.length > 0;
    }

    res.json(successResponse(category));
  } catch (error) {
    console.error('Get category detail error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getDynamics = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.userId || null;
    const offset = (page - 1) * limit;

    const [records] = await pool.query(`
      SELECT r.*, u.username, u.avatar,
        ${userId ? `EXISTS(SELECT 1 FROM checkin_likes WHERE record_id = r.id AND user_id = ${userId}) as is_liked,` : 'FALSE as is_liked,'}
        (SELECT COUNT(*) FROM checkin_comments WHERE record_id = r.id) as comment_count
      FROM checkin_records_new r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.category_id = ? AND r.is_public = 1
      ORDER BY r.checkin_time DESC
      LIMIT ? OFFSET ?
    `, [categoryId, parseInt(limit), offset]);

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total FROM checkin_records_new
      WHERE category_id = ? AND is_public = 1
    `, [categoryId]);

    // 获取每个用户的打卡统计
    const userIds = [...new Set(records.map(r => r.user_id))];
    const userStats = {};
    
    for (const uid of userIds) {
      // 获取该用户的总打卡天数
      const [totalDaysResult] = await pool.query(`
        SELECT COUNT(DISTINCT DATE(checkin_date)) as total_days
        FROM checkin_records_new
        WHERE user_id = ? AND category_id = ?
      `, [uid, categoryId]);
      
      // 获取该用户的所有打卡记录按时间排序（用于计算第几天）
      const [userRecords] = await pool.query(`
        SELECT id, checkin_date
        FROM checkin_records_new
        WHERE user_id = ? AND category_id = ?
        ORDER BY checkin_date ASC, checkin_time ASC
      `, [uid, categoryId]);
      
      // 为每条记录计算第几天
      const recordDayMap = {};
      const dateCountMap = {};
      userRecords.forEach((ur, idx) => {
        const dateKey = ur.checkin_date;
        if (!dateCountMap[dateKey]) {
          dateCountMap[dateKey] = 0;
        }
        dateCountMap[dateKey]++;
        // 同一天内的第几次打卡
        recordDayMap[ur.id] = idx + 1;
      });
      
      userStats[uid] = {
        totalDays: totalDaysResult[0]?.total_days || 0,
        recordDayMap: recordDayMap
      };
    }

    const dynamics = records.map(r => {
      let images = [];
      try {
        images = r.images ? JSON.parse(r.images) : [];
      } catch (e) {
        images = r.images ? [r.images] : [];
      }
      
      const stats = userStats[r.user_id] || { totalDays: 0, recordDayMap: {} };
      
      return {
        id: r.id,
        user_id: r.user_id,
        nickname: r.username || '用户',
        avatar: r.avatar || null,
        content: r.content,
        title: r.title,
        images: images,
        checkin_time: r.checkin_time,
        checkin_date: r.checkin_date,
        like_count: r.like_count || 0,
        isLiked: !!r.is_liked,
        comment_count: r.comment_count || 0,
        day: stats.recordDayMap[r.id] || 1,
        totalDays: stats.totalDays
      };
    });

    res.json(successResponse({
      list: dynamics,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    }));
  } catch (error) {
    console.error('Get dynamics error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getMyRecords = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const userId = req.userId;
    const { page = 1, limit = 20, order = 'desc' } = req.query;
    const offset = (page - 1) * limit;

    const orderDirection = order === 'asc' ? 'ASC' : 'DESC';

    const [records] = await pool.query(`
      SELECT r.*
      FROM checkin_records_new r
      WHERE r.user_id = ? AND r.category_id = ?
      ORDER BY r.checkin_date ${orderDirection}, r.checkin_time ${orderDirection}
      LIMIT ? OFFSET ?
    `, [userId, categoryId, parseInt(limit), offset]);

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total FROM checkin_records_new
      WHERE user_id = ? AND category_id = ?
    `, [userId, categoryId]);

    const [stats] = await pool.query(`
      SELECT COUNT(DISTINCT DATE(checkin_date)) as total_checkins
      FROM checkin_records_new
      WHERE user_id = ? AND category_id = ?
    `, [userId, categoryId]);

    // 计算连续打卡天数
    let consecutiveDays = 0;
    if (stats[0].total_checkins > 0) {
      const [consecutiveResult] = await pool.query(`
        SELECT COUNT(*) as consecutive_days FROM (
          SELECT DISTINCT DATE(checkin_date) as checkin_date_only,
                 @rn := @rn + 1 as rn,
                 DATEDIFF(CURDATE(), DATE(checkin_date)) as diff
          FROM checkin_records_new, (SELECT @rn := 0) r
          WHERE user_id = ? AND category_id = ?
          ORDER BY DATE(checkin_date) DESC
        ) t
        WHERE diff <= rn
      `, [userId, categoryId]);
      consecutiveDays = consecutiveResult[0]?.consecutive_days || 0;
    }

    const recordsList = records.map(r => {
      let images = [];
      try {
        images = r.images ? JSON.parse(r.images) : [];
      } catch (e) {
        images = r.images ? [r.images] : [];
      }
      return {
        ...r,
        images: images
      };
    });

    res.json(successResponse({
      list: recordsList,
      total: countResult[0].total,
      stats: { total_checkins: stats[0].total_checkins, consecutive_days: consecutiveDays },
      page: parseInt(page),
      limit: parseInt(limit)
    }));
  } catch (error) {
    console.error('Get my records error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const createRecord = async (req, res) => {
  try {
    const userId = req.userId;
    const { categoryId, title, content, images } = req.body;

    console.log('Create record request:', { userId, categoryId, title, content, images });

    if (!categoryId) {
      return res.status(400).json(errorResponse('缺少类别ID'));
    }

    if (!content || !content.trim()) {
      return res.status(400).json(errorResponse('请输入打卡内容'));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 检查今天是否已经打卡
    const [existing] = await pool.query(`
      SELECT id FROM checkin_records_new 
      WHERE user_id = ? AND category_id = ? AND checkin_date = ?
    `, [userId, categoryId, today]);

    if (existing.length > 0) {
      return res.status(400).json(errorResponse('今日已打卡'));
    }

    const [result] = await pool.query(`
      INSERT INTO checkin_records_new 
      (user_id, category_id, title, content, images, checkin_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, categoryId, title || '', content, JSON.stringify(images || []), today]);

    res.json(successResponse({
      id: result.insertId,
      message: '打卡成功'
    }));
  } catch (error) {
    console.error('Create record error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updateRecord = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { title, content, images } = req.body;

    const [existing] = await pool.query(`
      SELECT id FROM checkin_records_new WHERE id = ? AND user_id = ?
    `, [id, userId]);

    if (existing.length === 0) {
      return res.status(404).json(errorResponse('记录不存在'));
    }

    await pool.query(`
      UPDATE checkin_records_new 
      SET title = ?, content = ?, images = ?
      WHERE id = ?
    `, [title || '', content, JSON.stringify(images || []), id]);

    res.json(successResponse({ message: '更新成功' }));
  } catch (error) {
    console.error('Update record error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const deleteRecord = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const [existing] = await pool.query(`
      SELECT id FROM checkin_records_new WHERE id = ? AND user_id = ?
    `, [id, userId]);

    if (existing.length === 0) {
      return res.status(404).json(errorResponse('记录不存在'));
    }

    await pool.query('DELETE FROM checkin_likes WHERE record_id = ?', [id]);
    await pool.query('DELETE FROM checkin_comments WHERE record_id = ?', [id]);
    await pool.query('DELETE FROM checkin_records_new WHERE id = ?', [id]);

    res.json(successResponse({ message: '删除成功' }));
  } catch (error) {
    console.error('Delete record error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const adminDeleteRecord = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const [userCheck] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0 || userCheck[0].role == 0) {
      return res.status(403).json(errorResponse('无权限'));
    }

    const [existing] = await pool.query('SELECT id FROM checkin_records_new WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json(errorResponse('记录不存在'));
    }

    await pool.query('DELETE FROM checkin_likes WHERE record_id = ?', [id]);
    await pool.query('DELETE FROM checkin_comments WHERE record_id = ?', [id]);
    await pool.query('DELETE FROM checkin_records_new WHERE id = ?', [id]);

    res.json(successResponse({ message: '删除成功' }));
  } catch (error) {
    console.error('Admin delete record error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const adminDeleteComment = async (req, res) => {
  try {
    const userId = req.userId;
    const { commentId } = req.params;

    const [userCheck] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0 || userCheck[0].role == 0) {
      return res.status(403).json(errorResponse('无权限'));
    }

    const [existing] = await pool.query('SELECT id, record_id FROM checkin_comments WHERE id = ?', [commentId]);
    if (existing.length === 0) {
      return res.status(404).json(errorResponse('评论不存在'));
    }

    const recordId = existing[0].record_id;

    await pool.query('DELETE FROM checkin_comments WHERE id = ?', [commentId]);
    await pool.query('UPDATE checkin_records_new SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?', [recordId]);

    res.json(successResponse({ message: '删除成功' }));
  } catch (error) {
    console.error('Admin delete comment error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const adminGetRecords = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, categoryId, keyword } = req.query;
    const offset = (page - 1) * limit;

    const [userCheck] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0 || userCheck[0].role == 0) {
      return res.status(403).json(errorResponse('无权限'));
    }

    let whereClause = '1=1';
    const params = [];

    if (categoryId) {
      whereClause += ' AND r.category_id = ?';
      params.push(categoryId);
    }

    if (keyword) {
      whereClause += ' AND u.username LIKE ?';
      params.push(`%${keyword}%`);
    }

    const [records] = await pool.query(`
      SELECT r.*, u.username, c.name as category_name
      FROM checkin_records_new r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN checkin_categories c ON r.category_id = c.id
      WHERE ${whereClause}
      ORDER BY r.checkin_time DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM checkin_records_new r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE ${whereClause}
    `, params);

    res.json(successResponse({
      list: records,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    }));
  } catch (error) {
    console.error('Admin get records error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const adminGetComments = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, keyword } = req.query;
    const offset = (page - 1) * limit;

    const [userCheck] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0 || userCheck[0].role == 0) {
      return res.status(403).json(errorResponse('无权限'));
    }

    let whereClause = '1=1';
    const params = [];

    if (keyword) {
      whereClause += ' AND c.content LIKE ?';
      params.push(`%${keyword}%`);
    }

    const [comments] = await pool.query(`
      SELECT c.*, u.username, LEFT(r.content, 50) as record_content
      FROM checkin_comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN checkin_records_new r ON c.record_id = r.id
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total FROM checkin_comments c WHERE ${whereClause}
    `, params);

    res.json(successResponse({
      list: comments,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    }));
  } catch (error) {
    console.error('Admin get comments error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const adminGetCategories = async (req, res) => {
  try {
    const userId = req.userId;

    const [userCheck] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0 || userCheck[0].role == 0) {
      return res.status(403).json(errorResponse('无权限'));
    }

    const [categories] = await pool.query(`
      SELECT c.*, 
        (SELECT COUNT(DISTINCT user_id) FROM checkin_records_new WHERE category_id = c.id) as join_count,
        (SELECT COUNT(*) FROM checkin_records_new WHERE category_id = c.id) as checkin_count,
        (SELECT COUNT(*) FROM checkin_pre_registers WHERE category_id = c.id) as pre_register_count
      FROM checkin_categories c
      ORDER BY c.sort_order ASC
    `);

    res.json(successResponse(categories));
  } catch (error) {
    console.error('Admin get categories error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const createCategory = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, description, cover_image, start_time, end_time, sort_order = 0, status = 1 } = req.body;

    const [userCheck] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0 || userCheck[0].role == 0) {
      return res.status(403).json(errorResponse('无权限'));
    }

    if (!name || !name.trim()) {
      return res.status(400).json(errorResponse('类别名称不能为空'));
    }

    const [result] = await pool.query(`
      INSERT INTO checkin_categories (name, description, cover_image, start_time, end_time, sort_order, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name.trim(), description || '', cover_image || '', start_time || null, end_time || null, sort_order, status]);

    res.json(successResponse({ id: result.insertId, message: '创建成功' }));
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updateCategory = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { name, description, cover_image, start_time, end_time, sort_order, status } = req.body;

    const [userCheck] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0 || userCheck[0].role == 0) {
      return res.status(403).json(errorResponse('无权限'));
    }

    const formatDateTime = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.toISOString().slice(0, 19).replace('T', ' ');
    };

    await pool.query(`
      UPDATE checkin_categories 
      SET name = ?, description = ?, cover_image = ?, start_time = ?, end_time = ?, sort_order = ?, status = ?
      WHERE id = ?
    `, [name, description, cover_image || '', formatDateTime(start_time), formatDateTime(end_time), sort_order, status, id]);

    res.json(successResponse({ message: '更新成功' }));
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const deleteCategory = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const [userCheck] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0 || userCheck[0].role == 0) {
      return res.status(403).json(errorResponse('无权限'));
    }

    await pool.query('DELETE FROM checkin_categories WHERE id = ?', [id]);

    res.json(successResponse({ message: '删除成功' }));
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const preRegister = async (req, res) => {
  try {
    const userId = req.userId;
    const { categoryId } = req.params;

    const [existing] = await pool.query(`
      SELECT id FROM checkin_pre_registers WHERE category_id = ? AND user_id = ?
    `, [categoryId, userId]);

    if (existing.length > 0) {
      await pool.query('DELETE FROM checkin_pre_registers WHERE id = ?', [existing[0].id]);
      res.json(successResponse({ registered: false, message: '取消预报名' }));
    } else {
      await pool.query(`
        INSERT INTO checkin_pre_registers (category_id, user_id) VALUES (?, ?)
      `, [categoryId, userId]);
      res.json(successResponse({ registered: true, message: '预报名成功' }));
    }
  } catch (error) {
    console.error('Pre-register error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getPreRegisters = async (req, res) => {
  try {
    const userId = req.userId;
    const { categoryId } = req.params;

    const [userCheck] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0 || userCheck[0].role == 0) {
      return res.status(403).json(errorResponse('无权限'));
    }

    const [registers] = await pool.query(`
      SELECT pr.*, u.username, u.studentId
      FROM checkin_pre_registers pr
      LEFT JOIN users u ON pr.user_id = u.id
      WHERE pr.category_id = ?
      ORDER BY pr.created_at DESC
    `, [categoryId]);

    res.json(successResponse(registers));
  } catch (error) {
    console.error('Get pre-registers error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getUserRecordsByCategory = async (req, res) => {
  try {
    const userId = req.userId;
    const { categoryId, targetUserId } = req.params;

    const [userCheck] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0 || userCheck[0].role == 0) {
      return res.status(403).json(errorResponse('无权限'));
    }

    const [records] = await pool.query(`
      SELECT * FROM checkin_records_new 
      WHERE category_id = ? AND user_id = ?
      ORDER BY checkin_time DESC
    `, [categoryId, targetUserId]);

    res.json(successResponse(records));
  } catch (error) {
    console.error('Get user records error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const exportRecords = async (req, res) => {
  try {
    const userId = req.userId;
    const { categoryId, targetUserId, startDate, endDate } = req.query;

    if (!userId) {
      return res.status(401).json(errorResponse('未登录'));
    }

    const [userCheck] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (userCheck.length === 0 || userCheck[0].role == 0) {
      return res.status(403).json(errorResponse('无权限'));
    }

    let query = `
      SELECT r.id, u.username, u.studentId, c.name as category_name, r.title, r.content, 
             r.checkin_time, r.like_count, r.comment_count
      FROM checkin_records_new r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN checkin_categories c ON r.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (categoryId) {
      query += ' AND r.category_id = ?';
      params.push(categoryId);
    }
    if (targetUserId) {
      query += ' AND r.user_id = ?';
      params.push(targetUserId);
    }
    if (startDate) {
      query += ' AND DATE(r.checkin_time) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(r.checkin_time) <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY r.checkin_time DESC';

    const [records] = await pool.query(query, params);

    const data = records.map((r, index) => ({
      '序号': index + 1,
      '用户名': r.username || '',
      '学号': r.studentId || '',
      '打卡类别': r.category_name || '',
      '标题': r.title || '',
      '内容': r.content || '',
      '打卡时间': r.checkin_time ? new Date(r.checkin_time).toLocaleString('zh-CN') : '',
      '点赞数': r.like_count || 0,
      '评论数': r.comment_count || 0
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const colWidths = [
      { wch: 6 }, { wch: 12 }, { wch: 15 }, { wch: 20 },
      { wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 8 }, { wch: 8 }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '打卡记录');

    const fileName = `打卡记录_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  } catch (error) {
    console.error('Export records error:', error);
    res.status(500).json(errorResponse('导出失败'));
  }
};

const toggleLike = async (req, res) => {
  try {
    const userId = req.userId;
    const { recordId } = req.params;

    const [existing] = await pool.query(`
      SELECT id FROM checkin_likes WHERE record_id = ? AND user_id = ?
    `, [recordId, userId]);

    if (existing.length > 0) {
      await pool.query('DELETE FROM checkin_likes WHERE id = ?', [existing[0].id]);
      await pool.query(`
        UPDATE checkin_records_new SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?
      `, [recordId]);

      res.json(successResponse({ liked: false, message: '取消点赞' }));
    } else {
      await pool.query(`
        INSERT INTO checkin_likes (record_id, user_id) VALUES (?, ?)
      `, [recordId, userId]);
      await pool.query(`
        UPDATE checkin_records_new SET like_count = like_count + 1 WHERE id = ?
      `, [recordId]);

      res.json(successResponse({ liked: true, message: '点赞成功' }));
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getComments = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [comments] = await pool.query(`
      SELECT c.*, u.username as nickname, u.avatar
      FROM checkin_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.record_id = ?
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [recordId, parseInt(limit), offset]);

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total FROM checkin_comments WHERE record_id = ?
    `, [recordId]);

    res.json(successResponse({
      list: comments,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    }));
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const createComment = async (req, res) => {
  try {
    const userId = req.userId;
    const { recordId } = req.params;
    const { content, parentId = 0 } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json(errorResponse('评论内容不能为空'));
    }

    const [result] = await pool.query(`
      INSERT INTO checkin_comments (record_id, user_id, content, parent_id)
      VALUES (?, ?, ?, ?)
    `, [recordId, userId, content.trim(), parentId]);

    await pool.query(`
      UPDATE checkin_records_new SET comment_count = comment_count + 1 WHERE id = ?
    `, [recordId]);

    res.json(successResponse({
      id: result.insertId,
      message: '评论成功'
    }));
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const deleteComment = async (req, res) => {
  try {
    const userId = req.userId;
    const { commentId } = req.params;

    const [existing] = await pool.query(`
      SELECT id, record_id FROM checkin_comments WHERE id = ? AND user_id = ?
    `, [commentId, userId]);

    if (existing.length === 0) {
      return res.status(404).json(errorResponse('评论不存在'));
    }

    const recordId = existing[0].record_id;

    await pool.query('DELETE FROM checkin_comments WHERE id = ?', [commentId]);

    await pool.query(`
      UPDATE checkin_records_new SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?
    `, [recordId]);

    res.json(successResponse({ message: '删除成功' }));
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updateComment = async (req, res) => {
  try {
    const userId = req.userId;
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json(errorResponse('评论内容不能为空'));
    }

    const [existing] = await pool.query(`
      SELECT id FROM checkin_comments WHERE id = ? AND user_id = ?
    `, [commentId, userId]);

    if (existing.length === 0) {
      return res.status(404).json(errorResponse('评论不存在或无权修改'));
    }

    await pool.query(`
      UPDATE checkin_comments SET content = ? WHERE id = ?
    `, [content.trim(), commentId]);

    res.json(successResponse({ message: '修改成功' }));
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

module.exports = {
  getCategories,
  getCategoryDetail,
  getDynamics,
  getMyRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  adminDeleteRecord,
  adminDeleteComment,
  adminGetRecords,
  adminGetComments,
  adminGetCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  preRegister,
  getPreRegisters,
  getUserRecordsByCategory,
  exportRecords,
  toggleLike,
  getComments,
  createComment,
  updateComment,
  deleteComment
};
