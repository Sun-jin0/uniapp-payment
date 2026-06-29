const pool = require('../config/mysql');

class UserCard {
  // 查找用户的卡片记录
  static async findAll(options = {}) {
    let sql = `
      SELECT uc.*, c.name, c.description, c.image_url, c.rarity 
      FROM user_cards uc 
      JOIN cards c ON uc.card_id = c.id 
      WHERE 1=1
    `;
    const params = [];
    
    if (options.where) {
      if (options.where.user_id) {
        sql += ' AND uc.user_id = ?';
        params.push(options.where.user_id);
      }
      if (options.where.card_id) {
        sql += ' AND uc.card_id = ?';
        params.push(options.where.card_id);
      }
      if (options.where.draw_date) {
        sql += ' AND uc.draw_date = ?';
        params.push(options.where.draw_date);
      }
    }
    
    if (options.order) {
      sql += ` ORDER BY uc.${options.order[0]} ${options.order[1]}`;
    }
    
    const [rows] = await pool.query(sql, params);
    return rows;
  }
  
  // 查找单条记录
  static async findOne(options = {}) {
    let sql = `
      SELECT uc.*, c.name, c.description, c.image_url, c.rarity 
      FROM user_cards uc 
      JOIN cards c ON uc.card_id = c.id 
      WHERE 1=1
    `;
    const params = [];
    
    if (options.where) {
      if (options.where.user_id) {
        sql += ' AND uc.user_id = ?';
        params.push(options.where.user_id);
      }
      if (options.where.card_id) {
        sql += ' AND uc.card_id = ?';
        params.push(options.where.card_id);
      }
      if (options.where.draw_date) {
        sql += ' AND uc.draw_date = ?';
        params.push(options.where.draw_date);
      }
    }
    
    sql += ' LIMIT 1';
    
    const [rows] = await pool.query(sql, params);
    return rows[0] || null;
  }
  
  // 检查用户是否已有某张卡
  static async exists(userId, cardId) {
    const [rows] = await pool.query(
      'SELECT id FROM user_cards WHERE user_id = ? AND card_id = ?',
      [userId, cardId]
    );
    return rows.length > 0;
  }
  
  // 创建记录
  static async create(data) {
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(', ');
    const values = Object.values(data);
    
    const sql = `INSERT INTO user_cards (${fields.join(', ')}) VALUES (${placeholders})`;
    const [result] = await pool.query(sql, values);
    
    return { id: result.insertId, ...data };
  }
  
  // 获取用户的所有卡片ID
  static async getUserCardIds(userId) {
    const [rows] = await pool.query(
      'SELECT card_id FROM user_cards WHERE user_id = ?',
      [userId]
    );
    return rows.map(r => r.card_id);
  }

  // 获取用户抽卡统计
  static async getUserStats(userId) {
    // 总抽卡次数
    const [totalRows] = await pool.query(
      'SELECT COUNT(*) as total FROM user_cards WHERE user_id = ?',
      [userId]
    );

    // 拥有的不同卡片数量
    const [uniqueRows] = await pool.query(
      'SELECT COUNT(DISTINCT card_id) as unique_count FROM user_cards WHERE user_id = ?',
      [userId]
    );

    // 本月抽卡次数
    const [monthRows] = await pool.query(
      `SELECT COUNT(*) as month_count FROM user_cards 
       WHERE user_id = ? AND draw_date >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [userId]
    );

    // 连续抽卡天数
    const [streakRows] = await pool.query(
      `SELECT draw_date FROM user_cards 
       WHERE user_id = ? 
       ORDER BY draw_date DESC`,
      [userId]
    );

    let streakDays = 0;
    if (streakRows.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      // 检查今天或昨天是否有抽卡
      const hasToday = streakRows.some(r => r.draw_date === today);
      const hasYesterday = streakRows.some(r => r.draw_date === yesterday);
      
      if (hasToday || hasYesterday) {
        streakDays = 1;
        const dates = [...new Set(streakRows.map(r => r.draw_date))].sort().reverse();
        
        for (let i = 1; i < dates.length; i++) {
          const prevDate = new Date(dates[i - 1]);
          const currDate = new Date(dates[i]);
          const diffDays = (prevDate - currDate) / (1000 * 60 * 60 * 24);
          
          if (diffDays === 1) {
            streakDays++;
          } else {
            break;
          }
        }
      }
    }

    return {
      totalDraws: totalRows[0].total,
      uniqueCards: uniqueRows[0].unique_count,
      monthDraws: monthRows[0].month_count,
      streakDays: streakDays
    };
  }

  // 获取用户抽卡历史记录
  static async getDrawHistory(userId, limit = 30) {
    const [rows] = await pool.query(
      `SELECT uc.*, c.name, c.description, c.image_url, c.rarity 
       FROM user_cards uc 
       JOIN cards c ON uc.card_id = c.id 
       WHERE uc.user_id = ? 
       ORDER BY uc.draw_date DESC, uc.id DESC 
       LIMIT ?`,
      [userId, limit]
    );
    return rows;
  }
  
  // 获取用户拥有某张卡片的数量
  static async getCountByUserIdAndCardId(userId, cardId) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM user_cards WHERE user_id = ? AND card_id = ?',
      [userId, cardId]
    );
    return rows[0].count;
  }
}

module.exports = UserCard;
