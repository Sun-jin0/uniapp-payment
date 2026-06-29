const pool = require('../config/mysql');

async function updateUserCardsTable() {
  try {
    // 删除唯一约束，允许同一天多次抽到同一卡片
    await pool.query(`
      ALTER TABLE user_cards 
      DROP INDEX uk_user_card
    `);
    console.log('✓ 已删除唯一约束 uk_user_card');

    // 添加新的索引（不唯一）
    await pool.query(`
      ALTER TABLE user_cards 
      ADD INDEX idx_user_card (user_id, card_id)
    `);
    console.log('✓ 已添加索引 idx_user_card');

    console.log('\n表结构更新完成！');
    process.exit(0);
  } catch (error) {
    console.error('更新表结构失败:', error);
    process.exit(1);
  }
}

updateUserCardsTable();
