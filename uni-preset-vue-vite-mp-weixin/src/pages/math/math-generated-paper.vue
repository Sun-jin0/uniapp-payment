<template>
  <view class="paper-page">
    <view class="custom-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-left">
          <view class="back-btn" @click="goBack">
            <SvgIcon name="back" size="44" fill="#333" />
          </view>
          <view class="menu-wrapper">
            <view class="menu-btn" @click.stop="toggleToolMenu">
              <SvgIcon name="more" size="44" fill="#333" />
            </view>
            <view class="tool-menu" v-if="showToolMenu" @click.stop>
              <view class="tool-menu-item" @click="handleToolMenu('analysis')" v-if="!isWeeklyTest">
                <text class="tool-menu-icon">📝</text>
                <text class="tool-menu-text">查看解析</text>
              </view>
              <view class="tool-menu-item" @click="handleToolMenu('dataAnalysis')">
                <text class="tool-menu-icon">📊</text>
                <text class="tool-menu-text">数据分析</text>
              </view>
              <view class="tool-menu-item" @click="handleToolMenu('paperInfo')" v-if="!isSharedPaper">
                <text class="tool-menu-icon">ℹ️</text>
                <text class="tool-menu-text">试卷信息</text>
              </view>
              <view class="tool-menu-item" @click="handleToolMenu('print')">
                <text class="tool-menu-icon">🖨️</text>
                <text class="tool-menu-text">打印试卷</text>
              </view>
              <view class="tool-menu-item" @click="handleToolMenu('share')" v-if="canShare">
                <text class="tool-menu-icon">📤</text>
                <text class="tool-menu-text">分享试卷</text>
              </view>
              <view class="tool-menu-item danger" @click="handleToolMenu('delete')">
                <text class="tool-menu-icon">🗑️</text>
                <text class="tool-menu-text">删除试卷</text>
              </view>
            </view>
          </view>
        </view>
        <view class="nav-title">智能练习卷</view>
        <view class="nav-right"></view>
      </view>
    </view>
    
    <view class="paper-container" :class="{ 'loading-mask': loading }" @click="closeToolMenu">
      <main class="paper-content" id="paper-content" :style="{ fontSize: baseFontSize + 'px' }">
      <div class="paper-header">
        <h1 class="main-title" :style="{ fontSize: (baseFontSize + 12) + 'px' }">{{ paper.Title }}</h1>
        <div class="paper-info" :style="{ fontSize: (baseFontSize - 2) + 'px' }">
          <span>科目：{{ subjectName }}</span>
          <span>题目数量：{{ paper.questions?.length || 0 }}</span>
          <span>生成时间：{{ formatDate(paper.CreatedAt) }}</span>
        </div>
      </div>

      <div class="questions-list">
        <div v-for="(q, index) in paper.questions" :key="q.QuestionID" class="question-item">
          <div class="question-header">
            <div class="q-left">
              <span class="question-num">{{ index + 1 }}.</span>
              <span class="question-type-tag">{{ q.QuestionType }}</span>
            </div>
            <div class="q-right no-print">
              <template v-if="!isSharedPaper">
                <div class="reorder-btns">
                  <text class="reorder-btn" @click="moveQuestion(index, -1)" :class="{ disabled: index === 0 }">上移</text>
                  <text class="reorder-btn" @click="moveQuestion(index, 1)" :class="{ disabled: index === paper.questions.length - 1 }">下移</text>
                </div>
                <text class="replace-btn" @click="replaceQuestion(q, index)">换一题</text>
              </template>
              <button class="correction-btn" @click="openCorrectionModal(q.QuestionID)">纠错</button>
            </div>
          </div>
          
          <div class="question-body">
            <!-- #ifdef H5 -->
            <div class="question-text" v-html="formatLatex(q.QuestionText)"></div>
            <!-- #endif -->
            <!-- #ifdef MP-WEIXIN -->
            <mp-html class="question-text" :content="q.QuestionText" markdown copy-link="false"></mp-html>
            <!-- #endif -->
          </div>
          
          <div class="question-footer no-print" v-if="!isWeeklyTest">
            <span class="source-tag">来源：{{ q.BookTitle }}</span>
            <span class="chapter-tag">{{ q.BookChapter }}</span>
          </div>

          <div class="question-footer-print only-print" v-if="!isWeeklyTest">
            来源：{{ q.BookTitle }} - {{ q.BookChapter }}
          </div>
        </div>
      </div>
    </main>

    <!-- 试卷信息弹窗 -->
    <div class="modal" v-if="showInfoModal" @click="showInfoModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>试卷配置信息</h3>
          <span class="close-btn" @click="showInfoModal = false">×</span>
        </div>
        <div class="modal-body" v-if="paper.Config">
          <div class="info-item">
            <label>生成标题：</label>
            <div class="title-edit-row">
              <input 
                type="text" 
                class="title-input" 
                v-model="paper.Title" 
                placeholder="请输入试卷名称"
                maxlength="100"
              />
              <button class="save-title-btn" @click="saveTitle">保存</button>
            </div>
          </div>
          <div class="info-item">
            <label>包含书籍：</label>
            <div class="book-list">
              <div v-for="item in paperConfig.scope" :key="item.bookId" class="book-info">
                <div class="book-name">📖 {{ getBookName(item.bookId) }}</div>
                <div class="chapter-names">{{ item.chapters.length > 0 ? item.chapters.join('、') : '全本书籍' }}</div>
              </div>
            </div>
          </div>
          <div class="info-item">
            <label>题目分布：</label>
            <span>选择题:{{ paperConfig.counts.choice }} | 填空题:{{ paperConfig.counts.fill }} | 解答题:{{ paperConfig.counts.analysis }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据分析弹窗 -->
    <div class="modal" v-if="showAnalysisModal" @click="showAnalysisModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>试卷数据分析</h3>
          <span class="close-btn" @click="showAnalysisModal = false">×</span>
        </div>
        <div class="modal-body analysis-body">
          <section class="analysis-item">
            <h4 class="analysis-sub-title">1. 题型分布</h4>
            <div class="stats-bars">
              <div v-for="(count, type) in analysisData.typeDist" :key="type" class="stat-bar-item">
                <span class="stat-label">{{ type }}</span>
                <div class="bar-bg">
                  <div class="bar-fill" :style="{ width: (count / paper.questions.length * 100) + '%' }"></div>
                </div>
                <span class="stat-count">{{ count }}题</span>
              </div>
            </div>
          </section>

          <section class="analysis-item">
            <h4 class="analysis-sub-title">2. 知识点覆盖 (Top 5)</h4>
            <div class="kp-stats">
              <div v-for="kp in analysisData.topKps" :key="kp.name" class="kp-stat-item">
                <span class="kp-name">{{ kp.name }}</span>
                <span class="kp-count">{{ kp.count }}次</span>
              </div>
              <div v-if="analysisData.topKps.length === 0" class="no-data">暂无考点信息</div>
            </div>
          </section>

          <section class="analysis-item">
            <h4 class="analysis-sub-title">3. 章节分布</h4>
            <div class="chapter-stats">
              <div v-for="chap in analysisData.chapterDist" :key="chap.name" class="chap-stat-item">
                <span class="chap-name">{{ chap.name }}</span>
                <span class="chap-count">{{ chap.count }}题</span>
              </div>
            </div>
          </section>

          <section class="analysis-item">
            <h4 class="analysis-sub-title">4. 难度分析</h4>
            <div class="difficulty-analysis">
              <div class="pie-chart-container">
                <div class="simple-pie" :style="{
                  background: `conic-gradient(
                    #4cd964 0% ${analysisData.difficultyDist.simple / paper.questions.length * 100}%, 
                    #f0ad4e ${analysisData.difficultyDist.simple / paper.questions.length * 100}% ${(analysisData.difficultyDist.simple + analysisData.difficultyDist.medium) / paper.questions.length * 100}%, 
                    #dd524d ${(analysisData.difficultyDist.simple + analysisData.difficultyDist.medium) / paper.questions.length * 100}% 100%
                  )`
                }"></div>
                <div class="pie-legend">
                  <div class="legend-item"><span class="dot simple"></span>简单: {{ analysisData.difficultyDist.simple }}题</div>
                  <div class="legend-item"><span class="dot medium"></span>中档: {{ analysisData.difficultyDist.medium }}题</div>
                  <div class="legend-item"><span class="dot hard"></span>难题: {{ analysisData.difficultyDist.hard }}题</div>
                </div>
              </div>
            </div>
          </section>

          <section class="analysis-item">
            <h4 class="analysis-sub-title">5. 题目明细表</h4>
            <div class="table-container">
              <table class="analysis-table">
                <thead>
                  <tr>
                    <th>题号</th>
                    <th>题型</th>
                    <th>难度</th>
                    <th>主要考点</th>
                    <th>来源</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in analysisData.detailedList" :key="item.index">
                    <td>{{ item.index }}</td>
                    <td>{{ item.type }}</td>
                    <td>
                      <span class="diff-tag" :class="item.difficulty === '简单' ? 'easy' : (item.difficulty === '中档' ? 'med' : 'hard')">
                        {{ item.difficulty }}
                      </span>
                    </td>
                    <td class="kp-cell">{{ item.kps.slice(0, 2).join(', ') }}{{ item.kps.length > 2 ? '...' : '' }}</td>
                    <td class="source-cell">{{ item.source }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- 纠错弹窗 -->
    <div class="correction-modal-overlay" :class="{ 'active': correctionModalOpen }" @click="closeCorrectionModal">
      <div class="correction-modal-content" @click.stop>
        <div class="correction-modal-header">
          <div class="header-title-group">
            <span class="modal-icon">⚠️</span>
            <h2 class="correction-modal-title">题目纠错</h2>
          </div>
          <button class="correction-modal-close-btn" @click="closeCorrectionModal" aria-label="关闭">×</button>
        </div>
        <div class="correction-modal-body">
          <div class="correction-type-grid">
            <div 
              v-for="type in correctionTypes" 
              :key="type" 
              class="type-tag"
              :class="{ active: selectedCorrectionType === type }"
              @click="selectedCorrectionType = type"
            >
              {{ type }}
            </div>
          </div>
          <textarea 
            v-model="correctionContent" 
            placeholder="请详细描述错误内容，例如：公式显示异常、答案错误、解析不清晰等..." 
            class="correction-textarea"
          ></textarea>
          <div class="correction-footer">
            <p class="correction-tip">感谢您的反馈，我们将尽快核实并修正。</p>
            <button class="correction-submit-btn" :disabled="!isCorrectionValid" @click="submitCorrection">提交反馈</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 打印选项弹窗 -->
    <div class="modal" v-if="showPrintOptionsModal" @click="handlePrintOption('cancel')">
      <div class="modal-content print-options-content" @click.stop>
        <div class="modal-header">
          <h3>打印设置</h3>
          <span class="close-btn" @click="handlePrintOption('cancel')">×</span>
        </div>
        <div class="modal-body">
          <div class="print-options-info">
            <p class="print-option-item">
              <span class="option-label">仅试卷：</span>
              <span class="option-value">观看广告即可打印</span>
            </p>
            <p class="print-option-item">
              <span class="option-label">试卷+解析：</span>
              <span class="option-value" :class="{ 'has-count': printOptionsData.canPrintAnalysis, 'no-count': !printOptionsData.canPrintAnalysis }">
                {{ printOptionsData.canPrintAnalysis ? `剩余 ${printOptionsData.analysisRemaining}` : '次数已用完' }}
              </span>
            </p>
          </div>
          <p class="print-options-question">请选择打印方式：</p>
        </div>
        <div class="modal-footer print-options-footer">
          <div class="print-options-row">
            <button class="confirm-btn secondary" @click="handlePrintOption('withoutAnalysis')">仅试卷</button>
            <button 
              class="confirm-btn" 
              :disabled="!printOptionsData.canPrintAnalysis"
              :class="{ 'disabled': !printOptionsData.canPrintAnalysis }"
              @click="handlePrintOption('withAnalysis')"
            >
              试卷+解析
            </button>
          </div>
          <div class="print-options-row">
            <button class="cancel-btn full-width" @click="handlePrintOption('cancel')">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 打印提示弹窗（带倒计时） -->
    <div class="modal" v-if="showPrintAlert" @click="closePrintAlert">
      <div class="modal-content print-alert-content" @click.stop>
        <div class="modal-header">
          <h3>{{ printAlertTitle }}</h3>
        </div>
        <div class="modal-body">
          <div class="print-alert-text" style="white-space: pre-line; line-height: 1.8;">{{ printAlertContent }}</div>
        </div>
        <div class="modal-footer">
          <button 
            class="confirm-btn" 
            :disabled="!printAlertCanClose"
            :class="{ 'disabled': !printAlertCanClose }"
            @click="closePrintAlert"
          >
            {{ printAlertCanClose ? '知道了' : `请阅读 ${printAlertCountdown} 秒` }}
          </button>
        </div>
      </div>
    </div>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { request, BASE_URL } from '../../api/request';
import { transformContextString, parseTextWithLatexForMp } from '../../utils/latex';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';
import { checkTextContent } from '@/utils/contentSecurity.js';
import { copyToClipboard } from '@/utils/clipboard.js';
import MpHtml from './components/mp-html/mp-html.vue';

const statusBarHeight = ref(0);
const showToolMenu = ref(false);
const paperId = ref(null);
const paper = ref({
  Title: '',
  Config: null,
  questions: [],
  IsShared: 0,
  IsWeeklyTest: 0
});

// 是否为共享试卷（通过分享码获取的）
const isSharedPaper = computed(() => {
  return paper.value.IsShared === 1;
});

// 是否为周测试卷
const isWeeklyTest = computed(() => {
  return paper.value.IsWeeklyTest === 1;
});

// 是否为管理员（role不等于0即为管理员）
const isAdmin = computed(() => {
  const role = uni.getStorageSync('role');
  return role !== 0 && role !== '0';
});

// 是否可以分享（管理员可以分享所有，非管理员只能分享自己的）
const canShare = computed(() => {
  if (isAdmin.value) return true;
  return !isSharedPaper.value;
});
const subjectName = ref('');
const loading = ref(true);
const displayMode = ref('text');
const showInfoModal = ref(false);
const showAnalysisModal = ref(false);
const paperConfig = ref({ scope: [], counts: {} });
const booksList = ref([]);
const showMoreMenu = ref(false);

// 打印提示弹窗状态
const showPrintAlert = ref(false);
const printAlertContent = ref('');
const printAlertTitle = ref('');
const printAlertCountdown = ref(3);
const printAlertTimer = ref(null);
const printAlertCanClose = ref(false);

// 打印选项弹窗状态
const showPrintOptionsModal = ref(false);
const printOptionsData = ref({
  canPrintAnalysis: true,
  canPrintPaper: true
});

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

// 待执行的打印选项
let pendingPrintOption = null;

// 显示激励视频广告并执行打印
const showRewardedAdAndPrint = (option) => {
  pendingPrintOption = option;

  // #ifdef MP-WEIXIN
  if (!rewardedVideoAd) {
    initRewardedVideoAd();
  }

  if (rewardedVideoAd) {
    // 监听广告关闭事件
    const onAdClose = (res) => {
      rewardedVideoAd.offClose(onAdClose);
      if (res && res.isEnded) {
        // 正常播放结束，执行打印
        console.log('广告观看完成，执行打印');
        executePrint(pendingPrintOption);
      } else {
        // 播放中途退出
        console.log('广告观看中途退出');
        uni.showToast({ title: '需要完整观看广告才能打印', icon: 'none' });
      }
    };

    rewardedVideoAd.onClose(onAdClose);

    rewardedVideoAd.show().catch(() => {
      // 失败重试
      rewardedVideoAd.load()
        .then(() => rewardedVideoAd.show())
        .catch(err => {
          console.error('激励视频广告显示失败', err);
          // 广告显示失败时，直接允许打印
          uni.showToast({ title: '广告加载失败，免费为您打印', icon: 'none' });
          executePrint(pendingPrintOption);
        });
    });
  } else {
    // 不支持广告，直接打印
    executePrint(pendingPrintOption);
  }
  // #endif

  // #ifndef MP-WEIXIN
  // 非微信小程序环境，直接打印
  executePrint(pendingPrintOption);
  // #endif
};

// 处理试卷+解析打印（带次数检查）
const handlePrintWithAnalysis = () => {
  const analysisRemaining = printPermission.value.analysis.remaining;
  const hasUnlimitedAnalysis = analysisRemaining === null || analysisRemaining === -1;
  const canPrintAnalysis = printPermission.value.analysis.allowed && (hasUnlimitedAnalysis || analysisRemaining > 0);

  if (canPrintAnalysis) {
    // 有次数，直接打印（不观看广告）
    generatePrintLink(true);
  } else {
    // 无次数，不能打印解析
    uni.showModal({
      title: '解析打印次数已用完',
      content: '您今日解析打印次数已用完，无法打印试卷+解析。您可以选择仅打印试卷（需观看广告）。',
      showCancel: false,
      confirmText: '知道了'
    });
  }
};

// 执行打印
const executePrint = (option) => {
  if (option === 'withAnalysis') {
    generatePrintLink(true);
  } else if (option === 'withoutAnalysis') {
    generatePrintLink(false);
  }
};

// 处理打印选项
const handlePrintOption = (option) => {
  showPrintOptionsModal.value = false;
  if (option === 'cancel') {
    return;
  }

  if (option === 'withoutAnalysis') {
    // 仅试卷：观看广告后打印
    showRewardedAdAndPrint('withoutAnalysis');
  } else if (option === 'withAnalysis') {
    // 试卷+解析：检查次数，有次数直接打印，无次数提示观看广告
    handlePrintWithAnalysis();
  }
};

// 显示打印提示弹窗（带倒计时）
const showPrintAlertWithCountdown = (title, content) => {
  printAlertTitle.value = title;
  printAlertContent.value = content;
  printAlertCountdown.value = 3;
  printAlertCanClose.value = false;
  showPrintAlert.value = true;
  
  // 清除之前的定时器
  if (printAlertTimer.value) {
    clearInterval(printAlertTimer.value);
  }
  
  // 开始倒计时
  printAlertTimer.value = setInterval(() => {
    printAlertCountdown.value--;
    if (printAlertCountdown.value <= 0) {
      printAlertCanClose.value = true;
      clearInterval(printAlertTimer.value);
      printAlertTimer.value = null;
    }
  }, 1000);
};

// 关闭打印提示弹窗
const closePrintAlert = () => {
  if (!printAlertCanClose.value) return;
  showPrintAlert.value = false;
  if (printAlertTimer.value) {
    clearInterval(printAlertTimer.value);
    printAlertTimer.value = null;
  }
};

const goBack = () => {
  uni.navigateBack();
};

const toggleToolMenu = () => {
  showToolMenu.value = !showToolMenu.value;
};

const closeToolMenu = () => {
  showToolMenu.value = false;
};

const handleToolMenu = (action) => {
  console.log('工具菜单点击:', action);
  showToolMenu.value = false;
  switch (action) {
    case 'analysis':
      goToAnalysis();
      break;
    case 'dataAnalysis':
      showDataAnalysis();
      break;
    case 'paperInfo':
      showPaperInfo();
      break;
    case 'print':
      console.log('触发打印功能');
      handlePrint();
      break;
    case 'share':
      handleSharePaper();
      break;
    case 'delete':
      confirmDelete();
      break;
  }
};

// 纠错相关状态
const correctionModalOpen = ref(false);
const correctionContent = ref('');
const correctionTypes = ['内容错误', '图片模糊', '解析有误', '分类错误', '其他问题'];
const selectedCorrectionType = ref('内容错误');
const currentCorrectionQid = ref(null);

const isCorrectionValid = computed(() => {
  return correctionContent.value.trim().length >= 2;
});

const openCorrectionModal = (qid) => {
  currentCorrectionQid.value = qid;
  correctionModalOpen.value = true;
};

const closeCorrectionModal = () => {
  correctionModalOpen.value = false;
  correctionContent.value = '';
  selectedCorrectionType.value = '内容错误';
  currentCorrectionQid.value = null;
};

const submitCorrection = async () => {
  if (!isCorrectionValid.value) {
    uni.showToast({ title: '请详细描述错误内容', icon: 'none' });
    return;
  }

  // 内容安全检测
  uni.showLoading({ title: '内容检测中...' });
  const checkResult = await checkTextContent(correctionContent.value);
  uni.hideLoading();

  if (!checkResult.isSafe) {
    uni.showToast({
      title: checkResult.message,
      icon: 'none',
      duration: 3000
    });
    return;
  }

  try {
    await request({
      url: '/math/corrections',
      method: 'POST',
      data: {
        questionId: currentCorrectionQid.value,
        type: selectedCorrectionType.value,
        content: correctionContent.value,
        paperId: paperId.value
      }
    });
    uni.showToast({ title: '反馈已提交', icon: 'success' });
    closeCorrectionModal();
  } catch (error) {
    console.error('Failed to submit correction:', error);
    uni.showToast({ title: '提交失败，请稍后重试', icon: 'none' });
  }
};

const toggleMoreMenu = () => {
  showMoreMenu.value = !showMoreMenu.value;
};

const baseFontSize = ref(16);

const handleFontSizeChange = (e) => {
  baseFontSize.value = e.detail.value;
};

const editKp = async (q) => {
  uni.showModal({
    title: '修改考点',
    content: q.LinkNames || '',
    placeholderText: '请输入考点，多个考点用逗号隔开',
    editable: true,
    success: async (res) => {
      if (res.confirm) {
        const newKps = res.content.trim();
        try {
          await request({
                    url: `/math/questions/${q.QuestionID}/kps`,
                    method: 'PUT',
                    data: { kps: newKps }
                  });
                  
                  // 强制触发响应式更新
                  const qIndex = paper.value.questions.findIndex(item => item.QuestionID === q.QuestionID);
                  if (qIndex !== -1) {
                    // 使用 spread 语法创建一个新对象，确保 Vue 能检测到变化
                    paper.value.questions[qIndex] = {
                      ...paper.value.questions[qIndex],
                      LinkNames: newKps
                    };
                    // 也可以通过 paper.value = { ...paper.value } 来确保整体更新
                  }
                  
                  uni.showToast({ title: '修改成功', icon: 'success' });
        } catch (err) {
          console.error('Update KP error:', err);
          uni.showToast({ title: '修改失败', icon: 'none' });
        }
      }
    }
  });
};

const analysisData = computed(() => {
  if (!paper.value.questions) return { typeDist: {}, topKps: [], chapterDist: [], difficultyDist: { simple: 0, medium: 0, hard: 0 }, detailedList: [] };
  
  const typeDist = {};
  const kpMap = {};
  const chapterMap = {};
  const difficultyDist = { simple: 0, medium: 0, hard: 0 };
  const detailedList = [];
  
  paper.value.questions.forEach((q, index) => {
    // 题型分布
    typeDist[q.QuestionType] = (typeDist[q.QuestionType] || 0) + 1;
    
    // 考点统计
    let kps = [];
    if (q.LinkNames) {
      kps = q.LinkNames.split(/[,，]/).map(s => s.trim()).filter(s => s);
      kps.forEach(name => {
        kpMap[name] = (kpMap[name] || 0) + 1;
      });
    }
    
    // 章节分布
    const chapName = q.BookChapter || '未知章节';
    chapterMap[chapName] = (chapterMap[chapName] || 0) + 1;

    // 难度分布
    const diff = parseFloat(q.Difficulty) || 0;
    let difficultyLabel = '简单';
    if (diff > 0.7 || diff > 3) {
      difficultyDist.hard++;
      difficultyLabel = '难题';
    } else if (diff > 0.4 || diff > 1.5) {
      difficultyDist.medium++;
      difficultyLabel = '中档';
    } else {
      difficultyDist.simple++;
      difficultyLabel = '简单';
    }

    detailedList.push({
      index: index + 1,
      type: q.QuestionType,
      difficulty: difficultyLabel,
      kps: kps.length > 0 ? kps : ['综合知识点'],
      source: q.BookTitle || '未知来源',
    });
  });
  
  const topKps = Object.entries(kpMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
    
  const chapterDist = Object.entries(chapterMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
    
  return { typeDist, topKps, chapterDist, difficultyDist, detailedList };
});

const showDataAnalysis = () => {
  showAnalysisModal.value = true;
};

const parseKps = (kpStr) => {
  if (!kpStr) return [];
  return kpStr.split(/[,，]/).filter(s => s.trim());
};

const toggleKps = (index) => {
  if (paper.value.questions[index]) {
    paper.value.questions[index].showAllKps = !paper.value.questions[index].showAllKps;
  }
};

const setDisplayMode = (mode) => {
  displayMode.value = mode;
  if (mode === 'text') {
    nextTick(() => renderMath());
  }
};

const fetchPaper = async () => {
  loading.value = true;
  try {
    const res = await request({
      url: `/math/smart-paper/${paperId.value}`
    });
    
    if (res.data && res.data.questions) {
      res.data.questions = res.data.questions.map(q => ({
        ...q,
        showAllKps: false
      }));
    }
    
    paper.value = res.data;
    
    if (paper.value.Config) {
      paperConfig.value = typeof paper.value.Config === 'string' 
        ? JSON.parse(paper.value.Config) 
        : paper.value.Config;
    }
    
    // Get subject name
    const subRes = await request({ url: '/math/subjects' });
    const sub = subRes.data.find(s => s.id === paper.value.SubjectID);
    subjectName.value = sub ? sub.name : '未知科目';
    
    // Get books info for modal
    const booksRes = await request({ url: '/math/books/all' });
    booksList.value = booksRes.data || [];
    
    await nextTick();
    if (displayMode.value === 'text') {
      renderMath();
    }
  } catch (err) {
    console.error('Fetch paper error:', err);
    uni.showToast({ title: '加载试卷失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const getBookName = (bookId) => {
  const book = booksList.value.find(b => b.BookID === bookId);
  return book ? book.BookTitle : '未知书籍';
};

const showPaperInfo = () => {
  showInfoModal.value = true;
};

const saveTitle = async () => {
  const newTitle = paper.value.Title?.trim();
  if (!newTitle) {
    uni.showToast({ title: '标题不能为空', icon: 'none' });
    return;
  }
  try {
    await request({
      url: `/math/smart-paper/${paperId.value}/title`,
      method: 'PUT',
      data: { title: newTitle }
    });
    uni.showToast({ title: '保存成功', icon: 'success' });
  } catch (err) {
    console.error('Save title error:', err);
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
};

const editTitle = () => {
  uni.showModal({
    title: '修改试卷标题',
    editable: true,
    placeholderText: '请输入新的标题',
    content: paper.value.Title,
    success: async (res) => {
      if (res.confirm) {
        // 允许清空或输入新标题，但必须点击确定
        const newTitle = res.content ? res.content.trim() : '';
        if (!newTitle) {
          uni.showToast({ title: '标题不能为空', icon: 'none' });
          return;
        }
        try {
          await request({
            url: `/math/smart-paper/${paperId.value}/title`,
            method: 'PUT',
            data: { title: newTitle }
          });
          paper.value.Title = newTitle;
          uni.showToast({ title: '修改成功', icon: 'success' });
        } catch (err) {
          console.error('Update title error:', err);
          uni.showToast({ title: '修改失败', icon: 'none' });
        }
      }
    }
  });
};

const confirmDelete = () => {
  uni.showModal({
    title: '提示',
    content: '确定要删除这份试卷吗？删除后不可恢复。',
    confirmColor: '#ff3b30',
    success: async (res) => {
      if (res.confirm) {
        try {
          await request({
            url: `/math/smart-paper/${paperId.value}`,
            method: 'DELETE'
          });
          uni.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => {
            uni.navigateBack();
          }, 1500);
        } catch (err) {
          uni.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    }
  });
};

const formatLatex = (text) => {
  return transformContextString(text || '');
};

const renderMath = () => {
  if (typeof renderMathInElement !== 'undefined') {
    const el = document.getElementById('paper-content');
    if (!el) return;
    
    try {
      renderMathInElement(el, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false
      });
    } catch (err) {
      console.warn('MathJax render error:', err);
    }
  }
};

const onImgLoad = () => {
  // 可以在图片加载后重新调整布局或渲染
};

const replaceQuestion = async (q, index) => {
  uni.showLoading({ title: '正在寻找新题...', mask: true });
  try {
    const res = await request({
      url: `/math/smart-paper/${paperId.value}/replace-question`,
      method: 'POST',
      data: {
        oldQuestionId: q.QuestionID,
        sortOrder: q.SortOrder
      }
    });
    
    if (res.code === 0) {
      // 模拟一点时间，让用户感觉到是在“实时寻找”
      await new Promise(resolve => setTimeout(resolve, 800));
      await fetchPaper();
      uni.showToast({ title: '已更换', icon: 'success' });
    } else {
      uni.showToast({ title: res.message || '换题失败', icon: 'none' });
    }
  } catch (err) {
    console.error('Replace question error:', err);
    uni.showToast({ title: '换题失败', icon: 'none' });
  } finally {
    uni.hideLoading();
  }
};

// 分享试卷 - 获取或生成分享编码
const handleSharePaper = async () => {
  if (!paperId.value) {
    uni.showToast({ title: '试卷ID不存在', icon: 'none' });
    return;
  }
  
  // 只有管理员才能选择设为周测
  if (isAdmin.value) {
    uni.showActionSheet({
      title: '分享设置',
      itemList: ['普通分享', '设为周测'],
      success: async (res) => {
        const weeklyTest = res.tapIndex === 1;
        await generateShareCode(weeklyTest);
      }
    });
  } else {
    // 非管理员直接普通分享
    await generateShareCode(false);
  }
};

// 生成分享码
const generateShareCode = async (isWeeklyTest = false) => {
  console.log('开始分享试卷，paperId:', paperId.value, '是否周测:', isWeeklyTest);
  uni.showLoading({ title: '生成分享码...' });
  
  try {
    const res = await request({
      url: `/math/paper/${paperId.value}/share-code`,
      method: 'POST',
      data: {
        isWeeklyTest: isWeeklyTest
      }
    });
    
    console.log('分享码接口返回:', res);
    uni.hideLoading();
    
    if ((res.code === 200 || res.code === 0) && res.data && res.data.code) {
      const shareCode = res.data.code;
      const shareType = isWeeklyTest ? '周测' : '普通';
      console.log('获取到分享码:', shareCode, '类型:', shareType);
      
      // 复制到剪贴板
      await copyToClipboard(shareCode, {
        successMsg: `${shareType}分享码已复制`,
        modalTitle: `${shareType}分享码生成成功`,
        showModal: true
      });
    } else {
      console.error('接口返回错误:', res);
      uni.showToast({ title: res.message || '生成分享码失败', icon: 'none' });
    }
  } catch (err) {
    uni.hideLoading();
    console.error('生成分享码失败:', err);
    uni.showToast({ title: '生成分享码失败: ' + (err.message || '未知错误'), icon: 'none' });
  }
};

// 打印权限信息（仅用于检查解析打印次数）
const printPermission = ref({
  print: { allowed: true, remaining: null },
  analysis: { allowed: false, remaining: 0 }
});

// 获取打印权限（仅获取解析次数）
const fetchPrintPermission = async () => {
  try {
    const res = await request({
      url: '/math/print-permission',
      method: 'GET'
    });
    if (res.code === 0 && res.data) {
      printPermission.value = res.data;
    }
  } catch (err) {
    console.error('获取打印权限失败:', err);
  }
};

const handlePrint = async () => {
  console.log('开始打印流程');
  
  // 获取解析打印权限
  await fetchPrintPermission();
  
  const analysisRemaining = printPermission.value.analysis.remaining;
  const hasUnlimitedAnalysis = analysisRemaining === null || analysisRemaining === -1;
  const canPrintAnalysis = printPermission.value.analysis.allowed && (hasUnlimitedAnalysis || analysisRemaining > 0);
  
  // 显示打印选项弹窗
  showPrintOptionsModal.value = true;
  printOptionsData.value = {
    canPrintAnalysis: canPrintAnalysis,
    analysisRemaining: hasUnlimitedAnalysis ? '无限制' : `${analysisRemaining}次`
  };
};

// 生成加密打印链接
const generatePrintLink = async (allowAnalysis) => {
  uni.showLoading({ title: '生成打印链接...' });
  console.log('生成打印链接, paperId:', paperId.value, 'allowAnalysis:', allowAnalysis);
  
  try {
    const res = await request({
      url: '/math/generate-print-link',
      method: 'POST',
      data: {
        paperId: paperId.value,
        allowAnalysis: allowAnalysis
      }
    });
    
    console.log('生成打印链接响应:', res);
    
    if (res.code === 0 && res.data) {
      const { printUrl, allowAnalysis: canPrintAnalysis } = res.data;
      console.log('打印链接:', printUrl);
      
      const success = await copyToClipboard(printUrl, {
        successMsg: '打印链接已复制',
        showModal: false
      });
      
      if (success) {
        const content = `打印链接已复制到剪贴板。${canPrintAnalysis ? '（包含解析）' : ''}\n\n⚠️ 重要提示：\n1. 链接有效期为18小时，请在有效期内完成打印\n2. 打印次数已扣除，无法恢复\n\n请在电脑浏览器中打开此链接进行打印。`;
        showPrintAlertWithCountdown('复制成功', content);
      } else {
        const content = `请手动复制链接：\n${printUrl}\n\n⚠️ 重要提示：\n1. 链接有效期为18小时，请在有效期内完成打印\n2. 打印次数已扣除，无法恢复`;
        showPrintAlertWithCountdown('复制失败', content);
      }
    } else {
      uni.showToast({ title: res.message || '生成链接失败', icon: 'none' });
    }
  } catch (err) {
    console.error('生成打印链接失败:', err);
    uni.showToast({ title: '生成链接失败: ' + (err.message || ''), icon: 'none' });
  } finally {
    uni.hideLoading();
  }
};

const moveQuestion = async (index, direction) => {
  const questions = [...paper.value.questions];
  const targetIndex = index + direction;
  
  if (targetIndex < 0 || targetIndex >= questions.length) return;
  
  // 交换位置
  const temp = questions[index];
  questions[index] = questions[targetIndex];
  questions[targetIndex] = temp;
  
  // 更新本地排序值
  questions.forEach((q, idx) => {
    q.SortOrder = idx + 1;
  });
  
  paper.value.questions = questions;
  
  // 同步到服务器
  try {
    await request({
      url: `/math/smart-paper/${paperId.value}/reorder`,
      method: 'PUT',
      data: {
        questionOrders: questions.map(q => ({
          questionId: q.QuestionID,
          sortOrder: q.SortOrder
        }))
      }
    });
  } catch (err) {
    console.error('Reorder error:', err);
    uni.showToast({ title: '排序同步失败', icon: 'none' });
  }
};

const goToAnalysis = () => {
  uni.navigateTo({
    url: `/pages/math/math-generated-paper-analysis?paperId=${paperId.value}`
  });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const fetchQuestionsByIds = async (ids) => {
  loading.value = true;
  try {
    const response = await request({
      url: `/math/questions/batch`,
      method: 'POST',
      data: { ids: ids.split(',') }
    });
    
    if (response.data) {
      // 模拟试卷结构
      paper.value = {
        Title: '收藏题目练习卷',
        CreatedAt: new Date().toISOString(),
        questions: response.data.map((q, index) => ({
          ...q,
          SortOrder: index + 1
        }))
      };
      subjectName.value = '收藏题目';
    }
  } catch (err) {
    console.error('Fetch questions error:', err);
    uni.showToast({ title: '加载题目失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

onLoad((options) => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 0;
  
  if (options.paperId) {
    paperId.value = options.paperId;
    fetchPaper();
  } else if (options.ids) {
    fetchQuestionsByIds(options.ids);
  } else {
    uni.showToast({ title: '参数错误', icon: 'none' });
    setTimeout(() => goBack(), 1500);
  }
  
  // #ifdef MP-WEIXIN
  // 预加载激励视频广告
  initRewardedVideoAd();
  // #endif
});
</script>

<style scoped>
.paper-page {
  min-height: 100vh;
  background-color: #fff;
}

.custom-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #fff;
  z-index: 999;
  border-bottom: 1px solid #f0f0f0;
}

.nav-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 16px;
}

.nav-left {
  display: flex;
  align-items: center;
  padding: 8px;
  margin-left: -8px;
}

.nav-left:active {
  opacity: 0.6;
}

.back-text-btn {
  font-size: 16px;
  color: #333;
  padding: 8px 12px;
  margin-left: -8px;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: #333;
  flex: 1;
  text-align: center;
}

.nav-right {
  position: relative;
  display: flex;
  align-items: center;
  padding: 8px;
  margin-right: -8px;
}

.nav-right:active {
  opacity: 0.6;
}

.menu-wrapper {
  position: relative;
}

.menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 140px;
  overflow: hidden;
  z-index: 1000;
}

.tool-menu-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  gap: 10px;
  transition: background 0.2s;
}

.tool-menu-item:active {
  background: #f5f5f5;
}

.tool-menu-item.danger .tool-menu-text {
  color: #ff3b30;
}

.tool-menu-icon {
  font-size: 18px;
}

.tool-menu-text {
  font-size: 15px;
  color: #333;
}

.paper-container {
  min-height: 100vh;
  background-color: #fff;
  color: #000;
  padding-top: 44px;
}

.back-btn {
  background: none;
  border: none;
  padding: 10rpx 20rpx;
  font-size: 36rpx;
  color: #666;
  line-height: 1;
}

.top-bar {
  background: #fff;
  border-bottom: 2rpx solid #f0f0f0;
  position: sticky;
  top: 0;
  z-index: 100;
  padding-top: 20rpx;
}

.top-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 30rpx;
}

.paper-title-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin: 0 15rpx;
}

.paper-title {
  font-size: 32rpx;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300rpx;
}

.edit-icon {
  font-size: 24rpx;
  color: #007aff;
  cursor: pointer;
}

/* 考点样式 */
.knowledge-points-container {
  margin-top: 20rpx;
  padding: 15rpx 20rpx;
  background-color: #f9f9f9;
  border-radius: 8rpx;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10rpx;
}

.kp-label {
  font-size: 0.85em;
  color: #666;
  font-weight: bold;
  margin-top: 4rpx;
}

.kp-list {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  max-height: 44rpx; /* 一行的高度 */
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.kp-list.expanded {
  max-height: 500rpx;
}

.kp-tag {
  font-size: 0.7em;
  color: #007aff;
  background-color: rgba(0, 122, 255, 0.1);
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  white-space: nowrap;
}

.kp-tag.custom {
  color: #666;
  background-color: #f5f5f5;
  border: 1rpx solid #ddd;
}

.kp-tag.detail-kp {
  color: #52c41a;
  background-color: #f6ffed;
  border: 1rpx solid #b7eb8f;
}

.expand-toggle {
  font-size: 0.7em;
  color: #007aff;
  cursor: pointer;
  padding: 4rpx 10rpx;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.font-ctrl {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  padding: 4rpx 12rpx;
  border-radius: 30rpx;
  margin-right: 10rpx;
}

.ctrl-label {
  font-size: 20rpx;
  color: #666;
  white-space: nowrap;
}

.font-slider {
  width: 120rpx;
  margin: 0 10rpx;
}

.action-icon-btn {
  background: none;
  border: none;
  padding: 10rpx;
  font-size: 36rpx;
  color: #666;
  line-height: 1;
}

.delete-btn {
  color: #ff3b30;
}

.mode-switch-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10rpx 30rpx 20rpx;
  border-top: 1rpx solid #f9f9f9;
}

.mode-tabs {
  display: flex;
  background: #f0f0f0;
  border-radius: 30rpx;
  padding: 4rpx;
}

.mode-tab {
  padding: 8rpx 24rpx;
  font-size: 24rpx;
  color: #666;
  border-radius: 26rpx;
  transition: all 0.3s;
}

.mode-tab.active {
  background: #fff;
  color: #007aff;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.1);
}

.analysis-toggle {
  font-size: 24rpx;
  color: #007aff;
  font-weight: 500;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20rpx;
}

.q-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.question-footer {
  margin-top: 15rpx;
  padding-top: 10rpx;
  border-top: 1rpx dashed #eee;
  display: flex;
  gap: 15rpx;
  font-size: 0.75em;
  color: #999;
}

.source-tag {
  color: #007aff;
  background: #f0f7ff;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.no-img-tip {
  background: #fff8e1;
  color: #f57c00;
  padding: 16rpx;
  font-size: 24rpx;
  border-radius: 8rpx;
  margin-bottom: 20rpx;
}

/* Modal Styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  width: 85%;
  border-radius: 24rpx;
  overflow: hidden;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  font-size: 32rpx;
  font-weight: bold;
}

/* 弹窗通用样式 */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 40rpx;
}

.modal-content {
  background-color: #fff;
  width: 90%;
  max-height: 85vh;
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 30rpx 40rpx;
  border-bottom: 1rpx solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.modal-header h3 {
  font-size: 32rpx;
  font-weight: bold;
}

.modal-body {
  padding: 30rpx 40rpx;
  overflow-y: auto;
  flex: 1;
}

/* 数据分析弹窗样式 */
.analysis-body {
  padding: 30rpx;
  overflow-y: auto;
  flex: 1;
}

.analysis-item {
  margin-bottom: 30rpx;
}

.table-container {
  overflow-x: auto;
  margin-top: 10rpx;
  max-width: 100%;
}

.edit-kp-btn {
  font-size: 0.8em;
  color: #007aff;
  margin-left: 10rpx;
  padding: 4rpx 10rpx;
  cursor: pointer;
}

.edit-kp-btn:active {
  opacity: 0.6;
}

.analysis-sub-title {
  font-size: 1.05em;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
  padding-left: 15rpx;
  border-left: 6rpx solid #007aff;
}

.stat-bar-item {
  margin-bottom: 20rpx;
}

.stat-label {
  font-size: 0.9em;
  color: #666;
  margin-bottom: 10rpx;
  display: block;
}

.bar-bg {
  height: 16rpx;
  background-color: #f0f0f0;
  border-radius: 8rpx;
  flex: 1;
  margin-right: 20rpx;
  overflow: hidden;
  display: inline-block;
  vertical-align: middle;
  width: calc(100% - 100rpx);
}

.bar-fill {
  height: 100%;
  background-color: #007aff;
  border-radius: 8rpx;
  transition: width 0.5s ease;
}

.stat-count {
  font-size: 0.85em;
  color: #999;
}

.kp-stats, .chapter-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 15rpx;
}

.kp-stat-item, .chap-stat-item {
  background-color: #f8f9fa;
  padding: 10rpx 20rpx;
  border-radius: 30rpx;
  font-size: 24rpx;
  display: flex;
  gap: 10rpx;
}

.kp-count, .chap-count {
  color: #007aff;
  font-weight: bold;
}

/* 难度分析样式 */
.difficulty-analysis {
  padding: 20rpx 0;
}

.pie-chart-container {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 40rpx;
}

.simple-pie {
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1);
}

.pie-legend {
  display: flex;
  flex-direction: column;
  gap: 15rpx;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 24rpx;
  color: #666;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}

.dot.simple { background-color: #2ecc71; }
.dot.medium { background-color: #f1c40f; }
.dot.hard { background-color: #e74c3c; }

/* 表格样式 */
.detail-table-container {
  margin-top: 10rpx;
  overflow-x: auto;
  border: 1rpx solid #eee;
  border-radius: 8rpx;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 22rpx;
  min-width: 600rpx;
}

.detail-table th, .detail-table td {
  padding: 15rpx 10rpx;
  text-align: left;
  border-bottom: 1rpx solid #eee;
}

.detail-table th {
  background-color: #f8f9fa;
  color: #666;
  font-weight: bold;
}

.td-kps {
  max-width: 200rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.td-source {
  max-width: 150rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.diff-tag {
  padding: 2rpx 10rpx;
  border-radius: 4rpx;
  font-size: 20rpx;
}

.diff-tag.simple { background-color: #e8f5e9; color: #2e7d32; }
.diff-tag.medium { background-color: #fffde7; color: #f9a825; }
.diff-tag.hard { background-color: #ffebee; color: #c62828; }

.close-btn {
  font-size: 40rpx;
  color: #999;
}

.modal-body {
  padding: 30rpx;
  overflow-y: auto;
}

.info-item {
  margin-bottom: 30rpx;
}

.info-item label {
  display: block;
  font-size: 26rpx;
  color: #999;
  margin-bottom: 10rpx;
}

.info-item span {
  font-size: 28rpx;
  color: #333;
}

.title-edit-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.title-input {
  flex: 1;
  height: 72rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  background: #fff;
  color: #333;
}

.title-input:focus {
  border-color: #007aff;
  outline: none;
}

.save-title-btn {
  height: 72rpx;
  padding: 0 32rpx;
  font-size: 26rpx;
  color: #fff;
  background: #007aff;
  border: none;
  border-radius: 12rpx;
  line-height: 72rpx;
}

.save-title-btn:active {
  background: #0056b3;
}

.book-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.book-info {
  background: #f8f9fa;
  padding: 20rpx;
  border-radius: 12rpx;
}

.book-name {
  font-size: 28rpx;
  font-weight: 500;
  margin-bottom: 8rpx;
}

.chapter-names {
  font-size: 24rpx;
  color: #666;
}

.loading-mask {
  position: relative;
}

.loading-mask::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255,255,255,0.6);
  z-index: 10;
  pointer-events: none;
}

.print-btn {
  background: #3498db;
  color: #fff;
}

.analysis-btn {
  background: #2ecc71;
  color: #fff;
}

.paper-content {
  padding: 20rpx;
  max-width: 800px;
  margin: 0 auto;
}

.paper-header {
  text-align: center;
  margin-bottom: 15rpx;
  padding-top: 10rpx;
}

.main-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #000;
  margin-bottom: 8rpx;
}

.paper-info {
  display: flex;
  justify-content: center;
  gap: 20rpx;
  color: #666;
  margin-bottom: 20rpx;
  padding-bottom: 15rpx;
  border-bottom: 1rpx solid #eee;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.question-item {
  padding: 20rpx 10rpx;
  background-color: #fff;
  border-bottom: 1rpx solid #eee;
  page-break-inside: avoid;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 15rpx;
  margin-bottom: 15rpx;
}

.more-actions-container {
  position: relative;
  z-index: 100;
}

.more-btn {
  font-size: 24rpx;
  font-weight: bold;
  background: #f0f0f0;
  padding: 8rpx 20rpx;
  border-radius: 30rpx;
  color: #333;
}

.more-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: #fff;
  border-radius: 12rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.15);
  min-width: 240rpx;
  margin-top: 10rpx;
  overflow: hidden;
  border: 1rpx solid #eee;
}

.menu-item {
  padding: 24rpx 30rpx;
  font-size: 28rpx;
  color: #333;
  display: flex;
  align-items: center;
  gap: 15rpx;
  transition: background 0.2s;
}

.menu-item.no-hover:active {
  background: none;
}

.font-ctrl-menu {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10rpx 0;
}

.font-ctrl-menu .ctrl-label {
  font-size: 24rpx;
  color: #333;
  margin-right: 20rpx;
  white-space: nowrap;
}

.font-ctrl-menu .font-slider {
  flex: 1;
  margin: 0;
}

.menu-icon {
  font-size: 32rpx;
}

.menu-divider {
  height: 1rpx;
  background: #eee;
}

.menu-item.delete {
  color: #ff4d4f;
}

.question-num {
  font-weight: bold;
  color: #007aff;
  margin-right: 15rpx;
  font-size: 1.1em;
}

.question-type-tag {
  font-size: 0.65em;
  padding: 4rpx 12rpx;
  background: #f0f2f5;
  color: #666;
  border-radius: 4rpx;
}

.question-source {
  font-size: 0.75em;
  color: #999;
  flex: 1;
}

.q-right {
  display: flex;
  align-items: center;
  gap: 10rpx;
  flex-shrink: 0;
}

.reorder-btns {
  display: flex;
  gap: 10rpx;
}

.reorder-btn, .replace-btn {
  font-size: 0.75em;
  color: #007aff;
  background: #f0f7ff;
  padding: 8rpx 20rpx;
  border-radius: 6rpx;
  cursor: pointer;
  border: 1rpx solid #cce5ff;
  display: inline-block;
  line-height: 1;
}

.reorder-btn.disabled {
  color: #ccc;
  background: #f5f5f5;
  border-color: #eee;
  cursor: not-allowed;
  pointer-events: none;
}

/* 表格样式 */
.table-container {
  overflow-x: auto;
  margin-top: 10rpx;
}

.analysis-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 20rpx;
  min-width: 600rpx;
}

.analysis-table th, .analysis-table td {
  border: 1rpx solid #eee;
  padding: 16rpx 10rpx;
  text-align: center;
}

.analysis-table th {
  background-color: #f8f9fa;
  font-weight: bold;
  color: #333;
}

.kp-cell {
  max-width: 200rpx;
  text-align: left !important;
}

.source-cell {
  max-width: 150rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diff-tag {
  padding: 2rpx 10rpx;
  border-radius: 4rpx;
  font-size: 20rpx;
}

.diff-tag.easy { color: #4cd964; background: rgba(76, 217, 100, 0.1); }
.diff-tag.med { color: #f0ad4e; background: rgba(240, 173, 78, 0.1); }
.diff-tag.hard { color: #dd524d; background: rgba(221, 82, 77, 0.1); }

.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  display: inline-block;
  margin-right: 10rpx;
}

.dot.simple { background-color: #4cd964; }
.dot.medium { background-color: #f0ad4e; }
.dot.hard { background-color: #dd524d; }

.legend-item {
  font-size: 24rpx;
  color: #666;
  display: flex;
  align-items: center;
}

.question-body {
  font-size: 1em;
  line-height: 1.6;
}

.question-text {
  font-size: 1em;
  line-height: 1.6;
  color: #000;
  margin-bottom: 10rpx;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.question-text :deep(div),
.question-text :deep(p) {
  font-size: inherit !important;
}

.question-img {
  max-width: 100%;
  display: block;
  margin: 20rpx 0;
}

.fab-container {
  position: fixed;
  bottom: 120rpx;
  right: 40rpx;
  z-index: 999;
}


.only-print {
  display: none;
}

@media print {
  .no-print {
    display: none !important;
  }
  .only-print {
    display: block !important;
  }
  .paper-content {
    padding: 0;
    margin: 0;
    max-width: none;
  }
  .paper-container {
    background: #fff;
  }
  .question-footer-print {
    margin-top: 10rpx;
    font-size: 20rpx;
    color: #999;
    text-align: right;
    border-top: 1rpx dashed #eee;
    padding-top: 5rpx;
  }
  .question-item {
    margin-bottom: 40rpx;
  }
}
/* 纠错按钮及弹窗样式 */
.correction-btn {
  background: none;
  border: 1px solid #ff3b30;
  color: #ff3b30;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-left: 10rpx;
  line-height: 1.4;
}

.correction-btn:active {
  background-color: rgba(255, 59, 48, 0.1);
}

.correction-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 2000;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.correction-modal-overlay.active {
  opacity: 1;
  visibility: visible;
}

.correction-modal-content {
  width: 90%;
  max-width: 500rpx;
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  transform: translateY(20px);
  transition: transform 0.3s ease;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.correction-modal-overlay.active .correction-modal-content {
  transform: translateY(0);
}

.correction-modal-header {
  padding: 20rpx 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.modal-icon {
  font-size: 32rpx;
}

.correction-modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin: 0;
}

.correction-modal-close-btn {
  background: #f5f5f5;
  border: none;
  color: #999;
  width: 50rpx;
  height: 50rpx;
  border-radius: 25rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  cursor: pointer;
}

.correction-modal-body {
  padding: 30rpx;
}

.correction-type-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 15rpx;
  margin-bottom: 30rpx;
}

.type-tag {
  padding: 10rpx 25rpx;
  background: #f5f5f5;
  border: 1rpx solid #eee;
  border-radius: 30rpx;
  font-size: 24rpx;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.type-tag.active {
  background: #007aff;
  color: #fff;
  border-color: #007aff;
}

.correction-textarea {
  width: 100%;
  height: 240rpx;
  background: #f9f9f9;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 30rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: #333;
  box-sizing: border-box;
}

.correction-footer {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.correction-tip {
  font-size: 22rpx;
  color: #999;
  margin: 0;
  text-align: center;
}

.correction-submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #007aff, #0056b3);
  color: #fff;
  border: none;
  padding: 20rpx;
  border-radius: 12rpx;
  font-size: 30rpx;
  font-weight: bold;
  transition: all 0.2s;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.correction-submit-btn:disabled {
  background: #e0e0e0;
  color: #a0a0a0;
}

/* 打印提示弹窗样式 */
.print-alert-content {
  max-width: 600rpx;
  width: 80%;
}

.print-alert-content .modal-footer {
  padding: 20rpx 30rpx;
  border-top: 2rpx solid #eee;
  display: flex;
  gap: 20rpx;
  align-items: center;
  justify-content: center;
}

.print-alert-content .modal-footer button {
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 2;
  max-width: 400rpx;
}

.print-alert-content .confirm-btn {
  background: linear-gradient(135deg, #4db6ac, #26a69a);
  color: #fff;
  border: none;
  box-shadow: 0 4rpx 12rpx rgba(77, 182, 172, 0.2);
}

.print-alert-content .confirm-btn:disabled,
.print-alert-content .confirm-btn.disabled {
  opacity: 0.5;
  background: #e0e0e0;
  color: #999;
  box-shadow: none;
}

.print-alert-text {
  font-size: 28rpx;
  color: #333;
  padding: 20rpx;
}

/* 打印选项弹窗样式 */
.print-options-content {
  max-width: 600rpx;
  width: 80%;
}

.print-options-info {
  padding: 20rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}

.print-option-item {
  display: flex;
  align-items: center;
  font-size: 28rpx;
  line-height: 1.8;
  margin: 10rpx 0;
}

.option-label {
  color: #666;
  font-weight: 500;
  min-width: 160rpx;
}

.option-value {
  color: #333;
  flex: 1;
}

.option-value.has-count {
  color: #52c41a;
}

.option-value.no-count {
  color: #ff4d4f;
}

.print-options-question {
  font-size: 30rpx;
  color: #333;
  text-align: center;
  margin: 30rpx 0;
}

.print-options-footer {
  padding: 20rpx 30rpx;
  border-top: 2rpx solid #eee;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.print-options-row {
  display: flex;
  gap: 16rpx;
  width: 100%;
}

.print-options-row button {
  height: 72rpx;
  border-radius: 36rpx;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  padding: 0 20rpx;
}

.print-options-row .cancel-btn.full-width {
  flex: 1;
  width: 100%;
}

.print-options-footer .cancel-btn {
  background: #f5f6f7;
  color: #7f8c8d;
  border: none;
}

.print-options-footer .confirm-btn.secondary {
  background: linear-gradient(135deg, #81c784, #66bb6a);
  color: #fff;
  border: none;
  box-shadow: 0 4rpx 12rpx rgba(129, 199, 132, 0.2);
}

.print-options-footer .confirm-btn.secondary.disabled {
  background: linear-gradient(135deg, #e0e0e0, #bdbdbd);
  color: #9e9e9e;
  cursor: not-allowed;
  box-shadow: none;
}

.print-options-footer .confirm-btn {
  background: linear-gradient(135deg, #4db6ac, #26a69a);
  color: #fff;
  border: none;
  box-shadow: 0 4rpx 12rpx rgba(77, 182, 172, 0.2);
}
</style>
