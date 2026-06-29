const pool = require('../config/mysql');

class AnswerRecord {
  static async find(query = {}) {
    let sql = 'SELECT * FROM answer_records WHERE 1=1';
    const params = [];
    
    if (query.userId) {
      sql += ' AND userId = ?';
      params.push(query.userId);
    }

    sql += ' ORDER BY createdAt DESC';
    
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({ ...r, _id: r.id }));
  }

  static async countDocuments(query = {}) {
    let sql = 'SELECT COUNT(*) as count FROM answer_records WHERE 1=1';
    const params = [];
    
    if (query.userId) {
      sql += ' AND userId = ?';
      params.push(query.userId);
    }
    if (query.examId) {
      sql += ' AND examId = ?';
      params.push(query.examId);
    }
    if (query.subjectId) {
      sql += ' AND subjectId = ?';
      params.push(query.subjectId);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }

  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO answer_records (userId, examId, subjectId, score, totalQuestions, correctQuestions, answers) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.userId, data.examId || null, data.subjectId || null, data.score, data.totalQuestions, data.correctQuestions, JSON.stringify(data.answers || [])]
    );
    const [rows] = await pool.query('SELECT * FROM answer_records WHERE id = ?', [result.insertId]);
    return { ...rows[0], _id: rows[0].id };
  }
}

module.exports = AnswerRecord;
