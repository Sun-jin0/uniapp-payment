const pool = require('../config/mysql');

// 使用占位图片链接，后续可以替换为实际上传的图片
// 这里使用 picsum 或其他图床服务作为示例
const cardImages = {
  '一战成硕卡': 'https://picsum.photos/seed/yizhanchengsuo/400/600',
  '上岸卡': 'https://picsum.photos/seed/shangan/400/600',
  '加分卡': 'https://picsum.photos/seed/jiafen/400/600',
  '录取通知书': 'https://picsum.photos/seed/luqu/400/600',
  '抽卡': 'https://picsum.photos/seed/chouka/400/600',
  '逢考必过': 'https://picsum.photos/seed/fengkao/400/600'
};

async function updateCardImages() {
  try {
    console.log('开始更新卡片图片URL...\n');

    for (const [name, imageUrl] of Object.entries(cardImages)) {
      const [result] = await pool.query(
        'UPDATE cards SET image_url = ? WHERE name = ?',
        [imageUrl, name]
      );
      
      if (result.affectedRows > 0) {
        console.log(`✓ 更新 ${name}: ${imageUrl}`);
      } else {
        console.log(`✗ 未找到 ${name}`);
      }
    }

    console.log('\n✓ 卡片图片URL更新完成！');
    console.log('\n注意：当前使用的是示例图片链接。');
    console.log('如需使用实际卡片图片，请：');
    console.log('1. 将图片上传到图床或服务器');
    console.log('2. 修改此脚本中的图片URL');
    console.log('3. 重新运行此脚本');
    
    process.exit(0);
  } catch (error) {
    console.error('更新卡片图片失败:', error);
    process.exit(1);
  }
}

updateCardImages();
