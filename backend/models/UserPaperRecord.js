const pool = require('../config/mysql');

class UserPaperRecord {
  // 创建组卷记录
  static async create(recordData) {
    const [result] = await pool.query(
      'INSERT INTO user_paper_records (user_id, paper_type, question_count, subject_id, config_json) VALUES (?, ?, ?, ?, ?)',
      [
        recordData.userId,
        recordData.paperType || 'smart',
        recordData.questionCount || 0,
        recordData.subjectId || null,
        recordData.configJson ? JSON.stringify(recordData.configJson) : null
      ]
    );
    return result.insertId;
  }

  // 获取用户今日组卷次数
  static async getTodayCount(userId) {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM user_paper_records WHERE user_id = ? AND DATE(created_at) = ?',
      [userId, today]
    );
    return rows[0].count;
  }

  // 获取用户组卷历史
  static async findByUser(userId, options = {}) {
    let sql = 'SELECT * FROM user_paper_records WHERE user_id = ?';
    const params = [userId];

    if (options.paperType) {
      sql += ' AND paper_type = ?';
      params.push(options.paperType);
    }

    sql += ' ORDER BY created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(options.limit));
    }

    const [rows] = await pool.query(sql, params);
    return rows;
  }
}

module.exports = UserPaperRecord;
