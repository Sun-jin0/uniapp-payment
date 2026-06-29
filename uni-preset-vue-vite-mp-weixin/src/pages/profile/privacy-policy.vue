<template>
  <view class="container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 自定义导航栏 -->
    <view class="custom-nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-left" @click="goBack">
          <view class="back-icon"></view>
        </view>
        <text class="nav-title">隐私政策</text>
        <view class="nav-right-placeholder"></view>
      </view>
    </view>

    <!-- 内容区域 -->
    <scroll-view class="content-scroll" scroll-y :style="{ marginTop: (statusBarHeight + 44) + 'px' }">
      <view class="privacy-content">
        <view class="section">
          <text class="section-title">引言</text>
          <text class="section-text">
            本小程序重视用户的隐私保护。我们深知个人信息对您的重要性，因此我们致力于保护您的个人信息安全。本隐私政策将帮助您了解我们如何收集、使用、存储和保护您的个人信息。
          </text>
        </view>

        

        <view class="section">
          <text class="section-title">一、我们收集的信息</text>
          <text class="section-text">
            为了向您提供更好的服务，我们可能会收集以下信息：
          </text>
          <view class="list">
            <view class="list-item">
              <text class="item-title">1. 账号信息</text>
              <text class="item-desc">当您注册或登录时，我们会收集您的用户名/学号和密码，用于身份验证和账号管理。</text>
            </view>
            <view class="list-item">
              <text class="item-title">2. 微信用户信息</text>
              <text class="item-desc">当您使用微信登录时，我们会获取您的微信头像、昵称和OpenID，用于展示和身份识别。</text>
            </view>
            <view class="list-item">
              <text class="item-title">3. 学习数据</text>
              <text class="item-desc">我们会记录您的刷题进度、答题记录、收藏题目等学习数据，用于提供个性化的学习服务。</text>
            </view>
            <view class="list-item">
              <text class="item-title">4. 剪贴板信息</text>
              <text class="item-desc">我们会读取您的剪贴板内容，用于复制分享码、网盘链接、QQ群号等信息，以及粘贴作文内容到输入框。</text>
            </view>
            <view class="list-item">
              <text class="item-title">5. 选中的照片或视频</text>
              <text class="item-desc">我们会收集您选中的照片或视频信息，用于上传头像、题目反馈图片。</text>
            </view>
            <view class="list-item">
              <text class="item-title">6. 相册（仅写入）</text>
              <text class="item-desc">我们会在获取您的明示同意后，使用您的相册（仅写入）权限，用于保存图片到相册。</text>
            </view>
          </view>
        </view>

        <view class="section">
          <text class="section-title">二、我们如何使用信息</text>
          <text class="section-text">
            我们使用收集的信息主要用于：
          </text>
          <view class="list">
            <view class="list-item">
              <text class="item-desc">• 提供用户注册、登录和身份验证服务</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 记录和展示您的学习进度和成绩</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 提供个性化的学习推荐和错题分析</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 改进和优化我们的产品和服务</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 保障账号安全，防止欺诈和滥用</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 读取剪贴板：复制分享码、网盘链接、QQ群号，粘贴作文内容</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 选中的照片或视频：上传头像、题目反馈图片</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 相册（仅写入）：保存图片到相册</text>
            </view>
          </view>
        </view>

        <view class="section">
          <text class="section-title">三、信息的存储和保护</text>
          <text class="section-text">
            我们采取多种安全措施保护您的个人信息：
          </text>
          <view class="list">
            <view class="list-item">
              <text class="item-desc">• 使用加密技术传输和存储敏感信息</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 严格限制内部人员对用户信息的访问权限</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 定期进行安全审计和漏洞检测</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 仅在法律要求或必要时保留您的信息</text>
            </view>
          </view>
        </view>

        <view class="section">
          <text class="section-title">四、信息共享</text>
          <text class="section-text">
            我们不会将您的个人信息出售、交易或以其他方式转让给第三方。仅在以下情况下可能会共享信息：
          </text>
          <view class="list">
            <view class="list-item">
              <text class="item-desc">• 获得您的明确同意</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 遵守法律法规或政府要求</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 保护我们的合法权益或用户安全</text>
            </view>
          </view>
        </view>

        <view class="section">
          <text class="section-title">五、您的权利</text>
          <text class="section-text">
            您对自己的个人信息拥有以下权利：
          </text>
          <view class="list">
            <view class="list-item">
              <text class="item-desc">• 访问和查看您的个人信息</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 更正或更新不准确的信息</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 删除您的账号和相关数据</text>
            </view>
            <view class="list-item">
              <text class="item-desc">• 退出登录并清除本地缓存</text>
            </view>
          </view>
        </view>

        <view class="section">
          <text class="section-title">六、联系我们</text>
          <text class="section-text">
            如果您对本隐私政策有任何疑问或建议，或需要行使您的权利，请通过以下方式联系我们：
          </text>
          <view class="contact-info">
            <text class="contact-item">邮箱：3439922689@qq.com</text>
          </view>
        </view>

        <view class="section">
          <text class="section-title">七、政策更新</text>
          <text class="section-text">
            我们可能会不时更新本隐私政策。更新后的政策将在本页面发布，重大变更我们会通过应用内通知告知您。建议您定期查看本页面以了解最新政策。
          </text>
          <text class="update-time">最后更新日期：2026年3月4日</text>
        </view>
      </view>

      <!-- 底部留白 -->
      <view class="bottom-space"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const statusBarHeight = ref(0);
const isDarkMode = ref(false);

onMounted(() => {
  // 获取系统信息
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight;

  // 检查主题模式
  const theme = uni.getStorageSync('theme') || 'light';
  isDarkMode.value = theme === 'dark';
});

const goBack = () => {
  uni.navigateBack();
};
</script>

<style scoped lang="scss">
.container {
  min-height: 100vh;
  background-color: #f8f9fa;
  display: flex;
  justify-content: center;
}

/* 自定义导航栏 */
.custom-nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background-color: #4db6ac;
  z-index: 100;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.1);
}

.nav-content {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20rpx;
}

.nav-left {
  width: 80rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
}

.back-icon {
  width: 20rpx;
  height: 20rpx;
  border-left: 4rpx solid #fff;
  border-bottom: 4rpx solid #fff;
  transform: rotate(45deg);
}

.nav-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #fff;
}

.nav-right-placeholder {
  width: 80rpx;
}

/* 内容区域 */
.content-scroll {
  height: calc(100vh - v-bind(statusBarHeight + 44)px);
  max-width: 750rpx;
  width: 100%;
}

.privacy-content {
  padding: 30rpx;
}

.section {
  margin-bottom: 40rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
}

.section-text {
  display: block;
  font-size: 28rpx;
  color: #666;
  line-height: 1.8;
  text-align: justify;
}

.list {
  margin-top: 20rpx;
}

.list-item {
  margin-bottom: 24rpx;

  &:last-child {
    margin-bottom: 0;
  }
}

.item-title {
  display: block;
  font-size: 30rpx;
  font-weight: 500;
  color: #444;
  margin-bottom: 8rpx;
}

.item-desc {
  display: block;
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
}

.contact-info {
  margin-top: 20rpx;
  padding: 20rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
}

.contact-item {
  display: block;
  font-size: 28rpx;
  color: #666;
  line-height: 1.8;
}

.update-time {
  display: block;
  font-size: 26rpx;
  color: #999;
  margin-top: 20rpx;
  text-align: right;
}

.bottom-space {
  height: 40rpx;
}

/* 黑夜模式 */
.dark-mode {
  background-color: #1a1a1a;

  .section {
    background: #2a2a2a;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.2);
  }

  .section-title {
    color: #fff;
  }

  .section-text {
    color: #bbb;
  }

  .item-title {
    color: #ddd;
  }

  .item-desc {
    color: #aaa;
  }

  .contact-info {
    background: #333;
  }

  .contact-item {
    color: #aaa;
  }

  .update-time {
    color: #888;
  }
}
</style>
