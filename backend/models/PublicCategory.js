const pool = require('../config/mysql');

class PublicCategory {
  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO public_categories (name, level, parentId, subject, sort) VALUES (?, ?, ?, ?, ?)',
      [data.name, data.level, data.parentId || 0, data.subject, data.sort || 0]
    );
    return { id: result.insertId, ...data };
  }

  static async find(query = {}) {
    let sql = 'SELECT * FROM public_categories WHERE 1=1';
    const params = [];
    if (query.subject) {
      sql += ' AND subject = ?';
      params.push(query.subject);
    }
    if (query.level) {
      sql += ' AND level = ?';
      params.push(query.level);
    }
    if (query.parentId !== undefined) {
      sql += ' AND parentId = ?';
      params.push(query.parentId);
    }
    if (query.name) {
      sql += ' AND name = ?';
      params.push(query.name);
    }
    sql += ' ORDER BY sort ASC, id ASC';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  static async findOne(query) {
    const rows = await this.find(query);
    return rows[0] || null;
  }

  static async getOrCreate(data) {
    let category = await this.findOne({
      name: data.name,
      level: data.level,
      parentId: data.parentId,
      subject: data.subject
    });
    if (!category) {
      category = await this.create(data);
    }
    return category;
  }
}

module.exports = PublicCategory;
