<template>
  <div class="online-exam-manage">
    <el-tabs v-model="activeTab" type="border-card">
      <!-- 考试列表 -->
      <el-tab-pane label="考试管理" name="exams">
        <div class="filter-bar mb-20">
          <el-button type="primary" @click="openCreateExamModal">+ 创建在线考试</el-button>
          <el-button class="ml-10" @click="fetchExams">刷新</el-button>
          <el-radio-group v-model="examFilter.status" @change="fetchExams" class="ml-20">
            <el-radio-button label="">全部</el-radio-button>
            <el-radio-button label="ongoing">进行中</el-radio-button>
            <el-radio-button label="upcoming">即将开始</el-radio-button>
            <el-radio-button label="completed">已结束</el-radio-button>
          </el-radio-group>
        </div>

        <el-table :data="exams" v-loading="loadingExams" border stripe>
          <el-table-column prop="id" label="ID" width="80" align="center" />
          <el-table-column prop="title" label="考试名称" min-width="200" show-overflow-tooltip />
          <el-table-column prop="paper_type_name" label="试卷类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getPaperTypeTagType(row.paper_type)">
                {{ row.paper_type_name }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="start_time" label="开始时间" width="160" align="center">
            <template #default="{ row }">
              {{ formatDateTime(row.start_time) }}
            </template>
          </el-table-column>
          <el-table-column prop="end_time" label="结束时间" width="160" align="center">
            <template #default="{ row }">
              {{ formatDateTime(row.end_time) }}
            </template>
          </el-table-column>
          <el-table-column prop="duration" label="时长" width="80" align="center">
            <template #default="{ row }">
              {{ row.duration }}分钟
            </template>
          </el-table-column>
          <el-table-column prop="participant_count" label="参与人数" width="100" align="center" />
          <el-table-column label="发布状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.is_published ? 'success' : 'info'">
                {{ row.is_published ? '已发布' : '未发布' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="考试状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getExamStatusType(row.examStatus)">
                {{ getExamStatusText(row.examStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="320" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="viewExamDetail(row)">详情/统计</el-button>
              <el-button size="small" @click="editExam(row)">编辑</el-button>
              <el-button 
                size="small" 
                :type="row.is_published ? 'warning' : 'success'"
                @click="togglePublish(row)"
              >
                {{ row.is_published ? '取消发布' : '发布' }}
              </el-button>
              <el-button size="small" type="danger" @click="deleteExam(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-container mt-20">
          <el-pagination
            v-model:current-page="examFilter.page"
            v-model:page-size="examFilter.pageSize"
            :total="examTotal"
            layout="total, prev, pager, next"
            @current-change="fetchExams"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 创建/编辑考试对话框 -->
    <el-dialog
      v-model="examModalVisible"
      :title="isEditing ? '编辑考试' : '创建在线考试'"
      width="800px"
      destroy-on-close
    >
      <el-form :model="examForm" :rules="examRules" ref="examFormRef" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="考试名称" prop="title">
              <el-input v-model="examForm.title" placeholder="请输入考试名称" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="考试描述">
              <el-input v-model="examForm.description" type="textarea" :rows="2" placeholder="请输入考试描述" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="试卷类型" prop="paperType">
              <el-select v-model="examForm.paperType" placeholder="选择试卷类型" style="width: 100%" @change="onPaperTypeChange">
                <el-option label="真题卷" :value="1" />
                <el-option label="模拟题卷" :value="2" />
                <el-option label="组卷（从题库抽题）" :value="3" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="examForm.paperType === 1 || examForm.paperType === 2">
            <el-form-item label="来源试卷" prop="sourcePaperId">
              <el-select 
                v-model="examForm.sourcePaperId" 
                placeholder="选择来源试卷" 
                style="width: 100%"
                filterable
                :loading="loadingPapers"
                @focus="fetchPapers"
                @change="onSourcePaperChange"
              >
                <el-option 
                  v-for="p in papers" 
                  :key="p.id" 
                  :label="`${p.year || ''} ${p.from_school || ''} ${p.name || p.exam_full_name || p.paper_name || p.title || '未命名试卷'}`" 
                  :value="String(p.id)" 
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 组卷选择题目 -->
        <el-row :gutter="20" v-if="examForm.paperType === 3">
          <el-col :span="24">
            <el-form-item label="选择题目" prop="questionIds">
              <div class="question-select-header">
                <el-input 
                  v-model="questionSearchKeyword" 
                  placeholder="搜索题目..." 
                  style="width: 300px"
                  @keyup.enter="searchQuestionsForExam"
                >
                  <template #append>
                    <el-button @click="searchQuestionsForExam">
                      <el-icon><Search /></el-icon>
                    </el-button>
                  </template>
                </el-input>
                <el-button type="primary" class="ml-10" @click="openQuestionSelector">选择题目</el-button>
                <span class="ml-10">已选择 {{ examForm.questionIds.length }} 题</span>
              </div>
              <div class="selected-questions-preview" v-if="selectedQuestions.length > 0">
                <el-table :data="selectedQuestions" size="small" border max-height="300">
                  <el-table-column type="index" label="序号" width="60" align="center" />
                  <el-table-column prop="exercise_type_name" label="题型" width="100" />
                  <el-table-column prop="stem" label="题干" show-overflow-tooltip>
                    <template #default="{ row }">
                      <div v-html="stripHtml(row.stem)"></div>
                    </template>
                  </el-table-column>
                  <el-table-column label="分值" width="120" align="center">
                    <template #default="{ row, $index }">
                      <el-input-number v-model="row.score" :min="0" :max="100" :precision="1" size="small" style="width: 90px" />
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="80" align="center" fixed="right">
                    <template #default="{ $index }">
                      <el-button size="small" type="danger" link @click="removeSelectedQuestion($index)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <div class="total-score">
                  总分：{{ calculateTotalScore() }} 分
                </div>
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="开始时间" prop="startTime">
              <el-date-picker
                v-model="examForm.startTime"
                type="datetime"
                placeholder="选择开始时间"
                style="width: 100%"
                value-format="YYYY-MM-DD HH:mm:ss"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间" prop="endTime">
              <el-date-picker
                v-model="examForm.endTime"
                type="datetime"
                placeholder="选择结束时间"
                style="width: 100%"
                value-format="YYYY-MM-DD HH:mm:ss"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="考试时长" prop="duration">
              <el-input-number v-model="examForm.duration" :min="1" :max="300" style="width: 100%">
                <template #append>分钟</template>
              </el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="及格分数" prop="passScore">
              <el-input-number v-model="examForm.passScore" :min="0" :max="examForm.totalScore || 100" :precision="1" style="width: 100%">
                <template #append>分</template>
              </el-input-number>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="总分" prop="totalScore">
              <el-input-number v-model="examForm.totalScore" :min="1" :max="1000" :precision="1" style="width: 100%">
                <template #append>分</template>
              </el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否限时">
              <el-switch v-model="examForm.isLimitedTime" :active-value="1" :inactive-value="0" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="立即显示结果">
              <el-switch v-model="examForm.showResultImmediately" :active-value="1" :inactive-value="0" />
              <div class="form-tip">交卷后立即显示成绩</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="允许查看解析">
              <el-switch v-model="examForm.allowReview" :active-value="1" :inactive-value="0" />
              <div class="form-tip">考试结束后允许查看答案解析</div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="examModalVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitExam">确定</el-button>
      </template>
    </el-dialog>

    <!-- 题目选择器对话框 -->
    <el-dialog v-model="questionSelectorVisible" title="选择题目" width="900px" destroy-on-close>
      <div class="question-selector">
        <div class="filter-bar mb-20">
          <el-row :gutter="10">
            <el-col :span="8">
              <el-input v-model="selectorFilter.keyword" placeholder="搜索题目内容..." clearable @keyup.enter="fetchSelectorQuestions">
                <template #append>
                  <el-button @click="fetchSelectorQuestions">
                    <el-icon><Search /></el-icon>
                  </el-button>
                </template>
              </el-input>
            </el-col>
            <el-col :span="6">
              <el-select v-model="selectorFilter.type" placeholder="题型" clearable @change="fetchSelectorQuestions" style="width: 100%">
                <el-option label="单选题" value="单选题" />
                <el-option label="多选题" value="多选题" />
                <el-option label="填空题" value="填空题" />
                <el-option label="解答题" value="解答题" />
                <el-option label="判断题" value="判断题" />
              </el-select>
            </el-col>
            <el-col :span="6">
              <el-select v-model="selectorFilter.chapterId" placeholder="章节" clearable @change="fetchSelectorQuestions" style="width: 100%">
                <el-option v-for="c in chapters" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </el-col>
            <el-col :span="4">
              <el-button type="primary" @click="confirmQuestionSelection">确认选择</el-button>
            </el-col>
          </el-row>
        </div>

        <el-table 
          :data="selectorQuestions" 
          v-loading="loadingSelectorQuestions" 
          border 
          stripe
          @selection-change="handleSelectorSelectionChange"
          height="400"
        >
          <el-table-column type="selection" width="55" align="center" />
          <el-table-column prop="question_id" label="ID" width="150" />
          <el-table-column prop="exercise_type_name" label="题型" width="100" align="center" />
          <el-table-column prop="stem" label="题干" min-width="300" show-overflow-tooltip>
            <template #default="{ row }">
              <div v-html="stripHtml(row.stem)"></div>
            </template>
          </el-table-column>
          <el-table-column prop="chapter_name" label="章节" width="150" />
        </el-table>

        <div class="pagination-container mt-20">
          <el-pagination
            v-model:current-page="selectorFilter.page"
            v-model:page-size="selectorFilter.pageSize"
            :total="selectorTotal"
            layout="total, prev, pager, next"
            @current-change="fetchSelectorQuestions"
          />
        </div>
      </div>
    </el-dialog>

    <!-- 考试详情对话框 -->
    <el-dialog v-model="examDetailVisible" title="考试详情/统计" width="1200px" destroy-on-close class="statistics-dialog">
      <el-tabs v-model="detailActiveTab" v-if="currentExam" @tab-change="onDetailTabChange">
        <el-tab-pane label="统计分析" name="statistics">
          <div v-if="currentExam" class="exam-basic-info mb-20">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="考试名称">{{ currentExam.title }}</el-descriptions-item>
              <el-descriptions-item label="试卷类型">
                <el-tag :type="getPaperTypeTagType(currentExam.paper_type)">
                  {{ currentExam.paper_type_name }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="开始时间">{{ formatDateTime(currentExam.start_time) }}</el-descriptions-item>
              <el-descriptions-item label="结束时间">{{ formatDateTime(currentExam.end_time) }}</el-descriptions-item>
              <el-descriptions-item label="考试时长">{{ currentExam.duration }} 分钟</el-descriptions-item>
              <el-descriptions-item label="总分">{{ currentExam.total_score }} 分</el-descriptions-item>
              <el-descriptions-item label="及格分数">{{ currentExam.pass_score }} 分</el-descriptions-item>
              <el-descriptions-item label="参与人数">{{ currentExam.participant_count || 0 }} 人</el-descriptions-item>
            </el-descriptions>
          </div>
          <div v-if="examStatistics" class="exam-statistics">
            <!-- 总体统计卡片 -->
            <el-row :gutter="20" class="statistics-overview">
              <el-col :span="4">
                <div class="stat-card primary">
                  <div class="stat-icon"><el-icon><User /></el-icon></div>
                  <div class="stat-content">
                    <div class="stat-value">{{ examStatistics.total_participants || 0 }}</div>
                    <div class="stat-label">参与人数</div>
                  </div>
                </div>
              </el-col>
              <el-col :span="4">
                <div class="stat-card success">
                  <div class="stat-icon"><el-icon><CircleCheck /></el-icon></div>
                  <div class="stat-content">
                    <div class="stat-value">{{ examStatistics.graded_count || 0 }}</div>
                    <div class="stat-label">已阅卷</div>
                  </div>
                </div>
              </el-col>
              <el-col :span="4">
                <div class="stat-card warning">
                  <div class="stat-icon"><el-icon><TrendCharts /></el-icon></div>
                  <div class="stat-content">
                    <div class="stat-value">{{ examStatistics.average_score ? Number(examStatistics.average_score).toFixed(1) : 0 }}</div>
                    <div class="stat-label">平均分</div>
                  </div>
                </div>
              </el-col>
              <el-col :span="4">
                <div class="stat-card danger">
                  <div class="stat-icon"><el-icon><Top /></el-icon></div>
                  <div class="stat-content">
                    <div class="stat-value">{{ examStatistics.highest_score || 0 }}</div>
                    <div class="stat-label">最高分</div>
                  </div>
                </div>
              </el-col>
              <el-col :span="4">
                <div class="stat-card info">
                  <div class="stat-icon"><el-icon><Bottom /></el-icon></div>
                  <div class="stat-content">
                    <div class="stat-value">{{ examStatistics.lowest_score || 0 }}</div>
                    <div class="stat-label">最低分</div>
                  </div>
                </div>
              </el-col>
              <el-col :span="4">
                <div class="stat-card" :class="examStatistics.pass_rate >= 60 ? 'success' : 'danger'">
                  <div class="stat-icon"><el-icon><Warning /></el-icon></div>
                  <div class="stat-content">
                    <div class="stat-value">{{ examStatistics.pass_rate ? Number(examStatistics.pass_rate).toFixed(1) : 0 }}%</div>
                    <div class="stat-label">及格率</div>
                  </div>
                </div>
              </el-col>
            </el-row>

            <!-- 分数段分布 -->
            <el-row :gutter="20" class="mt-20">
              <el-col :span="12">
                <el-card shadow="never">
                  <template #header>
                    <div class="card-header">
                      <span>分数段分布</span>
                      <el-tag size="small" type="info">共 {{ examStatistics.total_participants || 0 }} 人</el-tag>
                    </div>
                  </template>
                  <div ref="scoreChartRef" style="height: 300px;"></div>
                </el-card>
              </el-col>
              <el-col :span="12">
                <el-card shadow="never">
                  <template #header>
                    <div class="card-header">
                      <span>题型分布</span>
                    </div>
                  </template>
                  <div ref="questionTypeChartRef" style="height: 300px;"></div>
                </el-card>
              </el-col>
            </el-row>

            <!-- 及格情况分布 -->
            <el-row :gutter="20" class="mt-20">
              <el-col :span="12">
                <el-card shadow="never">
                  <template #header>
                    <div class="card-header">
                      <span>及格情况分布</span>
                    </div>
                  </template>
                  <div ref="passChartRef" style="height: 300px;"></div>
                </el-card>
              </el-col>
              <el-col :span="12" v-if="examStatistics.score_trend && examStatistics.score_trend.length > 0">
                <el-card shadow="never">
                  <template #header>
                    <div class="card-header">
                      <span>分数趋势</span>
                    </div>
                  </template>
                  <div ref="trendChartRef" style="height: 300px;"></div>
                </el-card>
              </el-col>
            </el-row>

            <!-- 题型统计表格 -->
            <el-card class="mt-20" shadow="never">
              <template #header>
                <div class="card-header">
                  <span>题型得分统计</span>
                </div>
              </template>
              <el-table :data="examStatistics.question_type_stats || []" border stripe>
                <el-table-column prop="type_name" label="题型" width="120" />
                <el-table-column prop="question_count" label="题目数量" width="100" align="center" />
                <el-table-column prop="total_score" label="总分值" width="100" align="center" />
                <el-table-column prop="average_score" label="平均得分" width="100" align="center">
                  <template #default="{ row }">
                    {{ row.average_score ? Number(row.average_score).toFixed(2) : 0 }}
                  </template>
                </el-table-column>
                <el-table-column prop="correct_rate" label="平均正确率" width="100" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.correct_rate >= 60 ? 'success' : row.correct_rate >= 40 ? 'warning' : 'danger'" size="small">
                      {{ row.correct_rate ? Number(row.correct_rate).toFixed(1) : 0 }}%
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>

            <!-- 各题型错误率最高题目 -->
            <el-card class="mt-20" shadow="never">
              <template #header>
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <span>各题型错误率最高题目</span>
                    <el-tag size="small" type="danger" class="ml-10">需重点关注</el-tag>
                  </div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 12px; color: #666;">每题型显示数量:</span>
                    <el-input-number v-model="hardestQuestionsCount" :min="1" :max="20" size="small" style="width: 100px;" />
                  </div>
                </div>
              </template>
              <el-table :data="getHardestQuestionsByType" border stripe max-height="400">
                <el-table-column label="题号" width="80" align="center">
                  <template #default="{ row }">
                    <el-tag type="info" size="small">{{ row.sort_order || '-' }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="题型" width="100">
                  <template #default="{ row }">
                    <span v-if="parseInt(row.exercise_type) === 1" style="color: #409eff;">单选题</span>
                    <span v-else-if="parseInt(row.exercise_type) === 2" style="color: #67c23a;">多选题</span>
                    <span v-else-if="parseInt(row.exercise_type) === 3" style="color: #e6a23c;">判断题</span>
                    <span v-else-if="parseInt(row.exercise_type) === 4" style="color: #f56c6c;">解答题</span>
                    <span v-else>{{ row.exercise_type_name || row.question_type || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="stem" label="题干" min-width="250" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div v-html="stripHtml(row.stem)"></div>
                  </template>
                </el-table-column>
                <el-table-column label="考点/知识点" min-width="180" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div v-if="Array.isArray(row.knowledge_points) && filterValidKnowledgePoints(row.knowledge_points).length > 0">
                      <el-tag v-for="(kp, index) in filterValidKnowledgePoints(row.knowledge_points).slice(0, 3)" :key="index" size="small" class="mr-5" type="info">
                        {{ kp }}
                      </el-tag>
                      <el-tag v-if="filterValidKnowledgePoints(row.knowledge_points).length > 3" size="small" type="info">+{{ filterValidKnowledgePoints(row.knowledge_points).length - 3 }}</el-tag>
                    </div>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="question_score" label="分值" width="80" align="center" />
                <el-table-column prop="total_attempts" label="答题次数" width="100" align="center" />
                <el-table-column label="错误率" width="100" align="center">
                  <template #default="{ row }">
                    <el-tag type="danger" size="small">
                      {{ (100 - parseFloat(row.correct_rate || 0)).toFixed(1) }}%
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="wrong_count" label="错误人数" width="100" align="center" />
              </el-table>
            </el-card>

            <!-- 每题作答分析 -->
            <el-card class="mt-20" shadow="never">
              <template #header>
                <div class="card-header">
                  <span>每题作答分析</span>
                </div>
              </template>
              <el-table :data="questionAnalysis" border stripe max-height="500">
                <el-table-column label="题号" width="60" align="center">
                  <template #default="{ row }">
                    <el-tag type="info" size="small">{{ row.sort_order || '-' }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="题型" width="100">
                  <template #default="{ row }">
                    <span v-if="row.exercise_type == 1" style="color: #409eff;">单选题</span>
                    <span v-else-if="row.exercise_type == 2" style="color: #67c23a;">多选题</span>
                    <span v-else-if="row.exercise_type == 3" style="color: #e6a23c;">判断题</span>
                    <span v-else-if="row.exercise_type == 4" style="color: #f56c6c;">解答题</span>
                    <span v-else>{{ row.exercise_type_name || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="stem" label="题干" min-width="250" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div v-html="stripHtml(row.stem)"></div>
                  </template>
                </el-table-column>
                <el-table-column label="考点/知识点" min-width="150" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div v-if="Array.isArray(row.knowledge_points) && filterValidKnowledgePoints(row.knowledge_points).length > 0">
                      <el-tag v-for="(kp, index) in filterValidKnowledgePoints(row.knowledge_points).slice(0, 2)" :key="index" size="small" class="mr-5" type="info">
                        {{ kp }}
                      </el-tag>
                      <el-tag v-if="filterValidKnowledgePoints(row.knowledge_points).length > 2" size="small" type="info">+{{ filterValidKnowledgePoints(row.knowledge_points).length - 2 }}</el-tag>
                    </div>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="question_score" label="满分" width="80" align="center" />
                <el-table-column prop="total_attempts" label="答题次数" width="100" align="center" />
                <el-table-column prop="correct_count" label="正确人数" width="100" align="center" />
                <el-table-column label="正确率" width="120" align="center">
                  <template #default="{ row }">
                    <el-progress 
                      :percentage="parseFloat(row.correct_rate || 0)" 
                      :status="parseFloat(row.correct_rate) < 50 ? 'exception' : 'success'"
                    />
                  </template>
                </el-table-column>
                <el-table-column prop="average_score" label="平均得分" width="100" align="center">
                  <template #default="{ row }">
                    {{ row.average_score ? parseFloat(row.average_score).toFixed(1) : 0 }}
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="100" align="center" fixed="right">
                  <template #default="{ row }">
                    <el-button size="small" type="primary" @click="viewQuestionDetail(row)">详情</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </div>
        </el-tab-pane>

        <el-tab-pane label="考试记录" name="records">
          <div v-if="examRecords.length > 0">
            <el-table :data="examRecords" border stripe v-loading="recordsLoading">
              <el-table-column type="index" label="序号" width="60" align="center" />
              <el-table-column prop="username" label="用户名" width="120" />
              <el-table-column prop="nickname" label="昵称" width="120" />
              <el-table-column prop="start_time" label="开始时间" width="160">
                <template #default="{ row }">
                  {{ formatDateTime(row.start_time) }}
                </template>
              </el-table-column>
              <el-table-column prop="submit_time" label="提交时间" width="160">
                <template #default="{ row }">
                  {{ row.submit_time ? formatDateTime(row.submit_time) : '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="duration" label="用时" width="100" align="center">
                <template #default="{ row }">
                  {{ row.duration ? Math.floor(row.duration / 60) + '分' + (row.duration % 60) + '秒' : '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="objective_score" label="客观题" width="90" align="center" />
              <el-table-column prop="subjective_score" label="主观题" width="90" align="center">
                <template #default="{ row }">
                  {{ row.subjective_score !== null ? row.subjective_score : '待评' }}
                </template>
              </el-table-column>
              <el-table-column prop="total_score" label="总分" width="90" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.total_score >= (row.pass_score || currentExam?.pass_score) ? 'success' : 'danger'" size="small">
                    {{ row.total_score }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="is_graded" label="阅卷状态" width="100" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.is_graded ? 'success' : 'warning'" size="small">
                    {{ row.is_graded ? '已阅卷' : '待阅卷' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
            <div class="pagination-container mt-20">
              <el-pagination
                v-model:current-page="recordsFilter.page"
                v-model:page-size="recordsFilter.pageSize"
                :total="recordsTotal"
                layout="total, prev, pager, next"
                @current-change="fetchExamRecords"
              />
            </div>
          </div>
          <el-empty v-else description="暂无考试记录" />
        </el-tab-pane>

        <el-tab-pane label="解答题批改" name="grading">
          <div v-if="pendingQuestions.length > 0">
            <el-alert
              :title="`还有 ${pendingQuestions.length} 道解答题待批改`"
              type="warning"
              :closable="false"
              class="mb-20"
            />
            <el-card v-for="(question, index) in pendingQuestions" :key="question.answer_id" class="grading-item mb-20">
              <template #header>
                <div class="grading-header">
                  <span>第 {{ index + 1 }} 题 / 共 {{ pendingQuestions.length }} 题</span>
                  <span>考生：{{ question.nickname || question.username }}</span>
                  <el-tag type="info">满分：{{ question.question_score }} 分</el-tag>
                </div>
              </template>
              <div class="question-content mb-20">
                <h4>题目：</h4>
                <div class="question-stem" v-html="question.stem"></div>
                <!-- 小题列表 -->
                <div v-if="question.subs && question.subs.length > 0" class="subs-section">
                  <h5>小题列表：</h5>
                  <div v-for="(sub, subIndex) in question.subs" :key="sub.sub_id || sub.id || subIndex" class="sub-item">
                    <div class="sub-header">
                      <span class="sub-index">({{ subIndex + 1 }})</span>
                      <span class="sub-score" v-if="sub.score">[{{ sub.score }}分]</span>
                    </div>
                    <div class="sub-stem" v-html="sub.stem"></div>
                    <div v-if="sub.answer" class="sub-answer">
                      <span class="sub-answer-label">参考答案：</span>
                      <span v-html="sub.answer"></span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="answer-content mb-20">
                <h4>考生答案：</h4>
                <div class="user-answer" v-html="question.user_answer || '未作答'"></div>
              </div>
              <div class="correct-answer mb-20" v-if="question.correct_answer">
                <h4>参考答案：</h4>
                <div class="reference-answer" v-html="question.correct_answer"></div>
              </div>
              <div class="grading-form">
                <el-form :model="gradingForm[question.answer_id]" label-width="80px">
                  <el-form-item label="得分">
                    <el-slider
                      v-model="gradingForm[question.answer_id].score"
                      :max="parseFloat(question.question_score)"
                      :step="0.5"
                      show-stops
                      show-input
                    />
                  </el-form-item>
                  <el-form-item label="评语">
                    <el-input
                      v-model="gradingForm[question.answer_id].comment"
                      type="textarea"
                      :rows="2"
                      placeholder="请输入评语（可选）"
                    />
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="submitGrade(question)">提交评分</el-button>
                    <el-button @click="skipQuestion(question)">跳过</el-button>
                  </el-form-item>
                </el-form>
              </div>
            </el-card>
          </div>
          <el-empty v-else description="暂无待批改的解答题" />
        </el-tab-pane>
      </el-tabs>
    </el-dialog>



    <!-- 题目详细分析对话框 -->
    <el-dialog v-model="questionDetailVisible" title="题目详情" width="900px" destroy-on-close>
      <div v-if="currentQuestionAnalysis" class="question-detail-analysis">
        <!-- 考试信息 -->
        <div class="exam-info-section" style="margin-bottom: 12px;">
          <el-descriptions :column="4" size="small" border>
            <el-descriptions-item label="题号">{{ currentQuestionAnalysis.sort_order }}</el-descriptions-item>
            <el-descriptions-item label="题型">
              <span v-if="parseInt(currentQuestionAnalysis.exercise_type) === 1" style="color: #409eff;">单选题</span>
              <span v-else-if="parseInt(currentQuestionAnalysis.exercise_type) === 2" style="color: #67c23a;">多选题</span>
              <span v-else-if="parseInt(currentQuestionAnalysis.exercise_type) === 3" style="color: #e6a23c;">判断题</span>
              <span v-else-if="parseInt(currentQuestionAnalysis.exercise_type) === 4" style="color: #f56c6c;">解答题</span>
              <span v-else>{{ currentQuestionAnalysis.exercise_type_name || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="分值">{{ currentQuestionAnalysis.question_score }}分</el-descriptions-item>
            <el-descriptions-item label="难度">
              <el-tag v-if="currentQuestionAnalysis.difficulty === 1" type="success" size="small">简单</el-tag>
              <el-tag v-else-if="currentQuestionAnalysis.difficulty === 2" type="warning" size="small">中等</el-tag>
              <el-tag v-else-if="currentQuestionAnalysis.difficulty === 3" type="danger" size="small">困难</el-tag>
              <span v-else>-</span>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 题目内容 -->
        <div class="question-content-section" style="margin-bottom: 8px;">
          <div class="section-title" style="font-weight: bold; margin-bottom: 4px; color: #303133;">题目内容</div>
          <div class="question-stem" style="padding: 8px; background: #f5f7fa; border-radius: 4px; line-height: 1.5;" v-html="renderMath(currentQuestionAnalysis.stem)"></div>
          
          <!-- 选项（选择题） -->
          <div v-if="currentQuestionAnalysis.options && currentQuestionAnalysis.options !== '{}'" class="options-list" style="margin-top: 10px;">
            <div v-for="(value, key) in JSON.parse(currentQuestionAnalysis.options)" :key="key" class="option-item" style="padding: 4px 0; line-height: 1.5;">
              <span style="font-weight: bold; margin-right: 6px;">{{ key }}.</span>
              <span class="option-content" v-html="renderMath(value)"></span>
            </div>
          </div>
        </div>

        <!-- 考点和统计信息合并 -->
        <div class="knowledge-stats-section" style="margin-bottom: 12px;">
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="考点/知识点">
              <div v-if="currentQuestionAnalysis.knowledge_points && filterValidKnowledgePoints(currentQuestionAnalysis.knowledge_points).length > 0" class="knowledge-tags">
                <el-tag v-for="(kp, index) in filterValidKnowledgePoints(currentQuestionAnalysis.knowledge_points)" :key="index" size="small" class="mr-5" type="info" effect="plain">
                  {{ kp }}
                </el-tag>
              </div>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="正确率">
              <el-tag :type="parseFloat(currentQuestionAnalysis.correct_rate) >= 60 ? 'success' : 'danger'" size="small">
                {{ currentQuestionAnalysis.correct_rate }}%
              </el-tag>
              <span style="margin-left: 10px; color: #909399; font-size: 12px;">
                ({{ currentQuestionAnalysis.correct_count }}/{{ currentQuestionAnalysis.total_attempts }})
              </span>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 答题统计 -->
        <div class="statistics-section" style="margin-bottom: 12px;">
          <el-descriptions :column="4" size="small" border>
            <el-descriptions-item label="答题次数">{{ currentQuestionAnalysis.total_attempts }}</el-descriptions-item>
            <el-descriptions-item label="正确人数">{{ currentQuestionAnalysis.correct_count }}</el-descriptions-item>
            <el-descriptions-item label="错误人数">{{ currentQuestionAnalysis.wrong_count }}</el-descriptions-item>
            <el-descriptions-item label="未答人数">{{ currentQuestionAnalysis.unanswered_count }}</el-descriptions-item>
            <el-descriptions-item label="平均得分">{{ currentQuestionAnalysis.average_score }}</el-descriptions-item>
            <el-descriptions-item label="最高得分">{{ currentQuestionAnalysis.max_score }}</el-descriptions-item>
            <el-descriptions-item label="最低得分">{{ currentQuestionAnalysis.min_score }}</el-descriptions-item>
            <el-descriptions-item label="方差">{{ currentQuestionAnalysis.variance || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 选项分布（选择题） -->
        <div v-if="currentQuestionAnalysis.option_distribution && Object.keys(currentQuestionAnalysis.option_distribution).length > 0" class="option-distribution-section" style="margin-bottom: 12px;">
          <div class="section-title" style="font-weight: bold; margin-bottom: 6px; color: #303133; font-size: 13px;">选项分布</div>
          <el-table :data="parseOptionDistribution(currentQuestionAnalysis.option_distribution)" border stripe size="small">
            <el-table-column prop="option" label="选项" width="60" align="center" />
            <el-table-column prop="count" label="选择人数" width="90" align="center" />
            <el-table-column label="占比" min-width="120">
              <template #default="{ row }">
                <el-progress :percentage="row.percentage" :status="row.percentage < 30 ? 'exception' : 'success'" />
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 常见错误答案 -->
        <div v-if="currentQuestionAnalysis.common_wrong_answers && Object.keys(currentQuestionAnalysis.common_wrong_answers).length > 0" class="wrong-answers-section" style="margin-bottom: 12px;">
          <div class="section-title" style="font-weight: bold; margin-bottom: 6px; color: #303133; font-size: 13px;">常见错误答案</div>
          <el-table :data="parseCommonWrongAnswers(currentQuestionAnalysis.common_wrong_answers)" border stripe size="small">
            <el-table-column prop="answer" label="错误答案" width="100" />
            <el-table-column prop="count" label="错误次数" width="90" align="center" />
          </el-table>
        </div>

        <!-- 正确答案（非解答题或解答题无小题时显示） -->
        <div v-if="currentQuestionAnalysis.correct_answer && (!currentQuestionAnalysis.subs || currentQuestionAnalysis.subs.length === 0)" class="correct-answer-section" style="margin-bottom: 12px;">
          <div class="section-title" style="font-weight: bold; margin-bottom: 6px; color: #303133; font-size: 13px;">正确答案</div>
          <div class="math-content" style="padding: 10px; background: #f0f9ff; border: 1px solid #b3d8ff; border-radius: 4px; color: #409eff; font-weight: bold; display: inline-block; min-width: 100px;" v-html="renderMath(currentQuestionAnalysis.correct_answer)"></div>
        </div>

        <!-- 解答题小题 -->
        <div v-if="currentQuestionAnalysis.subs && currentQuestionAnalysis.subs.length > 0" class="sub-questions-section" style="margin-bottom: 12px;">
          <div class="section-title" style="font-weight: bold; margin-bottom: 6px; color: #303133; font-size: 13px;">小题列表</div>
          <div v-for="(sub, index) in currentQuestionAnalysis.subs" :key="index" class="sub-question-item" style="margin-bottom: 8px; padding: 10px; background: #f5f7fa; border-radius: 4px;">
            <div style="font-weight: bold; margin-bottom: 4px; color: #606266;">小题 {{ sub.question_order || (index + 1) }}</div>
            <div class="math-content" style="line-height: 1.5;" v-html="renderMath(sub.stem)"></div>
            <div v-if="sub.answer" style="margin-top: 6px; padding: 6px; background: #e6f7ff; border-radius: 3px; color: #1890ff;">
              <span style="font-weight: bold;">答案：</span>
              <span v-html="renderMath(sub.answer)"></span>
            </div>
            <div v-if="sub.analysis" style="margin-top: 6px; padding: 6px; background: #f0f9ff; border-radius: 3px; color: #409eff;">
              <span style="font-weight: bold;">解析：</span>
              <span v-html="renderMath(sub.analysis)"></span>
            </div>
          </div>
        </div>

        <!-- 解析 -->
        <div v-if="currentQuestionAnalysis.analysis" class="analysis-section">
          <div class="section-title" style="font-weight: bold; margin-bottom: 4px; color: #303133; font-size: 13px;">解析</div>
          <div class="math-content" style="padding: 8px; background: #f5f7fa; border-radius: 4px; line-height: 1.6; font-size: 14px;" v-html="renderMath(currentQuestionAnalysis.analysis)"></div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { service as axios } from '../api'
import { Search, UploadFilled, Download } from '@element-plus/icons-vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, PieChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'
import katex from 'katex'
import 'katex/dist/katex.min.css'

import * as echarts from 'echarts/core'
import { User, CircleCheck, TrendCharts, Top, Bottom, CircleCheckFilled } from '@element-plus/icons-vue'

// 注册 ECharts 组件
use([CanvasRenderer, BarChart, PieChart, LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent])

// 当前激活的标签
const activeTab = ref('exams')

// 考试列表相关
const exams = ref([])
const loadingExams = ref(false)
const examTotal = ref(0)
const examFilter = reactive({
  status: '',
  page: 1,
  pageSize: 10
})

// 科目列表
const subjects = ref([])
const chapters = ref([])
const papers = ref([])
const loadingPapers = ref(false)

// 考试表单
const examModalVisible = ref(false)
const isEditing = ref(false)
const submitting = ref(false)
const examFormRef = ref(null)
const examForm = reactive({
  id: null,
  title: '',
  description: '',
  majorId: '',
  paperType: 1,
  sourcePaperId: '',
  sourcePaperName: '',
  startTime: '',
  endTime: '',
  duration: 120,
  passScore: 60,
  totalScore: 100,
  isLimitedTime: 1,
  showResultImmediately: 1,
  allowReview: 1,
  questionIds: [],
  questions: []
})

const examRules = {
  title: [{ required: true, message: '请输入考试名称', trigger: 'blur' }],
  paperType: [{ required: true, message: '请选择试卷类型', trigger: 'change' }],
  sourcePaperId: [{ required: true, message: '请选择来源试卷', trigger: 'change', validator: (rule, value, callback) => {
    if ((examForm.paperType === 1 || examForm.paperType === 2) && !value) {
      callback(new Error('请选择来源试卷'))
    } else {
      callback()
    }
  }}],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
  duration: [{ required: true, message: '请输入考试时长', trigger: 'blur' }],
  passScore: [{ required: true, message: '请输入及格分数', trigger: 'blur' }],
  totalScore: [{ required: true, message: '请输入总分', trigger: 'blur' }]
}

// 题目选择器
const questionSelectorVisible = ref(false)
const selectorQuestions = ref([])
const loadingSelectorQuestions = ref(false)
const selectorTotal = ref(0)
const selectorFilter = reactive({
  keyword: '',
  type: '',
  chapterId: '',
  majorId: '',
  page: 1,
  pageSize: 10
})
const selectorSelection = ref([])
const selectedQuestions = ref([])
const questionSearchKeyword = ref('')

// 考试详情
const examDetailVisible = ref(false)
const currentExam = ref(null)
const examQuestions = ref([])
const detailActiveTab = ref('statistics') // 详情对话框当前Tab

// 考试统计
const statisticsVisible = ref(false)
const examStatistics = ref(null)
const questionAnalysis = ref([])
const hardestQuestionsCount = ref(3) // 各题型错误率最高题目显示数量

// 考试记录
const recordsVisible = ref(false)
const examRecords = ref([])
const recordsLoading = ref(false)
const recordsFilter = ref({
  page: 1,
  pageSize: 10
})
const recordsTotal = ref(0)

// 解答题批改
const gradingVisible = ref(false)
const pendingQuestions = ref([])
const gradingForm = reactive({})

// 图表相关
const scoreChartRef = ref(null)
const questionTypeChartRef = ref(null)
const passChartRef = ref(null)
const trendChartRef = ref(null)
let scoreChart = null
let questionTypeChart = null
let passChart = null
let trendChart = null

// 题目详细分析
const questionDetailVisible = ref(false)
const currentQuestionAnalysis = ref(null)

// 获取考试列表
const fetchExams = async () => {
  loadingExams.value = true
  try {
    const response = await axios.get('/online-exam/admin/exams', {
      params: {
        page: examFilter.page,
        pageSize: examFilter.pageSize,
        status: examFilter.status
      }
    })
    if (response.code === 0 || response.code === 200) {
      exams.value = response.data?.list || []
      examTotal.value = response.data?.total || 0
    }
  } catch (error) {
    console.error('获取考试列表失败:', error)
    ElMessage.error('获取考试列表失败')
  } finally {
    loadingExams.value = false
  }
}



// 获取试卷列表
const fetchPapers = async () => {
  if (papers.value.length > 0) return // 已加载过不再重复加载
  loadingPapers.value = true
  try {
    // 获取真题卷和模拟题卷
    const [realResponse, mockResponse] = await Promise.all([
      axios.get('/computer/admin/papers', { params: { type: 'real', page: 1, pageSize: 1000 } }),
      axios.get('/computer/admin/papers', { params: { type: 'mock', page: 1, pageSize: 1000 } })
    ])
    
    const realPapers = realResponse.data?.list || []
    const mockPapers = mockResponse.data?.list || []
    
    // 标记试卷类型
    papers.value = [
      ...realPapers.map(p => ({ ...p, paper_type: 1 })),
      ...mockPapers.map(p => ({ ...p, paper_type: 2 }))
    ]
  } catch (error) {
    console.error('获取试卷失败:', error)
    ElMessage.error('获取试卷列表失败')
  } finally {
    loadingPapers.value = false
  }
}

// 试卷类型改变
const onPaperTypeChange = (val) => {
  examForm.sourcePaperId = ''
  examForm.sourcePaperName = ''
  examForm.questionIds = []
  selectedQuestions.value = []
  if (val === 1 || val === 2) {
    fetchPapers()
  }
}

// 来源试卷改变
const onSourcePaperChange = (val) => {
  const paper = papers.value.find(p => String(p.id) === String(val))
  if (paper) {
    examForm.sourcePaperName = paper.exam_full_name || paper.name || paper.title || ''
  }
}

// 打开创建考试对话框
const openCreateExamModal = () => {
  isEditing.value = false
  resetExamForm()
  examModalVisible.value = true
}

// 编辑考试
const editExam = (row) => {
  isEditing.value = true
  Object.assign(examForm, {
    id: row.id,
    title: row.title,
    description: row.description,
    paperType: row.paper_type,
    sourcePaperId: row.source_paper_id ? String(row.source_paper_id) : '',
    sourcePaperName: row.source_paper_name || '',
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    passScore: row.pass_score,
    totalScore: row.total_score,
    isLimitedTime: row.is_limited_time,
    showResultImmediately: row.show_result_immediately,
    allowReview: row.allow_review,
    questionIds: [],
    questions: []
  })
  if (row.paper_type === 1 || row.paper_type === 2) {
    fetchPapers()
  }
  examModalVisible.value = true
}

// 重置表单
const resetExamForm = () => {
  Object.assign(examForm, {
    id: null,
    title: '',
    description: '',
    paperType: 1,
    sourcePaperId: '',
    sourcePaperName: '',
    startTime: '',
    endTime: '',
    duration: 120,
    passScore: 60,
    totalScore: 100,
    isLimitedTime: 1,
    showResultImmediately: 1,
    allowReview: 1,
    questionIds: [],
    questions: []
  })
  selectedQuestions.value = []
}

// 提交考试
const submitExam = async () => {
  if (!examFormRef.value) return
  
  await examFormRef.value.validate(async (valid) => {
    if (!valid) return

    // 组卷类型需要验证题目
    if (examForm.paperType === 3 && selectedQuestions.value.length === 0) {
      ElMessage.error('组卷类型至少需要选择一道题目')
      return
    }

    submitting.value = true
    try {
      // 格式化日期为 MySQL 支持的格式
      const formatDateForMySQL = (date) => {
        if (!date) return null
        const d = new Date(date)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const hours = String(d.getHours()).padStart(2, '0')
        const minutes = String(d.getMinutes()).padStart(2, '0')
        const seconds = String(d.getSeconds()).padStart(2, '0')
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
      }

      const payload = {
        title: examForm.title,
        description: examForm.description,
        paperType: examForm.paperType,
        sourcePaperId: examForm.sourcePaperId,
        sourcePaperName: examForm.sourcePaperName,
        startTime: formatDateForMySQL(examForm.startTime),
        endTime: formatDateForMySQL(examForm.endTime),
        duration: examForm.duration,
        passScore: examForm.passScore,
        totalScore: examForm.totalScore,
        isLimitedTime: examForm.isLimitedTime,
        showResultImmediately: examForm.showResultImmediately,
        allowReview: examForm.allowReview
      }

      // 组卷类型添加题目
      if (examForm.paperType === 3) {
        payload.questionIds = selectedQuestions.value.map((q, index) => ({
          questionId: q.question_id,
          score: q.score || 1,
          sortOrder: index + 1,
          questionType: q.exercise_type
        }))
      }

      let response
      if (isEditing.value) {
        response = await axios.put(`/online-exam/admin/exams/${examForm.id}`, payload)
      } else {
        response = await axios.post('/online-exam/admin/exams', payload)
      }

      if (response.code === 0 || response.code === 200) {
        ElMessage.success(isEditing.value ? '考试更新成功' : '考试创建成功')
        examModalVisible.value = false
        fetchExams()
      } else {
        ElMessage.error(response.message || '操作失败')
      }
    } catch (error) {
      console.error('提交考试失败:', error)
      ElMessage.error(error.response?.data?.message || '操作失败')
    } finally {
      submitting.value = false
    }
  })
}

// 删除考试
const deleteExam = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除这个考试吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const response = await axios.delete(`/online-exam/admin/exams/${id}`)
    if (response.code === 0 || response.code === 200) {
      ElMessage.success('删除成功')
      fetchExams()
    } else {
      ElMessage.error(response.message || '删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除考试失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 发布/取消发布考试
const togglePublish = async (row) => {
  try {
    const newStatus = row.is_published ? 0 : 1
    const actionText = row.is_published ? '取消发布' : '发布'
    
    await ElMessageBox.confirm(`确定要${actionText}这个考试吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const response = await axios.put(`/online-exam/admin/exams/${row.id}`, {
      isPublished: newStatus
    })
    
    if (response.code === 0 || response.code === 200) {
      ElMessage.success(`${actionText}成功`)
      fetchExams()
    } else {
      ElMessage.error(response.message || `${actionText}失败`)
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('发布考试失败:', error)
      ElMessage.error('操作失败')
    }
  }
}

// 打开题目选择器
const openQuestionSelector = () => {
  selectorFilter.page = 1
  selectorFilter.keyword = ''
  selectorFilter.type = ''
  selectorFilter.chapterId = ''
  fetchSelectorQuestions()
  questionSelectorVisible.value = true
}

// 获取选择器题目列表
const fetchSelectorQuestions = async () => {
  loadingSelectorQuestions.value = true
  try {
    const response = await axios.get('/computer/admin/questions/all', {
      params: {
        keyword: selectorFilter.keyword,
        type: selectorFilter.type,
        chapterId: selectorFilter.chapterId,
        page: selectorFilter.page,
        pageSize: selectorFilter.pageSize
      }
    })
    if (response.code === 0 || response.code === 200) {
      selectorQuestions.value = response.data?.list || []
      selectorTotal.value = response.data?.total || 0
    }
  } catch (error) {
    console.error('获取题目列表失败:', error)
  } finally {
    loadingSelectorQuestions.value = false
  }
}

// 处理选择器选择变化
const handleSelectorSelectionChange = (selection) => {
  selectorSelection.value = selection
}

// 确认题目选择
const confirmQuestionSelection = () => {
  if (selectorSelection.value.length === 0) {
    ElMessage.warning('请至少选择一道题目')
    return
  }
  
  // 添加新选择的题目
  selectorSelection.value.forEach(q => {
    if (!selectedQuestions.value.find(sq => sq.question_id === q.question_id)) {
      selectedQuestions.value.push({
        ...q,
        score: 1
      })
    }
  })
  
  questionSelectorVisible.value = false
  ElMessage.success(`已选择 ${selectedQuestions.value.length} 道题目`)
}

// 删除已选题目
const removeSelectedQuestion = (index) => {
  selectedQuestions.value.splice(index, 1)
}

// 搜索题目
const searchQuestionsForExam = () => {
  openQuestionSelector()
}

// 计算总分
const calculateTotalScore = () => {
  return selectedQuestions.value.reduce((sum, q) => sum + (parseFloat(q.score) || 0), 0).toFixed(1)
}

// 查看考试详情
const viewExamDetail = async (row) => {
  currentExam.value = row
  detailActiveTab.value = 'statistics' // 重置为统计分析Tab
  
  try {
    // 加载考试题目
    const questionsResponse = await axios.get(`/online-exam/admin/exams/${row.id}/questions`)
    if (questionsResponse.code === 0 || questionsResponse.code === 200) {
      examQuestions.value = questionsResponse.data || []
    }
    
    // 加载统计数据
    const statsResponse = await axios.get(`/online-exam/admin/exams/${row.id}/statistics`)
    if (statsResponse.code === 0 || statsResponse.code === 200) {
      examStatistics.value = statsResponse.data
    }
    
    // 加载每题分析数据
    const analysisResponse = await axios.get(`/online-exam/admin/exams/${row.id}/question-analysis`)
    console.log('API原始响应:', analysisResponse)
    if (analysisResponse.code === 0 || analysisResponse.code === 200) {
      questionAnalysis.value = analysisResponse.data || []
      
      // 查找解答题并打印其subs数据
      const subjectiveQuestion = questionAnalysis.value.find(q => parseInt(q.exercise_type) === 4)
      console.log('前端加载的解答题数据:', subjectiveQuestion ? {
        question_id: subjectiveQuestion.question_id,
        exercise_type: subjectiveQuestion.exercise_type,
        subs: subjectiveQuestion.subs,
        subs_length: subjectiveQuestion.subs ? subjectiveQuestion.subs.length : 0,
        all_keys: Object.keys(subjectiveQuestion)
      } : '没有找到解答题')
      
      console.log('前端加载的每题分析数据:', questionAnalysis.value.length > 0 ? {
        question_id: questionAnalysis.value[0].question_id,
        exercise_type: questionAnalysis.value[0].exercise_type,
        exercise_type_name: questionAnalysis.value[0].exercise_type_name,
        knowledge_points: questionAnalysis.value[0].knowledge_points,
        sort_order: questionAnalysis.value[0].sort_order,
        subs: questionAnalysis.value[0].subs,
        subs_length: questionAnalysis.value[0].subs ? questionAnalysis.value[0].subs.length : 0,
        all_keys: Object.keys(questionAnalysis.value[0])
      } : '无数据')
    }
    
    // 加载考试记录
    await fetchExamRecords(row.id)
    
    // 加载待批改题目
    await fetchPendingQuestions(row.id)
    
  } catch (error) {
    console.error('获取考试详情失败:', error)
    examQuestions.value = []
  }
  examDetailVisible.value = true
  
  // 在对话框打开后初始化图表
  nextTick(() => {
    if (examStatistics.value) {
      initScoreChart()
      initQuestionTypeChart()
      initPassChart()
      initTrendChart()
    }
  })
}

// 获取考试记录列表
const fetchExamRecords = async (examId = null) => {
  const targetExamId = examId || currentExam.value?.id
  if (!targetExamId) return
  
  recordsLoading.value = true
  try {
    const response = await axios.get(`/online-exam/admin/exams/${targetExamId}/records`, {
      params: {
        page: recordsFilter.value.page,
        pageSize: recordsFilter.value.pageSize
      }
    })
    if (response.code === 0 || response.code === 200) {
      examRecords.value = response.data.list || []
      recordsTotal.value = response.data.total || 0
    }
  } catch (error) {
    console.error('获取考试记录失败:', error)
    ElMessage.error('获取考试记录失败')
  } finally {
    recordsLoading.value = false
  }
}

// 获取待批改题目
const fetchPendingQuestions = async (examId = null) => {
  const targetExamId = examId || currentExam.value?.id
  console.log('获取待批改题目, examId:', targetExamId)
  if (!targetExamId) return
  
  try {
    const response = await axios.get(`/online-exam/admin/exams/${targetExamId}/pending-subjective`)
    console.log('待批改题目响应:', response)
    if (response.code === 0 || response.code === 200) {
      pendingQuestions.value = response.data || []
      console.log(`获取到 ${pendingQuestions.value.length} 道待批改题目`)
      // 初始化评分表单
      pendingQuestions.value.forEach(q => {
        gradingForm[q.answer_id] = {
          score: 0,
          comment: ''
        }
      })
    }
  } catch (error) {
    console.error('获取待批改题目失败:', error)
    pendingQuestions.value = []
  }
}

// 提交评分
const submitGrade = async (question) => {
  const form = gradingForm[question.answer_id]
  if (form.score === undefined || form.score === null) {
    ElMessage.warning('请输入得分')
    return
  }
  
  try {
    const response = await axios.post(
      `/online-exam/admin/records/${question.record_id}/questions/${question.question_id}/grade`,
      {
        score: form.score,
        comment: form.comment
      }
    )
    if (response.code === 0 || response.code === 200) {
      ElMessage.success('评分成功')
      // 从列表中移除已批改的题目
      pendingQuestions.value = pendingQuestions.value.filter(q => q.answer_id !== question.answer_id)
      // 如果没有待批改题目了，关闭对话框
      if (pendingQuestions.value.length === 0) {
        gradingVisible.value = false
        ElMessage.success('所有解答题已批改完成')
      }
    }
  } catch (error) {
    console.error('评分失败:', error)
    ElMessage.error('评分失败')
  }
}

// 跳过当前题目
const skipQuestion = (question) => {
  // 将题目移到列表末尾
  const index = pendingQuestions.value.findIndex(q => q.answer_id === question.answer_id)
  if (index > -1) {
    const item = pendingQuestions.value.splice(index, 1)[0]
    pendingQuestions.value.push(item)
  }
}

// 查看题目详细分析
const viewQuestionDetail = (row) => {
  console.log('查看题目详情，row数据:', {
    question_id: row.question_id,
    exercise_type: row.exercise_type,
    subs: row.subs,
    subs_length: row.subs ? row.subs.length : 0,
    all_keys: Object.keys(row)
  })
  currentQuestionAnalysis.value = row
  questionDetailVisible.value = true
}

// 解析选项分布
const parseOptionDistribution = (distribution) => {
  if (!distribution) return []
  try {
    const obj = typeof distribution === 'string' ? JSON.parse(distribution) : distribution
    const total = Object.values(obj).reduce((sum, val) => sum + val, 0)
    return Object.entries(obj).map(([option, count]) => ({
      option,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    })).sort((a, b) => b.count - a.count)
  } catch (e) {
    return []
  }
}

// 解析常见错误答案
const parseCommonWrongAnswers = (answers) => {
  if (!answers) return []
  try {
    const obj = typeof answers === 'string' ? JSON.parse(answers) : answers
    return Object.entries(obj).map(([answer, count]) => ({
      answer,
      count
    })).sort((a, b) => b.count - a.count)
  } catch (e) {
    return []
  }
}

// 渲染LaTeX数学公式
const renderMath = (content) => {
  if (!content) return ''
  
  // 先处理HTML标签，提取并保护数学公式
  let html = content
  const mathExpressions = []
  
  // 保护 \( ... \) 行内公式
  html = html.replace(/\\\((.*?)\\\)/gs, (match, formula) => {
    const index = mathExpressions.length
    try {
      const rendered = katex.renderToString(formula.trim(), {
        throwOnError: false,
        displayMode: false
      })
      mathExpressions.push(rendered)
    } catch (e) {
      mathExpressions.push(`<span style="color: red;">${formula}</span>`)
    }
    return `__MATH_EXPR_${index}__`
  })
  
  // 保护 \[ ... \] 块级公式
  html = html.replace(/\\\[(.*?)\\\]/gs, (match, formula) => {
    const index = mathExpressions.length
    try {
      const rendered = katex.renderToString(formula.trim(), {
        throwOnError: false,
        displayMode: true
      })
      mathExpressions.push(rendered)
    } catch (e) {
      mathExpressions.push(`<div style="color: red;">${formula}</div>`)
    }
    return `__MATH_EXPR_${index}__`
  })
  
  // 恢复数学公式
  mathExpressions.forEach((expr, index) => {
    html = html.replace(`__MATH_EXPR_${index}__`, expr)
  })
  
  return html
}

// Tab切换处理
const onDetailTabChange = (tabName) => {
  if (tabName === 'statistics') {
    // 切换到统计分析Tab时初始化图表
    nextTick(() => {
      initScoreChart()
      initQuestionTypeChart()
      initPassChart()
      initTrendChart()
    })
  }
}

// 初始化分数段分布图表
const initScoreChart = () => {
  if (!scoreChartRef.value || !examStatistics.value) return
  
  if (scoreChart) {
    scoreChart.dispose()
  }
  
  scoreChart = echarts.init(scoreChartRef.value)
  
  const dist = examStatistics.value.score_distribution || {}
  const ranges = examStatistics.value.score_ranges || ['90-100分', '80-89分', '70-79分', '60-69分', '0-59分']
  
  const xData = ranges
  const yData = ranges.map(range => {
    const key = range.replace('分', '')
    return dist[key] || 0
  })
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { rotate: 30 }
    },
    yAxis: {
      type: 'value',
      name: '人数'
    },
    series: [{
      name: '人数',
      type: 'bar',
      data: yData,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#83bff6' },
          { offset: 0.5, color: '#188df0' },
          { offset: 1, color: '#188df0' }
        ])
      },
      label: {
        show: true,
        position: 'top',
        formatter: '{c}人'
      }
    }]
  }
  
  scoreChart.setOption(option)
}

// 初始化题型分布图表
const initQuestionTypeChart = () => {
  if (!questionTypeChartRef.value || !examStatistics.value) return
  
  if (questionTypeChart) {
    questionTypeChart.dispose()
  }
  
  questionTypeChart = echarts.init(questionTypeChartRef.value)
  
  const typeStats = examStatistics.value.question_type_stats || []
  
  const data = typeStats.map(item => ({
    name: item.type_name || item.exercise_type_name || '未知题型',
    value: item.question_count || 0
  }))
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [{
      name: '题型分布',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        formatter: '{b}: {c}题\n({d}%)'
      },
      data: data
    }]
  }
  
  questionTypeChart.setOption(option)
}

// 初始化及格情况分布图表
const initPassChart = () => {
  if (!passChartRef.value || !examStatistics.value) return
  
  if (passChart) {
    passChart.dispose()
  }
  
  passChart = echarts.init(passChartRef.value)
  
  const { passed, failed } = examStatistics.value.pass_distribution || { passed: 0, failed: 0 }
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c}人 ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [{
      name: '考试情况',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        formatter: '{b}: {c}人\n({d}%)'
      },
      data: [
        { value: passed || 0, name: '及格', itemStyle: { color: '#67c23a' } },
        { value: failed || 0, name: '不及格', itemStyle: { color: '#f56c6c' } }
      ]
    }]
  }
  
  passChart.setOption(option)
}

// 初始化分数趋势图表
const initTrendChart = () => {
  if (!trendChartRef.value || !examStatistics.value?.score_trend) return
  
  if (trendChart) {
    trendChart.dispose()
  }
  
  trendChart = echarts.init(trendChartRef.value)
  
  const trend = examStatistics.value.score_trend
  
  const option = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['提交人数', '平均分']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.map(item => item.date)
    },
    yAxis: [
      {
        type: 'value',
        name: '人数',
        position: 'left'
      },
      {
        type: 'value',
        name: '分数',
        position: 'right',
        min: 0,
        max: examStatistics.value.total_score || 150
      }
    ],
    series: [
      {
        name: '提交人数',
        type: 'bar',
        data: trend.map(item => item.count),
        itemStyle: { color: '#409eff' }
      },
      {
        name: '平均分',
        type: 'line',
        yAxisIndex: 1,
        data: trend.map(item => parseFloat(item.avg_score).toFixed(1)),
        smooth: true,
        itemStyle: { color: '#67c23a' },
        lineStyle: { width: 3 }
      }
    ]
  }
  
  trendChart.setOption(option)
}

// 各题型错误率最高的题目
const getHardestQuestionsByType = computed(() => {
  if (!questionAnalysis.value || questionAnalysis.value.length === 0) return []
  
  // 按题型分组
  const groupedByType = {}
  questionAnalysis.value.forEach(q => {
    const type = q.exercise_type || q.question_type || 'unknown'
    if (!groupedByType[type]) {
      groupedByType[type] = []
    }
    groupedByType[type].push(q)
  })
  
  // 从每种题型中找出错误率最高的N个题目（正确率最低的）
  const hardestQuestions = []
  Object.values(groupedByType).forEach((questions, typeIndex) => {
    // 过滤掉没有答题记录的题目
    const validQuestions = questions.filter(q => q.total_attempts > 0)
    if (validQuestions.length > 0) {
      // 按正确率升序排列，取前N个（错误率最高）
      const sorted = validQuestions.sort((a, b) => 
        parseFloat(a.correct_rate || 0) - parseFloat(b.correct_rate || 0)
      )
      const topN = sorted.slice(0, hardestQuestionsCount.value)
      topN.forEach((q, index) => {
        hardestQuestions.push({
          ...q,
          wrong_count: (q.total_attempts || 0) - (q.correct_count || 0),
          rank_in_type: index + 1,
          type_index: typeIndex
        })
      })
    }
  })
  
  // 按错误率降序排列（错误率高的在前）
  return hardestQuestions.sort((a, b) => 
    parseFloat(a.correct_rate || 0) - parseFloat(b.correct_rate || 0)
  )
})

// 计算分数段分布（动态）
const scoreDistribution = computed(() => {
  if (!examStatistics.value || !examStatistics.value.score_distribution) return []
  const dist = examStatistics.value.score_distribution
  const total = examStatistics.value.total_participants || 1
  const ranges = examStatistics.value.score_ranges || ['90-100分', '80-89分', '70-79分', '60-69分', '0-59分']
  
  return ranges.map(range => {
    const key = range.replace('分', '')
    const count = dist[key] || 0
    return {
      range,
      count,
      percentage: Math.round((count / total) * 100)
    }
  })
})

// 工具函数
const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

const stripHtml = (html) => {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').substring(0, 100) + (html.length > 100 ? '...' : '')
}

const getPaperTypeTagType = (type) => {
  const types = { 1: 'success', 2: 'warning', 3: 'primary' }
  return types[type] || 'info'
}

const getExerciseTypeTagType = (type) => {
  const types = { 1: 'primary', 2: 'success', 3: 'warning', 4: 'danger' }
  return types[type] || 'info'
}

// 过滤有效的考点名称（排除纯数字ID）
const filterValidKnowledgePoints = (kps) => {
  if (!kps || !Array.isArray(kps)) return []
  // 过滤掉纯数字的ID，只保留真正的考点名称
  return kps.filter(kp => kp && !/^\d+$/.test(kp))
}

const parseKnowledgePoints = (kps) => {
  if (!kps) return []
  if (Array.isArray(kps)) return filterValidKnowledgePoints(kps)
  if (typeof kps === 'string') {
    try {
      const parsed = JSON.parse(kps)
      if (Array.isArray(parsed)) return filterValidKnowledgePoints(parsed)
    } catch (e) {
      // 不是JSON字符串，按分隔符分割
    }
    return kps.split(/[,，;；]/).filter(kp => kp.trim() && !/^\d+$/.test(kp.trim()))
  }
  return []
}

const getExamStatusType = (status) => {
  const types = { ongoing: 'success', upcoming: 'warning', completed: 'info' }
  return types[status] || 'info'
}

const getExamStatusText = (status) => {
  const texts = { ongoing: '进行中', upcoming: '即将开始', completed: '已结束' }
  return texts[status] || status
}

onMounted(() => {
  fetchExams()
})
</script>

<style scoped>
.online-exam-manage {
  padding: 20px;
}

.filter-bar {
  display: flex;
  align-items: center;
}

.mb-20 {
  margin-bottom: 20px;
}

.ml-10 {
  margin-left: 10px;
}

.ml-20 {
  margin-left: 20px;
}

.mt-20 {
  margin-top: 20px;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.question-select-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.selected-questions-preview {
  margin-top: 10px;
}

.total-score {
  text-align: right;
  margin-top: 10px;
  font-size: 16px;
  font-weight: bold;
  color: #409EFF;
}

.statistics-overview {
  margin: 20px 0;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-card.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-card.success {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.stat-card.warning {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-card.danger {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-card.info {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-icon {
  font-size: 40px;
  margin-right: 15px;
  opacity: 0.9;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

.exam-info-card {
  margin-bottom: 20px;
}

.exam-info-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.exam-info-card .exam-title {
  font-size: 18px;
  font-weight: bold;
}

.charts-row {
  margin-top: 20px;
}

.chart-title {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}

.chart {
  height: 300px;
}

.chart.trend-chart {
  height: 350px;
}

.question-detail-analysis h4 {
  margin-bottom: 15px;
  color: #303133;
  border-left: 4px solid #409EFF;
  padding-left: 10px;
}

.option-distribution,
.common-wrong-answers {
  margin-top: 20px;
}

:deep(.statistics-dialog .el-dialog__body) {
  padding: 20px;
  max-height: 80vh;
  overflow-y: auto;
}

/* 批改相关样式 */
.grading-container {
  max-height: 70vh;
  overflow-y: auto;
}

.grading-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.grading-item {
  border: 1px solid #ebeef5;
}

.question-content h4,
.answer-content h4,
.correct-answer h4 {
  margin-bottom: 10px;
  color: #303133;
  font-size: 14px;
}

.question-stem {
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
  line-height: 1.6;
}

.user-answer {
  padding: 15px;
  background: #fdf6ec;
  border: 1px solid #f5dab1;
  border-radius: 4px;
  min-height: 60px;
  white-space: pre-wrap;
  line-height: 1.6;
}

.reference-answer {
  padding: 15px;
  background: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 4px;
  line-height: 1.6;
}

.grading-form {
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

/* 小题样式 */
.subs-section {
  margin-top: 15px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
}

.subs-section h5 {
  margin-bottom: 10px;
  color: #303133;
  font-size: 13px;
  font-weight: 600;
}

.sub-item {
  margin-bottom: 12px;
  padding: 12px;
  background: #fff;
  border-radius: 4px;
  border-left: 3px solid #409eff;
}

.sub-item:last-child {
  margin-bottom: 0;
}

.sub-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.sub-index {
  font-weight: 600;
  color: #409eff;
}

.sub-score {
  color: #909399;
  font-size: 12px;
}

.sub-stem {
  margin-bottom: 8px;
  line-height: 1.6;
}

.sub-answer {
  padding: 8px;
  background: #f0f9ff;
  border-radius: 4px;
  font-size: 13px;
}

.sub-answer-label {
  color: #409eff;
  font-weight: 500;
}

/* 选项样式 */
.option-content {
  display: inline;
}

.option-content :deep(p) {
  display: inline;
  margin: 0;
}

.option-content :deep(*) {
  display: inline;
}
</style>
