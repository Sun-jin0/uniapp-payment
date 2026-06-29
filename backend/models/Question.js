const pool = require('../config/mysql');

class Question {
  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO questions (examTypeId, content, options, answer, explanation, type, difficulty, subjectId, chapterId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.examTypeId || (data.subjectId ? (await this.getExamTypeIdFromSubject(data.subjectId)) : null),
        data.content,
        JSON.stringify(data.options),
        data.answer,
        data.explanation,
        data.type,
        data.difficulty,
        data.subjectId,
        data.chapterId
      ]
    );
    return { id: result.insertId, _id: result.insertId, ...data };
  }

  static async getExamTypeIdFromSubject(subjectId) {
    const [rows] = await pool.query('SELECT exam_type_id FROM math_subjects WHERE SubjectID = ?', [subjectId]);
    return rows[0] ? rows[0].exam_type_id : null;
  }

  static async findByIdAndUpdate(id, updateData) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'options') {
        fields.push('options = ?');
        params.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    await pool.query(`UPDATE questions SET ${fields.join(', ')} WHERE id = ?`, params);
    return await this.findById(id);
  }

  static async findByIdAndDelete(id) {
    const question = await this.findById(id);
    if (question) {
      await pool.query('DELETE FROM questions WHERE id = ?', [id]);
    }
    return question;
  }

  static async find(query = {}) {
    let sql = 'SELECT q.*, s.SubjectName as subjectName, c.title as chapterTitle FROM questions q ' +
              'LEFT JOIN math_subjects s ON q.subjectId = s.SubjectID ' +
              'LEFT JOIN chapters c ON q.chapterId = c.id ' +
              'WHERE 1=1';
    const params = [];
    
    if (query.subjectId) {
      sql += ' AND q.subjectId = ?';
      params.push(query.subjectId);
    }
    if (query.chapterId) {
      sql += ' AND q.chapterId = ?';
      params.push(query.chapterId);
    }
    if (query.type !== undefined) {
      if (query.type.$in) {
        sql += ` AND q.type IN (${query.type.$in.map(() => '?').join(',')})`;
        params.push(...query.type.$in);
      } else {
        sql += ' AND q.type = ?';
        params.push(query.type);
      }
    }
    if (query.difficulty !== undefined) {
      if (query.difficulty.$in) {
        sql += ` AND q.difficulty IN (${query.difficulty.$in.map(() => '?').join(',')})`;
        params.push(...query.difficulty.$in);
      } else {
        sql += ' AND q.difficulty = ?';
        params.push(query.difficulty);
      }
    }
    if (query.isActive !== undefined) {
      sql += ' AND q.isActive = ?';
      params.push(query.isActive);
    }
    if (query.content && query.content.$regex) {
      sql += ' AND q.content LIKE ?';
      params.push(`%${query.content.$regex}%`);
    }

    sql += ' ORDER BY q.createdAt DESC';
    
    if (query.skip !== undefined && query.limit !== undefined) {
      sql += ' LIMIT ?, ?';
      params.push(parseInt(query.skip), parseInt(query.limit));
    }

    const [rows] = await pool.query(sql, params);
    return rows.map(r => ({
      ...r,
      _id: r.id,
      subjectId: r.subjectId ? { _id: r.subjectId, name: r.subjectName } : null,
      chapterId: r.chapterId ? { _id: r.chapterId, title: r.chapterTitle } : null,
      toObject: function() { return this; }
    }));
  }

  static async findById(id) {
    let sql = 'SELECT q.*, s.SubjectName as subjectName, s.exam_type_id as subjectColor, c.title as chapterTitle FROM questions q ' +
              'LEFT JOIN math_subjects s ON q.subjectId = s.SubjectID ' +
              'LEFT JOIN chapters c ON q.chapterId = c.id ' +
              'WHERE q.id = ?';
    const [rows] = await pool.query(sql, [id]);
    if (!rows[0]) return null;
    
    const r = rows[0];
    return {
      ...r,
      _id: r.id,
      subjectId: r.subjectId ? { _id: r.subjectId, name: r.subjectName, color: r.subjectColor } : null,
      chapterId: r.chapterId ? { _id: r.chapterId, title: r.chapterTitle } : null,
      toObject: function() { return this; }
    };
  }

  static async countDocuments(query = {}) {
    let sql = 'SELECT COUNT(*) as count FROM questions WHERE 1=1';
    const params = [];
    
    if (query.subjectId) {
      sql += ' AND subjectId = ?';
      params.push(query.subjectId);
    }
    if (query.chapterId) {
      sql += ' AND chapterId = ?';
      params.push(query.chapterId);
    }
    if (query.isActive !== undefined) {
      sql += ' AND isActive = ?';
      params.push(query.isActive);
    }
    if (query.content && query.content.$regex) {
      sql += ' AND content LIKE ?';
      params.push(`%${query.content.$regex}%`);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }
}

module.exports = Question;
