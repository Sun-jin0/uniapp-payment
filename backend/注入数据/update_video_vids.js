const mysql = require('mysql2/promise');
const crypto = require('crypto');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'quizmaster'
};

// 生成加密 vid
const generateEncryptedVid = () => {
  // 生成随机 16 字节 IV
  const iv = crypto.randomBytes(16);
  // 生成随机 32 字节密钥
  const key = crypto.randomBytes(32);
  // 使用当前时间戳 + 随机数作为明文
  const plaintext = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  
  // AES-256-GCM 加密
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  // 组合：authTag(32字符) + iv(32字符) + encrypted(变长)
  const combined = Buffer.from(authTag.toString('hex') + iv.toString('hex') + encrypted, 'hex');
  return combined.toString('base64url').substring(0, 32);
};

async function updateVideoVids() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('开始更新视频 vid...\n');

    // 获取所有视频
    const [videos] = await connection.execute('SELECT id, vid, title FROM video_resources');
    console.log(`找到 ${videos.length} 个视频需要更新\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const video of videos) {
      const currentVid = video.vid;
      
      // 检查当前 vid 是否已经是新的加密格式（长度大于 20 且是 base64url 格式）
      const isNewEncryptedFormat = currentVid && currentVid.length === 32 && /^[A-Za-z0-9_-]{32}$/.test(currentVid);
      
      if (isNewEncryptedFormat) {
        console.log(`跳过已加密的视频: ${video.title} (vid: ${currentVid.substring(0, 20)}...)`);
        skippedCount++;
        continue;
      }

      // 生成新的加密 vid
      const newVid = generateEncryptedVid();
      
      try {
        await connection.execute(
          'UPDATE video_resources SET vid = ? WHERE id = ?',
          [newVid, video.id]
        );
        console.log(`✓ 更新视频: ${video.title}`);
        console.log(`  旧 vid: ${currentVid}`);
        console.log(`  新 vid: ${newVid}`);
        updatedCount++;
      } catch (err) {
        console.error(`✗ 更新失败: ${video.title}`, err.message);
      }
    }

    console.log(`\n========================================`);
    console.log(`更新完成！`);
    console.log(`已更新: ${updatedCount} 个视频`);
    console.log(`已跳过 (已加密): ${skippedCount} 个视频`);
    console.log(`========================================`);

  } catch (error) {
    console.error('操作失败:', error.message);
  } finally {
    await connection.end();
  }
}

updateVideoVids();
