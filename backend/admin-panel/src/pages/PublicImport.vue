<template>
  <div class="public-import-container">
    <div class="header">
      <h2>公共题库导入</h2>
    </div>

    <el-card class="form-card">
      <el-form label-width="120px">
        <el-form-item label="科目分类">
          <el-select v-model="subjectIndex" placeholder="请选择科目" @change="handleSubjectChange">
            <el-option
              v-for="(sub, index) in subjects"
              :key="sub.id"
              :label="sub.name"
              :value="index"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="数据文件 (JSON)">
          <div class="file-uploader">
            <input
              type="file"
              multiple
              accept=".json"
              ref="fileInput"
              style="display: none"
              @change="handleFileChange"
            />
            <el-button type="primary" @click="$refs.fileInput.click()">选择 3 个 JSON 文件</el-button>
            <div v-if="selectedFiles.length" class="file-list">
              <el-tag
                v-for="(file, index) in selectedFiles"
                :key="index"
                class="file-tag"
                closable
                @close="removeFile(index)"
              >
                {{ file.name }}
              </el-tag>
            </div>
            <div class="tips">请确保文件名包含 'questions' 和 'answers' 以便自动识别。</div>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="importing"
            :disabled="!canImport"
            @click="startImport"
          >
            开始导入
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-alert
      v-if="importResult"
      :title="importResult.msg"
      :type="importResult.success ? 'success' : 'error'"
      show-icon
      class="result-alert"
    />

    <!-- 章节结构化处理 -->
    <el-card class="form-card structure-section">
      <template #header>
        <div class="clearfix">
          <span>章节结构化处理</span>
        </div>
      </template>
      
      <el-form label-width="120px">
        <el-form-item label="选择科目">
          <el-select v-model="structureSubjectIndex" placeholder="请选择科目" @change="handleStructureSubjectChange">
            <el-option
              v-for="(sub, index) in subjects"
              :key="sub.id"
              :label="sub.name"
              :value="index"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="选择大类">
          <el-select
            v-model="structureCategoryIndex"
            placeholder="请选择分类"
            @change="handleStructureCategoryChange"
            :disabled="!structureCategories.length"
          >
            <el-option
              v-for="(cat, index) in structureCategories"
              :key="cat.id"
              :label="cat.name"
              :value="index"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="选择小类">
          <el-select
            v-model="structureSubCategoryIndex"
            placeholder="请选择小类"
            @change="handleStructureSubCategoryChange"
            :disabled="!structureSubCategories.length"
          >
            <el-option
              v-for="(cat, index) in structureSubCategories"
              :key="cat.id"
              :label="cat.name"
              :value="index"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="选择书籍">
          <el-select
            v-model="structureBookIndex"
            placeholder="请选择书籍"
            @change="handleStructureBookChange"
            :disabled="!structureBooks.length"
          >
            <el-option
              v-for="(book, index) in structureBooks"
              :key="book.id"
              :label="book.name || book.title"
              :value="index"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="结构化文件">
          <input
            type="file"
            accept=".json"
            ref="structureInput"
            style="display: none"
            @change="handleStructureFileChange"
          />
          <el-button @click="$refs.structureInput.click()">选择结构化 JSON 文件</el-button>
          <span v-if="structureFile" class="file-name ml-10">{{ structureFile.name }}</span>
        </el-form-item>

        <el-form-item>
          <el-button
            type="success"
            :loading="structuring"
            :disabled="!structureBookId || !structureFile"
            @click="startStructuring"
          >
            生成章节结构
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { adminApi, publicApi } from '../api';
import { ElMessage, ElMessageBox } from 'element-plus';

const subjects = ref([
  { id: 'politics', name: '政治' },
  { id: 'math', name: '数学' },
  { id: 'english', name: '英语' },
  { id: 'computer', name: '计算机' }
]);

const subjectIndex = ref(0);
const selectedFiles = ref([]);
const importing = ref(false);
const importResult = ref(null);

// 章节结构化相关
const structureBookId = ref('');
const structureFile = ref(null);
const structuring = ref(false);
const structureSubjectIndex = ref(0);
const structureCategories = ref([]);
const structureCategoryIndex = ref(null);
const structureSubCategories = ref([]);
const structureSubCategoryIndex = ref(null);
const structureBooks = ref([]);
const structureBookIndex = ref(null);

onMounted(() => {
  loadSubjects().then(() => {
    fetchStructureCategories();
  });
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
  const files = Array.from(e.target.files);
  if (files.length !== 3) {
    ElMessage.warning('请选择 3 个 JSON 文件');
    return;
  }
  selectedFiles.value = files;
};

const removeFile = (index) => {
  selectedFiles.value.splice(index, 1);
};

const canImport = computed(() => {
  return selectedFiles.value.length === 3;
});

const readFile = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(JSON.parse(e.target.result));
    reader.readAsText(file);
  });
};

const startImport = async () => {
  if (!canImport.value) return;
  
  importing.value = true;
  importResult.value = null;

  try {
    let bookFile, questionsFile, answersFile;
    
    selectedFiles.value.forEach(file => {
      const name = file.name.toLowerCase();
      if (name.includes('questions')) questionsFile = file;
      else if (name.includes('answers')) answersFile = file;
      else bookFile = file;
    });

    if (!bookFile || !questionsFile || !answersFile) {
      throw new Error('未能正确识别书籍、题目和答案文件');
    }

    const bookJson = await readFile(bookFile);
    const questionsJson = await readFile(questionsFile);
    const answersJson = await readFile(answersFile);

    const bookData = bookJson.data || bookJson;
    const questions = questionsJson.data?.question_list || questionsJson.data || questionsJson;
    const answers = answersJson.data || answersJson;

    const res = await publicApi.importPublicData({
      bookData,
      questions: Array.isArray(questions) ? questions : [],
      answers: Array.isArray(answers) ? answers : [],
      subject: subjects.value[subjectIndex.value].id
    });

    if (res.code === 0) {
      importResult.value = { success: true, msg: '导入成功！书籍 ID: ' + res.data.bookId };
      ElMessage.success('导入成功');
      
      // 自动切换结构化部分的科目并加载分类
      structureSubjectIndex.value = subjectIndex.value;
      await fetchStructureCategories();
      
      // 选中新导入的分类和书籍逻辑 (简化处理，让用户手动选也行，或者尝试自动匹配)
      // 这里暂时只刷新分类列表
      
      selectedFiles.value = [];
    } else {
      throw new Error(res.msg);
    }
  } catch (error) {
    importResult.value = { success: false, msg: '导入失败: ' + error.message };
    ElMessage.error(error.message);
  } finally {
    importing.value = false;
  }
};

// Structure Logic
const fetchStructureCategories = async () => {
  const subject = subjects.value[structureSubjectIndex.value]?.id;
  if (!subject) return;

  try {
    const res = await publicApi.getPublicCategories({ subject, level: 2 });
    if (res.code === 0) {
      structureCategories.value = res.data;
      structureCategoryIndex.value = null;
      structureSubCategories.value = [];
      structureSubCategoryIndex.value = null;
      structureBooks.value = [];
      structureBookIndex.value = null;
      structureBookId.value = '';
    }
  } catch (error) {
    console.error('获取分类列表失败:', error);
  }
};

const handleStructureSubjectChange = () => {
  fetchStructureCategories();
};

const handleStructureCategoryChange = async (index) => {
  structureCategoryIndex.value = index;
  const subject = subjects.value[structureSubjectIndex.value]?.id;
  const parentCat = structureCategories.value[index];
  
  if (!subject || !parentCat) return;

  try {
    const res = await publicApi.getPublicCategories({ 
      subject, 
      parentId: parentCat.id,
      level: 3 
    });
    if (res.code === 0) {
      structureSubCategories.value = res.data;
      structureSubCategoryIndex.value = null;
      structureBooks.value = [];
      structureBookIndex.value = null;
      structureBookId.value = '';
      
      if (res.data.length === 0) {
        fetchStructureBooks();
      }
    }
  } catch (error) {
    console.error('获取子分类失败:', error);
  }
};

const handleStructureSubCategoryChange = (index) => {
  structureSubCategoryIndex.value = index;
  fetchStructureBooks();
};

const fetchStructureBooks = async () => {
  const subject = subjects.value[structureSubjectIndex.value]?.id;
  const secondCat = structureCategories.value[structureCategoryIndex.value];
  const thirdCat = structureSubCategories.value[structureSubCategoryIndex.value];
  
  if (!subject || !secondCat) return;

  const categoryId = thirdCat ? thirdCat.id : secondCat.id;
  const level = thirdCat ? 3 : 2;

  try {
    const res = await publicApi.getPublicBooks({ 
      subject, 
      categoryId,
      level
    });
    if (res.code === 0) {
      structureBooks.value = res.data;
      structureBookIndex.value = null;
      structureBookId.value = '';
    }
  } catch (error) {
    console.error('获取书籍列表失败:', error);
  }
};

const handleStructureBookChange = (index) => {
  structureBookIndex.value = index;
  const book = structureBooks.value[index];
  if (book) {
    structureBookId.value = book.id;
  }
};

const handleStructureFileChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    structureFile.value = file;
  }
};

const startStructuring = async () => {
  if (!structureBookId.value || !structureFile.value) return;

  structuring.value = true;
  try {
    const json = await readFile(structureFile.value);
    const res = await publicApi.structureBook({
      bookId: structureBookId.value,
      chapterData: json
    });

    if (res.code === 0) {
      ElMessage.success('结构化处理成功');
      structureFile.value = null;
    } else {
      throw new Error(res.msg);
    }
  } catch (error) {
    ElMessageBox.alert(error.message, '处理失败');
  } finally {
    structuring.value = false;
  }
};
</script>

<style scoped>
.public-import-container {
  padding: 20px;
}
.form-card {
  margin-bottom: 20px;
}
.file-list {
  margin-top: 10px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.tips {
  margin-top: 10px;
  color: #909399;
  font-size: 12px;
}
.result-alert {
  margin-bottom: 20px;
}
.ml-10 {
  margin-left: 10px;
}
</style>
