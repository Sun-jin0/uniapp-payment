<template>
  <view class="history-page">
    <!-- 顶部导航 -->
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text class="iconfont icon-arrow-left"></text>
      </view>
      <text class="title">打卡记录</text>
      <view class="placeholder"></view>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-section">
      <view class="stats-card">
        <view class="stats-item">
          <text class="stats-value">{{ totalCheckins }}</text>
          <text class="stats-label">累计打卡</text>
        </view>
        <view class="stats-divider"></view>
        <view class="stats-item">
          <text class="stats-value">{{ consecutiveDays }}</text>
          <text class="stats-label">连续打卡</text>
        </view>
        <view class="stats-divider"></view>
        <view class="stats-item">
          <text class="stats-value">{{ currentMonthDays }}</text>
          <text class="stats-label">本月打卡</text>
        </view>
      </view>
    </view>

    <!-- 日历视图 -->
    <view class="calendar-section">
      <view class="calendar-header">
        <text class="calendar-title">{{ currentYear }}年{{ currentMonth }}月</text>
        <view class="calendar-nav">
          <text class="nav-btn" @click="changeMonth(-1)">‹</text>
          <text class="nav-btn" @click="changeMonth(1)">›</text>
        </view>
      </view>
      <view class="calendar-weekdays">
        <text v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day" class="weekday">{{ day }}</text>
      </view>
      <view class="calendar-days">
        <view 
          v-for="(day, index) in calendarDays" 
          :key="index"
          class="day-cell"
          :class="{ 
            'other-month': !day.isCurrentMonth, 
            'checked': day.isChecked,
            'today': day.isToday 
          }"
        >
          <text class="day-number">{{ day.date }}</text>
          <view v-if="day.isChecked" class="check-dot"></view>
        </view>
      </view>
    </view>

    <!-- 打卡记录列表 -->
    <view class="records-section">
      <view class="section-header">
        <text class="section-title">打卡明细</text>
        <view class="filter-tabs">
          <text 
            class="filter-tab" 
            :class="{ active: filterType === 'all' }"
            @click="filterType = 'all'"
          >全部</text>
          <text 
            class="filter-tab" 
            :class="{ active: filterType === 'study' }"
            @click="filterType = 'study'"
          >刷题</text>
          <text 
            class="filter-tab" 
            :class="{ active: filterType === 'custom' }"
            @click="filterType = 'custom'"
          >自定义</text>
        </view>
      </view>

      <view class="records-list">
        <view 
          class="record-item" 
          v-for="record in filteredRecords" 
          :key="record.id"
        >
          <view class="record-date">
            <text class="date-day">{{ formatDay(record.checkinDate) }}</text>
            <text class="date-month">{{ formatMonth(record.checkinDate) }}</text>
          </view>
          <view class="record-content">
            <view class="record-header">
              <view class="record-type-tag" :class="record.checkinType">
                {{ record.checkinType === 'study' ? '刷题打卡' : '自定义打卡' }}
              </view>
              <text class="record-time">{{ formatTime(record.checkinTime) }}</text>
            </view>
            <view class="record-body" v-if="record.studyCount > 0">
              <text class="study-info">今日刷了 <text class="highlight">{{ record.studyCount }}</text> 道题</text>
            </view>
            <view class="record-body" v-if="record.content">
              <text class="content-text">{{ record.content }}</text>
            </view>
            <view class="record-images" v-if="record.images && record.images.length > 0">
              <image 
                v-for="(img, idx) in record.images.slice(0, 3)" 
                :key="idx"
                class="record-image" 
                :src="img" 
                mode="aspectFill"
                @click="previewImage(record.images, idx)"
              />
              <view v-if="record.images.length > 3" class="more-images">
                <text class="more-text">+{{ record.images.length - 3 }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 加载更多 -->
      <view class="load-more" v-if="hasMore">
        <text class="load-text" @click="loadMore">加载更多</text>
      </view>
      <view class="no-more" v-else-if="records.length > 0">
        <text class="no-more-text">没有更多了</text>
      </view>
      <view class="empty-state" v-else>
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无打卡记录</text>
        <text class="empty-tip">快去打卡记录你的学习吧！</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, getCurrentInstance } from 'vue';

const instance = getCurrentInstance();

// 数据
const records = ref([]);
const totalCheckins = ref(0);
const consecutiveDays = ref(0);
const currentMonthDays = ref(0);
const filterType = ref('all');
const currentPage = ref(1);
const hasMore = ref(true);
const pageSize = 20;

// 日历数据
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth() + 1);
const checkedDates = ref([]);

// 计算属性
const filteredRecords = computed(() => {
  if (filterType.value === 'all') return records.value;
  return records.value.filter(r => r.checkinType === filterType.value);
});

const calendarDays = computed(() => {
  const days = [];
  const firstDay = new Date(currentYear.value, currentMonth.value - 1, 1);
  const lastDay = new Date(currentYear.value, currentMonth.value, 0);
  const prevLastDay = new Date(currentYear.value, currentMonth.value - 1, 0);
  
  // 上月剩余天数
  const firstDayWeek = firstDay.getDay();
  for (let i = firstDayWeek - 1; i >= 0; i--) {
    days.push({
      date: prevLastDay.getDate() - i,
      isCurrentMonth: false,
      isChecked: false,
      isToday: false
    });
  }
  
  // 当月天数
  const today = new Date();
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const dateStr = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    days.push({
      date: i,
      isCurrentMonth: true,
      isChecked: checkedDates.value.includes(dateStr),
      isToday: today.getFullYear() === currentYear.value && 
               today.getMonth() + 1 === currentMonth.value && 
               today.getDate() === i
    });
  }
  
  // 下月开始天数
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: i,
      isCurrentMonth: false,
      isChecked: false,
      isToday: false
    });
  }
  
  return days;
});

// 加载打卡记录
const loadRecords = async (isLoadMore = false) => {
  if (!isLoadMore) {
    currentPage.value = 1;
    records.value = [];
  }
  
  try {
    const res = await instance.appContext.config.globalProperties.$api.checkinApi.getCustomCheckinRecords({
      page: currentPage.value,
      limit: pageSize
    });
    
    if (res.code === 0) {
      const newRecords = res.data.records.map(r => ({
        ...r,
        images: r.images || []
      }));
      
      if (isLoadMore) {
        records.value.push(...newRecords);
      } else {
        records.value = newRecords;
      }
      
      totalCheckins.value = res.data.total;
      hasMore.value = newRecords.length === pageSize;
      
      // 提取打卡日期用于日历显示
      checkedDates.value = records.value.map(r => r.checkinDate);
      
      // 计算本月打卡天数
      const currentMonthStr = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}`;
      currentMonthDays.value = records.value.filter(r => r.checkinDate.startsWith(currentMonthStr)).length;
    }
  } catch (error) {
    console.error('加载打卡记录失败:', error);
  }
};

// 加载更多
const loadMore = () => {
  currentPage.value++;
  loadRecords(true);
};

// 切换月份
const changeMonth = (delta) => {
  let newMonth = currentMonth.value + delta;
  let newYear = currentYear.value;
  
  if (newMonth > 12) {
    newMonth = 1;
    newYear++;
  } else if (newMonth < 1) {
    newMonth = 12;
    newYear--;
  }
  
  currentMonth.value = newMonth;
  currentYear.value = newYear;
};

// 格式化日期
const formatDay = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.getDate();
};

const formatMonth = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

// 预览图片
const previewImage = (urls, current) => {
  uni.previewImage({
    urls: urls,
    current: urls[current]
  });
};

// 返回
const goBack = () => {
  uni.navigateBack();
};

onMounted(() => {
  loadRecords();
});
</script>

<style scoped>
.history-page {
  min-height: 100vh;
  background: #f8f9fa;
}

/* 顶部导航 */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 30rpx;
  background: #fff;
  border-bottom: 1rpx solid #f0f0f0;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1f2937;
}

.placeholder {
  width: 60rpx;
}

/* 统计区域 */
.stats-section {
  padding: 30rpx;
}

.stats-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: #fff;
  padding: 40rpx 20rpx;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.stats-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stats-value {
  font-size: 44rpx;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 10rpx;
}

.stats-label {
  font-size: 26rpx;
  color: #6b7280;
}

.stats-divider {
  width: 2rpx;
  height: 60rpx;
  background: #e5e7eb;
}

/* 日历区域 */
.calendar-section {
  background: #fff;
  margin: 0 30rpx 30rpx;
  padding: 30rpx;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.calendar-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
}

.calendar-nav {
  display: flex;
  gap: 20rpx;
}

.nav-btn {
  width: 50rpx;
  height: 50rpx;
  background: #f3f4f6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #4b5563;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 20rpx;
}

.weekday {
  font-size: 26rpx;
  color: #9ca3af;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10rpx;
}

.day-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  position: relative;
}

.day-cell.other-month {
  opacity: 0.3;
}

.day-cell.today {
  background: rgba(102, 126, 234, 0.1);
}

.day-cell.today .day-number {
  color: #667eea;
  font-weight: 600;
}

.day-cell.checked {
  background: #667eea;
}

.day-cell.checked .day-number {
  color: #fff;
}

.day-number {
  font-size: 28rpx;
  color: #4b5563;
}

.check-dot {
  width: 8rpx;
  height: 8rpx;
  background: #10b981;
  border-radius: 50%;
  position: absolute;
  bottom: 8rpx;
}

/* 记录区域 */
.records-section {
  background: #fff;
  margin: 0 30rpx;
  padding: 30rpx;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  min-height: 400rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
}

.filter-tabs {
  display: flex;
  gap: 15rpx;
}

.filter-tab {
  padding: 10rpx 24rpx;
  background: #f3f4f6;
  border-radius: 30rpx;
  font-size: 26rpx;
  color: #6b7280;
  transition: all 0.3s;
}

.filter-tab.active {
  background: #667eea;
  color: #fff;
}

/* 记录列表 */
.records-list {
  display: flex;
  flex-direction: column;
  gap: 25rpx;
}

.record-item {
  display: flex;
  gap: 25rpx;
  padding: 25rpx;
  background: #f9fafb;
  border-radius: 16rpx;
}

.record-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 100rpx;
  padding: 15rpx;
  background: #fff;
  border-radius: 12rpx;
  border: 2rpx solid #e5e7eb;
}

.date-day {
  font-size: 40rpx;
  font-weight: 700;
  color: #667eea;
}

.date-month {
  font-size: 24rpx;
  color: #9ca3af;
}

.record-content {
  flex: 1;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15rpx;
}

.record-type-tag {
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
}

.record-type-tag.study {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
}

.record-type-tag.custom {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.record-time {
  font-size: 24rpx;
  color: #9ca3af;
}

.record-body {
  margin-bottom: 15rpx;
}

.study-info {
  font-size: 30rpx;
  color: #1f2937;
}

.study-info .highlight {
  color: #667eea;
  font-weight: 600;
}

.content-text {
  font-size: 28rpx;
  color: #4b5563;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.record-images {
  display: flex;
  gap: 15rpx;
}

.record-image {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
}

.more-images {
  width: 120rpx;
  height: 120rpx;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.more-text {
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
}

/* 加载更多 */
.load-more, .no-more {
  text-align: center;
  padding: 40rpx 0;
}

.load-text {
  font-size: 28rpx;
  color: #667eea;
}

.no-more-text {
  font-size: 26rpx;
  color: #9ca3af;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 30rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #4b5563;
  margin-bottom: 15rpx;
}

.empty-tip {
  font-size: 26rpx;
  color: #9ca3af;
}
</style>
