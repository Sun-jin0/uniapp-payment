const pool = require('../config/mysql');

class MathQuestionDetail {
  static async find(query = {}) {
    let sql = 'SELECT * FROM math_questiondetails WHERE 1=1';
    const params = [];
    if (query.QuestionID) {
      if (Array.isArray(query.QuestionID)) {
        sql += ` AND QuestionID IN (${query.QuestionID.map(() => '?').join(',')})`;
        params.push(...query.QuestionID);
      } else {
        sql += ' AND QuestionID = ?';
        params.push(query.QuestionID);
      }
    }
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({ ...r, _id: r.id }));
  }

  static async findOne(query) {
    let sql = 'SELECT * FROM math_questiondetails WHERE 1=1';
    const params = [];
    if (query.QuestionID) {
      sql += ' AND QuestionID = ?';
      params.push(query.QuestionID);
    }
    const [rows] = await pool.query(sql, params);
    return rows[0] ? { ...rows[0], _id: rows[0].id } : null;
  }
}

module.exports = MathQuestionDetail;
