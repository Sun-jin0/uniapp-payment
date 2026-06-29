const pool = require('../config/mysql');

class PublicChapter {
  static async bulkCreate(chapters) {
    if (!chapters || chapters.length === 0) return null;
    
    const sql = `
      INSERT INTO public_chapters 
      (book_id, parent_id, name, level, question_count, start_index, end_index, sort_order, original_id) 
      VALUES ?
    `;
    
    const values = chapters.map(c => [
      c.book_id,
      c.parent_id,
      c.name,
      c.level,
      c.question_count || 0,
      c.start_index || 0,
      c.end_index || 0,
      c.sort_order || 0,
      c.original_id || null
    ]);
    
    const [result] = await pool.query(sql, [values]);
    return result;
  }

  static async deleteByBookId(bookId) {
    return await pool.query('DELETE FROM public_chapters WHERE book_id = ?', [bookId]);
  }

  static async findByBookId(bookId) {
    const [rows] = await pool.query(
      'SELECT * FROM public_chapters WHERE book_id = ? ORDER BY sort_order ASC, id ASC',
      [bookId]
    );
    return rows;
  }
}

module.exports = PublicChapter;
