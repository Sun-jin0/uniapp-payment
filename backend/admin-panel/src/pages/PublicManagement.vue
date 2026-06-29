<template>
  <div class="public-management">
    <div class="header">
      <h2>公共课综合管理</h2>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <!-- 1. 纠错反馈 -->
      <el-tab-pane label="纠错反馈" name="feedback">
        <div class="filter-bar">
          <el-select v-model="feedbackSubject" placeholder="科目" @change="fetchFeedbacks" clearable>
            <el-option label="全部科目" value="" />
            <el-option v-for="subj in subjects" :key="subj.key" :label="subj.name" :value="subj.key" />
          </el-select>
          <el-select v-model="statusIndex" placeholder="处理状态" @change="fetchFeedbacks">
            <el-option
              v-for="(opt, index) in statusOptions"
              :key="index"
              :label="opt.label"
              :value="index"
            />
          </el-select>
          <el-button type="primary" @click="fetchFeedbacks">刷新</el-button>
          
          <div class="right-actions" v-if="selectedFeedbackIds.length > 0">
            <span>已选 {{ selectedFeedbackIds.length }} 条</span>
            <el-button type="primary" size="small" @click="batchUpdateFeedbackStatus(1)">批量处理</el-button>
          </div>
        </div>

        <el-table
          v-if="!loading"
          :data="feedbacks || []"
          row-key="id"
          @selection-change="handleFeedbackSelectionChange"
          style="width: 100%"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column label="状态" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'">
                {{ scope.row.status === 1 ? '已处理' : '待处理' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="科目" width="100">
            <template #default="scope">{{ formatSubject(scope.row.subject) }}</template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="100" />
          <el-table-column prop="content" label="反馈内容" show-overflow-tooltip />
          <el-table-column prop="userNickname" label="用户" width="120" />
          <el-table-column prop="createdAt" label="时间" width="180">
            <template #default="scope">{{ formatDate(scope.row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="scope">
              <el-button link type="primary" @click="selectFeedback(scope.row)">详情/处理</el-button>
              <el-button v-if="scope.row.questionId" link type="success" @click="editFeedbackQuestion(scope.row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 反馈详情弹窗 -->
        <el-dialog v-model="showFeedbackDialog" title="反馈详情处理" width="800px">
          <div v-if="selectedFeedback">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="反馈内容">{{ selectedFeedback.content }}</el-descriptions-item>
              <el-descriptions-item label="关联题目ID">{{ selectedFeedback.questionId }}</el-descriptions-item>
            </el-descriptions>

            <div class="question-preview" v-if="selectedFeedback.questionDetail">
              <h4>题目预览</h4>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="题型" :span="1">{{ formatQuestionType(selectedFeedback.questionDetail.type) }}</el-descriptions-item>
                <el-descriptions-item label="难度" :span="1">{{ selectedFeedback.questionDetail.difficulty || '-' }}</el-descriptions-item>
                <el-descriptions-item label="年份" :span="1">{{ selectedFeedback.questionDetail.year || '-' }}</el-descriptions-item>
                <el-descriptions-item label="分值" :span="1">{{ selectedFeedback.questionDetail.score || '-' }}</el-descriptions-item>
                <el-descriptions-item label="题干" :span="2">{{ selectedFeedback.questionDetail.title }}</el-descriptions-item>
                <el-descriptions-item label="答案" :span="2">{{ selectedFeedback.questionDetail.answer }}</el-descriptions-item>
                <el-descriptions-item label="解析" :span="2">{{ selectedFeedback.questionDetail.explanation }}</el-descriptions-item>
              </el-descriptions>
              <div class="mt-10">
                <el-button type="primary" size="small" @click="startInlineEdit(selectedFeedback)">编辑该题</el-button>
              </div>
            </div>

            <div class="feedback-actions mt-20">
              <el-input
                v-model="adminRemark"
                type="textarea"
                placeholder="内部备注..."
                rows="2"
              />
              <el-input
                v-model="replyContent"
                type="textarea"
                placeholder="回复用户..."
                rows="2"
                class="mt-10"
              />
            </div>
          </div>
          <template #footer>
            <el-button @click="showFeedbackDialog = false">取消</el-button>
            <el-button type="primary" @click="handleUpdateFeedbackStatus(selectedFeedback.id, 1)">标记已处理并保存</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>

      <!-- 2. 试题管理 -->
      <el-tab-pane label="试题管理" name="question">
        <div class="filter-bar">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索题干或题目ID..."
            style="width: 200px"
            @keyup.enter="fetchQuestions"
          />
          <el-select v-model="subjectIndex" placeholder="科目" style="width: 150px" @change="onSubjectChange">
            <el-option
              v-for="(opt, index) in subjectOptions"
              :key="index"
              :label="opt.label"
              :value="index"
            />
          </el-select>
          <el-select v-model="firstCategoryId" placeholder="一级分类" style="width: 150px" @change="onFirstCategoryChange" clearable>
            <el-option
              v-for="cat in firstCategories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
          <el-select v-model="secondCategoryId" placeholder="二级分类" style="width: 150px" @change="onSecondCategoryChange" clearable :disabled="!firstCategoryId">
            <el-option
              v-for="cat in secondCategories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
          <el-select v-model="filterBookId" placeholder="书籍/试卷" style="width: 200px" @change="onBookChange" clearable filterable>
            <el-option
              v-for="book in filterBooks"
              :key="book.id"
              :label="book.name || book.title"
              :value="book.id"
            />
          </el-select>
          <el-select v-model="filterChapterId" placeholder="章节" style="width: 150px" @change="onChapterChange" clearable filterable :disabled="!filterBookId">
            <el-option
              v-for="chapter in filterChapters"
              :key="chapter.id"
              :label="chapter.name"
              :value="chapter.id"
            />
          </el-select>
          <el-button type="primary" @click="fetchQuestions">搜索</el-button>
          <el-button type="success" @click="showAddQuestion">新建试题</el-button>
          
          <div class="right-actions" v-if="selectedQuestionIds.length > 0">
            <el-button type="danger" size="small" @click="batchDeleteQuestions">批量删除</el-button>
          </div>
        </div>

        <el-table
          v-if="!loading"
          :data="questions || []"
          row-key="id"
          @selection-change="handleQuestionSelectionChange"
          style="width: 100%"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="bookName" label="所属书目" width="150" show-overflow-tooltip />
          <el-table-column prop="chapterName" label="章节" width="150" show-overflow-tooltip />
          <el-table-column prop="title" label="题干" show-overflow-tooltip />
          <el-table-column label="题型" width="100">
            <template #default="scope">{{ formatQuestionType(scope.row.type) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="scope">
              <el-button link type="primary" @click="toggleQuestionDetail(scope.row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-if="total > 0"
          layout="total, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="currentPage"
          @current-change="onPageChange"
        />
      </el-tab-pane>

      <!-- 3. 书籍试卷管理 -->
      <el-tab-pane label="书籍试卷管理" name="book">
        <div class="filter-bar">
          <el-select v-model="bookSubject" placeholder="科目" style="width: 150px" @change="onBookSubjectChange" clearable>
            <el-option v-for="sub in subjects" :key="sub.value" :label="sub.name" :value="sub.value" />
          </el-select>
          <el-select v-model="bookSecondCategoryId" placeholder="二级分类" style="width: 150px" @change="onBookSecondCategoryChange" clearable :disabled="!bookSubject">
            <el-option v-for="cat in bookFilterSecondCategories" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
          <el-button type="primary" @click="loadBooks">搜索</el-button>
          <el-button type="success" @click="showAddBook">新建书籍/试卷</el-button>
        </div>

        <el-table :data="filteredBooks" row-key="id" style="width: 100%" @row-click="handleBookRowClick">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="名称" show-overflow-tooltip min-width="150">
            <template #default="scope">
              <el-link type="primary" :underline="false" @click.stop="viewBookDetail(scope.row)">
                {{ scope.row.name }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column prop="short_name" label="简称" width="120" show-overflow-tooltip />
          <el-table-column label="科目" width="100">
            <template #default="scope">{{ formatSubject(scope.row.subject) }}</template>
          </el-table-column>
          <el-table-column prop="first_category_id" label="一级分类ID" width="100" />
          <el-table-column prop="second_category_id" label="二级分类ID" width="100" />
          <el-table-column prop="third_category_id" label="三级分类ID" width="100" />
          <el-table-column prop="sort" label="排序" width="80" />
          <el-table-column label="状态" width="80">
            <template #default="scope">
              <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'" size="small">
                {{ scope.row.status === 1 ? '上架' : '下架' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="code_prefix" label="编码前缀" width="100" />
          <el-table-column prop="next_question_code" label="下一题编码" width="100" />
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="scope">
              <el-button link type="primary" @click.stop="viewBookDetail(scope.row)">详情</el-button>
              <el-button link type="primary" @click.stop="editBook(scope.row)">编辑</el-button>
              <el-button link type="danger" @click.stop="handleDeleteBook(scope.row)">删除</el-button>
              <el-button link type="warning" @click.stop="toggleBookStatus(scope.row)">
                {{ scope.row.status === 1 ? '下架' : '上架' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-if="filteredBooks.length > 0"
          layout="total, prev, pager, next, jumper"
          :total="filteredBooks.length"
          :page-size="20"
          :current-page="1"
          class="mt-20"
        />
      </el-tab-pane>

      <!-- 题库导入 -->
      <el-tab-pane label="题库导入" name="import">
        <div class="import-section">
          <h3>公共题库导入</h3>
          <p class="desc">选择 3 个 JSON 文件 (书籍、题目、答案) 进行导入</p>
          
          <div class="form-row">
            <el-select v-model="importSubject" placeholder="选择科目">
              <el-option 
                v-for="cat in bookFirstCategories" 
                :key="cat.id" 
                :label="cat.name" 
                :value="cat.subject" 
              />
            </el-select>
            <el-button type="primary" @click="chooseImportFiles">选择文件</el-button>
          </div>
          
          <div v-if="importFiles.length > 0" class="file-list">
            <div v-for="(file, idx) in importFiles" :key="idx" class="file-item">
              {{ file.name }}
            </div>
          </div>
          
          <el-button 
            type="success" 
            :disabled="importFiles.length !== 3 || importing" 
            :loading="importing"
            @click="startImport"
          >
            开始导入
          </el-button>
          
          <div v-if="importResult" class="import-result" :class="importResult.success ? 'success' : 'error'">
            {{ importResult.msg }}
          </div>
        </div>
        
        <el-divider />
        
        <div class="import-section">
          <h3>批量导入</h3>
          <p class="desc">选择文件夹或多个文件，自动识别并批量导入</p>
          
          <div class="form-row">
            <el-select v-model="batchImportSubject" placeholder="选择科目">
              <el-option 
                v-for="cat in bookFirstCategories" 
                :key="cat.id" 
                :label="cat.name" 
                :value="cat.subject" 
              />
            </el-select>
            <el-button type="primary" @click="chooseBatchFolder">选择文件夹</el-button>
            <el-button type="primary" @click="chooseBatchFiles">选择多个文件</el-button>
          </div>
          
          <div v-if="batchGroups.length > 0" class="batch-list">
            <div class="batch-header">
              <el-checkbox v-model="batchSelectAll" @change="toggleBatchSelectAll">全选</el-checkbox>
              <span>已选 {{ batchSelectedCount }} 个</span>
            </div>
            <div v-for="(group, idx) in batchGroups" :key="idx" class="batch-item">
              <el-checkbox v-model="group.selected" :disabled="group.status === 'success'">
                {{ group.name }} ({{ group.files.length }} 个文件)
              </el-checkbox>
              <el-tag :type="getBatchStatusType(group.status)">{{ getBatchStatusText(group.status) }}</el-tag>
            </div>
          </div>
          
          <el-button 
            type="success" 
            :disabled="batchSelectedCount === 0 || batchImporting" 
            :loading="batchImporting"
            @click="startBatchImport"
          >
            批量导入 ({{ batchSelectedCount }})
          </el-button>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 题目编辑弹窗 -->
    <el-dialog v-model="showQuestionModal" :title="editingQuestion.id ? '编辑题目' : '添加题目'" width="900px" append-to-body>
      <el-form :model="editingQuestion" label-width="120px" class="question-form">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="题型">
              <el-select v-model="editingQuestion.type" placeholder="选择题型" style="width: 100%">
                <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="难度">
              <el-rate v-model="editingQuestion.difficulty" :colors="['#99A9BF', '#F7BA2A', '#FF9900']" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <!-- 题干部分 -->
        <el-form-item label="纯文本题干">
          <el-input v-model="editingQuestion.title" type="textarea" rows="2" placeholder="请输入题干" />
        </el-form-item>
        
        <el-form-item label="题干(富文本)">
          <div class="richtext-expand-section">
            <el-button type="primary" link @click="showTitleRichText = !showTitleRichText">
              {{ showTitleRichText ? '收起富文本编辑器' : (hasValidRichText(editingQuestion.title_richtext) ? '编辑富文本(已设置)' : '展开富文本编辑器') }}
            </el-button>
            <div v-if="showTitleRichText" class="richtext-editor-wrapper">
              <RichEditor v-model="editingQuestion.title_richtext" :height="200" placeholder="请输入富文本题干..." />
            </div>
            <div v-else-if="hasValidRichText(editingQuestion.title_richtext)" class="richtext-preview" v-html="editingQuestion.title_richtext"></div>
          </div>
        </el-form-item>
        
        <!-- 分类/书籍/章节信息编辑 -->
        <el-divider content-position="left">所属分类与位置</el-divider>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="科目">
              <el-select 
                v-model="editingQuestion.subject" 
                placeholder="选择科目" 
                style="width: 100%"
                disabled
              >
                <el-option 
                  v-for="cat in bookFirstCategories" 
                  :key="cat.id" 
                  :label="cat.name" 
                  :value="cat.subject" 
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="一级分类">
              <el-select 
                v-model="editingQuestion.firstCategoryId" 
                placeholder="选择一级分类" 
                style="width: 100%"
                @change="onQuestionFirstCategoryChange"
                clearable
              >
                <el-option 
                  v-for="cat in firstCategories" 
                  :key="cat.id" 
                  :label="cat.name" 
                  :value="cat.id" 
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="二级分类">
              <el-select 
                v-model="editingQuestion.secondCategoryId" 
                placeholder="选择二级分类" 
                style="width: 100%"
                @change="onQuestionSecondCategoryChange"
                :disabled="!editingQuestion.firstCategoryId"
                clearable
              >
                <el-option 
                  v-for="cat in questionSecondCategories" 
                  :key="cat.id" 
                  :label="cat.name" 
                  :value="cat.id" 
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="书籍/试卷">
              <el-select 
                v-model="editingQuestion.bookId" 
                placeholder="选择书籍/试卷" 
                style="width: 100%"
                @change="onQuestionBookChange"
                :disabled="!editingQuestion.secondCategoryId"
                clearable
              >
                <el-option 
                  v-for="book in questionBooks" 
                  :key="book.id" 
                  :label="book.name" 
                  :value="book.id" 
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="章节">
              <el-select 
                v-model="editingQuestion.chapterId" 
                placeholder="选择章节" 
                style="width: 100%"
                :disabled="!editingQuestion.bookId"
                clearable
              >
                <el-option 
                  v-for="chapter in questionChapters" 
                  :key="chapter.id" 
                  :label="chapter.name" 
                  :value="chapter.id" 
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="选项" v-if="[1, 2].includes(editingQuestion.type)">
          <div class="options-list">
            <div v-for="(opt, idx) in (editingQuestion.options || [])" :key="idx" class="option-item">
              <div class="option-row">
                <span class="option-label">{{ String.fromCharCode(65 + idx) }}</span>
                <el-input 
                  v-model="editingQuestion.options[idx]" 
                  type="textarea" 
                  :rows="2"
                  placeholder="选项内容" 
                  class="option-input"
                />
                <el-button link type="danger" @click="removeOption(idx)">删除</el-button>
              </div>
            </div>
          </div>
          <el-button type="primary" link @click="addOption" class="mt-10">+ 添加选项</el-button>
        </el-form-item>
        
        <!-- 答案部分 -->
        <el-form-item label="答案">
          <el-input v-model="editingQuestion.answer" placeholder="如: A 或 AB" />
        </el-form-item>
        
        <el-form-item label="答案(富文本)">
          <div class="richtext-expand-section">
            <el-button type="primary" link @click="showAnswerRichText = !showAnswerRichText">
              {{ showAnswerRichText ? '收起富文本编辑器' : (hasValidRichText(editingQuestion.answer_richtext) ? '编辑富文本(已设置)' : '展开富文本编辑器') }}
            </el-button>
            <div v-if="showAnswerRichText" class="richtext-editor-wrapper">
              <RichEditor v-model="editingQuestion.answer_richtext" :height="150" placeholder="请输入富文本答案..." />
            </div>
            <div v-else-if="hasValidRichText(editingQuestion.answer_richtext)" class="richtext-preview" v-html="editingQuestion.answer_richtext"></div>
          </div>
        </el-form-item>
        
        <!-- 解析部分 -->
        <el-form-item label="解析/知识点">
          <div class="richtext-expand-section">
            <el-button type="primary" link @click="showExplanationRichText = !showExplanationRichText">
              {{ showExplanationRichText ? '收起富文本编辑器' : (hasValidRichText(editingQuestion.explanation) ? '编辑富文本(已设置)' : '展开富文本编辑器') }}
            </el-button>
            <div v-if="showExplanationRichText" class="richtext-editor-wrapper">
              <RichEditor v-model="editingQuestion.explanation" :height="200" placeholder="请输入解析或知识点详情..." />
            </div>
            <div v-else-if="hasValidRichText(editingQuestion.explanation)" class="richtext-preview" v-html="editingQuestion.explanation"></div>
          </div>
        </el-form-item>
        
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="年份">
              <el-input v-model="editingQuestion.year" placeholder="如: 2023" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="分值">
              <el-input-number v-model="editingQuestion.score" :min="0" :max="100" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="排序">
              <el-input-number v-model="editingQuestion.sort" :min="0" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="原始题号">
              <el-input v-model="editingQuestion.original_book_number" placeholder="原始书籍中的题号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="题源">
              <el-input v-model="editingQuestion.question_source" placeholder="题目来源" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="口诀">
          <el-input v-model="editingQuestion.mnemonic" type="textarea" rows="2" placeholder="记忆口诀（针对知识卡）" />
        </el-form-item>
        
        <el-form-item label="多媒体链接">
          <el-input v-model="editingQuestion.media" placeholder="图片或视频链接" />
        </el-form-item>
        
        <el-form-item label="状态">
          <el-switch v-model="editingQuestion.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showQuestionModal = false">取消</el-button>
        <el-button type="primary" @click="saveQuestion">保存</el-button>
      </template>
    </el-dialog>

    <!-- 书目编辑弹窗 -->
    <el-dialog v-model="showBookModal" :title="editingBook.id ? '编辑书籍/试卷' : '添加书籍/试卷'" width="550px">
      <el-form :model="editingBook" label-width="120px">
        <el-form-item label="名称">
          <el-input v-model="editingBook.name" placeholder="请输入书籍/试卷名称" />
        </el-form-item>
        <el-form-item label="科目" required>
          <el-select 
            v-model="editingBook.subject" 
            placeholder="选择科目" 
            style="width: 100%"
            @change="onBookSubjectSelectChange"
          >
            <el-option 
              v-for="cat in bookFirstCategories" 
              :key="cat.id" 
              :label="cat.name" 
              :value="cat.subject" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="编码前缀" v-if="!editingBook.id">
          <el-input 
            v-model="editingBook.code_prefix" 
            placeholder="如: M001, P001, E001"
            maxlength="10"
            show-word-limit
          />
          <div class="field-hint">用于生成题目ID，建议格式：科目首字母+3位数字（如M001表示数学001）</div>
        </el-form-item>
        <el-form-item label="一级分类">
          <div style="display: flex; gap: 10px;">
            <el-select v-model="editingBook.first_category_id" placeholder="选择一级分类" @change="onEditBookFirstCategoryChange" clearable style="width: 320px;">
              <el-option
                v-for="cat in bookFirstCategories"
                :key="cat.id"
                :label="cat.name"
                :value="cat.id"
              />
            </el-select>
            <el-button type="primary" @click="openCreateFirstCategoryModal">新建</el-button>
          </div>
        </el-form-item>
        <el-form-item label="二级分类">
          <div style="display: flex; gap: 10px;">
            <el-select v-model="editingBook.second_category_id" placeholder="选择二级分类" @change="onEditBookSecondCategoryChange" clearable :disabled="!editingBook.first_category_id" style="width: 320px;">
              <el-option
                v-for="cat in bookSecondCategories"
                :key="cat.id"
                :label="cat.name"
                :value="cat.id"
              />
            </el-select>
            <el-button type="primary" :disabled="!editingBook.first_category_id" @click="openCreateSecondCategoryModal">新建</el-button>
          </div>
        </el-form-item>
        <el-form-item label="三级分类">
          <div style="display: flex; gap: 10px;">
            <el-select v-model="editingBook.third_category_id" placeholder="选择三级分类" clearable :disabled="!editingBook.second_category_id" style="width: 320px;">
              <el-option
                v-for="cat in bookThirdCategories"
                :key="cat.id"
                :label="cat.name"
                :value="cat.id"
              />
            </el-select>
            <el-button type="primary" :disabled="!editingBook.second_category_id" @click="openCreateThirdCategoryModal">新建</el-button>
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editingBook.sort" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="editingBook.status" :active-value="1" :inactive-value="0" active-text="上架" inactive-text="下架" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBookModal = false">取消</el-button>
        <el-button type="primary" @click="saveBook">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新建分类弹窗 -->
    <el-dialog v-model="showCreateCategoryModal" :title="newCategory.level === 1 ? '新建一级分类' : newCategory.level === 2 ? '新建二级分类' : '新建三级分类'" width="400px">
      <el-form :model="newCategory" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="newCategory.name" :placeholder="newCategory.level === 1 ? '请输入一级分类名称' : newCategory.level === 2 ? '请输入二级分类名称' : '请输入三级分类名称'" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="newCategory.sort" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateCategoryModal = false">取消</el-button>
        <el-button type="primary" @click="createCategory">保存</el-button>
      </template>
    </el-dialog>

    <!-- 章节编辑弹窗 -->
    <el-dialog v-model="showChapterModal" :title="editingChapter.id ? '编辑章节' : '添加章节'" width="500px">
      <el-form :model="editingChapter" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="editingChapter.name" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editingChapter.sort_order" />
        </el-form-item>
        <el-form-item label="层级">
          <el-input-number v-model="editingChapter.level" :min="1" :max="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showChapterModal = false">取消</el-button>
        <el-button type="primary" @click="saveChapter">保存</el-button>
      </template>
    </el-dialog>

    <!-- 书籍详情弹窗 -->
    <el-dialog 
      v-model="showBookDetail" 
      :title="`书籍详情: ${currentBook.name || ''}`" 
      width="90%"
      :fullscreen="false"
      :close-on-click-modal="false"
      @close="closeBookDetail"
    >
      <div v-loading="bookDetailLoading">
        <!-- 书籍基本信息 -->
        <el-descriptions :column="4" border class="mb-20">
          <el-descriptions-item label="ID">{{ currentBook.id }}</el-descriptions-item>
          <el-descriptions-item label="名称">{{ currentBook.name }}</el-descriptions-item>
          <el-descriptions-item label="简称">{{ currentBook.short_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="科目">{{ formatSubject(currentBook.subject) }}</el-descriptions-item>
          <el-descriptions-item label="编码前缀">{{ currentBook.code_prefix || '-' }}</el-descriptions-item>
          <el-descriptions-item label="下一题编码">{{ currentBook.next_question_code || 1 }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentBook.status === 1 ? 'success' : 'danger'">
              {{ currentBook.status === 1 ? '上架' : '下架' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="排序">{{ currentBook.sort || 0 }}</el-descriptions-item>
        </el-descriptions>

        <!-- 标签页 -->
        <el-tabs v-model="bookDetailActiveTab">
          <!-- 章节管理 -->
          <el-tab-pane label="章节管理" name="chapters">
            <div class="flex-between mb-15">
              <h3>章节列表 ({{ bookDetailChapters.length }})</h3>
              <el-button type="primary" @click="addChapterInDetail">
                <el-icon><Plus /></el-icon>添加章节
              </el-button>
            </div>
            <el-table :data="bookDetailChapters" row-key="id" style="width: 100%">
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column prop="name" label="章节名称" min-width="200" show-overflow-tooltip />
              <el-table-column prop="sort_order" label="排序" width="80" />
              <el-table-column prop="question_count" label="题目数量" width="100">
                <template #default="scope">
                  {{ bookDetailQuestions.filter(q => q.chapterId === scope.row.id).length }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="200" fixed="right">
                <template #default="scope">
                  <el-button link type="primary" @click="editChapterInDetail(scope.row)">编辑</el-button>
                  <el-button link type="danger" @click="deleteChapterInDetail(scope.row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <!-- 题目管理 -->
          <el-tab-pane label="题目管理" name="questions">
            <div class="flex-between mb-15">
              <h3>题目列表 ({{ bookDetailQuestions.length }})</h3>
              <div class="flex gap-10">
                <el-select v-model="bookDetailChapterId" placeholder="筛选章节" clearable style="width: 200px">
                  <el-option 
                    v-for="ch in bookDetailChapters" 
                    :key="ch.id" 
                    :label="ch.name" 
                    :value="ch.id" 
                  />
                </el-select>
                <el-button type="primary" @click="addQuestionInDetail">
                  <el-icon><Plus /></el-icon>添加题目
                </el-button>
              </div>
            </div>
            <el-table :data="filteredBookDetailQuestions" row-key="id" style="width: 100%">
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column prop="question_code" label="题号" width="100" />
              <el-table-column label="题型" width="100">
                <template #default="scope">{{ getQuestionTypeLabel(scope.row.type) }}</template>
              </el-table-column>
              <el-table-column prop="title" label="题干" min-width="200" show-overflow-tooltip />
              <el-table-column prop="chapterName" label="所属章节" width="150" show-overflow-tooltip />
              <el-table-column label="状态" width="80">
                <template #default="scope">
                  <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'" size="small">
                    {{ scope.row.status === 1 ? '启用' : '禁用' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="scope">
                  <el-button link type="primary" @click="editQuestionInDetail(scope.row)">编辑</el-button>
                  <el-button link type="danger" @click="deleteQuestionInDetail(scope.row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { publicApi, adminApi } from '../api';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import RichEditor from '../components/RichEditor.vue';

const activeTab = ref('feedback');
const loading = ref(false);

// Feedback State
const feedbacks = ref([]);
const statusIndex = ref(0);
const statusOptions = [{ label: '全部', value: 0 }, { label: '待处理', value: 1 }, { label: '已处理', value: 2 }];
const feedbackSubject = ref('');
const selectedFeedbackIds = ref([]);
const showFeedbackDialog = ref(false);
const selectedFeedback = ref(null);
const adminRemark = ref('');
const replyContent = ref('');

// Question State
const questions = ref([]);
const searchKeyword = ref('');
const subjectIndex = ref(0);
const subjectOptions = [{ label: '全部', value: 0 }]; // Will load dynamically
const selectedQuestionIds = ref([]);
const showQuestionModal = ref(false);
const editingQuestion = ref({});
const showTitleRichText = ref(false);
const showAnswerRichText = ref(false);
const showExplanationRichText = ref(false);
const typeOptions = [
  { label: '单选题', value: 1 },
  { label: '多选题', value: 2 },
  { label: '判断题', value: 3 },
  { label: '填空题', value: 4 },
  { label: '简答题', value: 5 }
];
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);

// Category Filter State
const firstCategories = ref([]);
const secondCategories = ref([]);
const firstCategoryId = ref(null);
const secondCategoryId = ref(null);

// Book & Chapter Filter State
const filterBooks = ref([]);
const filterChapters = ref([]);
const filterBookId = ref(null);
const filterChapterId = ref(null);

// Question Edit State (for book/chapter selection in question edit modal)
const questionSecondCategories = ref([]);
const questionBooks = ref([]);
const questionChapters = ref([]);

// Book Filter State (for book management tab)
const bookSubject = ref('');
const bookSecondCategoryId = ref(null);
const bookFilterSecondCategories = ref([]);

// Book Management State
const currentManageLevel = ref('subject'); // subject, book, chapter, question
const subjects = ref([]);
const currentChildSubjects = ref([]);
const books = ref([]);
const chapters = ref([]);
const chapterQuestions = ref([]);
const selectedSubject = ref('');
const selectedBook = ref({});
const selectedChapter = ref({});
const breadcrumbs = ref([{ label: '科目列表', level: 'subject', data: null }]);
const showBookModal = ref(false);
const editingBook = ref({});
const bookFirstCategories = ref([]);
const bookSecondCategories = ref([]);
const bookThirdCategories = ref([]);

// Chapter Management State
const showChapterModal = ref(false);
const editingChapter = ref({});

// Create Category State
const showCreateCategoryModal = ref(false);
const newCategory = ref({ name: '', sort: 0 });

// Book Detail State
const showBookDetail = ref(false);
const currentBook = ref({});
const bookDetailChapters = ref([]);
const bookDetailQuestions = ref([]);
const bookDetailActiveTab = ref('chapters');
const bookDetailChapterId = ref(null);
const bookDetailLoading = ref(false);

// --- Methods ---

const formatDate = (str) => {
  return str ? new Date(str).toLocaleString() : '-';
};

// Feedback Methods
const fetchFeedbacks = async () => {
  loading.value = true;
  try {
    const params = { status: statusIndex.value };
    if (feedbackSubject.value) {
      params.subject = feedbackSubject.value;
    }
    const res = await publicApi.getFeedbacks(params);
    feedbacks.value = res.data?.list || res.data || [];
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const handleFeedbackSelectionChange = (val) => {
  selectedFeedbackIds.value = val.map(v => v.id);
};

const handleQuestionSelectionChange = (val) => {
  selectedQuestionIds.value = val.map(v => v.id);
};

const selectFeedback = (row) => {
  selectedFeedback.value = row;
  adminRemark.value = '';
  replyContent.value = '';
  showFeedbackDialog.value = true;
};

const startInlineEdit = async (feedback) => {
  if (feedback.questionDetail) {
    editingQuestion.value = { ...feedback.questionDetail };
    // 如果有有效富文本内容，默认展开编辑器
    showTitleRichText.value = hasValidRichText(editingQuestion.value.title_richtext);
    showAnswerRichText.value = hasValidRichText(editingQuestion.value.answer_richtext);
    showExplanationRichText.value = hasValidRichText(editingQuestion.value.explanation);
    
    // 加载分类、书籍、章节数据
    await loadQuestionEditData();
    
    showQuestionModal.value = true;
    showFeedbackDialog.value = false;
  } else {
    ElMessage.warning('没有关联的题目可编辑');
  }
};

const editFeedbackQuestion = async (row) => {
  if (!row.questionId) {
    ElMessage.warning('没有关联的题目可编辑');
    return;
  }
  try {
    loading.value = true;
    const res = await publicApi.getQuestionDetail(row.questionId);
    if (res.code === 0 && res.data) {
      editingQuestion.value = res.data;
      if (typeof editingQuestion.value.options === 'string') {
        try {
          editingQuestion.value.options = JSON.parse(editingQuestion.value.options);
        } catch (e) {
          editingQuestion.value.options = [];
        }
      }
      // 如果有有效富文本内容，默认展开编辑器
      showTitleRichText.value = hasValidRichText(editingQuestion.value.title_richtext);
      showAnswerRichText.value = hasValidRichText(editingQuestion.value.answer_richtext);
      showExplanationRichText.value = hasValidRichText(editingQuestion.value.explanation);
      
      // 加载分类、书籍、章节数据
      await loadQuestionEditData();
      
      showQuestionModal.value = true;
    } else {
      ElMessage.warning('获取题目详情失败');
    }
  } catch (e) {
    console.error('获取题目详情失败:', e);
    ElMessage.error('获取题目详情失败');
  } finally {
    loading.value = false;
  }
};

const handleUpdateFeedbackStatus = async (id, status) => {
  try {
    await publicApi.replyFeedback(id, {
      status,
      remark: adminRemark.value,
      reply: replyContent.value
    });
    ElMessage.success('处理成功');
    showFeedbackDialog.value = false;
    fetchFeedbacks();
  } catch (e) {
    ElMessage.error('操作失败');
  }
};

const batchUpdateFeedbackStatus = async (status) => {
  try {
    await publicApi.batchUpdateFeedbackStatus(selectedFeedbackIds.value, status);
    ElMessage.success('批量处理成功');
    fetchFeedbacks();
  } catch (e) {
    ElMessage.error('操作失败');
  }
};

// Question Methods
const onSubjectChange = () => {
  fetchCategories();
  // 重置所有筛选条件
  firstCategoryId.value = null;
  secondCategoryId.value = null;
  filterBookId.value = null;
  filterChapterId.value = null;
  currentPage.value = 1;
  fetchQuestions();
};

const fetchCategories = async () => {
  const subject = subjectIndex.value ? subjectOptions[subjectIndex.value].value : null;
  if (!subject) {
    firstCategories.value = [];
    secondCategories.value = [];
    return;
  }
  try {
    const res = await publicApi.getPublicCategories({ subject });
    const categories = res.data || [];
    firstCategories.value = categories.filter(c => c.level === 1);
    secondCategories.value = [];
    
    // 自动选择第一个一级分类（科目即一级分类）
    if (firstCategories.value.length > 0) {
      firstCategoryId.value = firstCategories.value[0].id;
      onFirstCategoryChange();
    }
  } catch (e) {
    console.error('获取分类失败:', e);
  }
};

// 加载一级分类（用于题目编辑弹窗）
const loadFirstCategories = async () => {
  try {
    const res = await publicApi.getPublicCategories({ level: 1 });
    firstCategories.value = res.data || [];
  } catch (e) {
    console.error('加载一级分类失败:', e);
  }
};

const onFirstCategoryChange = async () => {
  secondCategoryId.value = null;
  secondCategories.value = [];
  filterBookId.value = null;
  filterBooks.value = [];
  filterChapterId.value = null;
  filterChapters.value = [];
  currentPage.value = 1;
  if (!firstCategoryId.value) {
    fetchQuestions();
    return;
  }
  
  try {
    const res = await publicApi.getPublicCategories({ parentId: firstCategoryId.value });
    secondCategories.value = res.data || [];
    
    // 加载该一级分类下的书籍
    const subject = subjectIndex.value ? subjectOptions[subjectIndex.value].value : null;
    const booksRes = await publicApi.getPublicBooks({ subject, firstCategoryId: firstCategoryId.value });
    filterBooks.value = booksRes.data || [];
    fetchQuestions();
  } catch (e) {
    console.error('获取二级分类失败:', e);
  }
};

const onSecondCategoryChange = async () => {
  filterBookId.value = null;
  filterBooks.value = [];
  filterChapterId.value = null;
  filterChapters.value = [];
  currentPage.value = 1;
  if (!secondCategoryId.value) {
    fetchQuestions();
    return;
  }
  
  try {
    // 加载该二级分类下的书籍
    const subject = subjectIndex.value ? subjectOptions[subjectIndex.value].value : null;
    const booksRes = await publicApi.getPublicBooks({ subject, secondCategoryId: secondCategoryId.value });
    filterBooks.value = booksRes.data || [];
    fetchQuestions();
  } catch (e) {
    console.error('获取书籍失败:', e);
  }
};

const onBookChange = async () => {
  filterChapterId.value = null;
  filterChapters.value = [];
  currentPage.value = 1;
  if (!filterBookId.value) {
    fetchQuestions();
    return;
  }
  
  try {
    const res = await publicApi.getChapters({ bookId: filterBookId.value });
    filterChapters.value = res.data || [];
    fetchQuestions();
  } catch (e) {
    console.error('获取章节失败:', e);
  }
};

const onChapterChange = () => {
  currentPage.value = 1;
  fetchQuestions();
};

const onPageChange = (page) => {
  currentPage.value = page;
  fetchQuestions();
};

const fetchQuestions = async () => {
  loading.value = true;
  try {
    const res = await publicApi.getQuestions({
      keyword: searchKeyword.value,
      subject: subjectIndex.value ? subjectOptions[subjectIndex.value].value : null,
      firstCategoryId: firstCategoryId.value,
      secondCategoryId: secondCategoryId.value,
      bookId: filterBookId.value,
      chapterId: filterChapterId.value,
      page: currentPage.value,
      pageSize: pageSize.value
    });
    questions.value = res.data?.list || res.data || [];
    total.value = res.data?.total || 0;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const showAddQuestion = () => {
  editingQuestion.value = { type: 1, options: ['', '', '', ''], isKnowledgeCard: 0 };
  // 新建题目时默认折叠富文本编辑器
  showTitleRichText.value = false;
  showAnswerRichText.value = false;
  showExplanationRichText.value = false;
  showQuestionModal.value = true;
};

const toggleQuestionDetail = async (row) => {
  // Deep copy to avoid modifying row directly
  editingQuestion.value = JSON.parse(JSON.stringify(row));
  if (typeof editingQuestion.value.options === 'string') {
      try {
          editingQuestion.value.options = JSON.parse(editingQuestion.value.options);
      } catch(e) {
          editingQuestion.value.options = [];
      }
  }
  // 如果有有效富文本内容，默认展开编辑器
  showTitleRichText.value = hasValidRichText(editingQuestion.value.title_richtext);
  showAnswerRichText.value = hasValidRichText(editingQuestion.value.answer_richtext);
  showExplanationRichText.value = hasValidRichText(editingQuestion.value.explanation);
  
  // 加载分类、书籍、章节数据
  await loadQuestionEditData();
  
  showQuestionModal.value = true;
};

// 加载题目编辑所需的关联数据
const loadQuestionEditData = async () => {
  // 确保一级分类已加载
  if (firstCategories.value.length === 0) {
    await loadFirstCategories();
  }
  
  // 如果有二级分类ID，加载二级分类列表
  if (editingQuestion.value.firstCategoryId) {
    try {
      const res = await publicApi.getPublicCategories({ parentId: editingQuestion.value.firstCategoryId });
      questionSecondCategories.value = res.data || [];
    } catch (e) {
      console.error('加载二级分类失败:', e);
    }
  }
  
  // 如果有二级分类ID，加载书籍列表
  if (editingQuestion.value.secondCategoryId) {
    try {
      const booksRes = await publicApi.getPublicBooks({ 
        secondCategoryId: editingQuestion.value.secondCategoryId 
      });
      questionBooks.value = booksRes.data || [];
    } catch (e) {
      console.error('加载书籍失败:', e);
    }
  }
  
  // 如果有书籍ID，加载章节列表
  if (editingQuestion.value.bookId) {
    try {
      const chaptersRes = await publicApi.getChapters({ bookId: editingQuestion.value.bookId });
      questionChapters.value = chaptersRes.data || [];
    } catch (e) {
      console.error('加载章节失败:', e);
    }
  }
};

// 题目编辑中的一级分类变化
const onQuestionFirstCategoryChange = async () => {
  editingQuestion.value.secondCategoryId = null;
  editingQuestion.value.bookId = null;
  editingQuestion.value.chapterId = null;
  questionSecondCategories.value = [];
  questionBooks.value = [];
  questionChapters.value = [];
  
  if (!editingQuestion.value.firstCategoryId) return;
  
  try {
    const res = await publicApi.getPublicCategories({ parentId: editingQuestion.value.firstCategoryId });
    questionSecondCategories.value = res.data || [];
  } catch (e) {
    console.error('获取二级分类失败:', e);
  }
};

// 题目编辑中的二级分类变化
const onQuestionSecondCategoryChange = async () => {
  editingQuestion.value.bookId = null;
  editingQuestion.value.chapterId = null;
  questionBooks.value = [];
  questionChapters.value = [];
  
  if (!editingQuestion.value.secondCategoryId) return;
  
  try {
    const booksRes = await publicApi.getPublicBooks({ 
      secondCategoryId: editingQuestion.value.secondCategoryId 
    });
    questionBooks.value = booksRes.data || [];
  } catch (e) {
    console.error('获取书籍失败:', e);
  }
};

// 题目编辑中的书籍变化
const onQuestionBookChange = async () => {
  editingQuestion.value.chapterId = null;
  questionChapters.value = [];
  
  if (!editingQuestion.value.bookId) return;
  
  try {
    const chaptersRes = await publicApi.getChapters({ bookId: editingQuestion.value.bookId });
    questionChapters.value = chaptersRes.data || [];
  } catch (e) {
    console.error('获取章节失败:', e);
  }
};

const saveQuestion = async () => {
  try {
    const data = { ...editingQuestion.value };
    // 确保选项是 JSON 字符串
    if (Array.isArray(data.options)) {
      data.options = JSON.stringify(data.options);
    }
    
    // 标记为手动创建（非导入）
    if (!data.id) {
      data.isManualCreate = true;
    }
    
    console.log('保存题目数据:', data);
    
    if (data.id) {
      await publicApi.updateQuestion(data.id, data);
    } else {
      await publicApi.createQuestion(data);
    }
    ElMessage.success('保存成功');
    showQuestionModal.value = false;
    
    // 刷新题目列表
    fetchQuestions();
    if (currentManageLevel.value === 'question') loadChapterQuestions();
    
    // 如果在书籍详情弹窗中，刷新书籍详情数据
    if (showBookDetail.value) {
      await loadBookDetailData();
    }
  } catch (e) {
    console.error('保存失败:', e);
    ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message));
  }
};

const addOption = () => {
    if (!editingQuestion.value.options) editingQuestion.value.options = [];
    editingQuestion.value.options.push('');
};

const removeOption = (idx) => {
    editingQuestion.value.options.splice(idx, 1);
};

const batchDeleteQuestions = async () => {
  try {
    await publicApi.batchDeleteQuestions(selectedQuestionIds.value);
    ElMessage.success('批量删除成功');
    selectedQuestionIds.value = [];
    fetchQuestions();
    if (currentManageLevel.value === 'question') loadChapterQuestions();
  } catch (e) {
    ElMessage.error('批量删除失败');
  }
};

const formatQuestionType = (type) => {
    const map = {1: '单选', 2: '多选', 3: '判断', 4: '填空', 5: '简答', 6: '分析题'};
    return map[type] || '未知';
};

// 格式化科目显示
const formatSubject = (subject) => {
    const map = { politics: '政治', english: '英语', math: '数学' };
    return map[subject] || subject || '未知';
};

// 检查富文本内容是否有效（不是空的 <p><br></p>）
const hasValidRichText = (content) => {
    if (!content) return false;
    // 去除 HTML 标签和空白字符
    const text = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    return text.length > 0;
};

// 筛选后的书籍列表
const filteredBooks = computed(() => {
    return books.value;
});

// 书籍详情中的筛选后题目列表
const filteredBookDetailQuestions = computed(() => {
    if (!bookDetailChapterId.value) {
        return bookDetailQuestions.value;
    }
    // 使用 == 进行宽松比较，避免字符串和数字类型不匹配
    return bookDetailQuestions.value.filter(q => q.chapterId == bookDetailChapterId.value);
});

// 获取题型标签
const getQuestionTypeLabel = (type) => {
    const typeMap = {
        1: '单选题',
        2: '多选题',
        3: '判断题',
        4: '填空题',
        5: '简答题',
        6: '分析题'
    };
    return typeMap[type] || `题型${type}`;
};

// 书籍筛选 - 科目变化
const onBookSubjectChange = async () => {
    bookSecondCategoryId.value = null;
    bookFilterSecondCategories.value = [];
    
    // 立即筛选
    await loadBooks();
    
    if (!bookSubject.value) return;
    
    // 加载该科目下的二级分类
    try {
        const res = await publicApi.getPublicCategories({ subject: bookSubject.value, level: 2 });
        bookFilterSecondCategories.value = res.data || [];
    } catch (e) {
        console.error('获取二级分类失败:', e);
    }
};

// 书籍筛选 - 二级分类变化
const onBookSecondCategoryChange = async () => {
    // 立即筛选
    await loadBooks();
};

// 加载书籍列表
const loadBooks = async () => {
    try {
        const params = {};
        if (bookSubject.value) {
            params.subject = bookSubject.value;
        }
        if (bookSecondCategoryId.value) {
            params.secondCategoryId = bookSecondCategoryId.value;
        }
        const res = await publicApi.getPublicBooks(params);
        books.value = res.data || [];
    } catch (e) {
        console.error('加载书籍失败:', e);
    }
};

// Book/Subject Methods
const loadSubjects = async () => {
    const res = await adminApi.getNavSubjects();
    if (res.code === 0) {
        subjects.value = res.data.map(s => ({
            id: s.id || s.subject_code,
            name: s.name,
            value: s.subject_code || s.id,
            label: s.name
        }));
        // Update filter options
        subjectOptions.splice(1);
        subjects.value.forEach(s => subjectOptions.push({ label: s.name, value: s.value }));
    }
};

const selectSubject = async (val) => {
    // For simplicity, assuming 2-level subject structure
    // Fetch books for this subject
    selectedSubject.value = val;
    currentManageLevel.value = 'book';
    const sub = subjects.value.find(s => s.value === val);
    currentSubjectLabel.value = sub ? sub.name : val;
    breadcrumbs.value = [
        { label: '科目列表', level: 'subject', data: null },
        { label: sub ? sub.name : val, level: 'book', data: null }
    ];
    
    // 重置筛选条件
    bookSubject.value = '';
    bookSecondCategoryId.value = null;
    bookFilterSecondCategories.value = [];
    
    await loadBooks();
};

const buildChapterTree = (flatChapters) => {
    const map = {};
    const roots = [];
    
    // 首先将所有章节放入 map
    flatChapters.forEach(chapter => {
        map[chapter.id] = { ...chapter, children: [] };
    });
    
    // 然后构建树形结构
    flatChapters.forEach(chapter => {
        if (chapter.parent_id && map[chapter.parent_id]) {
            map[chapter.parent_id].children.push(map[chapter.id]);
        } else {
            roots.push(map[chapter.id]);
        }
    });
    
    return roots;
};

const selectBook = async (book) => {
    selectedBook.value = book;
    currentManageLevel.value = 'chapter';
    breadcrumbs.value.push({ label: book.name, level: 'chapter', data: book });
    // Fetch chapters
    try {
        const res = await publicApi.getChapters({ bookId: book.id });
        const flatChapters = res.data || [];
        chapters.value = buildChapterTree(flatChapters);
    } catch (e) {
        console.error('获取章节失败:', e);
        chapters.value = [];
    }
};

const showAddBook = async () => {
    // 先加载一级分类列表
    if (bookFirstCategories.value.length === 0) {
        await loadBookCategories(false);
    }
    
    console.log('bookFirstCategories:', bookFirstCategories.value);
    console.log('bookSubject:', bookSubject.value);
    console.log('bookSecondCategoryId:', bookSecondCategoryId.value);
    
    // 自动填充当前筛选的值
    const initialData = { 
        name: '', 
        subject: bookSubject.value || '', 
        sort: 0, 
        status: 1,
        first_category_id: null,
        second_category_id: bookSecondCategoryId.value || null
    };
    
    // 如果筛选了科目，找到对应的一级分类ID
    if (bookSubject.value && bookFirstCategories.value.length > 0) {
        const firstCat = bookFirstCategories.value.find(cat => cat.subject === bookSubject.value);
        console.log('找到的一级分类:', firstCat);
        if (firstCat) {
            initialData.first_category_id = firstCat.id;
        }
    }
    
    console.log('initialData:', initialData);
    
    editingBook.value = initialData;
    
    // 如果已选择科目，加载该科目下的所有二级分类（与筛选栏使用相同的查询方式）
    if (bookSubject.value) {
        try {
            const secondRes = await publicApi.getPublicCategories({ subject: bookSubject.value, level: 2 });
            bookSecondCategories.value = secondRes.data || [];
            console.log('二级分类:', bookSecondCategories.value);
            console.log('当前选中的二级分类ID:', initialData.second_category_id);
            console.log('是否找到:', bookSecondCategories.value.find(c => c.id == initialData.second_category_id));
        } catch (e) {
            console.error('获取二级分类失败:', e);
        }
    }
    
    showBookModal.value = true;
};

const editBook = async (book) => {
    editingBook.value = { ...book };
    await loadBookCategories();
    showBookModal.value = true;
};

const loadBookCategories = async (preserveSelection = false) => {
    // 加载所有一级分类（科目）
    try {
        const res = await publicApi.getPublicCategories({ level: 1 });
        bookFirstCategories.value = res.data || [];
        
        // 如果已选择一级分类，加载对应的二级分类
        if (editingBook.value.first_category_id) {
            const secondRes = await publicApi.getPublicCategories({ parentId: editingBook.value.first_category_id });
            bookSecondCategories.value = secondRes.data || [];
        } else if (!preserveSelection) {
            bookSecondCategories.value = [];
        }
        
        // 如果已选择二级分类，加载对应的三级分类
        if (editingBook.value.second_category_id) {
            const thirdRes = await publicApi.getPublicCategories({ parentId: editingBook.value.second_category_id });
            bookThirdCategories.value = thirdRes.data || [];
        } else if (!preserveSelection) {
            bookThirdCategories.value = [];
        }
    } catch (e) {
        console.error('获取分类失败:', e);
    }
};

const onEditBookFirstCategoryChange = async () => {
    editingBook.value.second_category_id = null;
    editingBook.value.third_category_id = null;
    bookSecondCategories.value = [];
    bookThirdCategories.value = [];
    if (!editingBook.value.first_category_id) return;
    
    try {
        const res = await publicApi.getPublicCategories({ parentId: editingBook.value.first_category_id });
        bookSecondCategories.value = res.data || [];
    } catch (e) {
        console.error('获取二级分类失败:', e);
    }
};

const onEditBookSecondCategoryChange = async () => {
    editingBook.value.third_category_id = null;
    bookThirdCategories.value = [];
    if (!editingBook.value.second_category_id) return;
    
    try {
        const res = await publicApi.getPublicCategories({ parentId: editingBook.value.second_category_id });
        bookThirdCategories.value = res.data || [];
    } catch (e) {
        console.error('获取三级分类失败:', e);
    }
};

// 书籍编辑弹窗中选择科目变化
const onBookSubjectSelectChange = async (subject) => {
    if (!subject) {
        editingBook.value.first_category_id = null;
        editingBook.value.second_category_id = null;
        editingBook.value.third_category_id = null;
        bookSecondCategories.value = [];
        bookThirdCategories.value = [];
        return;
    }
    
    // 根据科目找到对应的一级分类
    const firstCat = bookFirstCategories.value.find(cat => cat.subject === subject);
    if (firstCat) {
        editingBook.value.first_category_id = firstCat.id;
        
        // 加载该一级分类下的二级分类
        try {
            const res = await publicApi.getPublicCategories({ parentId: firstCat.id });
            bookSecondCategories.value = res.data || [];
        } catch (e) {
            console.error('获取二级分类失败:', e);
            bookSecondCategories.value = [];
        }
    }
};

const saveBook = async () => {
    try {
        // 验证必填字段
        if (!editingBook.value.name) {
            ElMessage.warning('请输入书籍/试卷名称');
            return;
        }
        if (!editingBook.value.subject) {
            ElMessage.warning('请选择科目');
            return;
        }
        
        if (editingBook.value.id) {
            await publicApi.updateBook(editingBook.value.id, editingBook.value);
        } else {
            await publicApi.createBook(editingBook.value);
        }
        ElMessage.success('保存成功');
        showBookModal.value = false;
        // Refresh books
        await loadBooks();
    } catch (e) {
        console.error('保存失败:', e);
        ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message));
    }
};

const handleDeleteBook = async (book) => {
    try {
        await ElMessageBox.confirm(
            `确定要删除书籍/试卷 "${book.name}" 吗？\n\n警告：这将同时删除该书籍下的所有章节和题目，此操作不可恢复！`,
            '确认删除',
            {
                confirmButtonText: '确定删除',
                cancelButtonText: '取消',
                type: 'warning',
                confirmButtonClass: 'el-button--danger'
            }
        );
        
        await publicApi.deleteBook(book.id);
        ElMessage.success('删除成功');
        // Refresh books
        const subject = selectedSubject.value;
        const res = await publicApi.getPublicBooks({ subject });
        books.value = res.data || [];
    } catch (e) {
        if (e !== 'cancel') {
            console.error('删除失败:', e);
            ElMessage.error('删除失败');
        }
    }
};

// 查看书籍详情
const viewBookDetail = async (book) => {
    currentBook.value = book;
    showBookDetail.value = true;
    bookDetailActiveTab.value = 'chapters';
    await loadBookDetailData();
};

// 处理书籍行点击
const handleBookRowClick = (row) => {
    viewBookDetail(row);
};

// 加载书籍详情数据
const loadBookDetailData = async () => {
    if (!currentBook.value.id) return;
    
    bookDetailLoading.value = true;
    try {
        // 加载章节列表
        const chaptersRes = await publicApi.getChapters({ bookId: currentBook.value.id });
        bookDetailChapters.value = chaptersRes.data || [];
        
        // 加载该书籍下的所有题目
        const questionsRes = await publicApi.getQuestions({ 
            bookId: currentBook.value.id,
            pageSize: 1000 
        });
        bookDetailQuestions.value = questionsRes.data?.list || questionsRes.data || [];
    } catch (e) {
        console.error('加载书籍详情失败:', e);
        ElMessage.error('加载书籍详情失败');
    } finally {
        bookDetailLoading.value = false;
    }
};

// 关闭书籍详情
const closeBookDetail = () => {
    showBookDetail.value = false;
    currentBook.value = {};
    bookDetailChapters.value = [];
    bookDetailQuestions.value = [];
    bookDetailChapterId.value = null;
};

// 在书籍详情中添加章节
const addChapterInDetail = () => {
    editingChapter.value = { 
        name: '', 
        sort_order: 0, 
        book_id: currentBook.value.id,
        bookId: currentBook.value.id
    };
    showChapterModal.value = true;
};

// 在书籍详情中编辑章节
const editChapterInDetail = (chapter) => {
    editingChapter.value = { 
        id: chapter.id,
        name: chapter.name,
        sort_order: chapter.sort_order || 0,
        book_id: chapter.book_id || currentBook.value.id,
        bookId: chapter.book_id || currentBook.value.id,
        parent_id: chapter.parent_id,
        level: chapter.level
    };
    showChapterModal.value = true;
};

// 在书籍详情中删除章节
const deleteChapterInDetail = async (chapter) => {
    try {
        await ElMessageBox.confirm(
            `确定要删除章节 "${chapter.name}" 吗？\n\n警告：这将同时删除该章节下的所有题目！`,
            '确认删除',
            { type: 'warning' }
        );
        await publicApi.deleteChapter(chapter.id);
        ElMessage.success('删除成功');
        await loadBookDetailData();
    } catch (e) {
        if (e !== 'cancel') {
            console.error('删除章节失败:', e);
            ElMessage.error('删除失败');
        }
    }
};

// 在书籍详情中添加题目
const addQuestionInDetail = async () => {
    console.log('currentBook:', currentBook.value);
    console.log('bookFirstCategories:', bookFirstCategories.value);
    
    // 先加载一级分类列表（如果还没有加载）
    if (firstCategories.value.length === 0) {
        try {
            const res = await publicApi.getPublicCategories({ level: 1 });
            firstCategories.value = res.data || [];
        } catch (e) {
            console.error('加载一级分类失败:', e);
        }
    }
    
    // 先加载当前书籍的章节列表
    try {
        const chaptersRes = await publicApi.getChapters({ bookId: currentBook.value.id });
        questionChapters.value = chaptersRes.data || [];
    } catch (e) {
        console.error('加载章节失败:', e);
        questionChapters.value = [];
    }
    
    // 设置当前书籍为 questionBooks，确保 id 是数字类型
    const bookData = {
        ...currentBook.value,
        id: Number(currentBook.value.id)
    };
    questionBooks.value = [bookData];
    console.log('questionBooks:', questionBooks.value);
    
    // 根据当前书籍的 subject 找到对应的一级分类
    let firstCategoryId = null;
    let secondCategoryId = currentBook.value.second_category_id;
    
    // 从 firstCategories 中找到匹配的科目
    if (currentBook.value.subject && firstCategories.value.length > 0) {
        const firstCat = firstCategories.value.find(cat => cat.subject === currentBook.value.subject);
        if (firstCat) {
            firstCategoryId = firstCat.id;
            console.log('找到一级分类:', firstCat);
        } else {
            console.log('未找到匹配的一级分类，subject:', currentBook.value.subject);
            console.log('可用的一级分类:', firstCategories.value);
        }
    }
    
    // 加载二级分类列表
    if (firstCategoryId) {
        try {
            const res = await publicApi.getPublicCategories({ parentId: firstCategoryId });
            questionSecondCategories.value = res.data || [];
        } catch (e) {
            console.error('加载二级分类失败:', e);
        }
    }
    
    // 确保 bookId 是数字类型
    const bookIdNum = Number(currentBook.value.id);
    
    editingQuestion.value = {
        subject: currentBook.value.subject,
        firstCategoryId: firstCategoryId,
        secondCategoryId: secondCategoryId,
        bookId: bookIdNum,
        bookName: currentBook.value.name,
        chapterId: bookDetailChapterId.value,
        type: 1,
        status: 1
    };
    
    console.log('editingQuestion:', editingQuestion.value);
    
    showQuestionModal.value = true;
};

// 在书籍详情中编辑题目
const editQuestionInDetail = async (question) => {
    editingQuestion.value = { ...question };
    
    // 加载当前书籍的章节列表
    try {
        const chaptersRes = await publicApi.getChapters({ bookId: question.bookId });
        questionChapters.value = chaptersRes.data || [];
    } catch (e) {
        console.error('加载章节失败:', e);
        questionChapters.value = [];
    }
    
    // 设置当前书籍为 questionBooks
    questionBooks.value = [currentBook.value];
    
    showQuestionModal.value = true;
};

// 在书籍详情中删除题目
const deleteQuestionInDetail = async (question) => {
    try {
        await ElMessageBox.confirm(
            `确定要删除这道题目吗？`,
            '确认删除',
            { type: 'warning' }
        );
        await publicApi.deleteQuestion(question.id);
        ElMessage.success('删除成功');
        await loadBookDetailData();
    } catch (e) {
        if (e !== 'cancel') {
            console.error('删除题目失败:', e);
            ElMessage.error('删除失败');
        }
    }
};

const currentSubjectLabel = ref('');

const loadChapterQuestions = async () => {
  if (!selectedChapter.value || !selectedChapter.value.id) return;
  loadingChapterQuestions.value = true;
  try {
    const res = await publicApi.getQuestions({ 
      chapterId: selectedChapter.value.id,
      pageSize: 1000 
    });
    chapterQuestions.value = res.data?.list || res.data || [];
  } catch (e) {
    console.error(e);
    chapterQuestions.value = [];
  } finally {
    loadingChapterQuestions.value = false;
  }
};

const navigateToLevel = (level, data) => {
    currentManageLevel.value = level;
    // Logic to trim breadcrumbs
    const idx = breadcrumbs.value.findIndex(b => b.level === level);
    if (idx !== -1) breadcrumbs.value = breadcrumbs.value.slice(0, idx + 1);
};

const selectChapter = (chapter) => {
    selectedChapter.value = chapter;
    currentManageLevel.value = 'question';
    breadcrumbs.value.push({ label: chapter.name, level: 'question', data: chapter });
    loadChapterQuestions();
};

const showAddChapter = () => {
    editingChapter.value = { name: '', sort_order: 0, book_id: selectedBook.value?.id };
    showChapterModal.value = true;
};

const editChapter = (chapter) => {
    editingChapter.value = { 
        id: chapter.id,
        name: chapter.name,
        sort_order: chapter.sort_order,
        book_id: chapter.book_id,
        parent_id: chapter.parent_id,
        level: chapter.level
    };
    showChapterModal.value = true;
};

// 打开新建一级分类弹窗
const openCreateFirstCategoryModal = () => {
    newCategory.value = { name: '', sort: 0, level: 1 };
    showCreateCategoryModal.value = true;
};

// 打开新建二级分类弹窗
const openCreateSecondCategoryModal = () => {
    newCategory.value = { name: '', sort: 0, level: 2 };
    showCreateCategoryModal.value = true;
};

const openCreateThirdCategoryModal = () => {
    newCategory.value = { name: '', sort: 0, level: 3 };
    showCreateCategoryModal.value = true;
};

// 创建分类（一级、二级或三级）
const createCategory = async () => {
    if (!newCategory.value.name.trim()) {
        ElMessage.warning('请输入分类名称');
        return;
    }
    
    try {
        const level = newCategory.value.level;
        let parentId = null;
        
        if (level === 2) {
            parentId = editingBook.value.first_category_id;
        } else if (level === 3) {
            parentId = editingBook.value.second_category_id;
        }
        
        const data = {
            name: newCategory.value.name,
            parent_id: parentId,
            level: level,
            sort: newCategory.value.sort || 0,
            subject: level === 1 ? '' : (editingBook.value.subject || '')
        };
        
        const res = await publicApi.createPublicCategory(data);
        ElMessage.success('创建成功');
        showCreateCategoryModal.value = false;
        
        if (level === 1) {
            // 刷新一级分类列表
            const firstRes = await publicApi.getPublicCategories({ level: 1 });
            bookFirstCategories.value = firstRes.data || [];
            
            // 自动选中新创建的一级分类
            if (res.data && res.data.id) {
                editingBook.value.first_category_id = res.data.id;
                // 触发一级分类变化，加载二级分类（此时为空）
                bookSecondCategories.value = [];
                bookThirdCategories.value = [];
                editingBook.value.second_category_id = null;
                editingBook.value.third_category_id = null;
            }
        } else if (level === 2) {
            // 刷新二级分类列表
            const secondRes = await publicApi.getPublicCategories({ parentId: editingBook.value.first_category_id });
            bookSecondCategories.value = secondRes.data || [];
            
            // 自动选中新创建的二级分类
            if (res.data && res.data.id) {
                editingBook.value.second_category_id = res.data.id;
                // 清空三级分类
                bookThirdCategories.value = [];
                editingBook.value.third_category_id = null;
            }
        } else if (level === 3) {
            // 刷新三级分类列表
            const thirdRes = await publicApi.getPublicCategories({ parentId: editingBook.value.second_category_id });
            bookThirdCategories.value = thirdRes.data || [];
            
            // 自动选中新创建的三级分类
            if (res.data && res.data.id) {
                editingBook.value.third_category_id = res.data.id;
            }
        }
    } catch (e) {
        console.error('创建分类失败:', e);
        ElMessage.error('创建失败');
    }
};

const saveChapter = async () => {
    try {
        // 优先使用 editingChapter 中的 book_id，如果没有则使用 selectedBook 或 currentBook
        const bookId = editingChapter.value.book_id || editingChapter.value.bookId || selectedBook.value?.id || currentBook.value?.id;
        
        if (!bookId) {
            ElMessage.error('无法确定所属书籍');
            return;
        }
        
        const data = {
            name: editingChapter.value.name,
            sort_order: editingChapter.value.sort_order || 0,
            book_id: bookId,
            parent_id: editingChapter.value.parent_id || null,
            level: editingChapter.value.level || 1
        };
        
        console.log('保存章节数据:', data);
        
        if (editingChapter.value.id) {
            await publicApi.updateChapter(editingChapter.value.id, data);
        } else {
            await publicApi.createChapter(data);
        }
        ElMessage.success('保存成功');
        showChapterModal.value = false;
        // Refresh chapters
        if (showBookDetail.value) {
            await loadBookDetailData();
        } else if (selectedBook.value?.id) {
            selectBook(selectedBook.value);
        }
    } catch (e) {
        console.error('保存章节失败:', e);
        ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message));
    }
};

const handleDeleteChapter = async (chapter) => {
    try {
        await publicApi.deleteChapter(chapter.id);
        ElMessage.success('删除成功');
        // Refresh chapters
        selectBook(selectedBook.value);
    } catch (e) {
        ElMessage.error('删除失败');
    }
};

const rebuildChapterStructure = async () => {
    if (!selectedBook.value || !selectedBook.value.id) {
        ElMessage.warning('请先选择一个书籍');
        return;
    }
    
    try {
        ElMessage.info('正在重新关联题目...');
        // 先获取章节数据
        const chaptersRes = await publicApi.getChapters({ bookId: selectedBook.value.id });
        const chapters = chaptersRes.data || [];
        
        if (chapters.length === 0) {
            ElMessage.warning('该书籍没有章节数据');
            return;
        }
        
        // 构建一个简化的章节结构数据
        const structureData = {
            list: chapters.map(c => ({
                id: c.id,
                parent_id: c.parent_id,
                name: c.name,
                level: c.level,
                count: 0 // 不更新题号计数
            }))
        };
        
        await publicApi.structureBook({
            bookId: selectedBook.value.id,
            chapterData: structureData
        });
        
        ElMessage.success('题目关联已更新');
        // 刷新章节数据
        selectBook(selectedBook.value);
    } catch (e) {
        console.error('重新关联题目失败:', e);
        ElMessage.error('重新关联题目失败');
    }
};

const showAddQuestionInChapter = () => {
    editingQuestion.value = { 
        type: 1, 
        options: ['', '', '', ''], 
        chapterId: selectedChapter.value?.id,
        bookId: selectedBook.value?.id 
    };
    // 新建题目时默认折叠富文本编辑器
    showTitleRichText.value = false;
    showAnswerRichText.value = false;
    showExplanationRichText.value = false;
    showQuestionModal.value = true;
};

// Init
onMounted(() => {
    loadSubjects();
    loadFirstCategories();
    fetchFeedbacks();
    fetchQuestions();
    loadBooks();
});

const loadingChapterQuestions = ref(false);

// Import State
const importSubject = ref('politics');
const importFiles = ref([]);
const importing = ref(false);
const importResult = ref(null);

const batchImportSubject = ref('politics');
const batchGroups = ref([]);
const batchImporting = ref(false);
const batchSelectAll = ref(false);

// Import Methods
const chooseImportFiles = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = '.json';
  input.onchange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length !== 3) {
      ElMessage.warning('请选择 3 个 JSON 文件');
      return;
    }
    importFiles.value = files;
    importResult.value = null;
  };
  input.click();
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

const startImport = async () => {
  if (importFiles.value.length !== 3) return;
  
  importing.value = true;
  importResult.value = null;

  try {
    let bookFile, questionsFile, answersFile;
    
    importFiles.value.forEach(file => {
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
      subject: importSubject.value
    });

    if (res.code === 0) {
      importResult.value = { success: true, msg: '导入成功！书籍 ID: ' + res.data.bookId };
      importFiles.value = [];
    } else {
      throw new Error(res.msg);
    }
  } catch (error) {
    importResult.value = { success: false, msg: '导入失败: ' + error.message };
  } finally {
    importing.value = false;
  }
};

// Batch Import Methods
const chooseBatchFolder = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.webkitdirectory = true;
  input.onchange = handleBatchFileChange;
  input.click();
};

const chooseBatchFiles = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = '.json';
  input.onchange = handleBatchFileChange;
  input.click();
};

const handleBatchFileChange = (e) => {
  const files = Array.from(e.target.files).filter(f => f.name.endsWith('.json'));
  if (files.length === 0) {
    ElMessage.warning('没有找到 JSON 文件');
    return;
  }
  
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
        errorMsg: ''
      };
    }
    groups[baseName].files.push(file);
  });
  
  batchGroups.value = Object.values(groups).filter(g => g.files.length >= 3);
  batchGroups.value.forEach(g => g.status = 'ready');
};

const toggleBatchSelectAll = () => {
  batchGroups.value.forEach(group => {
    if (group.status !== 'success') {
      group.selected = batchSelectAll.value;
    }
  });
};

const batchSelectedCount = computed(() => {
  return batchGroups.value.filter(g => g.selected && g.status !== 'success').length;
});

const getBatchStatusType = (status) => {
  const map = { pending: 'info', ready: 'primary', processing: 'warning', success: 'success', error: 'danger' };
  return map[status] || 'info';
};

const getBatchStatusText = (status) => {
  const map = { pending: '等待', ready: '就绪', processing: '导入中', success: '完成', error: '失败' };
  return map[status] || status;
};

const startBatchImport = async () => {
  if (batchImporting.value) return;
  
  batchImporting.value = true;
  const toImport = batchGroups.value.filter(g => g.selected && g.status !== 'success');
  
  for (const group of toImport) {
    group.status = 'processing';
    try {
      let bookFile, questionsFile, answersFile, structureFile;
      
      group.files.forEach(file => {
        const name = file.name.toLowerCase();
        // 精确匹配：根据文件名结尾的关键词来判断类型
        if (name.endsWith('questions.json') || name.includes('-questions')) questionsFile = file;
        else if (name.endsWith('answers.json') || name.includes('-answers')) answersFile = file;
        else if (name.endsWith('-结构.json') || name.endsWith('structure.json') || name.includes('-structure')) structureFile = file;
        else if (name.endsWith('decrypted_output.json')) structureFile = file;
        else if (!questionsFile && !answersFile && !structureFile) bookFile = file;
      });

      // 如果没有精确匹配到，尝试宽松匹配（但要排除已匹配的文件）
      if (!bookFile) {
        const matchedFiles = [questionsFile, answersFile, structureFile].filter(Boolean);
        group.files.forEach(file => {
          if (!matchedFiles.includes(file) && !bookFile) {
            bookFile = file;
          }
        });
      }

      if (!bookFile || !questionsFile || !answersFile) {
        group.status = 'error';
        group.errorMsg = '缺少核心文件';
        continue;
      }

      const [bookJson, questionsJson, answersJson] = await Promise.all([
        readFile(bookFile),
        readFile(questionsFile),
        readFile(answersFile)
      ]);

      const bookData = bookJson.data || bookJson;
      const questions = questionsJson.data?.question_list || questionsJson.data || questionsJson;
      const answers = answersJson.data || answersJson;

      const res = await publicApi.importPublicData({
        bookData,
        questions: Array.isArray(questions) ? questions : [],
        answers: Array.isArray(answers) ? answers : [],
        subject: batchImportSubject.value
      });

      if (res.code === 0) {
        const bookId = res.data.bookId;
        
        if (structureFile) {
          const structureJson = await readFile(structureFile);
          await publicApi.structureBook({ bookId, chapterData: structureJson });
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
  }
  
  batchImporting.value = false;
  ElMessage.success('批量导入完成');
};

</script>

<style scoped>
.public-management {
  padding: 20px;
}
.header {
  margin-bottom: 20px;
}
.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
}
.right-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.mt-20 { margin-top: 20px; }
.mt-10 { margin-top: 10px; }
.mb-10 { margin-bottom: 10px; }
.mb-20 { margin-bottom: 20px; }
.mr-10 { margin-right: 10px; }

.manage-layout {
  display: flex;
  height: calc(100vh - 250px);
  border: 1px solid #eee;
}
.manage-sidebar {
  width: 200px;
  border-right: 1px solid #eee;
  background-color: #f9f9f9;
}
.sidebar-header {
  padding: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
}
.manage-main {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}
.grid-item {
  cursor: pointer;
}
.book-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.book-card {
  cursor: pointer;
}
.book-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.book-actions {
  margin-top: 10px;
  text-align: right;
}

/* 紧凑版书籍列表样式 */
.book-list-compact {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.book-card-compact {
  cursor: pointer;
}
.book-card-compact :deep(.el-card__body) {
  padding: 10px 15px;
}
.book-info-compact h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
}
.book-info-compact .book-meta {
  margin: 0 0 6px 0;
  font-size: 12px;
  color: #909399;
}
.book-info-compact .book-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.book-actions-compact {
  display: flex;
  justify-content: flex-end;
  gap: 5px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
}
.mb-15 {
  margin-bottom: 15px;
}
.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 8px;
}
.option-row {
  display: flex;
  align-items: flex-start;
}
.options-list {
  width: 100%;
}
.option-item {
  margin-bottom: 10px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
}
.option-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background-color: #409EFF;
  color: white;
  border-radius: 4px;
  margin-right: 10px;
  font-weight: bold;
  flex-shrink: 0;
}
.option-input {
  flex: 1;
  margin-right: 10px;
}
.category-info-display {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
}
.text-gray {
  color: #909399;
}
.mr-5 {
  margin-right: 5px;
}
.field-hint {
  font-size: 12px;
  color: #67C23A;
  margin-top: 5px;
}
.question-form .el-form-item {
  margin-bottom: 18px;
}
.question-form .el-rate {
  line-height: 1;
}
.richtext-expand-section {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 10px;
  background-color: #f5f7fa;
}
.richtext-editor-wrapper {
  margin-top: 10px;
}
.richtext-preview {
  margin-top: 10px;
  padding: 10px;
  background-color: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  max-height: 150px;
  overflow-y: auto;
}
.richtext-preview img {
  max-width: 100%;
  height: auto;
}

/* Import Section Styles */
.import-section {
  margin-bottom: 30px;
}
.import-section h3 {
  margin-bottom: 10px;
}
.import-section .desc {
  color: #666;
  margin-bottom: 20px;
}
.form-row {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  align-items: center;
}
.file-list {
  margin: 15px 0;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
}
.file-item {
  padding: 5px 0;
  color: #606266;
}
.import-result {
  margin-top: 15px;
  padding: 15px;
  border-radius: 4px;
}
.import-result.success {
  background: #f0f9eb;
  color: #67c23a;
}
.import-result.error {
  background: #fef0f0;
  color: #f56c6c;
}
.batch-list {
  margin: 20px 0;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 15px;
}
.batch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e4e7ed;
}
.batch-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}
.batch-item:last-child {
  border-bottom: none;
}

/* 书籍详情弹窗样式 */
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.flex {
  display: flex;
}
.gap-10 {
  gap: 10px;
}
.mb-15 {
  margin-bottom: 15px;
}
</style>
