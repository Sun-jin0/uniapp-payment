<template>
  <div class="public-bulk-import-container">
    <div class="header">
      <h2>公共题库批量导入</h2>
      <p class="subtitle">选择文件夹或多个文件，自动识别并预览</p>
    </div>

    <el-card class="action-card">
      <el-form inline>
        <el-form-item label="选择科目">
          <el-select v-model="subjectIndex" placeholder="请选择科目" @change="handleSubjectChange">
            <el-option
              v-for="(sub, index) in subjects"
              :key="sub.id"
              :label="sub.name"
              :value="index"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <input
            type="file"
            webkitdirectory
            ref="folderInput"
            style="display: none"
            @change="handleFileChange"
          />
          <el-button type="primary" @click="$refs.folderInput.click()">
            <el-icon><Folder /></el-icon> 选择文件夹
          </el-button>
          
          <input
            type="file"
            multiple
            accept=".json"
            ref="filesInput"
            style="display: none"
            @change="handleFileChange"
          />
          <el-button @click="$refs.filesInput.click()">
            <el-icon><Document /></el-icon> 选择多个文件
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div v-if="bookGroups.length > 0" class="preview-section">
      <div class="section-header">
        <h3>待导入书籍 ({{ bookGroups.length }})</h3>
        <el-checkbox v-model="isAllSelected" @change="toggleSelectAll">全选</el-checkbox>
      </div>

      <div class="book-list">
        <el-card
          v-for="(group, index) in bookGroups"
          :key="index"
          class="book-item"
          :class="{ 
            'imported': group.status === 'success', 
            'error': group.status === 'error', 
            'processing': group.status === 'processing' 
          }"
          shadow="hover"
        >
          <div class="book-info">
            <el-checkbox 
              v-model="group.selected" 
              :disabled="group.status === 'processing' || group.status === 'success'"
            />
            <div class="book-detail">
              <div class="book-title">{{ group.name }}</div>
              <div class="book-meta">
                <el-tag size="small" v-if="group.preview?.questionCount">{{ group.preview.questionCount }} 题</el-tag>
                <el-tag size="small" type="warning" v-if="group.preview?.hasStructure">含结构</el-tag>
                <el-tag size="small" type="info" v-for="cat in group.preview?.categories" :key="cat">{{ cat }}</el-tag>
              </div>
              <div class="file-tags">
                <span v-for="file in group.files" :key="file.name" class="file-tag">{{ file.name }}</span>
              </div>
            </div>
          </div>

          <div class="book-status">
            <el-tag v-if="group.status === 'pending'" type="info">等待预览</el-tag>
            <el-tag v-else-if="group.status === 'previewed'" type="success">就绪</el-tag>
            <el-tag v-else-if="group.status === 'processing'">导入中...</el-tag>
            <el-tag v-else-if="group.status === 'success'" type="success">已完成</el-tag>
            <el-tag v-else-if="group.status === 'error'" type="danger">{{ group.errorMsg || '失败' }}</el-tag>
            
            <el-button 
              v-if="group.status === 'previewed' || group.status === 'error'" 
              size="small" 
              type="primary" 
              @click="importSingle(index)"
            >
              导入
            </el-button>
          </div>
        </el-card>
      </div>

      <div class="footer-actions">
        <el-button 
          type="primary" 
          size="large" 
          :loading="batchImporting" 
          :disabled="batchImporting || selectedCount === 0" 
          @click="startBatchImport"
        >
          开始批量导入 ({{ selectedCount }})
        </el-button>
      </div>
    </div>

    <el-empty v-else-if="hasAttempted" description="未识别到有效的 JSON 文件组合 (需包含 info, questions, answers)" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { adminApi, publicApi } from '../api';
import { ElMessage } from 'element-plus';
import { Folder, Document } from '@element-plus/icons-vue';

const subjects = ref([]);
const subjectIndex = ref(0);
const bookGroups = ref([]);
const hasAttempted = ref(false);
const batchImporting = ref(false);

onMounted(() => {
  loadSubjects();
});

const loadSubjects = async () => {
  try {
    const res = await adminApi.getNavSubjects();
    if (res.code === 0 && res.data && res.data.length > 0) {
      subjects.value = res.data.map(s => ({
        id: s.subject_code || s.name,
        name: s.name
      }));
    }
  } catch (error) {
    console.error('加载科目失败:', error);
  }
};

const handleSubjectChange = (val) => {
  subjectIndex.value = val;
};

const handleFileChange = (e) => {
  const files = Array.from(e.target.files).filter(f => f.name.endsWith('.json'));
  if (files.length === 0) {
    ElMessage.warning('没有找到 JSON 文件');
    return;
  }
  groupFiles(files);
};

const groupFiles = (files) => {
  const groups = {};
  
  files.forEach(file => {
    let baseName = file.name.replace('.json', '');
    baseName = baseName.replace(/[\s\-_]?(questions|answers|structure|decrypted_output|结构)$/i, '');
    
    if (!groups[baseName]) {
      groups[baseName] = {
        name: baseName,
        files: [],
        selected: true,
        status: 'pending',
        errorMsg: '',
        preview: null
      };
    }
    groups[baseName].files.push(file);
  });
  
  bookGroups.value = Object.values(groups).filter(g => g.files.length >= 3);
  hasAttempted.value = true;
  
  previewAll();
};

const readFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target.result));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

const previewAll = async () => {
  for (let i = 0; i < bookGroups.value.length; i++) {
    await previewSingle(i);
  }
};

const previewSingle = async (index) => {
  const group = bookGroups.value[index];
  try {
    const files = group.files;
    let bookFile, questionsFile, answersFile, structureFile;
    
    files.forEach(file => {
      const name = file.name.toLowerCase();
      if (name.includes('questions')) questionsFile = file;
      else if (name.includes('answers')) answersFile = file;
      else if (name.includes('structure') || name.includes('decrypted_output') || name.includes('结构')) structureFile = file;
      else bookFile = file;
    });

    if (!bookFile || !questionsFile || !answersFile) {
      group.status = 'error';
      group.errorMsg = '缺少核心文件';
      return;
    }

    const [bookJson, questionsJson, answersJson] = await Promise.all([
      readFile(bookFile),
      readFile(questionsFile),
      readFile(answersFile)
    ]);
    
    let structureJson = null;
    if (structureFile) {
      structureJson = await readFile(structureFile);
    }

    const res = await publicApi.previewImportPublicData({
      bookData: bookJson.data || bookJson,
      questions: questionsJson.data?.question_list || questionsJson.data || questionsJson,
      answers: answersJson.data || answersJson,
      chapterData: structureJson,
      subject: subjects.value[subjectIndex.value].id
    });

    if (res.code === 0) {
      group.preview = res.data;
      group.status = 'previewed';
      group.parsedData = {
        bookData: bookJson.data || bookJson,
        questions: questionsJson.data?.question_list || questionsJson.data || questionsJson,
        answers: answersJson.data || answersJson,
        chapterData: structureJson
      };
    } else {
      group.status = 'error';
      group.errorMsg = res.msg;
    }
  } catch (err) {
    group.status = 'error';
    group.errorMsg = '解析失败';
    console.error(err);
  }
};

const isAllSelected = computed({
  get: () => {
    const selectable = bookGroups.value.filter(g => g.status !== 'processing' && g.status !== 'success');
    return selectable.length > 0 && selectable.every(g => g.selected);
  },
  set: (val) => {
    toggleSelectAll(val);
  }
});

const toggleSelectAll = (val) => {
  bookGroups.value.forEach(group => {
    if (group.status !== 'processing' && group.status !== 'success') {
      group.selected = val;
    }
  });
};

const selectedCount = computed(() => {
  return bookGroups.value.filter(g => g.selected && g.status !== 'success').length;
});

const startBatchImport = async () => {
  if (batchImporting.value) return;
  
  batchImporting.value = true;
  const toImport = bookGroups.value.filter(g => g.selected && g.status !== 'success');
  
  for (const group of toImport) {
    const index = bookGroups.value.indexOf(group);
    await performImport(index);
  }
  
  batchImporting.value = false;
  ElMessage.success('批量导入完成');
};

const importSingle = async (index) => {
  await performImport(index);
};

const performImport = async (index) => {
  const group = bookGroups.value[index];
  group.status = 'processing';
  
  try {
    const { bookData, questions, answers, chapterData } = group.parsedData;
    
    const res = await publicApi.importPublicData({
      bookData,
      questions,
      answers,
      subject: subjects.value[subjectIndex.value].id
    });
    
    if (res.code === 0) {
      const bookId = res.data.bookId;
      if (chapterData) {
        await publicApi.structureBook({
          bookId,
          chapterData
        });
      }
      group.status = 'success';
    } else {
      group.status = 'error';
      group.errorMsg = res.msg;
    }
  } catch (err) {
    group.status = 'error';
    group.errorMsg = '导入异常';
    console.error(err);
  }
};
</script>

<style scoped>
.public-bulk-import-container {
  padding: 20px;
}
.header {
  margin-bottom: 20px;
}
.subtitle {
  color: #666;
  font-size: 14px;
  margin-top: 5px;
}
.action-card {
  margin-bottom: 20px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}
.book-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-height: 60vh;
  overflow-y: auto;
}
.book-item {
  transition: all 0.3s;
}
.book-item.processing {
  border-left: 5px solid #409EFF;
  background-color: #f0f9eb;
}
.book-item.success {
  border-left: 5px solid #67C23A;
  background-color: #f0f9eb;
}
.book-item.error {
  border-left: 5px solid #F56C6C;
  background-color: #fef0f0;
}
.book-info {
  display: flex;
  align-items: flex-start;
  gap: 15px;
}
.book-detail {
  flex: 1;
}
.book-title {
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 5px;
}
.book-meta {
  display: flex;
  gap: 5px;
  margin-bottom: 5px;
}
.file-tags {
  display: flex;
  gap: 5px;
}
.file-tag {
  background-color: #f4f4f5;
  color: #909399;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
}
.book-status {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.footer-actions {
  margin-top: 20px;
  text-align: center;
}
</style>
