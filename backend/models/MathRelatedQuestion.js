const pool = require('../config/mysql');

class MathRelatedQuestion {
  static async find(query = {}) {
    let sql = 'SELECT * FROM math_relatedquestions WHERE 1=1';
    const params = [];
    
    if (query.SourceQuestionID) {
      if (Array.isArray(query.SourceQuestionID)) {
        sql += ` AND SourceQuestionID IN (${query.SourceQuestionID.map(() => '?').join(',')})`;
        params.push(...query.SourceQuestionID);
      } else {
        sql += ' AND SourceQuestionID = ?';
        params.push(query.SourceQuestionID);
      }
    }
    
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({ ...r, _id: r.ID, id: r.ID }));
  }

  static async findOne(query) {
    let sql = 'SELECT * FROM math_relatedquestions WHERE 1=1';
    const params = [];
    
    if (query.SourceQuestionID) {
      sql += ' AND SourceQuestionID = ?';
      params.push(query.SourceQuestionID);
    }
    
    const [rows] = await pool.query(sql, params);
    return rows[0] ? { ...rows[0], _id: rows[0].ID, id: rows[0].ID } : null;
  }

  static async getRelatedIds(sourceQuestionId) {
    const sql = 'SELECT RelatedQuestionID FROM math_relatedquestions WHERE SourceQuestionID = ?';
    const [rows] = await pool.query(sql, [sourceQuestionId]);
    return rows.map(r => r.RelatedQuestionID);
  }

  static async getRelatedQuestions(sourceQuestionId) {
    const sql = `
      SELECT q.* 
      FROM math_relatedquestions r
      JOIN math_questions q ON r.RelatedQuestionID = q.SourceID
      WHERE r.SourceQuestionID = ?
    `;
    const [rows] = await pool.query(sql, [sourceQuestionId]);
    return rows;
  }
}

module.exports = MathRelatedQuestion;
