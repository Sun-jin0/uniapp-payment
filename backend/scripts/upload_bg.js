const fs = require('fs');
const path = require('path');
const http = require('http');

const filePath = 'f:/Code/uniapp/demo/普通奖池/bk.png';

function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`文件不存在: ${filePath}`));
      return;
    }

    const imageBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    const prefix = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${fileName}"\r\nContent-Type: image/png\r\n\r\n`);
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
    
    const postData = Buffer.concat([prefix, imageBuffer, suffix]);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/upload/image',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': postData.length
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.code === 0 && result.data && result.data.url) {
            resolve(result.data.url);
          } else {
            reject(new Error(result.message || '上传失败'));
          }
        } catch (e) {
          reject(new Error('解析响应失败: ' + data));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

async function upload() {
  try {
    console.log('上传背景图...');
    const url = await uploadImage(filePath);
    console.log(`✓ 上传成功: ${url}`);
  } catch (error) {
    console.error(`✗ 上传失败: ${error.message}`);
  }
}

upload();
