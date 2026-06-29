const pool = require('../config/mysql');

async function createCustomCheckinTable() {
  try {
    // 创建自定义打卡记录表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS custom_checkin_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        checkinType VARCHAR(50) NOT NULL COMMENT '打卡类型: study, custom',
        studyCount INT DEFAULT 0 COMMENT '刷题数量',
        content TEXT COMMENT '打卡文字内容',
        images JSON COMMENT '打卡图片数组',
        checkinDate DATE NOT NULL,
        checkinTime DATETIME DEFAULT CURRENT_TIMESTAMP,
        isShared BOOLEAN DEFAULT FALSE COMMENT '是否已分享',
        shareCount INT DEFAULT 0 COMMENT '被分享次数',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_userId (userId),
        INDEX idx_checkinDate (checkinDate),
        INDEX idx_checkinType (checkinType)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自定义打卡记录表'
    `);

    console.log('自定义打卡记录表创建成功');
  } catch (error) {
    console.error('创建表失败:', error);
  } finally {
    process.exit(0);
  }
}

createCustomCheckinTable();
