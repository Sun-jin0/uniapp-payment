const pool = require('../config/mysql');
const path = require('path');

// 卡片数据 - 对应抽卡素材
const cardsData = [
  {
    name: '一战成硕卡',
    description: '祝你一战成硕，金榜题名！',
    image_url: '/static/cards/一战成硕卡.jpg',
    rarity: 'legendary',
    probability: 0.05,
    sort_order: 1
  },
  {
    name: '上岸卡',
    description: '成功上岸，前程似锦！',
    image_url: '/static/cards/上岸卡.jpg',
    rarity: 'epic',
    probability: 0.15,
    sort_order: 2
  },
  {
    name: '加分卡',
    description: '考试加分，超常发挥！',
    image_url: '/static/cards/加分卡.jpg',
    rarity: 'rare',
    probability: 0.30,
    sort_order: 3
  },
  {
    name: '录取通知书',
    description: '录取通知书已送达，请查收！',
    image_url: '/static/cards/录取通知书.jpg',
    rarity: 'epic',
    probability: 0.15,
    sort_order: 4
  },
  {
    name: '抽卡',
    description: '今日运势不错，来抽张卡吧！',
    image_url: '/static/cards/抽卡.jpg',
    rarity: 'common',
    probability: 0.25,
    sort_order: 5
  },
  {
    name: '逢考必过',
    description: '祝你逢考必过，万事如意！',
    image_url: '/static/cards/逢考必过.jpg',
    rarity: 'common',
    probability: 0.10,
    sort_order: 6
  }
];

async function initCardsData() {
  try {
    // 检查是否已有数据
    const [existing] = await pool.query('SELECT COUNT(*) as count FROM cards');
    if (existing[0].count > 0) {
      console.log('卡片数据已存在，跳过初始化');
      process.exit(0);
    }

    console.log('开始初始化卡片数据...\n');

    for (const card of cardsData) {
      await pool.query(
        `INSERT INTO cards (name, description, image_url, rarity, probability, sort_order, is_active, draw_count, owner_count) 
         VALUES (?, ?, ?, ?, ?, ?, TRUE, 0, 0)`,
        [card.name, card.description, card.image_url, card.rarity, card.probability, card.sort_order]
      );
      console.log(`✓ 添加卡片: ${card.name} (${card.rarity})`);
    }

    console.log('\n✓ 卡片数据初始化完成！');
    console.log(`共添加 ${cardsData.length} 张卡片`);
    process.exit(0);
  } catch (error) {
    console.error('初始化卡片数据失败:', error);
    process.exit(1);
  }
}

initCardsData();
