const pool = require('../config/mysql');

async function fixCardProbability() {
  try {
    console.log('修复卡牌概率 - 每张卡牌概率等于层级概率...\n');
    
    // 设置每个层级的概率（每张卡牌都是这个概率）
    const tierProbabilities = {
      'legendary': 0.005,  // 0.5%
      'epic': 0.02,        // 2%
      'rare': 0.08,        // 8%
      'common': 0.25,      // 25%
      'consolation': 0.645 // 64.5%
    };
    
    // 更新每张卡牌的概率 = 所在层级的概率
    for (const [tier, prob] of Object.entries(tierProbabilities)) {
      const [result] = await pool.query(
        'UPDATE cards SET probability = ? WHERE tier = ?',
        [prob, tier]
      );
      
      if (result.affectedRows > 0) {
        console.log(`✓ ${tier}: 每张卡牌概率 ${(prob * 100).toFixed(2)}% (${result.affectedRows}张)`);
      }
    }
    
    // 验证更新
    const [cards] = await pool.query(`
      SELECT tier, name, probability 
      FROM cards 
      WHERE is_active = true 
      ORDER BY tier, id
    `);
    
    console.log('\n更新后卡牌概率示例:');
    const tierSamples = {};
    cards.forEach(card => {
      if (!tierSamples[card.tier]) {
        tierSamples[card.tier] = card;
      }
    });
    
    for (const [tier, card] of Object.entries(tierSamples)) {
      console.log(`  ${tier}: ${card.name} = ${(card.probability * 100).toFixed(2)}%`);
    }
    
    // 计算总概率
    const [tierSums] = await pool.query(`
      SELECT tier, COUNT(*) as count, SUM(probability) as total_prob
      FROM cards 
      WHERE is_active = true 
      GROUP BY tier
    `);
    
    console.log('\n各层级总概率:');
    let grandTotal = 0;
    tierSums.forEach(row => {
      console.log(`  ${row.tier}: ${row.count}张 × ${(row.total_prob / row.count * 100).toFixed(2)}% = ${(row.total_prob * 100).toFixed(2)}%`);
      grandTotal += parseFloat(row.total_prob);
    });
    console.log(`\n总概率: ${(grandTotal * 100).toFixed(2)}%`);
    
    process.exit(0);
  } catch (error) {
    console.error('修复失败:', error);
    process.exit(1);
  }
}

fixCardProbability();
