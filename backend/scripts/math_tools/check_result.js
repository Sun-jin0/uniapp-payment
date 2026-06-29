const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host:'localhost', user:'root', password:'123456', database:'quizmaster' });

  // Check 函数的奇偶性 specifically
  const [q] = await conn.query(`
    SELECT q.QuestionID, q.LinksCount, q.LinkNames
    FROM math_questions q
    WHERE q.LinkNames LIKE '%函数的奇偶性%'
    LIMIT 5
  `);
  console.log(`"函数的奇偶性" 相关题目: ${q.length}`);
  
  for (const row of q) {
    const [details] = await conn.query(
      'SELECT ID, Title, LinkedKnowledgePointID FROM math_questiondetails WHERE QuestionID = ? AND BusType = ?',
      [row.QuestionID, '考点']
    );
    const kpDetail = details.find(d => d.Title && d.Title.includes('奇偶'));
    if (kpDetail) {
      const [kp] = await conn.query('SELECT KPTitle FROM math_knowledgepoints WHERE KnowledgePointID = ?', [kpDetail.LinkedKnowledgePointID]);
      console.log(`  QID=${row.QuestionID} → KPID=${kpDetail.LinkedKnowledgePointID} Title="${kp.length?kp[0].KPTitle:'?'}"`);
    } else {
      console.log(`  QID=${row.QuestionID} → 未找到考点详情`);
    }
  }

  // Total stats
  const [total] = await conn.query('SELECT COUNT(*) as c FROM math_questions WHERE LinksCount IS NOT NULL AND LinksCount != ""');
  const [linked] = await conn.query('SELECT COUNT(DISTINCT qd.QuestionID) as c FROM math_questiondetails qd WHERE qd.BusType = "考点" AND qd.LinkedKnowledgePointID IS NOT NULL');
  const [unlinked] = await conn.query('SELECT COUNT(*) as c FROM math_questiondetails qd WHERE qd.BusType = "考点" AND qd.LinkedKnowledgePointID IS NULL');
  const [records] = await conn.query('SELECT COUNT(*) as c, SUM(CASE WHEN LinkedKnowledgePointID IS NOT NULL THEN 1 ELSE 0 END) as linked FROM math_questiondetails WHERE BusType = "考点"');
  
  console.log(`\n=== 最终统计 ===`);
  console.log(`有 LinksCount 的题目: ${total[0].c}`);
  console.log(`已链接考点的题目: ${linked[0].c}`);
  console.log(`考点记录总数: ${records[0].c}, 已关联: ${records[0].linked}`);
  console.log(`未关联的考点记录: ${unlinked[0].c}`);

  await conn.end();
})();