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
      "SELECT ID, QuestionID, Context FROM math_questiondetails WHERE Context LIKE '%《解析》%' OR Context LIKE '%【解析】%' OR Context LIKE '%《/解析》%'"
    );
    console.log('找到包含解析标记的记录:', rows.length, '条');
    
    let updatedCount = 0;
    for (const row of rows) {
      let context = row.Context;
      if (!context) continue;
      
      const original = context;
      context = context.replace(/《解析》/g, '');
      context = context.replace(/【解析】/g, '');
      context = context.replace(/《\/解析》/g, '');
      
      if (context !== original) {
        await pool.query(
          'UPDATE math_questiondetails SET Context = ? WHERE ID = ?',
          [context, row.ID]
        );
        updatedCount++;
      }
    }
    console.log('已更新:', updatedCount, '条');
  } catch (err) {
    console.error('错误:', err);
  } finally {
    await pool.end();
  }
}

main();