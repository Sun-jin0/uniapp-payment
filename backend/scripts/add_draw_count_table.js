const pool = require('../config/mysql');

async function addDrawCountTable() {
  try {
    // 创建用户抽卡次数表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_draw_counts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL COMMENT '用户ID',
        remaining_draws INT DEFAULT 0 COMMENT '剩余抽卡次数',
        total_draws INT DEFAULT 0 COMMENT '总获取次数',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户抽卡次数表'
    `);
    console.log('✓ user_draw_counts 表创建成功');

    // 为现有用户初始化数据
    const [users] = await pool.query(`
      SELECT DISTINCT user_id FROM user_cards WHERE user_id NOT IN (SELECT user_id FROM user_draw_counts)
    `);

    for (const user of users) {
      await pool.query(`
        INSERT INTO user_draw_counts (user_id, remaining_draws, total_draws) VALUES (?, 0, 0)
      `, [user.user_id]);
    }

    console.log(`✓ 已为 ${users.length} 个用户初始化抽卡次数`);
    console.log('\n完成！');
    process.exit(0);
  } catch (error) {
    console.error('创建表失败:', error);
    process.exit(1);
  }
}

addDrawCountTable();
