/**
 * 创建头像框管理表
 * 运行: node scripts/create_avatar_frames_table.js
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

async function createAvatarFramesTable() {
  let connection;
  
  try {
    console.log('连接远程数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    console.log('1. 检查 avatar_frames 表是否存在...');
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE 'avatar_frames'
    `);

    if (tables.length > 0) {
      console.log('   ✓ avatar_frames 表已存在\n');
    } else {
      console.log('   表不存在，开始创建...\n');

      console.log('2. 创建 avatar_frames 表...');
      await connection.execute(`
        CREATE TABLE avatar_frames (
          id INT PRIMARY KEY AUTO_INCREMENT COMMENT '头像框ID',
          name VARCHAR(50) NOT NULL COMMENT '头像框名称',
          image_url VARCHAR(500) NOT NULL COMMENT '头像框图片URL',
          effect_code TEXT COMMENT '特效CSS/JS代码',
          required_level INT DEFAULT 1 COMMENT '需要的用户等级',
          required_points INT DEFAULT 0 COMMENT '需要的积分',
          is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用: 1=启用, 0=禁用',
          sort_order INT DEFAULT 0 COMMENT '排序顺序',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='头像框管理表'
      `);
      console.log('   ✓ 表创建成功\n');

      console.log('3. 插入默认头像框数据...');
      await connection.execute(`
        INSERT INTO avatar_frames (name, image_url, effect_code, required_level, required_points, is_active, sort_order) VALUES
        ('珍品传说', '/static/images/珍品传说.png', '', 10, 0, 1, 1),
        ('浪一下', '/static/images/浪一下.png', '', 5, 0, 1, 2)
      `);
      console.log('   ✓ 默认数据插入成功\n');
    }

    console.log('========================================');
    console.log('✅ 头像框管理表创建完成！');
    console.log('========================================');

  } catch (error) {
    console.error('❌ 创建失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

createAvatarFramesTable();
