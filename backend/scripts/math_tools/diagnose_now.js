const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });
  
  // 1. 检查空标题记录对应的题目是否有LinksCount
  console.log('=== 空标题未关联记录对应的题目情况 ===');
  const [emptyDetails] = await conn.query(`
    SELECT qd.ID, qd.QuestionID, q.LinksCount, q.LinkNames
    FROM math_questiondetails qd
    LEFT JOIN math_questions q ON qd.QuestionID = q.QuestionID
    WHERE qd.BusType = '考点' 
      AND (qd.Title IS NULL OR qd.Title = '')
      AND qd.LinkedKnowledgePointID IS NULL
    LIMIT 20
  `);
  for (const ed of emptyDetails) {
    console.log('DetailID:', ed.ID, 'QID:', ed.QuestionID, 
      'LinksCount:', ed.LinksCount, 'LinkNames:', ed.LinkNames);
  }
  
  // 2. 统计这些空记录对应的题目
  console.log('\n=== 空标题记录统计 ===');
  const [stats] = await conn.query(`
    SELECT 
      COUNT(*) as totalRecords,
      COUNT(DISTINCT qd.QuestionID) as totalQuestions,
      SUM(CASE WHEN q.LinksCount IS NOT NULL AND q.LinksCount != '' THEN 1 ELSE 0 END) as hasLinksCount,
      SUM(CASE WHEN q.LinksCount IS NULL OR q.LinksCount = '' THEN 1 ELSE 0 END) as noLinksCount
    FROM math_questiondetails qd
    LEFT JOIN math_questions q ON qd.QuestionID = q.QuestionID
    WHERE qd.BusType = '考点' 
      AND (qd.Title IS NULL OR qd.Title = '')
      AND qd.LinkedKnowledgePointID IS NULL
  `);
  console.log(stats[0]);
  
  // 3. 检查 math_knowledgepoints 是否有KPContent
  console.log('\n=== math_knowledgepoints KPContent 情况 ===');
  const [kpContent] = await conn.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN KPContent IS NOT NULL AND KPContent != '' THEN 1 ELSE 0 END) as hasContent,
      SUM(CASE WHEN KPContent IS NULL OR KPContent = '' THEN 1 ELSE 0 END) as noContent
    FROM math_knowledgepoints
  `);
  console.log(kpContent[0]);
  
  // 4. 检查 math_questiondetails 中已关联但Context为空的
  console.log('\n=== 已关联但Context为空 ===');
  const [linkedNoContext] = await conn.query(`
    SELECT COUNT(*) as c
    FROM math_questiondetails 
    WHERE BusType = '考点' 
      AND LinkedKnowledgePointID IS NOT NULL
      AND (Context IS NULL OR Context = '')
  `);
  console.log('已关联但无内容:', linkedNoContext[0].c);
  
  // 5. 检查195832的详情记录来源
  console.log('\n=== 195832 的完整math_questiondetails ===');
  const [q195832] = await conn.query(
    "SELECT * FROM math_questiondetails WHERE QuestionID = 195832 AND BusType = '考点'"
  );
  console.log('记录数:', q195832.length);
  for (const d of q195832) {
    console.log(JSON.stringify(d, null, 2));
  }
  
  await conn.end();
})();