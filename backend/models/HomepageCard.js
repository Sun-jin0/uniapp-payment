const pool = require('../config/mysql');

class HomepageCard {
  static async findAll() {
    const [rows] = await pool.query(
      'SELECT * FROM homepage_cards WHERE is_active = 1 ORDER BY category DESC, sort_order ASC'
    );
    return rows;
  }

  static async findByCategory(category) {
    const [rows] = await pool.query(
      'SELECT * FROM homepage_cards WHERE is_active = 1 AND category = ? ORDER BY sort_order ASC',
      [category]
    );
    return rows;
  }

  static async findAllAdmin() {
    const [rows] = await pool.query(
      'SELECT * FROM homepage_cards ORDER BY category DESC, sort_order ASC'
    );
    return rows;
  }

  static async create(data) {
    const { title, category, description, icon, text_icon, color, url, image_url, height, sort_order, is_active, is_tab } = data;
    const [result] = await pool.query(
      'INSERT INTO homepage_cards (title, category, description, icon, text_icon, color, url, image_url, height, sort_order, is_active, is_tab) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, category || 'public', description, icon, text_icon, color, url, image_url, height || 100, sort_order || 0, is_active ?? 1, is_tab ?? 0]
    );
    return result.insertId;
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    
    // 只更新提供的字段
    const allowedFields = ['title', 'category', 'description', 'icon', 'text_icon', 'color', 'url', 'image_url', 'height', 'sort_order', 'is_active', 'is_tab'];
    
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }
    
    if (fields.length === 0) {
      return true; // 没有要更新的字段
    }
    
    values.push(id);
    const sql = `UPDATE homepage_cards SET ${fields.join(', ')} WHERE id = ?`;
    await pool.query(sql, values);
    return true;
  }

  static async delete(id) {
    await pool.query('DELETE FROM homepage_cards WHERE id = ?', [id]);
    return true;
  }

  static async updateSortOrder(id, sort_order) {
    await pool.query('UPDATE homepage_cards SET sort_order = ? WHERE id = ?', [sort_order, id]);
    return true;
  }
}

module.exports = HomepageCard;
