<template>
  <view class="container" :style="{ paddingTop: statusBarHeight + 'px' }">
    <!-- 顶部导航 -->
    <view class="nav-header">
      <view class="back-icon" @tap="goBack">
        <SvgIcon name="left" size="44" fill="#333" />
      </view>
      <view class="nav-title">西医综合</view>
      <view class="placeholder"></view>
    </view>

    <!-- 模式切换 Tabs -->
    <view class="tabs-container">
      <view 
        class="tab-item" 
        :class="{ active: currentMode === 'chapter' }"
        @tap="switchMode('chapter')"
      >
        <text>章节真题</text>
        <view class="active-line" v-if="currentMode === 'chapter'"></view>
      </view>
      <view 
        class="tab-item" 
        :class="{ active: currentMode === 'year' }"
        @tap="switchMode('year')"
      >
        <text>历年真题</text>
        <view class="active-line" v-if="currentMode === 'year'"></view>
      </view>
      <view 
        class="tab-item" 
        :class="{ active: currentMode === 'random' }"
        @tap="switchMode('random')"
      >
        <text>章节乱序</text>
        <view class="active-line" v-if="currentMode === 'random'"></view>
      </view>
    </view>

    <!-- 主体内容 -->
    <view class="main-body">
      <!-- 章节模式 -->
      <template v-if="currentMode === 'chapter' || currentMode === 'random'">
        <!-- 左侧科目边栏 -->
        <scroll-view class="sidebar" scroll-y>
          <view 
            v-for="course in courses" 
            :key="course.courseId" 
            class="sidebar-item" 
            :class="{ active: activeCourseId === course.courseId }"
            @tap="selectCourse(course)"
          >
            <text>{{ course.courseName }}</text>
            <view v-if="activeCourseId === course.courseId" class="active-bar"></view>
          </view>
        </scroll-view>

        <!-- 右侧章节内容区 -->
        <scroll-view class="content-area" scroll-y>
          <view class="course-header">
            <view class="header-left">
              <text class="course-name">{{ activeCourseName }}</text>
            </view>
            <view class="header-right">
              <text class="progress-text">{{ activeCourseProgress }}/{{ activeCourseTotal }}</text>
              <view class="progress-bar-bg">
                <view class="progress-bar-fill" :style="{ width: (activeCourseProgress / activeCourseTotal * 100) + '%' }"></view>
              </view>
            </view>
          </view>

          <view class="chapter-list">
            <view v-if="loading" class="loading-state">
              <text>加载中...</text>
            </view>
            <view v-else-if="chapters.length > 0">
              <view 
                v-for="chapter in chapters" 
                :key="chapter.chapterId" 
                class="chapter-item"
              >
                <view class="chapter-main" @tap="goToPractice(chapter, 'chapter')">
                  <view class="chapter-left">
                    <text class="chapter-name">{{ chapter.chapterName }}</text>
                  </view>
                  <view class="chapter-right">
                    <text class="count-text">{{ chapter.doneCount || 0 }}/{{ chapter.questionCount }}</text>
                    <view class="mini-progress">
                       <view class="fill" :style="{ width: (chapter.doneCount / chapter.questionCount * 100) + '%' }"></view>
                    </view>
                  </view>
                </view>
              </view>
            </view>
            <view v-else class="empty-state">
              <text>暂无章节数据</text>
            </view>
          </view>
        </scroll-view>
      </template>

      <!-- 历年模式 -->
      <template v-else-if="currentMode === 'year'">
        <scroll-view class="year-list-container" scroll-y>
          <view class="year-grid">
            <view 
              v-for="yearItem in years" 
              :key="yearItem.year" 
              class="year-item"
              @tap="goToPractice({ year: yearItem.year }, 'year')"
            >
              <view class="year-card">
                <text class="year-text">{{ yearItem.year }}年</text>
                <text class="year-sub">西医综合真题</text>
                <text class="year-count">共 {{ yearItem.questionCount }} 题</text>
                <view class="year-tag">历年真题</view>
              </view>
            </view>
          </view>
        </scroll-view>
      </template>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import medicalApi from '@/api/medical';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';

const statusBarHeight = ref(0);
const currentMode = ref('chapter'); // 'chapter' | 'year' | 'random'
const loading = ref(true);

const courses = ref([]);
const activeCourseId = ref(null);
const chapters = ref([]);
const years = ref([]);

const activeCourseName = computed(() => {
  const course = courses.value.find(c => c.courseId === activeCourseId.value);
  return course ? course.courseName : '';
});

const activeCourseTotal = computed(() => {
  const course = courses.value.find(c => c.courseId === activeCourseId.value);
  return course ? course.totalQuestionCount : 0;
});

const activeCourseProgress = computed(() => {
  const course = courses.value.find(c => c.courseId === activeCourseId.value);
  return course ? course.doneQuestionCount : 0;
});

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight;

  await fetchCourses();
  await fetchYears();
});

const fetchCourses = async () => {
  loading.value = true;
  try {
    const res = await medicalApi.getMedCourses();
    if (res.code === 0) {
      courses.value = res.data.map(c => ({
        ...c,
        courseId: c.courseId || c.course_id,
        courseName: c.courseName || c.course_name,
        totalQuestionCount: c.totalQuestionCount || c.total_question_count,
        doneQuestionCount: c.doneQuestionCount || c.done_question_count
      }));
      if (courses.value.length > 0) {
        activeCourseId.value = courses.value[0].courseId;
        await fetchChapters(activeCourseId.value);
      }
    }
  } catch (error) {
    console.error('Fetch courses failed:', error);
  } finally {
    loading.value = false;
  }
};

const fetchChapters = async (courseId) => {
  if (!courseId) return;
  try {
    const res = await medicalApi.getMedChapters({ course_id: courseId });
    if (res.code === 0) {
      chapters.value = res.data.map(ch => ({
        ...ch,
        chapterId: ch.chapterId || ch.chapter_id,
        chapterName: ch.chapterName || ch.chapter_name,
        questionCount: ch.questionCount || ch.question_count,
        isExpanded: false
      })).sort((a, b) => {
        // 提取所有数字部分进行多级排序 (例如: 第二篇 第八章 -> [2, 8])
        const numsA = extractAllNumbers(a.chapterName);
        const numsB = extractAllNumbers(b.chapterName);
        
        // 逐级比较
        const len = Math.max(numsA.length, numsB.length);
        for (let i = 0; i < len; i++) {
          const valA = numsA[i] || 0;
          const valB = numsB[i] || 0;
          if (valA !== valB) {
            return valA - valB;
          }
        }
        
        // 如果数字完全相同，再按字符串自然排序
        return a.chapterName.localeCompare(b.chapterName, undefined, { numeric: true, sensitivity: 'base' });
      });
    }
  } catch (error) {
    console.error('Fetch chapters failed:', error);
  }
};

const fetchYears = async () => {
  try {
    const res = await medicalApi.getMedYears();
    if (res.code === 0) {
      years.value = res.data;
    }
  } catch (error) {
    console.error('Fetch years failed:', error);
  }
};

const switchMode = (mode) => {
  currentMode.value = mode;
};

const selectCourse = (course) => {
  if (activeCourseId.value === course.courseId) return;
  activeCourseId.value = course.courseId;
  fetchChapters(course.courseId);
};

const goToPractice = (item, mode) => {
  // 检查是否有保存的进度
  let progressKey = null;
  if (mode === 'chapter') {
    progressKey = `med_chapter_${item.chapterId}`;
  } else if (mode === 'year') {
    progressKey = `med_year_${item.year}`;
  } else if (mode === 'random') {
    progressKey = `med_course_${activeCourseId.value}`;
  }
  
  if (progressKey) {
    const progressList = uni.getStorageSync('practiceProgressList') || [];
    const savedProgress = progressList.find(p => p.progressKey === progressKey);
    
    // 如果有保存的进度且进度中有 URL，直接跳转到刷题页面
    if (savedProgress && savedProgress.url && savedProgress.currentIndex > 1) {
      uni.navigateTo({ url: savedProgress.url });
      return;
    }
  }
  
  let url = '/pages/med/med-practice?';
  let title = '西医综合';
  if (mode === 'chapter') {
    title = item.chapterName;
    url += `courseId=${item.courseId}&chapterId=${item.chapterId}&mode=chapter&title=${title}`;
  } else if (mode === 'year') {
    title = item.year + '年真题';
    url += `year=${item.year}&mode=year&title=${title}`;
  } else if (mode === 'random') {
    title = activeCourseName.value + ' - 乱序';
    url += `courseId=${activeCourseId.value}&mode=random&title=${title}`;
  }
  
  // 更新最近练习
  const practiceItem = {
    id: item.chapterId || item.year || activeCourseId.value,
    title: title,
    icon: 'paint-brush',
    url: url,
    category: 'professional',
    progressKey
  };
  uni.setStorageSync('lastPracticeSubject', practiceItem);
  
  uni.navigateTo({ url });
};

const goBack = () => {
  uni.navigateBack();
};

// 将中文数字转换为阿拉伯数字，用于排序
const chineseToNumber = (numStr) => {
  if (!numStr) return 0;
  if (!isNaN(numStr)) return parseInt(numStr); // 如果已经是阿拉伯数字

  const chineseNums = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
    '十': 10, '百': 100, '千': 1000, '万': 10000
  };

  let result = 0;
  let temp = 0;

  for (let i = 0; i < numStr.length; i++) {
    const char = numStr[i];
    const val = chineseNums[char];

    if (val === undefined) continue;

    if (val >= 10) {
      if (temp === 0 && val === 10) temp = 1;
      result += temp * val;
      temp = 0;
    } else {
      temp = val;
    }
  }
  result += temp;
  return result;
};

// 提取字符串中所有的数字部分并转换为数组
const extractAllNumbers = (str) => {
  if (!str) return [0];
  const matches = str.match(/[一二三四五六七八九十百千万0-9]+/g);
  if (!matches) return [999];
  return matches.map(m => chineseToNumber(m));
};
</script>

<style lang="scss" scoped>
.container {
  height: 100vh;
  background-color: #f8f9fa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nav-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 20rpx;
  background-color: #fff;
  color: #333;
  .nav-title {
    font-size: 34rpx;
    font-weight: 600;
  }
  .back-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60rpx;
    height: 60rpx;
  }
  .placeholder {
    width: 60rpx;
  }
}

.tabs-container {
  display: flex;
  background-color: #fff;
  height: 90rpx;
  border-bottom: 1rpx solid #f0f0f0;
  
  .tab-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
    color: #666;
    position: relative;
    
    &.active {
      color: #4db6ac;
      font-weight: 600;
    }
    
    .active-line {
      position: absolute;
      bottom: 0;
      width: 40rpx;
      height: 4rpx;
      background-color: #4db6ac;
      border-radius: 2rpx;
    }
  }
}

.main-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 180rpx;
  background-color: #f5f5f5;
  height: 100%;
  
  .sidebar-item {
    padding: 30rpx 20rpx;
    font-size: 28rpx;
    color: #666;
    text-align: center;
    position: relative;
    
    &.active {
      background-color: #fff;
      color: #333;
      font-weight: 600;
    }
    
    .active-bar {
      position: absolute;
      left: 0;
      top: 30rpx;
      bottom: 30rpx;
      width: 6rpx;
      background-color: #4db6ac;
      border-radius: 0 4rpx 4rpx 0;
    }
  }
}

.content-area {
  flex: 1;
  background-color: #fff;
  height: 100%;
}

.course-header {
  padding: 30rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #f5f5f5;
  
  .header-left {
    display: flex;
    align-items: center;
    
    .course-name {
      font-size: 32rpx;
      font-weight: 600;
      color: #333;
    }
  }
  
  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    
    .progress-text {
      font-size: 24rpx;
      color: #999;
      margin-bottom: 8rpx;
    }
    
    .progress-bar-bg {
      width: 120rpx;
      height: 6rpx;
      background-color: #eee;
      border-radius: 3rpx;
      overflow: hidden;
      
      .progress-bar-fill {
        height: 100%;
        background-color: #4db6ac;
      }
    }
  }
}

.chapter-list {
  padding: 0 20rpx;
}

.chapter-item {
  border-bottom: 1rpx solid #f5f5f5;
  
  .chapter-main {
    padding: 30rpx 10rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    .chapter-left {
      display: flex;
      align-items: center;
      flex: 1;
      
      .chapter-name {
        font-size: 30rpx;
        color: #333;
      }
    }
    
    .chapter-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      
      .count-text {
        font-size: 22rpx;
        color: #bbb;
        margin-bottom: 6rpx;
      }
      
      .mini-progress {
        width: 80rpx;
        height: 4rpx;
        background-color: #f0f0f0;
        border-radius: 2rpx;
        overflow: hidden;
        
        .fill {
          height: 100%;
          background-color: #4db6ac;
        }
      }
    }
  }
}

.year-list-container {
  flex: 1;
  padding: 30rpx;
}

.year-grid {
  display: flex;
  flex-wrap: wrap;
  margin: 0 -15rpx;
}

.year-item {
  width: 50%;
  padding: 15rpx;
  box-sizing: border-box;
}

.year-card {
  background-color: #fff;
  border-radius: 20rpx;
  padding: 24rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.05);
  position: relative;
  overflow: hidden;
  
  .year-text {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 4rpx;
  }
  
  .year-sub {
    font-size: 22rpx;
    color: #999;
    margin-bottom: 4rpx;
  }

  .year-count {
    font-size: 20rpx;
    color: #4db6ac;
    background-color: #f0fafa;
    padding: 2rpx 12rpx;
    border-radius: 20rpx;
  }
  
  .year-tag {
    position: absolute;
    top: 0;
    right: 0;
    background-color: #e0f2f1;
    color: #4db6ac;
    font-size: 20rpx;
    padding: 4rpx 12rpx;
    border-bottom-left-radius: 12rpx;
  }
}

.loading-state, .empty-state {
  padding: 100rpx 0;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}
</style>
