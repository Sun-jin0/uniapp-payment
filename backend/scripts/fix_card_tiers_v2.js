const pool = require('../config/mysql');

async function fixCardTiers() {
  try {
    // 根据实际卡牌名称设置对应的 tier
    const tierUpdates = [
      // 传说卡 (legendary) - 最稀有
      { id: 4, tier: 'legendary' }, // 录取通知书
      
      // 史诗卡 (epic)
      // 如果没有专门的史诗卡，可以把某个设为 epic
      { id: 6, tier: 'epic' }, // 逢考必过
      
      // 稀有卡 (rare)
      { id: 1, tier: 'rare' }, // 一战成硕卡
      { id: 2, tier: 'rare' }, // 上岸卡
      
      // 普通卡 (common)
      { id: 3, tier: 'common' }, // 加分卡
      { id: 5, tier: 'common' }  // 抽卡
    ];

    for (const update of tierUpdates) {
      const [result] = await pool.query(
        'UPDATE cards SET tier = ? WHERE id = ? AND is_reward = true',
        [update.tier, update.id]
      );
      console.log(`更新 ID=${update.id}: tier=${update.tier}, 影响行数: ${result.affectedRows}`);
    }

    // 验证更新结果
    const [cards] = await pool.query(`
      SELECT id, name, tier, is_reward 
      FROM cards 
      WHERE is_reward = true AND is_active = true
      ORDER BY FIELD(tier, 'legendary', 'epic', 'rare', 'common'), id
    `);

    console.log('\n更新后的卡牌层级:');
    cards.forEach(card => {
      console.log(`  ${card.id}: ${card.name} (${card.tier})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('更新失败:', error);
    process.exit(1);
  }
}

fixCardTiers();
