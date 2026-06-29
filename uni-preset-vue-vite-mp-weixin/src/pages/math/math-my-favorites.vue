<template>
  <view class="app-container">
    <view class="category-filter">
      <text class="category-label">分类：</text>
      <scroll-view scroll-x class="category-scroll">
        <view class="category-list">
          <view 
            class="category-tab" 
            :class="{ active: currentCategoryId === null }"
            @tap="selectCategory(null)"
          >全部</view>
          <view 
            class="category-tab" 
            v-for="cat in categories" 
            :key="cat.CategoryID"
            :class="{ active: currentCategoryId === cat.CategoryID }"
            @tap="selectCategory(cat.CategoryID)"
          >
            <text>{{ cat.Title }}</text>
            <view class="remove-tag" @tap.stop="confirmDeleteCategory(cat)">✕</view>
          </view>
          <view class="add-category-tab" @tap="showAddCategoryModal = true">＋</view>
        </view>
      </scroll-view>
    </view>

    <!-- 添加分类弹窗 -->
    <view class="modal-overlay" v-if="showAddCategoryModal" @tap="showAddCategoryModal = false">
      <view class="modal-content" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">新建收藏分类</text>
        </view>
        <view class="modal-body">
          <input 
            type="text" 
            v-model="newCategoryTitle" 
            placeholder="请输入分类名称" 
            class="category-input"
            auto-focus
          />
        </view>
        <view class="modal-footer">
          <button class="modal-btn cancel" @tap="showAddCategoryModal = false">取消</button>
          <button class="modal-btn confirm" @tap="handleAddCategory">确认</button>
        </view>
      </view>
    </view>

    <main class="main-content">
      <section class="favorites-section">
        <div class="favorites-list" v-if="favorites.length > 0">
          <div v-for="(group, bookTitle) in groupedFavorites" :key="bookTitle" class="favorite-group">
            <div class="group-header" @tap="toggleGroup(bookTitle)">
              <div class="group-icon">
                <SvgIcon name="books" size="24" fill="#666" />
              </div>
              <span class="group-title">{{ bookTitle || '未分类题目' }}</span>
              <div class="group-right">
                <span class="group-count">{{ group.length }} 题</span>
                <div class="toggle-icon" :class="{ 'collapsed': collapsedGroups[bookTitle] }">
                  <SvgIcon name="right" size="16" fill="#ccc" />
                </div>
              </div>
            </div>
            <!-- 瀑布流题目网格 -->
            <div v-if="!collapsedGroups[bookTitle]" class="fav-grid">
              <div 
                v-for="(item, idx) in group" 
                :key="item.FavoriteID" 
                class="fav-item" 
                @tap="goToQuestion(item.QuestionID)"
              >
                <!-- #ifdef H5 -->
                <img v-if="item.QuestionImg" :src="item.QuestionImg" class="fav-thumb" mode="widthFix" />
                <div v-else class="fav-no-thumb">
                  <span class="fav-type-tag">{{ item.QuestionType || '题' }}</span>
                </div>
                <!-- #endif -->
                <!-- #ifdef MP-WEIXIN -->
                <image v-if="item.QuestionImg" :src="item.QuestionImg" class="fav-thumb" mode="widthFix" />
                <view v-else class="fav-no-thumb">
                  <text class="fav-type-tag">{{ item.QuestionType || '题' }}</text>
                </view>
                <!-- #endif -->
                <view class="fav-number">{{ idx + 1 }}</view>
                <view class="fav-remove" @tap.stop="removeFromFavorites(item.QuestionID)">✕</view>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-icon">
            <SvgIcon name="star" size="56" fill="#ddd" />
          </div>
          <p>暂无收藏题目</p>
          <navigator url="/pages/math/math-bookshelf" open-type="reLaunch" class="go-study-btn">去刷题</navigator>
        </div>
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
    </main>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { request } from '../../api/request';
import { katexRenderWithRetry, parseTextWithLatexForMp, containsLatex } from '../../utils/latex';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';

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

const favorites = ref([]);
const categories = ref([]);
const currentCategoryId = ref(null);
const collapsedGroups = ref({});
const showAddCategoryModal = ref(false);
const newCategoryTitle = ref('');

// Towxml 解析结果缓存
const favoritesNodesCache = reactive({});

// #ifdef MP-WEIXIN
// 更新收藏题目节点缓存
const updateFavoritesNodes = () => {
  favorites.value.forEach((item) => {
    if (item.QuestionText && !favoritesNodesCache[item.FavoriteID]) {
      try {
        favoritesNodesCache[item.FavoriteID] = parseTextWithLatexForMp(item.QuestionText);
        console.log(`Updated favoritesNodes[${item.FavoriteID}]:`, favoritesNodesCache[item.FavoriteID]);
      } catch (e) {
        console.error(`Update favorites nodes error for ${item.FavoriteID}:`, e);
      }
    }
  });
};

// 监听 favorites 变化
watch(favorites, () => {
  updateFavoritesNodes();
}, { deep: true, immediate: true });
// #endif

const toggleGroup = (bookTitle) => {
  console.log('toggleGroup called:', bookTitle);
  console.log('current state:', collapsedGroups.value);
  // 使用新对象触发响应式更新（兼容小程序）
  const newState = {
    ...collapsedGroups.value,
    [bookTitle]: !collapsedGroups.value[bookTitle]
  };
  console.log('new state:', newState);
  collapsedGroups.value = newState;
};

const fetchCategories = async () => {
  try {
    const res = await request({
      url: '/math/favorite-categories'
    });
    categories.value = res.data || [];
  } catch (error) {
    console.error('获取收藏分类失败:', error);
  }
};

const handleAddCategory = async () => {
  if (!newCategoryTitle.value.trim()) {
    uni.showToast({ title: '请输入分类名称', icon: 'none' });
    return;
  }
  try {
    await request({
      url: '/math/favorite-categories',
      method: 'POST',
      data: { title: newCategoryTitle.value.trim() }
    });
    newCategoryTitle.value = '';
    showAddCategoryModal.value = false;
    uni.showToast({ title: '创建成功' });
    fetchCategories();
  } catch (error) {
    console.error('创建分类失败:', error);
    uni.showToast({ title: '创建失败', icon: 'none' });
  }
};

const handleLongPressCategory = (cat) => {
  uni.showActionSheet({
    itemList: ['删除分类'],
    itemColor: '#ff4d4f',
    success: (res) => {
      if (res.tapIndex === 0) {
        confirmDeleteCategory(cat);
      }
    }
  });
};

const confirmDeleteCategory = (cat) => {
  uni.showModal({
    title: '删除分类',
    content: `确定要删除分类 "${cat.Title}" 吗？该分类下的题目将变为未分类。`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await request({
            url: `/math/favorite-categories/${cat.CategoryID}`,
            method: 'DELETE'
          });
          uni.showToast({ title: '删除成功' });
          if (currentCategoryId.value === cat.CategoryID) {
            currentCategoryId.value = null;
          }
          fetchCategories();
          fetchFavorites();
        } catch (error) {
          console.error('删除分类失败:', error);
          uni.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    }
  });
};

const fetchFavorites = async () => {
  const subjectId = uni.getStorageSync('math_selected_subject_id');
  try {
    const params = { subjectId };
    // 只有当 categoryId 不为 null 时才添加到请求参数
    if (currentCategoryId.value !== null) {
      params.categoryId = currentCategoryId.value;
    }
    
    const res = await request({
      url: '/math/favorites',
      data: params
    });
    favorites.value = res.data || [];
    
    // 调试：检查第一个收藏题目的 QuestionImg
    if (favorites.value.length > 0) {
      console.log('第一个收藏题目:', favorites.value[0]);
      console.log('QuestionImg:', favorites.value[0].QuestionImg);
    }
    
    // 默认折叠所有组
    const groups = {};
    favorites.value.forEach(item => {
      const title = item.BookTitle || '未分类题目';
      groups[title] = true;
    });
    collapsedGroups.value = groups;
  } catch (error) {
    console.error('获取收藏列表失败:', error);
  }
};

const selectCategory = (categoryId) => {
  currentCategoryId.value = categoryId;
  fetchFavorites();
};

const startPractice = () => {
  if (favorites.value.length === 0) return;

  // 保存为最近练习科目，以便在首页显示
  // 收藏夹刷题逻辑：跳转到详情页并传入题目ID列表
  const ids = favorites.value.map(f => f.QuestionID).join(',');
  const url = `/pages/math/math-question-detail?ids=${ids}&mode=practice`;
  
  const practiceItem = {
    type: 'math',
    subject: '数学',
    id: 'math-favorites',
    title: '我的收藏',
    mode: 'favorites',
    url: url,
    icon: 'math'
  };
  uni.setStorageSync('lastPracticeSubject', practiceItem);

  uni.navigateTo({ url });
};

const printFavorites = () => {
  if (favorites.value.length === 0) return;
  const ids = favorites.value.map(f => f.QuestionID).join(',');
  uni.navigateTo({
    url: `/pages/math/math-generated-paper?ids=${ids}&title=我的收藏`
  });
};

const groupedFavorites = computed(() => {
  const groups = {};
  favorites.value.forEach(item => {
    const title = item.BookTitle || '未分类题目';
    if (!groups[title]) {
      groups[title] = [];
    }
    groups[title].push(item);
  });
  return groups;
});

// 从题目文本中提取图片 URL
const extractQuestionImage = (questionText) => {
  if (!questionText) return null;
  
  // 匹配 Markdown 格式图片 ![alt](url)
  const mdImgMatch = questionText.match(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/);
  if (mdImgMatch) {
    let url = mdImgMatch[2];
    // 移除 _yjs 等后缀
    url = url.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '');
    return url;
  }
  
  // 匹配 HTML img 标签 <img src="url">
  const imgMatch = questionText.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
  if (imgMatch) {
    let url = imgMatch[1];
    url = url.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '');
    return url;
  }
  
  // 匹配裸图片 URL
  const urlMatch = questionText.match(/(https?:\/\/[^\s<>"]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp))/i);
  if (urlMatch) {
    let url = urlMatch[1];
    url = url.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '');
    return url;
  }
  
  return null;
};

// 获取文本预览（移除图片标签，截取前 100 字符）
const getTextPreview = (questionText) => {
  if (!questionText) return '(无内容)';
  
  // 移除 Markdown 图片标签
  let text = questionText.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '');
  // 移除 HTML img 标签
  text = text.replace(/<img[^>]+>/gi, '');
  // 移除其他 HTML 标签
  text = text.replace(/<[^>]+>/g, '');
  // 移除 LaTeX 公式（简化处理）
  text = text.replace(/\$[^$]+\$/g, '');
  // 清理多余空格
  text = text.replace(/\s+/g, ' ').trim();
  
  // 截取前 100 字符
  if (text.length > 100) {
    text = text.substring(0, 100) + '...';
  }
  
  return text || '(无文本内容)';
};

const renderLaTeX = () => {
  // #ifdef H5
  nextTick(() => {
    if (typeof document !== 'undefined') {
      const elements = document.querySelectorAll('.latex-content');
      elements.forEach(el => {
        katexRenderWithRetry(el);
      });
    }
  });
  // #endif
  // #ifdef MP-WEIXIN
  // 微信小程序不支持 DOM 操作，LaTeX 公式将以纯文本形式显示
  // #endif
};

watch(favorites, () => {
  renderLaTeX();
}, { deep: true });

const removeFromFavorites = async (questionId) => {
  uni.showModal({
    title: '确认移除',
    content: '确定要从收藏夹中移除这道题吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await request({ 
            url: '/math/favorites/toggle',
            method: 'POST',
            data: { questionId }
          });
          favorites.value = favorites.value.filter(f => f.QuestionID !== questionId);
          uni.showToast({ title: '已移除', icon: 'none' });
        } catch (error) {
          console.error('Failed to remove favorite:', error);
          uni.showToast({ title: '移除失败', icon: 'none' });
        }
      }
    }
  });
};

const goToQuestion = (questionId) => {
  // 获取当前显示的所有题目 ID
  const ids = favorites.value.map(f => f.QuestionID).join(',');
  uni.navigateTo({
    url: `/pages/math/math-question-detail?questionId=${questionId}&ids=${ids}`
  });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const goBack = () => {
  uni.navigateBack();
};

onShow(() => {
  fetchCategories();
  fetchFavorites();
});

onMounted(() => {
  // fetchFavorites(); // onShow will handle it
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
  background-color: #f5f7fa;
  min-height: 100vh;
}

.category-filter {
  padding: 12rpx 30rpx;
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
  position: sticky;
  top: 0;
  z-index: 100;
}

.category-label {
  font-size: 24rpx;
  color: #fff;
  opacity: 0.9;
  margin-right: 16rpx;
  white-space: nowrap;
}

.category-scroll {
  flex: 1;
  white-space: nowrap;
  width: 0;
}

.category-list {
  display: inline-flex;
  align-items: center;
  gap: 16rpx;
  padding: 4rpx 0;
}

.category-tab {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 20rpx;
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  border-radius: 30rpx;
  font-size: 24rpx;
  transition: all 0.25s ease;
  user-select: none;
  -webkit-user-select: none;
}

.category-tab.active {
  background-color: #fff;
  color: #4db6ac;
  font-weight: 600;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.1);
}

.add-category-tab {
  width: 50rpx;
  height: 50rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(255,255,255,0.2);
  border: 2rpx dashed rgba(255,255,255,0.4);
  border-radius: 50%;
  font-size: 32rpx;
  margin-left: 8rpx;
}

.add-category-tab:active {
  background: rgba(77, 182, 172, 0.2);
  transform: scale(0.95);
}

.remove-tag {
  width: 32rpx;
  height: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0,0,0,0.1);
  color: #fff;
  font-size: 20rpx;
  margin-left: 8rpx;
}

.category-tab.active .remove-tag {
  background: #f5f5f5;
  color: #999;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  width: 85%;
  max-width: 600rpx;
  border-radius: 20rpx;
  overflow: hidden;
}

.modal-header {
  padding: 32rpx;
  text-align: center;
  background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
}

.modal-body {
  padding: 32rpx;
}

.category-input {
  width: 100%;
  height: 88rpx;
  border: 2rpx solid #e8e8e8;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  transition: border-color 0.2s;
}

.category-input:focus {
  border-color: #4db6ac;
}

.modal-footer {
  display: flex;
  border-top: 1rpx solid #f0f0f0;
}

.modal-btn {
  flex: 1;
  height: 96rpx;
  line-height: 96rpx;
  font-size: 30rpx;
  border: none;
  border-radius: 0;
  background: transparent;
}

.modal-btn.cancel {
  color: #666;
  border-right: 1rpx solid #f0f0f0;
}

.modal-btn.confirm {
  color: #4db6ac;
  font-weight: 600;
}

.main-content {
  padding: 20rpx 24rpx 140rpx 24rpx;
}

.favorite-group {
  margin-bottom: 24rpx;
}

.group-header {
  display: flex;
  align-items: center;
  padding: 24rpx 16rpx;
  cursor: pointer;
  transition: background 0.2s;
  border-radius: 12rpx;
  background: #fff;
  margin-bottom: 8rpx;
}

.group-header:active {
  background: rgba(77, 182, 172, 0.1);
}

.group-icon {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(77, 182, 172, 0.1);
  border-radius: 10rpx;
  margin-right: 16rpx;
}

.group-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  flex: 1;
}

.group-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.group-count {
  font-size: 24rpx;
  color: #999;
  background: #f0f2f5;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

.toggle-icon {
  width: 32rpx;
  height: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
}

.toggle-icon.collapsed {
  transform: rotate(-90deg);
}

/* 树形结构题目列表 */
.fav-tree-list {
  margin-top: 16rpx;
  padding-left: 60rpx;
  padding-bottom: 40rpx;
}

.fav-tree-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  border: 1rpx solid #e8e8e8;
  transition: all 0.2s;
}

.fav-tree-item:active {
  background: #f5f7fa;
  border-color: #4db6ac;
}

/* 题图 */
.fav-tree-thumb {
  width: 200rpx;
  height: 150rpx;
  object-fit: cover;
  border-radius: 12rpx;
  flex-shrink: 0;
}

.fav-tree-no-thumb {
  width: 200rpx;
  height: 150rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.fav-tree-type-tag {
  font-size: 24rpx;
  color: #4db6ac;
  font-weight: 500;
}

.fav-tree-info-wrap {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex: 1;
  min-width: 0;
}

.fav-tree-number {
  width: 40rpx;
  height: 40rpx;
  background: linear-gradient(135deg, #4db6ac, #26a69a);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 600;
  flex-shrink: 0;
}

.fav-tree-info {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  flex: 1;
  min-width: 0;
}

.fav-tree-type {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}

.fav-tree-chapter {
  font-size: 20rpx;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fav-tree-remove {
  width: 44rpx;
  height: 44rpx;
  background: #f5f5f5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 22rpx;
  transition: all 0.2s;
  flex-shrink: 0;
}

.fav-tree-remove:active {
  background: #ffebee;
  color: #e74c3c;
}

/* 收藏题目网格布局 - 参考 math-smart-paper-config */
.fav-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-top: 16rpx;
  padding-left: 60rpx;
  padding-bottom: 40rpx;
}

.fav-item {
  background: #fff;
  border-radius: 16rpx;
  border: 2rpx solid #f0f0f0;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.06);
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.fav-item:active {
  transform: scale(0.98);
  border-color: #e74c3c;
}

.fav-thumb {
  width: 100%;
  height: 200rpx;
  object-fit: cover;
  display: block;
}

.fav-no-thumb {
  width: 100%;
  height: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  gap: 8rpx;
}

.fav-no-thumb .fav-type-tag {
  font-size: 28rpx;
  font-weight: 600;
  background: rgba(77, 182, 172, 0.1);
  color: #4db6ac;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.fav-number {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 24rpx;
  padding: 6rpx 14rpx;
  border-radius: 8rpx;
  font-weight: 600;
}

.fav-remove {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 77, 79, 0.9);
  color: #fff;
  font-size: 28rpx;
  border-radius: 50%;
  cursor: pointer;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 160rpx;
  color: #999;
}

.empty-icon {
  width: 120rpx;
  height: 120rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
  border-radius: 50%;
  margin-bottom: 32rpx;
}

.empty-state p {
  font-size: 28rpx;
  color: #999;
}

.go-study-btn {
  margin-top: 40rpx;
  padding: 20rpx 56rpx;
  background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 500;
  box-shadow: 0 6rpx 20rpx rgba(77, 182, 172, 0.3);
}
</style>
