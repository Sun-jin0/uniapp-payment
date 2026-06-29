const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });

  // 检查未关联的考点记录对应的题目是否有 LinksCount
  const [unlinked] = await conn.query(`
    SELECT qd.ID, qd.QuestionID, qd.Title, q.LinksCount, q.LinkNames
    FROM math_questiondetails qd
    LEFT JOIN math_questions q ON q.QuestionID = qd.QuestionID
    WHERE qd.BusType = '考点' AND qd.LinkedKnowledgePointID IS NULL
    LIMIT 50
  `);

  console.log(`=== 未关联考点记录样本 (${unlinked.length}条) ===\n`);
  for (const d of unlinked) {
    console.log(`DetailsID=${d.ID} QID=${d.QuestionID} Title="${d.Title}"`);
    console.log(`  LinksCount="${d.LinksCount}" LinkNames="${d.LinkNames}"\n`);
  }

  // 统计未关联记录中，有多少题的 LinksCount 为空
  const [stats] = await conn.query(`
    SELECT 
      SUM(CASE WHEN q.LinksCount IS NULL OR q.LinksCount = '' THEN 1 ELSE 0 END) as no_links,
      SUM(CASE WHEN q.LinksCount IS NOT NULL AND q.LinksCount != '' THEN 1 ELSE 0 END) as has_links
    FROM math_questiondetails qd
    LEFT JOIN math_questions q ON q.QuestionID = qd.QuestionID
    WHERE qd.BusType = '考点' AND qd.LinkedKnowledgePointID IS NULL
  `);

  console.log(`\n未关联考点统计:`);
  console.log(`  对应题目无 LinksCount: ${stats[0].no_links}`);
  console.log(`  对应题目有 LinksCount: ${stats[0].has_links}`);

  // 如果有有 LinksCount 但仍未关联的，看具体哪些
  if (stats[0].has_links > 0) {
    console.log(`\n=== 有 LinksCount 但仍未关联的记录 ===`);
    const [withLinks] = await conn.query(`
      SELECT qd.ID, qd.QuestionID, qd.Title, q.LinksCount, q.LinkNames
      FROM math_questiondetails qd
      JOIN math_questions q ON q.QuestionID = qd.QuestionID
      WHERE qd.BusType = '考点' AND qd.LinkedKnowledgePointID IS NULL
        AND q.LinksCount IS NOT NULL AND q.LinksCount != ''
      LIMIT 30
    `);
    for (const d of withLinks) {
      console.log(`\nDetailsID=${d.ID} QID=${d.QuestionID}`);
      console.log(`  详情Title="${d.Title}"`);
      console.log(`  LinkNames="${d.LinkNames}"`);
    }
  }

  await conn.end();
})();