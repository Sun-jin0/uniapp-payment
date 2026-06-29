const pool = require('../config/mysql');

class Essay {
  static async find(query = {}) {
    let sql = `
      SELECT e.*, s.SubjectName as subjectName, s.color as subjectColor 
      FROM essays e
      LEFT JOIN math_subjects s ON e.subjectId = s.SubjectID
      WHERE 1=1
    `;
    const params = [];
    
    if (query.userId) {
      sql += ' AND e.userId = ?';
      params.push(query.userId);
    }

    sql += ' ORDER BY e.createdAt DESC';
    
    if (query.skip !== undefined && query.limit !== undefined) {
      sql += ' LIMIT ?, ?';
      params.push(parseInt(query.skip), parseInt(query.limit));
    }
    
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({
      ...r,
      _id: r.id,
      subjectId: { _id: r.subjectId, name: r.subjectName, color: r.subjectColor }
    }));
  }

  static async countDocuments(query = {}) {
    let sql = 'SELECT COUNT(*) as count FROM essays WHERE 1=1';
    const params = [];
    
    if (query.userId) {
      sql += ' AND userId = ?';
      params.push(query.userId);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM essays WHERE id = ?', [id]);
    return rows[0] ? { ...rows[0], _id: rows[0].id } : null;
  }

  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO essays (userId, subjectId, content, score, feedback, suggestions) VALUES (?, ?, ?, ?, ?, ?)',
      [data.userId, data.subjectId, data.content, data.score, data.feedback, data.suggestions]
    );
    return { id: result.insertId, _id: result.insertId, ...data, createdAt: new Date() };
  }
}

module.exports = Essay;
