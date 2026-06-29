const mysql = require('mysql2/promise');

(async () => {
  try {
    // 尝试连接远程数据库 - 使用常见配置
    const conn = await mysql.createConnection({
      host: 'yizhancs.cn',
      user: 'root',
      password: '123456',
      database: 'quizmaster',
      port: 3306,
      connectTimeout: 5000
    });
    console.log('✅ 成功连接远程数据库 yizhancs.cn');
    
    // 检查 math_knowledgepoints 中是否存在 1917,1918 等 ID
    const oldIds = [1917, 1918, 1924, 1925, 2428];
    console.log('\n=== 用旧ID直接查询 KnowledgePointID ===');
    for (const id of oldIds) {
      const [rows] = await conn.query('SELECT * FROM math_knowledgepoints WHERE KnowledgePointID = ?', [id]);
      if (rows.length > 0) {
        console.log(`  ✅ KnowledgePointID=${id} → KPTitle="${rows[0].KPTitle}" KPCode="${rows[0].KPCode}"`);
      } else {
        console.log(`  ❌ KnowledgePointID=${id} → 未找到`);
      }
    }

    // 检查 KPCode 字段中是否有这些值
    console.log('\n=== 用旧ID查询 KPCode ===');
    for (const id of oldIds) {
      const [rows] = await conn.query('SELECT * FROM math_knowledgepoints WHERE KPCode = ?', [String(id)]);
      if (rows.length > 0) {
        console.log(`  ✅ KPCode="${id}" → KPID=${rows[0].KnowledgePointID} KPTitle="${rows[0].KPTitle}"`);
      } else {
        console.log(`  ❌ KPCode="${id}" → 未找到`);
      }
    }

    // 检查 math_knowledgepoints 总数
    const [count] = await conn.query('SELECT COUNT(*) as c FROM math_knowledgepoints');
    console.log(`\nmath_knowledgepoints 总数: ${count[0].c}`);

    // 查看一些样本
    const [samples] = await conn.query('SELECT KnowledgePointID, KPTitle, KPCode FROM math_knowledgepoints LIMIT 15');
    console.log('\n=== 远程 math_knowledgepoints 样本 ===');
    for (const s of samples) {
      console.log(`  KPID=${s.KnowledgePointID}  Title="${s.KPTitle}"  Code="${s.KPCode}"`);
    }

    // 检查 math_questions 中 LinksCount 的样本
    const [qSamples] = await conn.query(
      'SELECT QuestionID, LinksCount, LinkNames FROM math_questions WHERE LinksCount IS NOT NULL AND LinksCount != "" LIMIT 10'
    );
    console.log('\n=== 远程 math_questions LinksCount 样本 ===');
    for (const q of qSamples) {
      console.log(`  QID=${q.QuestionID}  LinksCount=${q.LinksCount}  LinkNames="${q.LinkNames}"`);
    }

    // 检查 math_questiondetails 中考点记录
    const [detCount] = await conn.query(
      "SELECT COUNT(*) as c, SUM(CASE WHEN LinkedKnowledgePointID IS NOT NULL THEN 1 ELSE 0 END) as linked FROM math_questiondetails WHERE BusType = '考点'"
    );
    console.log(`\n=== 远程 math_questiondetails 考点记录 ===`);
    console.log(`  总数: ${detCount[0].c}, 已关联: ${detCount[0].linked}, 未关联: ${detCount[0].c - detCount[0].linked}`);

    await conn.end();
  } catch (e) {
    console.error(`❌ 连接失败: ${e.message}`);
  }
})();