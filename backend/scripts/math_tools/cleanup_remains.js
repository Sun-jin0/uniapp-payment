const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });

  // 1. 删除 Title="null" 且未关联的记录（这些已被脚本创建的正确新记录替代）
  const [delResult] = await conn.query(`
    DELETE FROM math_questiondetails 
    WHERE BusType = '考点' 
      AND LinkedKnowledgePointID IS NULL 
      AND Title = 'null'
  `);
  console.log(`已删除 Title="null" 的未关联考点记录: ${delResult.affectedRows} 条`);

  // 2. 对于没有 LinksCount 的题目对应的未关联记录，尝试用 Title 匹配
  const [remainWithLinks] = await conn.query(`
    SELECT COUNT(*) as c FROM math_questiondetails qd
    JOIN math_questions q ON q.QuestionID = qd.QuestionID
    WHERE qd.BusType = '考点' 
      AND qd.LinkedKnowledgePointID IS NULL 
      AND (q.LinksCount IS NOT NULL AND q.LinksCount != '')
  `);
  console.log(`仍有 LinksCount 但未关联的记录: ${remainWithLinks[0].c} 条`);

  const [remainNoLinks] = await conn.query(`
    SELECT COUNT(*) as c FROM math_questiondetails qd
    LEFT JOIN math_questions q ON q.QuestionID = qd.QuestionID
    WHERE qd.BusType = '考点' 
      AND qd.LinkedKnowledgePointID IS NULL 
      AND (q.LinksCount IS NULL OR q.LinksCount = '')
  `);
  console.log(`没有 LinksCount 的未关联记录: ${remainNoLinks[0].c} 条`);

  // 3. 看看还有哪些未关联、Title不为null的记录
  const [others] = await conn.query(`
    SELECT COUNT(*) as c FROM math_questiondetails 
    WHERE BusType = '考点' 
      AND LinkedKnowledgePointID IS NULL 
      AND (Title IS NULL OR Title = '' OR Title = 'null')
  `);
  console.log(`\n剩余未关联记录中 Title 为空或null: ${others[0].c} 条`);

  const [normalTitles] = await conn.query(`
    SELECT qd.ID, qd.QuestionID, qd.Title, q.LinksCount, q.LinkNames
    FROM math_questiondetails qd
    LEFT JOIN math_questions q ON q.QuestionID = qd.QuestionID
    WHERE qd.BusType = '考点' 
      AND qd.LinkedKnowledgePointID IS NULL 
      AND qd.Title IS NOT NULL AND qd.Title != '' AND qd.Title != 'null'
    LIMIT 20
  `);
  console.log(`\n剩余有正常Title的未关联记录样本 (${normalTitles.length}条):`);
  for (const d of normalTitles) {
    console.log(`  ID=${d.ID} QID=${d.QuestionID} Title="${d.Title}" Links="${d.LinkNames}"`);
  }

  // 最终统计
  const [final] = await conn.query(
    "SELECT COUNT(*) as total, SUM(CASE WHEN LinkedKnowledgePointID IS NOT NULL THEN 1 ELSE 0 END) as linked FROM math_questiondetails WHERE BusType = '考点'"
  );
  console.log(`\n最终状态: 总数=${final[0].total}, 已关联=${final[0].linked}, 未关联=${final[0].total-final[0].linked}`);

  await conn.end();
})();