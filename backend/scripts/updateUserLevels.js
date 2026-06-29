const pool = require('../config/mysql');

// 计算用户等级：10级以前每20个题加一个等级，超过10级每50个题加一个等级
const calcLevel = (questions) => {
  if (questions < 200) {
    return Math.floor(questions / 20) + 1;
  } else {
    return 10 + Math.floor((questions - 200) / 50);
  }
};

async function updateUserLevels() {
  try {
    // 获取所有用户
    const [users] = await pool.query('SELECT id, total_questions FROM users');
    console.log(`共找到 ${users.length} 个用户`);

    let updatedCount = 0;
    for (const user of users) {
      const newLevel = calcLevel(user.total_questions || 0);
      
      // 更新用户等级
      await pool.query('UPDATE users SET level = ? WHERE id = ?', [newLevel, user.id]);
      
      if (newLevel !== 1) {
        console.log(`用户 ${user.id}: 答题数=${user.total_questions}, 等级=${newLevel}`);
      }
      updatedCount++;
    }

    console.log(`\n成功更新 ${updatedCount} 个用户的等级`);
    process.exit(0);
  } catch (error) {
    console.error('更新用户等级失败:', error);
    process.exit(1);
  }
}

updateUserLevels();
