
const https = require('https');

function checkUrl(url, referer) {
  return new Promise((resolve) => {
    const options = {
      headers: {},
      rejectUnauthorized: false // 我们暂时允许不安全的证书以检查详情
    };
    if (referer) {
      options.headers['Referer'] = referer;
    }
    const req = https.get(url, options, (res) => {
      console.log(`\nURL: ${url}`);
      console.log(`Referer: ${referer || 'None'}`);
      console.log(`Status: ${res.statusCode}`);
      console.log('Headers:', JSON.stringify(res.headers, null, 2));
      
      const cert = res.socket.getPeerCertificate();
      if (cert && cert.subject) {
        console.log('Certificate Subject:', cert.subject.CN);
        console.log('Certificate Issuer:', cert.issuer.CN);
        console.log('Certificate Valid To:', cert.valid_to);
      }
      
      resolve();
    });
    
    req.on('error', (e) => {
      console.error(`Error checking ${url}:`, e.message);
      resolve();
    });
  });
}

async function run() {
  const wechatReferer = 'https://servicewechat.com/wx1234567890abcdef/0/page-frame.html';
  
  console.log('--- Checking with NO Referer ---');
  await checkUrl('https://s3.hi168.com/hi168-26998-7111ilq6/exercises/bo-d6jsmls601uc73e0v46g-13-1772622279744.jpg');
  await checkUrl('https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1774783913396_5gg8p0.jpg');
  
  console.log('\n--- Checking with WECHAT Referer ---');
  await checkUrl('https://s3.hi168.com/hi168-26998-7111ilq6/exercises/bo-d6jsmls601uc73e0v46g-13-1772622279744.jpg', wechatReferer);
  await checkUrl('https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1774783913396_5gg8p0.jpg', wechatReferer);
  
  process.exit();
}

run();
