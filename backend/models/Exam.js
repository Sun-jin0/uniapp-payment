const pool = require('../config/mysql');

class Exam {
  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO exams (title, questionCount, difficulty, type, status, subjectId) VALUES (?, ?, ?, ?, ?, ?)',
      [
        data.title,
        data.questionCount || 0,
        data.difficulty || 1,
        data.type || 1,
        data.status !== undefined ? data.status : 1,
        data.subjectId
      ]
    );
    return { id: result.insertId, _id: result.insertId, ...data };
  }

  static async findByIdAndUpdate(id, updateData) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'questionIds') continue; // questionIds are handled in ExamQuestion
      fields.push(`${key} = ?`);
      params.push(value);
    }
    if (fields.length > 0) {
      params.push(id);
      await pool.query(`UPDATE exams SET ${fields.join(', ')} WHERE id = ?`, params);
    }
    return await this.findById(id);
  }

  static async findByIdAndDelete(id) {
    const exam = await this.findById(id);
    if (exam) {
      await pool.query('DELETE FROM exams WHERE id = ?', [id]);
    }
    return exam;
  }

  static async countDocuments(query = {}) {
    let sql = 'SELECT COUNT(*) as count FROM exams WHERE 1=1';
    const params = [];
    
    if (query.status !== undefined) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    if (query.title && query.title.$regex) {
      sql += ' AND title LIKE ?';
      params.push(`%${query.title.$regex}%`);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }

  static async find(query = {}) {
    let sql = `
      SELECT e.*, s.SubjectName as subjectName, s.exam_type_id 
      FROM exams e
      LEFT JOIN math_subjects s ON e.subjectId = s.SubjectID
      WHERE 1=1
    `;
    const params = [];

    if (query.status !== undefined) {
      sql += ' AND e.status = ?';
      params.push(query.status);
    }
    if (query.subjectId) {
      sql += ' AND e.subjectId = ?';
      params.push(query.subjectId);
    }
    if (query.title && query.title.$regex) {
      sql += ' AND e.title LIKE ?';
      params.push(`%${query.title.$regex}%`);
    }
    if (query.recent) {
      sql += ' AND e.createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    }
    if (query.createdAt && query.createdAt.$gte) {
      sql += ' AND e.createdAt >= ?';
      params.push(query.createdAt.$gte);
    }

    sql += ' ORDER BY e.createdAt DESC';

    if (query.skip !== undefined && query.limit !== undefined) {
      sql += ' LIMIT ?, ?';
      params.push(parseInt(query.skip), parseInt(query.limit));
    }

    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({
      ...r,
      _id: r.id,
      subjectId: {
        _id: r.subjectId,
        name: r.subjectName,
        color: r.subjectColor
      }
    }));
  }

  static async findById(id) {
    const [rows] = await pool.query(`
      SELECT e.*, s.SubjectName as subjectName, s.color as subjectColor
      FROM exams e
      LEFT JOIN math_subjects s ON e.subjectId = s.SubjectID
      WHERE e.id = ?
    `, [id]);
    if (rows[0]) {
      return {
        ...rows[0],
        _id: rows[0].id,
        subjectId: {
          _id: rows[0].subjectId,
          name: rows[0].subjectName,
          color: rows[0].subjectColor
        }
      };
    }
    return null;
  }

  static async updateById(id, updateData) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updateData)) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
    params.push(id);
    await pool.query(`UPDATE exams SET ${fields.join(', ')} WHERE id = ?`, params);
  }
}

module.exports = Exam;
