const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev', {
  skip: (req, res) => req.url.includes('/api/video/proxy')
}));
// app.use((req, res, next) => {
//   console.log(`[Request] ${req.method} ${req.url}`);
//   next();
// });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// 请求日志中间件
app.use((req, res, next) => {
  if (req.url.includes('/computer/tutorials')) {
    console.log(`[Request] ${req.method} ${req.url}`);
  }
  next();
});

app.use('/api/user', require('./routes/userRoutes'));
app.use('/api', require('./routes/publicRoutes'));
app.use('/api', require('./routes/examRoutes'));
app.use('/api/redeem-codes', require('./routes/redeemCodeRoutes'));
app.use('/api', require('./routes/studyRoutes'));
app.use('/api/checkin', require('./routes/checkinRoutes'));
app.use('/api/checkin-category', require('./routes/checkinCategoryRoutes'));
app.use('/api/essay', require('./routes/essayRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/med', require('./routes/medRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api', require('./routes/uploadRoutes'));
app.use('/api', require('./routes/mathRoutes'));
app.use('/api/math', require('./routes/mathSolve'));
app.use('/api', require('./routes/computer1Routes'));
app.use('/api', require('./routes/adminMathRoutes'));
app.use('/api', require('./routes/homepageCardRoutes')); // homepageCardRoutes mounts on / and /admin
app.use('/api/video', require('./routes/videoRoutes'));
app.use('/api/admin/video', require('./routes/adminVideoRoutes'));
app.use('/api', require('./routes/politicsRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/online-exam', require('./routes/onlineExamRoutes'));
app.use('/api', require('./routes/uploadRoutes'));
app.use('/api', require('./routes/tutorialRoutes'));
app.use('/api/security', require('./routes/security'));
app.use('/api', require('./routes/avatarFrameRoutes'));
app.use('/api/qq-group', require('./routes/qqGroupRoutes'));
// 卡牌路由
const cardRoutes = require('./routes/cardRoutes');
app.use('/api/cards', cardRoutes);
console.log('卡牌路由已注册: /api/cards');

// 会员订阅路由
const membershipRoutes = require('./routes/membershipRoutes');
app.use('/api/membership', membershipRoutes);
console.log('会员路由已注册: /api/membership');

// 管理员会员管理路由
const adminMembershipRoutes = require('./routes/adminMembershipRoutes');
app.use('/api/admin/membership', adminMembershipRoutes);
console.log('管理员会员路由已注册: /api/admin/membership');

// 邀请功能已删除

// 静态页面用于管理员管理纠错
app.use('/admin-panel', express.static(path.join(__dirname, 'public/admin')));

// 测试页面
app.use('/test-upload.html', express.static(path.join(__dirname, 'public/test-upload.html')));
app.use('/test-image-manage.html', express.static(path.join(__dirname, 'public/test-image-manage.html')));
app.use('/test-pdf-export.html', express.static(path.join(__dirname, 'public/test-pdf-export.html')));

// PDF 导出路由
app.use('/api/pdf', require('./routes/pdfRoutes'));

// 图片代理路由 (解决H5跨域问题)
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // 设置CORS头（无论成功失败都设置）
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (!response.ok) {
      console.log(`Proxy image failed: ${imageUrl} - Status: ${response.status}`);
      // 返回1x1透明像素图片
      const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'no-cache');
      return res.send(transparentPixel);
    }
    
    // 设置响应头
    const contentType = response.headers.get('content-type') || 'image/png';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    
    // 转发图片数据
    const buffer = await response.buffer();
    res.send(buffer);
  } catch (error) {
    console.error('Proxy image error:', error);
    // 返回1x1透明像素图片
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-cache');
    res.send(transparentPixel);
  }
});

app.use(notFound);
app.use(errorHandler);

// 初始化会员数据表和默认价格数据
const Membership = require('./models/Membership');
Membership.initTables().then(() => {
  console.log('会员系统初始化完成');
}).catch(err => {
  console.error('会员系统初始化失败:', err.message);
});

const PORT = process.env.PORT || 3000;

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
