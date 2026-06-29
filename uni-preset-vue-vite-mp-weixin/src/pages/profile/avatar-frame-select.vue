<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <view class="frame-list">
      <view 
        v-for="frame in avatarFrames" 
        :key="frame.id" 
        class="frame-item"
        :class="{ 'frame-selected': selectedFrameId === frame.id, 'frame-locked': !frame.is_available }"
        @click="selectFrame(frame)"
      >
        <view class="frame-preview">
          <image
            class="frame-image"
            :class="{ 'frame-locked-image': !frame.is_available }"
            :src="getFrameImageUrl(frame)"
            mode="aspectFit"
            @error="onImageError(frame)"
          ></image>
          <view v-if="selectedFrameId === frame.id" class="selected-badge">
            <text class="check-icon">✓</text>
          </view>
          <view v-if="!frame.is_available" class="lock-overlay">
            <view class="lock-badge">
              <text class="lock-icon">🔒</text>
            </view>
            <text class="lock-text">{{ frame.unavailable_reason }}</text>
          </view>
        </view>
        <view class="frame-info">
          <text class="frame-name" :class="{ 'frame-locked-text': !frame.is_available }">{{ frame.name }}</text>
          <text class="frame-desc" v-if="frame.description">{{ frame.description }}</text>
          <text class="frame-lock-reason" v-if="!frame.is_available">{{ frame.unavailable_reason }}</text>
        </view>
      </view>

    </view>

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

    <view v-if="loading" class="loading-container">
      <text class="loading-text">加载中...</text>
    </view>

    <view v-if="!loading && avatarFrames.length === 0" class="empty-container">
      <text class="empty-text">暂无可用头像框</text>
    </view>

    <view class="bottom-action">
      <button
        class="cancel-frame-btn"
        :class="{ 'btn-selected': selectedFrameId === 0 }"
        :disabled="submitting"
        @click="selectFrame({ id: 0 })"
      >
        <text v-if="selectedFrameId === 0" class="btn-check">✓</text>
        <text>不使用头像框</text>
      </button>
      <button
        class="confirm-btn"
        :disabled="submitting"
        @click="confirmSelection"
      >
        <text v-if="submitting">保存中...</text>
        <text v-else>确认选择(看广告)</text>
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getCurrentInstance } from 'vue';

const instance = getCurrentInstance();

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

// 激励视频广告实例
let rewardedVideoAd = null;

// 初始化激励视频广告
const initRewardedVideoAd = () => {
  // #ifdef MP-WEIXIN
  if (wx.createRewardedVideoAd) {
    rewardedVideoAd = wx.createRewardedVideoAd({
      adUnitId: 'adunit-87b769e2258374d7'
    });

    rewardedVideoAd.onLoad(() => {
      console.log('激励视频广告加载成功');
    });

    rewardedVideoAd.onError((err) => {
      console.error('激励视频广告加载失败', err);
    });
  }
  // #endif
};

// 显示激励视频广告并保存头像框
const showRewardedAdAndSave = () => {
  // #ifdef MP-WEIXIN
  if (!rewardedVideoAd) {
    initRewardedVideoAd();
  }

  if (rewardedVideoAd) {
    // 监听广告关闭事件
    const onAdClose = (res) => {
      rewardedVideoAd.offClose(onAdClose);
      if (res && res.isEnded) {
        // 正常播放结束，执行保存
        console.log('广告观看完成，保存头像框');
        doConfirmSelection();
      } else {
        // 播放中途退出
        console.log('广告观看中途退出');
        uni.showToast({ title: '需要完整观看广告才能更换头像框', icon: 'none' });
      }
    };

    rewardedVideoAd.onClose(onAdClose);

    rewardedVideoAd.show().catch(() => {
      // 失败重试
      rewardedVideoAd.load()
        .then(() => rewardedVideoAd.show())
        .catch(err => {
          console.error('激励视频广告显示失败', err);
          // 广告显示失败时，直接允许保存
          uni.showToast({ title: '广告加载失败，免费为您更换', icon: 'none' });
          doConfirmSelection();
        });
    });
  } else {
    // 不支持广告，直接保存
    doConfirmSelection();
  }
  // #endif

  // #ifndef MP-WEIXIN
  // 非微信小程序环境，直接保存
  doConfirmSelection();
  // #endif
};

const isDarkMode = ref(false);
const loading = ref(false);
const submitting = ref(false);
const avatarFrames = ref([]);
const selectedFrameId = ref(0);
const currentAvatarFrameId = ref(null);

const defaultFrame = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png';

// 头像框图片加载失败时的备用图片
const getFrameImageUrl = (frame) => {
  if (!frame) return defaultFrame;
  // 优先使用 image_url，如果没有则使用默认图片
  return frame.image_url || defaultFrame;
};

onMounted(() => {
  const currentTheme = uni.getStorageSync('themeMode') || 'light';
  isDarkMode.value = currentTheme === 'dark';

  loadUserInfo();
  loadAvatarFrames();

  // #ifdef MP-WEIXIN
  // 预加载激励视频广告
  initRewardedVideoAd();
  // #endif
});

const loadUserInfo = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.userApi.getUserInfo();
    if (res.code === 0) {
      currentAvatarFrameId.value = res.data.avatar_frame_id || null;
      selectedFrameId.value = res.data.avatar_frame_id || 0;
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
  }
};

const loadAvatarFrames = async () => {
  loading.value = true;
  try {
    const res = await instance.appContext.config.globalProperties.$api.userApi.getUserAvatarFrames();
    if (res.code === 0) {
      // 处理头像框数据，确保每个都有图片URL
      avatarFrames.value = (res.data || []).map(frame => ({
        ...frame,
        image_url: frame.image_url || defaultFrame
      }));
      console.log('头像框列表:', avatarFrames.value);
    }
  } catch (error) {
    console.error('获取头像框列表失败:', error);
    uni.showToast({
      title: '加载失败',
      icon: 'none'
    });
  } finally {
    loading.value = false;
  }
};

const selectFrame = (frame) => {
  // 检查是否有权限使用
  if (frame.is_available === false) {
    uni.showToast({
      title: frame.unavailable_reason || '暂无权限使用此头像框',
      icon: 'none',
      duration: 2000
    });
    return;
  }
  selectedFrameId.value = frame.id;
};

const onImageError = (frame) => {
  console.error('图片加载失败:', frame?.image_url);
  if (frame) {
    frame.image_url = defaultFrame;
  }
};

// 实际执行保存操作
const doConfirmSelection = async () => {
  if (submitting.value) return;

  submitting.value = true;
  try {
    const res = await instance.appContext.config.globalProperties.$api.userApi.setUserAvatarFrame({
      avatar_frame_id: selectedFrameId.value
    });

    if (res.code === 0) {
      uni.showToast({
        title: '设置成功',
        icon: 'success'
      });

      setTimeout(() => {
        uni.navigateBack();
      }, 1500);
    } else {
      uni.showToast({
        title: res.message || '设置失败',
        icon: 'none'
      });
    }
  } catch (error) {
    console.error('设置头像框失败:', error);
    uni.showToast({
      title: '设置失败',
      icon: 'none'
    });
  } finally {
    submitting.value = false;
  }
};

// 确认选择（显示广告后保存）
const confirmSelection = async () => {
  if (submitting.value) return;

  // 显示激励视频广告，观看完成后保存
  showRewardedAdAndSave();
};
</script>

<style scoped>
/* 原生模板广告容器 */
.ad-container {
  margin: 20rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.container {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 120rpx;
}

.dark-mode .container {
  background-color: #1a1a1a;
}

.frame-list {
  padding: 20rpx;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300rpx, 1fr));
  gap: 20rpx;
}

.frame-item {
  background-color: #ffffff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
}

.dark-mode .frame-item {
  background-color: #2d2d2d;
}

.frame-selected {
  border: 4rpx solid #667eea;
}

.dark-mode .frame-selected {
  border-color: #818cf8;
}

.frame-locked {
  opacity: 0.7;
}

.frame-locked-image {
  filter: grayscale(100%);
  opacity: 0.5;
}

.lock-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 16rpx;
}

.lock-badge {
  width: 60rpx;
  height: 60rpx;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12rpx;
}

.lock-icon {
  font-size: 32rpx;
  color: #ffffff;
}

.lock-text {
  font-size: 22rpx;
  color: #ffffff;
  background-color: rgba(0, 0, 0, 0.6);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.frame-locked-text {
  color: #999;
}

.frame-lock-reason {
  font-size: 22rpx;
  color: #ff6b6b;
  margin-top: 4rpx;
}

.dark-mode .frame-lock-reason {
  color: #ff8585;
}

.frame-preview {
  width: 100% !important;
  height: 200rpx !important;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f0f0f0;
  position: relative;
  overflow: hidden;
}

.dark-mode .frame-preview {
  background-color: #1a1a1a;
}

.frame-image {
  width: 280rpx !important;
  height: 160rpx !important;
}

.selected-badge {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 48rpx;
  height: 48rpx;
  background-color: #667eea;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 8rpx rgba(102, 126, 234, 0.5);
}

.check-icon {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: bold;
  line-height: 1;
}

.frame-info {
  padding: 20rpx;
}

.frame-name {
  font-size: 28rpx;
  color: #333333;
  font-weight: 500;
  display: block;
}

.dark-mode .frame-name {
  color: #ffffff;
}

.frame-desc {
  font-size: 24rpx;
  color: #999999;
  margin-top: 8rpx;
  display: block;
}

.loading-container,
.empty-container {
  padding: 100rpx 0;
  text-align: center;
}

.loading-text,
.empty-text {
  font-size: 28rpx;
  color: #999999;
}

.bottom-action {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background-color: #ffffff;
  box-shadow: 0 -4rpx 12rpx rgba(0, 0, 0, 0.08);
  display: flex;
  gap: 20rpx;
}

.dark-mode .bottom-action {
  background-color: #2d2d2d;
}

.cancel-frame-btn {
  flex: 1;
  height: 88rpx;
  background-color: #f5f5f5;
  color: #666666;
  font-size: 28rpx;
  font-weight: 500;
  border: 2rpx solid #e0e0e0;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.dark-mode .cancel-frame-btn {
  background-color: #3d3d3d;
  color: #aaaaaa;
  border-color: #555555;
}

.cancel-frame-btn.btn-selected {
  background-color: #667eea;
  color: #ffffff;
  border-color: #667eea;
}

.dark-mode .cancel-frame-btn.btn-selected {
  background-color: #667eea;
  color: #ffffff;
  border-color: #667eea;
}

.btn-check {
  font-size: 24rpx;
  font-weight: bold;
}

.confirm-btn {
  flex: 1;
  height: 88rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 500;
  border: none;
  border-radius: 44rpx;
}

.confirm-btn[disabled] {
  background: #cccccc;
}
</style>
