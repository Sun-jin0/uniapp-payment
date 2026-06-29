const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host:'localhost', user:'root', password:'123456', database:'quizmaster' });

  // 检查 math_knowledgepoints 的所有字段
  const [columns] = await conn.query('SHOW COLUMNS FROM math_knowledgepoints');
  console.log('=== math_knowledgepoints 表结构 ===');
  for (const col of columns) {
    console.log(`  ${col.Field} (${col.Type})`);
  }

  // 检查一些样本数据
  const [samples] = await conn.query('SELECT * FROM math_knowledgepoints LIMIT 10');
  console.log('\n=== math_knowledgepoints 样本数据 ===');
  for (const s of samples) {
    console.log(`  KPID=${s.KnowledgePointID}  KPTitle="${s.KPTitle}"  KPCode="${s.KPCode}"  KPContent="${(s.KPContent||'').substring(0,50)}"`);
  }

  // 用 LinksCount 中的值（1917,1918,1924,1925,2428）直接查
  const oldIds = [1917, 1918, 1924, 1925, 2428];
  console.log('\n=== 用旧ID查询 math_knowledgepoints ===');
  for (const id of oldIds) {
    // 查 KnowledgePointID
    let [rows] = await conn.query('SELECT * FROM math_knowledgepoints WHERE KnowledgePointID = ?', [id]);
    if (rows.length > 0) {
      console.log(`  KnowledgePointID=${id} → KPTitle="${rows[0].KPTitle}"`);
      continue;
    }
    // 查 KPCode
    [rows] = await conn.query('SELECT * FROM math_knowledgepoints WHERE KPCode = ?', [String(id)]);
    if (rows.length > 0) {
      console.log(`  KPCode=${id} → KPID=${rows[0].KnowledgePointID} KPTitle="${rows[0].KPTitle}"`);
      continue;
    }
    // 查 KPCode 包含 id
    [rows] = await conn.query('SELECT * FROM math_knowledgepoints WHERE KPCode LIKE ?', [`%${id}%`]);
    if (rows.length > 0) {
      console.log(`  KPCode包含${id}: KPID=${rows[0].KnowledgePointID} KPTitle="${rows[0].KPTitle}" KPCode="${rows[0].KPCode}"`);
      continue;
    }
    console.log(`  ID ${id} → 未找到`);
  }

  // 看看 math_knowledgepoints 的 KPCode 都是什么格式
  console.log('\n=== math_knowledgepoints KPCode 样本 ===');
  const [codes] = await conn.query('SELECT KPCode FROM math_knowledgepoints WHERE KPCode IS NOT NULL AND KPCode != "" LIMIT 20');
  for (const c of codes) {
    console.log(`  KPCode="${c.KPCode}"`);
  }

  // 看看是否有其他链接表
  const [tables] = await conn.query('SHOW TABLES LIKE "%knowledge%link%"');
  console.log('\n=== 知识点的关联表 ===');
  for (const t of tables) {
    console.log(`  ${Object.values(t)[0]}`);
  }

  await conn.end();
})();