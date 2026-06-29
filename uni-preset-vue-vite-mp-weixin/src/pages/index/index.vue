<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 版本更新弹窗 -->
    <view class="update-modal" v-if="showUpdateModal">
      <view class="update-content">
        <view class="update-title">版本更新</view>
        <view class="update-body">
          <text class="update-text">检测到小程序新版本，重启即可体验新功能～</text>
        </view>
        <view class="update-actions">
          <button class="update-btn cancel" @click="handleRefuseUpdate" v-if="!forceUpdate">暂不更新</button>
          <button class="update-btn confirm" @click="handleUpdate">立即更新</button>
        </view>
      </view>
    </view>
    
    <!-- 轮播图 -->
    <swiper v-if="bannerList.length > 0" class="banner" :indicator-dots="true" :indicator-color="'rgba(255, 255, 255, 0.5)'" :indicator-active-color="'#ffffff'" autoplay="true" circular="true">
      <swiper-item v-for="banner in bannerList" :key="banner.id">
        <view class="banner-item">
          <image 
            class="banner-img" 
            :src="banner.imageUrl" 
            mode="aspectFill" 
            @click="handleBannerClick(banner)"
            @error="onBannerImageError"
          ></image>
        </view>
      </swiper-item>
    </swiper>

    <!-- 公告栏 -->
      <view class="text-carousel-section" v-if="articleList.length > 0">
        <swiper class="text-carousel" vertical="true" autoplay="true" circular="true" interval="3000" indicator-dots="true" :indicator-color="'rgba(255, 255, 255, 0.5)'" :indicator-active-color="'#ffffff'" :disable-touch="false">
          <swiper-item v-for="article in articleList" :key="article.id">
              <view @click="handleArticleClick(article)" class="text-carousel-item">
                <view class="carousel-content">
                  <view v-if="article.category === '系统通知'" class="article-tag-svg">
                    <view class="speaker-icon">
                      <view class="speaker-body"></view>
                      <view class="speaker-cone"></view>
                      <view class="speaker-sound"></view>
                    </view>
                  </view>
                  <view v-else class="article-tag">{{ article.category }}</view>
                  <view class="article-title">{{ article.title }}</view>
                </view>
              </view>
          </swiper-item>
        </swiper>
      </view>
    
    <!-- 顶部数据与在刷区域 -->
    <view class="top-data-section">
      <view class="top-left-column">
        <!-- 左侧：今日日期、倒计时与坚持天数 -->
        <view class="stats-row">
          <!-- 第一列：今日日期 -->
          <view class="stat-card stat-today" @click="showFullDateDetail" style="z-index: 10;">
            <view class="stat-value today-week">{{ todayYear }}</view>
            <view class="stat-label today-date">{{ todayMonthDay }}</view>
          </view>
          <view class="stat-divider"></view>

          <!-- 第二列：考研倒计时 -->
          <view class="stat-card stat-countdown" @click="showCountdownDetail" style="z-index: 10;">
            <view class="stat-value">{{ countdownDays }}<view class="stat-unit">天</view></view>
            <view class="stat-label">{{ countdownConfig?.countdown_title || '倒计时' }}</view>
          </view>
          <view class="stat-divider"></view>

          <!-- 第三列：坚持天数 -->
          <view class="stat-card stat-days">
            <view class="stat-value">
              {{ practiceDays }}
              <view class="stat-unit">天</view>
              <view class="signed-badge" v-if="isCheckedIn">已签到</view>
            </view>
            <view class="stat-label">坚持天数</view>
          </view>
        </view>
      </view>

      <!-- 右侧：当前在刷 -->
      <view class="current-card" @click="handleContinuePractice(getCurrentProgress())">
        <view class="current-header">
          <view class="current-label">当前在刷</view>
        </view>
        <view class="current-content">
          <view class="current-info">
            <view class="current-title">
              <view class="title-text">
                {{ getCurrentProgressTitle() }}
              </view>
              <view class="title-text duplicate">
                {{ getCurrentProgressTitle() }}
              </view>
            </view>
            <view class="current-progress" v-if="getCurrentProgress()?.currentIndex && getCurrentProgress()?.totalQuestions">
              第{{ getCurrentProgress().currentIndex }}题/共{{ getCurrentProgress().totalQuestions }}题
            </view>
            <view class="current-status" v-else>Learning</view>
          </view>
          <SvgIcon :name="getCurrentProgressIcon()" size="48" fill="#ff9800" />
        </view>
      </view>
    </view>

    

      <!-- 精选刷题区域 -->
      <view class="selection-section">
      <view class="selection-tabs-header">
        <view class="tabs-left">
          <view 
            class="tab-item" 
            :class="{ active: activeCategory === 'public' }"
            @click="activeCategory = 'public'"
          >
            <view class="tab-text">公共课</view>
            <view class="tab-line" v-if="activeCategory === 'public'"></view>
          </view>
          <view 
            class="tab-item" 
            :class="{ active: activeCategory === 'professional' }"
            @click="activeCategory = 'professional'"
          >
            <view class="tab-text">专业课</view>
            <view class="tab-line" v-if="activeCategory === 'professional'"></view>
          </view>
        </view>
      </view>

      <!-- 修改为可滑动的 grid -->
      <swiper class="selection-swiper" :style="{ height: selectionSwiperHeight }" :current="activeCategory === 'public' ? 0 : 1" @change="onSelectionSwiperChange" :indicator-dots="false">
        <swiper-item>
          <view class="selection-grid">
            <view 
              class="selection-card" 
              v-for="item in publicSelectionList" 
              :key="item.id" 
              @click="navigateToSelection(item)"
              :style="{ 
                backgroundColor: item.color || '#ffffff',
                height: (item.height || 100) + 'rpx'
              }"
            >
              <view class="card-content">
                <view class="card-title" :style="{ color: getDeepColor(item.color) }">{{ item.title }}</view>
                <view class="card-desc">{{ item.description || item.desc }}</view>
              </view>
              <image v-if="item.image_url" class="card-image" :src="item.image_url" mode="aspectFill"></image>
              <view v-else class="card-text-icon" :style="{ color: 'rgba(255, 255, 255, 0.7)' }">{{ item.textIcon || item.text_icon || item.title.charAt(0) }}</view>
            </view>
          </view>
        </swiper-item>
        <swiper-item>
          <view class="selection-grid">
            <view 
              class="selection-card" 
              v-for="item in professionalSelectionList" 
              :key="item.id" 
              @click="navigateToSelection(item)"
              :style="{ 
                backgroundColor: item.color || '#ffffff',
                height: (item.height || 100) + 'rpx'
              }"
            >
              <view class="card-content">
                <view class="card-title" :style="{ color: getDeepColor(item.color) }">{{ item.title }}</view>
                <view class="card-desc">{{ item.description || item.desc }}</view>
              </view>
              <image v-if="item.image_url" class="card-image" :src="item.image_url" mode="aspectFill"></image>
              <view v-else class="card-text-icon" :style="{ color: 'rgba(255, 255, 255, 0.8)' }">{{ item.textIcon || item.text_icon || item.title.charAt(0) }}</view>
            </view>
          </view>
        </swiper-item>
      </swiper>
    </view>

    <!-- 新增：精选单独区域 -->
    <view class="selected-section" v-if="selectedSelectionList.length > 0">
      <view class="section-header">
        <view class="section-title">精选内容</view>
      </view>
      <view class="selection-grid">
        <view 
          class="selection-card" 
          v-for="item in selectedSelectionList" 
          :key="item.id" 
          @click="navigateToSelection(item)"
          :style="{ 
            backgroundColor: item.color || '#ffffff',
            height: (item.height || 100) + 'rpx'
          }"
        >
          <view class="card-content">
            <view class="card-title" :style="{ color: getDeepColor(item.color) }">{{ item.title }}</view>
            <view class="card-desc">{{ item.description || item.desc }}</view>
          </view>
          <image v-if="item.image_url" class="card-image" :src="item.image_url" mode="aspectFill"></image>
          <view v-else class="card-text-icon" :style="{ color: 'rgba(255, 255, 255, 0.8)' }">{{ item.textIcon || item.text_icon || item.title.charAt(0) }}</view>
        </view>
      </view>
    </view>
    
    <!-- 学习数据 -->
    <view class="stats-section">
      <view class="section-header">
        <view class="section-title">学习数据</view>
        <view class="section-subtitle">今日成果</view>
      </view>
      <view class="stats-grid">
        <view class="stat-card-new accuracy">
          <view class="card-icon-box">
            <SvgIcon name="chart" size="32" fill="#4caf50" />
          </view>
          <view class="card-info">
            <view class="card-value">{{ todayStats.todayAccuracy !== null ? todayStats.todayAccuracy + '%' : '--' }}</view>
            <view class="card-label">今日准确率</view>
          </view>
        </view>
        <view class="stat-card-new questions">
          <view class="card-icon-box">
            <SvgIcon name="edit" size="32" fill="#2196f3" />
          </view>
          <view class="card-info">
            <view class="card-value">{{ todayStats.todayQuestions }}</view>
            <view class="card-label">今日刷题数</view>
          </view>
        </view>
      </view>

      <!-- 学习统计图表 (CSS 模拟) -->
      <view class="history-chart-card">
        <view class="chart-header">
          <view class="chart-header-left">
            <view class="chart-title">学习趋势 ({{ periodText }})</view>
          </view>
          <view class="chart-period-selector">
            <view :class="['chart-period-btn', period === 'week' ? 'active' : '']" @tap.stop="changePeriod('week')">周</view>
            <view :class="['chart-period-btn', period === 'month' ? 'active' : '']" @tap.stop="changePeriod('month')">月</view>
            <view :class="['chart-period-btn', period === 'three_months' ? 'active' : '']" @tap.stop="changePeriod('three_months')">季</view>
          </view>
        </view>

        
        
        <view class="chart-body" v-if="studyHistory.length > 0">
          <view class="chart-y-axis">
            <view class="y-label"><view>{{ maxCount }}</view></view>
            <view class="y-label"><view>{{ Math.floor(maxCount / 2) }}</view></view>
            <view class="y-label"><view>0</view></view>
          </view>
          <view class="chart-content">
            <view class="chart-bar-item" v-for="(item, index) in studyHistory" :key="index">
              <view class="bar-wrapper">
                <view class="bar-value" :style="{ height: (item.count / (maxCount || 1) * 100) + '%' }">
                  <view class="bar-tooltip" v-if="item.count > 0">{{ item.count }}</view>
                </view>
              </view>
              <view class="bar-label">{{ item.date }}</view>
            </view>
          </view>
        </view>
        <view class="chart-empty" v-else>
          <view>暂无该时间段的学习数据</view>
        </view>
      </view>

      <!-- 排行榜 -->
      <view class="leaderboard-container">
        <view class="leaderboard-header">
          <view class="leaderboard-title">
            <SvgIcon name="ranking" size="36" fill="#ffc107" />
            <view class="title-text">刷题达人榜</view>
          </view>
          <view class="leaderboard-periods">
            <view class="period-item" :class="{ active: leaderboardPeriod === 'day' }" @click="leaderboardPeriod = 'day'">日</view>
            <view class="period-item" :class="{ active: leaderboardPeriod === 'week' }" @click="leaderboardPeriod = 'week'">周</view>
            <view class="period-item" :class="{ active: leaderboardPeriod === 'month' }" @click="leaderboardPeriod = 'month'">月</view>
          </view>
        </view>

        <!-- 我的排名 -->
        <view class="my-rank-card" v-if="userRank" @click="goToRanking">
          <view class="rank-badge">
            <view class="rank-num">{{ userRank.rank }}</view>
          </view>
          <view class="rank-info">
            <view class="rank-label">我的当前排名</view>
            <view class="rank-status">{{ userRank.rank <= 10 ? '领先 90% 的同学' : '再接再厉哦' }}</view>
          </view>
          <view class="rank-score-box">
            <view class="score-num">{{ userRank.value }}</view>
            <view class="score-unit">题</view>
          </view>
          <SvgIcon name="arrow-right" size="24" fill="#999" />
        </view>

        <view class="leaderboard-list">
          <view class="leaderboard-item" v-for="(user, index) in leaderboardList" :key="index">
            <view class="rank-text" :class="{ 'top-rank': index < 3 }">{{ index + 1 }}</view>
            <image class="user-avatar" :src="user.avatar || 'https://picsum.photos/id/1005/40/40'"></image>
            <view class="user-info">
              <view class="user-name">{{ user.username }}</view>
              <view class="user-level-tag">Lv.{{ user.level || 1 }}</view>
            </view>
            <view class="user-score">
              <view class="score-val">{{ user.value }}</view>
              <view class="score-unit">题</view>
            </view>
          </view>
          <view class="leaderboard-footer" @click="goToRanking">
          <view>查看完整榜单</view>
          <SvgIcon name="arrow-right" size="20" fill="#666" />
        </view>
        </view>
      </view>
    </view>

    
  </view>

  <!-- 公告/广告弹窗 -->
  <view v-if="showNoticeModal" class="notice-overlay" @click="closeNoticeModal"></view>
  <view v-if="showNoticeModal" class="notice-modal" :class="{ 'ad-modal': currentNotice && currentNotice.type === 'ad' }">
    <view class="notice-header" v-if="currentNotice && currentNotice.type !== 'ad'">
      <view class="notice-title">{{ currentNotice.title }}</view>
      <view class="notice-close" @click="closeNoticeModal">×</view>
    </view>
    <view class="ad-close-btn" v-if="currentNotice && currentNotice.type === 'ad'" @click="closeNoticeModal">×</view>
    <view class="notice-content" v-if="currentNotice">
      <block v-if="currentNotice.type === 'ad' && currentNotice.imageUrl">
        <navigator v-if="currentNotice.linkUrl" :url="currentNotice.linkUrl" class="ad-link">
          <image class="ad-image" :src="currentNotice.imageUrl" mode="widthFix"></image>
        </navigator>
        <image v-else class="ad-image" :src="currentNotice.imageUrl" mode="widthFix"></image>
      </block>
      <view v-else v-html="currentNotice.content" class="text-content"></view>
    </view>
    <view class="notice-footer">
      <view v-if="currentNotice && currentNotice.type === 'ad'" class="notice-btn ad-btn" @click="handleAdClick">
        {{ currentNotice.buttonText || '查看详情' }}
      </view>
      <view v-else class="notice-btn" @click="closeNoticeModal">我知道了</view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, getCurrentInstance, computed, onUnmounted, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';

const instance = getCurrentInstance();

// 版本更新相关
const showUpdateModal = ref(false);
const forceUpdate = ref(false);
let updateManager = null;

// 倒计时配置
const countdownConfig = ref(null);
const countdownDays = ref(0);

// 今日日期
const todayMonthDay = computed(() => {
  const now = new Date();
  return `${now.getMonth() + 1}月${now.getDate()}日`;
});

const todayYear = computed(() => {
  const now = new Date();
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return weekDays[now.getDay()];
});

// 显示完整日期详情
const showFullDateDetail = () => {
  const now = new Date();
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const fullDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`;
  
  uni.showModal({
    title: '今日日期',
    content: fullDate,
    showCancel: false,
    confirmText: '知道了',
    confirmColor: '#333'
  });
};

// 格式化后的目标日期
const formattedCountdownDate = computed(() => {
  if (countdownConfig.value?.countdown_date) {
    try {
      const date = new Date(countdownConfig.value.countdown_date);
      if (isNaN(date.getTime())) return '';
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    } catch (e) {
      return '';
    }
  }
  return '';
});

// 显示倒计时详情弹窗
const showCountdownDetail = () => {
  if (!countdownConfig.value) {
    uni.showToast({ title: '倒计时配置加载中...', icon: 'none' });
    initCountdownConfig();
    return;
  }
  
  const dateStr = formattedCountdownDate.value;
  const title = countdownConfig.value.countdown_title || '倒计时';
  const note = countdownConfig.value.countdown_note || '加油！';
  
  uni.showModal({
    title: title,
    content: `目标日期：${dateStr || '未设置'}\n备注：${note}`,
    showCancel: false,
    confirmText: '确定',
    confirmColor: '#e53935'
  });
};

// 精选刷题分类
const activeCategory = ref('public');

// 精选刷题列表
const selectionList = ref([]);

// 加载导航科目数据
const loadNavSubjects = async () => {
  const api = instance.appContext.config.globalProperties.$api;
  try {
    const res = await api.publicApi.getSubjects();
    if (res.code === 0 && res.data) {
      selectionList.value = res.data.map(item => ({
        id: item.id,
        title: item.name,
        description: item.description || '',
        icon: item.icon || 'books',
        textIcon: item.text_icon || item.name.substring(0, 1),
        color: item.color || '#ffffff',
        url: item.page_path,
        category: item.category_type || 'public'
      }));
    }
  } catch (error) {
    console.error('加载导航科目失败:', error);
  }
};

// 过滤后的精选刷题列表
const filteredSelectionList = computed(() => {
  return selectionList.value.filter(item => {
    // 如果是“全部题库”，在两个分类都显示，或者只在公共课显示
    if (item.is_tab || item.isTab) return true;
    return item.category === activeCategory.value;
  });
});

const publicSelectionList = computed(() => {
  return selectionList.value.filter(item => {
    return item.category === 'public';
  });
});

const professionalSelectionList = computed(() => {
  return selectionList.value.filter(item => {
    return item.category === 'professional';
  });
});

const selectedSelectionList = computed(() => {
  return selectionList.value.filter(item => item.category === 'selected');
});

const selectionSwiperHeight = computed(() => {
  const list = activeCategory.value === 'public' ? publicSelectionList.value : professionalSelectionList.value;
  
  if (list.length === 0) return '160rpx';
  
  const rows = Math.ceil(list.length / 2);
  // 获取当前列表中卡片的最大高度
  const maxCardHeight = Math.max(...list.map(item => item.height || 100));
  // 每行 maxCardHeight + 间距 12rpx，外加适当的底部间距（20rpx）
  return (rows * maxCardHeight + (rows - 1) * 12 + 20) + 'rpx';
});

// 切换分类
const onSelectionSwiperChange = (e) => {
  activeCategory.value = e.detail.current === 0 ? 'public' : 'professional';
};

// 获取加深后的颜色
const getDeepColor = (color) => {
  if (!color || color === '#ffffff' || color === 'white') return '#333333';
  
  // 如果是常见的浅色背景，返回对应的深色
  const colorMap = {
    '#e3f2fd': '#1976d2', // 浅蓝 -> 深蓝
    '#e8f5e9': '#2e7d32', // 浅绿 -> 深绿
    '#fce4ec': '#c2185b', // 浅粉 -> 深粉
    '#fff3e0': '#ef6c00', // 浅橙 -> 深橙
    '#f3e5f5': '#7b1fa2', // 浅紫 -> 深紫
    '#e0f7fa': '#0097a7', // 浅青 -> 深青
  };
  
  const lowerColor = color.toLowerCase();
  if (colorMap[lowerColor]) return colorMap[lowerColor];
  
  // 如果不在映射中，尝试手动加深
  if (color.startsWith('#')) {
    let hex = color.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    // 加深 40%
    r = Math.floor(r * 0.6);
    g = Math.floor(g * 0.6);
    b = Math.floor(b * 0.6);
    
    const toHex = (c) => {
      const s = Math.max(0, Math.min(255, c)).toString(16);
      return s.length === 1 ? '0' + s : s;
    };
    
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }
  
  return '#333333';
};

// 检查登录并提示
const checkLoginAndAlert = () => {
  if (!isLoggedIn.value) {
    uni.showModal({
      title: '提示',
      content: '请先登录后再使用此功能',
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          uni.navigateTo({
            url: '/pages/login/login'
          });
        }
      }
    });
    return false;
  }
  return true;
};

// 获取倒计时配置
const initCountdownConfig = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.publicApi.getCountdownConfig();
    if (res.code === 0) {
      countdownConfig.value = res.data;
      calculateCountdown();
    }
  } catch (error) {
    console.error('加载倒计时配置失败:', error);
  }
};

// 计算倒计时天数
const calculateCountdown = () => {
  if (countdownConfig.value?.countdown_date) {
    const targetDate = new Date(countdownConfig.value.countdown_date);
    const now = new Date();
    // Reset time part to compare dates only
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diff = target - current;
    countdownDays.value = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }
};

// 坚持天数
const practiceDays = ref(0);
const isCheckedIn = ref(false);

// 登录状态
const isLoggedIn = ref(false);

// 检查登录状态
const checkLoginStatus = () => {
  const token = uni.getStorageSync('token');
  isLoggedIn.value = !!token;
  return isLoggedIn.value;
};

// 最近练习科目列表（支持多个进度）
const practiceProgressList = ref([]);

// 加载最近练习科目列表
const loadPracticeProgressList = () => {
  const saved = uni.getStorageSync('practiceProgressList');
  if (saved && Array.isArray(saved)) {
    practiceProgressList.value = saved.map(item => {
      const practiceData = { ...item };
      if (!practiceData.icon || practiceData.icon === 'books') {
        const titleIconMap = {
          '计算机': 'computer',
          '数学': 'math',
          '政治': 'flag',
          '英语': 'graduation-cap',
          '全部': 'books'
        };
        for (const key in titleIconMap) {
          if (practiceData.title && practiceData.title.includes(key)) {
            practiceData.icon = titleIconMap[key];
            break;
          }
        }
      }
      return practiceData;
    });
  } else {
    practiceProgressList.value = [];
  }
};

// 获取练习图标
const getPracticeIcon = (item) => {
  if (item.icon) return item.icon;
  const titleIconMap = {
    '计算机': 'computer',
    '数学': 'math',
    '政治': 'flag',
    '英语': 'graduation-cap',
    '全部': 'books'
  };
  for (const key in titleIconMap) {
    if (item.title && item.title.includes(key)) {
      return titleIconMap[key];
    }
  }
  return 'books';
};

// 删除进度
const deleteProgress = (index) => {
  practiceProgressList.value.splice(index, 1);
  uni.setStorageSync('practiceProgressList', practiceProgressList.value);
};

// 获取当前进度（最新的一个）
const getCurrentProgress = () => {
  return practiceProgressList.value.length > 0 ? practiceProgressList.value[0] : null;
};

// 获取当前进度标题
const getCurrentProgressTitle = () => {
  const current = getCurrentProgress();
  if (current) {
    return current.bookTitle || current.title || '开始学习';
  }
  return '开始学习';
};

// 获取当前进度图标
const getCurrentProgressIcon = () => {
  const current = getCurrentProgress();
  if (current) {
    return getPracticeIcon(current);
  }
  return 'books';
};

// 处理继续练习
const handleContinuePractice = (item) => {
  if (!checkLoginAndAlert()) return;

  if (item) {
    if (item.url) {
      uni.navigateTo({ url: item.url });
      return;
    }
    const url = `/pages/practice/practice-detail?id=${item.id}`;
    if (item.isTab) {
      uni.switchTab({ url });
    } else {
      uni.navigateTo({ url });
    }
  }
};

// 保存进度到列表
const savePracticeProgress = (practiceItem) => {
  if (!practiceItem || !practiceItem.id && !practiceItem.progressKey) return;
  
  const progressKey = practiceItem.progressKey || `${practiceItem.type || 'unknown'}_${practiceItem.id || Date.now()}`;
  
  const existingIndex = practiceProgressList.value.findIndex(item => 
    (item.progressKey && item.progressKey === progressKey) || 
    (item.id && practiceItem.id && item.id === practiceItem.id && item.type === practiceItem.type)
  );
  
  const newItem = {
    ...practiceItem,
    progressKey,
    timestamp: Date.now()
  };
  
  if (existingIndex !== -1) {
    practiceProgressList.value.splice(existingIndex, 1);
  }
  
  practiceProgressList.value.unshift(newItem);
  
  if (practiceProgressList.value.length > 10) {
    practiceProgressList.value = practiceProgressList.value.slice(0, 10);
  }
  
  uni.setStorageSync('practiceProgressList', practiceProgressList.value);
};

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 2592000000) return Math.floor(diff / 86400000) + '天前';
  
  return (date.getMonth() + 1) + '-' + date.getDate();
};

// 获取图标名称转换
const getIconName = (val) => {
  if (!val) return 'books';
  
  // 1. 处理表情符号或特定标识符
  const iconMap = {
    '💻': 'computer',
    '📐': 'math',
    '📚': 'books',
    '🚩': 'flag',
    '🎓': 'graduation-cap',
    '🏆': 'trophy',
    '📝': 'edit',
    'desktop': 'computer',
    'functions': 'math',
    'account-balance': 'flag',
    'translate': 'graduation-cap',
    'grid-view': 'books',
    'psychology': 'edit',
    'paint-brush': 'paint-brush',
    'books': 'books',
    'math': 'math'
  };
  
  if (iconMap[val]) return iconMap[val];

  // 2. 处理科目名称
  const n = val.toString().toLowerCase();
  if (n.includes('math') || n.includes('数学')) return 'math';
  if (n.includes('computer') || n.includes('计算机') || n.includes('数据结构') || n.includes('操作系统') || n.includes('组成原理') || n.includes('网络')) return 'computer';
  if (n.includes('med') || n.includes('医学') || n.includes('医') || n.includes('消')) return 'paint-brush';
  if (n.includes('eng') || n.includes('英语') || n.includes('英')) return 'graduation-cap';
  if (n.includes('public') || n.includes('公共')) return 'flag';
  
  return 'books';
};

// 获取签到数据并自动签到
const initCheckinData = async () => {
  // 未登录不调用接口
  if (!isLoggedIn.value) {
    practiceDays.value = 0;
    isCheckedIn.value = false;
    return;
  }
  
  try {
    const res = await instance.appContext.config.globalProperties.$api.checkinApi.getCheckinRecords();
    if (res.code === 0) {
      practiceDays.value = res.data.totalDays;
      
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = res.data.records.find(r => {
        if (!r.date) return false;
        // 处理 Date 对象或字符串
        const recordDate = typeof r.date === 'string' ? r.date : new Date(r.date).toISOString();
        return recordDate.startsWith(today);
      });
      
      if (todayRecord) {
        isCheckedIn.value = true;
      } else {
        // 自动签到
        await handleAutoCheckin();
      }
    }
  } catch (error) {
    console.error('加载签到数据失败:', error);
    practiceDays.value = 0;
    isCheckedIn.value = false;
  }
};

// 自动签到逻辑
const handleAutoCheckin = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.checkinApi.dailyCheckin();
    if (res.code === 0) {
      isCheckedIn.value = true;
      practiceDays.value++;
    } else if (res.code === 1 && (res.message === '今日已签到' || res.message?.includes('已签到'))) {
      // 已经签到过，直接标记为已签到，不报错也不打印
      isCheckedIn.value = true;
    }
  } catch (error) {
    // 只有非“今日已签到”的错误才记录日志
    const errorMsg = error.message || (error.data && error.data.message) || '';
    if (error.code !== 1 && !errorMsg.includes('今日已签到')) {
      console.error('自动签到失败:', error);
    } else {
      // 如果是已签到，也需要更新状态
      isCheckedIn.value = true;
    }
  }
};

// 原始考试列表数据
const originalExamList = ref([
  { id: 1, title: '2024年考研英语模拟卷', questionCount: 50, difficulty: '中等', subjectId: 102 },
  { id: 2, title: '计算机二级公共基础知识', questionCount: 40, difficulty: '简单', subjectId: 301 },
  { id: 3, title: '教师资格证综合素质', questionCount: 35, difficulty: '较难', subjectId: 302 },
  { id: 5, title: '考研政治模拟卷', questionCount: 38, difficulty: '中等', subjectId: 103 },
  { id: 6, title: '408计算机基础综合', questionCount: 40, difficulty: '困难', subjectId: 104 },
  { id: 7, title: '行测模拟卷', questionCount: 135, difficulty: '中等', subjectId: 201 },
  { id: 8, title: '申论模拟卷', questionCount: 5, difficulty: '较难', subjectId: 202 }
]);

// 当前显示的考试列表数据
const examList = ref([]);

// 更新考试列表
const updateExamList = (subject) => {
  if (subject && subject.id) {
    const filteredExams = originalExamList.value.filter(item => item.subjectId === subject.id);
    examList.value = filteredExams.length > 0 ? filteredExams : originalExamList.value;
  } else {
    examList.value = originalExamList.value;
  }
};

// 跳转到考试页面
const goToExam = () => {
  uni.switchTab({
    url: '/pages/exam/exam'
  });
};

// 开始考试
const startExam = (examId) => {
  const exam = originalExamList.value.find(e => e.id === examId);
  if (exam) {
    const practiceItem = {
      id: exam.id,
      title: exam.title,
      icon: 'books',
      url: `/pages/answer/answer?examId=${examId}`,
      isTab: false,
      type: 'exam'
    };
    savePracticeProgress(practiceItem);
  }

  uni.navigateTo({
    url: `/pages/answer/answer?examId=${examId}`
  });
};

// 跳转到管理员页面
const goToAdmin = () => {
  uni.navigateTo({
    url: '/pages/admin/admin'
  });
};

// 初始化轮播图数据
const initBanners = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.publicApi.getBanners();
    if (res.code === 0) {
      // 只显示启用状态的轮播图
      bannerList.value = res.data.filter(banner => banner.status === 1);
    }
  } catch (error) {
    console.error('加载轮播图失败:', error);
    bannerList.value = [];
  }
};

// 处理轮播图点击
const handleBannerClick = (banner) => {
  if (!banner || !banner.link) {
    console.warn('轮播图数据无效或未配置链接');
    return;
  }

  const link = banner.link.trim();
  if (!link) return;

  console.log('正在跳转:', link);

  // 如果是外部链接
  if (link.startsWith('http')) {
    console.log('检测到外部链接，正在跳转...');
    // #ifdef H5
    window.open(link);
    // #endif
    // #ifndef H5
    uni.navigateTo({
      url: `/pages/webview/webview?url=${encodeURIComponent(link)}&title=${encodeURIComponent(banner.title || '详情')}`
    });
    // #endif
    return;
  }

  // 内部链接处理
  let targetUrl = link;
  if (!targetUrl.startsWith('/')) {
    targetUrl = '/' + targetUrl;
  }

  // 定义 tabbar 页面列表
  const tabBarPages = [
    '/pages/index/index',
    '/pages/practice/practice',
    '/pages/exam/exam',
    '/pages/profile/profile'
  ];

  // 检查是否是 tabbar 页面
  const isTabBar = tabBarPages.some(page => targetUrl.startsWith(page));

  if (isTabBar) {
    console.log('正在执行 switchTab:', targetUrl);
    uni.switchTab({
      url: targetUrl,
      success: () => console.log('switchTab 成功'),
      fail: (err) => {
      console.error('switchTab 失败:', err);
      uni.showToast({ title: '页面跳转失败', icon: 'none' });
    }
  });
} else {
  console.log('正在执行 navigateTo:', targetUrl);
  uni.navigateTo({
    url: targetUrl,
    success: () => console.log('navigateTo 成功'),
    fail: (err) => {
      console.error('navigateTo 失败:', err);
      uni.showToast({ title: '页面开发中', icon: 'none' });
    }
  });
}
};

// 初始化文章列表数据
const initArticles = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.publicApi.getNotices({ category: '系统通知' });
    if (res.code === 0) {
      // 只显示已发布的公告，且后端已经按分类过滤
      articleList.value = res.data.filter(notice => notice.isActive === 1);
    }
  } catch (error) {
    console.error('加载公告失败:', error);
    articleList.value = [];
  }
};

// 处理文章/通知点击
const handleArticleClick = (article) => {
  if ((article.noticeType === 'link' || article.noticeType === 'wechat') && article.linkUrl) {
    if (article.linkUrl.startsWith('http')) {
      // #ifdef H5
      window.open(article.linkUrl);
      // #endif
      // #ifndef H5
      uni.navigateTo({
        url: `/pages/webview/webview?url=${encodeURIComponent(article.linkUrl)}&title=${encodeURIComponent(article.title)}`
      });
      // #endif
    } else {
      uni.navigateTo({
        url: article.linkUrl
      });
    }
  } else {
    uni.navigateTo({
      url: `/pages/article/article-detail?id=${article.id}`
    });
  }
};

// 轮播图图片加载错误处理
const onBannerImageError = (e) => {
  // 获取当前图片元素
  const imgElement = e.target;
  // 图片加载失败时，清空图片源，避免显示破碎图片图标
  imgElement.src = '';
};

// 获取轮播图图片URL（优先使用imageUrl，如果为空则使用linkUrl）
const getBannerImageUrl = (banner) => {
  return banner.imageUrl || banner.linkUrl || '';
};

// 学习数据
const totalQuestions = ref(0);
const studyDays = ref(0);

// 加载用户总体统计
const loadUserOverallStats = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.userApi.getUserInfo();
    if (res.code === 0) {
      totalQuestions.value = res.data.totalQuestions || 0;
      studyDays.value = res.data.studyDays || 0;
    }
  } catch (error) {
    console.error('加载总体统计失败:', error);
  }
};

// 初始化精选刷题卡片数据
const initHomepageCards = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.publicApi.getHomepageCards();
    if (res.code === 0) {
      selectionList.value = res.data;
    }
  } catch (error) {
    console.error('加载首页卡片失败:', error);
    // Fallback to default if API fails or returns empty
    if (selectionList.value.length === 0) {
      selectionList.value = [
        { id: 1, title: '计算机刷题', desc: '408/Java/Python', icon: '💻', color: '#e3f2fd', url: '/pages/computer/computer-main', category: 'professional' },
        { id: 2, title: '考研数学', desc: '数一/数二/数三', icon: '📐', color: '#e8f5e9', url: '/pages/math/math-bookshelf', category: 'public' },
        { id: 3, title: '考点刷题', desc: '按考点专项练习', icon: '🎯', color: '#f3e5f5', url: '/pages/math/math-knowledge-point-practice', category: 'public' },
        { id: 4, title: '考研政治', desc: '马原/毛中特', icon: '🚩', color: '#fce4ec', url: '/pages/politics/politics-main', category: 'public' },
        { id: 5, title: '全部题库', desc: '浏览所有科目', icon: '📚', color: '#fff3e0', url: '/pages/practice/practice', isTab: true, category: 'public' },
      ];
    }
  }
};

// 学习统计数据
const todayStats = ref({
  todayQuestions: 0,
  todayAccuracy: 0
});

// 最近学习列表
const recentLearningList = ref([]);
const studyHistory = ref([]);

// 处理最近练习点击跳转
const handleRecentClick = (item) => {
  if (!item) return;
  
  // 1. 如果是数学科目 (subjectId = 4 或名称包含数学)
  if (item.subjectId === 4 || (item.subjectName && item.subjectName.includes('数学'))) {
    if (item.bookId) {
      uni.navigateTo({
        url: `/pages/math/math-question-detail?bookId=${item.bookId}`
      });
    } else {
      uni.navigateTo({
        url: '/pages/math/math-bookshelf'
      });
    }
    return;
  }
  
  // 2. 如果是计算机科目 (subjectId = 17 且名称包含计算机)
  if ((item.subjectId === 17 || item.subjectId === 3) && (item.subjectName && item.subjectName.includes('计算机'))) {
    let url = '/pages/computer/computer-practice?';
    const params = [];
    if (item.chapterId) params.push(`chapterId=${item.chapterId}`);
    if (item.tagId) params.push(`tagId=${item.tagId}`);
    if (item.questionId) params.push(`questionId=${item.questionId}`);
    
    // 如果没有任何参数，默认可能需要一个 majorId
    if (params.length === 0) params.push('majorId=3');
    
    uni.navigateTo({
      url: url + params.join('&')
    });
    return;
  }
  
  // 3. 如果是西医综合 (subjectId = 17 且名称包含医学/生理/生化等)
  if (item.subjectId === 17 && (item.subjectName && (item.subjectName.includes('医学') || item.subjectName.includes('生理') || item.subjectName.includes('生化') || item.subjectName.includes('病理') || item.subjectName.includes('内科') || item.subjectName.includes('外科')))) {
    let url = '/pages/med/med-practice?';
    const params = [];
    if (item.chapterId) params.push(`chapterId=${item.chapterId}`);
    if (item.questionId) params.push(`questionId=${item.questionId}`);
    
    // 如果没有任何参数，默认跳转到列表页
    if (params.length === 0) {
      uni.navigateTo({ url: '/pages/med/med-list' });
      return;
    }
    
    uni.navigateTo({
      url: url + params.join('&')
    });
    return;
  }
  
  // 4. 默认跳转到普通答题页 (医学/综合等)
  const examId = item.examId || item.subjectId;
  if (examId) {
    uni.navigateTo({
      url: `/pages/answer/answer?examId=${examId}`
    });
  } else {
    uni.switchTab({
      url: '/pages/practice/practice'
    });
  }
};

// 排行榜数据
const leaderboardType = ref('questions');
const leaderboardPeriod = ref('day');
const leaderboardList = ref([]);
const userRank = ref(null);

// 加载所有首页数据
const loadAllHomeData = async () => {
  // 未登录不调用接口，使用本地数据
  if (!isLoggedIn.value) {
    // 使用本地存储的学习数据
    const studyData = JSON.parse(uni.getStorageSync('study_data') || '{}');
    const today = new Date().toISOString().split('T')[0];
    const todayData = studyData[today] || { questions: 0, correct: 0 };
    
    if (todayData.questions > 0) {
      todayStats.value = {
        todayQuestions: todayData.questions,
        todayAccuracy: todayData.questions > 0 ? Math.round((todayData.correct / todayData.questions) * 100) : 0
      };
    } else {
      todayStats.value = { todayQuestions: 0, todayAccuracy: null };
    }
    
    // 清空需要登录的数据
    recentLearningList.value = [];
    leaderboardList.value = [];
    userRank.value = null;
    studyHistory.value = [];
    return;
  }
  
  try {
    const res = await instance.appContext.config.globalProperties.$api.wrongBookApi.getHomeOverview();
    if (res.code === 0 && res.data) {
      const { todayStats: stats, recentLearning, leaderboard, history } = res.data;
      
      // 1. 今日统计 - 优先使用后端数据库返回的数据
      const studyData = JSON.parse(uni.getStorageSync('study_data') || '{}');
      const today = new Date().toISOString().split('T')[0];
      const todayData = studyData[today] || { questions: 0, correct: 0 };
      
      if (stats) {
        // 优先使用后端数据库返回的数据
        todayStats.value = stats;
        console.log('使用后端的今日统计数据:', todayStats.value);
        
        // 同时同步更新本地存储，保持一致
        studyData[today] = {
          questions: stats.todayQuestions,
          correct: stats.todayAccuracy !== null ? Math.round(stats.todayQuestions * (stats.todayAccuracy / 100)) : todayData.correct
        };
        uni.setStorageSync('study_data', JSON.stringify(studyData));
      } else if (todayData.questions > 0) {
        // 如果后端没数据，才使用本地存储的数据
        todayStats.value = {
          todayQuestions: todayData.questions,
          todayAccuracy: todayData.questions > 0 ? Math.round((todayData.correct / todayData.questions) * 100) : 0
        };
        console.log('使用本地存储的今日统计数据:', todayStats.value);
      }
      
      // 2. 最近学习
      if (Array.isArray(recentLearning)) {
        let list = [...recentLearning];
        
        // 处理“当前在刷”标记
        if (list.length > 0 && practiceProgressList.value.length > 0) {
          const firstProgress = practiceProgressList.value[0];
          if (firstProgress && firstProgress.id) {
            const firstItem = list[0];
            const lastId = firstProgress.id;
            if (firstItem.examId === lastId || firstItem.subjectId === lastId) {
              firstItem.isCurrent = true;
            }
          }
        }
        
        recentLearningList.value = list.slice(0, 8);
      }
      
      // 3. 排行榜
      if (leaderboard) {
        leaderboardList.value = Array.isArray(leaderboard.list) ? leaderboard.list.slice(0, 5) : [];
        userRank.value = leaderboard.userRank || null;
      }
      
      // 4. 学习历史
      if (Array.isArray(history)) {
        studyHistory.value = history;
      }
    }
  } catch (error) {
    console.error('加载首页概览数据失败:', error);
  }
};

// 加载今日统计
const loadTodayStats = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.wrongBookApi.getStudyStats();
    if (res.code === 0) {
      todayStats.value = res.data;
    }
  } catch (error) {
    console.error('加载今日统计失败:', error);
    // 后端接口失败时，使用本地存储数据
    loadTodayStatsFromLocal();
  }
};

// 从本地存储加载今日统计
const loadTodayStatsFromLocal = () => {
  try {
    const studyData = JSON.parse(uni.getStorageSync('study_data') || '{}');
    const today = new Date().toISOString().split('T')[0];
    const todayData = studyData[today] || { questions: 0, correct: 0 };
    
    todayStats.value = {
      todayQuestions: todayData.questions,
      todayAccuracy: todayData.questions > 0 ? Math.round((todayData.correct / todayData.questions) * 100) : 0
    };
    console.log('从本地存储加载今日统计:', todayStats.value);
  } catch (error) {
    console.error('从本地存储加载今日统计失败:', error);
  }
};

// 加载最近学习
const loadRecentLearning = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.wrongBookApi.getRecentLearning(8);
    if (res.code === 0) {
      let list = Array.isArray(res.data) ? res.data : [];
      
      // 处理“当前在刷”标记
      if (list.length > 0 && practiceProgressList.value.length > 0) {
        const firstProgress = practiceProgressList.value[0];
        if (firstProgress && firstProgress.id) {
          const firstItem = list[0];
          const lastId = firstProgress.id;
          if (firstItem.examId === lastId || firstItem.subjectId === lastId) {
            firstItem.isCurrent = true;
          }
        }
      }
      
      recentLearningList.value = list.slice(0, 8); // 严格展示8行
    }
  } catch (error) {
    console.error('加载最近学习失败:', error);
  }
};

// 加载排行榜
const loadLeaderboard = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.wrongBookApi.getLeaderboard(leaderboardType.value, leaderboardPeriod.value);
    if (res.code === 0 && res.data) {
      leaderboardList.value = Array.isArray(res.data.list) ? res.data.list.slice(0, 5) : [];
      // 只有当API返回了userRank时才更新，否则保持原有值
      if (res.data.userRank) {
        userRank.value = res.data.userRank;
      }
      // 如果API没有返回userRank，且之前也没有值，创建一个默认值
      else if (!userRank.value) {
        userRank.value = {
          rank: '-',
          value: 0
        };
      }
    }
  } catch (error) {
    console.error('加载排行榜失败:', error);
    // 即使出错，也保持之前的userRank值
  }
};

const period = ref('week');
const periodText = computed(() => {
  const map = {
    'week': '最近7天',
    'month': '最近30天',
    'three_months': '最近90天'
  };
  return map[period.value] || '最近7天';
});

const maxCount = computed(() => {
  if (!studyHistory.value || studyHistory.value.length === 0) return 100;
  const counts = studyHistory.value.map(item => item.count || 0);
  const max = Math.max(...counts);
  return max > 0 ? Math.ceil(max * 1.2 / 10) * 10 : 100;
});

const changePeriod = (p) => {
  period.value = p;
  loadStudyHistory();
};

// 加载学习历史统计
const loadStudyHistory = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.wrongBookApi.getStudyHistory(period.value);
    if (res.code === 0 && Array.isArray(res.data)) {
      studyHistory.value = res.data;
    }
  } catch (error) {
    console.error('加载学习历史失败:', error);
  }
};

// 监听排行榜变化
watch([leaderboardType, leaderboardPeriod], () => {
  loadLeaderboard();
});

// 跳转到排行榜页面
const goToRanking = () => {
  if (!checkLoginAndAlert()) return;
  
  uni.navigateTo({
    url: '/pages/ranking/ranking'
  });
};

// 跳转到学习历史
const goToHistory = () => {
  uni.navigateTo({
    url: '/pages/study/history'
  });
};

// 跳转到精选页面
const navigateToSelection = (item) => {
  // 检查是否需要登录（刷题相关功能需要登录）
  const needLogin = item.url && (
    item.url.includes('practice') || 
    item.url.includes('exam') || 
    item.url.includes('computer')
  );
  
  if (needLogin && !checkLoginAndAlert()) return;

  // 保存为最近练习科目
  const practiceItem = {
    id: item.id,
    title: item.title,
    icon: item.icon,
    url: item.url,
    isTab: item.isTab || item.is_tab,
    type: item.type || 'selection'
  };
  savePracticeProgress(practiceItem);
  
  // 立即刷新最近学习列表（队列逻辑）- 仅登录时
  if (isLoggedIn.value) {
    loadRecentLearning();
  }

  if (item.isTab || item.is_tab) {
    uni.switchTab({
      url: item.url
    });
  } else {
    uni.navigateTo({
      url: item.url,
      fail: (err) => {
        console.error('Navigation failed:', err);
        uni.showToast({
          title: '页面开发中',
          icon: 'none'
        });
      }
    });
  }
};
const correctRate = ref(85);
const currentLevel = ref('学霸');

// 主题状态
const isDarkMode = ref(false);

// 状态栏高度
const statusBarHeight = ref(0);

// 轮播图数据
const bannerList = ref([]);

// 文章列表数据
const articleList = ref([]);

// 公告相关
const notices = ref([]);
const showNoticeModal = ref(false);
const currentNotice = ref(null);

// 获取深色版本的颜色（用于文字）
const getDarkerColor = (color) => {
  if (!color) return '#333';
  
  // 简单映射常见背景色到深色
  const colorMap = {
    '#e3f2fd': '#1976d2', // 浅蓝 -> 深蓝
    '#e8f5e9': '#2e7d32', // 浅绿 -> 深绿
    '#fce4ec': '#c2185b', // 浅粉 -> 深粉
    '#fff3e0': '#ef6c00', // 浅橙 -> 深橙
    '#f3e5f5': '#7b1fa2', // 浅紫 -> 深紫
    '#e0f7fa': '#0097a7', // 浅青 -> 深青
  };
  
  // 如果在映射中则返回，否则尝试简单的颜色加深逻辑（或返回原色）
  if (colorMap[color.toLowerCase()]) {
    return colorMap[color.toLowerCase()];
  }
  
  // 默认返回一个较深的灰色或原色
  return '#444'; 
};

// 初始化状态
onMounted(async () => {
  // 检查版本更新
  checkUpdate();
  
  // 获取系统信息
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 0;
  
  // 检查登录状态
  checkLoginStatus();
  
  // 加载导航科目
  loadNavSubjects();
  
  // 获取用户信息（仅登录时）
  if (isLoggedIn.value) {
    try {
      const res = await instance.appContext.config.globalProperties.$api.userApi.getUserInfo();
      if (res.code === 0) {
        practiceDays.value = res.data.studyDays || 0;
        totalQuestions.value = res.data.totalQuestions || 0;
        studyDays.value = res.data.studyDays || 0;
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  }
  
  // 从本地存储获取当前主题模式，默认白天模式
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
  
  // 监听主题变化事件
  uni.$on('themeChange', (darkMode) => {
    isDarkMode.value = darkMode;
  });
  
  // 监听轮播图变化事件
  uni.$on('bannerChange', () => {
    initBanners();
  });

  // 监听文章变化事件
  uni.$on('articleChange', () => {
    initArticles();
  });
  
  // 监听公告变化事件
  uni.$on('noticeChange', () => {
    initNotices();
  });
  
  // 监听刷题计数更新事件
  uni.$on('updateTodayStats', (stats) => {
    console.log('收到刷题计数更新:', stats);
    if (stats) {
      todayStats.value = stats;
    }
  });
  
  // 监听头像更新事件
  uni.$on('avatarUpdated', async () => {
    if (isLoggedIn.value) {
      await loadAllHomeData();
    }
  });

  // 初始化轮播图数据
  initBanners();

  // 初始化文章列表数据
  initArticles();
  
  // 初始化考试列表
  examList.value = originalExamList.value;
  
  // 初始化公告数据
  initNotices();
  
  // 初始化倒计时配置
  initCountdownConfig();
  
  // 初始化签到数据
  initCheckinData();
  
  // 初始化精选刷题卡片
  initHomepageCards();
  
  // 加载首页概览数据
  loadAllHomeData();
  
  // 加载最近练习科目列表
  loadPracticeProgressList();
});

// 页面卸载时取消事件监听
onUnmounted(() => {
  uni.$off('themeChange');
  uni.$off('bannerChange');
  uni.$off('articleChange');
  uni.$off('noticeChange');
  uni.$off('avatarUpdated');
});

// 页面显示时刷新数据
onShow(() => {
  // 重新检查登录状态（解决页面缓存问题）
  checkLoginStatus();
  loadPracticeProgressList();
  loadAllHomeData();
  // 刷新首页卡片数据
  initHomepageCards();
});

// 检查版本更新
const checkUpdate = () => {
  // #ifdef MP-WEIXIN
  if (wx.getUpdateManager) {
    updateManager = wx.getUpdateManager();
    
    // 监听版本检查结果
    updateManager.onCheckForUpdate((res) => {
      console.log('版本检查结果：', res);
      // res.hasUpdate 为 true 表示有新版本
    });
    
    // 监听新版本下载完成
    updateManager.onUpdateReady(() => {
      console.log('新版本下载完成');
      showUpdateModal.value = true;
    });
    
    // 监听新版本下载失败
    updateManager.onUpdateFailed(() => {
      console.log('新版本下载失败');
      uni.showToast({
        title: '新版本下载失败，请稍后重试',
        icon: 'none'
      });
    });
  } else {
    // 低版本微信客户端提示
    uni.showToast({
      title: '当前微信版本过低，无法检查更新',
      icon: 'none'
    });
  }
  // #endif
};

// 暂不更新
const handleRefuseUpdate = () => {
  showUpdateModal.value = false;
};

// 立即更新
const handleUpdate = () => {
  if (updateManager) {
    updateManager.applyUpdate();
  }
};

// 初始化公告数据
const initNotices = () => {
  // 从本地存储获取公告数据
  const savedNotices = uni.getStorageSync('notices');
  if (savedNotices && savedNotices.length > 0) {
    notices.value = savedNotices;
    // 获取所有启用的公告
    const activeNotices = notices.value.filter(notice => notice.isActive);
    if (activeNotices.length > 0) {
      // 检查今天是否已经显示过公告
      const today = new Date().toDateString();
      const lastNoticeDate = uni.getStorageSync('lastNoticeDate');
      if (lastNoticeDate !== today) {
        // 随机选择一个启用的公告
        const randomIndex = Math.floor(Math.random() * activeNotices.length);
        showNoticeModal.value = true;
        currentNotice.value = activeNotices[randomIndex];
        // 保存今天的日期
        uni.setStorageSync('lastNoticeDate', today);
      }
    }
  }
};

// 关闭公告弹窗
const closeNoticeModal = () => {
  showNoticeModal.value = false;
  currentNotice.value = null;
};

// 监听弹窗状态，控制页面滚动
watch(showNoticeModal, (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});

// 处理广告点击
const handleAdClick = () => {
  if (currentNotice.value && currentNotice.value.linkUrl) {
    // 如果是链接，跳转到链接
    if (currentNotice.value.linkUrl.startsWith('http')) {
      window.open(currentNotice.value.linkUrl);
    } else {
      // 如果是页面路径，跳转到页面
      uni.navigateTo({
        url: currentNotice.value.linkUrl
      });
    }
  }
  closeNoticeModal();
};
</script>

<style>
/* 确保页面可以滚动 */
page {
  width: 100%;
  min-height: 100%;
}

.container {
  background-color: #f5f5f5;
  min-height: 100vh;
  padding-bottom: 50px; /* 为底部 TabBar 预留空间 */
  box-sizing: border-box;
  position: relative;
  z-index: 0;
  scroll-behavior: smooth;
}

/* 轮播图 */
.banner {
  width: calc(100% - 20rpx);
  height: 228rpx;
  margin: 0 10rpx 8rpx;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
  position: relative;
  z-index: 5; /* 确保在普通内容之上，但在导航栏之下 */
}

.banner-item {
  width: 100%;
  height: 100%;
  position: relative;
}

.banner-img {
  width: 100%;
  height: 100%;
  border-radius: 24rpx;
  display: block;
  pointer-events: auto; /* 确保图片能接收点击 */
}

.banner ::v-deep .uni-swiper-dot {
  background: rgba(255, 255, 255, 0.3) !important; /* 更浅更透明 */
}

.banner ::v-deep .uni-swiper-dot-active {
  background: rgba(255, 255, 255, 0.8) !important;
}

/* 顶部数据区域样式 */
.top-data-section {
  display: flex;
  margin: 8rpx 12rpx; /* 进一步减小左右间距 */
  gap: 8rpx; /* 间距改为4px(8rpx) */
}

.top-left-column {
  flex: 1.3; /* 宽度再大一些 */
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.stats-row {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10rpx);
  -webkit-backdrop-filter: blur(10rpx);
  border-radius: 20rpx;
  padding: 12rpx 10rpx;
  display: flex;
  align-items: flex-end;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.03);
  border: 1rpx solid rgba(0,0,0,0.01);
  width: 100%;
  box-sizing: border-box;
}

.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
  padding: 8rpx 0;
}

.stat-value {
  font-size: 32rpx; /* 进一步减小字体以适应三列 */
  font-weight: bold;
  color: #333;
  display: flex;
  align-items: baseline;
}

.today-week {
  font-size: 32rpx;
  white-space: nowrap;
}

.today-date {
  font-size: 18rpx;
  color: #888;
}

.stat-unit {
  font-size: 16rpx;
  color: #999;
  margin-left: 2rpx;
}

.stat-label {
  font-size: 18rpx;
  color: #888;
  margin-top: 2rpx;
}

.stat-date {
  display: none; /* 移除原来的日期显示，已合并到第一列 */
}

.stat-divider {
  width: 1rpx;
  height: 30rpx; /* 减小高度 */
  background: #eee;
  margin: 0 10rpx; /* 减小间距 */
}

.signed-badge {
  position: absolute;
  top: -30rpx;
  right: -10rpx;
  background: #ff5252;
  color: #fff;
  font-size: 16rpx;
  padding: 2rpx 10rpx;
  border-radius: 20rpx;
  transform: scale(0.8);
}

/* 最近在学网格 - 修改为一行一个，展示8行 */
.recent-learning-grid {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  background-color: var(--border-color);
  border-radius: 16rpx;
  overflow: hidden;
  border: 1rpx solid var(--border-color);
  margin-top: 20rpx;
}

.recent-learning-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  background-color: var(--card-background);
  transition: background-color 0.2s;
}

.recent-learning-item:active {
  background-color: #f9f9f9;
}

.recent-learning-item.is-current {
  background-color: #fffaf2;
}

.item-left {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.item-icon-box {
  width: 80rpx;
  height: 80rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
  position: relative;
}

.current-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 6rpx;
  height: 40rpx;
  background-color: #ff9800;
  border-radius: 0 4rpx 4rpx 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.current-badge {
  font-size: 20rpx;
  color: #ff9800;
  background-color: rgba(255, 152, 0, 0.1);
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  font-weight: normal;
}

.status-learning {
  color: #ff9800;
  font-weight: 500;
  font-style: italic;
}

.item-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 6rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-desc {
  font-size: 24rpx;
  color: #9e9e9e;
}

.item-right {
  display: flex;
  align-items: center;
  margin-left: 20rpx;
}

.item-time {
  font-size: 22rpx;
  color: #bdbdbd;
  margin-right: 12rpx;
}

.item-arrow {
  font-size: 24rpx;
  color: #cccccc;
  font-family: monospace;
}

.is-current .item-title {
  color: #ff9800;
}

.is-current .item-desc {
  color: #ffa726;
}

.placeholder {
  opacity: 0.6;
}

.item-title.empty {
  color: #bdbdbd;
  font-weight: normal;
}

.item-desc.empty {
  color: #e0e0e0;
}

.item-icon-box.empty {
  background-color: #fafafa;
}

/* 动画效果保持不变 */
.current-pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}

/* 当前在刷卡片样式 */
.current-card {
  flex: none;
  width: 280rpx;
  background: rgba(255, 243, 224, 0.8);
  backdrop-filter: blur(10rpx);
  -webkit-backdrop-filter: blur(10rpx);
  border-radius: 20rpx;
  padding: 12rpx 10rpx;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4rpx 20rpx rgba(255, 152, 0, 0.05);
  border: 1rpx solid rgba(255, 152, 0, 0.05);
  min-height: 110rpx;
  justify-content: center;
  box-sizing: border-box;
}

.current-header {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx; /* 减少下方间距 */
}

.current-indicator {
  width: 12rpx;
  height: 12rpx;
  background-color: var(--primary-color);
  border-radius: 50%;
}

.current-pulse {
  background-color: #ff9800;
  box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.4);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 10rpx rgba(255, 152, 0, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 152, 0, 0);
  }
}

.is-current {
  border: 2rpx solid #ff9800 !important;
  background-color: rgba(255, 152, 0, 0.05) !important;
}

.current-label {
  font-size: 24rpx;
  color: #855e00;
  font-weight: 500;
}

.current-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0rpx; /* 移除负边距 */
}

.current-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
  position: relative;
  min-width: 0;
  width: 100%;
}

.current-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #f57c00;
  white-space: nowrap;
  line-height: 1;
  animation: scroll-left 10s linear infinite;
  display: flex;
  flex-direction: row;
  width: max-content;
}

.title-text {
  display: block;
  padding-right: 80rpx;
  flex-shrink: 0;
}

.title-text.duplicate {
  display: block;
}

@keyframes scroll-left {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

.current-status {
  font-size: 14rpx; /* 减小字体 */
  color: #ff9800;
  margin-top: 4rpx; /* 调整上方间距 */
}

.current-progress {
  font-size: 16rpx;
  color: #ff9800;
  margin-top: 4rpx;
  font-weight: 500;
}

.current-card .svg-icon {
  transform: rotate(-20deg) scale(0.9); /* 初始旋转并缩小一点 */
  transition: all 0.3s;
  margin-left: 6rpx;
}

.current-card:active .svg-icon {
  transform: rotate(0deg) scale(1.1);
}

.dark-mode .stats-card-section {
  background-color: #1a1a1a;
}
.dark-mode .stats-num {
  color: #ff8787;
}
.dark-mode .stats-label, .dark-mode .countdown-note {
  color: #aaa;
}

.banner-link {
  display: block;
  width: 100%;
  height: 100%;
}

.banner-img {
  width: 100%;
  height: 100%;
  border-radius: 16rpx;
}

/* 文字轮播 */
.text-carousel-section {
  margin: 8rpx 12rpx 12rpx; /* 统一左右外边距为12rpx，与 selection-section 保持一致 */
  overflow: hidden;
  background-color: rgba(229, 57, 53, 0.1); /* 背景色稍微深一点 */
  border-radius: 12rpx;
  border: 1rpx solid rgba(229, 57, 53, 0.15);
}

.text-carousel {
  height: 48rpx;
  width: 100%;
}

.text-carousel-item {
  height: 48rpx;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: transparent; /* 项目背景透明，改由容器控制或仅文字颜色变换 */
  padding: 0 20rpx;
  overflow: hidden;
}

.carousel-content {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
}

.article-tag-svg {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8rpx;
  flex-shrink: 0;
}

/* 喇叭图标 */
.speaker-icon {
  width: 28rpx;
  height: 20rpx;
  position: relative;
  display: flex;
  align-items: center;
  margin-right: 8rpx;
}

/* 喇叭握柄 */
.speaker-body {
  width: 8rpx;
  height: 10rpx;
  background: #f34d4d;
  border-radius: 2rpx;
}

/* 喇叭口 */
.speaker-cone {
  position: absolute;
  left: 6rpx;
  width: 0;
  height: 0;
  border-top: 10rpx solid transparent;
  border-bottom: 10rpx solid transparent;
  border-left: 14rpx solid #f34d4d;
}

/* 声音波纹 */
.speaker-sound {
  position: absolute;
  right: 0;
  width: 6rpx;
  height: 14rpx;
  border: 2rpx solid #f34d4d;
  border-left: none;
  border-radius: 0 50% 50% 0;
}

.article-tag {
  font-size: 20rpx;
  color: #e53935;
  font-weight: 500;
  margin-right: 8rpx;
}

.article-title {
  font-size: 22rpx;
  color: #e53935; /* 保持红色字体 */
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.article-arrow {
  display: none;
}

/* 强制隐藏 swiper 指示点，即使组件设置了 false */
::v-deep .uni-swiper-dots,
::v-deep .uni-swiper-dots-vertical,
::v-deep .uni-swiper-dot,
.uni-swiper-dots,
.uni-swiper-dots-vertical,
.uni-swiper-dot {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  width: 0 !important;
  height: 0 !important;
}

/* 微信小程序特殊处理 */
.text-carousel ::v-deep .uni-swiper-dots {
  display: flex !important;
  right: 10rpx !important;
}

.text-carousel ::v-deep .uni-swiper-dot {
  width: 12rpx !important;
  height: 12rpx !important;
  background: rgba(255, 255, 255, 0.5) !important;
  border-radius: 50% !important;
  margin: 0 6rpx !important;
}

.text-carousel ::v-deep .uni-swiper-dot-active {
  background: #ffffff !important;
}

.carousel-icons {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-left: 20rpx;
}

.icon-question {
  font-size: 36rpx;
  transform: scaleX(-1);
}

.icon-book {
  font-size: 36rpx;
}

/* 夜间模式下的文字轮播样式 */
.dark-mode .text-carousel-item {
  background-color: #3d2d2d;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
}

.dark-mode .article-title {
  color: #ff8787;
}

/* 精选刷题区域 */
.selection-section {
  padding: 12rpx 12rpx 8rpx;
  margin: 0 12rpx 8rpx;
  background: #ffffff; /* 容器改为白色 */
  border-radius: 28rpx;
  touch-action: pan-x; /* 明确允许水平滑动，优化触控板体验 */
}

/* 精选单独区域 */
.selected-section {
  padding: 20rpx 20rpx 8rpx;
  margin: 0 12rpx 20rpx;
  background: #ffffff;
  border-radius: 28rpx;
}

.selected-section .section-header {
  padding: 0 8rpx;
  margin-bottom: 20rpx;
}

.selected-section .section-title {
  margin-bottom: 0;
}

.selection-tabs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
  padding: 0 8rpx;
}

.tabs-left {
  display: flex;
  align-items: flex-end;
  gap: 30rpx;
}

.tab-item {
  position: relative;
  padding-bottom: 8rpx;
}

.tab-text {
  font-size: 28rpx;
  color: #666;
  transition: all 0.3s;
}

.tab-item.active .tab-text {
  font-size: 34rpx;
  font-weight: bold;
  color: #e53935; /* 文字颜色与公告栏保持一致 */
}

.tab-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 6rpx;
  background: #e53935; /* 线条颜色也同步 */
  border-radius: 3rpx;
}

.selection-swiper {
  /* 移除固定高度，改由 selectionSwiperHeight 动态控制 */
  width: 100%;
}

.selection-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
  padding: 8rpx 4rpx; /* 增加一点上下内边距 */
}

.selection-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  background-color: #ffffff; /* 移除 !important，允许内联样式覆盖 */
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
  transition: all 0.3s;
  overflow: hidden;
  height: 90rpx;
  border: 1rpx solid #f0f0f0;
  justify-content: center;
}

.selection-card:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.03);
}

.card-content {
  display: flex; 
  flex-direction: column;
  z-index: 1;
  justify-content: center;
}

.card-title {
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 6rpx;
  position: relative;
  z-index: 1;
  /* 移除这里的 color: #333; 让 inline style 生效 */
}

.card-desc {
  font-size: 20rpx;
  color: #999; /* 描述文字保持淡灰色 */
  z-index: 1;
}

.card-text-icon {
  position: absolute;
  right: -15rpx;
  bottom: -15rpx;
  font-size: 64rpx;
  font-weight: 900;
  transform: rotate(-15deg);
  z-index: 0;
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.card-image {
  position: absolute;
  right: 10rpx;
  bottom: 10rpx;
  width: 80rpx;
  height: 80rpx;
  opacity: 0.8;
}

.selection-card:hover .card-text-icon {
  transform: rotate(-10deg) scale(1.1);
  color: rgba(0, 0, 0, 0.05);
}

.card-icon {
  font-size: 40rpx;
}

/* 刷题卡片样式 */
.current-practice-section {
  margin: 24rpx 32rpx;
}

.current-practice-card {
  background: #fff3e0;
  border-radius: 20rpx;
  padding: 24rpx 32rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4rpx 12rpx rgba(255, 152, 0, 0.1);
}

.practice-info {
  display: flex;
  flex-direction: column;
}

.practice-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #f57c00;
  margin-bottom: 8rpx;
}

.practice-status {
  font-size: 22rpx;
  color: #ff9800;
  background-color: rgba(255, 152, 0, 0.1);
  padding: 4rpx 12rpx;
  border-radius: 10rpx;
  align-self: flex-start;
}

/* 夜间模式适配 */
.dark-mode .selection-section,
.dark-mode .selected-section {
  background-color: #1a1a1a;
}

.dark-mode .selection-card {
  opacity: 0.9;
}

.dark-mode .card-desc {
  color: #aaa;
}

.dark-mode .tab-text {
  color: #666;
}

.dark-mode .tab-item.active .tab-text {
  color: #eee;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 20rpx;
  transition: all 0.3s ease;
}

/* 功能卡片 */
.feature-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.feature-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30rpx 20rpx;
  background-color: #f9f9f9;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.feature-card:active {
  transform: scale(0.98);
}

.card-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 16rpx;
  margin-bottom: 15rpx;
}

.sequence-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.random-icon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.special-icon {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.wrong-icon {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.card-title-generic {
  font-size: 28rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 8rpx;
  transition: all 0.3s ease;
}

.card-desc {
  font-size: 22rpx;
  color: #999999;
  transition: all 0.3s ease;
}

/* 考试中心 */
.exam-section {
  padding: 20rpx 30rpx;
  background-color: #fff;
  margin-bottom: 8rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333333;
}

.section-more {
  font-size: 22rpx;
  color: #5c6bc0;
}

.exam-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.exam-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx;
  background-color: #fcfcfc;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.02);
  border: 1rpx solid rgba(0, 0, 0, 0.01);
}

.exam-info {
  flex: 1;
}

.exam-title {
  font-size: 26rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 4rpx;
}

.exam-meta {
  font-size: 20rpx;
  color: #999999;
}

.exam-btn {
  padding: 10rpx 24rpx;
  background-color: #5c6bc0;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 500;
  border-radius: 30rpx;
}

/* 学习数据 */
.stats-section {
  padding: 30rpx;
  background-color: #ffffff;
  margin: 20rpx;
  border-radius: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.stats-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
  padding-bottom: 16rpx;
  border-bottom: 2rpx solid #f0f0f0;
}

.stats-section .section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
  position: relative;
  padding-left: 20rpx;
}

.stats-section .section-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 6rpx;
  height: 28rpx;
  background: linear-gradient(135deg, #2196f3 0%, #4caf50 100%);
  border-radius: 3rpx;
}

.stats-section .section-subtitle {
  font-size: 22rpx;
  color: #999999;
  padding: 6rpx 16rpx;
  background: linear-gradient(135deg, #2196f3 0%, #4caf50 100%);
  color: #ffffff;
  border-radius: 20rpx;
  font-weight: 500;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
  margin-bottom: 30rpx;
}

.stat-card-new {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-radius: 20rpx;
  background-color: #f8f9fa;
  transition: transform 0.2s;
}

.stat-card-new:active {
  transform: scale(0.98);
}

.stat-card-new.accuracy {
  background: linear-gradient(135deg, #e8f5e9 0%, #ffffff 100%);
  border-left: 8rpx solid #4caf50;
}

.stat-card-new.questions {
  background: linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%);
  border-left: 8rpx solid #2196f3;
}

.card-icon-box {
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.card-info {
  display: flex;
  flex-direction: column;
}

.card-value {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.card-label {
  font-size: 22rpx;
  color: #666;
  margin-top: 4rpx;
}

/* 统计图表 */
.history-chart-card {
  background-color: #f8f9fa;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-top: 24rpx;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.chart-title {
  font-size: 26rpx;
  color: #333;
  font-weight: bold;
}

.chart-period-selector {
  display: flex;
  background-color: #eee;
  border-radius: 30rpx;
  padding: 4rpx;
}

.chart-period-btn {
  padding: 6rpx 20rpx;
  font-size: 20rpx;
  color: #666;
  border-radius: 26rpx;
  transition: all 0.3s;
}

.chart-period-btn.active {
  background-color: #ffffff;
  color: #5c6bc0;
  font-weight: bold;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.chart-unit {
  font-size: 20rpx;
  color: #999;
}

.chart-body {
  display: flex;
  height: 240rpx;
}

.chart-y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-right: 16rpx;
  font-size: 20rpx;
  color: #999;
  text-align: right;
  width: 50rpx;
  border-right: 2rpx solid #eee;
}

.chart-content {
  flex: 1;
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  padding-left: 20rpx;
}

.chart-bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
}

.bar-wrapper {
  flex: 1;
  width: 30rpx;
  background-color: #f0f0f0;
  border-radius: 15rpx 15rpx 0 0;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.bar-value {
  width: 100%;
  background: linear-gradient(to top, #5c6bc0, #8e99f3);
  border-radius: 15rpx 15rpx 0 0;
  min-height: 4rpx;
  position: relative;
  transition: height 0.3s ease;
}

.bar-tooltip {
  position: absolute;
  top: -36rpx;
  left: 50%;
  transform: translateX(-50%);
  font-size: 18rpx;
  color: #5c6bc0;
  font-weight: bold;
  white-space: nowrap;
}

.bar-label {
  margin-top: 12rpx;
  font-size: 20rpx;
  color: #999;
}

/* 排行榜 */
.leaderboard-container {
  background-color: #f8f9fa;
  border-radius: 24rpx;
  padding: 24rpx;
}

.leaderboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.leaderboard-title {
  display: flex;
  align-items: center;
}

.leaderboard-title .title-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-left: 12rpx;
}

.leaderboard-periods {
  display: flex;
  background-color: #eee;
  border-radius: 30rpx;
  padding: 4rpx;
}

.period-item {
  padding: 8rpx 24rpx;
  font-size: 22rpx;
  color: #666;
  border-radius: 26rpx;
  transition: all 0.3s;
}

.period-item.active {
  background-color: #ffffff;
  color: #5c6bc0;
  font-weight: bold;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

/* 我的排名卡片 */
.my-rank-card {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #5c6bc0 0%, #3f51b5 100%);
  padding: 24rpx;
  border-radius: 20rpx;
  margin-bottom: 24rpx;
  color: #ffffff;
  box-shadow: 0 6rpx 16rpx rgba(92, 107, 192, 0.3);
}

.rank-badge {
  width: 64rpx;
  height: 64rpx;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.rank-num {
  font-size: 28rpx;
  font-weight: bold;
}

.rank-info {
  flex: 1;
}

.rank-label {
  font-size: 20rpx;
  opacity: 0.8;
  display: block;
}

.rank-status {
  font-size: 24rpx;
  font-weight: 500;
}

.rank-score-box {
  text-align: right;
  margin-right: 16rpx;
}

.score-num {
  font-size: 40rpx;
  font-weight: bold;
}

.score-unit {
  font-size: 20rpx;
  margin-left: 4rpx;
  opacity: 0.8;
}

.leaderboard-list {
  display: flex;
  flex-direction: column;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #eee;
}

.leaderboard-item:last-child {
  border-bottom: none;
}

.rank-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #999;
  width: 60rpx;
  display: flex;
  justify-content: center;
}

.rank-text.top-rank {
  font-size: 32rpx;
  color: #2196f3;
}

.user-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  margin-right: 20rpx;
  border: 2rpx solid #fff;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  display: block;
}

.user-level-tag {
  display: inline-block;
  font-size: 18rpx;
  background-color: #ff9800;
  color: #fff;
  padding: 2rpx 10rpx;
  border-radius: 20rpx;
  margin-top: 4rpx;
}

.user-score {
  text-align: right;
}

.score-val {
  font-size: 32rpx;
  font-weight: bold;
  color: #5c6bc0;
}

.score-unit {
  font-size: 20rpx;
  color: #999;
  margin-left: 4rpx;
}

.leaderboard-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 24rpx;
  font-size: 24rpx;
  color: #666;
}

.leaderboard-footer text {
  margin-right: 8rpx;
}

/* 夜间模式样式 */
.dark-mode {
  background-color: #1a1a1a;
}

.dark-mode .container {
  background-color: #1a1a1a;
}

.dark-mode .feature-section,
.dark-mode .exam-section,
.dark-mode .stats-section {
  background-color: #2d2d2d;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
}

.dark-mode .stats-section .section-header {
  border-bottom-color: #3d3d3d;
}

.dark-mode .stats-section .section-title {
  color: #e5e7eb;
}

.dark-mode .stats-section .section-subtitle {
  background: linear-gradient(135deg, #2196f3 0%, #4caf50 100%);
  color: #ffffff;
}

.dark-mode .section-title {
  color: #ffffff;
}

.dark-mode .feature-card,
.dark-mode .exam-item,
.dark-mode .stat-card-new,
.dark-mode .leaderboard-container {
  background-color: #3d3d3d;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
}

.dark-mode .stat-card-new.accuracy,
.dark-mode .stat-card-new.questions {
  background: #3d3d3d;
}

.dark-mode .card-value,
.dark-mode .leaderboard-title .title-text,
.dark-mode .user-name {
  color: #ffffff;
}

.dark-mode .card-label,
.dark-mode .score-unit {
  color: #aaaaaa;
}

.dark-mode .leaderboard-periods {
  background-color: #2d2d2d;
}

.dark-mode .period-item {
  color: #888;
}

.dark-mode .period-item.active {
  background-color: #4d4d4d;
  color: #6666ff;
}

.dark-mode .user-value {
  color: #6666ff;
}

.dark-mode .card-title-generic,
.dark-mode .exam-title {
  color: #ffffff;
}

.dark-mode .card-desc,
.dark-mode .exam-meta,
.dark-mode .stat-label {
  color: #cccccc;
}

.dark-mode .section-more {
  color: #6666ff;
}

.dark-mode .exam-btn {
  background-color: #6666ff;
}

.dark-mode .stat-value {
  color: #6666ff;
}

/* 自定义picker样式 */
.picker-container {
  width: 100%;
}

.picker-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  background-color: #f5f5f5;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #333333;
  transition: all 0.3s ease;
}

.picker-content:active {
  background-color: #e0e0e0;
}

.picker-arrow {
  font-size: 20rpx;
  color: #999999;
  margin-left: 20rpx;
}

/* 弹出式选择器样式 */
.picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 998;
}

/* 深色模式下的picker样式 */
.dark-mode .picker-content {
  background-color: #3d3d3d;
  color: #ffffff;
}

.dark-mode .picker-content:active {
  background-color: #4a4a4a;
}

.dark-mode .picker-arrow {
  color: #cccccc;
}

/* 开始刷题按钮样式 */
.start-practice-section {
  padding: 30rpx;
  background-color: #ffffff;
  margin: 20rpx;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  text-align: center;
}

.start-practice-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  font-size: 32rpx;
  font-weight: bold;
  border: none;
  border-radius: 44rpx;
  box-shadow: 0 4rpx 16rpx rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
}

.start-practice-btn:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 8rpx rgba(102, 126, 234, 0.3);
}

/* 深色模式下的开始刷题按钮样式 */
.dark-mode .start-practice-section {
  background-color: #2d2d2d;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
}

.dark-mode .start-practice-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4rpx 16rpx rgba(102, 126, 234, 0.5);
}

.dark-mode .start-practice-btn:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 8rpx rgba(102, 126, 234, 0.4);
}

/* 空状态样式 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60rpx 20rpx;
  text-align: center;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
  opacity: 0.5;
}

.empty-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #999999;
  margin-bottom: 10rpx;
}

.empty-hint {
  font-size: 24rpx;
  color: #cccccc;
}

/* 公告弹窗样式 */
.notice-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 998;
  transition: all 0.3s ease;
}

.notice-modal {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: 90%;
  max-width: 900rpx;
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 20rpx;
  padding: 30rpx;
  max-height: 85vh;
  overflow-y: auto;
  z-index: 999;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10rpx);
}

.notice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.1);
}

.notice-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
}

.notice-close {
  font-size: 60rpx;
  color: #666666;
  font-weight: bold;
  transition: all 0.3s ease;
  cursor: pointer;
}

.ad-close-btn {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  width: 80rpx;
  height: 80rpx;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60rpx;
  color: #ffffff;
  font-weight: bold;
  cursor: pointer;
  z-index: 10;
  backdrop-filter: blur(4rpx);
}

.notice-close:active {
  opacity: 0.8;
  transform: scale(0.95);
}

.ad-close-btn:active {
  opacity: 0.8;
  transform: scale(0.95);
}

.notice-content {
  flex: 1;
  overflow-y: auto;
  font-size: 28rpx;
  color: #666666;
  line-height: 1.6;
  margin-bottom: 30rpx;
  padding-right: 10rpx;
}

.ad-image {
  width: 100%;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  display: block;
  max-height: 60vh;
  object-fit: contain;
}

.text-content {
  color: #666666;
  line-height: 1.6;
}

.notice-footer {
  padding-top: 20rpx;
  border-top: 1rpx solid rgba(0, 0, 0, 0.1);
  text-align: center;
}

.notice-btn {
  padding: 8rpx 16rpx;
  background-color: #007aff;
  color: #ffffff;
  border: none;
  border-radius: 8rpx;
  font-size: 24rpx;
  font-weight: bold;
  min-height: auto;
  height: auto;
  transition: all 0.3s ease;
}

.ad-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.ad-modal {
  max-width: 95%;
  position: relative;
  padding: 0;
  overflow: visible;
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
}

.ad-modal .notice-content {
  padding: 0;
  overflow: visible;
}

.ad-modal .notice-footer {
  padding: 30rpx;
  padding-top: 20rpx;
}

.notice-btn:active {
  opacity: 0.8;
  transform: scale(0.98);
}

/* 深色模式下的公告弹窗样式 */
.dark-mode .notice-modal {
  background-color: rgba(45, 45, 45, 0.95);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10rpx);
}

.dark-mode .notice-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .notice-title {
  color: #ffffff;
}

.dark-mode .notice-close {
  color: #cccccc;
}

.dark-mode .notice-content {
  color: #cccccc;
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .notice-footer {
  border-top-color: rgba(255, 255, 255, 0.1);
}

/* 版本更新弹窗样式 */
.update-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.update-content {
  background: #fff;
  border-radius: 16rpx;
  width: 80%;
  max-width: 600rpx;
  padding: 40rpx;
}

.update-title {
  font-size: 36rpx;
  font-weight: 700;
  text-align: center;
  margin-bottom: 30rpx;
  color: #333;
}

.update-body {
  margin-bottom: 40rpx;
}

.update-text {
  font-size: 30rpx;
  color: #666;
  line-height: 1.6;
  display: block;
  text-align: center;
}

.update-actions {
  display: flex;
  gap: 20rpx;
}

.update-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.update-btn.cancel {
  background: #f5f5f5;
  color: #666;
}

.update-btn.confirm {
  background: #4a90e2;
  color: #fff;
}

.dark-mode .update-content {
  background: #2c2c2c;
}

.dark-mode .update-title {
  color: #fff;
}

.dark-mode .update-text {
  color: #ccc;
}

.dark-mode .update-btn.cancel {
  background: #444;
  color: #ccc;
}
</style>
