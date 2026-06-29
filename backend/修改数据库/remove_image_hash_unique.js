const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'quizmaster',
  multipleStatements: true
};

async function removeUniqueConstraint() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('开始修改图片管理表...\n');
    
    // 检查是否存在唯一索引
    const [rows] = await connection.execute(`
      SELECT INDEX_NAME 
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'image_management' 
      AND INDEX_NAME = 'uk_image_hash'
    `, [dbConfig.database]);
    
    if (rows.length > 0) {
      console.log('发现唯一索引 uk_image_hash，准备移除...');
      
      // 移除唯一索引
      await connection.execute(`
        ALTER TABLE image_management DROP INDEX uk_image_hash
      `);
      console.log('✓ 已移除唯一索引 uk_image_hash');
      
      // 添加普通索引
      await connection.execute(`
        ALTER TABLE image_management ADD INDEX idx_image_hash (image_hash)
      `);
      console.log('✓ 已添加普通索引 idx_image_hash');
    } else {
      console.log('未找到唯一索引 uk_image_hash，无需修改');
    }
    
    console.log('\n数据库修改完成！');
  } catch (error) {
    console.error('修改失败:', error.message);
  } finally {
    await connection.end();
  }
}

removeUniqueConstraint();
