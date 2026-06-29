const pool = require('../config/mysql');

class MathBook {
  static async find(query = {}) {
    let sql = 'SELECT * FROM math_books WHERE 1=1';
    const params = [];
    if (query.SubjectID) {
      sql += ' AND SubjectID = ?';
      params.push(query.SubjectID);
    }
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({ ...r, _id: r.BookID, id: r.BookID }));
  }

  static async findOne(query) {
    let sql = 'SELECT * FROM math_books WHERE 1=1';
    const params = [];
    if (query.BookID) {
      sql += ' AND BookID = ?';
      params.push(query.BookID);
    }
    const [rows] = await pool.query(sql, params);
    return rows[0] ? { ...rows[0], _id: rows[0].BookID, id: rows[0].BookID } : null;
  }

  static async findById(id) {
    return this.findOne({ BookID: id });
  }
}

module.exports = MathBook;
