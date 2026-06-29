const pool = require('../config/mysql');

class PublicQuestion {
  static async create(data) {
    const [result] = await pool.query(
      `INSERT INTO public_questions 
      (bookId, title, title_richtext, type, options, answer, answer_richtext, explanation, difficulty, original_book_number, original_book_title_page, original_book_comment_page, media, media_type, isKnowledgeCard, mnemonic, sort, answers_correct_number, answers_number, answer_accuracy, question_source, eid, cid) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.bookId,
        data.title,
        data.title_richtext,
        data.type || 1,
        data.options ? JSON.stringify(data.options) : null,
        data.answer,
        data.answer_richtext,
        data.explanation,
        data.difficulty || 3,
        data.original_book_number,
        data.original_book_title_page,
        data.original_book_comment_page,
        data.media,
        data.media_type || 1,
        data.isKnowledgeCard || false,
        data.mnemonic,
        data.sort || 0,
        data.answers_correct_number || 0,
        data.answers_number || 0,
        data.answer_accuracy || 0,
        data.question_source,
        data.eid || null,
        data.cid || null
      ]
    );
    return { id: result.insertId, ...data };
  }

  static async findByBookId(bookId) {
    const [rows] = await pool.query(`
      SELECT q.*, s.averageScore, s.totalAttempts 
      FROM public_questions q
      LEFT JOIN public_question_stats s ON q.id = s.questionId
      WHERE q.bookId = ? 
      ORDER BY q.sort ASC, q.id ASC
    `, [bookId]);
    return rows.map(row => {
      let options = row.options;
      if (typeof options === 'string') {
        try {
          options = JSON.parse(options);
        } catch (e) {
          console.error('JSON parse error for options:', options);
          options = null;
        }
      }
      return {
        ...row,
        options
      };
    });
  }

  static async bulkCreate(questions) {
    if (!questions || questions.length === 0) return [];
    
    const values = questions.map(q => [
      q.bookId,
      q.title,
      q.title_richtext,
      q.type || 1,
      q.options ? JSON.stringify(q.options) : null,
      q.answer,
      q.answer_richtext,
      q.explanation,
      q.difficulty || 3,
      q.original_book_number,
      q.original_book_title_page,
      q.original_book_comment_page,
      q.media,
      q.media_type || 1,
      q.isKnowledgeCard || false,
      q.mnemonic,
      q.sort || 0,
      q.answers_correct_number || 0,
      q.answers_number || 0,
      q.answer_accuracy || 0,
      q.question_source
    ]);

    const [result] = await pool.query(
      `INSERT INTO public_questions 
      (bookId, title, title_richtext, type, options, answer, answer_richtext, explanation, difficulty, original_book_number, original_book_title_page, original_book_comment_page, media, media_type, isKnowledgeCard, mnemonic, sort, answers_correct_number, answers_number, answer_accuracy, question_source) 
      VALUES ?`,
      [values]
    );
    return result;
  }
}

module.exports = PublicQuestion;
