const crypto = require('crypto');

// 加密密钥，应该从环境变量获取
const SECRET_KEY = process.env.PRINT_CRYPTO_KEY || 'your-secret-key-for-print-encryption-32chars';
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

/**
 * 加密打印参数
 * @param {Object} data - 要加密的数据
 * @returns {string} - 加密后的字符串
 */
function encryptPrintParams(data) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY.slice(0, 32)), iv);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // 将 IV 和加密数据一起返回
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * 解密打印参数
 * @param {string} encryptedData - 加密后的字符串
 * @returns {Object|null} - 解密后的数据或null
 */
function decryptPrintParams(encryptedData) {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) return null;
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY.slice(0, 32)), iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('解密失败:', error);
    return null;
  }
}

/**
 * 生成打印令牌
 * @param {Object} data - 打印参数
 * @returns {string} - 打印令牌
 */
function generatePrintToken(data) {
  const timestamp = Date.now();
  const payload = {
    ...data,
    timestamp,
    nonce: crypto.randomBytes(8).toString('hex')
  };
  return encryptPrintParams(payload);
}

/**
 * 验证打印令牌
 * @param {string} token - 打印令牌
 * @param {number} maxAge - 最大有效期（毫秒），默认18小时
 * @returns {Object|null} - 验证通过返回数据，否则返回null
 */
function verifyPrintToken(token, maxAge = 18 * 60 * 60 * 1000) {
  const data = decryptPrintParams(token);
  if (!data) return null;
  
  // 检查是否过期
  if (Date.now() - data.timestamp > maxAge) {
    return null;
  }
  
  return data;
}

module.exports = {
  encryptPrintParams,
  decryptPrintParams,
  generatePrintToken,
  verifyPrintToken
};
