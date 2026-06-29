const pool = require('../config/mysql');

async function addShortTitleColumn() {
  try {
    // 检查字段是否已存在
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'math_books' AND COLUMN_NAME = 'ShortTitle'
    `);

    if (columns.length === 0) {
      // 添加简称字段
      await pool.query(`
        ALTER TABLE math_books 
        ADD COLUMN ShortTitle VARCHAR(100) DEFAULT NULL COMMENT '书籍简称，用于题目来源显示'
      `);
      console.log('✓ math_books 表 ShortTitle 字段添加成功');
    } else {
      console.log('✓ ShortTitle 字段已存在');
    }

    // 从 BookTitle 自动生成一些简称示例（前20个字）
    const [books] = await pool.query(`
      SELECT BookID, BookTitle FROM math_books WHERE ShortTitle IS NULL OR ShortTitle = ''
    `);

    for (const book of books) {
      // 生成简称：取前15个字符，如果有书名号则去掉
      let short = book.BookTitle
        .replace(/[《》]/g, '')
        .substring(0, 15);
      if (book.BookTitle.length > 15) short += '...';
      
      await pool.query(`
        UPDATE math_books SET ShortTitle = ? WHERE BookID = ?
      `, [short, book.BookID]);
    }

    console.log(`✓ 已为 ${books.length} 本书籍生成默认简称`);
    console.log('\n完成！');
    process.exit(0);
  } catch (error) {
    console.error('添加字段失败:', error);
    process.exit(1);
  }
}

addShortTitleColumn();
