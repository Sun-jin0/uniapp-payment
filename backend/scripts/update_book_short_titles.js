const pool = require('../config/mysql');

async function updateBookShortTitles() {
  try {
    // 获取所有书籍
    const [books] = await pool.query('SELECT BookID, BookTitle, ShortTitle FROM math_books');
    
    let updatedCount = 0;
    
    for (const book of books) {
      let shortTitle = book.ShortTitle;
      
      // 如果已经有符合格式的简称，跳过
      if (shortTitle && shortTitle.match(/^\d{4}\s*·\s*/)) {
        continue;
      }
      
      // 从书名中提取年份
      const yearMatch = book.BookTitle.match(/(20\d{2})/);
      const year = yearMatch ? yearMatch[1] : '2026';
      
      // 提取简称：去掉年份、书名号、"考研数学"等通用前缀
      let name = book.BookTitle
        .replace(/[《》]/g, '')           // 去掉书名号
        .replace(/20\d{2}/g, '')          // 去掉年份
        .replace(/考研数学/g, '')          // 去掉"考研数学"
        .replace(/数学[一二三]/g, '')      // 去掉"数学一/二/三"
        .replace(/\s+/g, ' ')             // 合并多个空格
        .trim();
      
      // 进一步简化常见书名
      const commonPatterns = [
        { pattern: /张宇.*8套卷?|张宇.*八套卷?/i, short: '张宇八套' },
        { pattern: /张宇.*4套卷?|张宇.*四套卷?/i, short: '张宇四套' },
        { pattern: /李永乐.*6套卷?|李永乐.*六套卷?/i, short: '李永乐六套' },
        { pattern: /李永乐.*3套卷?|李永乐.*三套卷?/i, short: '李永乐三套' },
        { pattern: /李林.*6套卷?|李林.*六套卷?/i, short: '李林六套' },
        { pattern: /李林.*4套卷?|李林.*四套卷?/i, short: '李林四套' },
        { pattern: /合工大.*超越/i, short: '合工大超越' },
        { pattern: /合工大.*共创/i, short: '合工大共创' },
        { pattern: /真题|历年真题/i, short: '真题' },
        { pattern: /660题?/i, short: '660题' },
        { pattern: /880题?/i, short: '880题' },
        { pattern: /1000题?/i, short: '1000题' },
        { pattern: /1800题?/i, short: '1800题' },
        { pattern: /330题?/i, short: '330题' },
        { pattern: /模拟卷|模拟试卷/i, short: '模拟卷' },
        { pattern: /冲刺卷|冲刺试卷/i, short: '冲刺卷' },
        { pattern: /预测卷|预测试卷/i, short: '预测卷' },
        { pattern: /终极预测/i, short: '终极预测' },
      ];
      
      let matched = false;
      for (const p of commonPatterns) {
        if (p.pattern.test(book.BookTitle)) {
          name = p.short;
          matched = true;
          break;
        }
      }
      
      // 如果名字太长，截取前10个字符
      if (name.length > 10 && !matched) {
        name = name.substring(0, 10) + '...';
      }
      
      // 组合成 "年份 · 简称" 格式
      shortTitle = `${year} · ${name}`;
      
      await pool.query(
        'UPDATE math_books SET ShortTitle = ? WHERE BookID = ?',
        [shortTitle, book.BookID]
      );
      
      updatedCount++;
      console.log(`✓ [${book.BookID}] ${book.BookTitle} -> ${shortTitle}`);
    }
    
    console.log(`\n✓ 已更新 ${updatedCount} 本书籍的简称`);
    console.log('完成！');
    process.exit(0);
  } catch (error) {
    console.error('更新简称失败:', error);
    process.exit(1);
  }
}

updateBookShortTitles();
