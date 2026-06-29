// 检查知识点无内容的76条记录
const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: '139.199.9.132',
    user: 'root',
    password: '4212b46b7c02ee61',
    database: 'quizmaster'
  });

  const [r] = await c.query("SELECT KnowledgePointID, KPTitle, KPCode, KPContent FROM math_knowledgepoints WHERE (KPContent IS NULL OR KPContent = '')");
  console.log('知识点无内容(' + r.length + '个):');
  r.forEach(k => {
    console.log('  ID=' + k.KnowledgePointID + ', Title="' + k.KPTitle + '", Code=' + k.KPCode);
  });

  await c.end();
})();