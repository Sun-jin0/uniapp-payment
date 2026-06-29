<template>
  <view class="container">
    <!-- 统计卡片 -->
    <view class="stats-container" id="stats-card">
      <view class="stat-box total">
        <text class="stat-num">{{ wrongQuestions.length }}</text>
        <text class="stat-name">错题总数</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-box mastered">
        <text class="stat-num">{{ masteredCount }}</text>
        <text class="stat-name">已掌握</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-box pending">
        <text class="stat-num">{{ wrongQuestions.length - masteredCount }}</text>
        <text class="stat-name">待复习</text>
      </view>
    </view>

    <!-- 快捷操作栏 -->
    <view class="quick-actions" id="action-buttons">
      <view class="action-item" @tap="startPractice">
        <view class="action-icon primary">
          <SvgIcon name="edit" size="28" fill="#fff" />
        </view>
        <text class="action-name">顺序练习</text>
      </view>
      <view class="action-item" @tap="shufflePractice">
        <view class="action-icon secondary">
          <SvgIcon name="refresh" size="28" fill="#2196f3" />
        </view>
        <text class="action-name">随机练习</text>
      </view>
      <view class="action-item" @tap="showClearConfirm">
        <view class="action-icon danger">
          <SvgIcon name="delete" size="28" fill="#fff" />
        </view>
        <text class="action-name">清空</text>
      </view>
    </view>

    <!-- 错题列表 -->
    <scroll-view
      class="question-list"
      scroll-y
      @scrolltolower="loadMore"
      :style="{ height: scrollHeight }"
    >
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>
      <view v-else-if="wrongQuestions.length > 0" class="list-wrapper">
        <template v-for="(question, index) in wrongQuestions" :key="question.id || question.question_id">
          <view
            class="question-item"
            @tap="goToQuestion(question, index)"
          >
            <view class="item-main">
              <view class="item-left">
                <view class="num-badge">{{ index + 1 }}</view>
              </view>
              <view class="item-content">
                <view class="item-header">
                  <view class="header-left">
                    <text class="type-text">{{ getQuestionTypeLabel(question.exercise_type) }}</text>
                    <text :class="['status-tag', question.is_correct === 1 ? 'mastered' : 'pending']">
                      {{ question.is_correct === 1 ? '已掌握' : '待复习' }}
                    </text>
                  </view>
                  <text class="date-text">{{ formatDate(question.CreatedAt) }}</text>
                </view>
                <view class="item-body">
                  <rich-text class="question-title" :nodes="question.processedStem"></rich-text>
                </view>
                <view class="item-footer" v-if="question.chapter_name">
                  <text class="chapter-tag">{{ question.chapter_name }}</text>
                </view>
              </view>
            </view>
            <view class="item-action" @tap.stop="removeFromWrongBook(question)">
              <SvgIcon name="delete" size="32" fill="#ff4d4f" />
            </view>
          </view>
          <!-- 每15个显示一个广告 -->
          <!-- #ifdef MP-WEIXIN -->
          <view v-if="(index + 1) % 15 === 0" class="ad-container">
            <ad-custom 
              unit-id="adunit-f1d0e339a07022e6" 
              @load="adLoad" 
              @error="adError" 
              @close="adClose"
            ></ad-custom>
          </view>
          <!-- #endif -->
        </template>
      </view>
      <view v-else class="empty-state">
        <SvgIcon name="success" size="100" fill="#4caf50" />
        <text class="empty-title">暂无错题</text>
        <text class="empty-desc">继续保持，你很棒！</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { request } from '@/api/request';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';
import { processStem } from './utils/questionUtils';

const scrollHeight = ref('0px');
const loading = ref(true);
const wrongQuestions = ref([]);
const masteredCount = ref(0);

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

onMounted(async () => {
  await fetchWrongQuestions();
  nextTick(() => {
    calculateScrollHeight();
  });
});

const calculateScrollHeight = () => {
  const query = uni.createSelectorQuery();
  query.select('#stats-card').boundingClientRect();
  query.select('#action-buttons').boundingClientRect();

  query.exec((res) => {
    if (res[0] && res[1]) {
      const systemInfo = uni.getSystemInfoSync();
      const totalHeight = res[0].height + res[1].height;
      const windowHeight = systemInfo.windowHeight;
      scrollHeight.value = `${windowHeight - totalHeight}px`;
    } else {
      scrollHeight.value = '500px';
    }
  });
};

const fetchWrongQuestions = async () => {
  loading.value = true;
  try {
    const userId = uni.getStorageSync('userId');
    const res = await request({
      url: '/computer1/wrong-book',
      method: 'GET',
      data: { userId }
    });

    if (res.code === 0) {
      wrongQuestions.value = res.data.questions.map(q => ({
        ...q,
        processedStem: processStem(q.stem || q.question_stem || '')
      }));
      masteredCount.value = res.data.masteredCount || 0;
    }
  } catch (error) {
    console.error('获取错题本失败:', error);
    uni.showToast({ title: '获取失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const getQuestionTypeLabel = (type) => {
  const typeLabels = {
    1: '单选题',
    2: '多选题',
    3: '填空题',
    4: '解答题',
    5: '判断题',
    6: '算法题',
    7: '应用题'
  };
  return typeLabels[type] || '题目';
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';

  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const goToQuestion = (question, index) => {
  const questionId = question.question_id || question.id;
  const url = `/pages/computer/computer-practice?questionId=${questionId}&mode=wrong_book&wrongBookIndex=${index}`;
  uni.navigateTo({ url });
};

const startPractice = () => {
  if (wrongQuestions.value.length === 0) {
    uni.showToast({ title: '暂无错题', icon: 'none' });
    return;
  }
  const questionId = wrongQuestions.value[0].question_id || wrongQuestions.value[0].id;
  const url = `/pages/computer/computer-practice?questionId=${questionId}&mode=wrong_book&wrongBookIndex=0`;
  uni.navigateTo({ url });
};

const shufflePractice = () => {
  if (wrongQuestions.value.length === 0) {
    uni.showToast({ title: '暂无错题', icon: 'none' });
    return;
  }
  const shuffled = [...wrongQuestions.value].sort(() => Math.random() - 0.5);
  const questionId = shuffled[0].question_id || shuffled[0].id;

  uni.showLoading({ title: '准备中...' });
  setTimeout(() => {
    uni.hideLoading();
    const url = `/pages/computer/computer-practice?questionId=${questionId}&mode=wrong_book&shuffle=true`;
    uni.navigateTo({ url });
  }, 500);
};

const removeFromWrongBook = async (question) => {
  const questionId = question.question_id || question.id;

  uni.showModal({
    title: '确认移除',
    content: '确定要将这道题从错题本中移除吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const userId = uni.getStorageSync('userId');
          const removeRes = await request({
            url: '/computer1/wrong-book/remove',
            method: 'POST',
            data: { userId, questionId }
          });

          if (removeRes.code === 0) {
            uni.showToast({ title: '移除成功', icon: 'success' });
            await fetchWrongQuestions();
          }
        } catch (error) {
          console.error('移除错题失败:', error);
          uni.showToast({ title: '移除失败', icon: 'none' });
        }
      }
    }
  });
};

const showClearConfirm = () => {
  if (wrongQuestions.value.length === 0) {
    uni.showToast({ title: '错题本已为空', icon: 'none' });
    return;
  }

  uni.showModal({
    title: '确认清空',
    content: '确定要清空所有错题吗？此操作不可恢复！',
    confirmColor: '#ff4d4f',
    success: async (res) => {
      if (res.confirm) {
        try {
          const userId = uni.getStorageSync('userId');
          const clearRes = await request({
            url: '/computer1/wrong-book/clear',
            method: 'POST',
            data: { userId }
          });

          if (clearRes.code === 0) {
            uni.showToast({ title: '清空成功', icon: 'success' });
            await fetchWrongQuestions();
          }
        } catch (error) {
          console.error('清空错题失败:', error);
          uni.showToast({ title: '清空失败', icon: 'none' });
        }
      }
    }
  });
};

const goBack = () => {
  uni.navigateBack();
};
</script>

<style lang="scss" scoped>
/* 原生模板广告容器 */
.ad-container {
  margin: 20rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

// 统计卡片 - 简洁横向布局
.stats-container {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 16rpx 24rpx;
  margin: 16rpx 20rpx;
  background-color: #fff;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);

  .stat-box {
    display: flex;
    flex-direction: column;
    align-items: center;

    .stat-num {
      font-size: 36rpx;
      font-weight: 700;
      margin-bottom: 2rpx;
    }

    .stat-name {
      font-size: 22rpx;
      color: #999;
    }

    &.total .stat-num {
      color: #2196f3;
    }

    &.mastered .stat-num {
      color: #4caf50;
    }

    &.pending .stat-num {
      color: #ff9800;
    }
  }

  .stat-divider {
    width: 1rpx;
    height: 48rpx;
    background-color: #f0f0f0;
  }
}

// 快捷操作栏
.quick-actions {
  display: flex;
  padding: 0 20rpx 20rpx;
  gap: 20rpx;

  .action-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20rpx;
    background-color: #fff;
    border-radius: 12rpx;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);

    &:active {
      background-color: #fafafa;
    }

    .action-icon {
      width: 56rpx;
      height: 56rpx;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16rpx;

      &.primary {
        background: linear-gradient(135deg, #2196f3, #1976d2);
      }

      &.secondary {
        background-color: #e3f2fd;
      }

      &.danger {
        background: linear-gradient(135deg, #ff4d4f, #f5222d);
      }
    }

    .action-name {
      font-size: 28rpx;
      font-weight: 600;
      color: #333;
    }
  }
}

// 错题列表
.question-list {
  padding: 0 20rpx;

  .list-wrapper {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  .question-item {
    display: flex;
    align-items: stretch;
    background-color: #fff;
    border-radius: 12rpx;
    overflow: hidden;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

    &:active {
      background-color: #fafafa;
    }

    .item-main {
      flex: 1;
      display: flex;
      padding: 20rpx;
      min-width: 0;

      .item-left {
        margin-right: 16rpx;

        .num-badge {
          width: 44rpx;
          height: 44rpx;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff6b6b, #ee5a24);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22rpx;
          font-weight: 600;
          color: #fff;
        }
      }

      .item-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 12rpx;

        .item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;

          .header-left {
            display: flex;
            align-items: center;
            gap: 12rpx;

            .type-text {
              font-size: 24rpx;
              color: #2196f3;
              font-weight: 500;
            }

            .status-tag {
              padding: 2rpx 10rpx;
              border-radius: 6rpx;
              font-size: 18rpx;

              &.mastered {
                background-color: #e8f5e9;
                color: #4caf50;
              }

              &.pending {
                background-color: #fff3e0;
                color: #ff9800;
              }
            }
          }

          .date-text {
            font-size: 22rpx;
            color: #999;
          }
        }

        .item-body {
          .question-title {
            font-size: 28rpx;
            color: #333;
            line-height: 1.5;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            line-clamp: 2;
            overflow: hidden;
            word-break: break-all;

            :deep(p) {
              margin: 0;
              display: inline;
            }
          }
        }

        .item-footer {
          .chapter-tag {
            padding: 4rpx 12rpx;
            background-color: #f5f5f5;
            border-radius: 8rpx;
            font-size: 20rpx;
            color: #666;
          }
        }
      }
    }

    .item-action {
      width: 88rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      border-left: 1rpx solid #f5f5f5;

      &:active {
        background-color: #fff1f0;
      }
    }
  }
}

// 加载状态
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 100rpx;
  color: #999;
  font-size: 28rpx;
}

// 空状态
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 40rpx;

  .empty-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
    margin-top: 20rpx;
    margin-bottom: 12rpx;
  }

  .empty-desc {
    font-size: 26rpx;
    color: #999;
  }
}
</style>
