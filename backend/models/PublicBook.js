const pool = require('../config/mysql');

class PublicBook {
  static async create(data) {
    const [result] = await pool.query(
      `INSERT INTO public_books 
      (title, short_name, type, subject, first_category_id, second_category_id, third_category_id, description, pic_url, status, sort, remark) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.short_name,
        data.type,
        data.subject,
        data.first_category_id,
        data.second_category_id,
        data.third_category_id,
        data.description,
        data.pic_url,
        data.status !== undefined ? data.status : 1,
        data.sort || 0,
        data.remark
      ]
    );
    return { id: result.insertId, ...data };
  }

  static async find(query = {}) {
    let sql = 'SELECT * FROM public_books WHERE 1=1';
    const params = [];
    if (query.subject) {
      sql += ' AND subject = ?';
      params.push(query.subject);
    }
    if (query.type) {
      sql += ' AND type = ?';
      params.push(query.type);
    }
    if (query.status !== undefined) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    if (query.first_category_id) {
      sql += ' AND first_category_id = ?';
      params.push(query.first_category_id);
    }
    sql += ' ORDER BY sort ASC, createdAt DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM public_books WHERE id = ?', [id]);
    return rows[0] || null;
  }
}

module.exports = PublicBook;
