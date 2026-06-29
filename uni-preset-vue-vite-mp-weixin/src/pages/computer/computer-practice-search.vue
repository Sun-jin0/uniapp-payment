<template>
  <view class="app-container">
    <view class="custom-nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">❮</text>
        </view>
        <view class="nav-title">题目搜索</view>
      </view>
    </view>

    <view class="main-content" :style="{ marginTop: (statusBarHeight + 44) + 'px' }">
      <view class="search-section">
        <view class="search-header-row">
          <text class="search-title">通过题目ID搜索</text>
          <view v-if="curatedChapterId" class="curated-context-tag">
            <text>📍 正在向章节添加题目</text>
          </view>
        </view>
        <view class="search-input-group">
          <input type="text" v-model="searchQuestionId" placeholder="输入 ID，多个 ID 用逗号隔开">
          <button @click="searchQuestion">搜索</button>
        </view>
        <text class="search-error-message" v-if="searchError">{{ searchError }}</text>
        
        <!-- 批量操作栏 -->
        <view v-if="questionList.length > 0 && curatedChapterId" class="batch-action-bar">
          <view class="selection-info">已选 {{ selectedQuestionIds.length }} 题</view>
          <button class="batch-add-btn" :disabled="selectedQuestionIds.length === 0" @click="addSelectedToCurated">
            加入当前章节
          </button>
        </view>
      </view>

      <view class="question-display-area">
        <view v-if="loading" class="message loading-message">
          <view class="loading-spinner"></view>
          <text>加载题目数据...</text>
        </view>
        <view v-else-if="error" class="message error-message">
          <text>{{ error }}</text>
        </view>
        
        <!-- 多题目列表模式 -->
        <view v-else-if="questionList.length > 0" class="question-list-container">
          <view v-for="qData in questionList" :key="qData.id" class="question-list-item-wrapper">
            <view class="item-selection-overlay" v-if="curatedChapterId">
              <checkbox :checked="selectedQuestionIds.includes(qData.id)" @click="toggleSelection(qData.id)" />
            </view>
            <view class="question-content list-mode">
              <view class="content-container">
                <view class="question-identifier">
                  <text>ID: {{ qData.id }}</text>
                  <view class="action-btns">
                    <button class="correction-btn" @click="openCorrectionModal(qData.id)">纠错</button>
                    <button v-if="curatedChapterId && !selectedQuestionIds.includes(qData.id)" class="quick-add-btn" @click="quickAddToCurated(qData.id)">快速加入</button>
                  </view>
                </view>
                <view class="stem-content" v-html="qData.first_request[0].stem"></view>
                
                <!-- 解析展开按钮 -->
                <view class="list-item-actions">
                  <button class="toggle-details-btn" @click="qData.showDetails = !qData.showDetails">
                    {{ qData.showDetails ? '收起解析' : '查看解析' }}
                  </button>
                </view>

                <!-- 展开详情 -->
                <view v-if="qData.showDetails" class="list-item-details">
                  <view class="analysis-section">
                    <view class="section-title">【答案】</view>
                    <view class="section-content">
                      <text>{{ qData.first_request[0].answer }}</text>
                    </view>
                    <view class="section-title">【解析】</view>
                    <view class="section-content">
                      <text>{{ qData.first_request[0].analysis || '暂无解析' }}</text>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { request } from '../../api/request';

const statusBarHeight = ref(0);
const searchQuestionId = ref('');
const searchError = ref('');
const loading = ref(false);
const error = ref('');
const questionList = ref([]);
const selectedQuestionIds = ref([]);
const curatedChapterId = ref(null);

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 0;

  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options || {};
  
  if (options.curatedChapterId) {
    curatedChapterId.value = options.curatedChapterId;
  }
});

const searchQuestion = async () => {
  if (!searchQuestionId.value.trim()) {
    searchError.value = '请输入题目ID';
    return;
  }

  searchError.value = '';
  loading.value = true;
  error.value = '';
  questionList.value = [];

  try {
    const res = await request({
      url: '/computer1/questions/batch-details',
      data: { questionIds: searchQuestionId.value }
    });

    if (res.code === 0) {
      const data = res.data;
      const list = [];
      for (const id in data) {
        list.push({
          id,
          ...data[id],
          showDetails: false
        });
      }
      
      if (list.length === 0) {
        error.value = '未找到相关题目';
      } else {
        questionList.value = list;

        // 保存为最近练习科目，以便在首页显示
        if (!curatedChapterId.value) {
          const ids = searchQuestionId.value.split(/[,，\s]+/).filter(id => id.trim());
          const practiceItem = {
            id: ids.length > 1 ? 'computer-search' : `computer-search-${ids[0]}`,
            title: ids.length > 1 ? `计算机 - 题目搜索 (${ids.length}题)` : `计算机 - 题目搜索 (ID: ${ids[0]})`,
            url: '/pages/computer/computer-practice-search',
            icon: 'computer'
          };
          uni.setStorageSync('lastPracticeSubject', practiceItem);
        }
      }
    } else {
      error.value = res.message || '搜索失败';
    }
  } catch (err) {
    console.error('搜索题目失败:', err);
    error.value = '网络错误，请稍后再试';
  } finally {
    loading.value = false;
  }
};

const toggleSelection = (id) => {
  const index = selectedQuestionIds.value.indexOf(id);
  if (index > -1) {
    selectedQuestionIds.value.splice(index, 1);
  } else {
    selectedQuestionIds.value.push(id);
  }
};

const quickAddToCurated = async (id) => {
  try {
    const res = await request({
      url: `/computer1/curated-chapters/${curatedChapterId.value}/questions`,
      method: 'POST',
      data: { questionIds: [id] }
    });

    if (res.code === 0) {
      uni.showToast({ title: '已加入', icon: 'success' });
      // 更新已选列表，标记为已添加
      selectedQuestionIds.value = selectedQuestionIds.value.filter(sid => sid !== id);
    }
  } catch (err) {
    uni.showToast({ title: '添加失败', icon: 'none' });
  }
};

const addSelectedToCurated = async () => {
  if (selectedQuestionIds.value.length === 0) return;

  try {
    const res = await request({
      url: `/computer1/curated-chapters/${curatedChapterId.value}/questions`,
      method: 'POST',
      data: { questionIds: selectedQuestionIds.value }
    });

    if (res.code === 0) {
      uni.showToast({ title: `成功添加 ${selectedQuestionIds.value.length} 题`, icon: 'success' });
      selectedQuestionIds.value = [];
    }
  } catch (err) {
    uni.showToast({ title: '批量添加失败', icon: 'none' });
  }
};

const openCorrectionModal = (id) => {
  uni.showModal({
    title: '题目纠错',
    editable: true,
    placeholderText: '请说明题目存在的问题...',
    success: async (res) => {
      if (res.confirm && res.content) {
        try {
          await request({
            url: '/computer1/feedback',
            method: 'POST',
            data: {
              questionId: id,
              type: '题目纠错',
              content: res.content
            }
          });
          uni.showToast({ title: '反馈已提交', icon: 'success' });
        } catch (err) {
          uni.showToast({ title: '提交失败', icon: 'none' });
        }
      }
    }
  });
};

const goBack = () => {
  uni.navigateBack();
};
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.custom-nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background-color: #ffffff;
  z-index: 100;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}

.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
}

.back-btn {
  padding: 20rpx;
  margin-left: -20rpx;
}

.back-icon {
  font-size: 36rpx;
  color: #333;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-right: 40rpx;
}

.search-section {
  padding: 30rpx;
  background-color: #fff;
  margin-bottom: 20rpx;
}

.search-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.search-header-row .search-title {
  font-size: 32rpx;
  color: #333;
  font-weight: bold;
}

.action-btns {
  display: flex;
  align-items: center;
}

.curated-context-tag {
  font-size: 24rpx;
  color: #007aff;
  background-color: #e6f2ff;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

.search-input-group {
  display: flex;
  gap: 20rpx;
}

.search-input-group input {
  flex: 1;
  height: 80rpx;
  border: 1rpx solid #ddd;
  border-radius: 8rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
}

.search-input-group button {
  width: 160rpx;
  height: 80rpx;
  background-color: #007aff;
  color: #fff;
  border: none;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.search-error-message {
  color: #ff4d4f;
  font-size: 24rpx;
  margin-top: 10rpx;
}

.batch-action-bar {
  margin-top: 30rpx;
  padding-top: 30rpx;
  border-top: 1rpx solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.selection-info {
  font-size: 28rpx;
  color: #666;
}

.batch-add-btn {
  background-color: #52c41a;
  color: #fff;
  font-size: 26rpx;
  padding: 10rpx 30rpx;
  border-radius: 30rpx;
}

.batch-add-btn:disabled {
  background-color: #ccc;
}

.question-display-area {
  padding: 0 20rpx;
}

.message {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
}

.question-list-item-wrapper {
  background-color: #fff;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  padding: 20rpx;
  display: flex;
  gap: 20rpx;
}

.question-content {
  flex: 1;
}

.question-identifier {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 24rpx;
  color: #999;
  margin-bottom: 15rpx;
}

.correction-btn, .quick-add-btn {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  margin-left: 10rpx;
}

.correction-btn {
  color: #fa8c16;
  border: 1rpx solid #fa8c16;
}

.quick-add-btn {
  color: #52c41a;
  border: 1rpx solid #52c41a;
}

.stem-content {
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
}

.list-item-actions {
  margin-top: 20rpx;
  text-align: right;
}

.toggle-details-btn {
  font-size: 24rpx;
  color: #007aff;
  background: none;
  border: none;
}

.list-item-details {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}

.analysis-section {
  font-size: 26rpx;
}

.section-title {
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.section-content {
  color: #666;
  margin-bottom: 20rpx;
  white-space: pre-wrap;
}
</style>
