const mysqlPool = require('../config/mysql');

async function alterTable() {
  try {
    console.log('修改 computer1_question 表结构，允许 major_id, chapter_id, exam_group_id 为空...\n');
    
    // 修改 major_id 允许为空
    await mysqlPool.query(`
      ALTER TABLE computer1_question 
      MODIFY COLUMN major_id VARCHAR(50) NULL COMMENT '科目ID'
    `);
    console.log('✅ major_id 已修改为可为空');
    
    // 修改 chapter_id 允许为空
    await mysqlPool.query(`
      ALTER TABLE computer1_question 
      MODIFY COLUMN chapter_id VARCHAR(50) NULL COMMENT '章节ID'
    `);
    console.log('✅ chapter_id 已修改为可为空');
    
    // 修改 exam_group_id 允许为空
    await mysqlPool.query(`
      ALTER TABLE computer1_question 
      MODIFY COLUMN exam_group_id VARCHAR(50) NULL COMMENT '考点组ID'
    `);
    console.log('✅ exam_group_id 已修改为可为空');
    
    console.log('\n修改完成！');
  } catch (err) {
    console.error('修改失败:', err);
  } finally {
    process.exit(0);
  }
}

alterTable();
