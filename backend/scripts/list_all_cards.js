const pool = require('../config/mysql');

async function listAllCards() {
  try {
    const [cards] = await pool.query(`
      SELECT id, name, tier, is_reward, probability 
      FROM cards 
      WHERE is_active = true 
      ORDER BY tier, id
    `);
    
    console.log('所有卡牌列表:\n');
    
    const tierGroups = {};
    cards.forEach(card => {
      if (!tierGroups[card.tier]) {
        tierGroups[card.tier] = [];
      }
      tierGroups[card.tier].push(card);
    });
    
    for (const [tier, tierCards] of Object.entries(tierGroups)) {
      console.log(`\n=== ${tier.toUpperCase()} (${tierCards.length}张) ===`);
      tierCards.forEach(card => {
        const rewardMark = card.is_reward ? '【奖】' : '【慰】';
        console.log(`  ${rewardMark} ${card.name}: ${(card.probability * 100).toFixed(4)}%`);
      });
    }
    
    console.log('\n\n总计:', cards.length, '张卡牌');
    
    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

listAllCards();
