// OSS连接测试脚本
require('dotenv').config();
const { uploadToOSS } = require('./utils/ossUpload');
const path = require('path');

async function testOSSConnection() {
  console.log('='.repeat(60));
  console.log('开始测试阿里云OSS连接...');
  console.log('='.repeat(60));
  
  // 显示配置信息
  console.log('\n【OSS配置信息】');
  console.log('Access Key ID:', process.env.OSS_ACCESS_KEY_ID);
  console.log('Bucket:', process.env.OSS_BUCKET);
  console.log('Endpoint:', process.env.OSS_ENDPOINT);
  console.log('Region:', process.env.OSS_REGION);
  console.log('Custom Domain:', process.env.OSS_CUSTOM_DOMAIN);
  
  // 测试文件路径
  const testFilePath = 'f:\\Code\\uniapp\\demo\\4d9ff30dc547199da7e550c8b0e6b05.jpg';
  
  try {
    console.log('\n【开始上传测试文件】');
    console.log('文件路径:', testFilePath);
    
    // 上传到 uploads 文件夹
    const objectName = 'uploads/test-' + Date.now() + '.jpg';
    console.log('目标路径:', objectName);
    
    const fileUrl = await uploadToOSS(testFilePath, objectName);
    
    console.log('\n【上传成功！】');
    console.log('访问URL:', fileUrl);
    console.log('请访问上述URL验证图片是否正确显示');
    
    return fileUrl;
  } catch (error) {
    console.error('\n【上传失败】');
    console.error('错误信息:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n可能原因: 网络连接失败或Endpoint配置错误');
    } else if (error.code === 'AccessDenied') {
      console.error('\n可能原因: AccessKey或SecretKey错误');
    } else if (error.code === 'NoSuchBucket') {
      console.error('\n可能原因: Bucket名称错误或不存在');
    }
    
    throw error;
  }
}

// 执行测试
testOSSConnection()
  .then(() => {
    console.log('\n='.repeat(60));
    console.log('✅ OSS连接测试完成');
    console.log('='.repeat(60));
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ 测试失败:', err.message);
    process.exit(1);
  });