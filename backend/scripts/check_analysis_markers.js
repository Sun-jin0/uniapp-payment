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
      "SELECT ID, QuestionID, BusType, Context FROM math_questiondetails WHERE Context LIKE '%解析%'"
    );
    console.log('找到包含"解析"字样的记录:', rows.length, '条');
    
    const markers = ['《解析》', '【解析】', '《/解析》'];
    const withMarkers = rows.filter(r => {
      const ctx = r.Context || '';
      return markers.some(m => ctx.includes(m));
    });
    
    console.log('包含标记的记录:', withMarkers.length, '条');
    if (withMarkers.length > 0) {
      console.log('示例:');
      withMarkers.slice(0, 3).forEach(r => {
        console.log(`ID: ${r.ID}, QID: ${r.QuestionID}, BusType: ${r.BusType}`);
        console.log(`Context片段: ${(r.Context || '').substring(0, 200)}`);
        console.log('---');
      });
    }
  } catch (err) {
    console.error('错误:', err);
  } finally {
    await pool.end();
  }
}

main();