const pool = require('../config/mysql');

class MathBookQuestion {
  static async find(query = {}) {
    let sql = 'SELECT * FROM math_bookquestions WHERE 1=1';
    const params = [];
    if (query.BookID) {
      sql += ' AND BookID = ?';
      params.push(query.BookID);
    }
    if (query.QuestionID) {
      sql += ' AND QuestionID = ?';
      params.push(query.QuestionID);
    }
    
    if (query.sort) {
      sql += ' ORDER BY ' + (query.sort.Sort === 1 ? 'Sort ASC' : 'Sort DESC');
    } else {
      sql += ' ORDER BY Sort ASC';
    }

    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({ ...r, _id: r.EntryID, id: r.EntryID }));
  }

  static async findOne(query) {
    let sql = 'SELECT * FROM math_bookquestions WHERE 1=1';
    const params = [];
    if (query.BookID) {
      sql += ' AND BookID = ?';
      params.push(query.BookID);
    }
    if (query.QuestionID) {
      sql += ' AND QuestionID = ?';
      params.push(query.QuestionID);
    }
    const [rows] = await pool.query(sql, params);
    return rows[0] ? { ...rows[0], _id: rows[0].EntryID, id: rows[0].EntryID } : null;
  }
}

module.exports = MathBookQuestion;
