const pool = require('../config/mysql');

class Chapter {
  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO chapters (subjectId, title, parentId, sort, status) VALUES (?, ?, ?, ?, ?)',
      [data.subjectId, data.title, data.parentId || null, data.sort || 0, data.status !== undefined ? data.status : 1]
    );
    return { id: result.insertId, _id: result.insertId, ...data };
  }

  static async findByIdAndUpdate(id, updateData) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updateData)) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
    params.push(id);
    await pool.query(`UPDATE chapters SET ${fields.join(', ')} WHERE id = ?`, params);
    return await this.findById(id);
  }

  static async findByIdAndDelete(id) {
    const chapter = await this.findById(id);
    if (chapter) {
      await pool.query('DELETE FROM chapters WHERE id = ?', [id]);
    }
    return chapter;
  }

  static async find(query = {}) {
    let sql = 'SELECT * FROM chapters WHERE 1=1';
    const params = [];
    
    if (query.subjectId) {
      sql += ' AND subjectId = ?';
      params.push(query.subjectId);
    }
    if (query.parentId !== undefined) {
      if (query.parentId === null) {
        sql += ' AND parentId IS NULL';
      } else {
        sql += ' AND parentId = ?';
        params.push(query.parentId);
      }
    }
    if (query.status !== undefined) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    if (query.title && query.title.$regex) {
      sql += ' AND title LIKE ?';
      params.push(`%${query.title.$regex}%`);
    }

    sql += ' ORDER BY sort ASC, createdAt ASC';
    
    if (query.skip !== undefined && query.limit !== undefined) {
      sql += ' LIMIT ?, ?';
      params.push(parseInt(query.skip), parseInt(query.limit));
    }
    
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({ ...r, _id: r.id }));
  }

  static async countDocuments(query = {}) {
    let sql = 'SELECT COUNT(*) as count FROM chapters WHERE 1=1';
    const params = [];
    
    if (query.subjectId) {
      sql += ' AND subjectId = ?';
      params.push(query.subjectId);
    }
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
    const [rows] = await pool.query('SELECT * FROM chapters WHERE id = ?', [id]);
    return rows[0] ? { ...rows[0], _id: rows[0].id } : null;
  }
}

module.exports = Chapter;
