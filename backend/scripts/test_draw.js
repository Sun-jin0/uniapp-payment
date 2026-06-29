const pool = require('../config/mysql');

async function test() {
  const [cards] = await pool.query('SELECT id, name, tier, is_reward FROM cards WHERE is_active = 1 AND is_reward = 1');
  console.log('奖励卡牌:');
  cards.forEach(c => {
    console.log(`  ID=${c.id}, Name=${c.name}, Tier=${c.tier}, is_reward=${c.is_reward}`);
  });
  process.exit(0);
}

test();
