const pool = require('../config/mysql');

class UserPity {
  // 获取或创建用户保底记录
  static async getOrCreate(userId) {
    const [rows] = await pool.query(
      'SELECT * FROM user_pity_records WHERE user_id = ?',
      [userId]
    );
    
    if (rows.length > 0) {
      return rows[0];
    }
    
    // 创建新记录
    await pool.query(
      'INSERT INTO user_pity_records (user_id, pity_counter, daily_first_draw) VALUES (?, 0, FALSE)',
      [userId]
    );
    
    return { user_id: userId, pity_counter: 0, daily_first_draw: false };
  }
  
  // 更新保底计数器
  static async incrementPity(userId) {
    await pool.query(
      'UPDATE user_pity_records SET pity_counter = pity_counter + 1 WHERE user_id = ?',
      [userId]
    );
  }
  
  // 重置保底计数器
  static async resetPity(userId) {
    await pool.query(
      'UPDATE user_pity_records SET pity_counter = 0 WHERE user_id = ?',
      [userId]
    );
  }
  
  // 检查并更新每日首抽状态
  static async checkDailyFirstDraw(userId) {
    const today = new Date().toISOString().split('T')[0];
    const record = await this.getOrCreate(userId);
    
    // 将数据库日期转换为 YYYY-MM-DD 格式进行比较
    let recordDate = record.last_draw_date;
    if (recordDate) {
      const date = new Date(recordDate);
      recordDate = date.toISOString().split('T')[0];
    }
    
    // 如果日期不同，重置每日首抽状态
    if (recordDate !== today) {
      await pool.query(
        'UPDATE user_pity_records SET daily_first_draw = FALSE, last_draw_date = ? WHERE user_id = ?',
        [today, userId]
      );
      return false; // 今日还未首抽
    }
    
    return record.daily_first_draw;
  }
  
  // 标记今日已首抽
  static async markDailyFirstDraw(userId) {
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      'UPDATE user_pity_records SET daily_first_draw = TRUE, last_draw_date = ? WHERE user_id = ?',
      [today, userId]
    );
  }
  
  // 获取当前保底计数
  static async getPityCount(userId) {
    const record = await this.getOrCreate(userId);
    return record.pity_counter;
  }
}

module.exports = UserPity;
