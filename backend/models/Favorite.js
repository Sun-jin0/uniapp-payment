const pool = require('../config/mysql');

class Favorite {
  static async find(query = {}) {
    let sql = 'SELECT * FROM favorites WHERE 1=1';
    const params = [];

    if (query.userId) {
      sql += ' AND userId = ?';
      params.push(query.userId);
    }
    if (query.isActive !== undefined) {
      sql += ' AND isActive = ?';
      params.push(query.isActive);
    }
    if (query.examTypeId) {
      sql += ' AND examTypeId = ?';
      params.push(query.examTypeId);
    }
    if (query.subjectId) {
      sql += ' AND subjectId = ?';
      params.push(query.subjectId);
    }
    if (query.chapterId) {
      sql += ' AND chapterId = ?';
      params.push(query.chapterId);
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
    let sql = 'SELECT COUNT(*) as count FROM favorites WHERE 1=1';
    const params = [];
    
    if (query.userId) {
      sql += ' AND userId = ?';
      params.push(query.userId);
    }
    if (query.isActive !== undefined) {
      sql += ' AND isActive = ?';
      params.push(query.isActive);
    }
    if (query.examTypeId) {
      sql += ' AND examTypeId = ?';
      params.push(query.examTypeId);
    }
    if (query.subjectId) {
      sql += ' AND subjectId = ?';
      params.push(query.subjectId);
    }
    if (query.chapterId) {
      sql += ' AND chapterId = ?';
      params.push(query.chapterId);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }

  static async findOne(query) {
    let sql = 'SELECT * FROM favorites WHERE 1=1';
    const params = [];
    
    if (query._id) {
      sql += ' AND id = ?';
      params.push(query._id);
    }
    if (query.userId) {
      sql += ' AND userId = ?';
      params.push(query.userId);
    }
    if (query.questionId) {
      sql += ' AND (questionId = ? OR mongo_question_id = ?)';
      params.push(query.questionId, query.questionId);
    }
    if (query.isActive !== undefined) {
      sql += ' AND isActive = ?';
      params.push(query.isActive);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0] ? { ...rows[0], _id: rows[0].id } : null;
  }

  static async create(data) {
    console.log('Favorite.create data:', JSON.stringify(data, null, 2));
    const userId = data.userId;
    const questionId = typeof data.questionId === 'number' ? data.questionId : (data.questionId?._id || null);
    const mongo_question_id = typeof data.questionId === 'string' ? data.questionId : null;
    const examTypeId = data.examTypeId?._id || (typeof data.examTypeId === 'number' ? data.examTypeId : null);
    const subjectId = data.subjectId?._id || (typeof data.subjectId === 'number' ? data.subjectId : null);
    const chapterId = data.chapterId?._id || (typeof data.chapterId === 'number' ? data.chapterId : null);
    const content = data.content || null;
    const isActive = data.isActive !== undefined ? data.isActive : 1;

    console.log('Favorite.create processed:', { userId, questionId, mongo_question_id, examTypeId, subjectId, chapterId, content, isActive });

    const [result] = await pool.query(
      'INSERT INTO favorites (userId, questionId, mongo_question_id, examTypeId, subjectId, chapterId, content, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, questionId, mongo_question_id, examTypeId, subjectId, chapterId, content, isActive]
    );
    return { id: result.insertId, _id: result.insertId, ...data };
  }

  static async updateById(id, updateData) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updateData)) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
    params.push(id);
    await pool.query(`UPDATE favorites SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  static async findOneAndUpdate(query, update) {
    if (update.$set) {
      const fields = [];
      const params = [];
      for (const [key, value] of Object.entries(update.$set)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
      
      let whereSql = ' WHERE 1=1';
      if (query.userId) {
        whereSql += ' AND userId = ?';
        params.push(query.userId);
      }
      if (query.questionId) {
        whereSql += ' AND (questionId = ? OR mongo_question_id = ?)';
        params.push(query.questionId, query.questionId);
      }
      
      await pool.query(`UPDATE favorites SET ${fields.join(', ')} ${whereSql}`, params);
    }
  }
}

module.exports = Favorite;
