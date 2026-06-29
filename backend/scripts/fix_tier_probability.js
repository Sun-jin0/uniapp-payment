const pool = require('../config/mysql');

async function fixTierProbability() {
  try {
    console.log('重新设置层级概率...\n');
    
    // 设置每个层级的总概率（不是每张卡的概率）
    // 传说: 0.5%, 史诗: 2%, 稀有: 8%, 普通: 25%, 安慰奖: 64.5%
    
    // 获取各层级的卡牌数量
    const [tierCounts] = await pool.query(`
      SELECT tier, COUNT(*) as count 
      FROM cards 
      WHERE is_active = true 
      GROUP BY tier
    `);
    
    console.log('各层级卡牌数量:');
    tierCounts.forEach(row => {
      console.log(`  ${row.tier}: ${row.count} 张`);
    });
    
    // 设置层级总概率
    const tierProbabilities = {
      'legendary': 0.005,  // 0.5%
      'epic': 0.02,        // 2%
      'rare': 0.08,        // 8%
      'common': 0.25,      // 25%
      'consolation': 0.645 // 64.5%
    };
    
    // 更新每张卡牌的概率 = 层级总概率 / 该层级卡牌数量
    for (const [tier, totalProb] of Object.entries(tierProbabilities)) {
      const tierInfo = tierCounts.find(t => t.tier === tier);
      if (tierInfo && tierInfo.count > 0) {
        const cardProb = totalProb / tierInfo.count;
        
        await pool.query(
          'UPDATE cards SET probability = ? WHERE tier = ?',
          [cardProb, tier]
        );
        
        console.log(`\n✓ ${tier}: 总概率 ${(totalProb * 100).toFixed(2)}%, 每张 ${(cardProb * 100).toFixed(4)}%`);
      }
    }
    
    // 验证更新
    const [result] = await pool.query(`
      SELECT tier, COUNT(*) as count, SUM(probability) as total_probability
      FROM cards 
      WHERE is_active = true 
      GROUP BY tier
      ORDER BY SUM(probability) DESC
    `);
    
    console.log('\n更新后概率分布:');
    let total = 0;
    result.forEach(row => {
      console.log(`${row.tier}: ${row.count} 张, 总概率: ${(row.total_probability * 100).toFixed(2)}%`);
      total += parseFloat(row.total_probability);
    });
    console.log(`总概率: ${(total * 100).toFixed(2)}%`);
    
    process.exit(0);
  } catch (error) {
    console.error('修复失败:', error);
    process.exit(1);
  }
}

fixTierProbability();
