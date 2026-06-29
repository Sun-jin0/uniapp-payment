const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });
  try {
    const [rows] = await pool.query(
      "SELECT DISTINCT VersionInfo FROM math_books WHERE ContentType = 'mock_paper' ORDER BY VersionInfo"
    );
    console.log('模拟卷年份列表:', rows.map(r => r.VersionInfo).join(', '));
    
    const [all] = await pool.query(
      'SELECT DISTINCT VersionInfo FROM math_books ORDER BY VersionInfo'
    );
    console.log('所有书籍年份:', all.map(r => r.VersionInfo).join(', '));
  } catch (err) { 
    console.error('错误:', err); 
  } finally { 
    await pool.end(); 
  }
}

main();