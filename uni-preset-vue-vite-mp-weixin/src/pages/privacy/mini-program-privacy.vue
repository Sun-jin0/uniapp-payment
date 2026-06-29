<template>
  <view class="container">
    <scroll-view scroll-y class="content">
      <view class="header-title">
        <text class="main-title">研大师刷研题</text>
        <text class="sub-title">小程序隐私保护指引</text>
      </view>

      <view class="intro">
        <text class="intro-text">
          本指引是研大师刷研题小程序开发者（以下简称"开发者"）为处理你的个人信息而制定。
        </text>
      </view>

      <view class="section">
        <text class="section-title">1. 开发者处理的信息</text>
        <text class="section-text">
          根据法律规定，开发者仅处理实现小程序功能所必要的信息。
        </text>
        <text class="section-text">
          开发者收集你选中的照片或视频信息，用于用作头像排行榜展示及个性化界面显示。
        </text>
        <text class="section-text">
          开发者将在获取你的明示同意后，收集你的微信昵称、头像，用途是【用于用户身份识别、排行榜展示及个性化界面显示】
        </text>
        <text class="section-text">
          开发者读取你的剪切板，用途是【用于复制分享码、网盘链接、QQ群号等信息，以及粘贴作文内容到输入框】
        </text>
        <text class="section-text">
          开发者收集你选中的照片或视频信息，用途是【用于上传头像、题目反馈图片】
        </text>
        <text class="section-text">
          开发者将在获取你的明示同意后，使用你的相册（仅写入）权限，用途是【用于保存图片到相册】
        </text>
      </view>

      <view class="section">
        <text class="section-title">2. 未成年人保护</text>
        <text class="section-text">
          根据相关法律法规的规定，若你是14周岁以下的未成年人，你需要和你的监护人共同仔细阅读本指引，并在征得监护人明示同意后继续使用小程序服务。开发者将根据相关法律法规的规定及本指引内容，处理经监护人同意而收集的未成年人用户信息，并通过【本指引你的权益部分】披露的内容保障未成年人在个人信息处理活动中的各项权利。
        </text>
      </view>

      <view class="section">
        <text class="section-title">3. 你的权益</text>
        <text class="section-text">
          3.1 关于你的个人信息，你可以通过以下方式与开发者联系，行使查阅、复制、更正、删除等法定权利。
        </text>
        <text class="section-text">
          3.2 若你在小程序中注册了账号，你可以通过以下方式与开发者联系，申请注销你在小程序中使用的账号。在受理你的申请后，开发者承诺在十五个工作日内完成核查和处理，并按照法律法规要求处理你的相关信息。
        </text>
        <text class="section-text">
          邮箱：3439922689@qq.com
        </text>
      </view>

      <view class="section">
        <text class="section-title">4. 开发者对信息的存储</text>
        <text class="section-text">
          开发者承诺，除法律法规另有规定外，开发者对你的信息的保存期限应当为实现处理目的所必要的最短时间。
        </text>
      </view>

      <view class="section">
        <text class="section-title">5. 信息的使用规则</text>
        <text class="section-text">
          开发者将会在本指引所明示的用途内使用收集的信息
        </text>
        <text class="section-text">
          如开发者使用你的信息超出本指引目的或合理范围，开发者必须在变更使用目的或范围前，再次以邮件方式告知并征得你的明示同意。
        </text>
      </view>

      <view class="section">
        <text class="section-title">6. 信息对外提供</text>
        <text class="section-text">
          开发者承诺，不会主动共享或转让你的信息至任何第三方，如存在确需共享或转让时，开发者应当直接征得或确认第三方征得你的单独同意。
        </text>
        <text class="section-text">
          开发者承诺，不会对外公开披露你的信息，如必须公开披露时，开发者应当向你告知公开披露的目的、披露信息的类型及可能涉及的信息，并征得你的单独同意。
        </text>
      </view>

      <view class="section">
        <text class="section-title">7. 投诉与建议</text>
        <text class="section-text">
          你认为开发者未遵守上述约定，或有其他的投诉建议、或未成年人个人信息保护相关问题，可通过以下方式与开发者联系；或者向微信进行投诉。
        </text>
        <text class="section-text">
          邮箱：3439922689@qq.com
        </text>
      </view>

      <view class="footer">
        <text class="footer-text">更新日期：2026-03-27</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
// 使用系统默认导航栏返回
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #fff;
  display: flex;
  justify-content: center;
}

.content {
  padding: 30rpx;
  height: 100vh;
  max-width: 750rpx;
  width: 100%;
  box-sizing: border-box;
}

.header-title {
  text-align: center;
  margin-bottom: 40rpx;
  padding-bottom: 30rpx;
  border-bottom: 1rpx solid #eee;
}

.main-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #333;
  display: block;
  margin-bottom: 10rpx;
}

.sub-title {
  font-size: 32rpx;
  color: #666;
  display: block;
}

.intro {
  margin-bottom: 30rpx;
}

.intro-text {
  font-size: 28rpx;
  color: #333;
  line-height: 1.8;
  display: block;
}

.section {
  margin-bottom: 40rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.section-text {
  font-size: 28rpx;
  color: #333;
  line-height: 1.8;
  display: block;
  margin-bottom: 16rpx;
}

.footer {
  margin-top: 60rpx;
  padding-top: 30rpx;
  text-align: center;
}

.footer-text {
  font-size: 26rpx;
  color: #999;
}
</style>
