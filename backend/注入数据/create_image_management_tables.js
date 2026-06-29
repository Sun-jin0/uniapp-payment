const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'quizmaster',
  multipleStatements: true
};

async function createImageManagementTables() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('开始创建图片管理数据表...\n');
    
    // 禁用外键检查
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    // 1. 创建图片管理表
    console.log('创建 image_management 表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`image_management\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
        \`image_name\` VARCHAR(255) NOT NULL COMMENT '图片原始文件名',
        \`image_type\` VARCHAR(50) NOT NULL COMMENT '图片类型 (jpg/png/gif等)',
        \`image_size\` INT UNSIGNED NOT NULL COMMENT '图片大小(字节)',
        \`image_hash\` VARCHAR(64) NOT NULL COMMENT '图片MD5哈希值，用于去重',
        
        -- OSS图床信息
        \`oss_url\` VARCHAR(500) DEFAULT NULL COMMENT 'OSS图床URL',
        \`oss_bucket\` VARCHAR(100) DEFAULT NULL COMMENT 'OSS存储桶名称',
        \`oss_object_key\` VARCHAR(500) DEFAULT NULL COMMENT 'OSS对象键',
        \`oss_upload_time\` DATETIME DEFAULT NULL COMMENT 'OSS上传时间',
        \`oss_status\` TINYINT DEFAULT 1 COMMENT 'OSS状态: 0-失败, 1-成功, 2-已删除',
        
        -- ImgBB图床信息
        \`imgbb_url\` VARCHAR(500) DEFAULT NULL COMMENT 'ImgBB图床URL',
        \`imgbb_delete_url\` VARCHAR(500) DEFAULT NULL COMMENT 'ImgBB删除URL',
        \`imgbb_id\` VARCHAR(100) DEFAULT NULL COMMENT 'ImgBB图片ID',
        \`imgbb_upload_time\` DATETIME DEFAULT NULL COMMENT 'ImgBB上传时间',
        \`imgbb_status\` TINYINT DEFAULT 1 COMMENT 'ImgBB状态: 0-失败, 1-成功, 2-已删除',
        
        -- 关联信息
        \`source_type\` VARCHAR(50) DEFAULT NULL COMMENT '图片来源类型: avatar-头像, exam-考试, content-内容, other-其他',
        \`source_id\` BIGINT UNSIGNED DEFAULT NULL COMMENT '关联的源ID',
        \`user_id\` BIGINT UNSIGNED DEFAULT NULL COMMENT '上传用户ID',
        
        -- 统计信息
        \`view_count\` INT UNSIGNED DEFAULT 0 COMMENT '查看次数',
        \`last_view_time\` DATETIME DEFAULT NULL COMMENT '最后查看时间',
        
        -- 状态管理
        \`is_primary\` TINYINT DEFAULT 0 COMMENT '是否主图: 0-否, 1-是',
        \`status\` TINYINT DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用, 2-已删除',
        \`remark\` VARCHAR(500) DEFAULT NULL COMMENT '备注',
        
        -- 时间戳
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        
        PRIMARY KEY (\`id\`),
        KEY \`idx_image_hash\` (\`image_hash\`),
        KEY \`idx_oss_status\` (\`oss_status\`),
        KEY \`idx_imgbb_status\` (\`imgbb_status\`),
        KEY \`idx_source\` (\`source_type\`, \`source_id\`),
        KEY \`idx_user_id\` (\`user_id\`),
        KEY \`idx_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片管理表'
    `);
    console.log('✓ image_management 表创建成功');
    
    // 2. 创建图片使用记录表
    console.log('创建 image_usage_log 表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`image_usage_log\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
        \`image_id\` BIGINT UNSIGNED NOT NULL COMMENT '图片ID',
        \`usage_type\` VARCHAR(50) NOT NULL COMMENT '使用类型: exam_answer-考试答案, user_avatar-用户头像, article_content-文章内容等',
        \`usage_id\` BIGINT UNSIGNED NOT NULL COMMENT '使用的对象ID',
        \`usage_url\` VARCHAR(500) DEFAULT NULL COMMENT '使用的页面URL',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        
        PRIMARY KEY (\`id\`),
        KEY \`idx_image_id\` (\`image_id\`),
        KEY \`idx_usage\` (\`usage_type\`, \`usage_id\`),
        KEY \`idx_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片使用记录表'
    `);
    console.log('✓ image_usage_log 表创建成功');
    
    // 3. 创建图床统计表
    console.log('创建 image_storage_stats 表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`image_storage_stats\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
        \`stats_date\` DATE NOT NULL COMMENT '统计日期',
        \`total_uploads\` INT UNSIGNED DEFAULT 0 COMMENT '总上传数',
        \`oss_success\` INT UNSIGNED DEFAULT 0 COMMENT 'OSS成功数',
        \`oss_failed\` INT UNSIGNED DEFAULT 0 COMMENT 'OSS失败数',
        \`imgbb_success\` INT UNSIGNED DEFAULT 0 COMMENT 'ImgBB成功数',
        \`imgbb_failed\` INT UNSIGNED DEFAULT 0 COMMENT 'ImgBB失败数',
        \`total_size\` BIGINT UNSIGNED DEFAULT 0 COMMENT '总大小(字节)',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_stats_date\` (\`stats_date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图床统计表'
    `);
    console.log('✓ image_storage_stats 表创建成功');
    
    // 启用外键检查
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('\n========================================');
    console.log('图片管理数据表创建完成！');
    console.log('========================================');
    console.log('已创建以下表：');
    console.log('1. image_management - 图片管理主表');
    console.log('2. image_usage_log - 图片使用记录表');
    console.log('3. image_storage_stats - 图床统计表');
    console.log('========================================');
    
  } catch (error) {
    console.error('创建数据表失败:', error.message);
    console.error(error.stack);
  } finally {
    await connection.end();
  }
}

createImageManagementTables();
