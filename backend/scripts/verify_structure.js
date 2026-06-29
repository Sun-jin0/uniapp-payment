const mysql = require('mysql2/promise');
require('dotenv').config();

mysql.createConnection({
  host: process.env.MYSQL_HOST || '139.199.9.132',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'quizmaster'
}).then(async c => {
  console.log('=== 科目分类 ===');
  const [subjects] = await c.query("SELECT * FROM math_knowledge_categories WHERE Description = '科目分类' ORDER BY CategoryCode");
  subjects.forEach(s => console.log(`  ${s.CategoryCode} - ${s.CategoryName}`));

  console.log('\n=== 章节 ===');
  const [chapters] = await c.query("SELECT * FROM math_knowledge_categories WHERE Description = '章节' ORDER BY CategoryCode LIMIT 5");
  chapters.forEach(ch => console.log(`  ${ch.CategoryCode} - ${ch.CategoryName}`));

  console.log('\n=== 考点分类 ===');
  const [cats] = await c.query("SELECT * FROM math_knowledge_categories WHERE Description = '考点分类' ORDER BY CategoryCode LIMIT 5");
  cats.forEach(cat => console.log(`  ${cat.CategoryCode} - ${cat.CategoryName}`));

  console.log('\n=== 具体考点 ===');
  const [items] = await c.query("SELECT * FROM math_knowledge_categories WHERE Description = '具体考点' ORDER BY CategoryCode LIMIT 5");
  items.forEach(item => console.log(`  ${item.CategoryCode} - ${item.CategoryName}`));

  await c.end();
});