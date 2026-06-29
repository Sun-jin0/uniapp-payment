<template>
  <view class="container">
    <!-- 内容区域 -->
    <view class="content">
      <view 
        v-for="(section, index) in sections" 
        :key="section.id" 
        class="section"
        :class="'section-' + (index % 5 + 1)"
      >
        <view class="section-header" @click="toggleSection(section.id)">
          <view class="section-title-wrapper">
            <view class="section-indicator"></view>
            <view class="section-title">{{ section.name }}</view>
          </view>
          <view class="section-toggle" :class="{ expanded: expandedSections.has(section.id) }">
            <view class="arrow"></view>
          </view>
        </view>

        <view v-if="expandedSections.has(section.id)" class="section-content expanded">
          <view class="grid">
            <view 
              v-for="(book, bIndex) in section.books" 
              :key="book.id" 
              class="grid-item"
              @click="goToBook(book)"
            >
              <view class="item-text">{{ book.title || book.name || '未命名书籍' }}</view>
              <view class="item-arrow"></view>
            </view>
            <view v-if="!section.books || section.books.length === 0" class="empty-hint">
              暂无书籍
            </view>
          </view>
        </view>

        <view v-else class="section-content collapsed">
          <view class="grid">
            <view
              v-for="(book, bIndex) in getVisibleBooks(section)"
              :key="book.id"
              class="grid-item"
              @click="goToBook(book)"
            >
              <view class="item-text">{{ book.title || book.name || '未命名书籍' }}</view>
              <view class="item-arrow"></view>
            </view>
            <view v-if="!section.books || section.books.length === 0" class="empty-hint">
              暂无书籍
            </view>
          </view>
          
          <!-- 查看更多按钮 - 当书籍数量超过显示行数时显示 -->
          <view 
            v-if="section.books && section.books.length > (section.display_rows || 1) * 2" 
            class="more-btn"
            @click.stop="toggleSection(section.id)"
          >
            <view>查看更多 (共{{ section.books.length }}个)</view>
          </view>
        </view>
        
        
      </view>
    </view>

    <!-- 弹窗 -->
    <view class="modal-overlay" v-if="showModal" @click="showModal = false">
      <view class="modal-content" @click.stop>
        <view class="modal-title">温馨提示</view>
        <view class="modal-body">
          <view>背诵会员包含：\n1. 全部名师背诵手册\n2. 时政专题汇总\n3. 1000题专项练习\n4. 帽子题知识卡</view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn" @click="showModal = false">我知道了</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import publicApi from '@/api/public';

// 状态栏高度
const statusBarHeight = ref(0);

// 数据列表
const sections = ref([]);
const expandedSections = ref(new Set());
const currentBottomTab = ref('recite');
const showModal = ref(false);

// 获取可见书籍（受 display_rows 限制）
const getVisibleBooks = (section) => {
  if (!section.books) return [];
  if (expandedSections.value.has(section.id)) {
    return section.books;
  }
  const maxItems = (section.display_rows || 1) * 2; // 每行2个
  return section.books.slice(0, maxItems);
};

// 获取系统信息和初始化数据
onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 0;
  
  await fetchSections();
});

// 获取政治板块
const fetchSections = async () => {
  try {
    const res = await publicApi.getPoliticsSections();
    if (res.code === 0) {
      sections.value = res.data;
    }
  } catch (error) {
    console.error('获取政治板块失败:', error);
  }
};

// 切换展开状态
const toggleSection = (id) => {
  if (expandedSections.value.has(id)) {
    expandedSections.value.delete(id);
  } else {
    expandedSections.value.add(id);
  }
};

// 底部 Tab 切换
const switchBottomTab = (tab) => {
  currentBottomTab.value = tab;
  if (tab === 'profile') {
    uni.navigateTo({ url: '/pages/politics/profile-politics' });
  } else if (tab === 'practice') {
    // 假设刷题对应某个页面，如果没定可以先提示
    uni.showToast({ title: '正在前往刷题中心', icon: 'none' });
  } else if (tab === 'discover') {
    uni.showToast({ title: '发现更多精彩内容', icon: 'none' });
  }
};

// 跳转到书籍详情或刷题
const goToBook = (book) => {
  const displayName = book.title || book.name || '未命名书籍';
  
  // 保存为最近练习科目
  const practiceItem = {
    id: `politics-book-${book.id}`,
    title: `政治 - ${displayName}`,
    url: '/pages/politics/politics-main',
    icon: 'flag'
  };
  uni.setStorageSync('lastPracticeSubject', practiceItem);

  // 根据书籍类型跳转
  if (book.type === 'knowledge_card' || displayName.includes('知识卡')) {
    uni.navigateTo({
      url: `/pages/public/public-book-list?subject=politics&categoryId=${book.categoryId}&title=${encodeURIComponent(displayName)}`
    });
  } else {
    uni.navigateTo({
      url: `/pages/public/public-book-detail?id=${book.id}&bookId=${book.id}`
    });
  }
};

</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 80px;
}

/* 顶部导航 */
.header {
  background: #fff;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.header-placeholder {
  width: 32px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  flex: 1;
  text-align: center;
}

.header-controls {
  display: flex;
  gap: 12px;
}

.control-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.icon-dots {
  font-size: 20px;
  margin-top: -8px;
}

.icon-circle {
  font-size: 18px;
}

/* 会员卡片 */
.vip-card {
  margin: 10px 16px;
  background: linear-gradient(135deg, #fff8f0 0%, #ffecd2 100%);
  border-radius: 12px;
  padding: 12px 16px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(255, 140, 0, 0.1);
}

.vip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.vip-title {
  font-size: 18px;
  font-weight: 800;
  color: #e65100;
  display: flex;
  align-items: center;
  gap: 4px;
}

.vip-badge {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: white;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  margin-left: 4px;
}

.vip-tag {
  background: rgba(255,255,255,0.9);
  color: #e65100;
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 600;
  border: 1px solid rgba(255,140,0,0.2);
}

.vip-desc {
  font-size: 13px;
  color: #bf360c;
  opacity: 0.8;
}

/* 内容区域 */
.content {
  padding: 8px 16px;
}

/* 重中之重 - 红色系 */
.section-1 .section-indicator { background: #ff4d4f; }
.section-1 .grid-item { background: #fff1f0; }
.section-1 .grid-item:active { background: #ffccc7; }
.section-1 .item-icon { background: #ff4d4f; }

/* 时政专题 - 蓝色系 */
.section-2 .section-indicator { background: #597ef7; }
.section-2 .grid-item { background: #f0f5ff; }
.section-2 .grid-item:active { background: #d6e4ff; }
.section-2 .item-icon { background: #597ef7; }

/* 1000题专项 - 绿色系 */
.section-3 .section-indicator { background: #52c41a; }
.section-3 .grid-item { background: #f6ffed; }
.section-3 .grid-item:active { background: #d9f7be; }
.section-3 .item-icon { background: #52c41a; }

/* 考点背诵汇总 - 紫色系 */
.section-4 .section-indicator { background: #722ed1; }
.section-4 .grid-item { background: #f9f0ff; }
.section-4 .grid-item:active { background: #efdbff; }
.section-4 .item-icon { background: #722ed1; }

/* 颜色映射 - 备用 */
.section-5 .section-indicator { background: #fa8c16; }
.section-5 .grid-item { background: #fff7e6; }
.section-5 .item-icon { background: #fa8c16; }

.section-6 .section-indicator { background: #13c2c2; }
.section-6 .grid-item { background: #e6fffb; }
.section-6 .item-icon { background: #13c2c2; }

/* 折叠面板 */
.section {
  background: #fff;
  border-radius: 12px;
  margin: 16px 0;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border: 1px solid rgba(0,0,0,0.05);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
}

.section-title-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-indicator {
  width: 4px;
  height: 16px;
  border-radius: 2px;
}

.section-title {
  font-size: 17px;
  font-weight: 700;
  color: #333;
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #999;
  font-size: 14px;
  transition: all 0.3s;
}

.arrow {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s;
}

.arrow::after {
  content: '';
  width: 6px;
  height: 6px;
  border-right: 2px solid #999;
  border-bottom: 2px solid #999;
  transform: rotate(45deg);
  margin-top: -2px;
}

.section-toggle.expanded .arrow {
  transform: rotate(225deg);
  margin-top: 4px;
}

.section-content {
  overflow: hidden;
  transition: all 0.3s ease-out;
  padding: 0 16px;
}

.section-content.expanded {
  padding-bottom: 16px;
}

.section-content.collapsed {
  padding: 8px 16px 12px 16px;
}

.more-btn {
  margin-top: 12px;
  text-align: center;
  padding: 8px;
  background: #f8f8f8;
  border-radius: 8px;
  color: #666;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.more-btn:active {
  background: #eee;
}

/* 网格布局 */
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.grid-item {
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.grid-item:active {
  transform: scale(0.98);
  opacity: 0.9;
}

.item-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
  flex-shrink: 0;
  font-weight: 600;
}

.item-text {
  font-size: 13px;
  color: #333;
  font-weight: 500;
  line-height: 1.4;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-arrow {
  color: #ccc;
  font-size: 14px;
  font-weight: 300;
}

.item-arrow::after {
  content: '>';
}

.empty-hint {
  grid-column: span 2;
  text-align: center;
  color: #999;
  font-size: 12px;
  padding: 20px 0;
}

/* 咨询按钮 */
.consult-btn {
  position: fixed;
  right: 16px;
  bottom: 100px;
  background: white;
  border-radius: 24px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 99;
  border: none;
  font-size: 13px;
  color: #666;
  font-weight: 500;
  line-height: 1;
}

.consult-btn::after {
  border: none;
}

.consult-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #597ef7, #722ed1);
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  width: 80%;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
}

.modal-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 16px;
  color: #333;
}

.modal-body {
  font-size: 15px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 24px;
  text-align: left;
  white-space: pre-line;
}

.modal-btn {
  background: #ff4d4f;
  color: white;
  border: none;
  padding: 0;
  height: 44px;
  line-height: 44px;
  border-radius: 22px;
  font-size: 16px;
  width: 100%;
  font-weight: bold;
}

.modal-btn::after {
  border: none;
}

/* 底部自定义TabBar */
.custom-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: #fff;
  display: flex;
  justify-content: space-around;
  align-items: center;
  border-top: 1px solid #eee;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 100;
}

.tabbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.tabbar-icon {
  font-size: 22px;
}

.tabbar-text {
  font-size: 11px;
  color: #666;
}

.tabbar-item.active .tabbar-text {
  color: #ff4d4f;
  font-weight: bold;
}

.tabbar-item.active .tabbar-icon {
  transform: scale(1.1);
  transition: transform 0.2s;
}
</style>