/**
 * 迁移QQ群表：将 status 字段改为 is_active
 * 运行: node scripts/migrate_qq_group_status.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.MYSQL_HOST || '139.199.9.132',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'quizmaster',
  port: process.env.MYSQL_PORT || 3306
};

async function migrateQQGroupStatus() {
  let connection;
  
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    // 检查是否存在 status 字段
    console.log('1. 检查表结构...');
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM qq_groups WHERE Field = 'status'
    `);
    
    if (columns.length === 0) {
      console.log('   ✓ 不存在 status 字段，检查 is_active 字段...');
      const [isActiveColumns] = await connection.execute(`
        SHOW COLUMNS FROM qq_groups WHERE Field = 'is_active'
      `);
      if (isActiveColumns.length > 0) {
        console.log('   ✓ is_active 字段已存在，无需迁移\n');
      } else {
        console.log('   ⚠ 既不存在 status 也不存在 is_active，需要创建 is_active 字段\n');
        await connection.execute(`
          ALTER TABLE qq_groups 
          ADD COLUMN is_active TINYINT DEFAULT 1 COMMENT '状态：1-启用，0-禁用',
          ADD INDEX idx_is_active (is_active)
        `);
        console.log('   ✓ is_active 字段创建成功\n');
      }
    } else {
      console.log('   ✓ 发现 status 字段，开始迁移...\n');
      
      // 添加 is_active 字段
      console.log('2. 添加 is_active 字段...');
      await connection.execute(`
        ALTER TABLE qq_groups 
        ADD COLUMN is_active TINYINT DEFAULT 1 COMMENT '状态：1-启用，0-禁用'
      `);
      console.log('   ✓ is_active 字段添加成功\n');
      
      // 将 status 数据复制到 is_active
      console.log('3. 复制数据...');
      await connection.execute(`
        UPDATE qq_groups SET is_active = status
      `);
      console.log('   ✓ 数据复制成功\n');
      
      // 删除 status 字段
      console.log('4. 删除 status 字段...');
      await connection.execute(`
        ALTER TABLE qq_groups DROP COLUMN status
      `);
      console.log('   ✓ status 字段删除成功\n');
      
      // 添加索引
      console.log('5. 添加索引...');
      await connection.execute(`
        ALTER TABLE qq_groups ADD INDEX idx_is_active (is_active)
      `);
      console.log('   ✓ 索引添加成功\n');
    }

    console.log('========================================');
    console.log('✅ 迁移完成！');
    console.log('========================================');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

migrateQQGroupStatus();
