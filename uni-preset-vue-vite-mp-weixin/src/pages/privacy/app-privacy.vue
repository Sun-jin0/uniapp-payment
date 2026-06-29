<template>
  <view class="container">
    <scroll-view scroll-y class="content">
      <view class="intro">
        <text class="intro-text">
          欢迎您使用研大师刷研题小程序系统，研大师刷研题小程序是专为考研学子提供多科目（数学、计算机、英语、政治等）题目练习、智能组卷、真题模拟、学习进度跟踪等服务的在线学习平台。同时平台还提供题目收藏、错题本、学习数据分析、试卷分享等相关功能。通过该平台提供资源，帮助大家学习提升、成绩提高、考研上岸等相关领域的内容。非常感谢您的使用，同时也希望平台能够对您有所帮助。
        </text>
        <text class="intro-text">
          在使用平台时，您需要注意如下几点：
        </text>
      </view>

      <view class="section">
        <text class="section-text">1、发布内容必须遵守国家法律法规，不得违反公序良俗，不得侵犯他人权益；</text>
        <text class="section-text">2、用户需保证所发布的内容均为原创或已经获得合法授权，不得侵犯他人知识产权；</text>
        <text class="section-text">3、所发布的内容应当有质量、有学习价值、无广告性质且符合平台的相关内容规范；</text>
        <text class="section-text">4、发布信息中不得包含任何污秽、低俗、暴力、恐怖、诈骗等不良信息；</text>
        <text class="section-text">5、不得发布具有政治敏感性、涉及种族、地域等争议性话题的壁纸；</text>
        <text class="section-text">6、用户需对所发布的内容负责，并承担因其发布而引起的一切法律责任；</text>
        <text class="section-text">7、若所发布的内容被发现存在问题，管理员有权删除相关内容并对用户进行警告、禁言、封号等处理；</text>
        <text class="section-text">8、用户不得将软件用作商业用途，不得利用软件从事广告营销或其他非法盈利行为；</text>
        <text class="section-text">9、用户不得通过软件传播谣言、诈骗信息、色情信息等有害信息；</text>
        <text class="section-text">10、若用户在使用软件时出现技术问题或其他疑问，应及时与管理员联系。</text>
        <text class="section-text">11、用户在平台注册的信息，平台应该无权跟转售、透露、倒卖等不合法的方式，泄露用户的信息。</text>
        <text class="section-text">12、在经过用户授权之后，用户的信息可用作平台数据分析，帮助用户提供更好的、更优质的内容信息。</text>
        <text class="section-text">13、平台收集用户头像、昵称等相关信息，主要在用户端进行展示，平台会严格保密用户信息，不会出现倒卖、泄露等行为。请广大用户放心个人信息。</text>
      </view>

      <view class="footer-section">
        <text class="footer-text">
          以上是一些关于研大师刷研题小程序对用户要求的基本内容，用户需认真遵守。同时，作为管理员也会严格审核用户行为
        </text>
        <text class="footer-text">
          经发现违规行为，为了确保软件平台的合法性和健康性，平台有权在不经过用户的同意下，对账号警告、禁言、封号等处理措施。
        </text>
        <text class="footer-text">
          本协议最终解释权归平台所有
        </text>
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

.intro {
  margin-bottom: 30rpx;
}

.intro-text {
  font-size: 28rpx;
  color: #333;
  line-height: 1.8;
  display: block;
  margin-bottom: 20rpx;
  text-indent: 2em;
}

.section {
  margin-bottom: 30rpx;
}

.section-text {
  font-size: 28rpx;
  color: #333;
  line-height: 1.8;
  display: block;
  margin-bottom: 16rpx;
}

.footer-section {
  margin-top: 30rpx;
  padding-top: 30rpx;
}

.footer-text {
  font-size: 28rpx;
  color: #333;
  line-height: 1.8;
  display: block;
  margin-bottom: 16rpx;
}
</style>
