
const crypto = require('crypto');

// 从环境变量读取加密密钥，如果没有则使用默认值
const ENCRYPTION_KEY = process.env.VIDEO_ENCRYPTION_KEY || 'ojld_video_secret_key_2024_999'; 
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * 加密视频链接
 * @param {string} text 原始链接
 * @returns {string} 加密后的字符串 (hex)
 */
function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption error:', error);
    return text;
  }
}

/**
 * 解密视频链接 (仅供后端内部或测试使用)
 * @param {string} text 加密后的字符串 (hex)
 * @returns {string} 原始链接
 */
function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  try {
    // 检查是否是加密格式：IV部分应该是32个hex字符（16字节）
    const firstColonIndex = text.indexOf(':');
    const ivPart = text.substring(0, firstColonIndex);
    
    // 如果IV部分不是有效的hex格式（32个字符），则认为不是加密的
    if (ivPart.length !== 32 || !/^[0-9a-fA-F]{32}$/.test(ivPart)) {
      return text;
    }
    
    const iv = Buffer.from(ivPart, 'hex');
    const encryptedText = Buffer.from(text.substring(firstColonIndex + 1), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error);
    return text;
  }
}

module.exports = { encrypt, decrypt };
