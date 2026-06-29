const pool = require('../config/mysql');

class UserDrawCount {
  // 获取用户剩余次数
  static async getByUserId(userId) {
    const [rows] = await pool.query(
      'SELECT * FROM user_draw_counts WHERE user_id = ?',
      [userId]
    );
    return rows[0] || null;
  }

  // 增加次数
  static async increment(userId, amount = 1) {
    const [result] = await pool.query(
      `INSERT INTO user_draw_counts (user_id, remaining_draws, total_draws)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
       remaining_draws = remaining_draws + ?,
       total_draws = total_draws + ?`,
      [userId, amount, amount, amount, amount]
    );
    return result;
  }

  // 减少次数
  static async decrement(userId) {
    const [result] = await pool.query(
      `UPDATE user_draw_counts
       SET remaining_draws = GREATEST(remaining_draws - 1, 0)
       WHERE user_id = ? AND remaining_draws > 0`,
      [userId]
    );
    return result.affectedRows > 0;
  }

  // 检查是否有剩余次数
  static async hasRemaining(userId) {
    const [rows] = await pool.query(
      'SELECT remaining_draws FROM user_draw_counts WHERE user_id = ?',
      [userId]
    );
    return rows.length > 0 && rows[0].remaining_draws > 0;
  }
}

module.exports = UserDrawCount;
