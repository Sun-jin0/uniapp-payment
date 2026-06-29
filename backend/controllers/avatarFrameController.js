const pool = require('../config/mysql');
const { successResponse, errorResponse } = require('../utils/response');

// 获取所有头像框
const getAvatarFrames = async (req, res) => {
  try {
    const { active } = req.query;
    let sql = 'SELECT * FROM avatar_frames';
    const params = [];

    if (active !== undefined) {
      sql += ' WHERE is_active = ?';
      params.push(active === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY sort_order ASC, id DESC';

    const [rows] = await pool.query(sql, params);
    res.json(successResponse(rows));
  } catch (error) {
    console.error('获取头像框列表失败:', error);
    res.status(500).json(errorResponse('获取头像框列表失败: ' + error.message));
  }
};

// 获取单个头像框
const getAvatarFrame = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM avatar_frames WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json(errorResponse('头像框不存在'));
    }

    res.json(successResponse(rows[0]));
  } catch (error) {
    console.error('获取头像框详情失败:', error);
    res.status(500).json(errorResponse('获取头像框详情失败: ' + error.message));
  }
};

// 创建头像框
const createAvatarFrame = async (req, res) => {
  try {
    const { 
      name, 
      image_url, 
      effect_code, 
      required_level, 
      required_points,
      required_question_count,
      allowed_user_type,
      is_active, 
      sort_order 
    } = req.body;

    if (!name || !image_url) {
      return res.status(400).json(errorResponse('名称和图片URL不能为空'));
    }

    const [result] = await pool.query(
      `INSERT INTO avatar_frames (name, image_url, effect_code, required_level, required_points, required_question_count, allowed_user_type, is_active, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, 
        image_url, 
        effect_code || '', 
        required_level || 1, 
        required_points || 0,
        required_question_count || 0,
        allowed_user_type || 0,
        is_active ?? 1, 
        sort_order || 0
      ]
    );

    const [rows] = await pool.query('SELECT * FROM avatar_frames WHERE id = ?', [result.insertId]);
    res.status(201).json(successResponse(rows[0], '头像框创建成功'));
  } catch (error) {
    console.error('创建头像框失败:', error);
    res.status(500).json(errorResponse('创建头像框失败: ' + error.message));
  }
};

// 更新头像框
const updateAvatarFrame = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      image_url, 
      effect_code, 
      required_level, 
      required_points,
      required_question_count,
      allowed_user_type,
      is_active, 
      sort_order 
    } = req.body;

    const [existing] = await pool.query('SELECT * FROM avatar_frames WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json(errorResponse('头像框不存在'));
    }

    await pool.query(
      `UPDATE avatar_frames 
       SET name = ?, image_url = ?, effect_code = ?, required_level = ?, required_points = ?, required_question_count = ?, allowed_user_type = ?, is_active = ?, sort_order = ?
       WHERE id = ?`,
      [
        name ?? existing[0].name,
        image_url ?? existing[0].image_url,
        effect_code ?? existing[0].effect_code,
        required_level ?? existing[0].required_level,
        required_points ?? existing[0].required_points,
        required_question_count ?? existing[0].required_question_count ?? 0,
        allowed_user_type ?? existing[0].allowed_user_type ?? 0,
        is_active ?? existing[0].is_active,
        sort_order ?? existing[0].sort_order,
        id
      ]
    );

    const [rows] = await pool.query('SELECT * FROM avatar_frames WHERE id = ?', [id]);
    res.json(successResponse(rows[0], '头像框更新成功'));
  } catch (error) {
    console.error('更新头像框失败:', error);
    res.status(500).json(errorResponse('更新头像框失败: ' + error.message));
  }
};

// 删除头像框
const deleteAvatarFrame = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM avatar_frames WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json(errorResponse('头像框不存在'));
    }

    await pool.query('DELETE FROM avatar_frames WHERE id = ?', [id]);
    res.json(successResponse(null, '头像框删除成功'));
  } catch (error) {
    console.error('删除头像框失败:', error);
    res.status(500).json(errorResponse('删除头像框失败: ' + error.message));
  }
};

// 批量更新头像框状态
const batchUpdateAvatarFrameStatus = async (req, res) => {
  try {
    const { ids, is_active } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json(errorResponse('请选择要操作的头像框'));
    }

    const placeholders = ids.map(() => '?').join(',');
    await pool.query(
      `UPDATE avatar_frames SET is_active =? WHERE id IN (${placeholders})`,
      [is_active, ...ids]
    );

    res.json(successResponse(null, `成功更新 ${ids.length} 个头像框状态`));
  } catch (error) {
    console.error('批量更新头像框状态失败:', error);
    res.status(500).json(errorResponse('批量更新状态失败: ' + error.message));
  }
};

// 获取用户可用的头像框列表
const getUserAvatarFrames = async (req, res) => {
  try {
    const userId = req.userId;
    const user = req.user;
    
    if (!user) {
      return res.status(401).json(errorResponse('用户不存在'));
    }

    const userLevel = user.level || 1;
    const userPoints = user.points || 0;
    const userQuestionCount = user.total_questions || 0;
    const userStudentId = user.student_id || '';
    const userRole = user.role || 0;

    // 判断用户类型
    // studentId 以 WX 开头为微信用户
    const isWeChatUser = userStudentId.startsWith('WX');
    // role !== 0 为管理员
    const isAdminUser = userRole !== 0;

    // 获取所有启用的头像框
    const [allFrames] = await pool.query(
      `SELECT * FROM avatar_frames WHERE is_active = 1 ORDER BY sort_order ASC`
    );

    // 为每个头像框添加可用状态
    const framesWithStatus = allFrames.map(frame => {
      let isAvailable = true;
      let unavailableReason = '';

      // 管理员可以任意使用
      if (isAdminUser) {
        return { ...frame, is_available: true };
      }

      // 检查用户类型权限
      const allowedUserType = frame.allowed_user_type || 0;
      switch (allowedUserType) {
        case 1: // 仅账号密码用户
          if (isWeChatUser || isAdminUser) {
            isAvailable = false;
            unavailableReason = '仅限账号密码用户';
          }
          break;
        case 2: // 仅微信用户
          if (!isWeChatUser && !isAdminUser) {
            isAvailable = false;
            unavailableReason = '仅限微信用户';
          }
          break;
        case 3: // 仅管理员
          isAvailable = false;
          unavailableReason = '仅限管理员';
          break;
        default: // 0: 所有用户
          break;
      }

      // 检查等级要求
      if (isAvailable && frame.required_level && frame.required_level > userLevel) {
        isAvailable = false;
        unavailableReason = `需要等级 ${frame.required_level}`;
      }

      // 检查积分要求
      if (isAvailable && frame.required_points && frame.required_points > userPoints) {
        isAvailable = false;
        unavailableReason = `需要积分 ${frame.required_points}`;
      }

      // 检查做题数量要求
      if (isAvailable && frame.required_question_count && frame.required_question_count > userQuestionCount) {
        isAvailable = false;
        unavailableReason = `需要完成 ${frame.required_question_count} 题`;
      }

      return {
        ...frame,
        is_available: isAvailable,
        unavailable_reason: unavailableReason
      };
    });

    res.json(successResponse(framesWithStatus));
  } catch (error) {
    console.error('获取用户可用头像框失败:', error);
    res.status(500).json(errorResponse('获取用户可用头像框失败: ' + error.message));
  }
};

const setUserAvatarFrame = async (req, res) => {
  try {
    const userId = req.userId;
    const user = req.user;
    const { avatar_frame_id } = req.body;

    // 如果 avatar_frame_id 为 null 或 0，表示清除头像框
    if (!avatar_frame_id || avatar_frame_id === 0) {
      await pool.query(
        'UPDATE users SET avatar_frame_id = NULL WHERE id = ?',
        [userId]
      );
      return res.json(successResponse(null, '已清除头像框'));
    }

    // 查询头像框是否存在且用户有权限使用
    const [frames] = await pool.query(
      'SELECT * FROM avatar_frames WHERE id = ? AND is_active = 1',
      [avatar_frame_id]
    );

    if (frames.length === 0) {
      return res.status(404).json(errorResponse('头像框不存在或已禁用'));
    }

    const frame = frames[0];
    const userRole = user.role || 0;
    const isAdminUser = userRole !== 0;
    const userQuestionCount = user.total_questions || 0;
    const userStudentId = user.student_id || '';
    const isWeChatUser = userStudentId.startsWith('WX');

    // 检查权限
    if (!isAdminUser) {
      // 检查用户类型权限
      const allowedUserType = frame.allowed_user_type || 0;
      switch (allowedUserType) {
        case 1:
          if (isWeChatUser) return res.status(403).json(errorResponse('此头像框仅限账号密码用户使用'));
          break;
        case 2:
          if (!isWeChatUser) return res.status(403).json(errorResponse('此头像框仅限微信用户使用'));
          break;
        case 3:
          return res.status(403).json(errorResponse('此头像框仅限管理员使用'));
        default:
          break;
      }

      // 检查做题数量要求
      if (frame.required_question_count && frame.required_question_count > userQuestionCount) {
        return res.status(403).json(errorResponse(`还需完成 ${frame.required_question_count - userQuestionCount} 道题目才能使用此头像框`));
      }

      // 检查等级要求
      if (frame.required_level && frame.required_level > (user.level || 1)) {
        return res.status(403).json(errorResponse(`等级达到 ${frame.required_level} 才能使用此头像框`));
      }

      // 检查积分要求
      if (frame.required_points && frame.required_points > (user.points || 0)) {
        return res.status(403).json(errorResponse(`积分达到 ${frame.required_points} 才能使用此头像框`));
      }
    }

    // 更新用户头像框
    await pool.query(
      'UPDATE users SET avatar_frame_id = ? WHERE id = ?',
      [avatar_frame_id, userId]
    );

    res.json(successResponse({ avatar_frame_id }, '头像框设置成功'));
  } catch (error) {
    console.error('设置头像框失败:', error);
    res.status(500).json(errorResponse('设置头像框失败: ' + error.message));
  }
};

module.exports = {
  getAvatarFrames,
  getAvatarFrame,
  createAvatarFrame,
  updateAvatarFrame,
  deleteAvatarFrame,
  batchUpdateAvatarFrameStatus,
  getUserAvatarFrames,
  setUserAvatarFrame
};
