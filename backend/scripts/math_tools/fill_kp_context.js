// 远程数据库考点内容回填脚本
// 功能：将 math_questiondetails 中已关联 LinkedKnowledgePointID 但 Context 为空的记录，
//       从 math_knowledgepoints.KPContent 回填 Context 字段

const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });

  console.log('=== 远程数据库考点内容回填 ===\n');

  // 1. 统计概况
  const [totalStats] = await conn.query(
    "SELECT COUNT(*) as total FROM math_questiondetails WHERE BusType = '考点'"
  );
  const [linkedStats] = await conn.query(
    "SELECT COUNT(*) as total FROM math_questiondetails WHERE BusType = '考点' AND LinkedKnowledgePointID IS NOT NULL"
  );
  const [emptyContextStats] = await conn.query(
    "SELECT COUNT(*) as total FROM math_questiondetails WHERE BusType = '考点' AND LinkedKnowledgePointID IS NOT NULL AND (Context IS NULL OR Context = '')"
  );

  console.log(`考点记录总数: ${totalStats[0].total}`);
  console.log(`已关联考点记录: ${linkedStats[0].total}`);
  console.log(`已关联但Context为空: ${emptyContextStats[0].total}`);

  if (emptyContextStats[0].total === 0) {
    console.log('\n没有需要回填的记录，任务完成。');
    await conn.end();
    process.exit(0);
  }

  // 2. 获取这些记录以及对应的知识点内容
  const [emptyRecords] = await conn.query(`
    SELECT qd.ID, qd.QuestionID, qd.Title, qd.LinkedKnowledgePointID, kp.KPContent
    FROM math_questiondetails qd
    JOIN math_knowledgepoints kp ON qd.LinkedKnowledgePointID = kp.KnowledgePointID
    WHERE qd.BusType = '考点'
      AND qd.LinkedKnowledgePointID IS NOT NULL
      AND (qd.Context IS NULL OR qd.Context = '')
  `);

  console.log(`\n待回填记录数: ${emptyRecords.length}`);

  // 统计是否有 KPContent 也为空的
  const emptyKpContent = emptyRecords.filter(r => !r.KPContent || r.KPContent.trim() === '');
  const hasKpContent = emptyRecords.filter(r => r.KPContent && r.KPContent.trim() !== '');
  
  console.log(`  - 知识点有内容的: ${hasKpContent.length}`);
  console.log(`  - 知识点内容也为空: ${emptyKpContent.length}`);

  if (emptyKpContent.length > 0) {
    console.log('\n知识点内容也为空的记录（无法回填，需要手动补充知识点内容）:');
    const sample = emptyKpContent.slice(0, 10);
    for (const r of sample) {
      console.log(`  ID=${r.ID}, QuestionID=${r.QuestionID}, Title="${r.Title}", LinkedKPID=${r.LinkedKnowledgePointID}`);
    }
    if (emptyKpContent.length > 10) {
      console.log(`  ... 还有 ${emptyKpContent.length - 10} 条`);
    }
  }

  // 3. 执行回填
  if (hasKpContent.length > 0) {
    console.log(`\n开始回填 ${hasKpContent.length} 条记录的 Context...`);
    let updated = 0;
    const startTime = Date.now();

    for (const record of hasKpContent) {
      await conn.query(
        'UPDATE math_questiondetails SET Context = ? WHERE ID = ?',
        [record.KPContent, record.ID]
      );
      updated++;
      if (updated % 500 === 0 || updated === hasKpContent.length) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  进度: ${updated}/${hasKpContent.length} | 耗时: ${elapsed}s`);
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n回填完成！共更新 ${updated} 条记录，耗时 ${totalTime}s`);
  }

  // 4. 验证最终结果
  const [finalEmptyStats] = await conn.query(
    "SELECT COUNT(*) as total FROM math_questiondetails WHERE BusType = '考点' AND LinkedKnowledgePointID IS NOT NULL AND (Context IS NULL OR Context = '')"
  );
  console.log(`\n最终检查: 已关联但Context为空的记录数: ${finalEmptyStats[0].total}`);

  if (finalEmptyStats[0].total > 0) {
    console.log('这些记录的考点内容在 math_knowledgepoints 中也为空，需要手动补充知识点内容。');
  } else {
    console.log('所有考点内容已成功回填！');
  }

  await conn.end();
  console.log('\n完成！');
})();