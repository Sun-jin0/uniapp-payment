const pool = require('../config/mysql');

class MathKnowledgePoint {
  static async find(query = {}) {
    let sql = 'SELECT * FROM math_knowledgepoints WHERE 1=1';
    const params = [];
    if (query.KPCode) {
      sql += ' AND KPCode = ?';
      params.push(query.KPCode);
    }
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({ ...r, _id: r.KnowledgePointID, id: r.KnowledgePointID }));
  }

  static async findOne(query) {
    let sql = 'SELECT * FROM math_knowledgepoints WHERE 1=1';
    const params = [];
    if (query.KnowledgePointID) {
      sql += ' AND KnowledgePointID = ?';
      params.push(query.KnowledgePointID);
    }
    if (query.KPCode) {
      sql += ' AND KPCode = ?';
      params.push(query.KPCode);
    }
    const [rows] = await pool.query(sql, params);
    return rows[0] ? { ...rows[0], _id: rows[0].KnowledgePointID, id: rows[0].KnowledgePointID } : null;
  }
}

module.exports = MathKnowledgePoint;
