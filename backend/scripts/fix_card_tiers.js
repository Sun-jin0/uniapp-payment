const pool = require('../config/mysql');

async function fixCardTiers() {
  try {
    // 根据卡牌名称设置对应的 tier
    const tierUpdates = [
      // 传说卡 (legendary) - 最稀有
      { name: '研究生录取通知书', tier: 'legendary' },
      
      // 史诗卡 (epic)
      { name: '清华北大研究生录取通知书', tier: 'epic' },
      
      // 稀有卡 (rare)
      { name: '985录取通知书', tier: 'rare' },
      { name: '211录取通知书', tier: 'rare' },
      
      // 普通卡 (common) - 保持原有
      { name: '一战成硕卡', tier: 'common' },
      { name: '上岸卡', tier: 'common' },
      { name: '加分卡', tier: 'common' },
      { name: '锦鲤卡', tier: 'common' },
      { name: '好运卡', tier: 'common' },
      { name: '抽卡', tier: 'common' }
    ];

    for (const update of tierUpdates) {
      const [result] = await pool.query(
        'UPDATE cards SET tier = ? WHERE name = ? AND is_reward = true',
        [update.tier, update.name]
      );
      console.log(`更新 ${update.name}: tier=${update.tier}, 影响行数: ${result.affectedRows}`);
    }

    // 验证更新结果
    const [cards] = await pool.query(`
      SELECT name, tier, is_reward 
      FROM cards 
      WHERE is_reward = true AND is_active = true
      ORDER BY FIELD(tier, 'legendary', 'epic', 'rare', 'common'), name
    `);

    console.log('\n更新后的卡牌层级:');
    cards.forEach(card => {
      console.log(`  ${card.name}: ${card.tier}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('更新失败:', error);
    process.exit(1);
  }
}

fixCardTiers();
