<template>
  <view class="app-container">
    <header class="top-bar">
      <div class="back-btn" @click="goBack">❮</div>
      <div class="top-bar-title">试卷批量导入</div>
    </header>

    <main class="main-content">
      <section class="import-section">
        <div class="section-title">上传 JSON 题目文件</div>
        <div class="upload-area" @click="chooseFile">
          <div class="upload-icon">📜</div>
          <div class="upload-text">{{ fileName ? `已加载：${fileName}` : '选择题目 JSON 文件' }}</div>
          <div class="upload-hint" v-if="allQuestions.length > 0">共加载 {{ allQuestions.length }} 道题目</div>
        </div>
      </section>

      <section class="import-section" v-if="detectedPapers.length > 0">
        <div class="section-title">识别到 {{ detectedPapers.length }} 张试卷</div>
        <div class="paper-list">
          <div class="paper-item" v-for="(paper, index) in detectedPapers" :key="index">
            <div class="paper-header">
              <span class="paper-title">{{ paper.title }}</span>
              <span class="paper-count">{{ paper.questions.length }} 题</span>
            </div>
            <div class="paper-details">
              <span class="detail-tag">{{ paper.school }}</span>
              <span class="detail-tag">{{ paper.year }}</span>
              <span class="detail-tag" v-if="paper.examCode">{{ paper.examCode }}</span>
              <span class="detail-tag score">总分: {{ paper.totalScore }}</span>
            </div>
          </div>
        </div>
        
        <div class="action-bar">
          <button class="import-btn" :loading="importing" @click="startBatchImport">开始批量导入</button>
          <button class="clear-btn" @click="clearData">清除</button>
        </div>
      </section>

      <section class="import-section">
        <div class="section-title">手动修正默认信息 (可选)</div>
        <div class="form-container">
          <div class="form-row">
            <div class="form-item half">
              <text class="label">默认总分</text>
              <input class="input" type="number" v-model="manualPaperInfo.totalScore" />
            </div>
          </div>
        </div>
      </section>

      <section class="import-section">
        <div class="section-title">导入说明</div>
        <div class="instruction-list">
          <div class="instruction-item">1. 系统会自动根据题目中的 <text class="highlight">fromSchool, examTime, examCode, examFullName</text> 字段将题目分组成不同的试卷。</div>
          <div class="instruction-item">2. 如果题目中缺少这些字段，将使用下方的“手动修正”或默认值。</div>
          <div class="instruction-item">3. 默认总分为 <text class="highlight">150分</text>。</div>
          <div class="instruction-item">4. <text class="highlight">不包含题目解析</text>，仅保留题干、选项和答案。</div>
        </div>
        <div class="template-box">
          <div class="template-header">
            <span>JSON 题目数据格式要求</span>
            <span class="copy-btn" @click="copyTemplate">复制</span>
          </div>
          <pre class="template-content">{{ jsonTemplate }}</pre>
        </div>
      </section>
    </main>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { request } from '../../api/request';

const manualPaperInfo = ref({
  totalScore: 150,
  duration: 180,
  difficulty: '中等'
});

const fileName = ref('');
const allQuestions = ref([]);
const detectedPapers = ref([]);
const importing = ref(false);

const jsonTemplate = `[
  {
    "exerciseType": "单选题",
    "exerciseStem": "题目内容...",
    "exerciseAnswer": "A",
    "fromSchool": "全国统考",
    "examTime": "2009年",
    "examCode": "408",
    "examFullName": "计算机学科基础综合",
    "options": { "A": "选项A", "B": "选项B" }
  }
]`;

const goBack = () => {
  uni.navigateBack();
};

const copyTemplate = () => {
  uni.setClipboardData({
    data: jsonTemplate,
    success: () => {
      uni.showToast({ title: '已复制', icon: 'success' });
    }
  });
};

const chooseFile = () => {
  // #ifdef H5
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.multiple = true; // 允许选择多个文件
  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      let combinedQuestions = [];
      for (const file of files) {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          combinedQuestions = [...combinedQuestions, ...data];
        }
      }
      
      if (combinedQuestions.length > 0) {
        allQuestions.value = combinedQuestions;
        fileName.value = files.length === 1 ? files[0].name : `已选择 ${files.length} 个文件`;
        detectPapers(combinedQuestions);
      } else {
        uni.showToast({ title: '所选文件格式不正确', icon: 'none' });
      }
    } catch (error) {
      console.error('解析失败:', error);
      uni.showToast({ title: '解析失败，请检查文件格式', icon: 'none' });
    }
  };
  input.click();
  // #endif
};

const detectPapers = (questions) => {
  const groups = new Map();
  questions.forEach(q => {
    const school = q.fromSchool || '未知学校';
    const year = q.examTime || '未知年份';
    const code = q.examCode || '';
    const fullName = q.examFullName || '未命名试卷';
    
    const key = `${school}-${year}-${code}-${fullName}`;
    if (!groups.has(key)) {
      groups.set(key, {
        title: fullName,
        school,
        year,
        examCode: code,
        totalScore: manualPaperInfo.value.totalScore,
        questions: []
      });
    }
    groups.get(key).questions.push(q);
  });
  
  detectedPapers.value = Array.from(groups.values());
};

const clearData = () => {
  allQuestions.value = [];
  detectedPapers.value = [];
  fileName.value = '';
};

const startBatchImport = async () => {
  if (allQuestions.value.length === 0) {
    uni.showToast({ title: '请先上传题目文件', icon: 'none' });
    return;
  }

  importing.value = true;
  try {
    const res = await request({
      url: '/computer1/import-paper',
      method: 'POST',
      data: {
        paperInfo: manualPaperInfo.value,
        questions: allQuestions.value
      }
    });

    uni.showModal({
      title: '导入成功',
      content: res.message || `批量导入完成`,
      showCancel: false,
      success: () => {
        clearData();
      }
    });
  } catch (error) {
    console.error('导入失败:', error);
    uni.showModal({
      title: '导入失败',
      content: error.message || '未知错误',
      showCancel: false
    });
  } finally {
    importing.value = false;
  }
};
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.top-bar {
  padding: 44px 16px 12px;
  background: #fff;
  display: flex;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.back-btn {
  font-size: 20px;
  padding: 8px;
  margin-right: 12px;
  cursor: pointer;
}

.top-bar-title {
  font-size: 18px;
  font-weight: 600;
}

.main-content {
  padding: 20px 16px;
}

.import-section {
  background: #fff;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
  display: flex;
  align-items: center;
}

.section-title::before {
  content: "";
  width: 4px;
  height: 16px;
  background: #007aff;
  margin-right: 8px;
  border-radius: 2px;
}

.upload-area {
  border: 2px dashed #dee2e6;
  border-radius: 12px;
  padding: 30px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

.upload-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.upload-text {
  font-size: 15px;
  color: #333;
  font-weight: 500;
}

.upload-hint {
  font-size: 13px;
  color: #007aff;
  margin-top: 8px;
}

.paper-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.paper-item {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #eee;
}

.paper-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.paper-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.paper-count {
  font-size: 12px;
  color: #007aff;
  background: #e6f0ff;
  padding: 2px 8px;
  border-radius: 10px;
}

.paper-details {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-tag {
  font-size: 12px;
  color: #666;
  background: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.detail-tag.score {
  color: #f5222d;
  border-color: #ffa39e;
  background: #fff1f0;
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.half {
  flex: 1;
}

.label {
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.input {
  height: 36px;
  background: #f8f9fa;
  border-radius: 6px;
  padding: 0 10px;
  font-size: 14px;
  border: 1px solid #eee;
}

.action-bar {
  display: flex;
  gap: 12px;
}

.import-btn {
  flex: 2;
  background: #007aff;
  color: #fff;
  border-radius: 8px;
  font-size: 15px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-btn {
  flex: 1;
  background: #f8f9fa;
  color: #666;
  border-radius: 8px;
  font-size: 15px;
  height: 44px;
  border: 1px solid #ddd;
}

.instruction-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.instruction-item {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
}

.highlight {
  color: #007aff;
  font-weight: 600;
}

.template-box {
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #eee;
}

.template-header {
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #999;
}

.copy-btn {
  color: #007aff;
  cursor: pointer;
}

.template-content {
  padding: 12px;
  font-size: 11px;
  color: #666;
  max-height: 150px;
  overflow-y: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
