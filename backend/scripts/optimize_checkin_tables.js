const pool = require('../config/mysql');

async function optimizeCheckinTables() {
  try {
    console.log('开始优化打卡系统数据表...\n');

    await pool.query('DROP TABLE IF EXISTS user_checkin_stats');
    console.log('✓ 删除 user_checkin_stats 表');

    await pool.query('DROP TABLE IF EXISTS checkin_category_stats');
    console.log('✓ 删除 checkin_category_stats 表');

    console.log('\n优化完成！现在只有5个表：');
    console.log('1. checkin_categories - 打卡类别表');
    console.log('2. checkin_tasks - 打卡任务表');
    console.log('3. checkin_records_new - 打卡记录表');
    console.log('4. checkin_comments - 打卡评论表');
    console.log('5. checkin_likes - 打卡点赞表');
    
    process.exit(0);
  } catch (error) {
    console.error('优化失败:', error);
    process.exit(1);
  }
}

optimizeCheckinTables();
