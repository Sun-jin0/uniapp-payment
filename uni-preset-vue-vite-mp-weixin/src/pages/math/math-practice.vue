<template>
  <view class="app-container">
    <main class="main-content">
      <!-- 获取试卷区域 -->
      <section class="get-paper-section">
        <div class="section-header">
          <h2>获取试卷</h2>
          <p class="section-desc">输入分享码获取他人分享的试卷</p>
        </div>
        <div class="code-input-area">
          <input 
            v-model="shareCode" 
            type="text" 
            placeholder="请输入7位分享码" 
            maxlength="7"
            class="code-input"
          />
          <button class="get-paper-btn" :disabled="!shareCode || shareCode.length < 7" @click="handleGetPaperByCode">
            获取
          </button>
        </div>
      </section>

      <!-- 试卷Tab区域 -->
      <section class="bookshelf-section paper-tabs-section">
        <!-- Tab头部 -->
        <div class="paper-tabs-header">
          <div class="tabs-left">
            <div class="tab-item" :class="{ active: activePaperTab === 'my' }" @click="activePaperTab = 'my'">
              <view class="tab-text" :class="{ 'active-text': activePaperTab === 'my' }">我的</view>
              <view class="tab-line" v-if="activePaperTab === 'my'"></view>
            </div>
            <div class="tab-item" :class="{ active: activePaperTab === 'shared' }" @click="activePaperTab = 'shared'">
              <view class="tab-text" :class="{ 'active-text': activePaperTab === 'shared' }">共享</view>
              <view class="tab-line" v-if="activePaperTab === 'shared'"></view>
            </div>
            <div class="tab-item" :class="{ active: activePaperTab === 'weekly' }" @click="activePaperTab = 'weekly'">
              <view class="tab-text" :class="{ 'active-text': activePaperTab === 'weekly' }">周测</view>
              <view class="tab-line" v-if="activePaperTab === 'weekly'"></view>
            </div>
          </div>
          <span class="count-badge" :class="activePaperTab === 'weekly' ? 'weekly-badge' : (activePaperTab === 'shared' ? 'shared-badge' : '')">
            {{ currentTabCount }} 份
          </span>
        </div>
        
        <!-- 试卷列表 - 使用swiper实现滑动切换 -->
        <swiper class="paper-swiper" :current="currentSwiperIndex" @change="onPaperTabChange">
          <!-- 我的试卷 -->
          <swiper-item>
            <scroll-view scroll-y class="paper-list-scroll">
              <view class="paper-list">
                <view v-for="paper in myPapers" :key="paper.PaperID" class="paper-item style-teal" @click="goToPaper(paper)">
                  <view class="paper-content">
                    <view class="icon-box paper-icon-box teal-bg">
                      <view class="inner-icon paper-scroll"></view>
                    </view>
                    <view class="paper-info">
                      <view class="paper-title">{{ paper.Title }}</view>
                      <view class="paper-meta">
                        <text class="meta-date">{{ formatDate(paper.CreatedAt) }}</text>
                      </view>
                    </view>
                    <view class="paper-arrow">❯</view>
                  </view>
                </view>
                <view v-if="myPapers.length === 0" class="empty-section">
                  <view class="empty-icon empty-my-icon"></view>
                  <text class="empty-text">暂无试卷</text>
                  <text class="empty-tip">去智能组卷页面创建属于你的试卷</text>
                </view>
              </view>
            </scroll-view>
          </swiper-item>
          
          <!-- 共享试卷（非周测） -->
          <swiper-item>
            <scroll-view scroll-y class="paper-list-scroll">
              <view class="paper-list">
                <view v-for="paper in sharedPapers" :key="paper.PaperID" class="paper-item style-orange" @click="goToPaper(paper)">
                  <view class="paper-content">
                    <view class="icon-box paper-icon-box orange-bg">
                      <view class="inner-icon paper-share"></view>
                    </view>
                    <view class="paper-info">
                      <view class="paper-title">{{ paper.Title }}</view>
                      <view class="paper-meta">
                        <text class="meta-source">来自: {{ paper.originalAuthor || '未知' }}</text>
                      </view>
                    </view>
                    <view class="paper-arrow">❯</view>
                  </view>
                </view>
                <view v-if="sharedPapers.length === 0" class="empty-section">
                  <view class="empty-icon empty-shared-icon"></view>
                  <text class="empty-text">暂无共享试卷</text>
                  <text class="empty-tip">输入分享码获取他人分享的试卷</text>
                </view>
              </view>
            </scroll-view>
          </swiper-item>
          
          <!-- 周测试卷 -->
          <swiper-item>
            <scroll-view scroll-y class="paper-list-scroll">
              <view class="paper-list">
                <view v-for="paper in weeklyTestPapers" :key="paper.PaperID" class="paper-item style-purple" @click="goToPaper(paper)">
                  <view class="paper-content">
                    <view class="icon-box paper-icon-box purple-bg">
                      <view class="inner-icon paper-weekly"></view>
                    </view>
                    <view class="paper-info">
                      <view class="paper-title">{{ paper.Title }}</view>
                      <view class="paper-meta">
                        <text class="meta-source">来自: {{ paper.originalAuthor || '未知' }}</text>
                      </view>
                    </view>
                    <view class="paper-arrow">❯</view>
                  </view>
                </view>
                <view v-if="weeklyTestPapers.length === 0" class="empty-section">
                  <view class="empty-icon empty-weekly-icon"></view>
                  <text class="empty-text">暂无周测试卷</text>
                  <text class="empty-tip">周测试卷将显示在这里</text>
                </view>
              </view>
            </scroll-view>
          </swiper-item>
        </swiper>
      </section>

      <!-- 原生模板广告 -->
      <!-- #ifdef MP-WEIXIN -->
      <view class="ad-container">
        <ad-custom 
          unit-id="adunit-2960f0cf4755f417" 
          @load="adLoad" 
          @error="adError" 
          @close="adClose"
        ></ad-custom>
      </view>
      <!-- #endif -->

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>正在加载...</p>
      </div>
    </main>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { request } from '../../api/request';

const allPapers = ref([]);
const loading = ref(false);
const shareCode = ref('');

// 试卷Tab相关 - 默认我的试卷
const activePaperTab = ref('my');

// 原生模板广告事件监听
const adLoad = () => {
  console.log('原生模板广告加载成功');
};

const adError = (err) => {
  console.error('原生模板广告加载失败', err);
};

const adClose = () => {
  console.log('原生模板广告关闭');
};

// 计算当前swiper索引
const currentSwiperIndex = computed(() => {
  const map = { 'my': 0, 'shared': 1, 'weekly': 2 };
  return map[activePaperTab.value] || 0;
});

// 计算当前Tab的试卷数量
const currentTabCount = computed(() => {
  switch (activePaperTab.value) {
    case 'my': return myPapers.value.length;
    case 'shared': return sharedPapers.value.length;
    case 'weekly': return weeklyTestPapers.value.length;
    default: return 0;
  }
});

// 处理swiper切换事件
const onPaperTabChange = (e) => {
  const current = e.detail.current;
  const map = { 0: 'my', 1: 'shared', 2: 'weekly' };
  activePaperTab.value = map[current] || 'my';
};

// 我的试卷（自己创建的）
const myPapers = computed(() => {
  return allPapers.value.filter(p => !isShared(p));
});

// 共享试卷（通过分享获取的，且不是周测）
const sharedPapers = computed(() => {
  return allPapers.value.filter(p => isShared(p) && !isWeeklyTest(p));
});

// 周测试卷（通过分享获取的，且是周测）
const weeklyTestPapers = computed(() => {
  return allPapers.value.filter(p => isShared(p) && isWeeklyTest(p));
});

// 判断是否为共享试卷（处理数字和布尔值）
const isShared = (paper) => {
  return paper.IsShared === 1 || paper.IsShared === true;
};

// 判断是否为周测试卷（处理数字和布尔值）
const isWeeklyTest = (paper) => {
  return paper.IsWeeklyTest === 1 || paper.IsWeeklyTest === true;
};

// 获取我的组卷列表
const fetchMyPapers = async () => {
  loading.value = true;
  try {
    const response = await request({
      url: '/math/smart-papers',
      method: 'GET'
    });
    if (response.code === 0 || response.code === 200) {
      allPapers.value = response.data || [];
      // 调试日志
      console.log('获取到的试卷:', allPapers.value);
      allPapers.value.forEach(p => {
        console.log(`试卷: ${p.Title}, IsShared: ${p.IsShared}, IsWeeklyTest: ${p.IsWeeklyTest}, 类型: ${typeof p.IsWeeklyTest}`);
      });
    }
  } catch (error) {
    console.error('获取组卷列表失败:', error);
  } finally {
    loading.value = false;
  }
};

// 通过分享码获取试卷（先预览，再确认保存）
const handleGetPaperByCode = async () => {
  if (!shareCode.value || shareCode.value.length !== 7) {
    uni.showToast({ title: '请输入7位分享码', icon: 'none' });
    return;
  }

  console.log('开始获取试卷，分享码:', shareCode.value);
  uni.showLoading({ title: '获取中...' });

  try {
    // 第一步：查询试卷信息
    const requestUrl = `/math/paper-by-code/${shareCode.value}`;
    console.log('请求URL:', requestUrl);
    const response = await request({
      url: requestUrl,
      method: 'GET'
    });
    console.log('接口响应:', response);

    uni.hideLoading();

    if (response.code === 0 || response.code === 200) {
      const { paper, questions } = response.data;

      // 显示预览弹窗，确认是否获取
      uni.showModal({
        title: '试卷预览',
        content: `试卷：${paper.Title}\n作者：${paper.authorName || '未知'}\n题目数量：${questions.length} 题\n\n获取后将成为您的试卷，可继续分享他人。`,
        confirmText: '获取试卷',
        cancelText: '取消',
        success: async (res) => {
          if (res.confirm) {
            // 确认获取，调用保存接口
            await claimPaper(shareCode.value);
          }
        }
      });
    } else {
      uni.showToast({ title: response.message || '试卷不存在', icon: 'none' });
    }
  } catch (error) {
    uni.hideLoading();
    console.error('获取试卷失败:', error);
    uni.showToast({ title: '获取失败，请检查分享码', icon: 'none' });
  }
};

// 确认获取试卷（保存为自己的试卷）
const claimPaper = async (code) => {
  uni.showLoading({ title: '保存中...' });

  try {
    const response = await request({
      url: `/math/claim-paper/${code}`,
      method: 'POST'
    });

    uni.hideLoading();

    if (response.code === 0 || response.code === 200) {
      const { paperId, title, code: newCode, originalAuthor, questionCount } = response.data;

      uni.showModal({
        title: '获取成功',
        content: `试卷：${title}\n原作者：${originalAuthor || '未知'}\n题目数量：${questionCount} 题\n您的新分享码：${newCode}\n\n是否立即查看？`,
        confirmText: '立即查看',
        cancelText: '稍后查看',
        success: (res) => {
          if (res.confirm) {
            uni.navigateTo({
              url: `/pages/math/math-generated-paper?paperId=${paperId}`
            });
          }
          // 清空输入
          shareCode.value = '';
          // 刷新列表
          fetchMyPapers();
        }
      });
    } else {
      uni.showToast({ title: response.message || '获取失败', icon: 'none' });
    }
  } catch (error) {
    uni.hideLoading();
    console.error('保存试卷失败:', error);
    uni.showToast({ title: '保存失败: ' + (error.message || '未知错误'), icon: 'none' });
  }
};

// 跳转到试卷详情
const goToPaper = (paper) => {
  uni.navigateTo({
    url: `/pages/math/math-generated-paper?paperId=${paper.PaperID}`
  });
};

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

onShow(() => {
  fetchMyPapers();
});

onMounted(() => {
  fetchMyPapers();
});
</script>

<style scoped>
/* 原生模板广告容器 */
.ad-container {
  margin: 20rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.app-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.main-content {
  padding: 20rpx;
  padding-bottom: 40rpx;
}

/* 获取试卷区域 */
.get-paper-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.section-header {
  margin-bottom: 20rpx;
}

.section-header h2 {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 8rpx;
}

.section-desc {
  font-size: 24rpx;
  color: #999;
}

.code-input-area {
  display: flex;
  gap: 16rpx;
}

.code-input {
  flex: 1;
  height: 80rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  text-align: center;
  letter-spacing: 4rpx;
}

.code-input:focus {
  border-color: #4db6ac;
  outline: none;
}

.get-paper-btn {
  width: 140rpx;
  height: 80rpx;
  background: linear-gradient(135deg, #4db6ac, #26a69a);
  color: #fff;
  border: none;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.get-paper-btn:disabled {
  background: #e0e0e0;
  color: #999;
}

/* 试卷Tab区域 - 参考math-bookshelf样式 */
.bookshelf-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.paper-tabs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.tabs-left {
  display: flex;
  gap: 24rpx;
  align-items: flex-end;
}

.tab-item {
  position: relative;
  padding: 10rpx 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 60rpx;
}

.tab-text {
  font-size: 28rpx;
  color: #999;
  font-weight: 500;
  transition: all 0.3s;
  line-height: 1;
}

.tab-item.active .tab-text {
  color: #ff6b6b;
  font-weight: 600;
}

/* 选中时字体加大 */
.tab-text.active-text {
  font-size: 34rpx;
  font-weight: 700;
}

.tab-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 4rpx;
  background: #ff6b6b;
  border-radius: 2rpx;
}

.count-badge {
  font-size: 24rpx;
  color: #4db6ac;
  background: rgba(77, 182, 172, 0.1);
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
}

.shared-badge {
  color: #ff9800;
  background: rgba(255, 152, 0, 0.1);
}

.weekly-badge {
  color: #9c27b0;
  background: rgba(156, 39, 176, 0.1);
}

/* swiper样式 */
.paper-swiper {
  height: 600rpx;
}

.paper-list-scroll {
  height: 100%;
}

.paper-list {
  padding-bottom: 20rpx;
}

/* 试卷项样式 */
.paper-item {
  margin-bottom: 16rpx;
  border-radius: 12rpx;
  overflow: hidden;
  transition: all 0.2s;
}

.paper-item:active {
  transform: scale(0.98);
}

/* 样式类型 */
.style-teal {
  background: linear-gradient(135deg, #e0f7fa 0%, #fff 100%);
}

.style-teal:active {
  background: linear-gradient(135deg, #b2ebf2 0%, #e0f7fa 100%);
}

.style-orange {
  background: linear-gradient(135deg, #fff8e1 0%, #fff 100%);
}

.style-orange:active {
  background: linear-gradient(135deg, #ffecb3 0%, #fff8e1 100%);
}

.style-purple {
  background: linear-gradient(135deg, #f3e5f5 0%, #fff 100%);
}

.style-purple:active {
  background: linear-gradient(135deg, #e1bee7 0%, #f3e5f5 100%);
}

.paper-content {
  display: flex;
  align-items: center;
  padding: 24rpx;
  gap: 20rpx;
}

/* 图标样式 */
.icon-box {
  width: 72rpx;
  height: 72rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.teal-bg {
  background: linear-gradient(135deg, #4db6ac, #26a69a);
}

.orange-bg {
  background: linear-gradient(135deg, #ff9800, #f57c00);
}

.purple-bg {
  background: linear-gradient(135deg, #9c27b0, #7b1fa2);
}

.inner-icon {
  width: 40rpx;
  height: 40rpx;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.paper-scroll {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z'/%3E%3C/svg%3E");
}

.paper-share {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z'/%3E%3C/svg%3E");
}

.paper-weekly {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z'/%3E%3C/svg%3E");
}

.paper-info {
  flex: 1;
  min-width: 0;
}

.paper-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 10rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paper-meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
}

.meta-date {
  font-size: 24rpx;
  color: #999;
}

.meta-source {
  font-size: 24rpx;
  color: #ff9800;
}

.style-purple .meta-source {
  color: #9c27b0;
}

.paper-arrow {
  font-size: 28rpx;
  color: #ccc;
  margin-left: auto;
}

/* 空状态 */
.empty-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;
}

.empty-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  margin-bottom: 30rpx;
}

.empty-my-icon {
  background: linear-gradient(135deg, #e0f7fa, #b2ebf2);
}

.empty-shared-icon {
  background: linear-gradient(135deg, #fff8e1, #ffecb3);
}

.empty-weekly-icon {
  background: linear-gradient(135deg, #f3e5f5, #e1bee7);
}

.empty-text {
  font-size: 30rpx;
  color: #666;
  margin-bottom: 16rpx;
}

.empty-tip {
  font-size: 26rpx;
  color: #999;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx;
}

.loading-spinner {
  width: 60rpx;
  height: 60rpx;
  border: 4rpx solid #e0e0e0;
  border-top-color: #4db6ac;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20rpx;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
