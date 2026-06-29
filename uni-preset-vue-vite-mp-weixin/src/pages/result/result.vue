<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 顶部导航栏 -->
    <view class="nav-bar">
      <view class="nav-title">考试结果</view>
    </view>
    
    <!-- 成绩卡片 -->
    <view class="result-card">
      <view class="score-section">
        <view class="score-title">本次得分</view>
        <view class="score-value">{{ score }}</view>
        <view class="score-subtitle">
          总分：{{ totalScore }}分
          <view class="pass-status" :class="isPass ? 'pass' : 'fail'">
            {{ isPass ? '已通过' : '未通过' }}
          </view>
        </view>
      </view>
      
      <!-- 分数圆环 -->
      <view class="score-circle">
        <canvas type="2d" id="scoreCanvas" class="circle-canvas" :style="{ width: canvasSize + 'rpx', height: canvasSize + 'rpx' }"></canvas>
        <view class="circle-text">
          <view class="circle-percent">{{ scorePercent }}%</view>
          <view class="circle-label">正确率</view>
        </view>
      </view>
    </view>
    
    <!-- 详细分析 -->
    <view class="analysis-section">
      <view class="section-title">详细分析</view>
      
      <!-- 题型得分 -->
      <view class="type-analysis">
        <view class="analysis-item" v-for="item in typeScores" :key="item.type">
          <view class="analysis-label">{{ item.typeLabel }}</view>
          <view class="analysis-bar">
            <view class="bar-bg"></view>
            <view class="bar-fill" :style="{ width: item.percent + '%', backgroundColor: item.color }"></view>
          </view>
          <view class="analysis-value">{{ item.score }}/{{ item.total }}</view>
        </view>
      </view>
      
      <!-- 错题分布 -->
      <view class="wrong-distribution">
        <view class="section-subtitle">错题分布</view>
        <view class="distribution-grid">
          <view class="distribution-item" v-for="item in wrongDistribution" :key="item.type">
            <view class="distribution-icon" :style="{ backgroundColor: item.color }"></view>
            <view class="distribution-label">{{ item.typeLabel }}</view>
            <view class="distribution-count">{{ item.count }}题</view>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 操作按钮 -->
    <view class="action-buttons">
      <view class="action-btn wrong-btn" @click="goToWrongBook">
        查看错题本
      </view>
      <view class="action-btn share-btn" @click="shareResult">
        分享成绩
      </view>
      <view class="action-btn again-btn" @click="restartExam">
        重新考试
      </view>
    </view>
    
    <!-- 海报生成弹窗 -->
    <view class="modal-overlay" v-if="showPosterModal" @click="closePosterModal">
      <view class="modal-content" @click.stop>
        <view class="modal-title">成绩海报</view>
        <view class="modal-body">
          <view class="poster-preview" v-if="posterImage">
            <image :src="posterImage" mode="aspectFit"></image>
          </view>
          <view class="poster-generating" v-else>
            <view class="generating-icon">⏳</view>
            <view class="generating-text">海报生成中...</view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="cancel-btn" @click="closePosterModal">关闭</button>
          <button class="save-btn" @click="savePoster">保存到相册</button>
          <button class="share-btn" @click="sharePoster">分享</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, getCurrentInstance } from 'vue';

const instance = getCurrentInstance();

// 页面参数
const examId = ref(null);
const score = ref(0);
const totalScore = ref(0);

// 画布尺寸
const canvasSize = ref(300);

// 主题状态
const isDarkMode = ref(false);

// 海报生成相关
const showPosterModal = ref(false);
const isGeneratingPoster = ref(false);
const posterImage = ref('');

// 题型得分数据
const typeScores = ref([]);

// 错题分布
const wrongDistribution = ref([]);

// 加载考试结果
const loadExamResult = async () => {
  if (!examId.value) return;
  
  try {
    const res = await instance.appContext.config.globalProperties.$api.examApi.getExamResult(examId.value);
    
    if (res.code === 0) {
      const data = res.data;
      score.value = data.score || 0;
      totalScore.value = data.totalScore || 100;
      
      // 更新题型得分
      typeScores.value = (data.typeScores || []).map(item => ({
        ...item,
        percent: item.total > 0 ? Math.round((item.score / item.total) * 100) : 0
      }));
      
      // 更新错题分布
      wrongDistribution.value = (data.wrongDistribution || []).map(item => ({
        ...item,
        count: item.count || 0
      }));
    }
  } catch (error) {
    console.error('加载考试结果失败:', error);
    uni.showToast({
      title: '加载失败',
      icon: 'none'
    });
  }
};

// 计算属性
const scorePercent = computed(() => {
  return Math.round((score.value / totalScore.value) * 100);
});

const isPass = computed(() => {
  return scorePercent.value >= 60;
});

// 获取页面参数
onMounted(async () => {
  // 获取页面参数
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  if (currentPage.options) {
    examId.value = currentPage.options.examId;
    score.value = parseInt(currentPage.options.score) || 0;
    totalScore.value = parseInt(currentPage.options.totalScore) || 100;
  }
  
  // 初始化主题状态
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';
  
  // 监听主题变化事件
  uni.$on('themeChange', (darkMode) => {
    isDarkMode.value = darkMode;
  });
  
  // 加载考试结果
  await loadExamResult();
  
  // 绘制分数圆环
  setTimeout(() => {
    drawScoreCircle();
  }, 100);
});

// 绘制分数圆环
const drawScoreCircle = () => {
  const query = uni.createSelectorQuery();
  query.select('#scoreCanvas').fields({ node: true, size: true }).exec((res) => {
    const canvas = res[0].node;
    const ctx = canvas.getContext('2d');
    
    // 设置画布尺寸
    const dpr = uni.getSystemInfoSync().pixelRatio;
    canvas.width = res[0].width * dpr;
    canvas.height = res[0].height * dpr;
    ctx.scale(dpr, dpr);
    
    const centerX = canvasSize.value / 2;
    const centerY = canvasSize.value / 2;
    const radius = (canvasSize.value - 40) / 2;
    const lineWidth = 20;
    
    // 绘制背景圆环
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    
    // 绘制得分圆环
    const percent = scorePercent.value / 100;
    const endAngle = -Math.PI / 2 + 2 * Math.PI * percent;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, endAngle, false);
    ctx.strokeStyle = isPass.value ? '#43e97b' : '#ff6b35';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
  });
};

// 查看错题本
const goToWrongBook = () => {
  uni.navigateTo({
    url: '/pages/wrongbook/wrongbook'
  });
};

// 分享成绩
const shareResult = () => {
  uni.showModal({
    title: '分享成绩',
    content: '生成成绩海报并分享给好友',
    confirmText: '生成海报',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        generatePoster();
      }
    }
  });
};

// 生成海报
const generatePoster = () => {
  isGeneratingPoster.value = true;
  
  // 模拟海报生成过程
  setTimeout(() => {
    // 生成模拟海报图片
    posterImage.value = 'https://via.placeholder.com/600x900?text=考试成绩海报';
    isGeneratingPoster.value = false;
    showPosterModal.value = true;
  }, 2000);
};

// 关闭海报弹窗
const closePosterModal = () => {
  showPosterModal.value = false;
  posterImage.value = '';
};

// 保存海报到相册
const savePoster = () => {
  uni.showLoading({
    title: '保存中...'
  });
  
  setTimeout(() => {
    uni.hideLoading();
    uni.showToast({
      title: '海报已保存到相册',
      icon: 'success'
    });
  }, 1500);
};

// 分享海报
const sharePoster = () => {
  uni.showActionSheet({
    itemList: ['分享给微信好友', '分享到朋友圈', '分享到QQ', '分享到微博'],
    success: (res) => {
      uni.showToast({
        title: '分享功能已触发',
        icon: 'success'
      });
    }
  });
};

// 重新考试
const restartExam = () => {
  uni.navigateTo({
    url: '/pages/exam/exam'
  });
};
</script>

<style>
.container {
  background-color: #f5f5f5;
  min-height: 100vh;
}

/* 导航栏 */
.nav-bar {
  height: 88rpx;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.1);
}

.nav-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
}

/* 成绩卡片 */
.result-card {
  background-color: #ffffff;
  margin: 20rpx;
  padding: 30rpx;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.score-section {
  text-align: center;
  margin-bottom: 30rpx;
}

.score-title {
  font-size: 28rpx;
  color: #666666;
  margin-bottom: 10rpx;
}

.score-value {
  font-size: 80rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 10rpx;
}

.score-subtitle {
  font-size: 24rpx;
  color: #999999;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20rpx;
}

.pass-status {
  padding: 6rpx 16rpx;
  border-radius: 16rpx;
  font-size: 20rpx;
  font-weight: bold;
}

.pass-status.pass {
  background-color: #e6f7ef;
  color: #43e97b;
}

.pass-status.fail {
  background-color: #fff0f0;
  color: #ff6b35;
}

/* 分数圆环 */
.score-circle {
  position: relative;
  margin-bottom: 30rpx;
}

.circle-canvas {
  display: block;
  margin: 0 auto;
}

.circle-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.circle-percent {
  font-size: 48rpx;
  font-weight: bold;
  color: #333333;
}

.circle-label {
  font-size: 24rpx;
  color: #999999;
  margin-top: 5rpx;
}

/* 详细分析 */
.analysis-section {
  background-color: #ffffff;
  margin: 0 20rpx 20rpx;
  padding: 30rpx;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 30rpx;
}

.section-subtitle {
  font-size: 26rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 20rpx;
}

/* 题型得分分析 */
.type-analysis {
  margin-bottom: 30rpx;
}

.analysis-item {
  display: flex;
  align-items: center;
  margin-bottom: 25rpx;
}

.analysis-label {
  width: 120rpx;
  font-size: 24rpx;
  color: #666666;
}

.analysis-bar {
  flex: 1;
  margin: 0 20rpx;
  height: 20rpx;
  background-color: #f0f0f0;
  border-radius: 10rpx;
  position: relative;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 10rpx;
  transition: width 0.5s ease;
}

.analysis-value {
  width: 80rpx;
  font-size: 24rpx;
  font-weight: bold;
  color: #333333;
  text-align: right;
}

/* 错题分布 */
.wrong-distribution {
  margin-top: 30rpx;
}

.distribution-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20rpx;
}

.distribution-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx;
  background-color: #f9f9f9;
  border-radius: 12rpx;
}

.distribution-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: 12rpx;
  margin-bottom: 15rpx;
}

.distribution-label {
  font-size: 22rpx;
  color: #666666;
  margin-bottom: 10rpx;
}

.distribution-count {
  font-size: 28rpx;
  font-weight: bold;
  color: #333333;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 30rpx 20rpx;
}

.action-btn {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 44rpx;
  font-size: 28rpx;
  font-weight: bold;
  color: #ffffff;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.action-btn:active {
  transform: scale(0.98);
}

.wrong-btn {
  background-color: #6666ff;
}

.share-btn {
  background-color: #43e97b;
}

.again-btn {
  background-color: #ff6b35;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  background-color: #ffffff;
  border-radius: 16rpx;
  width: 90%;
  max-width: 600rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
  padding: 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  text-align: center;
}

.modal-body {
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  gap: 25rpx;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
  padding: 0 30rpx 30rpx;
}

.modal-footer button {
  flex: 1;
  padding: 20rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
  font-weight: bold;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
}

.modal-footer .cancel-btn {
  background-color: #f5f5f5;
  color: #666666;
  border: 1rpx solid #e0e0e0;
}

.modal-footer .save-btn {
  background-color: #43e97b;
  color: #ffffff;
  margin-right: 15rpx;
}

.modal-footer .share-btn {
  background-color: #6666ff;
  color: #ffffff;
  margin-left: 15rpx;
}

.save-btn:active, .share-btn:active {
  transform: scale(0.98);
}

/* 海报预览样式 */
.poster-preview {
  width: 100%;
  height: 500rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 30rpx;
  background-color: #f9f9f9;
  border-radius: 12rpx;
  overflow: hidden;
}

.poster-preview image {
  width: 100%;
  height: 100%;
}

/* 海报生成中样式 */
.poster-generating {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60rpx 20rpx;
  gap: 20rpx;
}

.generating-icon {
  font-size: 64rpx;
  animation: spin 2s linear infinite;
}

.generating-text {
  font-size: 28rpx;
  color: #666666;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 夜间模式样式 */
.dark-mode {
  background-color: #1a1a1a;
}

.dark-mode .container {
  background-color: #1a1a1a;
}

.dark-mode .nav-bar {
  background-color: #2d2d2d;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.3);
}

.dark-mode .nav-title {
  color: #ffffff;
}

.dark-mode .result-card,
.dark-mode .analysis-section {
  background-color: #2d2d2d;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
}

.dark-mode .score-title,
.dark-mode .score-subtitle {
  color: #cccccc;
}

.dark-mode .score-value {
  color: #ffffff;
}

.dark-mode .circle-percent {
  color: #ffffff;
}

.dark-mode .circle-label {
  color: #cccccc;
}

.dark-mode .section-title,
.dark-mode .section-subtitle {
  color: #ffffff;
}

.dark-mode .analysis-label,
.dark-mode .analysis-value,
.dark-mode .distribution-label {
  color: #cccccc;
}

.dark-mode .analysis-bar {
  background-color: #3d3d3d;
}

.dark-mode .distribution-item {
  background-color: #3d3d3d;
}

.dark-mode .distribution-count {
  color: #ffffff;
}

/* 夜间模式下的模态框样式 */
.dark-mode .modal-content {
  background-color: #2d2d2d;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.3);
}

.dark-mode .modal-title {
  color: #ffffff;
  border-bottom-color: #404040;
}

.dark-mode .poster-preview {
  background-color: #404040;
}

.dark-mode .generating-text {
  color: #ffffff;
}

.dark-mode .modal-footer .cancel-btn {
  background-color: #404040;
  color: #cccccc;
  border-color: #555555;
}

.dark-mode .modal-footer .save-btn {
  background-color: #38d16a;
}

.dark-mode .modal-footer .share-btn {
  background-color: #5555ee;
}
</style>