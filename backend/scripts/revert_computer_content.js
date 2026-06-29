const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '139.199.9.132',
  user: 'root',
  password: '4212b46b7c02ee61',
  database: 'quizmaster'
});

async function revertComputerContent() {
  console.log('开始恢复计算机题目内容...\n');
  
  const tables = [
    {
      name: 'computer1_question',
      columns: ['stem', 'answer', 'analysis']
    },
    {
      name: 'computer1_question_option',
      columns: ['option_value']
    },
    {
      name: 'computer1_question_sub',
      columns: ['stem', 'answer', 'analysis']
    }
  ];
  
  const replacements = [
    { from: '$ $', to: '$$', desc: '"$ $" 改回 "$$"' },
    { from: '< ', to: '<', desc: '"< " 改回 "<"' }
  ];
  
  try {
    let totalUpdated = 0;
    
    for (const table of tables) {
      console.log(`\n处理表: ${table.name}`);
      console.log('='.repeat(50));
      
      try {
        const [tableCheck] = await pool.query(`
          SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        `, [table.name]);
        
        if (tableCheck.length === 0) {
          console.log(`表 ${table.name} 不存在，跳过`);
          continue;
        }
      } catch (err) {
        console.log(`检查表 ${table.name} 失败: ${err.message}`);
        continue;
      }
      
      const [existingColumns] = await pool.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      `, [table.name]);
      
      const columnSet = new Set(existingColumns.map(col => col.COLUMN_NAME));
      
      for (const column of table.columns) {
        if (!columnSet.has(column)) {
          console.log(`  列 ${column} 不存在，跳过`);
          continue;
        }
        
        console.log(`\n处理列: ${column}`);
        
        for (const rule of replacements) {
          try {
            const [countResult] = await pool.query(`
              SELECT COUNT(*) as count FROM ${table.name} 
              WHERE ${column} LIKE ?
            `, [`%${rule.from}%`]);
            
            if (countResult[0].count > 0) {
              const [result] = await pool.query(`
                UPDATE ${table.name} 
                SET ${column} = REPLACE(${column}, ?, ?)
                WHERE ${column} LIKE ?
              `, [rule.from, rule.to, `%${rule.from}%`]);
              
              console.log(`  ${rule.desc}: 更新了 ${result.affectedRows} 条记录`);
              totalUpdated += result.affectedRows;
            } else {
              console.log(`  ${rule.desc}: 无需更新`);
            }
          } catch (err) {
            console.log(`  ${rule.desc}: 更新失败 - ${err.message}`);
          }
        }
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`\n完成！总共更新了 ${totalUpdated} 条记录`);
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('恢复失败:', error);
    await pool.end();
    process.exit(1);
  }
}

revertComputerContent();
