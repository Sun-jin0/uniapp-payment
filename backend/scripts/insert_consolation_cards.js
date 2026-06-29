const pool = require('../config/mysql');
const fs = require('fs');
const path = require('path');

async function insertConsolationCards() {
  try {
    // 读取JSON配置文件
    const jsonPath = path.join(__dirname, 'consolation_cards.json');
    const cards = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    console.log(`准备插入 ${cards.length} 张安慰奖卡牌...\n`);

    // 先清空现有的安慰奖卡牌
    await pool.query("DELETE FROM cards WHERE tier = 'consolation'");
    console.log('✓ 清空现有安慰奖卡牌');

    // 插入新卡牌
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      await pool.query(
        `INSERT INTO cards (name, description, image_url, rarity, tier, probability, is_reward, is_active, sort_order) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [card.name, card.description, card.image_url, card.rarity, card.tier, card.probability, card.is_reward, card.is_active, i]
      );
      console.log(`✓ 插入卡牌: ${card.name}`);
    }

    console.log(`\n✓ 成功插入 ${cards.length} 张安慰奖卡牌！`);
    
    // 显示统计
    const [stats] = await pool.query(`
      SELECT tier, COUNT(*) as count 
      FROM cards 
      WHERE is_active = true 
      GROUP BY tier
    `);
    
    console.log('\n当前卡牌统计:');
    stats.forEach(row => {
      console.log(`  ${row.tier}: ${row.count} 张`);
    });

    process.exit(0);
  } catch (error) {
    console.error('插入失败:', error);
    process.exit(1);
  }
}

insertConsolationCards();
