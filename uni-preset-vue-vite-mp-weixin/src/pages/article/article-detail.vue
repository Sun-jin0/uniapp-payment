<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 加载中状态 -->
    <view v-if="isCheckingLogin" class="loading-container">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>
    
    <!-- 未登录提示 -->
    <view v-else-if="!isLoggedIn" class="unlogin-container">
      <view class="unlogin-card">
        <view class="unlogin-icon">
          <text class="icon-text">📖</text>
        </view>
        <text class="unlogin-title">文章详情</text>
        <text class="unlogin-desc">登录后可查看完整文章内容</text>
        <button class="login-btn" @click="goToLogin">立即登录</button>
      </view>
    </view>
    
    <!-- 文章内容 -->
    <scroll-view v-else class="article-content" scroll-y>
      <view v-if="article" class="article-detail">
        <!-- 文章标题 -->
        <view class="article-title">{{ article.title }}</view>
        
        <!-- 文章元信息 -->
        <view class="article-meta">
          <text class="article-author">{{ article.author || '研兔刷题' }}</text>
          <text class="article-date">{{ formatDate(article.createdAt || article.createTime) }}</text>
          <text class="article-view-count">{{ article.viewCount || 0 }}次阅读</text>
          <text class="article-category">{{ article.category }}</text>
        </view>
        
        
        <!-- 网盘链接卡片 -->
        <view v-if="panLinks.length > 0" class="pan-links-section">
          <view class="pan-section-title">资源链接</view>
          <view v-for="(link, index) in panLinks" :key="index" class="pan-card" :class="link.type">
            <view class="pan-icon-wrapper" :class="link.type">
              <text class="pan-icon-text">{{ link.name.charAt(0) }}</text>
            </view>
            <view class="pan-info">
              <view class="pan-name">{{ link.name }}</view>
            </view>
            <button class="pan-btn copy-btn" @click="copyPanLink(link.url)">
              <text>复制链接</text>
            </button>
          </view>
        </view>

        <!-- 文章摘要 -->
        <view v-if="article.description && article.noticeType !== 'pan_resource'" class="article-description">
          <view class="description-tag">摘要</view>
          <text>{{ article.description }}</text>
        </view>

        <!-- 文章正文 -->
        <view class="article-body">
          <!-- #ifdef MP-WEIXIN -->
          <rich-text :nodes="article.content" selectable :preview="true" @itemclick="handleRichTextClick"></rich-text>
          <!-- #endif -->
          <!-- #ifdef H5 -->
          <view v-html="processedContent" @click="handleContentClick"></view>
          <!-- #endif -->
        </view>

        <!-- 小程序端：文章内容中的链接列表 -->
        <!-- #ifdef MP-WEIXIN -->
        <view v-if="articleLinks.length > 0" class="article-links-section">
          <view class="links-section-title">文章链接</view>
          <view 
            v-for="(link, index) in articleLinks" 
            :key="index" 
            class="article-link-item"
            @click="copyLink(link.href)"
          >
            <text class="link-text">{{ link.text }}</text>
            <text class="link-copy-btn">复制</text>
          </view>
        </view>
        <!-- #endif -->

        <!-- 文章链接 -->
        <view v-if="article.linkUrl" class="article-link-section">
          <navigator :url="article.linkUrl" class="article-link-btn">
            <text class="link-text">查看原文链接</text>
            <text class="link-arrow">→</text>
          </navigator>
        </view>
        
        

        <!-- 互动功能区：点赞、分享、收藏 -->
        <view class="interaction-bar">
          <view class="interaction-btn" :class="{ 'active': isLiked }" @click="handleLike">
            <text class="btn-icon like-icon"></text>
            <text class="btn-text">{{ likeCount || '点赞' }}</text>
          </view>
          <view class="interaction-btn" :class="{ 'active': isCollected }" @click="handleCollect">
            <text class="btn-icon collect-icon"></text>
            <text class="btn-text">{{ isCollected ? '已收藏' : '收藏' }}</text>
          </view>
          <view class="interaction-btn" @click="handleShare">
            <text class="btn-icon share-icon"></text>
            <text class="btn-text">分享</text>
          </view>
        </view>
      </view>
      
      <!-- 加载状态 -->
      <view v-else class="loading-state">
        <view class="loading-text">加载中...</view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed, getCurrentInstance } from 'vue';
import { copyToClipboard } from '@/utils/clipboard.js';

const { proxy } = getCurrentInstance();

// 主题状态
const isDarkMode = ref(false);

// 文章数据
const article = ref(null);

// 网盘链接列表
const panLinks = ref([]);

// 文章内容中的超链接列表（小程序端用）
const articleLinks = ref([]);

// 登录状态
const isLoggedIn = ref(false);
const isCheckingLogin = ref(true);

// 互动功能状态
const isLiked = ref(false);
const isCollected = ref(false);
const likeCount = ref(0);

// 处理文章内容（H5用）
const processedContent = computed(() => {
  if (!article.value?.content) return '';
  let content = article.value.content;
  
  // 为链接添加 data-href 属性用于点击识别
  content = content.replace(/<a([^>]*)href=["']([^"']*)["']([^>]*)>/gi, (match, before, href, after) => {
    return `<a${before}href="${href}" data-href="${href}"${after}>`;
  });
  
  return content;
});

// 从文章内容中提取所有超链接（小程序端用）
const extractArticleLinks = (content) => {
  if (!content) return [];
  const links = [];
  const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    const href = match[1];
    const text = match[2].trim() || href;
    // 排除锚点链接
    if (!href.startsWith('#')) {
      links.push({
        href: href,
        text: text.length > 30 ? text.substring(0, 30) + '...' : text
      });
    }
  }
  
  return links;
};

// 处理 rich-text 点击事件（小程序）
const handleRichTextClick = async (e) => {
  const { href, src } = e.detail || {};

  // 处理链接点击 - 复制链接
  if (href) {
    // 排除锚点链接（#开头）
    if (href.startsWith('#')) return;

    await copyToClipboard(href, {
      successMsg: '链接已复制',
      showModal: false
    });
    return;
  }

  // 处理图片点击 - 预览图片（微信会自动支持长按识别二维码）
  if (src) {
    uni.previewImage({
      urls: [src],
      current: src
    });
  }
};

// 复制链接（小程序端链接列表用）
const copyLink = async (href) => {
  await copyToClipboard(href, {
    successMsg: '链接已复制',
    showModal: false
  });
};

// 处理内容点击（H5）
const handleContentClick = (e) => {
  const target = e.target;
  if (!target) return;
  
  const tagName = target.tagName || '';
  
  // 处理图片点击
  if (tagName === 'IMG') {
    const src = target.dataset ? (target.dataset.src || target.src) : target.src;
    if (src) {
      uni.previewImage({
        urls: [src],
        current: src
      });
    }
    e.preventDefault();
    return;
  }
  
  // 处理链接点击 - 复制链接
  if (tagName === 'A') {
    const href = target.dataset ? target.dataset.href : null;
    if (href) {
      e.preventDefault();
      copyToClipboard(href, {
        successMsg: '链接已复制',
        showModal: false
      });
    }
  }
};

// 网盘链接识别正则
const PAN_REGEX = {
  // 百度网盘：pan.baidu.com/s/xxx 或 带提取码的链接
  baidu: /https?:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9_-]+(\?pwd=[a-zA-Z0-9]+)?/gi,
  // 夸克网盘：pan.quark.cn/s/xxx
  quark: /https?:\/\/pan\.quark\.cn\/s\/[a-zA-Z0-9_-]+/gi,
  // 阿里云盘：www.aliyundrive.com/s/xxx 或 www.alipan.com/s/xxx
  aliyun: /https?:\/\/(www\.)?(aliyundrive|alipan)\.com\/s\/[a-zA-Z0-9_-]+/gi,
  // 迅雷网盘：pan.xunlei.com/s/xxx
  xunlei: /https?:\/\/pan\.xunlei\.com\/s\/[a-zA-Z0-9_-]+/gi,
  // 天翼云盘：cloud.189.cn/t/xxx 或 cloud.189.cn/web/share?code=xxx
  tianyi: /https?:\/\/cloud\.189\.cn\/(t\/[a-zA-Z0-9_-]+|web\/share\?code=[a-zA-Z0-9_-]+)/gi,
  // 移动云盘：caiyun.139.com/w/i/xxx
  caiyun: /https?:\/\/caiyun\.139\.com\/w\/i\/[a-zA-Z0-9_-]+/gi
};

// 从文章内容中提取网盘链接
const extractPanLinks = (content) => {
  const links = [];
  const foundUrls = new Set();
  
  // 提取百度网盘链接
  const baiduMatches = content.match(PAN_REGEX.baidu) || [];
  baiduMatches.forEach(url => {
    if (!foundUrls.has(url)) {
      foundUrls.add(url);
      links.push({
        type: 'baidu',
        name: '百度网盘',
        icon: '☁️',
        desc: '百度网盘分享链接',
        url: url
      });
    }
  });
  
  // 提取夸克网盘链接
  const quarkMatches = content.match(PAN_REGEX.quark) || [];
  quarkMatches.forEach(url => {
    if (!foundUrls.has(url)) {
      foundUrls.add(url);
      links.push({
        type: 'quark',
        name: '夸克网盘',
        url: url
      });
    }
  });

  // 提取阿里云盘链接
  const aliyunMatches = content.match(PAN_REGEX.aliyun) || [];
  aliyunMatches.forEach(url => {
    if (!foundUrls.has(url)) {
      foundUrls.add(url);
      links.push({
        type: 'aliyun',
        name: '阿里云盘',
        url: url
      });
    }
  });
  
  // 提取迅雷网盘链接
  const xunleiMatches = content.match(PAN_REGEX.xunlei) || [];
  xunleiMatches.forEach(url => {
    if (!foundUrls.has(url)) {
      foundUrls.add(url);
      links.push({
        type: 'xunlei',
        name: '迅雷云盘',
        url: url
      });
    }
  });

  // 提取天翼云盘链接
  const tianyiMatches = content.match(PAN_REGEX.tianyi) || [];
  tianyiMatches.forEach(url => {
    if (!foundUrls.has(url)) {
      foundUrls.add(url);
      links.push({
        type: 'tianyi',
        name: '天翼云盘',
        url: url
      });
    }
  });

  // 提取移动云盘链接
  const caiyunMatches = content.match(PAN_REGEX.caiyun) || [];
  caiyunMatches.forEach(url => {
    if (!foundUrls.has(url)) {
      foundUrls.add(url);
      links.push({
        type: 'caiyun',
        name: '移动云盘',
        url: url
      });
    }
  });
  
  return links;
};

// 复制网盘链接
const copyPanLink = async (url) => {
  const success = await copyToClipboard(url, {
    successMsg: '链接已复制',
    showModal: false
  });
  if (!success) {
    uni.showToast({
      title: '复制失败',
      icon: 'none'
    });
  }
};

// 打开网盘链接
const openPanLink = (url) => {
  // #ifdef MP-WEIXIN
  // 微信小程序中复制到剪贴板并提示用户
  copyPanLink(url);
  uni.showModal({
    title: '提示',
    content: '链接已复制，请打开对应网盘APP粘贴访问',
    showCancel: false,
    confirmText: '知道了'
  });
  // #endif
  
  // #ifdef H5
  // H5环境可以直接跳转
  window.open(url, '_blank');
  // #endif
  
  // #ifdef APP-PLUS
  // APP环境使用系统浏览器打开
  plus.runtime.openURL(url);
  // #endif
};

// 检查登录状态
const checkLoginStatus = () => {
  const token = uni.getStorageSync('token');
  isLoggedIn.value = !!token;
  isCheckingLogin.value = false;
  return isLoggedIn.value;
};

// 跳转到登录页
const goToLogin = () => {
  uni.navigateTo({
    url: '/pages/login/login'
  });
};

// 获取当前页面参数
const getCurrentPageParams = () => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  return currentPage.options || {};
};

// 格式化日期
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 初始化文章数据
const initArticle = async () => {
  const params = getCurrentPageParams();
  const articleId = params.id;
  
  if (articleId) {
    try {
      uni.showLoading({ title: '加载中...' });
      const res = await proxy.$api.publicApi.getNoticeById(articleId);
      uni.hideLoading();
      
      if (res.code === 0 && res.data) {
        article.value = res.data;
        
        // 存储文章标题到页面实例，供分享使用
        const pages = getCurrentPages();
        const currentPage = pages[pages.length - 1];
        if (currentPage) {
          currentPage.$articleTitle = article.value.title;
          currentPage.$articleDesc = article.value.description || article.value.summary;
          currentPage.$articleCover = article.value.coverImage;
        }
        
        // 如果是跳转链接或微信链接类型，直接跳转
        if ((article.value.noticeType === 'link' || article.value.noticeType === 'wechat') && article.value.linkUrl) {
          uni.hideLoading();
          uni.navigateTo({
            url: `/pages/webview/webview?url=${encodeURIComponent(article.value.linkUrl)}`
          });
          return;
        }
        
        // 递增阅读数
        proxy.$api.publicApi.incrementNoticeViewCount(articleId).catch(() => {
          // 递增阅读数失败
        });
        
        // 提取文章中的网盘链接
        if (article.value.content) {
          panLinks.value = extractPanLinks(article.value.content);
          articleLinks.value = extractArticleLinks(article.value.content);
        }
      } else {
        uni.showToast({
          title: '文章不存在',
          icon: 'none'
        });
        setTimeout(() => uni.navigateBack(), 1500);
      }
    } catch (error) {
      uni.hideLoading();
      uni.showToast({
        title: '加载失败',
        icon: 'none'
      });
      setTimeout(() => uni.navigateBack(), 1500);
    }
  } else {
    uni.showToast({
      title: '文章ID无效',
      icon: 'none'
    });
    setTimeout(() => uni.navigateBack(), 1500);
  }
};

// 获取文章ID
const getArticleId = () => {
  const params = getCurrentPageParams();
  return params.id;
};

// 加载互动状态（点赞、收藏）
const loadInteractionStatus = async () => {
  const articleId = getArticleId();
  if (!articleId) return;
  
  // 从本地存储获取点赞和收藏状态
  const likedArticles = uni.getStorageSync('likedArticles') || [];
  const collectedArticles = uni.getStorageSync('collectedArticles') || [];
  
  isLiked.value = likedArticles.includes(articleId);
  isCollected.value = collectedArticles.some(item => item.id === articleId);
  
  // 从本地存储获取点赞数
  const likeCountMap = uni.getStorageSync('likeCountMap') || {};
  likeCount.value = likeCountMap[articleId] || 0;
};

// 处理点赞
const handleLike = async () => {
  if (!isLoggedIn.value) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  
  const articleId = getArticleId();
  if (!articleId) return;
  
  const likedArticles = uni.getStorageSync('likedArticles') || [];
  const likeCountMap = uni.getStorageSync('likeCountMap') || {};
  
  if (isLiked.value) {
    // 取消点赞
    const index = likedArticles.indexOf(articleId);
    if (index > -1) {
      likedArticles.splice(index, 1);
    }
    likeCount.value = Math.max(0, likeCount.value - 1);
    uni.showToast({ title: '已取消点赞', icon: 'none' });
  } else {
    // 点赞
    likedArticles.push(articleId);
    likeCount.value++;
    uni.showToast({ title: '点赞成功', icon: 'success' });
  }
  
  // 保存到本地存储
  uni.setStorageSync('likedArticles', likedArticles);
  likeCountMap[articleId] = likeCount.value;
  uni.setStorageSync('likeCountMap', likeCountMap);
  isLiked.value = !isLiked.value;
};

// 处理收藏
const handleCollect = async () => {
  if (!isLoggedIn.value) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  
  const articleId = getArticleId();
  if (!articleId) return;
  
  const collectedArticles = uni.getStorageSync('collectedArticles') || [];
  const articleInfo = {
    id: articleId,
    title: article.value?.title || '',
    category: article.value?.category || '',
    author: article.value?.author || '',
    createTime: article.value?.createdAt || article.value?.createTime || '',
    coverImage: article.value?.coverImage || ''
  };
  
  if (isCollected.value) {
    // 取消收藏
    const index = collectedArticles.findIndex(item => item.id === articleId);
    if (index > -1) {
      collectedArticles.splice(index, 1);
    }
    uni.showToast({ title: '已取消收藏', icon: 'none' });
  } else {
    // 收藏
    collectedArticles.push(articleInfo);
    uni.showToast({ title: '收藏成功', icon: 'success' });
  }
  
  // 保存到本地存储
  uni.setStorageSync('collectedArticles', collectedArticles);
  isCollected.value = !isCollected.value;
};

// 处理分享
const handleShare = () => {
  // #ifdef MP-WEIXIN
  uni.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
  uni.showToast({ title: '请点击右上角分享', icon: 'none' });
  // #endif
  
  // #ifdef H5
  // H5环境下复制链接
  const articleId = getArticleId();
  const shareUrl = window.location.origin + '/#/pages/article/article-detail?id=' + articleId;
  copyToClipboard(shareUrl, {
    successMsg: '链接已复制',
    showModal: false
  });
  // #endif
};

// 初始化主题状态
onMounted(() => {
  // 检查登录状态
  checkLoginStatus();
  
  // 从本地存储获取当前主题模式，默认白天模式
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
  
  // 监听主题变化事件
  uni.$on('themeChange', (darkMode) => {
    isDarkMode.value = darkMode;
  });
  
  // 已登录才加载文章数据
  if (isLoggedIn.value) {
    initArticle();
    loadInteractionStatus();
  }
  
  // #ifdef MP-WEIXIN
// 显示分享菜单
  uni.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
  // #endif
});
</script>

<script>
// #ifdef MP-WEIXIN
// 页面级别的分享配置（需要在独立的 script 标签中定义）
export default {
  onShareAppMessage() {
    // 获取当前页面参数
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const options = currentPage ? currentPage.options : {};
    const articleId = options.id;
    
    // 从页面实例中获取文章标题
    const articleTitle = currentPage && currentPage.$articleTitle ? currentPage.$articleTitle : '文章详情';
    const articleDesc = currentPage && currentPage.$articleDesc ? currentPage.$articleDesc : '点击查看更多精彩内容';
    const articleCover = currentPage && currentPage.$articleCover ? currentPage.$articleCover : '/static/logo.png';
    
    return {
      title: articleTitle,
      desc: articleDesc,
      path: '/pages/article/article-detail?id=' + articleId,
      imageUrl: articleCover
    };
  },
  onShareTimeline() {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const options = currentPage ? currentPage.options : {};
    const articleId = options.id;
    
    // 从页面实例中获取文章标题
    const articleTitle = currentPage && currentPage.$articleTitle ? currentPage.$articleTitle : '文章详情';
    const articleCover = currentPage && currentPage.$articleCover ? currentPage.$articleCover : '/static/logo.png';
    
    return {
      title: articleTitle,
      query: 'id=' + articleId,
      imageUrl: articleCover
    };
  }
}
// #endif
</script>

<style scoped>
.container {
  background-color: #ffffff;
  min-height: 100vh;
  transition: all 0.3s ease;
}

/* 文章内容 */
.article-content {
  box-sizing: border-box;
}

.article-detail {
  padding: 40rpx 30rpx;
}

.article-title {
  font-size: 44rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 24rpx;
  line-height: 1.4;
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 40rpx;
  flex-wrap: wrap;
}

.article-author {
  font-size: 28rpx;
  color: #576b95;
  font-weight: 500;
}

.article-date {
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.3);
}

.article-view-count {
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.3);
}

.article-category {
  font-size: 24rpx;
  color: #7b4397;
  background: rgba(123, 67, 151, 0.1);
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
}

.article-cover {
  width: 100%;
  height: 400rpx;
  border-radius: 8rpx;
  margin-bottom: 40rpx;
  background-color: #f5f5f5;
}

.article-description {
  background-color: #f8f8f8;
  padding: 24rpx;
  border-radius: 8rpx;
  margin-bottom: 40rpx;
  position: relative;
  border-left: 8rpx solid #7b4397;
}

.description-tag {
  font-size: 20rpx;
  color: #7b4397;
  font-weight: bold;
  margin-bottom: 8rpx;
  text-transform: uppercase;
  letter-spacing: 2rpx;
}

.article-description text {
  font-size: 28rpx;
  color: #666666;
  line-height: 1.6;
}

.article-body {
  font-size: 32rpx;
  color: #333333;
  line-height: 1.8;
}

/* rich-text 组件样式 */
.article-body rich-text {
  width: 100%;
}

/* 调整富文本中的图片 */
:deep(img) {
  max-width: 100% !important;
  height: auto !important;
  display: block;
  margin: 20rpx 0;
  border-radius: 8rpx;
}

:deep(p) {
  margin-bottom: 20rpx;
  word-break: break-word;
  display: block;
}

/* rich-text 样式 */
.article-body {
  user-select: text;
  -webkit-user-select: text;
}

.article-content-selectable {
  user-select: text;
  -webkit-user-select: text;
}

.article-body rich-text {
  width: 100%;
}

/* 富文本图片样式 */
:deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 20rpx 0;
  border-radius: 8rpx;
}

/* 富文本段落样式 */
:deep(p) {
  margin-bottom: 20rpx;
  word-break: break-word;
}

/* 文章链接样式 */
:deep(a) {
  word-break: break-all;
  color: #576b95;
}

/* 小程序端文章链接列表样式 */
.article-links-section {
  margin-top: 40rpx;
  padding: 30rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
}

.links-section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.article-link-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx;
  background: #fff;
  border-radius: 8rpx;
  margin-bottom: 16rpx;
}

.article-link-item:last-child {
  margin-bottom: 0;
}

.article-link-item .link-text {
  flex: 1;
  font-size: 26rpx;
  color: #576b95;
  word-break: break-all;
}

.article-link-item .link-copy-btn {
  font-size: 24rpx;
  color: #fff;
  background: #576b95;
  padding: 8rpx 20rpx;
  border-radius: 6rpx;
  margin-left: 20rpx;
}

/* 文章链接部分 */
.article-link-section {
  margin-top: 60rpx;
  padding-top: 40rpx;
  border-top: 1rpx solid #eee;
}

.article-link-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  width: 100%;
  height: 88rpx;
  background-color: #7b4397;
  color: #ffffff;
  border-radius: 12rpx;
  font-size: 30rpx;
  font-weight: bold;
}

.article-link-btn:active {
  opacity: 0.9;
  transform: scale(0.99);
}

/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400rpx;
}

.loading-text {
  font-size: 28rpx;
  color: #999999;
}

/* 加载中状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 40rpx;
}

.loading-spinner {
  width: 60rpx;
  height: 60rpx;
  border: 4rpx solid #e5e7eb;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  margin-top: 20rpx;
  font-size: 28rpx;
  color: #6b7280;
}

/* 未登录状态样式 */
.unlogin-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 40rpx;
}

.unlogin-card {
  background: white;
  border-radius: 30rpx;
  padding: 80rpx 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.08);
  width: 100%;
  max-width: 600rpx;
}

.unlogin-icon {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40rpx;
}

.icon-text {
  font-size: 70rpx;
}

.unlogin-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 20rpx;
}

.unlogin-desc {
  font-size: 26rpx;
  color: #6b7280;
  text-align: center;
  margin-bottom: 50rpx;
  line-height: 1.6;
}

.login-btn {
  width: 80%;
  height: 88rpx;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 44rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-btn:active {
  opacity: 0.9;
}

/* 夜间模式 - 未登录 */
.dark-mode .unlogin-card {
  background: #1f2937;
}

.dark-mode .unlogin-icon {
  background: linear-gradient(135deg, #312e81 0%, #4c1d95 100%);
}

.dark-mode .unlogin-title {
  color: #f9fafb;
}

.dark-mode .unlogin-desc {
  color: #9ca3af;
}

/* 夜间模式适配 */
.dark-mode {
  background-color: #1a1a1a;
}

.dark-mode .nav-bar {
  background-color: #2d2d2d;
}

.dark-mode .back-icon,
.dark-mode .nav-title,
.dark-mode .article-title,
.dark-mode .article-body {
  color: #ffffff;
}

.dark-mode .article-author {
  color: #7d90b9;
}

.dark-mode .article-date {
  color: rgba(255, 255, 255, 0.3);
}

.dark-mode .article-description {
  background-color: #252525;
  border-left-color: #7b4397;
}

.dark-mode .article-description text {
  color: #aaaaaa;
}

.dark-mode .article-link-section {
  border-top-color: #333;
}

.dark-mode .article-category {
  background: rgba(123, 67, 151, 0.2);
}

.dark-mode .loading-state {
  background-color: #2d2d2d;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
}

.dark-mode .loading-text {
  color: #cccccc;
}

/* ============ 网盘链接卡片样式 ============ */
.pan-links-section {
  margin-top: 60rpx;
  padding-top: 40rpx;
  border-top: 1rpx solid #eee;
}

.pan-section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 30rpx;
  padding-left: 20rpx;
  border-left: 8rpx solid #6366f1;
}

.pan-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
  border: 1rpx solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.pan-icon-wrapper {
  width: 40rpx;
  height: 40rpx;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #f3f4f6;
}

.pan-icon-wrapper.baidu { background: #2932e1; }
.pan-icon-wrapper.quark { background: #00b4ff; }
.pan-icon-wrapper.aliyun { background: #ff6a00; }
.pan-icon-wrapper.xunlei { background: #0099ff; }
.pan-icon-wrapper.tianyi { background: #ff3333; }
.pan-icon-wrapper.caiyun { background: #00cc66; }

.pan-icon-text {
  font-size: 22rpx;
  color: #fff;
  font-weight: 600;
}

.pan-info {
  flex: 1;
  min-width: 0;
}

.pan-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #111827;
}

.pan-btn {
  height: 56rpx;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 500;
  border: none;
  padding: 0 24rpx;
  flex-shrink: 0;
}

.pan-btn::after {
  border: none;
}

.copy-btn {
  background: #f3f4f6;
  color: #374151;
}

.copy-btn:active {
  background: #e5e7eb;
}

.open-btn {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
}

.open-btn:active {
  opacity: 0.9;
}

.quark-btn {
  background: linear-gradient(135deg, #00b4ff 0%, #0088cc 100%);
}

.btn-icon {
  font-size: 28rpx;
}

/* 夜间模式 - 网盘卡片 */
.dark-mode .pan-links-section {
  border-top-color: #333;
}

.dark-mode .pan-section-title {
  color: #f9fafb;
  border-left-color: #8b5cf6;
}

.dark-mode .pan-card {
  background: #1f2937;
  border-color: #374151;
}

.dark-mode .pan-name {
  color: #f9fafb;
}

.dark-mode .pan-url {
  color: #9ca3af;
}

.dark-mode .copy-btn {
  background: #374151;
  color: #f9fafb;
}

.dark-mode .copy-btn:active {
  background: #4b5563;
}

/* ============ 互动功能区样式 ============ */
.interaction-bar {
  display: flex;
  justify-content: center;
  gap: 60rpx;
  padding: 40rpx 0;
  border-top: 1rpx solid #e5e7eb;
  margin-top: 40rpx;
}

.interaction-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  cursor: pointer;
}

.interaction-btn:active {
  opacity: 0.7;
}

.btn-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background-color: #f3f4f6;
  background-size: 40rpx 40rpx;
  background-repeat: no-repeat;
  background-position: center;
}

.interaction-btn.active .btn-icon {
  background-color: #fef3c7;
}

.btn-text {
  font-size: 24rpx;
  color: #6b7280;
}

.interaction-btn.active .btn-text {
  color: #f59e0b;
}

.like-icon {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%236b7280" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>');
}

.interaction-btn.active .like-icon {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ef4444" stroke="%23ef4444" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>');
}

.collect-icon {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%236b7280" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>');
}

.interaction-btn.active .collect-icon {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23f59e0b" stroke="%23f59e0b" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>');
}

.share-icon {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%236b7280" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>');
}

/* 夜间模式 - 互动区 */
.dark-mode .interaction-bar {
  border-top-color: #374151;
}

.dark-mode .btn-icon {
  background-color: #374151;
}

.dark-mode .interaction-btn.active .btn-icon {
  background-color: #78350f;
}

.dark-mode .btn-text {
  color: #9ca3af;
}

.dark-mode .interaction-btn.active .btn-text {
  color: #fbbf24;
}
</style>