const pool = require('../config/mysql');

class Card {
  // 获取所有卡片（包括禁用和启用的）
  static async findAll(options = {}) {
    let sql = 'SELECT * FROM cards';
    const params = [];
    const conditions = [];
    
    if (options.where) {
      if (options.where.is_active !== undefined) {
        conditions.push('is_active = ?');
        params.push(options.where.is_active);
      }
      // 添加 is_reward 筛选
      if (options.where.is_reward !== undefined) {
        conditions.push('is_reward = ?');
        params.push(options.where.is_reward);
      }
    }
    
    // 如果有条件，添加 WHERE 子句
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY sort_order ASC, id ASC';
    
    const [rows] = await pool.query(sql, params);
    return rows;
  }
  
  // 根据ID查找卡片
  static async findByPk(id) {
    const [rows] = await pool.query('SELECT * FROM cards WHERE id = ?', [id]);
    return rows[0] || null;
  }
  
  // 创建卡片
  static async create(data) {
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(', ');
    const values = Object.values(data);
    
    const sql = `INSERT INTO cards (${fields.join(', ')}) VALUES (${placeholders})`;
    const [result] = await pool.query(sql, values);
    
    return { id: result.insertId, ...data };
  }
  
  // 更新卡片
  static async update(data, options) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    
    let sql = `UPDATE cards SET ${fields.map(f => `${f} = ?`).join(', ')}`;
    
    if (options.where && options.where.id) {
      sql += ' WHERE id = ?';
      values.push(options.where.id);
    }
    
    const [result] = await pool.query(sql, values);
    return result;
  }
  
  // 增加抽取次数和拥有人数
  static async incrementStats(id, isNewOwner) {
    let sql = 'UPDATE cards SET draw_count = draw_count + 1';
    if (isNewOwner) {
      sql += ', owner_count = owner_count + 1';
    }
    sql += ' WHERE id = ?';
    
    await pool.query(sql, [id]);
  }
  
  // 只增加抽取次数
  static async incrementDrawCount(id) {
    const sql = 'UPDATE cards SET draw_count = draw_count + 1 WHERE id = ?';
    await pool.query(sql, [id]);
  }
}

module.exports = Card;
