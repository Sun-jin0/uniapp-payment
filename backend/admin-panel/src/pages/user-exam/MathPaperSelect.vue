<template>
  <div class="paper-select-page">
    <!-- 顶部导航 -->
    <div class="top-nav">
      <div class="nav-left">
        <div class="subject-selector">高中数学 <span class="arrow">▼</span></div>
      </div>
      <div class="nav-menu">
        <a href="#" class="active">知识点挑题</a>
        <a class="nav-btn" href="#/user-exam/paper-extract">导入试卷</a>
        <a v-if="isAdmin" class="admin-btn" @click="goToAdmin">进入管理后台</a>
      </div>
      <div class="nav-right">
        <a href="#/login">登录</a>
        <a href="#/login">注册</a>
      </div>
    </div>

    <!-- 面包屑 -->
    <div class="breadcrumb">
      当前位置： <a href="#">知识点挑题</a> <span class="sep">&gt;</span> <a href="#">按知识点</a>
    </div>

    <div class="main-container">
      <!-- 左侧边栏 -->
      <div class="sidebar">
        <div class="sidebar-tabs">
          <div class="sidebar-tab" :class="{ active: currentTab === 'kp' }" @click="switchTab('kp')">知识点列表</div>
          <div class="sidebar-tab" :class="{ active: currentTab === 'book' }" @click="switchTab('book')">书籍挑题</div>
        </div>
        <template v-if="currentTab === 'kp'">
          <div class="sidebar-search">
            <el-input v-model="kpSearch" placeholder="请输入2-10个考点关键字" @input="filterKpDebounced" size="small" />
          </div>
          <div class="sidebar-options">
            <div class="toggle-switch">
              <span>知识点多选</span>
              <div class="switch" :class="{ on: multiSelect }" @click="multiSelect = !multiSelect"></div>
            </div>
            <div class="radio-group" :class="{ disabled: !multiSelect }">
              <label><input type="radio" v-model="selectMode" value="intersection" :disabled="!multiSelect"> 交集</label>
              <label><input type="radio" v-model="selectMode" value="union" :disabled="!multiSelect"> 并集</label>
            </div>
          </div>
          <div class="tree-container">
            <div v-for="item in filteredKpTree" :key="item.id" class="tree-item">
              <div class="tree-node" :class="{ selected: selectedKps.includes(item.id) }" @click="selectKp(item)">
                <span class="tree-toggle" @click.stop="toggleExpand(item)">
                  {{ item.children?.length ? (item.expanded ? '▼' : '▶') : '' }}
                </span>
                <span class="tree-icon"><span class="plus">+</span></span>
                <span class="tree-name">{{ item.name }}</span>
              </div>
              <div v-if="item.expanded && item.children" class="tree-children">
                <div v-for="child in item.children" :key="child.id" class="tree-item">
                  <div class="tree-node" :class="{ selected: selectedKps.includes(child.id) }" @click="selectKp(child)">
                    <span class="tree-toggle" @click.stop="toggleExpand(child)">
                      {{ child.children?.length ? (child.expanded ? '▼' : '▶') : '' }}
                    </span>
                    <span class="tree-icon"><span class="plus">+</span></span>
                    <span class="tree-name">{{ child.name }}</span>
                  </div>
                  <div v-if="child.expanded && child.children" class="tree-children">
                    <div v-for="grandChild in child.children" :key="grandChild.id" class="tree-item">
                      <div class="tree-node" :class="{ selected: selectedKps.includes(grandChild.id) }" @click="selectKp(grandChild)">
                        <span class="tree-toggle"></span>
                        <span class="tree-icon"><span class="plus">+</span></span>
                        <span class="tree-name">{{ grandChild.name }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-if="currentTab === 'book'">
          <div class="sidebar-search">
            <el-select v-model="selectedBook" placeholder="请选择书籍" size="small" style="width: 100%;" @change="onBookChange" filterable clearable>
              <el-option v-for="b in filteredBooks" :key="b.BookID" :label="getBookLabel(b)" :value="b.BookID">
                <span class="book-option">
                  <span class="book-option-title">{{ b.BookTitle }}</span>
                  <span v-if="b.VersionInfo" class="version-tag">{{ b.VersionInfo }}</span>
                  <span v-if="b.SubjectNames" class="subject-tag">{{ b.SubjectNames }}</span>
                  <span v-if="b.ContentType === 'mock_paper'" class="content-type-tag type-mock">模拟卷</span>
                  <span v-if="b.ContentType === 'real_paper'" class="content-type-tag type-real">真题卷</span>
                </span>
              </el-option>
            </el-select>
          </div>
          <div class="tree-container" v-if="bookChapters.length > 0">
            <div v-for="ch in bookChapters" :key="ch.name" class="tree-item">
              <div class="tree-node" :class="{ selected: selectedChapter === ch.name }" @click="selectChapter(ch.name)">
                <span class="tree-toggle">▶</span>
                <span class="tree-icon"><span class="plus">+</span></span>
                <span class="tree-name">{{ ch.name }}</span>
                <span class="tree-count">({{ ch.questionCount }})</span>
              </div>
            </div>
          </div>
          <div v-else-if="selectedBook && !bookLoading" class="tree-container" style="padding: 20px; text-align: center; color: #999;">
            暂无章节数据
          </div>
          <div v-else-if="bookLoading" class="tree-container" style="padding: 20px; text-align: center; color: #999;">
            <el-icon class="is-loading"><Loading /></el-icon> 加载中...
          </div>
        </template>
      </div>

      <!-- 右侧内容 -->
      <div class="content-area">
        <!-- 书籍挑题上下文 -->
        <div v-if="currentTab === 'book' && selectedBook" class="book-context-bar">
          <span class="book-context-label">当前书籍：</span>
          <span class="book-context-name">{{ getBookName(selectedBook) }}</span>
          <span v-if="selectedChapter" class="book-context-sep">/</span>
          <span v-if="selectedChapter" class="book-context-chapter">{{ selectedChapter }}</span>
          <span class="book-context-count">共 {{ totalQuestions }} 道题</span>
        </div>
        <!-- 筛选面板 -->
        <div class="filter-panel">
          <div class="filter-row">
            <div class="filter-label">题型：</div>
            <div class="filter-options">
              <a :class="{ active: filterType === '' }" @click="setFilter('type', '')">全部</a>
              <a :class="{ active: filterType === '单选题' }" @click="setFilter('type', '单选题')">选择题</a>
              <a :class="{ active: filterType === '填空题' }" @click="setFilter('type', '填空题')">填空题</a>
              <a :class="{ active: filterType === '解答题' }" @click="setFilter('type', '解答题')">解答题</a>
            </div>
          </div>
          <div class="filter-row">
            <div class="filter-label">难度：</div>
            <div class="filter-options">
              <a :class="{ active: filterDifficulty === '' }" @click="setFilter('difficulty', '')">全部</a>
              <a :class="{ active: filterDifficulty === '0.2' }" @click="setFilter('difficulty', '0.2')">易</a>
              <a :class="{ active: filterDifficulty === '0.4' }" @click="setFilter('difficulty', '0.4')">较易</a>
              <a :class="{ active: filterDifficulty === '0.6' }" @click="setFilter('difficulty', '0.6')">中档</a>
              <a :class="{ active: filterDifficulty === '0.8' }" @click="setFilter('difficulty', '0.8')">较难</a>
              <a :class="{ active: filterDifficulty === '1.0' }" @click="setFilter('difficulty', '1.0')">难</a>
            </div>
          </div>
          <div class="filter-row">
            <div class="filter-label">年份：</div>
            <div class="filter-options">
              <a :class="{ active: filterYear === '' }" @click="setFilter('year', '')">全部</a>
              <a :class="{ active: filterYear === '2027' }" @click="setFilter('year', '2027')">2027</a>
              <a :class="{ active: filterYear === '2026' }" @click="setFilter('year', '2026')">2026</a>
              <a :class="{ active: filterYear === '2025' }" @click="setFilter('year', '2025')">2025</a>
              <a :class="{ active: filterYear === '2024' }" @click="setFilter('year', '2024')">2024</a>
              <a :class="{ active: filterYear === '2023' }" @click="setFilter('year', '2023')">2023</a>
              <a :class="{ active: filterYear === '2022' }" @click="setFilter('year', '2022')">2022</a>
              <a :class="{ active: filterYear === 'older' }" @click="setFilter('year', 'older')">更早</a>
              <span class="count">共 {{ totalQuestions }} 道</span>
            </div>
          </div>
          <div class="filter-row">
            <div class="filter-label">来源：</div>
            <div class="filter-options">
              <a :class="{ active: filterSource === '' }" @click="setFilter('source', '')">全部</a>
              <a :class="{ active: filterSource === 'book' }" @click="setFilter('source', 'book')">书籍</a>
              <a :class="{ active: filterSource === 'real_paper' }" @click="setFilter('source', 'real_paper')">真题卷</a>
              <a :class="{ active: filterSource === 'mock_paper' }" @click="setFilter('source', 'mock_paper')">模拟卷</a>
            </div>
          </div>
        </div>

        <!-- 题目列表 -->
        <div class="question-area">
          <div v-if="questions.length > 0" class="question-list">
            <div v-for="(q, index) in questions" :key="q.QuestionID" class="question-item" :class="{ 'in-basket': isInBasket(q) }">
              <div class="question-body">
                <span class="question-num">{{ (page - 1) * pageSize + index + 1 }}.</span>
                <a v-if="q.ShortTitle && isPaperType(q)" class="question-source is-paper" @click="navigateToPaper(q)" :title="'查看完整试卷'">({{ q.ShortTitle }})</a>
                <span v-else-if="q.ShortTitle" class="question-source">({{ q.ShortTitle }})</span>
                <span class="question-text" v-html="renderLatex(getQuestionStem(q))"></span>
              </div>
              
              <div v-if="getQuestionOptions(q).length > 0" class="options-grid" :data-qid="q.QuestionID || q.id" :style="{ gridTemplateColumns: `repeat(${q.optionLayout || 4}, 1fr)` }">
                <div v-for="opt in getQuestionOptions(q)" :key="opt.label" class="option-item">
                  <template v-if="q._parsedFromText">
                    <span v-html="renderLatex(opt.text)"></span>
                  </template>
                  <template v-else>
                    <span class="opt-label">{{ opt.label }}.</span>
                    <span v-html="renderLatex(opt.text)"></span>
                  </template>
                </div>
              </div>

              <div class="question-footer">
                <div class="footer-left">
                  <span>{{ q.QuestionType }}</span>
                  <span>难度: <span v-html="renderStars(q.Difficulty)"></span></span>
                </div>
                <div class="footer-right">
                  <a @click="viewQuestionDetail(q)">解析</a>
                  <a @click="viewSimilarQuestions(q)">相似题</a>
                  <a @click="openCorrectionDialog(q)">纠错</a>
                  <a v-if="isAdmin" class="edit-link" @click="openEditDialog(q)">编辑</a>
                  <template v-if="isChoiceQuestion(q)">
                    <span class="layout-separator">|</span>
                    <span class="layout-label">选项：</span>
                    <button type="button" class="layout-btn-small" :class="{ active: (q.optionLayout || 4) === 4 }" @click="setQuestionOptionLayout(q, 4)">1×4</button>
                    <button type="button" class="layout-btn-small" :class="{ active: (q.optionLayout || 4) === 2 }" @click="setQuestionOptionLayout(q, 2)">2×2</button>
                    <button type="button" class="layout-btn-small" :class="{ active: (q.optionLayout || 4) === 1 }" @click="setQuestionOptionLayout(q, 1)">4×1</button>
                  </template>
                  <button class="add-btn" :class="{ added: isInBasket(q) }" @click="toggleBasket(q)">
                    {{ isInBasket(q) ? '✓ 已加入' : '+ 试题篮' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="empty">
            <div>暂无题目</div>
            <div style="font-size: 13px; margin-top: 10px;">请选择一个知识点或调整筛选条件</div>
          </div>

          <!-- 加载指示器 - 只覆盖题目区域 -->
          <transition name="fade">
            <div v-if="loading" class="question-loading">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>正在加载...</span>
            </div>
          </transition>
        </div>

        <!-- 分页 -->
        <div v-if="totalQuestions > pageSize" class="pagination">
          <a :class="{ disabled: page <= 1 }" @click="goToPage(1)">首页</a>
          <a :class="{ disabled: page <= 1 }" @click="goToPage(page - 1)">上一页</a>
          <a v-for="p in pageNumbers" :key="p" :class="{ active: page === p }" @click="goToPage(p)">{{ p }}</a>
          <a :class="{ disabled: page >= Math.ceil(totalQuestions / pageSize) }" @click="goToPage(page + 1)">下一页</a>
          <a :class="{ disabled: page >= Math.ceil(totalQuestions / pageSize) }" @click="goToPage(Math.ceil(totalQuestions / pageSize))">末页</a>
          <span class="page-input">第 <input v-model.number="jumpPage" @keyup.enter="goToPage(jumpPage)" /> 页 / 共 {{ Math.ceil(totalQuestions / pageSize) }} 页</span>
        </div>
      </div>
    </div>

    <!-- 右侧悬浮试题篮 -->
    <div 
      class="float-cart" 
      :class="{ dragging: isDragging }"
      @mousedown="startDrag"
      @click="handleCartClick"
    >
      <div class="cart-icon"></div>
      <span v-if="basket.length" class="cart-badge">{{ basket.length }}</span>
      <span class="cart-text">试题篮</span>
    </div>

    <!-- 回到顶部 -->
    <div class="back-top" :class="{ show: showBackTop }" @click="scrollToTop">↑</div>

    <!-- 试题篮侧边抽屉 -->
    <el-drawer
      v-model="showBasket"
      title="试题篮"
      size="50%"
      :with-header="false"
      direction="rtl"
    >
      <div class="basket-drawer">
        <!-- 头部 -->
        <div class="basket-drawer-header">
          <div class="basket-drawer-title">
            <span>试题篮</span>
            <span class="basket-count">{{ basket.length }}</span>
          </div>
          <el-button type="danger" link @click="showBasket = false">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>

        <!-- 统计信息 -->
        <div v-if="basket.length > 0" class="basket-stats">
          <div class="stats-row">
            <span>总计 <strong>{{ basket.length }}</strong> 题</span>
            <div class="stats-actions">
              <el-button type="danger" link size="small" @click="clearBasket">
                <el-icon><Delete /></el-icon> 清空全部
              </el-button>
              <el-button type="primary" size="small" @click="generatePaper">
                进入组卷中心
              </el-button>
            </div>
          </div>
          <div class="stats-types">
            <span v-for="(count, type) in basketTypeCount" :key="type" class="type-tag">
              {{ type }} {{ count }}
              <el-icon class="type-delete" @click="removeByType(type)"><Delete /></el-icon>
            </span>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="basket.length === 0" class="basket-empty">
          <el-icon :size="48" color="#ddd"><ShoppingCart /></el-icon>
          <div>试题篮为空</div>
          <div style="font-size: 13px; color: #999; margin-top: 8px;">点击题目右侧的"+ 试题篮"按钮添加题目</div>
        </div>

        <!-- 试题列表 -->
        <div v-else class="basket-list">
          <div
            v-for="(q, idx) in basket"
            :key="q.QuestionID"
            class="basket-item"
            :class="{ active: activeBasketId === q.QuestionID }"
            @click="activeBasketId = q.QuestionID"
          >
            <div class="basket-item-num">{{ idx + 1 }}.</div>
            <div class="basket-item-content">
              <div class="basket-item-text" v-html="renderLatex(q.QuestionText)"></div>
              <div v-if="q.options && q.options.length" class="basket-item-options">
                <span v-for="opt in q.options" :key="opt.label" class="basket-opt">
                  {{ opt.label }}. <span v-html="renderLatex(opt.text)"></span>
                </span>
              </div>
            </div>
            <el-button
              type="danger"
              link
              size="small"
              class="basket-item-delete"
              @click.stop="removeFromBasket(q)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>

        <!-- 底部操作 -->
        <div v-if="basket.length > 0" class="basket-footer">
          <el-button type="primary" @click="goToMakePaper">
            <el-icon><Document /></el-icon>
            去组卷
          </el-button>
          <el-button type="danger" plain @click="clearBasket">
            清空试题篮
          </el-button>
        </div>
      </div>
    </el-drawer>

    <!-- 纠错弹窗 -->
    <el-dialog v-model="showCorrectionDialog" title="题目纠错" width="600px" :close-on-click-modal="false">
      <el-form :model="correctionForm" label-width="80px">
        <el-form-item label="题目ID">
          <el-input v-model="correctionForm.QuestionID" disabled />
        </el-form-item>
        <el-form-item label="错误类型">
          <el-select v-model="correctionForm.ErrorType" placeholder="请选择错误类型" style="width: 100%">
            <el-option label="题目内容错误" value="题目内容错误" />
            <el-option label="答案错误" value="答案错误" />
            <el-option label="解析错误" value="解析错误" />
            <el-option label="选项错误" value="选项错误" />
            <el-option label="图片错误" value="图片错误" />
            <el-option label="其他错误" value="其他错误" />
          </el-select>
        </el-form-item>
        <el-form-item label="错误描述">
          <el-input v-model="correctionForm.Description" type="textarea" :rows="4" placeholder="请详细描述错误内容" />
        </el-form-item>
        <el-form-item label="正确内容">
          <el-input v-model="correctionForm.CorrectContent" type="textarea" :rows="3" placeholder="请提供正确的内容（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCorrectionDialog = false">取消</el-button>
        <el-button type="primary" @click="submitCorrection">提交纠错</el-button>
      </template>
    </el-dialog>

    <!-- 管理员编辑弹窗 -->
    <el-dialog v-model="showEditDialog" title="编辑题目" width="900px" :close-on-click-modal="false">
      <el-form :model="editForm" label-width="80px" v-if="editingQuestion">
        <el-form-item label="题目内容">
          <el-input v-model="editForm.QuestionText" type="textarea" :rows="4" placeholder="请输入题目内容" />
        </el-form-item>
        <el-form-item label="答案">
          <el-input v-model="editForm.Answer" type="textarea" :rows="2" placeholder="请输入答案" />
        </el-form-item>
        <el-form-item label="解析">
          <el-input v-model="editForm.analysis" type="textarea" :rows="4" placeholder="请输入解析" />
        </el-form-item>
        <el-form-item label="难度">
          <el-slider v-model="editForm.Difficulty" :min="0" :max="1" :step="0.1" show-stops />
        </el-form-item>
        <el-form-item label="题型">
          <el-select v-model="editForm.QuestionType" placeholder="请选择题型" style="width: 200px">
            <el-option label="选择题" value="选择题" />
            <el-option label="多选题" value="多选题" />
            <el-option label="填空题" value="填空题" />
            <el-option label="解答题" value="解答题" />
            <el-option label="判断题" value="判断题" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div style="text-align: right;">
          <el-button @click="showEditDialog = false">取消</el-button>
          <el-button type="primary" @click="saveEdit">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 相似题弹窗 -->
    <el-dialog v-model="showSimilarDialog" title="相似题目" width="750px" :close-on-click-modal="false" @closed="similarQuestions = []">
      <div v-if="similarQuestions.length > 0" class="similar-list">
        <div v-for="(rq, idx) in similarQuestions" :key="rq.QuestionID" class="similar-item">
          <div class="similar-num">{{ idx + 1 }}.</div>
          <div class="similar-body">
            <div class="similar-type">{{ rq.QuestionType }}</div>
            <div class="similar-text" v-html="renderLatex(rq.QuestionText)"></div>
          </div>
          <div class="similar-footer">
            <el-button size="small" @click="viewRelatedDetail(rq.QuestionID)">查看详情</el-button>
          </div>
        </div>
      </div>
      <div v-else style="text-align: center; padding: 40px 0; color: #999;">暂无相似题目</div>
      <template #footer>
        <el-button @click="showSimilarDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, onActivated, watch, computed, defineOptions, nextTick } from 'vue'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading, Close, Delete, ShoppingCart, Document } from '@element-plus/icons-vue'
import { adminApi } from '../../api'
import katex from 'katex'
import 'katex/dist/katex.min.css'

defineOptions({
  name: 'MathPaperSelect'
})

const router = useRouter()
const route = useRoute()

// 知识点数据
const kpTree = ref([])
const filteredKpTree = ref([])
const selectedKps = ref([])
const kpSearch = ref('')
const currentKpTitle = ref('')
const multiSelect = ref(false)
const selectMode = ref('intersection')

// 题目数据
const questions = ref([])
const loading = ref(false)
const totalQuestions = ref(0)
const page = ref(1)
const pageSize = ref(10)
const filterType = ref('')
const filterDifficulty = ref('')
const filterYear = ref('')
const filterSource = ref('')
const keywordSearch = ref('')
const jumpPage = ref(1)

// 书籍挑题
const currentTab = ref('kp')
const books = ref([])
const selectedBook = ref(null)
const bookChapters = ref([])
const selectedChapter = ref(null)
const bookLoading = ref(false)
const bookQuestions = ref([])

const switchTab = (tab) => {
  currentTab.value = tab
  if (tab === 'book' && books.value.length === 0) {
    loadBooks()
  }
}

const loadBooks = async () => {
  try {
    const res = await adminApi.getMathBooks({ pageSize: 1000 })
    if (res.code === 0) {
      books.value = res.data?.list || res.data || []
    }
  } catch (err) {
    console.error('加载书籍列表失败:', err)
  }
}

const onBookChange = async (bookId) => {
  selectedChapter.value = null
  bookChapters.value = []
  bookQuestions.value = []
  questions.value = []
  totalQuestions.value = 0
  page.value = 1
  if (!bookId) return
  bookLoading.value = true
  try {
    const res = await adminApi.getMathBookChapters(bookId)
    if (res.code === 0) {
      bookChapters.value = res.data || []
    }
    const qRes = await adminApi.getMathBookQuestions(bookId)
    if (qRes.code === 0) {
      bookQuestions.value = qRes.data || []
      totalQuestions.value = bookQuestions.value.length
      applyPagination()
    }
  } catch (err) {
    console.error('加载书籍数据失败:', err)
  } finally {
    bookLoading.value = false
  }
}

const selectChapter = (chapterName) => {
  selectedChapter.value = chapterName === selectedChapter.value ? null : chapterName
  page.value = 1
  applyLocalFilter()
}

const filteredBooks = computed(() => {
  let list = books.value
  if (filterYear.value) {
    const yearStr = filterYear.value
    if (yearStr === 'older') {
      list = list.filter(b => {
        const year = parseInt(b.VersionInfo || '0')
        return year > 0 && year < 2022
      })
    } else {
      list = list.filter(b => b.VersionInfo === yearStr || (b.BookTitle && b.BookTitle.includes(yearStr)))
    }
  }
  if (filterSource.value) {
    list = list.filter(b => b.ContentType === filterSource.value)
  }
  return list
})

const getBookLabel = (b) => {
  let label = b.BookTitle
  if (b.VersionInfo) label += ` [${b.VersionInfo}版]`
  if (b.SubjectNames) label += ` (${b.SubjectNames})`
  if (b.ContentType === 'mock_paper') label += ' [模拟卷]'
  if (b.ContentType === 'real_paper') label += ' [真题卷]'
  return label
}

const getBookName = (bookId) => {
  const book = books.value.find(b => b.BookID === bookId)
  if (!book) return '未知书籍'
  let name = book.BookTitle
  if (book.VersionInfo) name += ` [${book.VersionInfo}版]`
  if (book.SubjectNames) name += ` (${book.SubjectNames})`
  return name
}

const applyPagination = () => {
  let filtered = bookQuestions.value
  if (selectedChapter.value) {
    filtered = filtered.filter(q => q.BookChapter === selectedChapter.value)
  }
  totalQuestions.value = filtered.length
  const start = (page.value - 1) * pageSize.value
  const end = start + pageSize.value
  questions.value = filtered.slice(start, end)
}

watch(page, () => {
  if (currentTab.value === 'book') {
    applyLocalFilter()
  }
})

// 保存页面状态
const savePageState = () => {
  const state = {
    selectedKps: selectedKps.value,
    filterType: filterType.value,
    filterDifficulty: filterDifficulty.value,
    filterYear: filterYear.value,
    filterSource: filterSource.value,
    page: page.value,
    scrollTop: window.scrollY
  }
  sessionStorage.setItem('math_paper_select_state', JSON.stringify(state))
}

// 恢复页面状态
const restorePageState = () => {
  // 优先从URL参数恢复
  const query = route.query
  if (query.kps) {
    selectedKps.value = query.kps.split(',').map(Number)
  }
  if (query.type) filterType.value = query.type
  if (query.diff) filterDifficulty.value = query.diff
  if (query.year) filterYear.value = query.year
  if (query.source) filterSource.value = query.source
  if (query.p) page.value = parseInt(query.p)
  
  // 如果URL没有参数，尝试从sessionStorage恢复
  if (!query.kps) {
    const savedState = sessionStorage.getItem('math_paper_select_state')
    if (savedState) {
      try {
        const state = JSON.parse(savedState)
        selectedKps.value = state.selectedKps || []
        filterType.value = state.filterType || ''
        filterDifficulty.value = state.filterDifficulty || ''
        filterYear.value = state.filterYear || ''
        filterSource.value = state.filterSource || ''
        page.value = state.page || 1
        
        // 恢复滚动位置
        if (state.scrollTop) {
          setTimeout(() => {
            window.scrollTo(0, state.scrollTop)
          }, 100)
        }
        
        // 展开选中的考点树节点
        if (selectedKps.value.length > 0) {
          expandSelectedKps()
        }
        
        return true
      } catch (e) {
        console.error('恢复状态失败:', e)
      }
    }
  } else {
    // 从URL恢复成功，展开对应的考点树节点
    expandSelectedKps()
    return true
  }
  return false
}

// 展开选中的考点树节点
const expandSelectedKps = () => {
  if (selectedKps.value.length === 0) return
  
  selectedKps.value.forEach(kpId => {
    // 查找节点路径并展开
    const path = findKpPath(kpTree.value, kpId)
    if (path) {
      path.forEach(node => {
        node.expanded = true
      })
    }
  })
  
  // 更新currentKpTitle
  if (selectedKps.value.length === 1) {
    const node = findKpNode(kpTree.value, selectedKps.value[0])
    if (node) currentKpTitle.value = node.name
  } else if (selectedKps.value.length > 1) {
    currentKpTitle.value = `已选择 ${selectedKps.value.length} 个考点`
  }
}

// 查找节点路径
const findKpPath = (tree, targetId, path = []) => {
  for (const node of tree) {
    if (node.id === targetId) {
      return path
    }
    if (node.children && node.children.length > 0) {
      const result = findKpPath(node.children, targetId, [...path, node])
      if (result) return result
    }
  }
  return null
}

// 查找节点
const findKpNode = (tree, targetId) => {
  for (const node of tree) {
    if (node.id === targetId) return node
    if (node.children && node.children.length > 0) {
      const result = findKpNode(node.children, targetId)
      if (result) return result
    }
  }
  return null
}

// 离开页面时保存状态
onBeforeRouteLeave((to, from, next) => {
  // 只有跳转到题目详情页时才保存状态
  if (to.path.startsWith('/user-exam/math-paper/')) {
    savePageState()
  }
  next()
})

// 试题篮
const basket = ref([])

const savedBasket = localStorage.getItem('math_paper_basket')
if (savedBasket) {
  try {
    basket.value = JSON.parse(savedBasket)
  } catch (e) {
    console.error('Failed to parse saved basket:', e)
  }
}

watch(basket, (newBasket) => {
  localStorage.setItem('math_paper_basket', JSON.stringify(newBasket))
}, { deep: true })

const showBasket = ref(false)
const activeBasketId = ref(null)

// 试题篮按题型统计
const basketTypeCount = computed(() => {
  const counts = {}
  basket.value.forEach(q => {
    const type = q.QuestionType || '其他'
    counts[type] = (counts[type] || 0) + 1
  })
  return counts
})

// 回到顶部
const showBackTop = ref(false)

// 拖动相关
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const hasDragged = ref(false)

// 纠错弹窗
const showCorrectionDialog = ref(false)
const correctionForm = ref({
  QuestionID: '',
  ErrorType: '',
  Description: '',
  CorrectContent: ''
})

// 相似题弹窗
const showSimilarDialog = ref(false)
const similarQuestions = ref([])
const similarLoading = ref(false)

const viewSimilarQuestions = async (q) => {
  if (!q.QuestionID) return
  similarLoading.value = true
  showSimilarDialog.value = true
  try {
    const res = await adminApi.getRelatedQuestions(q.QuestionID)
    if (res.code === 0 && res.data) {
      similarQuestions.value = Array.isArray(res.data) ? res.data : []
    } else {
      similarQuestions.value = []
    }
  } catch (err) {
    console.error('加载相似题失败:', err)
    similarQuestions.value = []
  } finally {
    similarLoading.value = false
  }
}

const viewRelatedDetail = (questionId) => {
  router.push(`/user-exam/math-paper/${questionId}`)
}

// 管理员编辑弹窗
const showEditDialog = ref(false)
const editingQuestion = ref(null)
const editForm = ref({
  QuestionText: '',
  analysis: '',
  Answer: '',
  Difficulty: 0.5,
  QuestionType: ''
})
const isAdmin = ref(false)

// 页码数组
const pageNumbers = computed(() => {
  const total = Math.ceil(totalQuestions.value / pageSize.value)
  const current = page.value
  const pages = []
  for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
    pages.push(i)
  }
  return pages
})

// 加载考点分类树
const loadKnowledgePoints = async () => {
  try {
    const res = await adminApi.getMathKnowledgeCategories()
    if (res.code === 0) {
      const list = res.data || []
      const tree = buildCategoryTree(list)
      kpTree.value = tree
      filteredKpTree.value = tree
    }
  } catch (err) {
    console.error('加载考点分类失败:', err)
    kpTree.value = getMockKpData()
    filteredKpTree.value = kpTree.value
  }
}

// 构建考点分类树
const buildCategoryTree = (list) => {
  const map = {}
  const roots = []
  
  list.forEach(item => {
    map[item.id] = {
      id: item.id,
      name: item.CategoryName,
      code: item.CategoryCode,
      children: [],
      expanded: false,
      questionCount: item.QuestionCount || 0
    }
  })
  
  list.forEach(item => {
    const codeParts = item.CategoryCode.split('-')
    if (codeParts.length > 1) {
      const parentCode = codeParts.slice(0, -1).join('-')
      const parent = list.find(p => p.CategoryCode === parentCode)
      if (parent && map[parent.id]) {
        map[parent.id].children.push(map[item.id])
      } else {
        roots.push(map[item.id])
      }
    } else {
      roots.push(map[item.id])
    }
  })
  
  // 添加"未分类"节点（id = -1），用于筛选没有关联考点的题目
  roots.push({
    id: -1,
    name: '未分类',
    code: 'unclassified',
    children: [],
    expanded: false,
    questionCount: 0
  })
  
  return roots
}

// 筛选知识点
const filterKp = () => {
  if (!kpSearch.value) {
    filteredKpTree.value = kpTree.value
    return
  }
  const keyword = kpSearch.value.toLowerCase()
  filteredKpTree.value = kpTree.value.filter(item => 
    item.name.toLowerCase().includes(keyword) ||
    (item.children && item.children.some(c => c.name.toLowerCase().includes(keyword)))
  )
}

// 防抖筛选
let filterKpTimer = null
const filterKpDebounced = () => {
  if (filterKpTimer) clearTimeout(filterKpTimer)
  filterKpTimer = setTimeout(() => {
    filterKp()
  }, 200)
}

// 展开/收起
const toggleExpand = (item) => {
  item.expanded = !item.expanded
}

// 选择知识点
const selectKp = (item) => {
  if (multiSelect.value) {
    // 多选模式
    const index = selectedKps.value.indexOf(item.id)
    if (index > -1) {
      selectedKps.value.splice(index, 1)
    } else {
      selectedKps.value.push(item.id)
    }
    // 更新标题
    if (selectedKps.value.length === 0) {
      currentKpTitle.value = ''
    } else if (selectedKps.value.length === 1) {
      const node = findKpNode(kpTree.value, selectedKps.value[0])
      if (node) currentKpTitle.value = node.name
    } else {
      currentKpTitle.value = `已选择 ${selectedKps.value.length} 个考点`
    }
  } else {
    // 单选模式
    selectedKps.value = [item.id]
    currentKpTitle.value = item.name
  }
  page.value = 1
  // 静默加载，不显示loading状态
  loadQuestions(true)
  // 延迟更新URL，避免闪烁
  updateUrlDebounced()
}

// 防抖更新URL
let urlUpdateTimer = null
const updateUrlDebounced = () => {
  if (urlUpdateTimer) clearTimeout(urlUpdateTimer)
  urlUpdateTimer = setTimeout(() => {
    const query = {}
    if (selectedKps.value.length > 0) {
      query.kps = selectedKps.value.join(',')
    }
    if (filterType.value) query.type = filterType.value
    if (filterDifficulty.value) query.diff = filterDifficulty.value
    if (filterYear.value) query.year = filterYear.value
    if (filterSource.value) query.source = filterSource.value
    if (page.value > 1) query.p = page.value
    
    isInternalUrlUpdate = true
    router.replace({ query })
    setTimeout(() => { isInternalUrlUpdate = false }, 50)
  }, 300)
}

// 设置筛选条件
const setFilter = (type, value) => {
  if (type === 'type') filterType.value = value
  else if (type === 'difficulty') filterDifficulty.value = value
  else if (type === 'year') filterYear.value = value
  else if (type === 'source') filterSource.value = value
  page.value = 1
  if (currentTab.value === 'book') {
    // 如果选中的书籍不在过滤后的列表中，清除选中
    if (selectedBook.value && (type === 'year' || type === 'source')) {
      const book = filteredBooks.value.find(b => b.BookID === selectedBook.value)
      if (!book) {
        selectedBook.value = null
        selectedChapter.value = null
        bookChapters.value = []
        bookQuestions.value = []
        questions.value = []
        totalQuestions.value = 0
      }
    }
    applyLocalFilter()
  } else {
    loadQuestions(true)
  }
  updateUrlDebounced()
}

const applyLocalFilter = () => {
  let filtered = bookQuestions.value
  if (selectedChapter.value) {
    filtered = filtered.filter(q => q.BookChapter === selectedChapter.value)
  }
  if (filterType.value) {
    filtered = filtered.filter(q => q.QuestionType === filterType.value)
  }
  if (filterDifficulty.value) {
    const diff = parseFloat(filterDifficulty.value)
    filtered = filtered.filter(q => Math.abs((q.Difficulty || 0.5) - diff) < 0.01)
  }
  if (filterSource.value && selectedBook.value) {
    const book = books.value.find(b => b.BookID === selectedBook.value)
    if (book) {
      filtered = filtered.filter(q => !q.ContentType || q.ContentType === filterSource.value)
    }
  }
  totalQuestions.value = filtered.length
  const start = (page.value - 1) * pageSize.value
  const end = start + pageSize.value
  questions.value = filtered.slice(start, end)
}

// 加载题目
const loadQuestions = async (silent = false) => {
  // 非静默模式才显示加载指示器
  if (!silent) loading.value = true
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
      questionType: filterType.value,
      difficulty: filterDifficulty.value,
      year: filterYear.value,
      contentType: filterSource.value || undefined,
      keyword: keywordSearch.value
    }
    
    if (selectedKps.value.length > 0) {
      if (selectedKps.value.length === 1) {
        params.categoryId = selectedKps.value[0]
      } else {
        params.categoryIds = selectedKps.value.join(',')
        params.selectMode = selectMode.value
      }
    }
    
    const res = await adminApi.searchMathQuestions(params)
    if (res.code === 0) {
      const newQuestions = (res.data.list || []).map(q => ({ ...q, showAnalysis: false }))
      // 只在新数据到达时才替换，不先清空再填充
      questions.value = newQuestions
      totalQuestions.value = res.data.total || 0
    }
  } catch (err) {
    console.error('加载题目失败:', err)
    if (questions.value.length === 0) {
      questions.value = getMockQuestions().map(q => ({ ...q, showAnalysis: false }))
      totalQuestions.value = questions.value.length
    }
  } finally {
    requestAnimationFrame(() => {
      loading.value = false
    })
  }
}

// 渲染难度星星
const renderStars = (difficulty) => {
  const count = Math.ceil((difficulty || 0.5) * 5)
  return '★'.repeat(count) + '☆'.repeat(5 - count)
}

const parseOptionsFromText = (text) => {
  if (!text) return null

  const formulaPlaceholders = []
  let protectedText = text
  const formulaRe = /(\$\$[\s\S]*?\$\$)|(\$[\s\S]+?\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g
  protectedText = protectedText.replace(formulaRe, (match) => {
    const p = `__FORMULA_PH_${formulaPlaceholders.length}__`
    formulaPlaceholders.push({ p, original: match })
    return p
  })

  const lines = protectedText.split('\n').map(l => l.trim())
  
  let firstOptIdx = -1
  const optLines = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    
    let label = null
    
    const formulaMatch = line.match(/^(__FORMULA_PH_\d+__)/)
    if (formulaMatch) {
      const ph = formulaMatch[1]
      const phData = formulaPlaceholders.find(f => f.p === ph)
      if (phData && phData.original) {
        const innerMatch = phData.original.match(/\\rm\s*\{?\s*([A-D])|\\mathrm\s*\{?\s*([A-D])|\(([A-D])\)|（([A-D])）/)
        if (innerMatch) {
          label = innerMatch[1] || innerMatch[2] || innerMatch[3] || innerMatch[4]
        }
      }
    }
    
    if (!label) {
      const bracketMatch = line.match(/^[（(]\s*([A-D])\s*[）)]/)
      if (bracketMatch) {
        label = bracketMatch[1]
      }
    }
    
    if (!label) {
      const dotMatch = line.match(/^([A-D])\s*[．.、]/)
      if (dotMatch) {
        label = dotMatch[1]
      }
    }
    
    if (label) {
      if (firstOptIdx < 0) firstOptIdx = i
      optLines.push({ idx: i, label, text: lines[i] })
    }
  }

  if (optLines.length < 3) return null

  const alpha = 'ABCDEFGH'
  const startIdx = alpha.indexOf(optLines[0].label)
  if (startIdx < 0) return null
  
  let valid = true
  for (let i = 1; i < optLines.length; i++) {
    if (optLines[i].label !== alpha[startIdx + i]) {
      valid = false
      break
    }
  }
  if (!valid) return null

  const stemLines = lines.slice(0, firstOptIdx)
  let stem = stemLines.join('\n')
  formulaPlaceholders.forEach(({ p, original }) => {
    stem = stem.replace(p, original)
  })

  const options = []
  for (let i = 0; i < optLines.length; i++) {
    let optText = optLines[i].text
    formulaPlaceholders.forEach(({ p, original }) => {
      optText = optText.replace(p, original)
    })
    options.push({ label: optLines[i].label, text: optText })
  }

  return { stem: stem || '', options }
}

const getQuestionOptions = (q) => {
  if (q._parsedOptions) return q._parsedOptions

  if (q.options && Array.isArray(q.options) && q.options.length > 0) {
    q._parsedOptions = q.options
    q._hasSeparateOptions = true
    return q.options
  }

  const parsed = parseOptionsFromText(q.QuestionText)
  if (parsed) {
    q._parsedOptions = parsed.options
    q._parsedStem = parsed.stem
    q._parsedFromText = true
    return parsed.options
  }

  return []
}

const getQuestionStem = (q) => {
  if (q._hasSeparateOptions) {
    return q.QuestionText || ''
  }
  if (q._parsedFromText) {
    return q._parsedStem || ''
  }
  if (q._parsedStem) {
    return q._parsedStem
  }
  const options = getQuestionOptions(q)
  if (q._parsedFromText) {
    return q._parsedStem || ''
  }
  return q.QuestionText || ''
}

const isChoiceQuestion = (q) => {
  if (q.QuestionType === '选择题' || q.QuestionType === '多选题' || q.QuestionType === '单选题') {
    return true
  }
  return getQuestionOptions(q).length > 0
}

const isPaperType = (q) => {
  if (!q.ShortTitle) return false
  if (q.ContentType && q.ContentType !== 'book') return true
  const paperKeywords = ['真题', '模拟', '冲刺卷', '预测卷', '试卷']
  return paperKeywords.some(keyword => q.ShortTitle.includes(keyword))
}

const navigateToPaper = async (q) => {
  const bookId = q.BookID
  if (!bookId) {
    ElMessage.warning('无法获取试卷ID')
    return
  }
  try {
    const res = await adminApi.getMathBookQuestions(bookId)
    if (res.code === 0 && res.data) {
      const questions = (Array.isArray(res.data) ? res.data : res.data.list || []).map(q => ({
        ...q,
        showAnalysis: false,
        score: '5',
        area: 0
      }))
      sessionStorage.setItem('paper_view_data', JSON.stringify({
        paperName: q.ShortTitle || '试卷',
        bookId: bookId,
        questions
      }))
      router.push('/exam/make-paper')
    } else {
      ElMessage.warning('获取试卷题目失败')
    }
  } catch (err) {
    console.error('加载试卷题目失败:', err)
    ElMessage.warning('加载试卷题目失败')
  }
}

const setQuestionOptionLayout = (q, cols) => {
  q.optionLayout = cols
}

const autoAdjustAllOptionLayouts = () => {
  const grids = document.querySelectorAll('.options-grid')
  if (!grids.length) return
  
  grids.forEach(grid => {
    const qid = grid.getAttribute('data-qid')
    if (!qid) return
    
    const question = questions.value.find(q => (q.QuestionID || q.id) === qid)
    if (!question || question._autoAdjusted) return
    
    const items = grid.querySelectorAll('.option-item')
    if (!items.length) return
    
    let hasOverflow = false
    items.forEach(item => {
      const label = item.querySelector('label')
      if (label) {
        if (label.scrollHeight > label.clientHeight + 2) {
          hasOverflow = true
        }
      }
    })
    
    const currentLayout = question.optionLayout || 4
    
    if (hasOverflow && currentLayout > 1) {
      question.optionLayout = currentLayout === 4 ? 2 : 1
    }
    
    question._autoAdjusted = true
  })
}

const autoAdjustOptionLayout = (question) => {
  if (question._autoAdjusting) return
  question._autoAdjusting = true
  
  nextTick(() => {
    const grids = document.querySelectorAll(`.options-grid[data-qid="${question.QuestionID || question.id}"]`)
    if (!grids.length) {
      question._autoAdjusting = false
      return
    }
    
    const grid = grids[0]
    const items = grid.querySelectorAll('.option-item')
    if (!items.length) {
      question._autoAdjusting = false
      return
    }
    
    let hasOverflow = false
    items.forEach(item => {
      const label = item.querySelector('label')
      if (label) {
        const scrollHeight = label.scrollHeight
        const clientHeight = label.clientHeight
        if (scrollHeight > clientHeight + 2) {
          hasOverflow = true
        }
      }
    })
    
    const currentLayout = question.optionLayout || 4
    
    if (hasOverflow && currentLayout > 1) {
      const newLayout = currentLayout === 4 ? 2 : 1
      question.optionLayout = newLayout
      
      nextTick(() => {
        autoAdjustOptionLayout(question)
      })
    } else {
      delete question._autoAdjusting
    }
  })
}

// 渲染LaTeX公式
const renderLatex = (text) => {
  if (!text) return ''

  const MATH_PH_PREFIX = '__MATH_ONLY_PH_'

  let currentText = text.trim().replace(/\t/g, ' ').replace(/ {2,}/g, ' ')

  // 第一步：完全提取所有数学公式，从文本中移除
  const mathStore = []
  let mathRegex
  try {
    mathRegex = /(\$\$[\s\S]*?\$\$)|((?<!\\)\$([\s\S]+?)(?<!\\)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g
  } catch (e) {
    mathRegex = /(\$\$[\s\S]*?\$\$)|(\$([\s\S]+?)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g
  }

  currentText = currentText.replace(mathRegex, (match) => {
    const id = mathStore.length
    mathStore.push(match)
    return MATH_PH_PREFIX + id + '__'
  })

  // 第二步：对非公式文本进行 HTML 实体解码和文本替换
  currentText = currentText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")

  currentText = currentText
    .replace(/《答案》/g, '<span class="custom-tag answer">【答案】</span>')
    .replace(/《\/答案》/g, '')
    .replace(/《分析》/g, '<span class="custom-tag analysis">【思路分析】</span>')
    .replace(/《\/分析》/g, '')
    .replace(/《点评》/g, '<span class="custom-tag commentary">【点评】</span>')
    .replace(/《\/点评》/g, '')
    .replace(/《注释》/g, '<span class="custom-tag note">')
    .replace(/《\/注释》/g, '</span>')
    .replace(/《步骤》/g, '<span class="custom-tag step">【步骤】</span>')
    .replace(/《\/步骤》/g, '')

  currentText = currentText
    .replace(/\\color\{#([0-9A-Fa-f]{6})\}\{([^}]+)\}/g, '<span style="color:#$1;">$2</span>')
    .replace(/\\bold\{([^}]+)\}/g, '<b>$1</b>')
    .replace(/\\mathbf\{([^}]+)\}/g, '<b>$1</b>')

  currentText = currentText.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, url) => {
      let decodedUrl = url
      try {
        decodedUrl = decodeURIComponent(url)
      } catch (e) {}
      const cleanUrl = decodedUrl.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '$2')
      return `<img src="${cleanUrl}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display='none'" />`
    }
  )

  currentText = currentText.replace(
    /(https?:\/\/[^\s<>"]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp))(?:_yjs|_thumb|_small|_medium|_large)?(?!["'])/gi,
    (match, url) => {
      const cleanUrl = url.replace(/(_yjs|_thumb|_small|_medium|_large)$/i, '')
      return `<img src="${cleanUrl}" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display='none'" />`
    }
  )

  // 第三步：渲染每个公式（使用原始未修改的公式文本）
  for (let i = 0; i < mathStore.length; i++) {
    const match = mathStore[i]
    let expression = ''
    let displayMode = false

    if (match.startsWith('$$') && match.endsWith('$$')) {
      expression = match.slice(2, -2)
      displayMode = true
    } else if (match.startsWith('\\[') && match.endsWith('\\]')) {
      expression = match.slice(2, -2)
      displayMode = true
    } else if (match.startsWith('$') && match.endsWith('$')) {
      expression = match.slice(1, -1)
      displayMode = false
    } else if (match.startsWith('\\(') && match.endsWith('\\)')) {
      expression = match.slice(2, -2)
      displayMode = false
    }

    let rendered
    if (expression.trim()) {
      try {
        rendered = katex.renderToString(expression, {
          throwOnError: true,
          displayMode: displayMode,
          strict: false
        })
      } catch (e) {
        if (!displayMode) {
          try {
            rendered = katex.renderToString(expression, {
              throwOnError: false,
              displayMode: true,
              strict: false
            })
          } catch (e2) {
            console.warn('KaTeX render error:', e2)
            rendered = `<span class="katex-error" style="color:#ff4d4f;border-bottom:1px dashed #ff4d4f;" title="${e2.message.replace(/"/g, '&quot;')}">${match.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
          }
        } else {
          console.warn('KaTeX render error:', e)
          rendered = `<span class="katex-error" style="color:#ff4d4f;border-bottom:1px dashed #ff4d4f;" title="${e.message.replace(/"/g, '&quot;')}">${match.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
        }
      }
    } else {
      rendered = ''
    }

    const ph = MATH_PH_PREFIX + i + '__'
    currentText = currentText.replace(ph, rendered)
  }

  // 第四步：处理非公式文本中的特殊符号
  currentText = currentText.replace(/\\neq?(?!\s*[a-zA-Z])/g, (match) => {
    try {
      return katex.renderToString('\\neq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return match
    }
  })

  currentText = currentText.replace(/≠/g, (match) => {
    try {
      return katex.renderToString('\\neq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return match
    }
  })

  currentText = currentText.replace(/≤/g, (match) => {
    try {
      return katex.renderToString('\\leq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return match
    }
  })

  currentText = currentText.replace(/≥/g, (match) => {
    try {
      return katex.renderToString('\\geq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return match
    }
  })

  // 第五步：隔离 SVG 后转义换行
  const svgPlaceholders = []
  currentText = currentText.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, (match) => {
    const p = `__SVG_PH_${svgPlaceholders.length}__`
    svgPlaceholders.push({ p, content: match })
    return p
  })

  currentText = currentText.replace(/\n/g, '<br>')

  svgPlaceholders.forEach(({ p, content }) => {
    currentText = currentText.replace(p, content)
  })

  return currentText
}

// 格式化日期
const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}

// 去除HTML标签
const stripHtml = (html) => {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '')
}

// 切换解析显示
// 查看题目详情
const viewQuestionDetail = (q) => {
  router.push(`/user-exam/math-paper/${q.QuestionID}`)
}

// 是否在试题篮中
const isInBasket = (q) => {
  return basket.value.some(item => item.QuestionID === q.QuestionID)
}

// 切换试题篮
const toggleBasket = (q) => {
  if (isInBasket(q)) {
    removeFromBasket(q)
  } else {
    basket.value.push(q)
    ElMessage.success('已添加到试题篮')
  }
}

// 从试题篮移除
const removeFromBasket = (q) => {
  const idx = basket.value.findIndex(item => item.QuestionID === q.QuestionID)
  if (idx > -1) {
    basket.value.splice(idx, 1)
    ElMessage.success('已从试题篮移除')
  }
}

// 按题型移除
const removeByType = (type) => {
  basket.value = basket.value.filter(q => q.QuestionType !== type)
  ElMessage.success(`已移除所有${type}题目`)
}

// 清空试题篮
const clearBasket = () => {
  basket.value = []
  ElMessage.success('已清空试题篮')
}

// 去组卷中心
const goToMakePaper = () => {
  router.push('/exam/make-paper')
}

// 进入管理后台
const goToAdmin = () => {
  const token = localStorage.getItem('admin_token')
  if (!token) {
    router.push('/login')
  } else {
    window.open(`/admin-panel/#/questions/math`, '_blank')
  }
}

// 生成试卷
const generatePaper = () => {
  ElMessage.success('试卷生成成功！')
  showBasket.value = false
}

// 回到顶部
const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 监听滚动
const handleScroll = () => {
  showBackTop.value = window.scrollY > 300
}

// 拖动试题篮
const startDrag = (e) => {
  if (e.button !== 0) return
  isDragging.value = true
  hasDragged.value = false
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
  
  const cart = document.querySelector('.float-cart')
  if (!cart) return
  
  const rect = cart.getBoundingClientRect()
  const startX = rect.left
  const startY = rect.top
  
  const onMouseMove = (moveEvent) => {
    hasDragged.value = true
    const deltaX = moveEvent.clientX - dragStartX.value
    const deltaY = moveEvent.clientY - dragStartY.value
    
    cart.style.left = `${startX + deltaX}px`
    cart.style.top = `${startY + deltaY}px`
    cart.style.right = 'auto'
    cart.style.transform = 'none'
  }
  
  const onMouseUp = (upEvent) => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    
    // 松开后贴到右侧，保持当前垂直位置
    const currentY = startY + (upEvent.clientY - dragStartY.value)
    const maxY = window.innerHeight - 60
    
    setTimeout(() => {
      cart.style.left = 'auto'
      cart.style.right = '20px'
      cart.style.top = `${Math.max(60, Math.min(currentY, maxY))}px`
      cart.style.transform = 'none'
    }, 50)
  }
  
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// 处理试题篮点击
const handleCartClick = () => {
  if (!hasDragged.value) {
    showBasket.value = true
  }
}

// 页面跳转
const goToPage = (p) => {
  if (p < 1 || p > Math.ceil(totalQuestions.value / pageSize.value)) return
  if (p === page.value) return
  page.value = p
  if (currentTab.value === 'book') {
    applyLocalFilter()
  } else {
    loadQuestions(true)
  }
  updateUrlDebounced()
}

onMounted(async () => {
  await loadKnowledgePoints()
  
  // 尝试恢复状态
  const hasState = restorePageState()
  
  // 加载题目
  loadQuestions()
  
  window.addEventListener('scroll', handleScroll)
  checkAdmin()
  
  nextTick(() => {
    setTimeout(() => {
      autoAdjustAllOptionLayouts()
    }, 500)
  })
})

// 监听浏览器前进/后退导致的URL变化
let isInternalUrlUpdate = false
watch(() => route.query, (newQuery) => {
  if (isInternalUrlUpdate) return
  // URL参数有变化，恢复状态
  restorePageState()
  loadQuestions(true)
}, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})

// 当从详情页返回时激活组件
onActivated(() => {
  // 恢复滚动位置
  const savedState = sessionStorage.getItem('math_paper_select_state')
  if (savedState) {
    try {
      const state = JSON.parse(savedState)
      if (state.scrollTop) {
        setTimeout(() => {
          window.scrollTo(0, state.scrollTop)
        }, 50)
      }
      // 展开选中的考点树节点
      if (state.selectedKps && state.selectedKps.length > 0) {
        expandSelectedKps()
      }
    } catch (e) {
      console.error('恢复滚动位置失败:', e)
    }
  }
})

// 检查是否为管理员
const checkAdmin = () => {
  try {
    const userInfo = JSON.parse(localStorage.getItem('admin_user_info') || '{}')
    isAdmin.value = userInfo.role === 'admin' || userInfo.isAdmin === true
  } catch (e) {
    isAdmin.value = false
  }
}

// 打开编辑弹窗
// 打开纠错弹窗
const openCorrectionDialog = (q) => {
  correctionForm.value = {
    QuestionID: q.QuestionID,
    ErrorType: '',
    Description: '',
    CorrectContent: ''
  }
  showCorrectionDialog.value = true
}

// 提交纠错
const submitCorrection = async () => {
  if (!correctionForm.value.ErrorType) {
    ElMessage.warning('请选择错误类型')
    return
  }
  if (!correctionForm.value.Description) {
    ElMessage.warning('请填写错误描述')
    return
  }
  
  try {
    const res = await adminApi.submitMathCorrection({
      QuestionID: correctionForm.value.QuestionID,
      ErrorType: correctionForm.value.ErrorType,
      Description: correctionForm.value.Description,
      CorrectContent: correctionForm.value.CorrectContent
    })
    if (res.code === 0) {
      ElMessage.success('纠错提交成功，感谢您的反馈！')
      showCorrectionDialog.value = false
    } else {
      ElMessage.error(res.message || '提交失败')
    }
  } catch (err) {
    console.error('提交纠错失败:', err)
    ElMessage.error('提交失败，请稍后重试')
  }
}

const openEditDialog = (q) => {
  editingQuestion.value = q
  editForm.value = {
    QuestionText: q.QuestionText || '',
    analysis: q.analysis || '',
    Answer: q.Answer || '',
    Difficulty: q.Difficulty || 0.5,
    QuestionType: q.QuestionType || ''
  }
  showEditDialog.value = true
}

// 保存编辑
const saveEdit = async () => {
  if (!editingQuestion.value) return
  try {
    const res = await adminApi.updateMathQuestion(editingQuestion.value.QuestionID, editForm.value)
    if (res.code === 0 || res.code === 200) {
      ElMessage.success('保存成功')
      // 更新本地数据
      const idx = questions.value.findIndex(q => q.QuestionID === editingQuestion.value.QuestionID)
      if (idx > -1) {
        questions.value[idx] = { ...questions.value[idx], ...editForm.value }
      }
      showEditDialog.value = false
    }
  } catch (err) {
    ElMessage.error('保存失败')
    console.error(err)
  }
}

// 模拟数据
const getMockKpData = () => {
  return [
    {
      id: 1, name: '高数', questionCount: 156, expanded: false,
      children: [
        { id: 11, name: '第1章 高等数学的准备知识', questionCount: 45, children: [
          { id: 111, name: '函数的概念与性质', questionCount: 20 },
          { id: 112, name: '极限的概念', questionCount: 25 }
        ]},
        { id: 12, name: '第2章 极限与连续', questionCount: 38, children: [
          { id: 121, name: '数列极限', questionCount: 18 },
          { id: 122, name: '函数极限', questionCount: 20 }
        ]}
      ]
    },
    {
      id: 2, name: '线代', questionCount: 328, expanded: false,
      children: [
        { id: 21, name: '第1章 行列式', questionCount: 89, children: [
          { id: 211, name: '行列式的定义', questionCount: 40 },
          { id: 212, name: '行列式的性质', questionCount: 49 }
        ]}
      ]
    },
    { id: -1, name: '未分类', code: 'unclassified', children: [], expanded: false, questionCount: 0 }
  ]
}

const getMockQuestions = () => {
  return [
    {
      QuestionID: 1,
      QuestionText: '已知集合 $A = \\{-1, 0, 1, 3, 5\\}$，全集 $U = R$ 和集合 $B$。若 $(\\complement_U B) \\cap A = \\{5\\}$，则可能正确的是（ ）',
      QuestionType: '选择题',
      Difficulty: 0.6,
      ShortTitle: '2025 · 广东月考',
      BookID: 1001,
      options: [
        { label: 'A', text: '$B = \\{x | x > 5\\}$' },
        { label: 'B', text: '$B = \\{x | x < 5\\}$' },
        { label: 'C', text: '$B = \\{x | 0 < x < 5\\}$' },
        { label: 'D', text: '$B = \\{x | -1 < x < 3\\}$' }
      ],
      UpdatedAt: '2025-02-12',
      usageCount: 841,
      refCount: 2,
      analysis: '【答案】C<br>【解析】由题意可知...'
    }
  ]
}
</script>

<style scoped>
.paper-select-page {
  min-height: 100vh;
  background: #f5f5f5;
  font-size: 14px;
  color: #333;
}

/* 顶部导航 */
.top-nav {
  background: #1890ff;
  height: 50px;
  line-height: 50px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  color: white;
  position: relative;
  z-index: 200;
}
.nav-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.subject-selector {
  color: white;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  user-select: none;
}
.subject-selector .arrow {
  font-size: 12px;
}
.nav-divider {
  color: rgba(255,255,255,.5);
  margin: 0 10px;
}
.nav-location {
  color: white;
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 14px;
  cursor: pointer;
}
.nav-menu {
  display: flex;
  margin-left: 30px;
  gap: 0;
}
.nav-menu a {
  color: white;
  padding: 0 18px;
  font-size: 15px;
  display: block;
  height: 50px;
  line-height: 50px;
  position: relative;
  transition: background .2s;
  text-decoration: none;
}
.nav-menu a:hover {
  background: rgba(255,255,255,.1);
}
.nav-menu a.active {
  background: #096dd9;
  font-weight: bold;
}
.nav-menu a.active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid white;
}
.nav-menu a.admin-btn {
  background: rgba(255,255,255,.15);
  border: 1px solid rgba(255,255,255,.4);
  border-radius: 4px;
  margin: auto 0 auto 15px;
  padding: 0 15px;
  height: 34px;
  line-height: 34px;
  font-size: 13px;
  cursor: pointer;
}
.nav-menu a.admin-btn:hover {
  background: rgba(255,255,255,.25);
}
.nav-menu a.nav-btn {
  background: rgba(255, 193, 7, 0.2);
  border: 1px solid rgba(255, 193, 7, 0.6);
  border-radius: 4px;
  margin: auto 0 auto 10px;
  padding: 0 15px;
  height: 34px;
  line-height: 34px;
  font-size: 13px;
  cursor: pointer;
  color: #fff3cd;
  text-decoration: none;
}
.nav-menu a.nav-btn:hover {
  background: rgba(255, 193, 7, 0.35);
}
.nav-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 15px;
}
.nav-right a {
  color: white;
  font-size: 14px;
  text-decoration: none;
}

/* 面包屑 */
.breadcrumb {
  background: #f5f5f5;
  padding: 8px 20px;
  font-size: 13px;
  color: #666;
  border-bottom: 1px solid #e8e8e8;
}
.breadcrumb a {
  color: #1890ff;
  text-decoration: none;
}
.breadcrumb .sep {
  margin: 0 5px;
  color: #999;
}

/* 主容器 */
.main-container {
  display: flex;
  max-width: 1400px;
  margin: 0 auto;
  padding: 15px 20px;
  gap: 15px;
}

/* 左侧边栏 */
.sidebar {
  width: 260px;
  flex-shrink: 0;
  background: white;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
  overflow: hidden;
  position: relative;
}
.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid #e8e8e8;
}
.sidebar-tab {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 14px;
  cursor: pointer;
  color: #666;
  user-select: none;
}
.sidebar-tab.active {
  color: #1890ff;
  font-weight: bold;
  border-bottom: 2px solid #1890ff;
  margin-bottom: -1px;
  background: #e6f7ff;
}
.sidebar-tab:hover:not(.active) {
  background: #fafafa;
}
.sidebar-search {
  padding: 10px;
  border-bottom: 1px solid #e8e8e8;
}
.book-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.book-option-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.subject-tag {
  flex-shrink: 0;
  margin-left: 6px;
  font-size: 12px;
  color: #1890ff;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  padding: 0 6px;
  border-radius: 3px;
  white-space: nowrap;
  line-height: 1.6;
}
.version-tag {
  flex-shrink: 0;
  margin-left: 6px;
  font-size: 12px;
  color: #722ed1;
  background: #f9f0ff;
  border: 1px solid #d3adf7;
  padding: 0 6px;
  border-radius: 3px;
  white-space: nowrap;
  line-height: 1.6;
}
.content-type-tag {
  flex-shrink: 0;
  margin-left: 4px;
  font-size: 11px;
  padding: 0 5px;
  border-radius: 3px;
  white-space: nowrap;
  line-height: 1.6;
}
.content-type-tag.type-mock {
  color: #cf8a00;
  background: #fffbe6;
  border: 1px solid #ffe58f;
}
.content-type-tag.type-real {
  color: #cf1322;
  background: #fff1f0;
  border: 1px solid #ffa39e;
}
.sidebar-options {
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  border-bottom: 1px solid #e8e8e8;
}
.toggle-switch {
  display: flex;
  align-items: center;
  gap: 5px;
  user-select: none;
  cursor: pointer;
}
.switch {
  width: 36px;
  height: 20px;
  background: #bfbfbf;
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: background .3s;
  flex-shrink: 0;
}
.switch.on {
  background: #1890ff;
}
.switch::after {
  content: "";
  position: absolute;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: left .3s;
  box-shadow: 0 1px 3px rgba(0,0,0,.2);
}
.switch.on::after {
  left: 18px;
}
.radio-group {
  display: flex;
  gap: 8px;
}
.radio-group label {
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  color: #666;
  user-select: none;
}
.radio-group.disabled {
  opacity: .4;
  pointer-events: none;
}

/* 知识点树 */
.tree-container {
  overflow-y: auto;
  padding: 5px 0;
}
.tree-item {
  user-select: none;
}
.tree-node {
  display: flex;
  align-items: center;
  padding: 6px 10px 6px 15px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  transition: background .2s;
}
.tree-node:hover {
  background: #f5f5f5;
}
.tree-node.selected {
  background: #e6f7ff;
  color: #1890ff;
}
.tree-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 5px;
  font-size: 12px;
  color: #1890ff;
  flex-shrink: 0;
  cursor: pointer;
}
.tree-icon {
  width: 16px;
  height: 16px;
  margin-right: 5px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tree-icon .plus {
  color: #1890ff;
  font-size: 14px;
  font-weight: bold;
}
.tree-name {
  flex: 1;
}
.tree-count {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
}
.tree-children .tree-node {
  padding-left: 25px;
}
.tree-children .tree-children .tree-node {
  padding-left: 35px;
}

/* 右侧内容区 */
.content-area {
  flex: 1;
  min-width: 0;
}

/* 书籍挑题上下文 */
.book-context-bar {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 4px;
  padding: 10px 16px;
  margin-bottom: 12px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.book-context-label {
  color: #666;
}
.book-context-name {
  color: #1890ff;
  font-weight: bold;
}
.book-context-sep {
  color: #ccc;
}
.book-context-chapter {
  color: #333;
  font-weight: bold;
}
.book-context-count {
  margin-left: auto;
  color: #999;
  font-size: 12px;
}

/* 筛选面板 */
.filter-panel {
  background: white;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
  padding: 15px 20px;
  margin-bottom: 15px;
}
.filter-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
  font-size: 13px;
}
.filter-row:last-child {
  margin-bottom: 0;
}
.filter-label {
  width: 50px;
  flex-shrink: 0;
  color: #1890ff;
  padding-top: 3px;
}
.filter-options {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.filter-options a {
  padding: 3px 10px;
  border-radius: 3px;
  color: #666;
  transition: all .2s;
  cursor: pointer;
  user-select: none;
  border: 1px solid transparent;
}
.filter-options a:hover {
  color: #1890ff;
}
.filter-options a.active {
  background: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
}
.filter-options .count {
  color: #ff4d4f;
  font-weight: bold;
  margin-left: 5px;
}

/* 题目列表 */
.question-list {
  background: white;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
  padding: 0 20px;
}
.question-item {
  padding: 20px 0;
  border-bottom: 1px solid #f0f0f0;
  position: relative;
}
.question-item:last-child {
  border-bottom: none;
}
.question-num {
  color: #1890ff;
  font-weight: bold;
  font-size: 15px;
  margin-right: 4px;
}
.question-source {
  color: #1890ff;
  font-size: 13px;
  cursor: pointer;
  margin-right: 4px;
}
.question-source:hover {
  text-decoration: underline;
}
.question-source.is-paper {
  color: #e67e22;
  font-weight: bold;
  border-bottom: 1px dashed #e67e22;
}
.question-source.is-paper:hover {
  color: #d35400;
  border-bottom-style: solid;
}
.question-body {
  font-size: 15px;
  line-height: 1.8;
  color: #333;
  margin-bottom: 12px;
  font-family: 'Times New Roman', 'SimSun', serif;
}

.question-body .question-text {
  display: inline;
}

.question-body :deep(.katex) {
  font-family: 'Times New Roman', serif;
}

.question-body :deep(.katex .mord),
.question-body :deep(.katex .mbin),
.question-body :deep(.katex .mrel),
.question-body :deep(.katex .mopen),
.question-body :deep(.katex .mclose),
.question-body :deep(.katex .mpunct),
.question-body :deep(.katex .minner) {
  font-family: 'Times New Roman', serif;
}
.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 40px;
  margin-bottom: 15px;
}
.option-item {
  font-size: 14px;
  line-height: 1.8;
  color: #333;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 3px;
  transition: background .2s;
  word-break: break-word;
  white-space: normal;
  border: 1px solid transparent;
  font-family: 'Times New Roman', 'SimSun', serif;
}

.option-item :deep(.katex) {
  font-family: 'Times New Roman', serif;
}

.option-item :deep(.katex .mord),
.option-item :deep(.katex .mbin),
.option-item :deep(.katex .mrel),
.option-item :deep(.katex .mopen),
.option-item :deep(.katex .mclose),
.option-item :deep(.katex .mpunct),
.option-item :deep(.katex .minner) {
  font-family: 'Times New Roman', serif;
}
.option-item:hover {
  background: #f5f5f5;
}
.option-item .opt-label {
  font-weight: bold;
  margin-right: 5px;
}

/* 题目底部 */
.question-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px dashed #e8e8e8;
}
.footer-left {
  display: flex;
  align-items: center;
  gap: 15px;
  font-size: 12px;
  color: #999;
}
.footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.footer-right a {
  font-size: 13px;
  color: #1890ff;
  cursor: pointer;
  user-select: none;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background .2s;
}
.footer-right a:hover {
  background: #e6f7ff;
}
.footer-right .edit-link {
  color: #52c41a;
}
.footer-right .edit-link:hover {
  background: #f6ffed;
}
.layout-separator {
  color: #d9d9d9;
  margin: 0 4px;
}
.layout-label {
  font-size: 13px;
  color: #666;
  margin-right: 4px;
}
.layout-btn-small {
  padding: 2px 8px;
  font-size: 12px;
  border: 1px solid #d9d9d9;
  background: #fff;
  border-radius: 3px;
  cursor: pointer;
  margin-right: 4px;
  transition: all 0.2s;
}
.layout-btn-small:hover {
  border-color: #1890ff;
  color: #1890ff;
}
.layout-btn-small.active {
  background: #1890ff;
  border-color: #1890ff;
  color: #fff;
}
.add-btn {
  background: #ff8c00;
  color: white;
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  border: none;
  transition: background .2s;
  user-select: none;
}
.add-btn:hover {
  background: #ff7a00;
}
.add-btn.added {
  background: #52c41a;
}

/* 解析面板 */
.parse-panel {
  padding-left: 28px;
  margin-top: 10px;
  background: #fafafa;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
  overflow: hidden;
  max-height: 0;
  transition: max-height .3s ease, padding .3s ease;
}
.parse-panel.open {
  padding: 15px;
  cursor: pointer;
}
.parse-panel h4 {
  color: #1890ff;
  margin-bottom: 10px;
  font-size: 14px;
}
.parse-panel .close-hint {
  font-size: 12px;
  color: #999;
  font-weight: normal;
  margin-left: 10px;
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 15px 0;
  gap: 5px;
  background: white;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
  margin-top: 15px;
  padding: 15px 20px;
}
.pagination a {
  padding: 5px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  transition: all .2s;
  user-select: none;
  background: white;
}
.pagination a:hover {
  border-color: #1890ff;
  color: #1890ff;
}
.pagination a.active {
  background: #1890ff;
  color: white;
  border-color: #1890ff;
}
.pagination a.disabled {
  color: #bfbfbf;
  cursor: not-allowed;
  border-color: #d9d9d9;
}
.page-input {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: 10px;
  font-size: 13px;
  color: #666;
}
.page-input input {
  width: 40px;
  padding: 4px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  text-align: center;
  font-size: 13px;
  outline: none;
}
.page-input input:focus {
  border-color: #1890ff;
}

/* 右侧悬浮试题篮 */
.float-cart {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 50px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  flex-direction: column;
  gap: 2px;
  border: 1px solid #e8e8e8;
  padding: 8px 0;
  transition: transform .2s;
}
.float-cart:hover {
  transform: translateY(-50%) scale(1.05);
}
.cart-icon {
  width: 24px;
  height: 24px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23ff8c00' viewBox='0 0 24 24'%3E%3Cpath d='M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z'/%3E%3C/svg%3E") center/contain no-repeat;
}
.cart-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #ff4d4f;
  color: white;
  font-size: 11px;
  min-width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  font-weight: bold;
}
.cart-text {
  font-size: 11px;
  color: #666;
}

/* 回到顶部 */
.back-top {
  position: fixed;
  right: 20px;
  bottom: 80px;
  width: 40px;
  height: 40px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  border: 1px solid #e8e8e8;
  color: #999;
  font-size: 18px;
  opacity: 0;
  visibility: hidden;
  transition: all .3s;
}
.back-top.show {
  opacity: 1;
  visibility: visible;
}
.back-top:hover {
  color: #1890ff;
  border-color: #1890ff;
}

/* 题目列表区域 */
.question-area {
  position: relative;
  min-height: 200px;
}

.question-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #999;
  font-size: 14px;
  z-index: 10;
  pointer-events: none;
}

/* 空状态 */
.empty {
  text-align: center;
  padding: 60px;
  color: #999;
  background: white;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
}

/* 淡入淡出过渡 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 图片样式 */
.question-body :deep(.question-img) {
  max-width: 100%;
  max-height: 120px;
  width: auto;
  height: auto;
  display: block;
  margin: 8px 0;
  border-radius: 4px;
  object-fit: contain;
}

.question-body :deep(img) {
  max-width: 100%;
  max-height: 120px;
  width: auto;
  height: auto;
  display: block;
  margin: 8px 0;
  border-radius: 4px;
  object-fit: contain;
}

.parse-panel :deep(.question-img),
.parse-panel :deep(img) {
  max-width: 100%;
  max-height: 120px;
  width: auto;
  height: auto;
  display: block;
  margin: 8px 0;
  border-radius: 4px;
  object-fit: contain;
}

/* 新罗马字体 - 数字和字母 */
.question-body,
.parse-panel,
.options-grid,
.filter-panel,
.pagination,
.float-cart {
}

.question-body :deep(span),
.parse-panel :deep(span),
.option-item {
}

/* 拖动时的样式 */
.float-cart.dragging {
  opacity: 0.8;
  cursor: move;
  box-shadow: 0 4px 16px rgba(0,0,0,.25);
}

/* 已加入试题篮的题目高亮 */
.question-item.in-basket {
  background: #f6ffed;
  border: 2px solid #52c41a;
  border-radius: 8px;
  padding: 18px;
  margin: 0 -10px;
}
.question-item.in-basket .question-num,
.question-item.in-basket .question-source {
  color: #52c41a;
}

/* 试题篮抽屉样式 */
.basket-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.basket-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}
.basket-drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: bold;
  color: #333;
}
.basket-count {
  background: #ff8c00;
  color: white;
  font-size: 12px;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}
.basket-stats {
  padding: 12px 20px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}
.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.stats-row strong {
  color: #ff8c00;
  font-size: 16px;
}
.stats-actions {
  display: flex;
  gap: 10px;
}
.stats-types {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.type-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: white;
  border: 1px solid #d9d9d9;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
  color: #666;
}
.type-delete {
  cursor: pointer;
  color: #ff4d4f;
  font-size: 12px;
}
.type-delete:hover {
  color: #ff7875;
}
.basket-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
}
.basket-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 20px;
}

.basket-footer {
  padding: 15px 20px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 10px;
  justify-content: center;
}
.basket-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background .2s;
  border: 1px solid transparent;
  margin-bottom: 8px;
}
.basket-item:hover {
  background: #f5f5f5;
}
.basket-item.active {
  background: #e6f7ff;
  border-color: #1890ff;
}
.basket-item-num {
  flex-shrink: 0;
  font-weight: bold;
  color: #1890ff;
  font-size: 14px;
  margin-top: 2px;
}
.basket-item-content {
  flex: 1;
  min-width: 0;
}
.basket-item-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  font-family: 'Times New Roman', 'SimSun', serif;
}

.basket-item-text :deep(.katex) {
  font-family: 'Times New Roman', serif;
}

.basket-item-text :deep(.katex .mord),
.basket-item-text :deep(.katex .mbin),
.basket-item-text :deep(.katex .mrel),
.basket-item-text :deep(.katex .mopen),
.basket-item-text :deep(.katex .mclose),
.basket-item-text :deep(.katex .mpunct),
.basket-item-text :deep(.katex .minner) {
  font-family: 'Times New Roman', serif;
}

.basket-item-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
  font-size: 13px;
  color: #666;
  font-family: 'Times New Roman', 'SimSun', serif;
}
.basket-opt {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.basket-item-delete {
  flex-shrink: 0;
  margin-top: 2px;
}

.custom-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
  margin: 0 2px;
}
.custom-tag.answer {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}
.custom-tag.analysis {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1565c0;
  border: 1px solid #90caf9;
}
.custom-tag.commentary {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  color: #e65100;
  border: 1px solid #ffcc80;
}
.custom-tag.note {
  background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
  color: #616161;
  font-style: italic;
  border: 1px solid #bdbdbd;
}
.custom-tag.step {
  background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%);
  color: #c2185b;
  border: 1px solid #f48fb1;
}

/* 相似题弹窗 */
.similar-list {
  max-height: 500px;
  overflow-y: auto;
}
.similar-item {
  display: flex;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}
.similar-item:last-child {
  border-bottom: none;
}
.similar-num {
  width: 24px;
  font-weight: bold;
  color: #1890ff;
  flex-shrink: 0;
}
.similar-body {
  flex: 1;
  min-width: 0;
}
.similar-type {
  display: inline-block;
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}
.similar-text {
  font-size: 14px;
  line-height: 1.6;
}
.similar-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
</style>
