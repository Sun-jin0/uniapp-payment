const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: '139.199.9.132',
  user: 'root',
  password: '4212b46b7c02ee61',
  database: 'quizmaster'
});

(async () => {
  try {
    const questionId = '177660906006639';
    
    // 模拟 getBatchQuestionDetailsFull 的查询
    const [questions] = await pool.query(`
      SELECT q.*, c.chapter_name, s.subject_name as major_name, p_info.paper_name as exam_paper_name
      FROM computer1_question q 
      LEFT JOIN computer1_chapter c ON q.chapter_id = c.chapter_id 
      LEFT JOIN computer1_subject s ON q.major_id = s.major_id
      LEFT JOIN (
        SELECT pq.question_id, MAX(p.title) as paper_name 
        FROM computer1_paper_question pq 
        JOIN computer1_paper p ON pq.paper_id = p.id
        GROUP BY pq.question_id
      ) p_info ON q.question_id = p_info.question_id
      WHERE q.question_id = ?
    `, [questionId]);
    
    const [options] = await pool.query(
      'SELECT question_id, option_key, option_value FROM computer1_question_option WHERE question_id = ? ORDER BY option_sort ASC',
      [questionId]
    );
    
    const [subs] = await pool.query(
      'SELECT * FROM computer1_question_sub WHERE question_id = ? ORDER BY question_order ASC',
      [questionId]
    );
    
    console.log('题目数量:', questions.length);
    console.log('选项数量:', options.length);
    console.log('小题数量:', subs.length);
    
    if (questions.length > 0) {
      const q = questions[0];
      const result = {
        ...q,
        options: options,
        subs: subs,
        tags: []
      };
      console.log('\n返回给小程序的数据:');
      console.log('question_id:', result.question_id);
      console.log('exercise_type:', result.exercise_type);
      console.log('exercise_type_name:', result.exercise_type_name);
      console.log('stem 长度:', result.stem?.length || 0);
      console.log('answer:', result.answer);
      console.log('analysis 长度:', result.analysis?.length || 0);
      console.log('options:', result.options);
    }
  } catch (e) {
    console.error('错误:', e.message);
  }
  process.exit(0);
})();
