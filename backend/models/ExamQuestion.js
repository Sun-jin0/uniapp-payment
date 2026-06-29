const pool = require('../config/mysql');

class ExamQuestion {
  static async insertMany(data) {
    if (!Array.isArray(data) || data.length === 0) return;
    const fields = ['examId', 'questionId', 'sort'];
    const placeholders = data.map(() => `(${fields.map(() => '?').join(',')})`).join(',');
    const params = data.flatMap(item => fields.map(field => item[field]));
    await pool.query(`INSERT INTO exam_questions (${fields.join(',')}) VALUES ${placeholders}`, params);
  }

  static async deleteMany(query = {}) {
    let sql = 'DELETE FROM exam_questions WHERE 1=1';
    const params = [];
    if (query.examId) {
      sql += ' AND examId = ?';
      params.push(query.examId);
    }
    if (query.questionId) {
      sql += ' AND questionId = ?';
      params.push(query.questionId);
    }
    await pool.query(sql, params);
  }

  static async find(query = {}) {
    let sql = 'SELECT eq.*, q.content, q.options, q.answer, q.explanation, q.type FROM exam_questions eq ' +
              'LEFT JOIN questions q ON eq.questionId = q.id ' +
              'WHERE 1=1';
    const params = [];
    
    if (query.examId) {
      sql += ' AND eq.examId = ?';
      params.push(query.examId);
    }

    sql += ' ORDER BY eq.sort ASC';
    
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({
      ...r,
      _id: r.id,
      questionId: {
        _id: r.questionId,
        content: r.content,
        options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
        answer: r.answer,
        explanation: r.explanation,
        type: r.type
      }
    }));
  }
}

module.exports = ExamQuestion;
