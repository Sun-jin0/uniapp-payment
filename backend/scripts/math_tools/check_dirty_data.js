// 检查远程数据库脏数据情况
const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });

  console.log('=== 脏数据检查 ===\n');

  const [r1] = await c.query("SELECT COUNT(*) as cnt FROM math_questiondetails WHERE BusType='考点' AND (Title IS NULL OR Title='' OR Title='null')");
  console.log(`考点记录中空Title总数: ${r1[0].cnt}`);

  const [r2] = await c.query("SELECT COUNT(*) as cnt FROM math_questiondetails WHERE BusType='考点' AND Title='null'");
  console.log(`Title为字符串"null"的记录: ${r2[0].cnt}`);

  const [r3] = await c.query("SELECT COUNT(*) as cnt FROM math_questiondetails WHERE BusType='考点' AND LinkedKnowledgePointID IS NULL AND (Title IS NULL OR Title='' OR Title='null')");
  console.log(`未关联且Title为空: ${r3[0].cnt}`);

  const [r4] = await c.query("SELECT COUNT(*) as cnt FROM math_knowledgepoints WHERE (KPContent IS NULL OR KPContent='')");
  console.log(`知识点无内容: ${r4[0].cnt}`);

  await c.end();
  console.log('\n检查完成');
})();