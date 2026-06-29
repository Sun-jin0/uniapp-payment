const pool = require('../config/mysql');

class ExamType {
  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO exam_types (name, sort, isActive) VALUES (?, ?, ?)',
      [data.name, data.sort || 0, data.isActive !== undefined ? data.isActive : 1]
    );
    return { id: result.insertId, _id: result.insertId, ...data };
  }

  static async findByIdAndUpdate(id, updateData) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updateData)) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
    params.push(id);
    await pool.query(`UPDATE exam_types SET ${fields.join(', ')} WHERE id = ?`, params);
    return await this.findById(id);
  }

  static async findByIdAndDelete(id) {
    const examType = await this.findById(id);
    if (examType) {
      await pool.query('DELETE FROM exam_types WHERE id = ?', [id]);
    }
    return examType;
  }

  static async find(query = {}) {
    let sql = 'SELECT * FROM exam_types WHERE 1=1';
    const params = [];
    
    if (query.isActive !== undefined) {
      sql += ' AND isActive = ?';
      params.push(query.isActive);
    }

    sql += ' ORDER BY sort ASC';
    
    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({ ...r, _id: r.id }));
  }

  static async countDocuments(query = {}) {
    let sql = 'SELECT COUNT(*) as count FROM exam_types WHERE 1=1';
    const params = [];
    
    if (query.isActive !== undefined) {
      sql += ' AND isActive = ?';
      params.push(query.isActive);
    }
    if (query.name && query.name.$regex) {
      sql += ' AND name LIKE ?';
      params.push(`%${query.name.$regex}%`);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM exam_types WHERE id = ?', [id]);
    return rows[0] ? { ...rows[0], _id: rows[0].id } : null;
  }
}

module.exports = ExamType;
