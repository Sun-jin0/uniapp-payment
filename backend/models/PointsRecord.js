const pool = require('../config/mysql');

class PointsRecord {
  static async find(query = {}) {
    let sql = 'SELECT * FROM points_records WHERE 1=1';
    const params = [];
    
    if (query.userId) {
      sql += ' AND userId = ?';
      params.push(query.userId);
    }

    sql += ' ORDER BY createdAt DESC';
    
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({ ...r, _id: r.id }));
  }

  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO points_records (userId, points, type, description) VALUES (?, ?, ?, ?)',
      [data.userId, data.points, data.type, data.description]
    );
    const [rows] = await pool.query('SELECT * FROM points_records WHERE id = ?', [result.insertId]);
    return { ...rows[0], _id: rows[0].id };
  }
}

module.exports = PointsRecord;
