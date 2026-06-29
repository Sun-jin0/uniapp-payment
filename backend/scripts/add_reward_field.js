const pool = require('../config/mysql');

async function addRewardField() {
  try {
    // 检查字段是否已存在
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'cards' AND COLUMN_NAME = 'is_reward'
    `);
    
    if (columns.length === 0) {
      // 添加 is_reward 字段
      await pool.query(`
        ALTER TABLE cards 
        ADD COLUMN is_reward BOOLEAN DEFAULT TRUE COMMENT '是否为奖励卡牌(可抽取加入卡池)'
      `);
      console.log('✓ cards 表添加 is_reward 字段成功');
      
      // 添加索引
      await pool.query(`
        ALTER TABLE cards 
        ADD INDEX idx_is_reward (is_reward)
      `);
      console.log('✓ 添加 is_reward 索引成功');
    } else {
      console.log('✓ is_reward 字段已存在');
    }
    
    // 更新现有数据，默认所有卡片都是奖励卡牌
    await pool.query(`
      UPDATE cards 
      SET is_reward = TRUE 
      WHERE is_reward IS NULL
    `);
    console.log('✓ 更新现有数据完成');
    
    console.log('\n数据库迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  }
}

addRewardField();
