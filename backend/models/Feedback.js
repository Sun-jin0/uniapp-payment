const pool = require('../config/mysql');

class Feedback {
  static async find(query = {}) {
    let sql = `
      SELECT f.*, u.username, u.studentId, q.content as questionContent
      FROM feedbacks f
      LEFT JOIN users u ON f.userId = u.id
      LEFT JOIN questions q ON f.questionId = q.id
      WHERE 1=1
    `;
    const params = [];
    
    if (query.type) {
      sql += ' AND f.type = ?';
      params.push(query.type);
    }
    if (query.status !== undefined) {
      sql += ' AND f.status = ?';
      params.push(query.status);
    }

    sql += ' ORDER BY f.createdAt DESC';
    
    if (query.skip !== undefined && query.limit !== undefined) {
      sql += ' LIMIT ?, ?';
      params.push(parseInt(query.skip), parseInt(query.limit));
    }
    
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({
      ...r,
      _id: r.id,
      userId: { _id: r.userId, username: r.username, studentId: r.studentId },
      questionId: r.questionId ? { _id: r.questionId, content: r.questionContent } : null
    }));
  }

  static async countDocuments(query = {}) {
    let sql = 'SELECT COUNT(*) as count FROM feedbacks WHERE 1=1';
    const params = [];
    
    if (query.type) {
      sql += ' AND type = ?';
      params.push(query.type);
    }
    if (query.status !== undefined) {
      sql += ' AND status = ?';
      params.push(query.status);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM feedbacks WHERE id = ?', [id]);
    return rows[0] ? { ...rows[0], _id: rows[0].id } : null;
  }

  static async updateById(id, updateData) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updateData)) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
    params.push(id);
    await pool.query(`UPDATE feedbacks SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO feedbacks (userId, questionId, type, content, contact, status) VALUES (?, ?, ?, ?, ?, ?)',
      [data.userId, data.questionId || null, data.type, data.content, data.contact || null, data.status || 1]
    );
    return { id: result.insertId, _id: result.insertId, ...data };
  }
}

module.exports = Feedback;
