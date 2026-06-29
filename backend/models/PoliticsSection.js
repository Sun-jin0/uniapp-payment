const pool = require('../config/mysql');

class PoliticsSection {
  static async create(data) {
    const [result] = await pool.query(
      'INSERT INTO politics_sections (name, display_rows, sort, status) VALUES (?, ?, ?, ?)',
      [data.name, data.display_rows || 1, data.sort || 0, data.status !== undefined ? data.status : 1]
    );
    return { id: result.insertId, ...data };
  }

  static async find(query = {}) {
    let sql = 'SELECT * FROM politics_sections WHERE 1=1';
    const params = [];
    if (query.status !== undefined) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    sql += ' ORDER BY sort ASC, id ASC';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM politics_sections WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async update(id, data) {
    const [result] = await pool.query(
      'UPDATE politics_sections SET name = ?, display_rows = ?, sort = ?, status = ? WHERE id = ?',
      [data.name, data.display_rows, data.sort, data.status, id]
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await pool.query('DELETE FROM politics_sections WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // 关联书籍相关方法
  static async getBooks(sectionId) {
    const sql = `
      SELECT b.*, psb.sort as psb_sort 
      FROM public_books b
      JOIN politics_section_books psb ON b.id = psb.book_id
      WHERE psb.section_id = ?
      ORDER BY psb.sort ASC, psb.id ASC
    `;
    const [rows] = await pool.query(sql, [sectionId]);
    return rows;
  }

  static async addBook(sectionId, bookId, sort = 0) {
    const [result] = await pool.query(
      'INSERT INTO politics_section_books (section_id, book_id, sort) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE sort = ?',
      [sectionId, bookId, sort, sort]
    );
    return result.affectedRows > 0;
  }

  static async removeBook(sectionId, bookId) {
    const [result] = await pool.query(
      'DELETE FROM politics_section_books WHERE section_id = ? AND book_id = ?',
      [sectionId, bookId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = PoliticsSection;
