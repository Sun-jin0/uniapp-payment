<template>
  <div class="tutorial-manage">
    <el-tabs v-model="activeTab" type="border-card">
      <!-- 教辅管理 -->
      <el-tab-pane label="教辅管理" name="tutorials">
        <div class="tab-content">
          <div class="filter-card mb-20">
            <el-row :gutter="20" align="middle">
              <el-col :span="6">
                <el-input
                  v-model="tutorialFilter.keyword"
                  placeholder="搜索教辅名称..."
                  clearable
                  @keyup.enter="fetchTutorials"
                >
                  <template #append>
                    <el-button @click="fetchTutorials">
                      <el-icon><Search /></el-icon>
                    </el-button>
                  </template>
                </el-input>
              </el-col>
              <el-col :span="8">
                <el-input
                  v-model="globalQuestionIdSearch"
                  placeholder="输入题目ID定位到题目..."
                  clearable
                  @keyup.enter="searchQuestionById"
                >
                  <template #append>
                    <el-button type="primary" @click="searchQuestionById" :loading="searchingQuestion">
                      <el-icon><Search /></el-icon>
                    </el-button>
                  </template>
                </el-input>
              </el-col>
              <el-col :span="10" style="text-align: right;">
                <el-button type="success" @click="openCreateTutorialModal">
                  <el-icon><Plus /></el-icon> 创建教辅
                </el-button>
                <el-button type="primary" @click="openTutorialImportModal">
                  <el-icon><Upload /></el-icon> 导入教辅
                </el-button>
                <el-button type="danger" plain @click="resetTutorialIds">
                  <el-icon><RefreshLeft /></el-icon> 重置ID
                </el-button>
              </el-col>
            </el-row>
          </div>

          <el-table :data="tutorials" v-loading="loadingTutorials" border stripe>
            <el-table-column prop="id" label="ID" width="80" align="center" />
            <el-table-column prop="name" label="教辅名称" min-width="200" />
            <el-table-column prop="version" label="版本" width="100" align="center" />
            <el-table-column prop="year" label="年份" width="80" align="center" />
            <el-table-column prop="total_questions" label="题目数" width="100" align="center" />
            <el-table-column prop="status" label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'">
                  {{ row.status === 1 ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="160" align="center">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="300" align="center" fixed="right">
              <template #default="{ row }">
                <div class="action-buttons">
                  <el-button size="small" type="primary" @click="viewTutorialDetail(row)">详情</el-button>
                  <el-button size="small" type="primary" @click="viewTutorialChapters(row)">章节</el-button>
                  <el-button size="small" type="warning" @click="viewTutorialQuestions(row)">题目</el-button>
                  <el-button size="small" type="success" @click="openEditTutorialModal(row)">编辑</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 教辅详情对话框 -->
      <el-dialog 
        v-model="detailModalVisible" 
        :title="currentDetailTutorial?.name + ' - 详情'" 
        width="95%" 
        top="3vh"
        :fullscreen="isDetailFullscreen"
        destroy-on-close
      >
        <template #header>
          <div class="dialog-header">
            <span>{{ currentDetailTutorial?.name }} - 详情</span>
            <el-button type="primary" size="small" @click="isDetailFullscreen = !isDetailFullscreen">
              {{ isDetailFullscreen ? '退出全屏' : '全屏' }}
            </el-button>
          </div>
        </template>
        
        <div v-if="currentDetailTutorial" class="tutorial-detail" v-loading="loadingDetailQuestions">
          <div class="tutorial-info-form">
            <div class="info-row">
              <div class="info-item">
                <span class="info-label">教辅名称</span>
                <el-input v-model="currentDetailTutorial.name" size="small" placeholder="教辅名称" />
              </div>
              <div class="info-item small">
                <span class="info-label">版本</span>
                <el-input v-model="currentDetailTutorial.version" size="small" placeholder="版本" />
              </div>
              <div class="info-item small">
                <span class="info-label">年份</span>
                <el-input v-model="currentDetailTutorial.year" size="small" placeholder="年份" />
              </div>
              <div class="info-item small">
                <span class="info-label">状态</span>
                <el-select v-model="currentDetailTutorial.status" size="small" style="width: 100%;">
                  <el-option label="启用" :value="1" />
                  <el-option label="禁用" :value="0" />
                </el-select>
              </div>
            </div>
          </div>
          
          <div class="mt-10 flex-end">
            <el-button type="primary" size="small" @click="saveTutorialInfo" :loading="savingTutorialInfo">保存教辅信息</el-button>
          </div>
          
          <div class="mt-20 flex-between">
            <h3>题目列表（共 {{ detailQuestions.length }} 题）</h3>
            <el-input 
              v-model="detailSearchKeyword" 
              placeholder="搜索ID或题干..." 
              style="width: 300px"
              clearable
              @input="filterDetailQuestions"
            />
          </div>
          
          <div class="questions-list mt-10" ref="detailQuestionsListRef">
            <div 
              v-for="(q, index) in filteredDetailQuestions" 
              :key="q.question_id" 
              class="question-item"
              :class="{ 'highlighted': highlightedQuestionId === q.question_id }"
              :id="'question-' + q.question_id"
            >
              <div class="question-header">
                <span class="question-index">第 {{ index + 1 }} 题</span>
                <span class="question-type">{{ q.exercise_type_name }}</span>
                <el-tag size="small" type="info">ID: {{ q.question_id }}</el-tag>
                <el-button type="primary" size="small" @click.stop="handleDetailEditQuestion(q, index)">编辑</el-button>
              </div>
              
              <div class="question-content math-content" v-html="renderMath(q.stem)"></div>
              
              <div v-if="q.options && q.options.length > 0" class="question-options">
                <div v-for="opt in q.options" :key="opt.option_key" class="option-item-inline">
                  <span class="option-label">{{ opt.option_key }}.</span>
                  <span class="math-content" v-html="renderMath(opt.option_value)"></span>
                </div>
              </div>
              
              <div v-if="q.subs && q.subs.length > 0" class="question-subs">
                <div v-for="(sub, subIdx) in q.subs" :key="subIdx" class="sub-item">
                  <div class="sub-header">({{ String.fromCharCode(97 + subIdx) }})</div>
                  <div class="sub-content math-content" v-html="renderMath(sub.stem || sub.sub_stem)"></div>
                  <div v-if="sub.answer || sub.sub_answer" class="sub-answer">
                    <strong>答案：</strong><span class="math-content" v-html="renderMath(sub.answer || sub.sub_answer)"></span>
                  </div>
                </div>
              </div>
              
              <div class="question-answer">
                <strong>答案：</strong><span class="math-content" v-html="renderMath(q.answer)"></span>
              </div>
              
              <div v-if="q.analysis" class="question-analysis">
                <strong>解析：</strong><span class="math-content" v-html="renderMath(q.analysis)"></span>
              </div>
            </div>
          </div>
        </div>
      </el-dialog>

      <!-- 合集管理 -->
      <el-tab-pane label="合集管理" name="collections">
        <div class="tab-content">
          <el-card>
            <template #header>
              <div class="card-header">
                <h3>教辅合集管理</h3>
                <el-button type="primary" @click="openCreateCollectionModal">
                  <el-icon><Plus /></el-icon> 创建合集
                </el-button>
              </div>
            </template>

            <!-- 筛选栏 -->
            <div class="filter-bar mb-20">
              <el-input
                v-model="collectionFilter.keyword"
                placeholder="搜索合集名称"
                clearable
                style="width: 250px"
                @keyup.enter="fetchCollections"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
              <el-select v-model="collectionFilter.status" placeholder="状态" clearable style="width: 120px" @change="fetchCollections">
                <el-option label="全部" value="" />
                <el-option label="启用" :value="1" />
                <el-option label="禁用" :value="0" />
              </el-select>
              <el-button type="primary" @click="fetchCollections">搜索</el-button>
              <el-button @click="resetCollectionFilter">重置</el-button>
            </div>

            <!-- 合集列表 -->
            <el-table :data="collections" v-loading="loadingCollections" border stripe>
              <el-table-column type="index" label="序号" width="60" align="center" />
              <el-table-column label="封面" width="100" align="center">
                <template #default="{ row }">
                  <el-image
                    v-if="row.cover_url"
                    :src="row.cover_url"
                    style="width: 60px; height: 80px; object-fit: cover"
                    fit="cover"
                  />
                  <div v-else class="no-cover">无封面</div>
                </template>
              </el-table-column>
              <el-table-column prop="name" label="合集名称" min-width="150" />
              <el-table-column prop="version" label="版本" width="100" align="center" />
              <el-table-column prop="year" label="年份" width="80" align="center" />
              <el-table-column label="包含科目" min-width="200">
                <template #default="{ row }">
                  <div v-if="row.subjects && row.subjects.length > 0">
                    <el-tag
                      v-for="subject in row.subjects"
                      :key="subject.id"
                      size="small"
                      class="mr-5 mb-5"
                    >
                      {{ subject.subject || subject.name }}
                    </el-tag>
                  </div>
                  <span v-else class="text-gray">暂无科目</span>
                </template>
              </el-table-column>
              <el-table-column prop="total_questions" label="总题数" width="100" align="center" />
              <el-table-column label="状态" width="80" align="center">
                <template #default="{ row }">
                  <el-switch
                    v-model="row.status"
                    :active-value="1"
                    :inactive-value="0"
                    @change="(val) => toggleCollectionStatus(row, val)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="250" fixed="right">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="openEditCollectionModal(row)">
                    编辑
                  </el-button>
                  <el-button type="success" link size="small" @click="manageCollectionSubjects(row)">
                    管理科目
                  </el-button>
                  <el-button type="danger" link size="small" @click="deleteCollection(row)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>

            <!-- 分页 -->
            <div class="pagination-container">
              <el-pagination
                v-model:current-page="collectionPagination.page"
                v-model:page-size="collectionPagination.pageSize"
                :total="collectionPagination.total"
                :page-sizes="[10, 20, 50, 100]"
                layout="total, sizes, prev, pager, next"
                @size-change="fetchCollections"
                @current-change="fetchCollections"
              />
            </div>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 创建/编辑合集对话框 -->
    <el-dialog
      v-model="collectionModalVisible"
      :title="isEditCollection ? '编辑合集' : '创建合集'"
      width="600px"
    >
      <el-form :model="collectionForm" :rules="collectionRules" ref="collectionFormRef" label-width="100px">
        <el-form-item label="合集名称" prop="name">
          <el-input v-model="collectionForm.name" placeholder="如：王道考研" />
        </el-form-item>
        <el-form-item label="版本" prop="version">
          <el-input v-model="collectionForm.version" placeholder="如：2026版" />
        </el-form-item>
        <el-form-item label="年份" prop="year">
          <el-input-number v-model="collectionForm.year" :min="2000" :max="2100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="封面图">
          <el-upload
            class="cover-uploader"
            :action="uploadUrl"
            :headers="uploadHeaders"
            :show-file-list="false"
            :on-success="handleUploadSuccess"
            :before-upload="beforeUpload"
          >
            <img v-if="collectionForm.cover_url" :src="collectionForm.cover_url" class="cover-image" />
            <el-icon v-else class="cover-uploader-icon"><Plus /></el-icon>
          </el-upload>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="collectionForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入合集描述"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="collectionForm.sort_order" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="collectionForm.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="collectionModalVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingCollection" @click="saveCollection">保存</el-button>
      </template>
    </el-dialog>

    <!-- 管理科目对话框 -->
    <el-dialog
      v-model="subjectsModalVisible"
      :title="(currentCollection?.name || '合集') + ' - 管理科目'"
      width="800px"
    >
      <div class="subjects-manage">
        <div class="toolbar mb-20">
          <el-button type="primary" size="small" @click="openAddSubjectModal">
            <el-icon><Plus /></el-icon> 添加科目
          </el-button>
        </div>

        <el-table :data="collectionSubjects" border stripe>
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="name" label="教辅名称" min-width="150" />
          <el-table-column prop="subject" label="科目" width="120" align="center" />
          <el-table-column prop="total_questions" label="题目数" width="100" align="center" />
          <el-table-column label="操作" width="150" align="center">
            <template #default="{ row, $index }">
              <el-button type="primary" link size="small" @click="viewSubjectDetail(row)">
                查看
              </el-button>
              <el-button type="danger" link size="small" @click="removeSubject(row, $index)">
                移除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 添加科目对话框 -->
    <el-dialog
      v-model="addSubjectModalVisible"
      title="添加科目到合集"
      width="700px"
    >
      <div class="available-tutorials">
        <div class="toolbar mb-20">
          <el-input
            v-model="tutorialSearchKeyword"
            placeholder="搜索教辅名称"
            clearable
            style="width: 250px"
            @input="filterTutorials"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" size="small" @click="refreshTutorials">刷新</el-button>
        </div>
        
        <el-table 
          :data="filteredTutorials" 
          border 
          stripe 
          max-height="400"
          v-loading="loadingTutorialsList"
        >
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="name" label="教辅名称" min-width="150" />
          <el-table-column prop="subject" label="科目" width="120" align="center" />
          <el-table-column prop="total_questions" label="题目数" width="100" align="center" />
          <el-table-column label="操作" width="100" align="center" fixed="right">
            <template #default="{ row }">
              <el-button 
                type="primary" 
                size="small" 
                :loading="addingSubjectId === row.id"
                @click="confirmAddSubject(row)"
              >
                添加
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 创建教辅对话框 -->
    <el-dialog v-model="createTutorialModalVisible" title="创建新教辅" width="500px">
      <el-form :model="createTutorialForm" label-width="100px">
        <el-form-item label="教辅名称" required>
          <el-input v-model="createTutorialForm.name" placeholder="请输入教辅名称，如：王道考研数据结构" />
        </el-form-item>
        <el-form-item label="版本">
          <el-input v-model="createTutorialForm.version" placeholder="如：2026版" />
        </el-form-item>
        <el-form-item label="年份">
          <el-input-number v-model="createTutorialForm.year" :min="2000" :max="2100" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createTutorialForm.description" type="textarea" :rows="3" placeholder="请输入教辅描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createTutorialModalVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCreateTutorial" :loading="creatingTutorial">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑教辅对话框 -->
    <el-dialog v-model="editTutorialModalVisible" title="编辑教辅" width="500px">
      <el-form :model="editTutorialForm" label-width="100px">
        <el-form-item label="教辅名称" required>
          <el-input v-model="editTutorialForm.name" placeholder="请输入教辅名称" />
        </el-form-item>
        <el-form-item label="版本">
          <el-input v-model="editTutorialForm.version" placeholder="如：2026版" />
        </el-form-item>
        <el-form-item label="年份">
          <el-input-number v-model="editTutorialForm.year" :min="2000" :max="2100" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editTutorialForm.description" type="textarea" :rows="3" placeholder="请输入教辅描述" />
        </el-form-item>
        <el-divider />
        <el-form-item label="状态">
          <el-switch
            v-model="editTutorialForm.status"
            :active-value="1"
            :inactive-value="0"
            active-text="启用"
            inactive-text="禁用"
            @change="handleEditStatusChange"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="danger" plain @click="handleEditDelete">删除教辅</el-button>
        <el-button @click="editTutorialModalVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmEditTutorial" :loading="editingTutorial">保存</el-button>
      </template>
    </el-dialog>

    <!-- 复制教辅对话框 -->
    <el-dialog v-model="copyTutorialModalVisible" title="复制教辅" width="500px">
      <el-alert
        title="复制说明"
        description="复制将创建一个新的教辅，包含原教辅的所有章节结构，但不会复制题目内容。您可以在新教辅中重新添加或导入题目。"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      />
      <el-form :model="copyTutorialForm" label-width="100px">
        <el-form-item label="原教辅">
          <el-input :value="copyTutorialForm.sourceName" disabled />
        </el-form-item>
        <el-form-item label="新教辅名称" required>
          <el-input v-model="copyTutorialForm.name" placeholder="请输入新教辅名称" />
        </el-form-item>
        <el-form-item label="版本">
          <el-input v-model="copyTutorialForm.version" placeholder="如：2027版" />
        </el-form-item>
        <el-form-item label="年份">
          <el-input-number v-model="copyTutorialForm.year" :min="2000" :max="2100" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="copyTutorialModalVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCopyTutorial" :loading="copyingTutorial">复制</el-button>
      </template>
    </el-dialog>

    <!-- 教辅导入对话框 -->
    <el-dialog v-model="tutorialImportModalVisible" title="导入教辅数据" width="600px" :close-on-click-modal="false">
      <el-form :model="tutorialImportForm" label-width="100px">
        <el-form-item label="版本">
          <el-input v-model="tutorialImportForm.version" placeholder="如：25版、26版" style="width: 200px;" />
        </el-form-item>
        <el-form-item label="年份">
          <el-input v-model="tutorialImportForm.year" placeholder="如：2025" style="width: 200px;" />
        </el-form-item>
        <el-form-item label="数据文件">
          <el-upload
            action="#"
            :auto-upload="false"
            :on-change="handleTutorialFileChange"
            accept=".json"
            :limit="1"
            :file-list="tutorialFileList"
          >
            <el-button type="primary">选择JSON文件</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="tutorialImportModalVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmImportTutorial" :loading="importingTutorial" :disabled="!tutorialImportForm.data">
          开始导入
        </el-button>
      </template>
    </el-dialog>

    <!-- 题目查看/编辑弹窗 -->
    <el-dialog 
      v-model="questionsModalVisible" 
      :title="currentTutorial?.name + ' - 题目管理'" 
      width="90%" 
      :close-on-click-modal="false"
      class="questions-dialog"
      destroy-on-close
    >
      <div class="questions-container" v-loading="loadingQuestions">
        <!-- 左侧题目列表 -->
        <div class="questions-sidebar">
          <div class="questions-header">
            <span>共 {{ tutorialQuestions.length }} 题</span>
            <el-input 
              v-model="questionSearchKeyword" 
              placeholder="搜索ID或题干..." 
              size="small"
              clearable
              @input="filterQuestions"
            />
          </div>
          <div class="questions-list">
            <div 
              v-for="(q, index) in filteredQuestions" 
              :key="q.question_id"
              class="question-item"
              :class="{ active: currentQuestionIndex === index }"
              @click="selectQuestion(index)"
            >
              <div class="question-number">{{ index + 1 }}</div>
              <div class="question-preview" v-html="stripHtml(q.stem).substring(0, 50) + '...'"></div>
              <div class="question-type">{{ q.exercise_type_name }}</div>
            </div>
          </div>
        </div>

        <!-- 右侧题目详情/编辑 -->
        <div class="question-detail" v-if="currentQuestion">
          <div class="detail-header">
            <div class="question-nav">
              <el-button size="small" @click="prevQuestion" :disabled="currentQuestionIndex === 0">
                <el-icon><ArrowLeft /></el-icon> 上一题
              </el-button>
              <span class="question-counter">{{ currentQuestionIndex + 1 }} / {{ tutorialQuestions.length }}</span>
              <el-button size="small" @click="nextQuestion" :disabled="currentQuestionIndex === tutorialQuestions.length - 1">
                下一题 <el-icon><ArrowRight /></el-icon>
              </el-button>
            </div>
            <div class="question-actions">
              <el-button type="primary" size="small" @click="openEditQuestionModal(currentQuestion)">
                <el-icon><Edit /></el-icon> 编辑题目
              </el-button>
            </div>
          </div>

          <div class="question-content">
            <div class="info-row">
              <el-tag size="small">{{ currentQuestion.exercise_type_name }}</el-tag>
              <el-tag size="small" type="info">ID: {{ currentQuestion.question_id }}</el-tag>
            </div>

            <div class="content-section">
              <h4>题干</h4>
              <div class="content-text" v-html="renderMath(currentQuestion.stem)"></div>
            </div>

            <!-- 选择题选项 -->
            <div class="content-section" v-if="currentQuestion.options && currentQuestion.options.length > 0">
              <h4>选项</h4>
              <div class="options-list">
                <div v-for="opt in currentQuestion.options" :key="opt.option_key" class="option-item">
                  <span class="option-key">{{ opt.option_key }}.</span>
                  <span class="option-value" v-html="renderMath(opt.option_value)"></span>
                </div>
              </div>
            </div>

            <div class="content-section">
              <h4>答案</h4>
              <div class="content-text" v-html="renderMath(currentQuestion.answer)"></div>
            </div>

            <div class="content-section">
              <h4>解析</h4>
              <div class="content-text" v-html="renderMath(currentQuestion.analysis) || '暂无解析'"></div>
            </div>

            <!-- 小题（解答题） -->
            <div class="content-section" v-if="currentQuestion.subs && currentQuestion.subs.length > 0">
              <h4>小题</h4>
              <div v-for="(sub, idx) in currentQuestion.subs" :key="idx" class="sub-item">
                <div class="sub-title">小题 {{ idx + 1 }}</div>
                <div class="sub-stem" v-html="renderMath(sub.stem || sub.sub_stem)"></div>
                <div class="sub-answer" v-if="sub.answer || sub.sub_answer">
                  <strong>答案：</strong><span v-html="renderMath(sub.answer || sub.sub_answer)"></span>
                </div>
              </div>
            </div>

            <!-- 考点标签 -->
            <div class="content-section" v-if="currentQuestion.tags && currentQuestion.tags.length > 0">
              <h4>考点</h4>
              <div class="tags-list">
                <el-tag v-for="tag in currentQuestion.tags" :key="tag.tag_id" size="small" class="mr-5">
                  {{ tag.tag_name }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>

        <div class="empty-state" v-else>
          <el-empty description="暂无题目" />
        </div>
      </div>
    </el-dialog>

    <!-- 题目编辑弹窗 -->
    <el-dialog
      v-model="editQuestionModalVisible"
      title="编辑题目"
      width="80%"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form :model="editingQuestionForm" label-width="100px" v-if="editingQuestionForm">
        <el-form-item label="题型">
          <el-select v-model="editingQuestionForm.exercise_type" style="width: 200px">
            <el-option label="单选题" :value="1" />
            <el-option label="多选题" :value="2" />
            <el-option label="填空题" :value="3" />
            <el-option label="解答题" :value="4" />
            <el-option label="判断题" :value="5" />
          </el-select>
        </el-form-item>

        <el-form-item label="题干">
          <div class="editor-wrapper">
            <RichEditor v-model="editingQuestionForm.stem" placeholder="请输入题干" :height="120" />
          </div>
        </el-form-item>

        <!-- 选择题选项编辑 -->
        <el-form-item label="选项" v-if="[1, 2].includes(editingQuestionForm.exercise_type)">
          <div class="options-edit">
            <div v-for="(opt, idx) in editingQuestionForm.options" :key="idx" class="option-edit-item">
              <el-input v-model="opt.option_key" style="width: 60px" />
              <div class="option-editor-wrapper">
                <RichEditor v-model="opt.option_value" placeholder="选项内容" :height="80" />
              </div>
              <el-button type="danger" link @click="removeEditOption(idx)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-button type="primary" link @click="addEditOption">
              <el-icon><Plus /></el-icon> 添加选项
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="答案">
          <div class="editor-wrapper">
            <RichEditor v-model="editingQuestionForm.answer" placeholder="请输入答案" :height="100" />
          </div>
        </el-form-item>

        <el-form-item label="解析">
          <div class="editor-wrapper">
            <RichEditor v-model="editingQuestionForm.analysis" placeholder="请输入解析" :height="120" />
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editQuestionModalVisible = false">取消</el-button>
        <el-button type="primary" @click="saveQuestion" :loading="savingQuestion">保存</el-button>
      </template>
    </el-dialog>

    <!-- AI 代码格式化弹窗 -->
    <el-dialog
      v-model="aiFixModalVisible"
      title="AI 代码格式化"
      width="70%"
      :close-on-click-modal="false"
    >
      <div class="ai-fix-container">
        <div class="ai-fix-section">
          <h4>原始内容</h4>
          <el-input
            v-model="aiFixOriginalText"
            type="textarea"
            :rows="8"
            placeholder="请选择要格式化的内容..."
            readonly
          />
        </div>
        <div class="ai-fix-arrow">
          <el-button type="primary" @click="callAIFix" :loading="aiFixLoading">
            <el-icon><MagicStick /></el-icon> AI格式化
          </el-button>
        </div>
        <div class="ai-fix-section">
          <h4>格式化后</h4>
          <el-input
            v-model="aiFixResultText"
            type="textarea"
            :rows="8"
            placeholder="AI格式化后的内容将显示在这里..."
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="aiFixModalVisible = false">取消</el-button>
        <el-button type="primary" @click="applyAIFixResult" :disabled="!aiFixResultText">应用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, Upload, RefreshLeft, ArrowLeft, ArrowRight, Edit, Delete } from '@element-plus/icons-vue'
import RichEditor from '@/components/RichEditor.vue'
import { transformContextString } from '@/utils/latex'

const router = useRouter()

// 当前激活的 tab
const activeTab = ref('tutorials')

// ==================== 教辅管理 ====================
const loadingTutorials = ref(false)
const tutorials = ref([])
const tutorialFilter = reactive({
  keyword: ''
})

// 全局题目ID搜索
const globalQuestionIdSearch = ref('')
const searchingQuestion = ref(false)

const searchQuestionById = async () => {
  const questionId = globalQuestionIdSearch.value.trim()
  if (!questionId) {
    ElMessage.warning('请输入题目ID')
    return
  }
  
  searchingQuestion.value = true
  try {
    // 先获取所有教辅
    const res = await adminApi.getTutorials()
    const allTutorials = res.data?.list || []
    
    if (allTutorials.length === 0) {
      ElMessage.warning('暂无教辅数据')
      return
    }
    
    // 遍历每个教辅查找题目
    for (const tutorial of allTutorials) {
      try {
        const questionsRes = await adminApi.getTutorialQuestions(tutorial.id)
        const questions = questionsRes.data || []
        
        const matchedQuestion = questions.find(q => 
          q.question_id && q.question_id.toLowerCase().includes(questionId.toLowerCase())
        )
        
        if (matchedQuestion) {
          // 找到匹配的题目，打开详情
          ElMessage.success(`找到题目，所属教辅：${tutorial.name}`)
          
          // 打开教辅详情
          await viewTutorialDetail(tutorial)
          
          // 设置搜索关键词并触发定位
          detailSearchKeyword.value = questionId
          filterDetailQuestions()
          
          return
        }
      } catch (e) {
        // 继续查找下一个教辅
        continue
      }
    }
    
    ElMessage.warning('未找到该题目ID，请检查ID是否正确')
  } catch (error) {
    console.error('搜索题目失败:', error)
    ElMessage.error('搜索题目失败')
  } finally {
    searchingQuestion.value = false
  }
}

// 获取教辅列表
const fetchTutorials = async () => {
  loadingTutorials.value = true
  try {
    const res = await adminApi.getTutorials()
    tutorials.value = res.data?.list || []
    if (tutorialFilter.keyword) {
      tutorials.value = tutorials.value.filter(t => 
        t.name.toLowerCase().includes(tutorialFilter.keyword.toLowerCase())
      )
    }
  } catch (error) {
    console.error('获取教辅列表失败:', error)
    ElMessage.error('获取教辅列表失败')
  } finally {
    loadingTutorials.value = false
  }
}

// 创建教辅
const createTutorialModalVisible = ref(false)
const creatingTutorial = ref(false)
const createTutorialForm = reactive({
  name: '',
  version: '',
  year: new Date().getFullYear(),
  description: ''
})

const openCreateTutorialModal = () => {
  createTutorialForm.name = ''
  createTutorialForm.version = ''
  createTutorialForm.year = new Date().getFullYear()
  createTutorialForm.description = ''
  createTutorialModalVisible.value = true
}

const confirmCreateTutorial = async () => {
  if (!createTutorialForm.name.trim()) {
    ElMessage.warning('请输入教辅名称')
    return
  }
  creatingTutorial.value = true
  try {
    await adminApi.createTutorial(createTutorialForm)
    ElMessage.success('创建成功')
    createTutorialModalVisible.value = false
    fetchTutorials()
  } catch (error) {
    console.error('创建教辅失败:', error)
    ElMessage.error('创建教辅失败')
  } finally {
    creatingTutorial.value = false
  }
}

// 编辑教辅
const editTutorialModalVisible = ref(false)
const editingTutorial = ref(false)
const editTutorialForm = reactive({
  id: null,
  name: '',
  version: '',
  year: new Date().getFullYear(),
  description: '',
  status: 1
})

const openEditTutorialModal = (tutorial) => {
  editTutorialForm.id = tutorial.id
  editTutorialForm.name = tutorial.name
  editTutorialForm.version = tutorial.version
  editTutorialForm.year = tutorial.year || new Date().getFullYear()
  editTutorialForm.description = tutorial.description || ''
  editTutorialForm.status = tutorial.status || 1
  editTutorialModalVisible.value = true
}

const confirmEditTutorial = async () => {
  if (!editTutorialForm.name.trim()) {
    ElMessage.warning('请输入教辅名称')
    return
  }
  editingTutorial.value = true
  try {
    await adminApi.updateTutorial(editTutorialForm.id, {
      name: editTutorialForm.name,
      version: editTutorialForm.version,
      year: editTutorialForm.year,
      description: editTutorialForm.description,
      status: editTutorialForm.status
    })
    ElMessage.success('更新成功')
    editTutorialModalVisible.value = false
    fetchTutorials()
  } catch (error) {
    console.error('更新教辅失败:', error)
    ElMessage.error('更新教辅失败')
  } finally {
    editingTutorial.value = false
  }
}

// 编辑对话框中的状态切换
const handleEditStatusChange = async (val) => {
  try {
    await adminApi.updateTutorial(editTutorialForm.id, { status: val })
    ElMessage.success(val === 1 ? '已启用' : '已禁用')
    // 更新本地状态
    const tutorial = tutorials.value.find(t => t.id === editTutorialForm.id)
    if (tutorial) {
      tutorial.status = val
    }
  } catch (error) {
    console.error('更新状态失败:', error)
    ElMessage.error('更新状态失败')
    // 恢复原状态
    editTutorialForm.status = val === 1 ? 0 : 1
  }
}

// 编辑对话框中的删除
const handleEditDelete = async () => {
  try {
    await ElMessageBox.confirm('确定要删除该教辅吗？这将同时删除相关章节和题目关联。', '警告', { type: 'warning' })
    await adminApi.deleteTutorial(editTutorialForm.id)
    ElMessage.success('删除成功')
    editTutorialModalVisible.value = false
    fetchTutorials()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 复制教辅
const copyTutorialModalVisible = ref(false)
const copyingTutorial = ref(false)
const copyTutorialForm = reactive({
  sourceId: null,
  sourceName: '',
  name: '',
  version: '',
  year: new Date().getFullYear()
})

const openCopyTutorialModal = (tutorial) => {
  copyTutorialForm.sourceId = tutorial.id
  copyTutorialForm.sourceName = tutorial.name
  copyTutorialForm.name = tutorial.name + ' (复制)'
  copyTutorialForm.version = tutorial.version
  copyTutorialForm.year = tutorial.year || new Date().getFullYear()
  copyTutorialModalVisible.value = true
}

const confirmCopyTutorial = async () => {
  if (!copyTutorialForm.name.trim()) {
    ElMessage.warning('请输入新教辅名称')
    return
  }
  copyingTutorial.value = true
  try {
    // 1. 创建新教辅
    const res = await adminApi.createTutorial({
      name: copyTutorialForm.name.trim(),
      version: copyTutorialForm.version.trim(),
      year: copyTutorialForm.year,
      description: `从 ${copyTutorialForm.sourceName} 复制`,
      status: 1
    })
    const newTutorialId = res.data?.id
    
    // 2. 获取原教辅的章节结构和题目关联
    const sourceRes = await adminApi.getTutorialDetail(copyTutorialForm.sourceId)
    const chapters = sourceRes.data?.chapters || []
    
    // 获取原教辅的所有题目关联
    const questionLinksRes = await adminApi.getTutorialQuestions(copyTutorialForm.sourceId)
    const questionLinks = questionLinksRes.data || []
    
    // 3. 复制章节结构和题目关联
    if (chapters.length > 0 && newTutorialId) {
      const chapterMap = {} // 旧ID -> 新ID
      
      // 递归遍历树形结构创建章节
      const createChaptersRecursive = async (chapterList, parentNewId = 0) => {
        for (const chapter of chapterList) {
          try {
            const newChapterRes = await adminApi.createTutorialChapter(newTutorialId, {
              name: chapter.name,
              parent_id: parentNewId,
              level: chapter.level,
              sort_order: chapter.sort_order
            })
            const newId = newChapterRes.data?.id
            chapterMap[chapter.id] = newId
            
            // 递归创建子章节
            if (chapter.children && chapter.children.length > 0) {
              await createChaptersRecursive(chapter.children, newId)
            }
          } catch (err) {
            console.error('创建章节失败:', err)
            throw err
          }
        }
      }
      
      await createChaptersRecursive(chapters)
      
      // 4. 复制题目关联
      if (questionLinks && questionLinks.length > 0) {
        let copiedCount = 0
        for (const link of questionLinks) {
          const newChapterId = chapterMap[link.chapter_id]
          if (newChapterId) {
            try {
              await adminApi.addTutorialQuestion({
                tutorial_id: newTutorialId,
                chapter_id: newChapterId,
                question_id: link.question_id,
                sort_order: link.sort_order
              })
              copiedCount++
            } catch (err) {
              console.error('复制题目关联失败:', err)
            }
          }
        }
        console.log(`复制了 ${copiedCount} 个题目关联`)
      }
    }
    
    ElMessage.success('复制教辅成功')
    copyTutorialModalVisible.value = false
    fetchTutorials()
  } catch (error) {
    console.error('复制教辅失败:', error)
    ElMessage.error('复制教辅失败')
  } finally {
    copyingTutorial.value = false
  }
}

// 查看章节
const viewTutorialChapters = (row) => {
  router.push(`/computer/tutorials/${row.id}/chapters`)
}

// ==================== 教辅详情 ====================
const detailModalVisible = ref(false)
const currentDetailTutorial = ref(null)
const detailQuestions = ref([])
const filteredDetailQuestions = ref([])
const loadingDetailQuestions = ref(false)
const detailSearchKeyword = ref('')
const isDetailFullscreen = ref(false)
const savingTutorialInfo = ref(false)
const detailEditingIndex = ref(null)

const viewTutorialDetail = async (row) => {
  currentDetailTutorial.value = { ...row }
  detailModalVisible.value = true
  isDetailFullscreen.value = false
  await fetchDetailQuestions(row.id)
}

const fetchDetailQuestions = async (tutorialId) => {
  loadingDetailQuestions.value = true
  try {
    const res = await adminApi.getTutorialQuestions(tutorialId)
    detailQuestions.value = res.data || []
    filteredDetailQuestions.value = [...detailQuestions.value]
  } catch (error) {
    console.error('获取题目列表失败:', error)
    ElMessage.error('获取题目列表失败')
  } finally {
    loadingDetailQuestions.value = false
  }
}

const detailQuestionsListRef = ref(null)
const highlightedQuestionId = ref(null)

const filterDetailQuestions = () => {
  const keyword = detailSearchKeyword.value.toLowerCase().trim()
  if (!keyword) {
    filteredDetailQuestions.value = [...detailQuestions.value]
    highlightedQuestionId.value = null
    return
  }
  
  // 检查是否是ID搜索（纯数字或长度较长）
  const isIdSearch = /^\d+$/.test(keyword) || keyword.length > 15
  
  if (isIdSearch) {
    // ID搜索：显示所有题目，高亮匹配的题目并滚动到该位置
    filteredDetailQuestions.value = [...detailQuestions.value]
    
    const matchedQuestion = detailQuestions.value.find(q => 
      q.question_id && q.question_id.toLowerCase().includes(keyword)
    )
    
    if (matchedQuestion) {
      highlightedQuestionId.value = matchedQuestion.question_id
      // 滚动到该题目位置
      setTimeout(() => {
        const element = document.getElementById('question-' + matchedQuestion.question_id)
        if (element && detailQuestionsListRef.value) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    } else {
      highlightedQuestionId.value = null
    }
  } else {
    // 普通文本搜索：过滤显示
    filteredDetailQuestions.value = detailQuestions.value.filter(q => 
      (q.stem && q.stem.toLowerCase().includes(keyword))
    )
    highlightedQuestionId.value = null
  }
}

const saveTutorialInfo = async () => {
  savingTutorialInfo.value = true
  try {
    await adminApi.updateTutorial(currentDetailTutorial.value.id, currentDetailTutorial.value)
    ElMessage.success('保存成功')
    fetchTutorials()
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    savingTutorialInfo.value = false
  }
}

const handleDetailEditQuestion = (question, index) => {
  detailEditingIndex.value = index
  openEditQuestionModal(question)
}

// ==================== 题目查看/编辑 ====================
const questionsModalVisible = ref(false)
const currentTutorial = ref(null)
const tutorialQuestions = ref([])
const filteredQuestions = ref([])
const currentQuestionIndex = ref(0)
const currentQuestion = computed(() => filteredQuestions.value[currentQuestionIndex.value] || null)
const loadingQuestions = ref(false)
const questionSearchKeyword = ref('')

const viewTutorialQuestions = async (row) => {
  currentTutorial.value = row
  questionsModalVisible.value = true
  await fetchTutorialQuestions(row.id)
}

const fetchTutorialQuestions = async (tutorialId, keepIndex = null) => {
  loadingQuestions.value = true
  try {
    const res = await adminApi.getTutorialQuestions(tutorialId)
    tutorialQuestions.value = res.data || []
    filteredQuestions.value = [...tutorialQuestions.value]
    // 如果有 keepIndex，恢复到指定索引，否则重置为0
    if (keepIndex !== null && keepIndex < filteredQuestions.value.length) {
      currentQuestionIndex.value = keepIndex
    } else {
      currentQuestionIndex.value = 0
    }
  } catch (error) {
    console.error('获取题目列表失败:', error)
    ElMessage.error('获取题目列表失败')
  } finally {
    loadingQuestions.value = false
  }
}

const filterQuestions = () => {
  const keyword = questionSearchKeyword.value.toLowerCase()
  if (!keyword) {
    filteredQuestions.value = [...tutorialQuestions.value]
  } else {
    filteredQuestions.value = tutorialQuestions.value.filter(q => 
      (q.stem && q.stem.toLowerCase().includes(keyword)) ||
      (q.question_id && q.question_id.toLowerCase().includes(keyword))
    )
  }
  currentQuestionIndex.value = 0
}

const selectQuestion = (index) => {
  currentQuestionIndex.value = index
}

const prevQuestion = () => {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value--
  }
}

const nextQuestion = () => {
  if (currentQuestionIndex.value < tutorialQuestions.value.length - 1) {
    currentQuestionIndex.value++
  }
}

const stripHtml = (html) => {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '')
}

// 渲染 LaTeX/Math 公式
const renderMath = (text) => {
  return transformContextString(text || '')
}

// 题目编辑
const editQuestionModalVisible = ref(false)
const editingQuestionForm = ref(null)
const savingQuestion = ref(false)

// AI 代码格式化相关
const aiFixModalVisible = ref(false)
const aiFixField = ref('')
const aiFixOriginalText = ref('')
const aiFixResultText = ref('')
const aiFixLoading = ref(false)

const openAIFixModal = (field) => {
  aiFixField.value = field
  aiFixOriginalText.value = editingQuestionForm.value[field] || ''
  aiFixResultText.value = ''
  aiFixModalVisible.value = true
}

// 清理多余空行的辅助函数
const cleanEmptyLines = (content) => {
  return content
    .replace(/---+/g, '') // 去除 --- 分隔符
    .replace(/\n[ \t]*\n[ \t]*\n+/g, '\n\n') // 3个及以上空行变成2个
    .replace(/\n[ \t]*\n([ \t]*[}\]])/g, '\n$1') // 删除 } 或 ] 前的空行
    .replace(/([{\[])[ \t]*\n[ \t]*\n/g, '$1\n') // 删除 { 或 [ 后的空行
    .replace(/^\s+|\s+$/g, '') // 去除首尾空白
}

const callAIFix = async () => {
  if (!aiFixOriginalText.value) {
    ElMessage.warning('请先选择要格式化的内容')
    return
  }
  
  aiFixLoading.value = true
  try {
    // 调用 AI API 进行格式化
    const res = await adminApi.aiFormatCode({
      content: aiFixOriginalText.value,
      instruction: '请格式化以下代码，删除所有多余空行，特别是代码块中的空行。保持原有逻辑和内容不变，只调整格式。'
    })
    
    // 使用后端返回的结果，再进行一次清理确保空行被删除
    aiFixResultText.value = cleanEmptyLines(res.data.formattedContent || aiFixOriginalText.value)
    ElMessage.success('AI格式化完成')
  } catch (error) {
    console.error('AI格式化失败:', error)
    // 如果AI调用失败，返回清理后的内容
    aiFixResultText.value = cleanEmptyLines(aiFixOriginalText.value)
    ElMessage.warning('AI服务暂时不可用，已进行基础清理')
  } finally {
    aiFixLoading.value = false
  }
}

const applyAIFixResult = () => {
  if (aiFixResultText.value && editingQuestionForm.value) {
    editingQuestionForm.value[aiFixField.value] = aiFixResultText.value
    ElMessage.success('已应用格式化结果')
    aiFixModalVisible.value = false
  }
}

const openEditQuestionModal = (question) => {
  editingQuestionForm.value = JSON.parse(JSON.stringify(question))
  // 确保 options 是数组
  if (typeof editingQuestionForm.value.options === 'string') {
    try {
      editingQuestionForm.value.options = JSON.parse(editingQuestionForm.value.options)
    } catch (e) {
      editingQuestionForm.value.options = []
    }
  }
  if (!editingQuestionForm.value.options) {
    editingQuestionForm.value.options = []
  }
  editQuestionModalVisible.value = true
}

const addEditOption = () => {
  if (!editingQuestionForm.value.options) {
    editingQuestionForm.value.options = []
  }
  const nextKey = String.fromCharCode(65 + editingQuestionForm.value.options.length)
  editingQuestionForm.value.options.push({ option_key: nextKey, option_value: '' })
}

const removeEditOption = (index) => {
  if (!editingQuestionForm.value.options) return
  editingQuestionForm.value.options.splice(index, 1)
  // 重新排序选项键
  editingQuestionForm.value.options.forEach((opt, idx) => {
    opt.option_key = String.fromCharCode(65 + idx)
  })
}

const saveQuestion = async () => {
  if (!editingQuestionForm.value) return
  
  savingQuestion.value = true
  const savedIndex = currentQuestionIndex.value
  const savedDetailIndex = detailEditingIndex.value
  
  try {
    const saveData = {
      ...editingQuestionForm.value,
      knowledgeTags: (editingQuestionForm.value.tags || []).map(t => t.tag_name).filter(Boolean)
    }
    
    await adminApi.updateComputerQuestion(editingQuestionForm.value.question_id, saveData)
    
    ElMessage.success('保存成功')
    editQuestionModalVisible.value = false
    
    if (currentTutorial.value) {
      await fetchTutorialQuestions(currentTutorial.value.id, savedIndex)
    }
    
    if (currentDetailTutorial.value) {
      await fetchDetailQuestions(currentDetailTutorial.value.id)
      if (savedDetailIndex !== null) {
        detailEditingIndex.value = null
      }
    }
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    savingQuestion.value = false
  }
}

// 导入教辅
const tutorialImportModalVisible = ref(false)
const tutorialImportForm = reactive({
  version: '',
  year: '',
  data: null
})
const tutorialFileList = ref([])
const importingTutorial = ref(false)

const openTutorialImportModal = () => {
  tutorialImportForm.version = ''
  tutorialImportForm.year = ''
  tutorialImportForm.data = null
  tutorialFileList.value = []
  tutorialImportModalVisible.value = true
}

const handleTutorialFileChange = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      tutorialImportForm.data = data
      ElMessage.success('文件读取成功')
    } catch (error) {
      ElMessage.error('JSON 格式错误')
    }
  }
  reader.readAsText(file.raw)
}

const confirmImportTutorial = async () => {
  if (!tutorialImportForm.data) {
    ElMessage.warning('请先选择数据文件')
    return
  }
  importingTutorial.value = true
  try {
    // 构建请求数据
    const requestData = {
      version: tutorialImportForm.version,
      year: tutorialImportForm.year,
      data: tutorialImportForm.data
    }
    console.log('发送导入请求:', requestData)
    console.log('data 类型:', typeof requestData.data, '是否数组:', Array.isArray(requestData.data))
    const res = await adminApi.importTutorial(requestData)
    console.log('导入响应:', res)
    ElMessage.success('导入成功')
    tutorialImportModalVisible.value = false
    fetchTutorials()
    fetchCollections()
  } catch (error) {
    console.error('导入失败:', error)
    console.error('错误响应:', error.response?.data)
    ElMessage.error(error.response?.data?.message || '导入失败')
    console.error('导入失败:', error)
    ElMessage.error('导入失败')
  } finally {
    importingTutorial.value = false
  }
}

// 重置教辅ID
const resetTutorialIds = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要重置教辅ID吗？这将把所有教辅相关表的自增ID重置为1。\n\n注意：此操作需要删除所有教辅、章节、题目关联和合集数据后才能执行！',
      '警告',
      {
        confirmButtonText: '确定重置',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await adminApi.resetTutorialIds()
    ElMessage.success('ID重置成功，新记录将从1开始编号')
    fetchTutorials()
    fetchCollections()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重置ID失败:', error)
      ElMessage.error(error.response?.data?.message || '重置ID失败')
    }
  }
}

// ==================== 合集管理 ====================
const loadingCollections = ref(false)
const collections = ref([])
const collectionFilter = reactive({
  keyword: '',
  status: ''
})
const collectionPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 获取合集列表
const fetchCollections = async () => {
  loadingCollections.value = true
  try {
    const res = await adminApi.getTutorialCollections({
      keyword: collectionFilter.keyword,
      status: collectionFilter.status,
      page: collectionPagination.page,
      pageSize: collectionPagination.pageSize
    })
    collections.value = res.data?.list || []
    collectionPagination.total = res.data?.total || 0
  } catch (error) {
    console.error('获取合集列表失败:', error)
    ElMessage.error('获取合集列表失败')
  } finally {
    loadingCollections.value = false
  }
}

const resetCollectionFilter = () => {
  collectionFilter.keyword = ''
  collectionFilter.status = ''
  collectionPagination.page = 1
  fetchCollections()
}

// 创建/编辑合集
const collectionModalVisible = ref(false)
const isEditCollection = ref(false)
const collectionFormRef = ref(null)
const savingCollection = ref(false)
const collectionForm = reactive({
  id: null,
  name: '',
  version: '',
  year: new Date().getFullYear(),
  cover_url: '',
  description: '',
  sort_order: 0,
  status: 1
})

const collectionRules = {
  name: [{ required: true, message: '请输入合集名称', trigger: 'blur' }],
  version: [{ required: true, message: '请输入版本', trigger: 'blur' }]
}

const uploadUrl = '/api/upload/image'
const uploadHeaders = {
  Authorization: `Bearer ${localStorage.getItem('admin_token')}`
}

const openCreateCollectionModal = () => {
  isEditCollection.value = false
  collectionForm.id = null
  collectionForm.name = ''
  collectionForm.version = ''
  collectionForm.year = new Date().getFullYear()
  collectionForm.cover_url = ''
  collectionForm.description = ''
  collectionForm.sort_order = 0
  collectionForm.status = 1
  collectionModalVisible.value = true
}

const openEditCollectionModal = (row) => {
  isEditCollection.value = true
  Object.assign(collectionForm, row)
  collectionModalVisible.value = true
}

const saveCollection = async () => {
  if (!collectionFormRef.value) return
  
  await collectionFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    savingCollection.value = true
    try {
      if (isEditCollection.value) {
        await adminApi.updateTutorialCollection(collectionForm.id, collectionForm)
        ElMessage.success('更新成功')
      } else {
        await adminApi.createTutorialCollection(collectionForm)
        ElMessage.success('创建成功')
      }
      collectionModalVisible.value = false
      fetchCollections()
    } catch (error) {
      console.error('保存合集失败:', error)
      ElMessage.error('保存合集失败')
    } finally {
      savingCollection.value = false
    }
  })
}

const toggleCollectionStatus = async (row, val) => {
  try {
    await adminApi.updateTutorialCollection(row.id, { status: val })
    ElMessage.success('状态更新成功')
  } catch (error) {
    console.error('更新状态失败:', error)
    ElMessage.error('更新状态失败')
    row.status = val === 1 ? 0 : 1
  }
}

const deleteCollection = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除该合集吗？', '警告', { type: 'warning' })
    await adminApi.deleteTutorialCollection(row.id)
    ElMessage.success('删除成功')
    fetchCollections()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除合集失败:', error)
      ElMessage.error('删除合集失败')
    }
  }
}

// 上传相关
const beforeUpload = (file) => {
  const isJPG = file.type === 'image/jpeg'
  const isPNG = file.type === 'image/png'
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isJPG && !isPNG) {
    ElMessage.error('只支持 JPG/PNG 格式!')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB!')
    return false
  }
  return true
}

const handleUploadSuccess = (res) => {
  if (res.code === 0 || res.code === 200) {
    collectionForm.cover_url = res.data.url
    ElMessage.success('上传成功')
  } else {
    ElMessage.error(res.message || '上传失败')
  }
}

// 科目管理
const subjectsModalVisible = ref(false)
const currentCollection = ref(null)
const collectionSubjects = ref([])

const manageCollectionSubjects = async (row) => {
  currentCollection.value = row
  subjectsModalVisible.value = true
  await fetchCollectionSubjects(row.id)
}

const fetchCollectionSubjects = async (collectionId) => {
  try {
    const res = await adminApi.getTutorialCollectionDetail(collectionId)
    collectionSubjects.value = res.data?.subjects || []
  } catch (error) {
    console.error('获取科目列表失败:', error)
    ElMessage.error('获取科目列表失败')
  }
}

// 添加科目
const addSubjectModalVisible = ref(false)
const availableTutorials = ref([])
const filteredTutorials = ref([])
const tutorialSearchKeyword = ref('')
const loadingTutorialsList = ref(false)
const addingSubjectId = ref(null)

const openAddSubjectModal = async () => {
  tutorialSearchKeyword.value = ''
  addSubjectModalVisible.value = true
  await loadAvailableTutorials()
}

const loadAvailableTutorials = async () => {
  loadingTutorialsList.value = true
  try {
    const res = await adminApi.getTutorials({
      noCollection: true,
      page: 1,
      pageSize: 100
    })
    availableTutorials.value = res.data?.list || []
    filteredTutorials.value = [...availableTutorials.value]
  } catch (error) {
    console.error('加载教辅列表失败:', error)
    ElMessage.error('加载教辅列表失败')
  } finally {
    loadingTutorialsList.value = false
  }
}

const refreshTutorials = async () => {
  tutorialSearchKeyword.value = ''
  await loadAvailableTutorials()
}

const filterTutorials = () => {
  const keyword = tutorialSearchKeyword.value.toLowerCase()
  if (!keyword) {
    filteredTutorials.value = [...availableTutorials.value]
    return
  }
  filteredTutorials.value = availableTutorials.value.filter(t => 
    t.name.toLowerCase().includes(keyword) || 
    (t.subject && t.subject.toLowerCase().includes(keyword))
  )
}

const confirmAddSubject = async (row) => {
  addingSubjectId.value = row.id
  try {
    await adminApi.updateTutorial(row.id, {
      collection_id: currentCollection.value.id
    })
    ElMessage.success('添加成功')
    
    const index = availableTutorials.value.findIndex(t => t.id === row.id)
    if (index > -1) {
      availableTutorials.value.splice(index, 1)
      filterTutorials()
    }
    
    await fetchCollectionSubjects(currentCollection.value.id)
    fetchCollections()
  } catch (error) {
    console.error('添加科目失败:', error)
    ElMessage.error('添加科目失败')
  } finally {
    addingSubjectId.value = null
  }
}

const removeSubject = async (row, index) => {
  try {
    await ElMessageBox.confirm('确定要将该教辅从合集中移除吗？', '提示', { type: 'warning' })
    await adminApi.updateTutorial(row.id, {
      collection_id: null
    })
    ElMessage.success('移除成功')
    collectionSubjects.value.splice(index, 1)
    fetchCollections()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('移除科目失败:', error)
      ElMessage.error('移除科目失败')
    }
  }
}

const viewSubjectDetail = (row) => {
  router.push(`/computer/tutorials/${row.id}/chapters`)
}

// 工具函数
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString()
}

// 监听 tab 切换
watch(activeTab, (val) => {
  if (val === 'tutorials') {
    fetchTutorials()
  } else if (val === 'collections') {
    fetchCollections()
  }
})

onMounted(() => {
  fetchTutorials()
})
</script>

<style scoped>
.tutorial-manage {
  padding: 20px;
}

.tab-content {
  padding: 10px 0;
}

.filter-card {
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
}

.mb-20 {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
}

.filter-bar {
  display: flex;
  gap: 10px;
  align-items: center;
}

.mr-5 {
  margin-right: 5px;
}

.mb-5 {
  margin-bottom: 5px;
}

.text-gray {
  color: #909399;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 操作按钮样式 - 不换行 */
.action-buttons {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  gap: 4px;
}

.action-buttons .el-button {
  margin: 0;
  padding: 5px 8px;
  font-size: 12px;
}

.no-cover {
  width: 60px;
  height: 80px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 12px;
}

/* 封面上传样式 */
.cover-uploader {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  width: 120px;
  height: 160px;
}

.cover-uploader:hover {
  border-color: #409eff;
}

.cover-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 120px;
  height: 160px;
  text-align: center;
  line-height: 160px;
}

.cover-image {
  width: 120px;
  height: 160px;
  display: block;
  object-fit: cover;
}

.subjects-manage {
  padding: 10px;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.available-tutorials {
  padding: 10px;
}

.available-tutorials .toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 题目查看弹窗样式 */
:deep(.questions-dialog .el-dialog__body) {
  padding: 0;
}

.questions-container {
  display: flex;
  height: 75vh;
  overflow: hidden;
}

.questions-sidebar {
  width: 300px;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.questions-header {
  padding: 15px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.questions-header span {
  font-weight: bold;
  color: #606266;
}

.questions-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.question-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  margin-bottom: 8px;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid transparent;
}

.question-item:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.question-item.active {
  background: #ecf5ff;
  border-color: #409eff;
}

.question-number {
  width: 28px;
  height: 28px;
  background: #409eff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

.question-preview {
  flex: 1;
  font-size: 13px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.question-type {
  font-size: 11px;
  color: #909399;
  background: #f0f2f5;
  padding: 2px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}

.question-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #e4e7ed;
  background: white;
}

.question-nav {
  display: flex;
  align-items: center;
  gap: 15px;
}

.question-counter {
  font-weight: bold;
  color: #606266;
}

.question-actions {
  display: flex;
  gap: 10px;
}

.question-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: white;
}

.info-row {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.content-section {
  margin-bottom: 15px;
}

.content-section h4 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 13px;
  border-left: 3px solid #409eff;
  padding-left: 8px;
  line-height: 1.4;
}

.content-text {
  line-height: 1.6;
  color: #606266;
  background: #f5f7fa;
  padding: 10px 12px;
  border-radius: 4px;
  font-size: 14px;
}

.content-text :deep(p) {
  margin: 0 0 8px 0;
}

.content-text :deep(p:last-child) {
  margin-bottom: 0;
}

/* 富文本公式样式 */
.content-text :deep(.katex) {
  font-size: 1em;
}

.content-text :deep(img) {
  max-width: 100%;
  height: auto;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  line-height: 1.5;
}

.option-key {
  font-weight: bold;
  color: #409eff;
  min-width: 20px;
  flex-shrink: 0;
}

.option-value {
  flex: 1;
  color: #606266;
}

.option-value :deep(p) {
  margin: 0;
}

.sub-item {
  margin-bottom: 10px;
  padding: 10px 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.sub-title {
  font-weight: bold;
  color: #409eff;
  margin-bottom: 6px;
  font-size: 13px;
}

.sub-stem {
  margin-bottom: 6px;
  color: #606266;
  line-height: 1.5;
}

.sub-stem :deep(p) {
  margin: 0;
}

.sub-answer {
  color: #67c23a;
  line-height: 1.5;
}

.sub-answer :deep(p) {
  margin: 0;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 题目编辑样式 */
.options-edit {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-edit-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.option-edit-item .el-input[type="textarea"] {
  flex: 1;
}

/* 富文本编辑器样式 */
.editor-wrapper {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.option-editor-wrapper {
  flex: 1;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.options-edit {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-edit-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

/* AI 格式化工具栏 */
.editor-toolbar-actions {
  display: flex;
  justify-content: flex-end;
  padding: 8px;
  background: #f5f7fa;
  border-bottom: 1px solid #dcdfe6;
}

/* AI 格式化弹窗样式 */
.ai-fix-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ai-fix-section {
  flex: 1;
}

.ai-fix-section h4 {
  margin: 0 0 10px 0;
  color: #303133;
  font-size: 14px;
}

.ai-fix-arrow {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px 0;
}

@media (min-width: 768px) {
  .ai-fix-container {
    flex-direction: row;
    align-items: stretch;
  }
  
  .ai-fix-arrow {
    flex-direction: column;
    padding: 0 20px;
  }
}

/* 教辅详情样式 */
.tutorial-info-form {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 15px;
  background: #fafafa;
}

.tutorial-info-form .info-row {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.tutorial-info-form .info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.tutorial-info-form .info-item .el-input {
  width: 300px;
}

.tutorial-info-form .info-item.small {
  flex: 0 0 auto;
}

.tutorial-info-form .info-item.small .el-input {
  width: 80px;
}

.tutorial-info-form .info-item.small .el-select {
  width: 100px;
}

.tutorial-info-form .info-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
  white-space: nowrap;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.flex-end {
  display: flex;
  justify-content: flex-end;
}

.tutorial-detail .questions-list {
  max-height: calc(100vh - 350px);
  overflow-y: auto;
}

.tutorial-detail .question-item {
  display: block;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
  background: #f5f7fa;
  cursor: default;
}

.tutorial-detail .question-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed #dcdfe6;
}

.tutorial-detail .question-index {
  font-weight: bold;
  color: #409eff;
  font-size: 16px;
}

.tutorial-detail .question-type {
  font-size: 12px;
  color: #909399;
  background: #e9e9eb;
  padding: 2px 8px;
  border-radius: 4px;
}

.tutorial-detail .question-content {
  padding: 0;
  background: transparent;
}

.tutorial-detail .question-options {
  margin: 10px 0;
  padding: 10px;
  background: white;
  border-radius: 4px;
}

.tutorial-detail .option-item-inline {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  line-height: 1.5;
}

.tutorial-detail .option-label {
  font-weight: bold;
  color: #409eff;
  min-width: 20px;
}

.tutorial-detail .question-subs {
  margin: 10px 0;
  padding: 10px;
  background: white;
  border-radius: 4px;
}

.tutorial-detail .sub-item {
  margin-bottom: 10px;
  padding: 10px;
  background: #f0f2f5;
  border-radius: 4px;
}

.tutorial-detail .sub-header {
  font-weight: bold;
  color: #409eff;
  margin-bottom: 6px;
}

.tutorial-detail .question-answer {
  margin-top: 10px;
  padding: 10px;
  background: #f0f9eb;
  border-radius: 4px;
  color: #67c23a;
}

.tutorial-detail .question-analysis {
  margin-top: 10px;
  padding: 10px;
  background: #fdf6ec;
  border-radius: 4px;
  color: #e6a23c;
}

.tutorial-detail .math-content :deep(p) {
  margin: 0 0 8px 0;
}

.tutorial-detail .math-content :deep(img) {
  max-width: 100%;
  height: auto;
}

/* 高亮样式 */
.tutorial-detail .question-item.highlighted {
  border: 2px solid #409eff;
  background: #ecf5ff;
  box-shadow: 0 0 10px rgba(64, 158, 255, 0.3);
  animation: highlight-pulse 2s ease-in-out;
}

@keyframes highlight-pulse {
  0%, 100% {
    box-shadow: 0 0 10px rgba(64, 158, 255, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(64, 158, 255, 0.6);
  }
}

/* 保留换行符 */
.tutorial-detail .math-content {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
