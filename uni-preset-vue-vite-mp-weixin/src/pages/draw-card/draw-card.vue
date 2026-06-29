<template>
  <view class="container">
    <!-- 抽卡主区域 -->
    <view class="main-card-area">
      <!-- 查看奖池按钮 - 右上角 -->
      <button class="pool-btn-top" @tap="showPoolModal">奖池</button>

      <!-- 抽卡区域 -->
      <view class="card-area">
        <!-- 未抽卡状态 -->
        <view v-if="!showResult" class="card-back">
          <text class="card-icon">?</text>
          <text class="card-tip">点击抽取今日卡牌</text>
        </view>
        <!-- 已抽卡状态 -->
          <view v-else class="card-front" :class="'front-' + (drawnCard.tier || 'common')">
            <image class="card-img" :src="drawnCard.image_url" mode="aspectFit"></image>
            <text class="card-desc">{{ drawnCard.description }}</text>
            <view class="name-row">
              <image class="tier-icon" :src="getTierIcon(drawnCard.tier)" mode="aspectFit"></image>
              <text class="card-name" :class="'name-' + (drawnCard.tier || 'common')">{{ drawnCard.is_reward ? drawnCard.name : '安慰奖' }}</text>
            </view>
          </view>

        <!-- 按钮区 -->
        <view class="btn-area">
          <view class="count-box">
            <text class="count-label">剩余</text>
            <text class="count-num">{{ remainingDraws }}</text>
            <text class="count-label">次</text>
          </view>
          <button
            class="draw-btn"
            :disabled="isDrawing || !canDraw"
            @tap="handleDraw"
          >
            {{ isDrawing ? '抽取中...' : (canDraw ? '开始抽取' : '次数不足') }}
          </button>
          <button class="add-count-btn-small" @tap="handleAddCount" :disabled="isAddingCount">
            {{ isAddingCount ? '获取中' : '获取次数' }}
          </button>
        </view>

        <text class="tip-text">{{ canDraw ? `剩余${remainingDraws}次` : '请先获取次数' }}</text>
      </view>

      <!-- 今日运势 -->
      <view class="fortune-box" v-if="todayFortune">
        <text class="fortune-label">今日运势</text>
        <text class="fortune-text">{{ todayFortune }}</text>
      </view>

      <!-- 查看详情按钮 -->
      <view class="detail-btn-box" v-if="userStats.totalDraws > 0 || myCards.length > 0">
        <button class="detail-btn" @tap="showDetailModal = true">查看我的数据</button>
      </view>
    </view>

    <!-- 原生模板广告2 -->
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

    <!-- 卡片详情弹窗 -->
    <view class="modal" v-if="showModal" @tap="closeModal">
      <view class="modal-box" @tap.stop>
        <image class="modal-img" :src="selectedCard.image_url" mode="aspectFit"></image>
        <text class="modal-name">{{ selectedCard.name }}</text>
        <text class="modal-desc">{{ selectedCard.description }}</text>
        <text class="modal-info">稀有度: {{ getRarityText(selectedCard.rarity) }} | {{ selectedCard.owner_count || 0 }}人获得</text>
        <button class="close-btn" @tap="closeModal">关闭</button>
      </view>
    </view>

    <!-- 奖池弹窗 -->
    <view class="modal" v-if="showPool" @tap="closePoolModal">
      <view class="modal-box pool-box" @tap.stop>
        <text class="modal-title">奖池一览</text>
        <text class="modal-subtitle">按概率从高到低排序 · 总抽卡{{ totalDraws }}次</text>
        <scroll-view scroll-y class="pool-list">
          <view
            v-for="(card, index) in sortedPoolCards"
            :key="card.id"
            class="pool-item"
          >
            <text class="pool-rank">{{ index + 1 }}</text>
            <image class="pool-img" :src="card.image_url" mode="aspectFit"></image>
            <view class="pool-info">
              <text class="pool-name">{{ card.name }}</text>
              <text class="pool-prob">{{ (card.probability * 100).toFixed(1) }}% · {{ card.draw_count || 0 }}次被抽中</text>
            </view>
          </view>
        </scroll-view>
        <button class="close-btn" @tap="closePoolModal">关闭</button>
      </view>
    </view>

    <!-- 我的数据弹窗 -->
    <view class="modal" v-if="showDetailModal" @tap="closeDetailModal">
      <view class="modal-box detail-box" @tap.stop>
        <text class="modal-title">我的数据</text>
        
        <!-- 统计信息 -->
        <view class="detail-stats">
          <view class="detail-stat-item">
            <text class="detail-stat-num">{{ userStats.totalDraws }}</text>
            <text class="detail-stat-label">总抽卡</text>
          </view>
          <view class="detail-stat-item">
            <text class="detail-stat-num">{{ userStats.uniqueCards }}</text>
            <text class="detail-stat-label">已收集</text>
          </view>
          <view class="detail-stat-item">
            <text class="detail-stat-num">{{ userStats.monthDraws }}</text>
            <text class="detail-stat-label">本月</text>
          </view>
        </view>

        <!-- 我的卡片 -->
        <text class="detail-subtitle">我的卡片 ({{ myCards.length }})</text>
        <scroll-view scroll-y class="detail-card-list">
          <view
            v-for="card in myCards"
            :key="card.id"
            class="detail-card-item"
            @tap="viewCardDetail(card)"
          >
            <image class="detail-card-img" :src="card.image_url" mode="aspectFit"></image>
            <view class="detail-card-info">
              <text class="detail-card-name">{{ card.name }}</text>
              <text class="detail-card-count">x{{ card.count || 1 }}</text>
            </view>
          </view>
        </scroll-view>
        
        <button class="close-btn" @tap="closeDetailModal">关闭</button>
      </view>
    </view>

    <!-- 原生模板广告1 -->
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

    <!-- 名师名言 -->
    <view class="quote-box" v-if="todayQuote">
      <text class="quote-label">💡 名师口头禅</text>
      <text class="quote-text">"{{ todayQuote.quote }}"</text>
      <text class="quote-author">—— {{ todayQuote.author }}</text>
    </view>

    <!-- 抽卡动效 -->
    <view class="animation-overlay" v-if="showAnimation">
      <image class="draw-animation" src="https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1774972328440-pamhum.gif" mode="aspectFit"></image>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, getCurrentInstance } from 'vue';

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

// 状态
const isDrawing = ref(false);
const showResult = ref(false);
const canDraw = ref(true);
const todayFortune = ref('');
const drawnCard = ref(null);
const myCards = ref([]);
const remainingDraws = ref(0);
const isAddingCount = ref(false);
const showAnimation = ref(false);
const allCards = ref([]);
const showModal = ref(false);
const selectedCard = ref({});
const showPool = ref(false);
const showDetailModal = ref(false);
const userStats = ref({
  totalDraws: 0,
  uniqueCards: 0,
  streakDays: 0,
  monthDraws: 0
});
const drawHistory = ref([]);

// 按概率排序
const sortedPoolCards = computed(() => {
  return [...allCards.value].sort((a, b) => b.probability - a.probability);
});

// 计算总抽卡次数
const totalDraws = computed(() => {
  return allCards.value.reduce((sum, card) => sum + (card.draw_count || 0), 0);
});

// 稀有度文本
const getRarityText = (rarity) => {
  const map = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };
  return map[rarity] || rarity;
};

// 层级图标
const tierIcons = {
  legendary: 'https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1775018236016-kj6htv.png',
  epic: 'https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1775018241859-vaxvfb.png',
  rare: 'https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1775018243601-dgvta9.png',
  common: 'https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1775018245255-flvsan.png',
  consolation: 'https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1775018245255-flvsan.png'
};

const getTierIcon = (tier) => {
  return tierIcons[tier] || tierIcons.common;
};

// 加载卡片
const loadCards = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.cardApi.getAllCards();
    if (res.code === 0) {
      allCards.value = res.data;
    }
  } catch (error) {
    console.error('加载卡片失败:', error);
  }
};

// 加载用户统计
const loadUserStats = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.cardApi.getUserStats();
    if (res.code === 0) {
      userStats.value = res.data;
    }
  } catch (error) {
    console.error('加载用户统计失败:', error);
  }
};

// 加载抽卡历史
const loadDrawHistory = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.cardApi.getDrawHistory(10);
    if (res.code === 0) {
      drawHistory.value = res.data;
    }
  } catch (error) {
    console.error('加载抽卡历史失败:', error);
  }
};

// 加载剩余次数
const loadRemainingDraws = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.cardApi.getRemainingDraws();
    if (res.code === 0) {
      remainingDraws.value = res.data.remaining;
    }
  } catch (error) {
    console.error('加载剩余次数失败:', error);
  }
};

// 初始化激励视频广告
const initRewardedVideoAd = () => {
  if (wx.createRewardedVideoAd) {
    rewardedVideoAd = wx.createRewardedVideoAd({
      adUnitId: 'adunit-87b769e2258374d7'
    });

    rewardedVideoAd.onLoad(() => {
      console.log('激励视频广告加载成功');
    });

    rewardedVideoAd.onError((err) => {
      console.error('激励视频广告加载失败', err);
      isAddingCount.value = false;
      uni.showToast({ title: '广告加载失败，请重试', icon: 'none' });
    });

    rewardedVideoAd.onClose((res) => {
      console.log('广告关闭回调', res);
      // 用户点击了【关闭广告】按钮
      if (res && res.isEnded) {
        // 正常播放结束，下发奖励
        console.log('广告完整播放，开始增加次数');
        addDrawCountByAd();
      } else {
        // 播放中途退出，不下发奖励
        console.log('广告未完整播放，不增加次数');
        isAddingCount.value = false;
        uni.showToast({ title: '需要完整观看视频才能获得次数', icon: 'none' });
      }
    });
  }
};

// 通过广告获取次数
const addDrawCountByAd = async () => {
  console.log('调用addDrawCount接口（通过广告）');
  try {
    const res = await instance.appContext.config.globalProperties.$api.cardApi.addDrawCount({ source: 'ad' });
    console.log('addDrawCount接口返回', res);
    if (res.code === 0) {
      remainingDraws.value = res.data.remaining;
      checkCanDraw();
      uni.showToast({
        title: res.data.message || '获得1次抽卡机会',
        icon: 'success'
      });
    } else {
      uni.showToast({ title: res.message || '获取失败', icon: 'none' });
    }
  } catch (error) {
    console.error('addDrawCount接口错误', error);
    uni.showToast({ title: '获取失败', icon: 'none' });
  } finally {
    isAddingCount.value = false;
  }
};

// 获取次数（观看激励视频）
const handleAddCount = async () => {
  if (isAddingCount.value) return;

  isAddingCount.value = true;

  // 检查广告是否初始化
  if (!rewardedVideoAd) {
    uni.showToast({ title: '广告未准备好，请重试', icon: 'none' });
    isAddingCount.value = false;
    return;
  }

  // 显示激励视频广告
  rewardedVideoAd.show().catch(() => {
    // 失败重试
    rewardedVideoAd.load()
      .then(() => rewardedVideoAd.show())
      .catch(err => {
        console.error('激励视频广告显示失败', err);
        isAddingCount.value = false;
        uni.showToast({ title: '广告显示失败，请重试', icon: 'none' });
      });
  });
};

// 加载我的卡片
const loadMyCards = async () => {
  try {
    const res = await instance.appContext.config.globalProperties.$api.cardApi.getMyCards();
    if (res.code === 0) {
      myCards.value = res.data;
    }
  } catch (error) {
    console.error('加载我的卡片失败:', error);
  }
};

// 检查是否可以抽卡
const checkCanDraw = async () => {
  try {
    // 根据剩余次数判断是否可抽
    canDraw.value = remainingDraws.value > 0;
  } catch (error) {
    console.error('检查抽取状态失败:', error);
  }
};

// 抽卡
const handleDraw = async () => {
  if (isDrawing.value || !canDraw.value) return;

  isDrawing.value = true;
  showResult.value = false;
  showAnimation.value = true;

  try {
    const res = await instance.appContext.config.globalProperties.$api.cardApi.drawCard();
    if (res.code === 0) {
      drawnCard.value = res.data;
      remainingDraws.value = Math.max(0, remainingDraws.value - 1);
      canDraw.value = remainingDraws.value > 0;

      // 动效播放2.5秒后显示结果
      setTimeout(() => {
        showAnimation.value = false;
        isDrawing.value = false;
        showResult.value = true;

        // 只有奖励卡牌才加入我的卡片列表并提示
        if (drawnCard.value.is_reward) {
          const existingCard = myCards.value.find(c => c.id === drawnCard.value.id);
          if (existingCard) {
            existingCard.count = (existingCard.count || 1) + 1;
          } else {
            myCards.value.push({
              ...drawnCard.value,
              count: 1
            });
          }
        }
      }, 2500);
    } else {
      showAnimation.value = false;
      isDrawing.value = false;
      uni.showToast({ title: res.message || '抽取失败', icon: 'none' });
    }
  } catch (error) {
    showAnimation.value = false;
    isDrawing.value = false;
    uni.showToast({ title: '抽取失败', icon: 'none' });
  }
};

// 查看详情
const viewCardDetail = (card) => {
  selectedCard.value = card;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
};

// 奖池
const showPoolModal = () => {
  showPool.value = true;
};

const closePoolModal = () => {
  showPool.value = false;
};

const closeDetailModal = () => {
  showDetailModal.value = false;
};

// 生成运势
const generateFortune = () => {
  const fortunes = [
    '今日宜刷题',
    '保持平常心',
    '好运连连',
    '注意休息',
    '灵感爆棚',
    '相信自己'
  ];
  todayFortune.value = fortunes[Math.floor(Math.random() * fortunes.length)];
};

// 名师名言
const famousQuotes = [
  // 数学名师
  { author: '张宇', quote: '数学之美，在于它能让复杂的问题变得简单' },
  { author: '张宇', quote: '考研数学，重在基础，难在坚持' },
  { author: '张宇', quote: '题目做三遍，其义自见' },
  { author: '张宇', quote: '立即推，复习到两点' },
  { author: '张宇', quote: '这题送分，你要是不要，我也没办法' },
  { author: '张宇', quote: '你这个年纪，你这个阶段，还在玩手机？' },
  { author: '张宇', quote: '泰勒公式是求极限的神器' },
  { author: '张宇', quote: '看到极限题，先想泰勒展开' },
  { author: '汤家凤', quote: '基础不牢，地动山摇' },
  { author: '汤家凤', quote: '计算能力是考研数学的生命线' },
  { author: '汤家凤', quote: '做题要精，不要贪多' },
  { author: '汤家凤', quote: '你怎么睡得着的？你这个年龄段，你这个阶段你睡得着觉？' },
  { author: '汤家凤', quote: '0分也是成绩，做人要坦诚' },
  { author: '武忠祥', quote: '经典错误，标准的零分' },
  { author: '武忠祥', quote: '做题要仔细，细节决定成败' },
  { author: '武忠祥', quote: '这个题，我讲过多少遍了，还错？' },
  // 政治名师
  { author: '肖秀荣', quote: '政治复习，重在理解，贵在坚持' },
  { author: '肖秀荣', quote: '肖四肖八，考研政治的神器' },
  { author: '肖秀荣', quote: '时政热点是考研政治的风向标' },
  { author: '徐涛', quote: '马原要理解，毛中特要记忆，史纲要线索' },
  { author: '徐涛', quote: '政治不是背出来的，是理解出来的' },
  { author: '徐涛', quote: '考研政治，选择题定生死' },
  { author: '徐涛', quote: '人这一辈子总该努力那一次到两次，考研一定算一次' },
  { author: '徐涛', quote: '如果考研这个起点都没有，我人生所有的规划全部作废' },
  { author: '腿姐', quote: '人只有在进步的时候才会觉得累' },
  { author: '腿姐', quote: '信念感是很重要的，读书一定是有用的' },
  { author: '腿姐', quote: '如果一个事情很轻松，它就不会给你带来任何帮助' },
  // 英语名师
  { author: '唐迟', quote: '阅读的本质是逻辑' },
  { author: '唐迟', quote: '细节服从主旨，这是阅读的黄金法则' },
  { author: '唐迟', quote: '定位、替换、排除，阅读三步走' },
  { author: '朱伟', quote: '词汇是英语的基础，没有词汇一切都是空谈' },
  { author: '朱伟', quote: '恋练有词，词以类记' },
  { author: '朱伟', quote: '背单词要结合语境，不能孤立记忆' },
  { author: '刘晓艳', quote: '不要假装努力，结果不会陪你演戏' },
  { author: '刘晓艳', quote: '考研是你这辈子最后一次公平竞争的机会' },
  { author: '刘晓艳', quote: '坚持到最后，你就是赢家' },
  { author: '刘晓艳', quote: '回家吧，回家吧孩子' },
  { author: '刘晓艳', quote: '你在背吗？还喝奶茶！' },
  { author: '刘晓艳', quote: '谁不挣扎，每天都苦，苦是人的常态' },
  { author: '刘晓艳', quote: '你可以像猪一样活着，但你不会像猪一样快乐' },
  { author: '刘晓艳', quote: '不要把希望寄托在别人身上' },
  { author: '刘晓艳', quote: '你这个年纪怎么睡得着的？' },
  { author: '刘晓艳', quote: '考研不是唯一的出路，但可能是你最好的出路' },
  { author: '刘晓艳', quote: '你现在不努力，以后就会后悔' },
  { author: '刘晓艳', quote: '学习是痛苦的，但不学习更痛苦' },
  { author: '何凯文', quote: '长难句是阅读的基础，阅读是考研英语的核心' },
  { author: '何凯文', quote: '得阅读者得天下，失阅读者失考研' },
  { author: '何凯文', quote: '每日一句，持之以恒' },
  { author: '王江涛', quote: '作文是背出来的，不是写出来的' },
  // 考研规划名师
  { author: '张雪峰', quote: '考研不是唯一出路，但对普通人来说，是改变命运性价比最高的路' },
  { author: '张雪峰', quote: '选择比努力更重要，方向不对，努力白费' },
  { author: '张雪峰', quote: '学习是你这辈子遇到过的最简单的事' },
  { author: '张雪峰', quote: '家里没矿别谈理想，先谋生再谋爱' },
  { author: '张雪峰', quote: '别假装努力，结果不会陪你演戏' },
  { author: '张雪峰', quote: '现在不吃学习的苦，将来就要吃生活的苦' },
  { author: '张雪峰', quote: '学历是敲门砖，能力是垫脚石' },
  { author: '张雪峰', quote: '信息差是普通人最大的壁垒' }
];

const todayQuote = ref(null);

const generateQuote = () => {
  const randomIndex = Math.floor(Math.random() * famousQuotes.length);
  todayQuote.value = famousQuotes[randomIndex];
};

onMounted(async () => {
  // 初始化激励视频广告
  initRewardedVideoAd();

  generateFortune();
  generateQuote();
  loadCards();
  loadMyCards();
  loadUserStats();
  loadDrawHistory();
  await loadRemainingDraws();
  checkCanDraw();
});
</script>

<style lang="scss" scoped>
/* 原生模板广告容器 */
.ad-container {
  margin: 20rpx 0;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.container {
  min-height: 100vh;
  background-image: url('https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1775023040746-ex79fg.png');
  background-size: 100% auto;
  background-position: top center;
  background-repeat: no-repeat;
  padding: 20rpx;
  padding-top: 300rpx;
}

// 剩余次数和获取按钮
// 抽卡主区域
.main-card-area {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  position: relative;
}

.draw-count-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #eee;
}

.count-display {
  text-align: center;
}

.count-label {
  font-size: 24rpx;
  color: #666;
  display: block;
  margin-bottom: 8rpx;
}

.count-num {
  font-size: 48rpx;
  color: #e74c3c;
  font-weight: 600;
  display: block;
}

.add-count-btn {
  background: linear-gradient(135deg, #e53935, #ff6b6b);
  color: #fff;
  font-size: 28rpx;
  padding: 20rpx 40rpx;
  border-radius: 30rpx;
  border: none;
  line-height: 1.5;
}

.add-count-btn[disabled] {
  background: #95a5a6;
}

// 运势
.fortune-box {
  padding: 20rpx 0;
  margin-bottom: 20rpx;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
}

.fortune-label {
  font-size: 26rpx;
  color: #999;
  display: block;
  margin-bottom: 8rpx;
}

.fortune-text {
  font-size: 32rpx;
  color: #e53935;
  font-weight: 600;
}

// 名师名言
.quote-box {
  background: linear-gradient(135deg, #e53935 0%, #ff6b6b 100%);
  border-radius: 16rpx;
  padding: 30rpx;
  margin-top: 20rpx;
}

.quote-label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  display: block;
  margin-bottom: 15rpx;
}

.quote-text {
  font-size: 30rpx;
  color: #fff;
  font-weight: 500;
  display: block;
  line-height: 1.6;
  margin-bottom: 15rpx;
}

.quote-author {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
  display: block;
  text-align: right;
}

// 抽卡区域
.card-area {
  padding: 20rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-bottom: 1rpx solid #eee;
  margin-bottom: 20rpx;
  position: relative;
}

// 查看奖池按钮 - 右上角
.pool-btn-top {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  width: 100rpx;
  height: 44rpx;
  line-height: 44rpx;
  background: #fff;
  color: #e53935;
  font-size: 22rpx;
  border-radius: 22rpx;
  border: 2rpx solid #e53935;
  padding: 0;
  z-index: 10;
}

.card-display {
  width: 400rpx;
  height: 560rpx;
  margin: 0 auto 40rpx;
  background: #f0f0f0;
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.card-back {
  text-align: center;
}

.card-icon {
  font-size: 120rpx;
  color: #999;
}

.card-tip {
  font-size: 28rpx;
  color: #666;
  margin-top: 20rpx;
  display: block;
}

.card-front {
  text-align: center;
  padding: 30rpx 30rpx 3rpx;
  border-radius: 20rpx;
  background: #fff;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
  width: 400rpx;
  height: 600rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

// 不同层级的背景色和边框效果
.front-legendary {
  background: linear-gradient(135deg, #fff9e6, #fff3cd);
  box-shadow: 0 4rpx 30rpx rgba(255, 193, 7, 0.3);
  border: 4rpx solid #ffc107;
}

.front-epic {
  background: linear-gradient(135deg, #ffcccc, #ffb3b3);
  box-shadow: 0 6rpx 40rpx rgba(231, 76, 60, 0.35);
  border: 4rpx solid #c0392b;
}

.front-rare {
  background: linear-gradient(135deg, #e6f2ff, #d6e9ff);
  box-shadow: 0 4rpx 30rpx rgba(52, 152, 219, 0.2);
  border: 2rpx solid #3498db;
}

.front-common {
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border: 2rpx solid #ddd;
}

.front-consolation {
  background: #f5f5f5;
  border: 2rpx dashed #ccc;
}

.card-img {
  width: 300rpx;
  height: 380rpx;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}

.card-desc {
  font-size: 28rpx;
  color: #666;
  margin: 20rpx 0;
  padding: 0 40rpx;
  line-height: 1.6;
  text-align: center;
}

.name-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.tier-icon {
  width: 40rpx;
  height: 40rpx;
}

.card-name {
  font-size: 36rpx;
  font-weight: 600;
  display: block;
}

// 不同层级的名称颜色
.name-legendary {
  color: #ff9500;
}

.name-epic {
  color: #e74c3c;
}

.name-rare {
  color: #3498db;
}

.name-common {
  color: #333;
}

.name-consolation {
  color: #7f8c8d;
}

.card-rarity {
  font-size: 24rpx;
  color: #999;
}

.card-count {
  font-size: 32rpx;
  color: #e74c3c;
  font-weight: 600;
  margin-top: 10rpx;
}

// 按钮
.btn-area {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12rpx;
  margin-top: 30rpx;
  margin-bottom: 20rpx;
  width: 100%;
}

.count-box {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  padding: 0 16rpx;
  height: 80rpx;
  border-radius: 12rpx;
  flex: 0 0 auto;
}

.count-box .count-label {
  font-size: 22rpx;
  color: #666;
}

.count-box .count-num {
  font-size: 32rpx;
  color: #e53935;
  font-weight: 600;
  margin: 0 6rpx;
}

.add-count-btn-small {
  flex: 0 0 auto;
  height: 80rpx;
  line-height: 80rpx;
  background: linear-gradient(135deg, #e53935, #ff6b6b);
  color: #fff;
  font-size: 24rpx;
  border-radius: 12rpx;
  padding: 0 12rpx;
  white-space: nowrap;
  min-width: 120rpx;
}

.draw-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  background: linear-gradient(135deg, #e53935, #ff6b6b);
  color: #fff;
  font-size: 32rpx;
  border-radius: 12rpx;
  border: none;
  white-space: nowrap;
}

.draw-btn[disabled] {
  background: #ccc;
}

.pool-btn {
  width: 200rpx;
  height: 90rpx;
  line-height: 90rpx;
  background: #fff;
  color: #e53935;
  font-size: 28rpx;
  border-radius: 12rpx;
  border: 2rpx solid #e53935;
}

.tip-text {
  font-size: 24rpx;
  color: #999;
  text-align: center;
  display: block;
}

// 弹窗
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx;
  width: 80%;
  max-width: 600rpx;
  text-align: center;
}

.modal-img {
  width: 300rpx;
  height: 400rpx;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}

.modal-name {
  font-size: 36rpx;
  color: #333;
  font-weight: 600;
  display: block;
  margin-bottom: 10rpx;
}

.modal-desc {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 10rpx;
  display: block;
}

.modal-info {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 30rpx;
  display: block;
}

.close-btn {
  width: 200rpx;
  height: 80rpx;
  line-height: 80rpx;
  background: #6366f1;
  color: #fff;
  font-size: 28rpx;
  border-radius: 12rpx;
  border: none;
}

// 奖池弹窗
.pool-box {
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.modal-title {
  font-size: 36rpx;
  color: #333;
  font-weight: 600;
  margin-bottom: 10rpx;
  display: block;
}

.modal-subtitle {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 30rpx;
  display: block;
}

.pool-list {
  max-height: 50vh;
  margin-bottom: 20rpx;
}

.pool-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #eee;
}

.pool-rank {
  width: 50rpx;
  font-size: 32rpx;
  color: #6366f1;
  font-weight: 600;
}

.pool-img {
  width: 100rpx;
  height: 130rpx;
  border-radius: 8rpx;
  margin-right: 20rpx;
}

.pool-info {
  flex: 1;
  text-align: left;
}

.pool-name {
  font-size: 30rpx;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}

.pool-prob {
  font-size: 26rpx;
  color: #e74c3c;
  font-weight: 600;
}

// 查看详情按钮
.detail-btn-box {
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #eee;
}

.detail-btn {
  background: linear-gradient(135deg, #e53935, #ff6b6b);
  color: #fff;
  border-radius: 16rpx;
  font-size: 30rpx;
  padding: 20rpx 0;
}

// 我的数据弹窗
.detail-box {
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.detail-stats {
  display: flex;
  justify-content: space-around;
  padding: 30rpx 0;
  margin-bottom: 20rpx;
  border-bottom: 1rpx solid #eee;
}

.detail-stat-item {
  text-align: center;
}

.detail-stat-num {
  font-size: 40rpx;
  color: #e53935;
  font-weight: 600;
  display: block;
}

.detail-stat-label {
  font-size: 24rpx;
  color: #666;
  margin-top: 8rpx;
  display: block;
}

.detail-subtitle {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
  margin-bottom: 20rpx;
  display: block;
}

.detail-card-list {
  max-height: 40vh;
  margin-bottom: 20rpx;
}

.detail-card-item {
  display: flex;
  align-items: center;
  padding: 20rpx;
  border-bottom: 1rpx solid #eee;
}

.detail-card-img {
  width: 100rpx;
  height: 130rpx;
  border-radius: 8rpx;
  margin-right: 20rpx;
}

.detail-card-info {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.detail-card-name {
  font-size: 30rpx;
  color: #333;
}

.detail-card-count {
  font-size: 28rpx;
  color: #e53935;
  font-weight: 600;
}

// 动效遮罩
.animation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.draw-animation {
  width: 600rpx;
  height: 800rpx;
}
</style>
