const pool = require('../config/mysql');

async function addPitySystem() {
  try {
    // 创建用户保底记录表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_pity_records (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL COMMENT '用户ID',
        pity_counter INT DEFAULT 0 COMMENT '保底计数器',
        last_draw_date DATE COMMENT '最后抽卡日期',
        daily_first_draw BOOLEAN DEFAULT FALSE COMMENT '今日是否已首抽',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_id (user_id),
        INDEX idx_user_pity (user_id, pity_counter)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户保底记录表'
    `);
    console.log('✓ user_pity_records 表创建成功');

    // 修改 cards 表，添加层级字段
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'cards' AND COLUMN_NAME = 'tier'
    `);
    
    if (columns.length === 0) {
      await pool.query(`
        ALTER TABLE cards 
        ADD COLUMN tier ENUM('legendary', 'epic', 'rare', 'common', 'consolation') DEFAULT 'common' COMMENT '奖励层级'
      `);
      console.log('✓ cards 表添加 tier 字段成功');
      
      await pool.query(`
        ALTER TABLE cards 
        ADD INDEX idx_tier (tier)
      `);
      console.log('✓ 添加 tier 索引成功');
    }

    // 修改 user_draw_counts 表，添加连续未中奖计数
    const [drawColumns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'user_draw_counts' AND COLUMN_NAME = 'consecutive_no_reward'
    `);
    
    if (drawColumns.length === 0) {
      await pool.query(`
        ALTER TABLE user_draw_counts 
        ADD COLUMN consecutive_no_reward INT DEFAULT 0 COMMENT '连续未中奖次数'
      `);
      console.log('✓ user_draw_counts 表添加 consecutive_no_reward 字段成功');
    }

    console.log('\n保底系统数据库迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  }
}

addPitySystem();
