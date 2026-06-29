const pool = require('../config/mysql');

class NavSubject {
  static async find(query = {}) {
    let sql = `
      SELECT s.*, et.name as examTypeName, et.color as examTypeColor 
      FROM nav_subjects s
      LEFT JOIN exam_types et ON s.exam_type_id = et.id
      WHERE s.status = 1
    `;
    const params = [];
    
    if (query.examTypeId) {
      sql += ' AND s.exam_type_id = ?';
      params.push(query.examTypeId);
    }
    
    sql += ' ORDER BY s.sort ASC, s.id ASC';
    
    const [rows] = await pool.query(sql, params);
    
    // Fetch categories for each subject
    const subjects = await Promise.all(rows.map(async r => {
      const [categories] = await pool.query(
        'SELECT id, name, description, page_path FROM nav_categories WHERE subject_id = ? AND status = 1 ORDER BY sort ASC, id ASC', 
        [r.id]
      );
      
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        page_path: r.page_path,
        examTypeId: r.exam_type_id,
        examType: {
          id: r.exam_type_id,
          name: r.examTypeName,
          color: r.examTypeColor
        },
        categories: categories
      };
    }));
    
    return subjects;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM nav_subjects WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    
    const subject = rows[0];
    const [categories] = await pool.query(
      'SELECT id, name, description, page_path FROM nav_categories WHERE subject_id = ? AND status = 1 ORDER BY sort ASC, id ASC', 
      [id]
    );
    
    return {
      ...subject,
      categories
    };
  }
}

module.exports = NavSubject;
