const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.MYSQL_HOST || '139.199.9.132',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'quizmaster',
  port: process.env.MYSQL_PORT || 3306
};

async function verifyData() {
  let connection;
  
  try {
    console.log('连接远程数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');
    
    // 查询 pan_resource 类型的数据
    console.log('1. 查询 pan_resource 类型的数据：');
    const [panResources] = await connection.execute(`
      SELECT id, title, category, noticeType, isActive, isTop, createdAt
      FROM notices
      WHERE noticeType = 'pan_resource'
      ORDER BY createdAt DESC
      LIMIT 5
    `);
    
    console.log(`   找到 ${panResources.length} 条 pan_resource 数据`);
    panResources.forEach(item => {
      console.log(`   - [${item.id}] ${item.title.substring(0, 30)}... (${item.category}) - 状态: ${item.isActive}`);
    });
    
    // 查询总数
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total FROM notices WHERE noticeType = 'pan_resource'
    `);
    console.log(`\n   总计: ${countResult[0].total} 条`);
    
    console.log('\n========================================');
    console.log('验证完成！');
    console.log('========================================');

  } catch (error) {
    console.error('执行失败:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

verifyData();
