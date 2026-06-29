const pool = require('../config/mysql');

class User {
  static async find(query = {}) {
    let sql = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    
    if (query.status !== undefined) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    
    if (query.$or) {
      const orClauses = [];
      query.$or.forEach(orQuery => {
        for (const [key, value] of Object.entries(orQuery)) {
          if (value && typeof value === 'object' && value.$regex) {
            orClauses.push(`${key} LIKE ?`);
            params.push(`%${value.$regex}%`);
          } else {
            orClauses.push(`${key} = ?`);
            params.push(value);
          }
        }
      });
      if (orClauses.length > 0) {
        sql += ` AND (${orClauses.join(' OR ')})`;
      }
    }

    sql += ' ORDER BY registerDate DESC';
    
    if (query.skip !== undefined && query.limit !== undefined) {
      sql += ' LIMIT ?, ?';
      params.push(parseInt(query.skip), parseInt(query.limit));
    }
    
    const [rows] = await pool.query(sql, params);
    return rows.map(r => this.formatUser(r));
  }

  static async countDocuments(query = {}) {
    let sql = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
    const params = [];
    
    if (query.status !== undefined) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    
    if (query.$or) {
      const orClauses = [];
      query.$or.forEach(orQuery => {
        for (const [key, value] of Object.entries(orQuery)) {
          if (value && typeof value === 'object' && value.$regex) {
            orClauses.push(`${key} LIKE ?`);
            params.push(`%${value.$regex}%`);
          } else {
            orClauses.push(`${key} = ?`);
            params.push(value);
          }
        }
      });
      if (orClauses.length > 0) {
        sql += ` AND (${orClauses.join(' OR ')})`;
      }
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }

  static async findOne(query) {
    let sql = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    
    if (query.username) {
      sql += ' AND username = ?';
      params.push(query.username);
    }
    if (query.studentId) {
      sql += ' AND studentId = ?';
      params.push(query.studentId);
    }
    if (query.openid) {
      sql += ' AND openid = ?';
      params.push(query.openid);
    }
    if (query.status !== undefined) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    if (query.$or) {
      const orClauses = [];
      query.$or.forEach(orQuery => {
        if (orQuery.username) {
          orClauses.push('username = ?');
          params.push(orQuery.username);
        }
        if (orQuery.studentId) {
          orClauses.push('studentId = ?');
          params.push(orQuery.studentId);
        }
      });
      if (orClauses.length > 0) {
        sql += ` AND (${orClauses.join(' OR ')})`;
      }
    }

    console.log('User.findOne SQL:', sql, params);
    const [rows] = await pool.query(sql, params);
    return rows[0] ? this.formatUser(rows[0]) : null;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] ? this.formatUser(rows[0]) : null;
  }

  static async create(userData) {
    // 为微信登录用户生成随机密码和学号
    const password = userData.password || Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const studentId = userData.studentId || `WX${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const loginType = userData.loginType || 'wechat';
    
    const [result] = await pool.query(
      'INSERT INTO users (username, password, studentId, phone, avatar, openid, login_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userData.username, password, studentId, userData.phone || null, userData.avatar || null, userData.openid || null, loginType]
    );
    
    return await this.findById(result.insertId);
  }

  static async updateById(id, updateData) {
    const fields = [];
    const params = [];
    
    for (const [key, value] of Object.entries(updateData)) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
    
    if (fields.length === 0) return;
    
    params.push(id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  static formatUser(user) {
    if (!user) return null;
    return {
      ...user,
      _id: user.id, // 保持兼容性
      paperLimitDaily: user.paper_limit_daily || 1,
      paperMaxQuestions: user.paper_max_questions || 22,
      paperUsedToday: user.paper_used_today || 0,
      paperLastDate: user.paper_last_date,
      printLimitDaily: user.print_limit_daily !== null ? user.print_limit_daily : 1,
      printUsedToday: user.print_used_today || 0,
      printLastDate: user.print_last_date,
      printAnalysisLimit: user.print_analysis_limit !== null ? user.print_analysis_limit : 1,
      printAnalysisUsed: user.print_analysis_used || 0,
      isSuperAdmin: user.is_super_admin === 1,
      comparePassword: async (candidatePassword) => {
        return candidatePassword === user.password;
      }
    };
  }

  // 检查用户组卷权限（只限制题目数量，不限制次数）
  // role: 0=普通用户, 1=超级管理员, 2,3,4...=其他管理员
  static async checkPaperPermission(userId) {
    const user = await this.findById(userId);
    if (!user) {
      return { allowed: false, message: '用户不存在' };
    }

    const role = user.role || 0;

    // 超级管理员(role=1)不受限制
    if (role === 1) {
      return { 
        allowed: true, 
        role: role,
        maxQuestions: null  // null 表示无限制
      };
    }

    const maxQuestions = user.paper_max_questions !== null ? user.paper_max_questions : 22;

    return { 
      allowed: true, 
      role: role,
      maxQuestions: maxQuestions === -1 ? null : maxQuestions  // -1 也表示无限制
    };
  }

  // 检查用户打印权限（总次数限制，与打印解析一致）
  static async checkPrintPermission(userId) {
    // 直接从数据库查询最新数据，避免缓存
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    const user = rows[0];
    
    if (!user) {
      return { allowed: false, message: '用户不存在' };
    }

    const role = user.role || 0;

    // 超级管理员(role=1)不受限制
    if (role === 1) {
      return { 
        allowed: true, 
        role: role,
        limit: null,
        used: 0,
        remaining: null
      };
    }

    const today = new Date().toISOString().split('T')[0];
    
    // 将数据库中的日期转换为 YYYY-MM-DD 格式进行比较
    const lastDate = user.print_last_date ? new Date(user.print_last_date).toISOString().split('T')[0] : null;
    
    // 如果不是今天，重置计数
    if (lastDate !== today) {
      console.log('[checkPrintPermission] 日期不匹配，重置打印计数');
      await pool.query(
        'UPDATE users SET print_used_today = 0, print_last_date = ? WHERE id = ?',
        [today, userId]
      );
      user.print_used_today = 0;
    }

    const limit = user.print_limit_daily !== null ? user.print_limit_daily : 1;
    const used = user.print_used_today || 0;
    
    // -1 表示无限制
    if (limit === -1) {
      return { 
        allowed: true, 
        role: role,
        limit: null,
        used,
        remaining: null
      };
    }

    const remaining = limit - used;

    if (remaining <= 0) {
      return { 
        allowed: false, 
        message: `打印次数已用完（共限制${limit}次）`,
        role: role,
        limit,
        used,
        remaining: 0
      };
    }

    return { 
      allowed: true, 
      role: role,
      limit,
      used,
      remaining
    };
  }

  // 增加用户打印次数
  static async incrementPrintCount(userId) {
    const today = new Date().toISOString().split('T')[0];
    console.log(`[incrementPrintCount] userId: ${userId}, today: ${today}`);
    const [result] = await pool.query(
      'UPDATE users SET print_used_today = print_used_today + 1, print_last_date = ? WHERE id = ?',
      [today, userId]
    );
    console.log(`[incrementPrintCount] 更新结果:`, result);
    return result;
  }

  // 检查用户打印解析权限（总次数限制）
  static async checkPrintAnalysisPermission(userId) {
    const user = await this.findById(userId);
    if (!user) {
      return { allowed: false, message: '用户不存在' };
    }

    const role = user.role || 0;

    // 超级管理员(role=1)不受限制
    if (role === 1) {
      return { 
        allowed: true, 
        role: role,
        limit: null,
        used: 0,
        remaining: null
      };
    }

    const limit = user.print_analysis_limit !== null ? user.print_analysis_limit : 1;
    const used = user.print_analysis_used || 0;
    
    // -1 表示无限制
    if (limit === -1) {
      return { 
        allowed: true, 
        role: role,
        limit: null,
        used,
        remaining: null
      };
    }

    const remaining = limit - used;

    if (remaining <= 0) {
      return { 
        allowed: false, 
        message: `打印解析次数已用完（共限制${limit}次）`,
        role: role,
        limit,
        used,
        remaining: 0
      };
    }

    return { 
      allowed: true, 
      role: role,
      limit,
      used,
      remaining
    };
  }

  // 增加用户打印解析次数
  static async incrementPrintAnalysisCount(userId) {
    await pool.query(
      'UPDATE users SET print_analysis_used = print_analysis_used + 1 WHERE id = ?',
      [userId]
    );
  }

  // 更新用户限制设置（管理员使用）
  static async updateUserLimits(userId, { paperMaxQuestions, printLimitDaily, printAnalysisLimit }) {
    const fields = [];
    const params = [];
    
    if (paperMaxQuestions !== undefined) {
      fields.push('paper_max_questions = ?');
      params.push(paperMaxQuestions);
    }
    if (printLimitDaily !== undefined) {
      fields.push('print_limit_daily = ?');
      params.push(printLimitDaily);
    }
    if (printAnalysisLimit !== undefined) {
      fields.push('print_analysis_limit = ?');
      params.push(printAnalysisLimit);
    }
    
    if (fields.length === 0) return;
    
    params.push(userId);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  }
}

module.exports = User;
