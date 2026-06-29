const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// OSS配置 - 从环境变量读取阿里云OSS配置
// 原hi168配置（已注释，如需切换回来可取消注释）:
// const OSS_CONFIG = {
//   accessKeyId: 'F6IY1QRB154UPZTB9U86',
//   secretAccessKey: 'bZtqIRubTHshz9PLMBJemQZyfgsCL5iBprb6AkhB',
//   endpoint: 'https://s3.hi168.com',
//   bucket: 'hi168-26998-7111ilq6',
//   region: 'us-west-1',
//   customDomain: 's3.hi168.com/hi168-26998-7111ilq6'
// };

// 当前阿里云OSS配置（必须从环境变量读取，禁止硬编码密钥）
const OSS_CONFIG = {
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  secretAccessKey: process.env.OSS_ACCESS_KEY_SECRET,
  endpoint: `https://${process.env.OSS_ENDPOINT || 'oss-cn-beijing.aliyuncs.com'}`,
  bucket: process.env.OSS_BUCKET,
  region: process.env.OSS_REGION || 'oss-cn-beijing',
  customDomain: process.env.OSS_CUSTOM_DOMAIN
};

// 创建S3客户端 - 阿里云OSS必须使用virtual-hosted style
const s3Client = new S3Client({
  credentials: {
    accessKeyId: OSS_CONFIG.accessKeyId,
    secretAccessKey: OSS_CONFIG.secretAccessKey
  },
  endpoint: OSS_CONFIG.endpoint,
  region: OSS_CONFIG.region,
  forcePathStyle: false  // 阿里云OSS不支持path-style，必须使用virtual-hosted style
});

/**
 * 获取文件的Content-Type
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.pdf': 'application/pdf'
  };
  return contentTypeMap[ext] || 'application/octet-stream';
}

/**
 * 上传文件到OSS
 * @param {string} localFilePath - 本地文件路径
 * @param {string} objectName - 对象名称（可选）
 * @returns {Promise<string>} - 返回文件URL
 */
async function uploadToOSS(localFilePath, objectName = null) {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`文件不存在: ${localFilePath}`);
    }

    // 生成对象名称
    if (!objectName) {
      const ext = path.extname(localFilePath);
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      objectName = `uploads/${timestamp}-${random}${ext}`;
    }

    // 读取文件
    const fileContent = fs.readFileSync(localFilePath);
    const contentType = getContentType(localFilePath);

    // 上传参数 - 添加Content-Disposition为inline以支持预览
    const params = {
      Bucket: OSS_CONFIG.bucket,
      Key: objectName,
      Body: fileContent,
      ContentType: contentType,
      ContentDisposition: 'inline'  // 强制预览，不下载
    };

    // 执行上传
    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // 生成访问URL - 使用自定义域名
    const fileUrl = `https://${OSS_CONFIG.customDomain}/${objectName}`;
    console.log('✅ 文件上传成功:', fileUrl);
    
    return fileUrl;
  } catch (error) {
    console.error('❌ 上传失败:', error);
    throw error;
  }
}

/**
 * 上传Buffer到OSS
 * @param {Buffer} buffer - 文件Buffer
 * @param {string} objectName - 对象名称
 * @param {string} contentType - 内容类型
 * @returns {Promise<string>} - 返回文件URL
 */
async function uploadBufferToOSS(buffer, objectName, contentType = 'application/octet-stream') {
  try {
    const params = {
      Bucket: OSS_CONFIG.bucket,
      Key: objectName,
      Body: buffer,
      ContentType: contentType,
      ContentDisposition: 'inline'  // 强制预览，不下载
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const fileUrl = `https://${OSS_CONFIG.customDomain}/${objectName}`;
    console.log('✅ Buffer上传成功:', fileUrl);
    
    return fileUrl;
  } catch (error) {
    console.error('❌ Buffer上传失败:', error);
    throw error;
  }
}

module.exports = {
  uploadToOSS,
  uploadBufferToOSS
};
