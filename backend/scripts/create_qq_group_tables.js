/**
 * 创建Q群讨论表
 * 运行: node scripts/create_qq_group_tables.js
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

async function createQQGroupTables() {
  let connection;
  
  try {
    console.log('连接远程数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');

    console.log('1. 创建QQ群表 qq_groups...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS qq_groups (
        id INT PRIMARY KEY AUTO_INCREMENT COMMENT '群ID',
        name VARCHAR(100) NOT NULL COMMENT '群名称',
        org_name VARCHAR(100) COMMENT '机构名称',
        group_number VARCHAR(20) NOT NULL COMMENT '群号',
        description TEXT COMMENT '群描述',
        tags JSON COMMENT '标签（JSON数组）',
        member_count INT DEFAULT 0 COMMENT '成员数量',
        qr_code VARCHAR(255) COMMENT '群二维码图片',
        is_pinned TINYINT DEFAULT 0 COMMENT '是否置顶：1-是，0-否',
        sort_order INT DEFAULT 0 COMMENT '排序（越大越靠前）',
        is_active TINYINT DEFAULT 1 COMMENT '状态：1-启用，0-禁用',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        INDEX idx_is_pinned (is_pinned),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='QQ群表'
    `);
    console.log('   ✓ qq_groups 表创建成功\n');

    console.log('2. 检查是否已有数据...');
    const [groups] = await connection.execute('SELECT COUNT(*) as count FROM qq_groups');
    if (groups[0].count === 0) {
      console.log('   插入示例数据...');
      await connection.execute(`
        INSERT INTO qq_groups (name, org_name, group_number, description, tags, member_count, is_pinned) VALUES
        ('考研数学交流群', '考研数学', '123456789', '考研数学学习交流，每日打卡，答疑解惑', '["数学一", "数学二", "答疑"]', 1500, 1),
        ('考研数学刷题群', '考研数学', '987654321', '专注刷题，共同进步', '["刷题", "每日一练"]', 800, 0),
        ('考研英语学习群', '考研英语', '111222333', '英语学习交流，词汇打卡', '["英语一", "英语二", "词汇"]', 1200, 0),
        ('考研英语作文群', '考研英语', '444555666', '作文模板分享，写作练习', '["作文", "模板"]', 600, 0),
        ('考研政治交流群', '考研政治', '777888999', '政治学习交流，时政分享', '["政治", "时政"]', 1000, 0)
      `);
      console.log('   ✓ 示例数据插入成功\n');
    } else {
      console.log('   ✓ 数据已存在，跳过插入\n');
    }

    console.log('========================================');
    console.log('✅ Q群讨论表创建完成！');
    console.log('   - qq_groups (QQ群表)');
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

createQQGroupTables();
