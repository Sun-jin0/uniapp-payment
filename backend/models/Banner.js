const pool = require('../config/mysql');

class Banner {
  static async find(query = {}) {
    let sql = 'SELECT * FROM banners WHERE 1=1';
    const params = [];
    
    if (query.status !== undefined) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    
    if (query.title && query.title.$regex) {
      sql += ' AND title LIKE ?';
      params.push(`%${query.title.$regex}%`);
    }

    sql += ' ORDER BY sort ASC, createdAt DESC';
    
    if (query.skip !== undefined && query.limit !== undefined) {
      sql += ' LIMIT ?, ?';
      params.push(parseInt(query.skip), parseInt(query.limit));
    }
    
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({ ...r, _id: r.id }));
  }

  static async countDocuments(query = {}) {
    let sql = 'SELECT COUNT(*) as count FROM banners WHERE 1=1';
    const params = [];
    
    if (query.status !== undefined) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    
    if (query.title && query.title.$regex) {
      sql += ' AND title LIKE ?';
      params.push(`%${query.title.$regex}%`);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM banners WHERE id = ?', [id]);
    return rows[0] ? { ...rows[0], _id: rows[0].id } : null;
  }

  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO banners (title, imageUrl, link, sort, status) VALUES (?, ?, ?, ?, ?)',
      [data.title, data.imageUrl, data.link || null, data.sort || 0, data.status !== undefined ? data.status : 1]
    );
    return { id: result.insertId, _id: result.insertId, ...data };
  }

  static async findByIdAndUpdate(id, updateData) {
    const fields = [];
    const params = [];
    const excludedFields = ['_id', 'id', 'createdAt', 'created_at', 'createTime', 'updateTime', 'mongo_id'];
    for (const [key, value] of Object.entries(updateData)) {
      if (!excludedFields.includes(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    if (fields.length === 0) {
      return await this.findById(id);
    }
    await pool.query(`UPDATE banners SET ${fields.join(', ')} WHERE id = ?`, params);
    return await this.findById(id);
  }

  static async findByIdAndDelete(id) {
    const banner = await this.findById(id);
    if (banner) {
      await pool.query('DELETE FROM banners WHERE id = ?', [id]);
    }
    return banner;
  }
}

module.exports = Banner;
