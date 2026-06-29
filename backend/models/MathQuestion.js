const pool = require('../config/mysql');

class MathQuestion {
  static async find(query = {}) {
    let sql = 'SELECT * FROM math_questions WHERE 1=1';
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
    return rows.map(r => ({ ...r, _id: r.QuestionID, id: r.QuestionID }));
  }

  static async findOne(query) {
    let sql = 'SELECT * FROM math_questions WHERE 1=1';
    const params = [];
    if (query.QuestionID) {
      sql += ' AND QuestionID = ?';
      params.push(query.QuestionID);
    }
    const [rows] = await pool.query(sql, params);
    return rows[0] ? { ...rows[0], _id: rows[0].QuestionID, id: rows[0].QuestionID } : null;
  }

  static async findById(id) {
    return this.findOne({ QuestionID: id });
  }
}

module.exports = MathQuestion;
