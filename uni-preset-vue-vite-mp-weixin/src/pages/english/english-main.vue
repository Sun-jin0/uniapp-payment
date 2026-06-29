<template>
  <view class="container">
    <!-- 科技风导航栏 - 优化渐变和毛玻璃 -->
    <view class="nav-bar" :style="{ height: (statusBarHeight + 44) + 'px', paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-left" v-if="showBack" @click="goBack" hover-class="nav-btn-hover">
          <uni-icons type="arrowleft" size="20" color="#fff" />
        </view>
        <view class="nav-title">AI Essay Corrector</view>
        <view class="nav-right" @click="openSettings" hover-class="nav-btn-hover">
          <uni-icons type="settings" size="20" color="#fff" />
        </view>
      </view>
    </view>

    <!-- 主内容 - 优化滚动和高度计算 -->
    <scroll-view scroll-y class="main-content" :style="{ height: contentHeight + 'px', paddingTop: (statusBarHeight + 44 + 20) + 'rpx' }">
      
      <!-- 题目选择卡片 - 优化内边距和阴影 -->
      <view class="card card-shadow">
        <view class="card-header">
          <text class="card-title">📋 题目选择</text>
        </view>
        
        <view class="selector-list">
          <view class="selector-item" @click="openYearModal" hover-class="selector-hover">
            <view class="selector-info">
              <text class="selector-label">年份</text>
              <text class="selector-value" :class="{ 'active': selectedYear }">{{ selectedYear || '请选择' }}</text>
            </view>
            <view class="selector-arrow">
              <uni-icons type="arrowright" size="16" color="#64748b" />
            </view>
          </view>
          
          <view class="divider"></view>
          
          <view class="selector-item" @click="openTypeModal" hover-class="selector-hover">
            <view class="selector-info">
              <text class="selector-label">试卷类型</text>
              <text class="selector-value">{{ paperTypeText }}</text>
            </view>
            <view class="selector-arrow">
              <uni-icons type="arrowright" size="16" color="#64748b" />
            </view>
          </view>
          
          <view class="divider"></view>
          
          <view class="selector-item" @click="openEssayModal" hover-class="selector-hover">
            <view class="selector-info">
              <text class="selector-label">作文类型</text>
              <text class="selector-value">{{ essayTypeText }} <text class="word-tip">({{ essayWordRange }})</text></text>
            </view>
            <view class="selector-arrow">
              <uni-icons type="arrowright" size="16" color="#64748b" />
            </view>
          </view>
        </view>

        <!-- 题目预览 - 优化渐变和边框 -->
        <view class="question-box" v-if="currentQuestion">
          <view class="question-badge">{{ currentQuestion.year }} · {{ currentQuestion.type }}</view>
          <text class="question-content">{{ currentQuestion.title }}</text>
          <text class="question-tip" v-if="currentQuestion.tip">{{ currentQuestion.tip }}</text>
        </view>
        
        <view class="question-empty" v-else @click="openYearModal" hover-class="question-empty-hover">
          <uni-icons type="compose" size="48" color="#334155" />
          <text>点击选择真题题目</text>
        </view>
      </view>

      <!-- 作文输入区 - 核心优化：聚焦样式、字数区间提示 -->
      <view class="card card-shadow">
        <view class="card-header">
          <text class="card-title">✍️ 作文内容</text>
          <view class="word-badge" :class="{ 'warning': wordCount < minWord || wordCount > maxWord, 'normal': wordCount >= minWord && wordCount <= maxWord }">
            <text class="word-num">{{ wordCount }}</text>
            <text class="word-unit">/ {{ maxWord }} words</text>
          </view>
        </view>
        
        <textarea 
          v-model="userEssay" 
          class="essay-input" 
          :class="{ 'essay-input-focus': isInputFocus }"
          placeholder="在此输入或粘贴你的作文..."
          @input="onInput"
          @focus="isInputFocus = true"
          @blur="isInputFocus = false"
        />
        <!-- 字数区间提示 -->
        <text class="word-range-tip" :class="{ 'tip-warning': minWord > 0 }">
          建议字数：{{ minWord }} - {{ maxWord }} 词
        </text>
        
        <view class="action-bar">
          <view class="btn-secondary" @click="clearEssay" hover-class="btn-hover">
            <uni-icons type="trash" size="16" color="#94a3b8" />
            <text>清空</text>
          </view>
          <view class="btn-secondary" @click="pasteEssay" hover-class="btn-hover">
            <uni-icons type="paperclip" size="16" color="#94a3b8" />
            <text>粘贴</text>
          </view>
          <view class="btn-primary" @click="startCorrection" :class="{ 'loading': isCorrecting }" :disabled="isCorrecting" hover-class="btn-primary-hover">
            <text v-if="!isCorrecting">开始批改</text>
            <view v-else class="loading-spinner"></view>
          </view>
        </view>
      </view>

      <!-- 历史记录 - 新增空状态、优化列表项 -->
      <view class="card card-shadow">
        <view class="card-header">
          <text class="card-title">🕘 历史记录</text>
          <text class="link-text" @click="clearHistory" v-if="history.length > 0" hover-class="link-hover">清空</text>
        </view>
        
        <view class="history-list" v-if="history.length > 0">
          <view class="history-item" v-for="(item, idx) in history.slice(0, 5)" :key="idx" @click="loadHistory(item)" hover-class="history-hover">
            <view class="history-main">
              <view class="history-title">{{ item.year }} {{ item.type }}</view>
              <view class="history-sub">{{ item.date }} · {{ item.wordCount }}词</view>
            </view>
            <view class="history-score" :class="getScoreClass(item.score)">
              {{ item.score }}
            </view>
          </view>
        </view>
        
        <!-- 历史记录空状态 -->
        <view class="history-empty" v-else>
          <uni-icons type="clock" size="48" color="#334155" />
          <text>暂无批改记录</text>
        </view>
      </view>
      
      <view style="height: 60rpx;"></view>
    </scroll-view>

    <!-- 年份选择弹窗 - 优化动画和选中态 -->
    <uni-popup ref="yearPopup" type="bottom" background-color="transparent" v-model:show="showYearModal" animation="slide-up">
      <view class="modal-container">
        <view class="modal-header">
          <text class="modal-title">选择年份</text>
          <view class="modal-close" @click="showYearModal = false" hover-class="modal-btn-hover">
            <uni-icons type="close" size="20" color="#64748b" />
          </view>
        </view>
        <view class="year-grid">
          <view 
            v-for="year in years" 
            :key="year" 
            class="year-item"
            :class="{ 'active': tempYear === year }"
            @click="selectYear(year)"
            hover-class="year-item-hover"
          >
            {{ year }}
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn-confirm" @click="confirmYear" hover-class="btn-confirm-hover">确认选择</button>
        </view>
      </view>
    </uni-popup>

    <!-- 类型选择弹窗 - 统一动画 -->
    <uni-popup ref="typePopup" type="bottom" background-color="transparent" v-model:show="showTypeModal" animation="slide-up">
      <view class="modal-container">
        <view class="modal-header">
          <text class="modal-title">选择试卷类型</text>
          <view class="modal-close" @click="showTypeModal = false" hover-class="modal-btn-hover">
            <uni-icons type="close" size="20" color="#64748b" />
          </view>
        </view>
        <view class="option-list">
          <view 
            v-for="type in paperTypes" 
            :key="type.value"
            class="option-item"
            :class="{ 'active': tempType === type.value }"
            @click="tempType = type.value"
            hover-class="option-hover"
          >
            <view class="option-content">
              <text class="option-name">{{ type.label }}</text>
              <text class="option-desc">{{ type.desc }}</text>
            </view>
            <view class="option-check" v-if="tempType === type.value">
              <uni-icons type="checkmarkempty" size="20" color="#06b6d4" />
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn-confirm" @click="confirmType" hover-class="btn-confirm-hover">确认</button>
        </view>
      </view>
    </uni-popup>

    <!-- 作文类型弹窗 - 统一动画 -->
    <uni-popup ref="essayPopup" type="bottom" background-color="transparent" v-model:show="showEssayModal" animation="slide-up">
      <view class="modal-container">
        <view class="modal-header">
          <text class="modal-title">选择作文类型</text>
          <view class="modal-close" @click="showEssayModal = false" hover-class="modal-btn-hover">
            <uni-icons type="close" size="20" color="#64748b" />
          </view>
        </view>
        <view class="option-list">
          <view 
            v-for="item in essayTypes" 
            :key="item.value"
            class="option-item large"
            :class="{ 'active': tempEssay === item.value }"
            @click="tempEssay = item.value"
            hover-class="option-hover"
          >
            <view class="option-content">
              <text class="option-name">{{ item.label }}</text>
              <view class="option-meta">
                <text class="meta-tag">{{ item.wordCount }}词</text>
                <text class="option-desc">{{ item.desc }}</text>
              </view>
            </view>
            <view class="option-check" v-if="tempEssay === item.value">
              <uni-icons type="checkmarkempty" size="20" color="#06b6d4" />
            </view>
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn-confirm" @click="confirmEssay" hover-class="btn-confirm-hover">确认</button>
        </view>
      </view>
    </uni-popup>

    <!-- 设置弹窗 - 优化侧滑动画、补充缺省提示 -->
    <uni-popup ref="settingPopup" type="right" v-model:show="showSettings" animation="slide-in-right">
      <view class="setting-panel">
        <view class="setting-header">
          <text class="setting-title">AI 配置</text>
          <view class="close-btn" @click="showSettings = false" hover-class="modal-btn-hover">
            <uni-icons type="arrowright" size="24" color="#64748b" />
          </view>
        </view>
        
        <scroll-view scroll-y class="setting-body">
          <!-- API设置 -->
          <view class="setting-section">
            <view class="section-label">模型服务商</view>
            <view class="provider-list">
              <view 
                v-for="(p, i) in providers" 
                :key="i"
                class="provider-item"
                :class="{ active: config.provider === p.value }"
                @click="selectProvider(p)"
                hover-class="provider-hover"
              >
                <view class="provider-icon">{{ p.icon }}</view>
                <view class="provider-info">
                  <text class="provider-name">{{ p.name }}</text>
                  <text class="provider-status">{{ p.models[0] }}</text>
                </view>
              </view>
            </view>
          </view>

          <view class="setting-section">
            <view class="section-label">API Key</view>
            <input 
              v-model="config.apiKey" 
              type="text" 
              password 
              placeholder="输入您的 API Key" 
              class="tech-input"
              @focus="isInputFocus = true"
              @blur="isInputFocus = false"
            />
            <text class="input-tip">密钥仅保存在本地，不会上传至服务器</text>
            <!-- API Key缺省提示 -->
            <text class="input-warning" v-if="!config.apiKey">⚠️ 未配置API Key将无法进行AI批改</text>
          </view>

          <view class="setting-section">
            <view class="section-label">批改风格</view>
            <view class="style-grid">
              <view 
                v-for="(s, i) in styles" 
                :key="i"
                class="style-card"
                :class="{ active: config.style === i }"
                @click="config.style = i"
                hover-class="style-hover"
              >
                <text class="style-emoji">{{ s.icon }}</text>
                <text class="style-name">{{ s.name }}</text>
              </view>
            </view>
          </view>

          <view class="setting-section">
            <view class="section-label">Temperature (严格度)</view>
            <slider 
              :value="config.temperature * 100" 
              @change="e => config.temperature = e.detail.value / 100"
              activeColor="#06b6d4"
              backgroundColor="#1e293b"
              block-size="20"
              show-value
            />
            <view class="range-labels">
              <text>严格</text>
              <text>平衡</text>
              <text>宽松</text>
            </view>
          </view>
        </scroll-view>
        
        <view class="setting-footer">
          <button class="btn-save-tech" @click="saveConfig" hover-class="btn-confirm-hover">保存配置</button>
        </view>
      </view>
    </uni-popup>

    <!-- 批改结果弹窗（全屏）- 优化动画、进度环样式 -->
    <uni-popup ref="resultPopup" type="center" v-model:show="showResult" v-if="result" animation="fade-in">
      <view class="result-modal card-shadow">
        <view class="result-header-tech">
          <view class="result-score-ring">
            <view class="score-inner">
              <text class="score-value">{{ result.score }}</text>
              <text class="score-total">/20</text>
            </view>
            <view class="score-ring-bg"></view>
            <view class="score-ring-progress" :style="{ '--score': result.score * 5 + 'deg', '--primary': 'var(--primary)' }"></view>
          </view>
          <text class="result-level">{{ getLevelText(result.score) }}</text>
        </view>
        
        <scroll-view scroll-y class="result-body">
          <view class="analysis-section">
            <view class="section-title-tech">📊 能力分析</view>
            <view class="radar-chart">
              <view class="dimension" v-for="(d, i) in result.dimensions" :key="i">
                <view class="dim-header">
                  <text class="dim-name">{{ d.name }}</text>
                  <text class="dim-score">{{ d.score }}%</text>
                </view>
                <view class="dim-bar">
                  <view class="dim-fill" :style="{ width: d.score + '%' }"></view>
                </view>
              </view>
            </view>
          </view>

          <view class="analysis-section">
            <view class="section-title-tech">📝 详细点评</view>
            <text class="comment-text">{{ result.comment }}</text>
          </view>

          <view class="analysis-section" v-if="result.errors.length > 0">
            <view class="section-title-tech">🔧 纠错</view>
            <view class="error-list">
              <view class="error-card" v-for="(e, i) in result.errors" :key="i">
                <text class="error-tag">{{ e.type }}</text>
                <view class="error-row">
                  <text class="text-wrong">{{ e.original }}</text>
                  <uni-icons type="arrowright" size="14" color="#475569" />
                  <text class="text-correct">{{ e.corrected }}</text>
                </view>
                <text class="error-note">{{ e.reason }}</text>
              </view>
            </view>
          </view>

          <view class="analysis-section">
            <view class="section-title-tech">✨ 润色范文</view>
            <view class="polished-box">
              <text class="polished-text">{{ result.polished }}</text>
              <view class="btn-copy" @click="copyPolished" hover-class="btn-hover">
                <uni-icons type="download" size="16" color="#06b6d4" />
                <text>复制</text>
              </view>
            </view>
          </view>
          
          <view style="height: 40rpx;"></view>
        </scroll-view>
        
        <view class="result-footer">
          <button class="btn-close-tech" @click="showResult = false" hover-class="btn-hover">关闭</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

// 系统 - 优化设备信息获取
const statusBarHeight = ref(20);
const contentHeight = ref(600);
const showBack = ref(false);
const isInputFocus = ref(false); // 输入框聚焦状态

// 数据 - 保持原有基础
const years = Array.from({ length: 15 }, (_, i) => 2024 - i);
const paperTypes = [
  { value: 'en1', label: 'English I', desc: 'Academic Degree' },
  { value: 'en2', label: 'English II', desc: 'Professional Degree' }
];
const essayTypes = [
  { value: 'big', label: 'Essay (Big)', wordCount: '160-200', desc: '图表/图画作文', min: 160, max: 200 },
  { value: 'small', label: 'Essay (Small)', wordCount: '100', desc: '应用文写作', min: 80, max: 120 }
];
const providers = [
  { value: 'siliconflow', name: 'SiliconFlow', icon: '⚡', models: ['DeepSeek-V2.5', 'Qwen2.5-72B'] },
  { value: 'deepseek', name: 'DeepSeek', icon: '🧠', models: ['deepseek-chat', 'deepseek-coder'] },
  { value: 'moonshot', name: 'Moonshot', icon: '🌙', models: ['moonshot-v1-8k'] },
  { value: 'openai', name: 'OpenAI', icon: '🔵', models: ['gpt-4', 'gpt-3.5-turbo'] }
];
const styles = [
  { name: 'Strict', icon: '👨‍🏫', desc: 'Strict professor mode' },
  { name: 'Gentle', icon: '🤝', desc: 'Encouraging mentor mode' },
  { name: 'Exam', icon: '🎯', desc: 'Test-taking expert mode' }
];

// 状态 - 保持原有基础
const showYearModal = ref(false);
const showTypeModal = ref(false);
const showEssayModal = ref(false);
const showSettings = ref(false);
const showResult = ref(false);
const isCorrecting = ref(false);

const userEssay = ref('');
const wordCount = ref(0);
const history = ref([]);

// 选择器临时值
const tempYear = ref('');
const tempType = ref('');
const tempEssay = ref('');

// 最终选择
const selectedYear = ref('');
const selectedType = ref('en1');
const selectedEssay = ref('big');

// 配置
const config = ref({
  provider: 'siliconflow',
  apiKey: '',
  style: 0,
  temperature: 0.7
});

// 结果模拟
const result = ref(null);

// 计算属性 - 核心增强：作文字数区间、动态最小/最大字数
const paperTypeText = computed(() => paperTypes.find(t => t.value === selectedType.value)?.label || 'English I');
const essayTypeInfo = computed(() => essayTypes.find(t => t.value === selectedEssay.value) || essayTypes[0]);
const essayTypeText = computed(() => essayTypeInfo.value.label);
const essayWordRange = computed(() => essayTypeInfo.value.wordCount);
// 动态最小/最大字数（随作文类型变化）
const minWord = computed(() => essayTypeInfo.value.min);
const maxWord = computed(() => essayTypeInfo.value.max);

const currentQuestion = computed(() => {
  if (!selectedYear.value) return null;
  return {
    year: selectedYear.value,
    type: paperTypeText.value,
    title: selectedEssay.value === 'big' 
      ? 'Write an essay of 160-200 words based on the following chart/drawing. In your essay, you should describe the picture briefly, interpret its intended meaning, and give your comments.'
      : 'Suppose you are going to write a letter/email. Write your letter in about 100 words.',
    tip: 'Do not sign your own name. Use "Li Ming" instead.'
  };
});

// 方法 - 优化输入计算、补充权限兼容、增强操作反馈
const onInput = (e) => {
  const text = e.detail.value || '';
  // 优化单词计数：过滤空字符、兼容连字符
  const words = text.trim().replace(/-/g, ' ').split(/\s+/).filter(w => w.length > 0);
  wordCount.value = words.length;
};

const openYearModal = () => {
  tempYear.value = selectedYear.value;
  showYearModal.value = true;
  uni.vibrateShort({ type: 'light' }); // 轻震动反馈
};

const openTypeModal = () => {
  tempType.value = selectedType.value;
  showTypeModal.value = true;
  uni.vibrateShort({ type: 'light' });
};

const openEssayModal = () => {
  tempEssay.value = selectedEssay.value;
  showEssayModal.value = true;
  uni.vibrateShort({ type: 'light' });
};

const openSettings = () => {
  showSettings.value = true;
  uni.vibrateShort({ type: 'light' });
};

const selectYear = (year) => {
  tempYear.value = year;
  uni.vibrateShort({ type: 'light' });
};

const confirmYear = () => {
  if (!tempYear.value) {
    uni.showToast({ title: '请选择年份', icon: 'none' });
    return;
  }
  selectedYear.value = tempYear.value;
  showYearModal.value = false;
  uni.vibrateShort({ type: 'light' });
};

const confirmType = () => {
  if (!tempType.value) {
    uni.showToast({ title: '请选择试卷类型', icon: 'none' });
    return;
  }
  selectedType.value = tempType.value;
  showTypeModal.value = false;
  uni.vibrateShort({ type: 'light' });
};

const confirmEssay = () => {
  if (!tempEssay.value) {
    uni.showToast({ title: '请选择作文类型', icon: 'none' });
    return;
  }
  selectedEssay.value = tempEssay.value;
  showEssayModal.value = false;
  uni.vibrateShort({ type: 'light' });
};

const selectProvider = (p) => {
  config.value.provider = p.value;
  uni.vibrateShort({ type: 'light' });
};

const clearEssay = () => {
  if (!userEssay.value) return;
  uni.showModal({
    title: '确认',
    content: '清空当前作文？',
    success: (res) => {
      if (res.confirm) {
        userEssay.value = '';
        wordCount.value = 0;
        uni.vibrateShort({ type: 'light' });
      }
    }
  });
};

const pasteEssay = async () => {
  try {
    // 兼容小程序/APP粘贴权限
    const res = await uni.getClipboardData();
    if (res.data) {
      userEssay.value = res.data;
      onInput({ detail: { value: res.data } });
      uni.showToast({ title: '粘贴成功', icon: 'success', duration: 1000 });
    } else {
      uni.showToast({ title: '剪贴板为空', icon: 'none' });
    }
  } catch (e) {
    uni.showToast({ title: '粘贴失败，请开启剪贴板权限', icon: 'none' });
  }
};

const startCorrection = async () => {
  // 多条件校验
  if (!userEssay.value.trim()) {
    uni.showToast({ title: '请输入作文内容', icon: 'none' });
    return;
  }
  if (!config.value.apiKey) {
    uni.showToast({ title: '请先配置API Key', icon: 'none' });
    openSettings.value = true;
    return;
  }
  if (wordCount.value < minWord.value) {
    uni.showToast({ title: `字数不足${minWord.value}词`, icon: 'none' });
    return;
  }
  if (!selectedYear.value) {
    uni.showToast({ title: '请选择真题题目', icon: 'none' });
    return;
  }
  
  isCorrecting.value = true;
  uni.vibrateShort({ type: 'medium' }); // 中等震动反馈
  
  // 模拟API调用
  setTimeout(() => {
    result.value = {
      score: 16,
      dimensions: [
        { name: 'Content', score: 85 },
        { name: 'Structure', score: 80 },
        { name: 'Vocabulary', score: 75 },
        { name: 'Grammar', score: 70 }
      ],
      comment: '文章结构完整，能够准确回应题目要求。逻辑链条清晰，论证较为充分。存在少量语法错误，词汇使用有提升空间。建议增加复杂句式的运用，丰富连接词的使用。',
      errors: [
        { type: 'Grammar', original: 'As is show', corrected: 'As is shown', reason: '被动语态使用错误，应用过去分词形式' },
        { type: 'Vocabulary', original: 'very good', corrected: 'remarkable', reason: '避免使用过于简单的抽象形容词，提升词汇丰富度' }
      ],
      polished: 'As is vividly shown in the chart, the past decade has witnessed a dramatic increase in the number of people who participate in online learning, which reflects the rapid development of internet technology in modern society.'
    };
    showResult.value = true;
    
    // 保存历史
    history.value.unshift({
      year: selectedYear.value || 'Custom',
      type: essayTypeText.value,
      date: new Date().toLocaleDateString(),
      wordCount: wordCount.value,
      score: 16
    });
    // 本地存储历史记录
    uni.setStorageSync('essay_history', history.value);
    
    isCorrecting.value = false;
    uni.vibrateShort({ type: 'heavy' }); // 强震动反馈
  }, 2000);
};

const getScoreClass = (score) => {
  if (score >= 16) return 'high';
  if (score >= 12) return 'mid';
  return 'low';
};

const getLevelText = (score) => {
  if (score >= 18) return 'Level 5: Excellent';
  if (score >= 15) return 'Level 4: Good';
  if (score >= 11) return 'Level 3: Pass';
  if (score >= 7) return 'Level 2: Basic';
  return 'Level 1: Needs Work';
};

const copyPolished = () => {
  if (!result.value?.polished) return;
  uni.setClipboardData({
    data: result.value.polished,
    success: () => {
      uni.showToast({ title: '范文已复制', icon: 'success' });
      uni.vibrateShort({ type: 'light' });
    }
  });
};

const loadHistory = (item) => {
  // 加载历史记录逻辑 - 可扩展：回显作文内容、重新批改等
  uni.showToast({ title: '加载中...', icon: 'loading' });
  setTimeout(() => {
    uni.showToast({ title: '历史记录加载完成', icon: 'success' });
  }, 800);
};

const clearHistory = () => {
  uni.showModal({
    title: '确认',
    content: '清空所有批改历史？此操作不可恢复',
    success: (res) => {
      if (res.confirm) {
        history.value = [];
        uni.removeStorageSync('essay_history');
        uni.vibrateShort({ type: 'light' });
        uni.showToast({ title: '历史已清空', icon: 'success' });
      }
    }
  });
};

const saveConfig = () => {
  if (!config.value.apiKey) {
    uni.showToast({ title: '请输入API Key', icon: 'none' });
    return;
  }
  uni.setStorageSync('essay_config', config.value);
  showSettings.value = false;
  uni.showToast({ title: '配置已保存', icon: 'success' });
  uni.vibrateShort({ type: 'light' });
};

const goBack = () => {
  uni.navigateBack({
    delta: 1,
    success: () => uni.vibrateShort({ type: 'light' })
  });
};

onMounted(() => {
  // 优化设备信息获取，增加异常捕获
  try {
    const sys = uni.getSystemInfoSync();
    statusBarHeight.value = sys.statusBarHeight;
    // 适配不同设备的内容高度（转换rpx，更精准）
    contentHeight.value = (sys.windowHeight - sys.statusBarHeight - 44) * 2 - 40;
    showBack.value = getCurrentPages().length > 1;
  } catch (e) {
    console.error('获取设备信息失败：', e);
  }
  
  // 加载本地配置和历史
  const cfg = uni.getStorageSync('essay_config');
  if (cfg) config.value = { ...config.value, ...cfg };
  const his = uni.getStorageSync('essay_history');
  if (his && his.length > 0) history.value = his;
});

// 页面卸载时保存历史
onUnmounted(() => {
  if (history.value.length > 0) {
    uni.setStorageSync('essay_history', history.value);
  }
});
</script>

<style scoped>
/* 深色科技主题变量 - 优化色值，增加过渡变量 */
:root {
  --bg-dark: #0f172a;
  --card-bg: #1e293b;
  --card-border: #334155;
  --card-border-hover: #475569;
  --primary: #06b6d4;  /* 青色 */
  --primary-light: #22d3ee;
  --primary-dark: #0891b2;
  --accent: #6366f1;   /* 紫色 */
  --accent-light: #818cf8;
  --text: #f1f5f9;
  --text-muted: #94a3b8;
  --text-dim: #64748b;
  --success: #10b981;
  --success-light: #34d399;
  --warning: #f59e0b;
  --warning-light: #fbbf24;
  --error: #ef4444;
  --error-light: #f87171;
  --shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.3);
  --shadow-hover: 0 6rpx 24rpx rgba(0, 0, 0, 0.4);
  --transition: all 0.2s ease-in-out;
  --transition-long: all 0.5s ease-out;
  /* Updated for WXSS recompilation */
}

.container {
  min-height: 100vh;
  background-color: var(--bg-dark);
  background-image: radial-gradient(circle at 10% 20%, rgba(6, 182, 212, 0.05) 0%, transparent 20%),
                    radial-gradient(circle at 90% 80%, rgba(99, 102, 241, 0.05) 0%, transparent 20%);
}

/* 导航栏 - 优化毛玻璃、渐变和边框 */
.nav-bar {
  background-color: rgba(15, 23, 42, 0.98);
  backdrop-filter: blur(15px);
  border-bottom: 1rpx solid rgba(51, 65, 85, 0.6);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  transition: var(--transition);
}

.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text);
  letter-spacing: 1.5px;
}

.nav-left, .nav-right {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: var(--transition);
}

.nav-btn-hover {
  background-color: rgba(51, 65, 85, 0.5);
}

/* 主内容 - 修复滚动高度，优化padding */
.main-content {
  width: 100%;
  overflow-x: hidden;
}

/* 卡片通用样式 - 提取阴影、过渡，优化圆角 */
.card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--card-border);
  border-radius: 24rpx;
  margin: 0 30rpx 30rpx;
  padding: 30rpx;
  transition: var(--transition);
}

.card-shadow {
  box-shadow: var(--shadow);
}

.card-shadow:hover {
  box-shadow: var(--shadow-hover);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.card-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text);
  line-height: 1.2;
}

.link-text {
  font-size: 26rpx;
  color: var(--primary);
  transition: var(--transition);
}

.link-hover {
  color: var(--primary-light);
  text-decoration: underline;
}

/* 选择器列表 - 优化hover态，增加过渡 */
.selector-list {
  display: flex;
  flex-direction: column;
}

.selector-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 0;
  transition: var(--transition);
  border-radius: 12rpx;
  padding-left: 10rpx;
  padding-right: 10rpx;
}

.selector-hover {
  background-color: rgba(51, 65, 85, 0.3);
}

.selector-info {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.selector-label {
  font-size: 28rpx;
  color: var(--text-muted);
  width: 160rpx;
}

.selector-value {
  font-size: 30rpx;
  color: var(--text);
  font-weight: 500;
}

/* 作文字数小提示 */
.word-tip {
  font-size: 24rpx;
  color: var(--text-dim);
  font-weight: 400;
}

.selector-value.active {
  color: var(--primary);
}

.divider {
  height: 1rpx;
  background-color: rgba(51, 65, 85, 0.5);
  margin: 0 10rpx;
}

/* 题目预览 - 优化渐变、内边距，增加阴影 */
.question-box {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%);
  border: 1rpx solid rgba(6, 182, 212, 0.3);
  border-radius: 16rpx;
  padding: 28rpx;
  margin-top: 20rpx;
  box-shadow: 0 2rpx 10rpx rgba(6, 182, 212, 0.05);
}

.question-badge {
  display: inline-block;
  background-color: rgba(6, 182, 212, 0.2);
  color: var(--primary);
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 10rpx;
  margin-bottom: 16rpx;
  font-weight: 500;
}

.question-content {
  font-size: 28rpx;
  color: var(--text);
  line-height: 1.7;
  display: block;
  margin-bottom: 12rpx;
}

.question-tip {
  font-size: 26rpx;
  color: var(--text-dim);
  display: block;
  line-height: 1.6;
}

.question-empty {
  height: 240rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(30, 41, 59, 0.5);
  border: 2rpx dashed var(--card-border);
  border-radius: 16rpx;
  margin-top: 20rpx;
  color: var(--text-dim);
  gap: 16rpx;
  transition: var(--transition);
}

.question-empty-hover {
  border-color: var(--primary);
  color: var(--text-muted);
  background-color: rgba(30, 41, 59, 0.6);
}

/* 字数统计 - 新增正常态，优化渐变 */
.word-badge {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
  padding: 10rpx 24rpx;
  border-radius: 24rpx;
  transition: var(--transition);
}

.word-badge.normal {
  background-color: rgba(6, 182, 212, 0.15);
}

.word-badge.warning {
  background-color: rgba(245, 158, 11, 0.15);
}

.word-badge.warning .word-num {
  color: var(--warning);
}

.word-num {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--primary);
  transition: var(--transition);
}

.word-unit {
  font-size: 22rpx;
  color: var(--text-muted);
}

/* 字数区间提示 */
.word-range-tip {
  font-size: 24rpx;
  color: var(--text-dim);
  margin: 12rpx 0 0;
  display: block;
  line-height: 1.5;
}

.tip-warning {
  color: var(--warning);
}

/* 输入框 - 核心优化：聚焦样式、内边距、行高 */
.essay-input {
  width: 100%;
  min-height: 400rpx;
  background-color: rgba(15, 23, 42, 0.6);
  border: 1rpx solid var(--card-border);
  border-radius: 16rpx;
  padding: 28rpx;
  font-size: 30rpx;
  line-height: 1.8;
  color: var(--text);
  box-sizing: border-box;
  transition: var(--transition-long);
  resize: none;
}

.essay-input-focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4rpx rgba(6, 182, 212, 0.15);
  background-color: rgba(15, 23, 42, 0.7);
}

/* 操作栏 - 优化按钮间距，增加hover态 */
.action-bar {
  display: flex;
  gap: 20rpx;
  margin-top: 28rpx;
}

.btn-secondary {
  flex: 1;
  height: 80rpx;
  background-color: rgba(51, 65, 85, 0.5);
  border: 1rpx solid var(--card-border);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  font-size: 28rpx;
  color: var(--text-muted);
  transition: var(--transition);
}

.btn-primary {
  flex: 2;
  height: 80rpx;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  color: #fff;
  font-weight: 600;
  position: relative;
  overflow: hidden;
  transition: var(--transition);
  border: none;
}

.btn-hover {
  opacity: 0.9;
  transform: scale(0.98);
}

.btn-primary-hover {
  background: linear-gradient(135deg, var(--primary-light) 0%, var(--accent-light) 100%);
  box-shadow: 0 0 15rpx rgba(6, 182, 212, 0.3);
}

.btn-primary.loading {
  background: var(--card-border);
  cursor: not-allowed;
  opacity: 0.8;
}

.loading-spinner {
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid rgba(255,255,255,0.1);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 历史记录 - 优化列表项、新增空状态 */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: rgba(15, 23, 42, 0.5);
  padding: 24rpx;
  border-radius: 12rpx;
  border: 1rpx solid rgba(51, 65, 85, 0.3);
  transition: var(--transition);
}

.history-hover {
  border-color: var(--primary);
  background-color: rgba(15, 23, 42, 0.6);
  transform: translateX(4rpx);
}

.history-main {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.history-title {
  font-size: 30rpx;
  color: var(--text);
  font-weight: 500;
}

.history-sub {
  font-size: 24rpx;
  color: var(--text-dim);
  line-height: 1.4;
}

.history-score {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
  box-shadow: 0 2rpx 8rpx rgba(16, 185, 129, 0.2);
  transition: var(--transition);
}

.history-score.mid {
  background: linear-gradient(135deg, var(--warning) 0%, #d97706 100%);
  box-shadow: 0 2rpx 8rpx rgba(245, 158, 11, 0.2);
}

.history-score.low {
  background: linear-gradient(135deg, var(--error) 0%, #dc2626 100%);
  box-shadow: 0 2rpx 8rpx rgba(239, 68, 68, 0.2);
}

/* 历史记录空状态 */
.history-empty {
  height: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  gap: 16rpx;
  border: 1rpx dashed var(--card-border);
  border-radius: 16rpx;
  padding: 20rpx;
}

/* 弹窗容器 - 优化圆角、阴影，增加过渡 */
.modal-container {
  background-color: var(--bg-dark);
  border-radius: 32rpx 32rpx 0 0;
  max-height: 70vh;
  border-top: 1rpx solid var(--card-border);
  box-shadow: 0 -4rpx 30rpx rgba(0, 0, 0, 0.4);
  transition: var(--transition-long);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx;
  border-bottom: 1rpx solid var(--card-border);
}

.modal-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text);
}

.modal-close {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: rgba(51, 65, 85, 0.3);
  transition: var(--transition);
}

.modal-btn-hover {
  background-color: rgba(51, 65, 85, 0.6);
  color: var(--text);
}

.modal-footer {
  padding: 20rpx 30rpx 40rpx;
  border-top: 1rpx solid var(--card-border);
}

.btn-confirm {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: #fff;
  border-radius: 16rpx;
  font-size: 32rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  transition: var(--transition);
}

.btn-confirm-hover {
  background: linear-gradient(135deg, var(--primary-light) 0%, var(--accent-light) 100%);
  box-shadow: 0 0 20rpx rgba(6, 182, 212, 0.2);
}

/* 年份网格 - 优化选中态、hover态，增加圆角 */
.year-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20rpx;
  padding: 30rpx;
  max-height: 50vh;
  overflow-y: auto;
}

.year-item {
  aspect-ratio: 2;
  background-color: var(--card-bg);
  border: 1rpx solid var(--card-border);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: var(--text);
  transition: var(--transition);
}

.year-item.active {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  border-color: transparent;
  color: #fff;
  font-weight: 600;
  box-shadow: 0 0 15rpx rgba(6, 182, 212, 0.3);
}

.year-item-hover {
  border-color: var(--primary);
  background-color: rgba(6, 182, 212, 0.1);
}

/* 选项列表 - 优化hover态，增加过渡 */
.option-list {
  padding: 20rpx 30rpx;
  max-height: 50vh;
  overflow-y: auto;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx;
  background-color: var(--card-bg);
  border: 1rpx solid var(--card-border);
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  transition: var(--transition);
}

.option-hover {
  transform: translateY(-2rpx);
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.2);
}

.option-item.active {
  border-color: var(--primary);
  background-color: rgba(6, 182, 212, 0.1);
  box-shadow: 0 0 10rpx rgba(6, 182, 212, 0.15);
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.option-name {
  font-size: 32rpx;
  color: var(--text);
  font-weight: 600;
}

.option-desc {
  font-size: 26rpx;
  color: var(--text-dim);
  line-height: 1.4;
}

.option-meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.meta-tag {
  font-size: 22rpx;
  color: var(--primary);
  border: 1rpx solid var(--primary);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.option-check {
  width: 48rpx;
  height: 48rpx;
  background-color: rgba(6, 182, 212, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

/* 设置面板（侧滑）- 优化宽度、阴影 */
.setting-panel {
  width: 85vw;
  height: 100vh;
  background-color: var(--bg-dark);
  border-left: 1rpx solid var(--card-border);
  display: flex;
  flex-direction: column;
  box-shadow: -4rpx 0 30rpx rgba(0, 0, 0, 0.4);
}

.setting-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 60rpx 30rpx 30rpx;
  border-bottom: 1rpx solid var(--card-border);
}

.setting-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 1px;
}

.close-btn {
  width: 60rpx;
  height: 60rpx;
  background-color: var(--card-bg);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.setting-body {
  flex: 1;
  padding: 30rpx;
  overflow-y: auto;
}

.setting-section {
  margin-bottom: 40rpx;
}

.section-label {
  font-size: 26rpx;
  color: var(--text-muted);
  margin-bottom: 20rpx;
  display: block;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* 服务商列表 - 优化hover态 */
.provider-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.provider-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background-color: var(--card-bg);
  border: 1rpx solid var(--card-border);
  border-radius: 16rpx;
  padding: 24rpx;
  transition: var(--transition);
}

.provider-hover {
  transform: translateX(4rpx);
}

.provider-item.active {
  border-color: var(--primary);
  background-color: rgba(6, 182, 212, 0.1);
}

.provider-icon {
  width: 64rpx;
  height: 64rpx;
  background-color: rgba(6, 182, 212, 0.2);
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
}

.provider-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.provider-name {
  font-size: 30rpx;
  color: var(--text);
  font-weight: 600;
}

.provider-status {
  font-size: 24rpx;
  color: var(--text-dim);
}

/* 输入框 - 优化高度、聚焦样式 */
.tech-input {
  width: 100%;
  height: 88rpx;
  background-color: var(--card-bg);
  border: 1rpx solid var(--card-border);
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: var(--text);
  box-sizing: border-box;
  transition: var(--transition);
}

.tech-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4rpx rgba(6, 182, 212, 0.15);
}

.input-tip {
  font-size: 24rpx;
  color: var(--text-dim);
  margin-top: 12rpx;
  display: block;
  line-height: 1.4;
}

/* API Key缺省提示 */
.input-warning {
  font-size: 24rpx;
  color: var(--warning);
  margin-top: 8rpx;
  display: block;
  line-height: 1.4;
}

/* 风格网格 - 优化hover态，增加阴影 */
.style-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
}

.style-card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--card-border);
  border-radius: 16rpx;
  padding: 30rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  transition: var(--transition);
}

.style-hover {
  transform: scale(1.05);
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.2);
}

.style-card.active {
  border-color: var(--primary);
  background-color: rgba(6, 182, 212, 0.1);
  box-shadow: 0 0 10rpx rgba(6, 182, 212, 0.15);
}

.style-emoji {
  font-size: 48rpx;
}

.style-name {
  font-size: 26rpx;
  color: var(--text);
}

/* 范围标签 */
.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
  color: var(--text-dim);
  margin-top: 10rpx;
}

.btn-save-tech {
  width: 100%;
  height: 90rpx;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: #fff;
  border-radius: 16rpx;
  font-size: 32rpx;
  font-weight: 600;
  border: none;
  transition: var(--transition);
}

/* 结果弹窗 - 优化圆角、阴影，增加渐变 */
.result-modal {
  width: 90vw;
  height: 85vh;
  background-color: var(--bg-dark);
  border: 1rpx solid var(--card-border);
  border-radius: 32rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-image: radial-gradient(circle at top center, rgba(6, 182, 212, 0.08) 0%, transparent 50%);
}

.result-header-tech {
  background: linear-gradient(180deg, rgba(6, 182, 212, 0.25) 0%, transparent 100%);
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-bottom: 1rpx solid var(--card-border);
}

/* 分数环 - 优化样式，增加渐变和过渡 */
.result-score-ring {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  margin-bottom: 20rpx;
}

.score-ring-bg {
  position: absolute;
  inset: 0;
  border: 8rpx solid var(--card-border);
  border-radius: 50%;
  background-color: rgba(15, 23, 42, 0.5);
}

.score-ring-progress {
  position: absolute;
  inset: 0;
  border: 8rpx solid transparent;
  border-top-color: var(--primary);
  border-right-color: var(--primary);
  border-radius: 50%;
  transform: rotate(var(--score));
  transition: transform 1.2s ease-out;
  filter: drop-shadow(0 0 8rpx rgba(6, 182, 212, 0.3));
}

.score-inner {
  position: absolute;
  inset: 20rpx;
  background-color: var(--card-bg);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
  box-shadow: inset 0 2rpx 8rpx rgba(0, 0, 0, 0.2);
}

.score-value {
  font-size: 64rpx;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
  text-shadow: 0 0 10rpx rgba(241, 245, 249, 0.1);
}

.score-total {
  font-size: 28rpx;
  color: var(--text-dim);
}

.result-level {
  font-size: 30rpx;
  color: var(--primary);
  font-weight: 600;
  letter-spacing: 1px;
}

.result-body {
  flex: 1;
  padding: 30rpx;
}

.analysis-section {
  margin-bottom: 40rpx;
}

.section-title-tech {
  font-size: 30rpx;
  color: var(--text);
  font-weight: 600;
  margin-bottom: 20rpx;
  display: block;
  line-height: 1.2;
}

.comment-text {
  font-size: 30rpx;
  color: var(--text-muted);
  line-height: 1.7;
}

/* 维度条 - 优化高度、圆角，增加过渡 */
.dimension {
  margin-bottom: 20rpx;
}

.dim-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.dim-name {
  font-size: 28rpx;
  color: var(--text-muted);
}

.dim-score {
  font-size: 28rpx;
  color: var(--primary);
  font-weight: 600;
}

.dim-bar {
  height: 14rpx;
  background-color: var(--card-bg);
  border-radius: 8rpx;
  overflow: hidden;
  border: 1rpx solid var(--card-border);
}

.dim-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%);
  border-radius: 6rpx;
  transition: width 1s ease-out 0.3s;
  box-shadow: 0 0 10rpx rgba(6, 182, 212, 0.2);
}

/* 错误卡片 - 优化左边框、内边距 */
.error-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.error-card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--card-border);
  border-radius: 16rpx;
  padding: 24rpx;
  border-left: 6rpx solid var(--error);
  transition: var(--transition);
}

.error-card:hover {
  border-left-color: var(--error-light);
  box-shadow: 0 2rpx 10rpx rgba(239, 68, 68, 0.08);
}

.error-tag {
  font-size: 24rpx;
  color: var(--error);
  font-weight: 600;
  margin-bottom: 12rpx;
  display: block;
}

.error-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
  flex-wrap: wrap;
  line-height: 1.6;
}

.text-wrong {
  font-size: 30rpx;
  color: var(--error);
  text-decoration: line-through;
}

.text-correct {
  font-size: 30rpx;
  color: var(--success);
  font-weight: 600;
}

.error-note {
  font-size: 26rpx;
  color: var(--text-dim);
  line-height: 1.5;
}

/* 润色框 - 优化背景、阴影 */
.polished-box {
  background-color: var(--card-bg);
  border: 1rpx solid var(--card-border);
  border-radius: 16rpx;
  padding: 24rpx;
  position: relative;
  background-color: rgba(15, 23, 42, 0.6);
}

.polished-text {
  font-size: 30rpx;
  color: var(--text);
  line-height: 1.8;
  display: block;
  margin-bottom: 20rpx;
}

.btn-copy {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  background-color: rgba(6, 182, 212, 0.1);
  color: var(--primary);
  padding: 12rpx 24rpx;
  border-radius: 8rpx;
  font-size: 26rpx;
  transition: var(--transition);
  border: 1rpx solid transparent;
}

.btn-copy:hover {
  border-color: var(--primary);
  background-color: rgba(6, 182, 212, 0.15);
}

.result-footer {
  padding: 20rpx 30rpx 40rpx;
  border-top: 1rpx solid var(--card-border);
}

.btn-close-tech {
  width: 100%;
  height: 88rpx;
  background-color: var(--card-bg);
  color: var(--text);
  border: 1rpx solid var(--card-border);
  border-radius: 16rpx;
  font-size: 32rpx;
  transition: var(--transition);
}

/* 滚动条样式优化 - 科技风滚动条 */
::-webkit-scrollbar {
  width: 6rpx;
  height: 6rpx;
}

::-webkit-scrollbar-track {
  background: rgba(51, 65, 85, 0.2);
  border-radius: 3rpx;
}

::-webkit-scrollbar-thumb {
  background: var(--text-dim);
  border-radius: 3rpx;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--primary);
}
</style>