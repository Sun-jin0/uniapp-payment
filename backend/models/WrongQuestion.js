const pool = require('../config/mysql');

class WrongQuestion {
  static async find(query = {}) {
    let sql = 'SELECT * FROM wrong_questions WHERE 1=1';
    const params = [];
    
    if (query.userId) {
      sql += ' AND userId = ?';
      params.push(query.userId);
    }
    if (query.isActive !== undefined) {
      sql += ' AND isActive = ?';
      params.push(query.isActive);
    }
    if (query.subjectId) {
      sql += ' AND subjectId = ?';
      params.push(query.subjectId);
    }

    sql += ' ORDER BY createdAt DESC';
    
    if (query.skip !== undefined && query.limit !== undefined) {
      sql += ' LIMIT ?, ?';
      params.push(parseInt(query.skip), parseInt(query.limit));
    }

    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({ ...r, _id: r.id }));
  }

  static async countDocuments(query = {}) {
    let sql = 'SELECT COUNT(*) as count FROM wrong_questions WHERE 1=1';
    const params = [];
    
    if (query.userId) {
      sql += ' AND userId = ?';
      params.push(query.userId);
    }
    if (query.isActive !== undefined) {
      sql += ' AND isActive = ?';
      params.push(query.isActive);
    }
    if (query.subjectId) {
      sql += ' AND subjectId = ?';
      params.push(query.subjectId);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }

  static async updateById(id, updateData) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updateData)) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
    params.push(id);
    await pool.query(`UPDATE wrong_questions SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  static async findOne(query) {
    let sql = 'SELECT * FROM wrong_questions WHERE userId = ? AND (questionId = ? OR mongo_question_id = ?)';
    const [rows] = await pool.query(sql, [query.userId, query.questionId, query.questionId]);
    return rows[0] ? { ...rows[0], _id: rows[0].id } : null;
  }

  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO wrong_questions (userId, questionId, mongo_question_id, examId, subjectId, chapterId, userAnswer) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        data.userId, 
        typeof data.questionId === 'number' ? data.questionId : null,
        typeof data.questionId === 'string' ? data.questionId : null,
        data.examId || null,
        data.subjectId || null,
        data.chapterId || null,
        data.userAnswer || ''
      ]
    );
    const [rows] = await pool.query('SELECT * FROM wrong_questions WHERE id = ?', [result.insertId]);
    return { ...rows[0], _id: rows[0].id };
  }

  static async findOneAndUpdate(query, update) {
    // 简化实现，主要用于标记已解决等操作
    if (update.$set || update.isActive !== undefined) {
      const fields = [];
      const params = [];
      const updateData = update.$set || update;
      
      for (const [key, value] of Object.entries(updateData)) {
        if (key === 'isActive' || key === 'isResolved') {
          fields.push(`${key} = ?`);
          params.push(value);
        }
      }

      if (fields.length === 0) return;

      params.push(query.userId);
      params.push(query.questionId);
      params.push(query.questionId);
      await pool.query(`UPDATE wrong_questions SET ${fields.join(', ')} WHERE userId = ? AND (questionId = ? OR mongo_question_id = ?)`, params);
    }
  }
}

module.exports = WrongQuestion;
