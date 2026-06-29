const pool = require('../config/mysql');

class MathSubject {
  static async find(query = {}) {
    let sql = 'SELECT * FROM math_subjects WHERE 1=1';
    const params = [];
    
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({ ...r, _id: r.SubjectID, id: r.SubjectID }));
  }

  static async findOne(query) {
    let sql = 'SELECT * FROM math_subjects WHERE 1=1';
    const params = [];
    if (query.SubjectID) {
      sql += ' AND SubjectID = ?';
      params.push(query.SubjectID);
    }
    if (query.SubjectName) {
      sql += ' AND SubjectName = ?';
      params.push(query.SubjectName);
    }
    const [rows] = await pool.query(sql, params);
    return rows[0] ? { ...rows[0], _id: rows[0].SubjectID, id: rows[0].SubjectID } : null;
  }
}

module.exports = MathSubject;
