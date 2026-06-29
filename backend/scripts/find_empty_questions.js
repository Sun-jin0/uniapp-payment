const mysql = require('mysql2/promise');
const fs = require('fs');

async function main() {
  const pool = mysql.createPool({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });
  try {
    const [rows] = await pool.query(
      "SELECT QuestionID FROM math_questions WHERE QuestionText IS NULL OR QuestionText = '' OR QuestionText = ' '"
    );
    console.log('找到空内容题目:', rows.length, '道');
    const ids = rows.map(r => r.QuestionID).join('\n');
    fs.writeFileSync('empty_questions.txt', ids);
    console.log('已写入 empty_questions.txt');
    if (rows.length > 0) {
      console.log('前10个ID:', rows.slice(0, 10).map(r => r.QuestionID).join(', '));
    }
  } catch (err) {
    console.error('错误:', err);
  } finally {
    await pool.end();
  }
}

main();