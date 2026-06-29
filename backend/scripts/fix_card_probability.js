const pool = require('../config/mysql');

async function fixCardProbability() {
  try {
    console.log('修复卡牌概率分布...\n');
    
    // 查看 common 卡牌
    const [commonCards] = await pool.query(`
      SELECT id, name, probability FROM cards WHERE tier = 'common'
    `);
    
    console.log('Common 卡牌:');
    commonCards.forEach(card => {
      console.log(`  ${card.name}: ${(card.probability * 100).toFixed(2)}%`);
    });
    
    // 重新设置概率 - 让安慰奖成为主要结果
    // 安慰奖总概率应该是 70%，每张约 3.18%
    const consolationProb = 0.70 / 22; // 约 0.0318
    
    // Common 奖励卡牌总概率 25%，每张约 4.17%
    const commonProb = 0.25 / 6; // 约 0.0417
    
    // 更新安慰奖概率
    await pool.query(`
      UPDATE cards 
      SET probability = ? 
      WHERE tier = 'consolation'
    `, [consolationProb]);
    console.log(`\n✓ 更新安慰奖概率: ${(consolationProb * 100).toFixed(2)}% 每张`);
    
    // 更新 common 奖励概率
    await pool.query(`
      UPDATE cards 
      SET probability = ? 
      WHERE tier = 'common'
    `, [commonProb]);
    console.log(`✓ 更新普通奖励概率: ${(commonProb * 100).toFixed(2)}% 每张`);
    
    // 验证更新
    const [result] = await pool.query(`
      SELECT tier, COUNT(*) as count, SUM(probability) as total_probability
      FROM cards 
      WHERE is_active = true 
      GROUP BY tier
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

fixCardProbability();
