const pool = require('../config/mysql');

async function checkCardProbability() {
  try {
    // 获取所有卡牌
    const [cards] = await pool.query(`
      SELECT tier, COUNT(*) as count, SUM(probability) as total_probability
      FROM cards 
      WHERE is_active = true 
      GROUP BY tier
    `);
    
    console.log('当前卡牌概率分布:\n');
    let totalProb = 0;
    cards.forEach(row => {
      console.log(`${row.tier}: ${row.count} 张, 总概率: ${(row.total_probability * 100).toFixed(2)}%`);
      totalProb += parseFloat(row.total_probability);
    });
    
    console.log(`\n总概率: ${(totalProb * 100).toFixed(2)}%`);
    
    // 查看安慰奖卡牌的详细概率
    const [consolationCards] = await pool.query(`
      SELECT name, probability FROM cards WHERE tier = 'consolation' LIMIT 5
    `);
    
    console.log('\n安慰奖卡牌示例:');
    consolationCards.forEach(card => {
      console.log(`  ${card.name}: ${(card.probability * 100).toFixed(2)}%`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

checkCardProbability();
