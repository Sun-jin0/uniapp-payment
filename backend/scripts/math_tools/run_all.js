/**
 * 数学题目处理工具 - 批量执行脚本
 * 执行顺序：先修复内容格式，再更新题型
 *
 * 使用方法：node run_all.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('='.repeat(70));
console.log('数学题目处理工具 - 批量执行');
console.log('='.repeat(70));
console.log();

const scripts = [
  {
    name: '修复数学内容格式',
    file: '01_fix_math_content.js',
    desc: '修复 $$、HTML标签、LaTeX格式等问题'
  },
  {
    name: '更新题目题型',
    file: '02_update_question_types.js',
    desc: '根据内容自动判断并更新题型（选择题/填空题/解答题）'
  }
];

async function runScripts() {
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    const scriptPath = path.join(__dirname, script.file);

    console.log(`\n[${i + 1}/${scripts.length}] ${script.name}`);
    console.log('-'.repeat(70));
    console.log(`描述: ${script.desc}`);
    console.log(`文件: ${script.file}`);
    console.log();

    try {
      execSync(`node "${scriptPath}"`, {
        stdio: 'inherit',
        cwd: __dirname
      });
      console.log(`\n✓ ${script.name} 执行成功`);
    } catch (error) {
      console.error(`\n✗ ${script.name} 执行失败`);
      console.error(`  错误: ${error.message}`);
      process.exit(1);
    }
  }

  console.log();
  console.log('='.repeat(70));
  console.log('所有脚本执行完成！');
  console.log('='.repeat(70));
}

runScripts();
