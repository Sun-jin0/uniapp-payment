const pool = require('../config/mysql');

class Subject {
  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO math_subjects (SubjectName, exam_type_id) VALUES (?, ?)',
      [data.name, data.examTypeId]
    );
    return { id: result.insertId, _id: result.insertId, ...data };
  }

  static async findByIdAndUpdate(id, updateData) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'name') {
        fields.push('SubjectName = ?');
        params.push(value);
      } else if (key === 'examTypeId') {
        fields.push('exam_type_id = ?');
        params.push(value);
      } else {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    params.push(id);
    await pool.query(`UPDATE math_subjects SET ${fields.join(', ')} WHERE SubjectID = ?`, params);
    return await this.findById(id);
  }

  static async findByIdAndDelete(id) {
    const subject = await this.findById(id);
    if (subject) {
      await pool.query('DELETE FROM math_subjects WHERE SubjectID = ?', [id]);
    }
    return subject;
  }

  static async find(query = {}) {
    let sql = `
      SELECT s.*, et.name as examTypeName, et.color as examTypeColor 
      FROM math_subjects s
      LEFT JOIN exam_types et ON s.exam_type_id = et.id
      WHERE 1=1
    `;
    const params = [];
    
    if (query.examTypeId) {
      sql += ' AND s.exam_type_id = ?';
      params.push(query.examTypeId);
    }
    
    sql += ' ORDER BY s.SubjectID DESC';
    
    const [rows] = await pool.query(sql, params);
    
    // Fetch categories for each subject
    const subjects = await Promise.all(rows.map(async r => {
      const [chapters] = await pool.query('SELECT id, title as name FROM chapters WHERE subjectId = ? AND status = 1 ORDER BY sort ASC', [r.SubjectID]);
      
      // 为每个章节添加跳转路径
      const mappedChapters = chapters.map(c => {
        let page_path = '';
        // 根据科目名称或类型决定跳转路径
        if (r.SubjectName.includes('计算机')) {
          page_path = `/pages/computer/computer-question-list?majorId=${r.SubjectID}&chapterId=${c.id}&title=${encodeURIComponent(c.name)}`;
        } else {
          // 默认跳转到数学详情或通用练习页
          page_path = `/pages/math/math-book-detail?bookId=${r.SubjectID}&bookTitle=${encodeURIComponent(r.SubjectName)}`;
        }
        return { ...c, page_path };
      });

      return {
        ...r,
        id: r.SubjectID,
        _id: r.SubjectID,
        name: r.SubjectName,
        description: r.description,
        page_path: r.page_path,
        examTypeId: r.exam_type_id,
        examType: {
          id: r.exam_type_id,
          name: r.examTypeName,
          color: r.examTypeColor
        },
        categories: mappedChapters
      };
    }));
    
    return subjects;
  }

  static async countDocuments(query = {}) {
    let sql = 'SELECT COUNT(*) as count FROM math_subjects WHERE 1=1';
    const params = [];
    
    if (query.examTypeId) {
      sql += ' AND exam_type_id = ?';
      params.push(query.examTypeId);
    }
    if (query.name && query.name.$regex) {
      sql += ' AND SubjectName LIKE ?';
      params.push(`%${query.name.$regex}%`);
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].count;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM math_subjects WHERE SubjectID = ?', [id]);
    return rows[0] ? { ...rows[0], _id: rows[0].SubjectID, name: rows[0].SubjectName } : null;
  }
}

module.exports = Subject;
