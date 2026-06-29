const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'quizmaster'
};

async function addPrintFields() {
  const connection = await mysql.createConnection(config);
  
  try {
    console.log('检查并添加打印相关字段...');
    
    // 检查 print_used_today 字段
    try {
      await connection.execute(`ALTER TABLE users ADD COLUMN print_used_today INT DEFAULT 0`);
      console.log('✓ 添加 print_used_today 字段成功');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('✓ print_used_today 字段已存在');
      } else {
        console.error('添加 print_used_today 字段失败:', e.message);
      }
    }
    
    // 检查 print_limit_daily 字段
    try {
      await connection.execute(`ALTER TABLE users ADD COLUMN print_limit_daily INT DEFAULT 1`);
      console.log('✓ 添加 print_limit_daily 字段成功');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('✓ print_limit_daily 字段已存在');
      } else {
        console.error('添加 print_limit_daily 字段失败:', e.message);
      }
    }
    
    // 检查 print_last_date 字段
    try {
      await connection.execute(`ALTER TABLE users ADD COLUMN print_last_date DATE`);
      console.log('✓ 添加 print_last_date 字段成功');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('✓ print_last_date 字段已存在');
      } else {
        console.error('添加 print_last_date 字段失败:', e.message);
      }
    }
    
    // 检查 print_analysis_limit 字段
    try {
      await connection.execute(`ALTER TABLE users ADD COLUMN print_analysis_limit INT DEFAULT 1`);
      console.log('✓ 添加 print_analysis_limit 字段成功');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('✓ print_analysis_limit 字段已存在');
      } else {
        console.error('添加 print_analysis_limit 字段失败:', e.message);
      }
    }
    
    // 检查 print_analysis_used 字段
    try {
      await connection.execute(`ALTER TABLE users ADD COLUMN print_analysis_used INT DEFAULT 0`);
      console.log('✓ 添加 print_analysis_used 字段成功');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('✓ print_analysis_used 字段已存在');
      } else {
        console.error('添加 print_analysis_used 字段失败:', e.message);
      }
    }
    
    console.log('\n所有字段检查完成！');
    
  } catch (error) {
    console.error('执行失败:', error);
  } finally {
    await connection.end();
  }
}

addPrintFields();
