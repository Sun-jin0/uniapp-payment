const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host:'localhost', user:'root', password:'123456', database:'quizmaster' });

  console.log('=== 考点关联现状 ===\n');

  // 1. 总览
  const [qTotal] = await conn.query('SELECT COUNT(*) as c FROM math_questions');
  console.log(`题目总数: ${qTotal[0].c}`);

  // 2. questiondetails统计
  const [detStats] = await conn.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN LinkedKnowledgePointID IS NOT NULL THEN 1 ELSE 0 END) as linked,
      SUM(CASE WHEN LinkedKnowledgePointID IS NULL THEN 1 ELSE 0 END) as unlinked
    FROM math_questiondetails
  `);
  console.log(`\nquestiondetails 总数: ${detStats[0].total}`);
  console.log(`  已关联考点: ${detStats[0].linked}`);
  console.log(`  未关联考点: ${detStats[0].unlinked}`);

  // 3. 按BusType统计未关联的
  const [busTypeStats] = await conn.query(`
    SELECT BusType, COUNT(*) as total,
      SUM(CASE WHEN LinkedKnowledgePointID IS NOT NULL THEN 1 ELSE 0 END) as linked,
      SUM(CASE WHEN LinkedKnowledgePointID IS NULL THEN 1 ELSE 0 END) as unlinked
    FROM math_questiondetails
    GROUP BY BusType
    ORDER BY total DESC
  `);
  console.log('\n按BusType统计:');
  for (const r of busTypeStats) {
    console.log(`  ${r.BusType}: 共${r.total}, 已关联${r.linked}, 未关联${r.unlinked}`);
  }

  // 4. 查看未关联的考点记录示例
  const [unlinkedSamples] = await conn.query(`
    SELECT qd.ID, qd.QuestionID, qd.BusType, qd.Title as KPTitle, 
           LEFT(qd.Context, 80) as ContextPreview,
           LEFT(qd.Notes, 80) as NotesPreview
    FROM math_questiondetails qd
    WHERE qd.BusType = '考点' 
    AND qd.LinkedKnowledgePointID IS NULL
    LIMIT 20
  `);
  console.log(`\n未关联的'考点'类型记录 (${unlinkedSamples.length}条):`);
  for (const r of unlinkedSamples) {
    console.log(`  ID=${r.ID} QID=${r.QuestionID} Title=${r.KPTitle || '(空)'}`);
    console.log(`    Context: ${r.ContextPreview || '(空)'}`);
  }

  // 5. 查看math_knowledgepoints表的前20条KPTitle
  const [kps] = await conn.query('SELECT KnowledgePointID, KPCode, KPTitle FROM math_knowledgepoints ORDER BY KnowledgePointID LIMIT 20');
  console.log('\nmath_knowledgepoints表(前20条):');
  for (const r of kps) {
    console.log(`  KPID=${r.KnowledgePointID} Code=${r.KPCode} Title=${r.KPTitle}`);
  }
  
  // 6. 统计 questiondetails 中的 Title 列表（主要是考点类型的）
  const [kpTitles] = await conn.query(`
    SELECT DISTINCT qd.Title 
    FROM math_questiondetails qd 
    WHERE qd.BusType = '考点' 
    AND qd.Title IS NOT NULL 
    AND qd.Title != ''
    AND qd.LinkedKnowledgePointID IS NULL
    ORDER BY qd.Title
  `);
  console.log(`\n未关联考点的Title列表 (共${kpTitles.length}个):`);
  for (const r of kpTitles) {
    console.log(`  "${r.Title}"`);
  }

  await conn.end();
})();