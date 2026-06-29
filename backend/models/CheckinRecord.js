const pool = require('../config/mysql');

class CheckinRecord {
  static async findOne(query) {
    let sql = 'SELECT * FROM checkin_records WHERE userId = ?';
    const params = [query.userId];
    
    if (query.date) {
      sql += ' AND checkinDate = ?';
      params.push(query.date);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0] ? { ...rows[0], _id: rows[0].id } : null;
  }

  static async find(query = {}) {
    let sql = 'SELECT * FROM checkin_records WHERE userId = ?';
    const params = [query.userId];
    
    sql += ' ORDER BY checkinDate DESC';
    
    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(query.limit));
    }

    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({ ...r, _id: r.id }));
  }

  static async countDocuments(query = {}) {
    let sql = 'SELECT COUNT(*) as count FROM checkin_records WHERE userId = ?';
    const params = [query.userId];
    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }

  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO checkin_records (userId, checkinDate, points, consecutiveDays) VALUES (?, ?, ?, ?)',
      [data.userId, data.date, data.points, data.consecutiveDays]
    );
    return { id: result.insertId, _id: result.insertId, ...data };
  }
}

module.exports = CheckinRecord;
