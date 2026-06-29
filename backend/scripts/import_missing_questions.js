const mysql = require('mysql2/promise');
const fs = require('fs');

async function main() {
  const pool = mysql.createPool({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });
  
  const data = JSON.parse(fs.readFileSync('缺失.json', 'utf8'));
  console.log('读取到', data.length, '条题目数据');
  
  let updatedCount = 0;
  let skippedCount = 0;
  let notFoundCount = 0;
  
  try {
    for (const q of data) {
      const qid = q.ID;
      const qText = q.QuestionTxt || '';
      const qImg = q.QuestionImg || null;
      const qType = q.QuestionType || null;
      const linksCount = q.LinksCount || null;
      const linkNames = q.LinkNames || null;
      
      const [existing] = await pool.query(
        'SELECT QuestionID FROM math_questions WHERE QuestionID = ?',
        [qid]
      );
      
      if (existing.length === 0) {
        notFoundCount++;
        console.log('题目不存在:', qid);
        continue;
      }
      
      if (!qText && !qImg) {
        skippedCount++;
        continue;
      }
      
      await pool.query(
        `UPDATE math_questions SET 
          QuestionText = ?, 
          QuestionType = ?, 
          LinksCount = ?, 
          LinkNames = ?
        WHERE QuestionID = ?`,
        [qText, qType, linksCount, linkNames, qid]
      );
      
      updatedCount++;
    }
    
    console.log('\n导入完成:');
    console.log('  更新:', updatedCount, '道');
    console.log('  跳过(无内容):', skippedCount, '道');
    console.log('  不存在:', notFoundCount, '道');
  } catch (err) {
    console.error('错误:', err);
  } finally {
    await pool.end();
  }
}

main();