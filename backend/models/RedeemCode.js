const pool = require('../config/mysql');

class RedeemCode {
  static async insertMany(data) {
    if (!Array.isArray(data) || data.length === 0) return [];
    const fields = ['code', 'subjectId', 'days', 'maxCount', 'usedCount', 'status'];
    const placeholders = data.map(() => `(${fields.map(() => '?').join(',')})`).join(',');
    const params = data.flatMap(item => fields.map(field => item[field]));
    await pool.query(`INSERT INTO redeem_codes (${fields.join(',')}) VALUES ${placeholders}`, params);
    
    // We need to return the inserted codes. Since MySQL insertMany doesn't return all IDs easily,
    // and we just inserted them, we can fetch them back or just return the data with simulated IDs if needed.
    // For now, let's just return the data.
    return data;
  }

  static async find(query = {}) {
    let sql = `
      SELECT rc.*, s.SubjectName as subjectName 
      FROM redeem_codes rc
      LEFT JOIN math_subjects s ON rc.subjectId = s.SubjectID
      WHERE 1=1
    `;
    const params = [];
    
    if (query.status !== undefined) {
      sql += ' AND rc.status = ?';
      params.push(query.status);
    }
    if (query.code && query.code.$regex) {
      sql += ' AND rc.code LIKE ?';
      params.push(`%${query.code.$regex}%`);
    }
    
    sql += ' ORDER BY rc.createdAt DESC';
    
    if (query.skip !== undefined && query.limit !== undefined) {
      sql += ' LIMIT ?, ?';
      params.push(parseInt(query.skip), parseInt(query.limit));
    }
    
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({
      ...r,
      _id: r.id,
      subjectId: { _id: r.subjectId, name: r.subjectName }
    }));
  }

  static async countDocuments(query = {}) {
    let sql = 'SELECT COUNT(*) as count FROM redeem_codes WHERE 1=1';
    const params = [];
    
    if (query.status !== undefined) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    if (query.code && query.code.$regex) {
      sql += ' AND code LIKE ?';
      params.push(`%${query.code.$regex}%`);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }

  static async findOne(query) {
    let sql = 'SELECT * FROM redeem_codes WHERE 1=1';
    const params = [];
    
    if (query.code) {
      sql += ' AND code = ?';
      params.push(query.code);
    }
    if (query.status !== undefined) {
      sql += ' AND status = ?';
      params.push(query.status);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0] ? { ...rows[0], _id: rows[0].id } : null;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM redeem_codes WHERE id = ?', [id]);
    return rows[0] ? { ...rows[0], _id: rows[0].id } : null;
  }

  static async updateById(id, updateData) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updateData)) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
    params.push(id);
    await pool.query(`UPDATE redeem_codes SET ${fields.join(', ')} WHERE id = ?`, params);
  }
}

module.exports = RedeemCode;
