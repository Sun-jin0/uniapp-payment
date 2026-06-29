<template>
  <view class="container">
    <!-- 结果头部 -->
    <view class="result-header">
      <!-- 成绩展示 -->
      <view class="score-display">
        <view class="score-circle" :class="{ pass: isPassed }">
          <text class="score-num">{{ result.total_score || 0 }}</text>
          <text class="score-label">分</text>
        </view>
        <view class="score-status" :class="{ pass: isPassed }">
          {{ isPassed ? '及格' : '未及格' }}
        </view>
        <view class="pass-line">
          及格线 {{ examInfo.pass_score || 60 }} 分
        </view>
      </view>

      <!-- 统计信息 -->
      <view class="stats-bar">
        <view class="stat-item">
          <text class="stat-num">{{ result.rank || '-' }}</text>
          <text class="stat-label">排名</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ result.duration ? Math.floor(result.duration / 60) : 0 }}'</text>
          <text class="stat-label">用时</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ answeredCount }}</text>
          <text class="stat-label">答题</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ correctCount }}</text>
          <text class="stat-label">正确</text>
        </view>
      </view>
    </view>

    <!-- 内容区域 -->
    <scroll-view class="content-area" scroll-y>
      <!-- 题型得分统计 -->
      <view class="section" v-if="questionTypeStats && Object.keys(questionTypeStats).length > 0">
        <view class="section-title">题型得分</view>
        <view class="type-stats">
          <view 
            v-for="(stats, type) in questionTypeStats" 
            :key="type"
            class="type-item"
          >
            <view class="type-header">
              <text class="type-name">{{ type }}</text>
              <text class="type-score">{{ stats.score.toFixed(1) }}/{{ stats.fullScore }}分</text>
            </view>
            <view class="type-progress">
              <view class="progress-bg">
                <view 
                  class="progress-fill"
                  :style="{ width: (stats.fullScore > 0 ? stats.score / stats.fullScore * 100 : 0) + '%' }"
                ></view>
              </view>
              <text class="progress-text">{{ stats.correct }}/{{ stats.total }} 正确</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 每题分析 -->
      <view class="section">
        <view class="section-title">
          <text>答题分析</text>
          <view class="view-mode" @tap="showAnalysis = !showAnalysis">
            <text>{{ showAnalysis ? '收起' : '展开' }}解析</text>
          </view>
        </view>
        
        <view class="question-list">
          <view 
            v-for="(item, index) in answers" 
            :key="item.question_id"
            class="question-item"
            :class="{ 
              correct: item.is_correct === 1,
              wrong: item.is_correct === 0,
              ungraded: item.is_correct === null
            }"
            @tap="toggleQuestion(index)"
          >
            <view class="question-header">
              <view class="question-num">{{ index + 1 }}</view>
              <view class="question-info">
                <text class="question-type">{{ item.exercise_type_name || item.exercise_type }}</text>
                <text class="question-score">{{ item.score }}/{{ item.question_score }}分</text>
              </view>
              <view class="question-status">
                <text v-if="item.is_correct === 1">✓</text>
                <text v-else-if="item.is_correct === 0">✗</text>
                <text v-else>待评</text>
              </view>
            </view>
            
            <!-- 展开详情 -->
            <view class="question-detail" v-if="expandedQuestions[index]">
              <view class="question-stem" v-if="item.stem">
                <RichTextContent :content="item.stem" @previewImage="previewImage" />
              </view>
              
              <!-- 答案区域（仅当没有小题时显示） -->
              <view class="answer-section" v-if="!item.subs || item.subs.length === 0">
                <view class="answer-row">
                  <text class="answer-label">你的答案：</text>
                  <view class="answer-value rich-text-content" :class="{ wrong: item.is_correct === 0 }">
                    <RichTextContent 
                      v-if="item.user_answer && item.user_answer.includes('<')" 
                      :content="item.user_answer"
                      @previewImage="previewImage"
                    />
                    <text v-else>{{ item.user_answer || '未作答' }}</text>
                  </view>
                </view>
                <view class="answer-row" v-if="item.correct_answer">
                  <text class="answer-label">正确答案：</text>
                  <view class="answer-value correct rich-text-content">
                    <RichTextContent 
                      v-if="item.correct_answer && item.correct_answer.includes('<')" 
                      :content="item.correct_answer"
                      @previewImage="previewImage"
                    />
                    <text v-else>{{ item.correct_answer }}</text>
                  </view>
                </view>
              </view>
              
              <!-- 全局统计 -->
              <view class="global-stats" v-if="item.correct_rate !== undefined">
                <view class="stat-row">
                  <text class="stat-label">正确率：</text>
                  <text class="stat-value" :class="{ low: item.correct_rate < 50 }">{{ item.correct_rate }}%</text>
                </view>
                <view class="stat-row">
                  <text class="stat-label">平均得分：</text>
                  <text class="stat-value">{{ item.average_score }}分</text>
                </view>
              </view>
              
              <!-- 解析 -->
              <!-- 小题列表（解答题） -->
              <view class="subs-section" v-if="item.subs && item.subs.length > 0">
                <view class="subs-title">小题列表</view>
                <view v-for="(sub, subIndex) in item.subs" :key="sub.sub_id || sub.id || subIndex" class="sub-item">
                  <view class="sub-header">
                    <text class="sub-index">({{ subIndex + 1 }})</text>
                    <text class="sub-score" v-if="sub.score">[{{ sub.score }}分]</text>
                  </view>
                  <view class="sub-stem" v-if="sub.stem">
                    <RichTextContent :content="sub.stem" @previewImage="previewImage" />
                  </view>
                  <view class="sub-answer-row" v-if="sub.answer">
                    <text class="answer-label">参考答案：</text>
                    <view class="answer-value correct rich-text-content">
                      <RichTextContent :content="sub.answer" @previewImage="previewImage" />
                    </view>
                  </view>
                </view>
                <!-- 显示用户的整体答案 -->
                <view class="sub-answer-row" style="margin-top: 20rpx; padding-top: 20rpx; border-top: 1rpx dashed var(--border-color);">
                  <text class="answer-label">你的答案：</text>
                  <view class="answer-value rich-text-content">
                    <RichTextContent 
                      v-if="item.user_answer && item.user_answer.includes('<')" 
                      :content="item.user_answer"
                      @previewImage="previewImage"
                    />
                    <text v-else>{{ item.user_answer || '未作答' }}</text>
                  </view>
                </view>
              </view>
              
              <!-- 解析 -->
              <view class="analysis-box" v-if="showAnalysis && item.analysis">
                <view class="analysis-title">答案解析</view>
                <RichTextContent :content="item.analysis" @previewImage="previewImage" />
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="action-section">
        <view class="action-btn primary" @tap="viewRankings">
          <text>查看排名</text>
        </view>
        <view class="action-btn" @tap="backToList">
          <text>返回考试列表</text>
        </view>
      </view>
    </scroll-view>
    
    <!-- 图片预览 -->
    <view class="image-preview-mask" v-if="showImagePreview" @click="closeImagePreview">
      <view class="image-preview-container" @click.stop>
        <image 
          class="preview-image" 
          :src="previewImageUrl" 
          mode="widthFix"
          @click="closeImagePreview"
        />
        <view class="preview-close" @click="closeImagePreview">✕</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { request } from '@/api/request';
import RichTextContent from '@/components/RichTextContent.vue';

const recordId = ref('');
const result = ref({});
const examInfo = ref({});
const answers = ref([]);
const questionTypeStats = ref({});
const showAnalysis = ref(false);
const expandedQuestions = ref({});

// 图片预览
const showImagePreview = ref(false);
const previewImageUrl = ref('');

// 图片预览功能
const previewImage = (url) => {
  console.log('previewImage被调用:', url);
  if (!url) {
    console.warn('图片URL为空');
    return;
  }
  previewImageUrl.value = url;
  showImagePreview.value = true;
  console.log('图片预览已显示:', showImagePreview.value, previewImageUrl.value);
};

const closeImagePreview = () => {
  showImagePreview.value = false;
  previewImageUrl.value = '';
};

// 是否及格
const isPassed = computed(() => {
  return result.value.is_passed === 1;
});

// 已答题数
const answeredCount = computed(() => {
  return answers.value.filter(a => a.user_answer).length;
});

// 正确题数
const correctCount = computed(() => {
  return answers.value.filter(a => a.is_correct === 1).length;
});

const examId = ref('');

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  recordId.value = currentPage.$page?.options?.recordId || currentPage.options?.recordId;
  examId.value = currentPage.$page?.options?.examId || currentPage.options?.examId;

  if (recordId.value) {
    fetchResult();
  }
});

// 获取考试结果
const fetchResult = async () => {
  try {
    uni.showLoading({ title: '加载中...' });
    
    const res = await request({
      url: `/online-exam/records/${recordId.value}/result`
    });

    if (res.code === 0) {
      result.value = res.data.record || {};
      examInfo.value = res.data.record || {};
      answers.value = res.data.answers || [];
      questionTypeStats.value = res.data.questionTypeStats || {};
      console.log('考试结果数据:', {
        record: res.data.record,
        answersCount: res.data.answers?.length,
        firstAnswer: res.data.answers?.[0],
        questionTypeStats: res.data.questionTypeStats
      });
    } else {
      console.log('获取结果失败，完整响应:', JSON.stringify(res));
      // 考试尚未完成，显示重新测试按钮
      if (res.message === '考试尚未完成') {
        // 从响应数据或URL参数获取examId
        // 注意：错误响应中，res.data 可能包含 exam_id
        let targetExamId = examId.value;
        if (res.data && typeof res.data === 'object') {
          targetExamId = res.data.exam_id || res.data.examId || examId.value;
        }
        console.log('targetExamId:', targetExamId);
        
        // 使用 confirm 代替 showModal，兼容性更好
        if (confirm('您还没有完成考试，是否继续考试？')) {
          if (targetExamId) {
            // 继续考试
            uni.redirectTo({
              url: `/pages/computer/computer-exam-detail?examId=${targetExamId}`
            });
          } else {
            uni.showToast({
              title: '无法获取考试ID',
              icon: 'none'
            });
          }
        } else {
          // 返回列表
          backToList();
        }
      } else {
        uni.showToast({
          title: res.message || '获取结果失败',
          icon: 'none'
        });
      }
    }
  } catch (error) {
    console.error('获取考试结果失败:', error);
    // 处理考试尚未完成的情况
    if (error && error.message === '考试尚未完成') {
      // 从错误数据中获取 exam_id
      let targetExamId = examId.value;
      if (error.data && typeof error.data === 'object') {
        targetExamId = error.data.exam_id || error.data.examId || examId.value;
      }
      console.log('catch中 targetExamId:', targetExamId);
      
      if (confirm('您还没有完成考试，是否继续考试？')) {
        if (targetExamId) {
          uni.redirectTo({
            url: `/pages/computer/computer-exam-detail?examId=${targetExamId}`
          });
        } else {
          uni.showToast({
            title: '无法获取考试ID',
            icon: 'none'
          });
        }
      } else {
        backToList();
      }
    } else {
      uni.showToast({
        title: (error && error.message) || '获取结果失败',
        icon: 'none'
      });
    }
  } finally {
    uni.hideLoading();
  }
};

// 展开/收起题目
const toggleQuestion = (index) => {
  expandedQuestions.value[index] = !expandedQuestions.value[index];
};

// 查看排名
const viewRankings = () => {
  uni.navigateTo({
    url: `/pages/computer/computer-exam-ranking?examId=${examInfo.value.exam_id}`
  });
};

// 返回列表
const backToList = () => {
  uni.redirectTo({
    url: '/pages/computer/computer-online-exam'
  });
};

const goBack = () => {
  uni.navigateBack();
};
</script>

<style lang="scss" scoped>
.container {
  height: 100vh;
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
}

// 结果头部
.result-header {
  background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
  padding: 16rpx;

  .score-display {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16rpx;
    padding: 16rpx;

    .score-circle {
      width: 120rpx;
      height: 120rpx;
      border-radius: 50%;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 4rpx solid #ff5252;
      box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.15);

      &.pass {
        border-color: #4caf50;
      }

      .score-num {
        font-size: 40rpx;
        font-weight: bold;
        color: #333;
      }

      .score-label {
        font-size: 22rpx;
        color: #666;
        margin-left: 4rpx;
      }
    }

    .score-status {
      font-size: 32rpx;
      font-weight: 600;
      color: #ff5252;
      padding: 8rpx 24rpx;
      background: #fff;
      border-radius: 8rpx;
      box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.15);

      &.pass {
        color: #4caf50;
      }
    }

    .pass-line {
      font-size: 22rpx;
      color: rgba(255, 255, 255, 0.9);
      background: rgba(0, 0, 0, 0.2);
      padding: 8rpx 16rpx;
      border-radius: 20rpx;
    }
  }

  .stats-bar {
    display: flex;
    justify-content: space-around;
    background: #fff;
    border-radius: 12rpx;
    padding: 16rpx;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      position: relative;
      padding: 8rpx;

      &:not(:last-child)::after {
        content: '';
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 2rpx;
        height: 40rpx;
        background: #e0e0e0;
      }

      .stat-num {
        font-size: 32rpx;
        font-weight: bold;
        color: #2196F3;
        margin-bottom: 8rpx;
      }

      .stat-label {
        font-size: 20rpx;
        color: #666;
      }
    }
  }
}

// 内容区域
.content-area {
  flex: 1;
  padding: 16rpx;
}

.section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 16rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);

  .section-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #1a1a2e;
    margin-bottom: 16rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .view-mode {
      padding: 8rpx 16rpx;
      background: #2196F3;
      border-radius: 24rpx;

      text {
        font-size: 20rpx;
        color: #fff;
      }
    }
  }
}

// 题型统计
.type-stats {
  .type-item {
    margin-bottom: 16rpx;
    padding: 20rpx;
    background: #fff;
    border-radius: 12rpx;
    border: 1rpx solid #e8e8e8;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

    &:last-child {
      margin-bottom: 0;
    }

    .type-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16rpx;

      .type-name {
        font-size: 28rpx;
        color: #333;
        font-weight: 600;
        position: relative;
        padding-left: 16rpx;

        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 6rpx;
          height: 24rpx;
          background: #2196F3;
          border-radius: 3rpx;
        }
      }

      .type-score {
        font-size: 26rpx;
        color: #2196F3;
        font-weight: 700;
        background: rgba(33, 150, 243, 0.1);
        padding: 6rpx 16rpx;
        border-radius: 20rpx;
      }
    }

    .type-progress {
      .progress-bg {
        height: 10rpx;
        background-color: #f0f0f0;
        border-radius: 5rpx;
        overflow: hidden;
        margin-bottom: 12rpx;
        position: relative;

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #42A5F5, #2196F3);
          border-radius: 5rpx;
          transition: width 0.4s ease;
          position: relative;

          &::after {
            content: '';
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            width: 20rpx;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3));
          }
        }
      }

      .progress-text {
        font-size: 22rpx;
        color: #666;
        display: flex;
        align-items: center;

        &::before {
          content: '';
          display: inline-block;
          width: 8rpx;
          height: 8rpx;
          background: #4caf50;
          border-radius: 50%;
          margin-right: 8rpx;
        }
      }
    }
  }
}

// 题目列表
.question-list {
  .question-item {
    background-color: #f8f9fa;
    border-radius: 12rpx;
    margin-bottom: 16rpx;
    overflow: hidden;
    border-left: 6rpx solid #999;
    
    &.correct {
      border-left-color: #66bb6a;
      
      .question-status {
        background-color: #66bb6a;
      }
    }
    
    &.wrong {
      border-left-color: #ff7043;
      
      .question-status {
        background-color: #ff7043;
      }
    }
    
    &.ungraded {
      border-left-color: #ffa726;
      
      .question-status {
        background-color: #ffa726;
      }
    }
    
    .question-header {
      display: flex;
      align-items: center;
      padding: 24rpx;
      
      .question-num {
        width: 48rpx;
        height: 48rpx;
        background-color: #4db6ac;
        color: #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 26rpx;
        font-weight: 600;
        margin-right: 20rpx;
      }
      
      .question-info {
        flex: 1;
        
        .question-type {
          font-size: 26rpx;
          color: #333;
          margin-right: 16rpx;
        }
        
        .question-score {
          font-size: 24rpx;
          color: #999;
        }
      }
      
      .question-status {
        width: 48rpx;
        height: 48rpx;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 24rpx;
      }
    }
    
    .question-detail {
      padding: 0 24rpx 24rpx;
      border-top: 1rpx solid #f0f0f0;
      
      .question-stem {
        padding: 20rpx 0;
        font-size: 28rpx;
        color: #333;
        line-height: 1.6;
        
        img {
          max-width: 100% !important;
          height: auto !important;
        }
      }
      
      .answer-section {
        background-color: #fff;
        border-radius: 12rpx;
        padding: 20rpx;
        margin-bottom: 20rpx;
        
        .answer-row {
          margin-bottom: 12rpx;
          
          &:last-child {
            margin-bottom: 0;
          }
          
          .answer-label {
            font-size: 26rpx;
            color: #666;
          }
          
          .answer-value {
            font-size: 28rpx;
            color: #333;
            font-weight: 500;
            margin-left: 12rpx;
            
            &.correct {
              color: #66bb6a;
            }
            
            &.wrong {
              color: #ff7043;
            }
          }
        }
      }
      
      .global-stats {
        background-color: #e6f7ff;
        border-radius: 12rpx;
        padding: 20rpx;
        margin-bottom: 20rpx;
        
        .stat-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12rpx;
          
          &:last-child {
            margin-bottom: 0;
          }
          
          .stat-label {
            font-size: 26rpx;
            color: #666;
          }
          
          .stat-value {
            font-size: 26rpx;
            color: #4db6ac;
            font-weight: 500;
            
            &.low {
              color: #ff7043;
            }
          }
        }
      }
      
      .subs-section {
        background-color: #fff;
        border-radius: 12rpx;
        padding: 16rpx;
        margin-bottom: 16rpx;
        
        .subs-title {
          font-size: 28rpx;
          font-weight: 600;
          color: #333;
          margin-bottom: 12rpx;
          padding-bottom: 8rpx;
          border-bottom: 2rpx solid #f0f0f0;
        }
        
        .sub-item {
          margin-bottom: 12rpx;
          padding: 12rpx;
          background-color: #f8f9fa;
          border-radius: 8rpx;
          
          &:last-child {
            margin-bottom: 0;
          }
          
          .sub-header {
            display: flex;
            align-items: center;
            margin-bottom: 12rpx;
            
            .sub-index {
              font-size: 28rpx;
              color: #4db6ac;
              font-weight: 600;
              margin-right: 12rpx;
            }
            
            .sub-score {
              font-size: 24rpx;
              color: #ff9800;
            }
          }
          
          .sub-stem {
            font-size: 28rpx;
            color: #333;
            line-height: 1.6;
            margin-bottom: 16rpx;
            
            img {
              max-width: 100% !important;
              height: auto !important;
            }
          }
          
          .sub-answer-row {
            margin-bottom: 12rpx;
            
            &:last-child {
              margin-bottom: 0;
            }
            
            .answer-label {
              font-size: 26rpx;
              color: #666;
            }
            
            .answer-value {
              font-size: 28rpx;
              color: #333;
              font-weight: 500;
              margin-left: 12rpx;
              
              &.correct {
                color: #66bb6a;
              }
            }
          }
        }
      }
      
      .analysis-box {
        background-color: #f6ffed;
        border-radius: 12rpx;
        padding: 20rpx;
        
        .analysis-title {
          font-size: 28rpx;
          font-weight: 600;
          color: #66bb6a;
          margin-bottom: 12rpx;
        }
      }
    }
  }
}

// 操作区域
.action-section {
  padding: 20rpx 0 40rpx;
  
  .action-btn {
    height: 88rpx;
    border-radius: 44rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20rpx;
    background-color: #f5f7fa;
    
    text {
      font-size: 30rpx;
      color: #666;
    }
    
    &.primary {
      background: linear-gradient(135deg, #4db6ac 0%, #00897b 100%);
      
      text {
        color: #fff;
        font-weight: 600;
      }
    }
    
    &:last-child {
      margin-bottom: 0;
    }
  }
}

// 富文本内容样式
.rich-text-content {
  flex: 1;
  margin-left: 12rpx;
  
  rich-text {
    font-size: 28rpx;
    line-height: 1.6;
    
    ::v-deep pre {
      background: #282c34;
      color: #abb2bf;
      padding: 16rpx;
      border-radius: 8rpx;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 24rpx;
      line-height: 1.5;
      margin: 16rpx 0;
    }
    
    ::v-deep code {
      font-family: 'Courier New', monospace;
      background: rgba(0,0,0,0.05);
      padding: 4rpx 8rpx;
      border-radius: 4rpx;
      font-size: 24rpx;
    }
    
    ::v-deep img {
      max-width: 100%;
      height: auto;
      border-radius: 8rpx;
      margin: 16rpx 0;
    }
    
    ::v-deep .latex-formula {
      background: #f0f9ff;
      padding: 8rpx 16rpx;
      border-radius: 8rpx;
      color: #1890ff;
      font-family: 'Times New Roman', serif;
      font-style: italic;
      display: inline-block;
      margin: 8rpx 0;
    }
  }
}

// 图片预览样式
.image-preview-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview-container {
  position: relative;
  width: 90%;
  max-height: 80%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 8rpx;
}

.preview-close {
  position: absolute;
  top: -60rpx;
  right: 0;
  width: 48rpx;
  height: 48rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28rpx;
  cursor: pointer;
}
</style>
