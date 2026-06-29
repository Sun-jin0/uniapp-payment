const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });

  // 精确检查未关联记录的 Title 值
  const [rows] = await conn.query(`
    SELECT Title, COUNT(*) as cnt
    FROM math_questiondetails 
    WHERE BusType = '考点' AND LinkedKnowledgePointID IS NULL
    GROUP BY Title
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log('=== 未关联记录的 Title 分组统计 ===');
  for (const r of rows) {
    console.log(`  Title="${r.Title}" (类型: ${typeof r.Title === 'string' ? 'string' : typeof r.Title === 'object' ? 'NULL/None' : typeof r.Title}) → ${r.cnt}条`);
  }

  // 检查一些样本
  const [samples] = await conn.query(`
    SELECT ID, QuestionID, Title, Context
    FROM math_questiondetails 
    WHERE BusType = '考点' AND LinkedKnowledgePointID IS NULL
    LIMIT 10
  `);
  console.log('\n=== 未关联记录样本 ===');
  for (const s of samples) {
    console.log(`  ID=${s.ID} QID=${s.QuestionID} Title="${s.Title}" Context="${(s.Context||'').substring(0,30)}"`);
  }

  // 如果 Title 是真实的 SQL NULL，可以用 IS NULL 删除
  const [nullCount] = await conn.query(`
    SELECT COUNT(*) as c FROM math_questiondetails 
    WHERE BusType = '考点' AND LinkedKnowledgePointID IS NULL AND Title IS NULL
  `);
  console.log(`\nTitle IS SQL NULL: ${nullCount[0].c}`);

  const [emptyCount] = await conn.query(`
    SELECT COUNT(*) as c FROM math_questiondetails 
    WHERE BusType = '考点' AND LinkedKnowledgePointID IS NULL AND (Title = '' OR Title IS NULL)
  `);
  console.log(`Title 为空或NULL: ${emptyCount[0].c}`);

  const [nullStrCount] = await conn.query(`
    SELECT COUNT(*) as c FROM math_questiondetails 
    WHERE BusType = '考点' AND LinkedKnowledgePointID IS NULL AND Title = 'null'
  `);
  console.log(`Title = 'null' 字符串: ${nullStrCount[0].c}`);

  // 现在用正确的条件删除
  const [del] = await conn.query(`
    DELETE FROM math_questiondetails 
    WHERE BusType = '考点' 
      AND LinkedKnowledgePointID IS NULL 
      AND (Title IS NULL OR Title = '' OR Title = 'null')
      AND QuestionID IN (SELECT QuestionID FROM math_questions WHERE LinksCount IS NOT NULL AND LinksCount != '')
  `);
  console.log(`\n删除了 ${del.affectedRows} 条记录（题目有LinksCount）`);

  // 最终统计
  const [final] = await conn.query(
    "SELECT COUNT(*) as total, SUM(CASE WHEN LinkedKnowledgePointID IS NOT NULL THEN 1 ELSE 0 END) as linked FROM math_questiondetails WHERE BusType = '考点'"
  );
  const unlinked = final[0].total - final[0].linked;
  console.log(`\n最终状态: 总数=${final[0].total}, 已关联=${final[0].linked}, 未关联=${unlinked}`);

  await conn.end();
})();