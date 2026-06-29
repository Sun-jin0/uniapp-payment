<template>
  <view class="config-container">
    <main class="main-content">
      <!-- 模式切换 -->
      <section class="mode-toggle-section">
        <view class="mode-tabs">
          <view 
            class="mode-tab" 
            :class="{ active: compositionMode === 'smart' }"
            @click="compositionMode = 'smart'"
          >
            智能组卷
          </view>
          <view 
            class="mode-tab" 
            :class="{ active: compositionMode === 'manual' }"
            @click="compositionMode = 'manual'"
          >
            手动组卷
          </view>
          <view 
            class="mode-tab" 
            :class="{ active: compositionMode === 'my-papers' }"
            @click="compositionMode = 'my-papers'; fetchGeneratedPapers();"
          >
            我的组卷
          </view>
        </view>
      </section>

      <!-- 智能组卷模式内容 -->
      <template v-if="compositionMode === 'smart'">
        <!-- 科目选择 (如果URL没带subjectId则显示) -->
        <section class="config-section" v-if="!fixedSubject">
          <h2 class="section-title">1. 选择科目</h2>
          <view class="subject-selector">
            <view 
              v-for="subject in displaySubjects" 
              :key="subject.id"
              class="subject-chip"
              :class="{ active: selectedSubjectId === subject.id }"
              @click="selectSubject(subject.id)"
            >
              {{ subject.name }}
            </view>
          </view>
        </section>

        <!-- 范围选择 -->
        <!-- 模式切换 -->
        <section class="config-section mode-section" v-if="selectedSubjectId">
          <view class="mode-tabs">
            <view 
              class="mode-tab" 
              :class="{ active: selectionMode === 'book' }"
              @click="selectionMode = 'book'"
            >
              <text>书籍/试卷</text>
            </view>
            <view 
              class="mode-tab" 
              :class="{ active: selectionMode === 'knowledge' }"
              @click="switchToKnowledgeMode"
            >
              <text>考点</text>
            </view>
          </view>
        </section>

        <!-- 书籍/试卷模式 -->
        <section class="config-section" v-if="selectedSubjectId && selectionMode === 'book'">
          <view class="section-header-row">
            <h2 class="section-title">1. 选择范围</h2>
            <button class="select-scope-btn" @click="showScopeModal = true">
              {{ selectedScope.length > 0 ? `已选 ${selectedScope.length} 本书` : '选择书籍/章节' }}
            </button>
          </view>
          
          <!-- 已选范围简览 -->
          <view class="selected-scope-preview" v-if="selectedScope.length > 0">
            <view v-for="item in selectedScope" :key="item.bookId" class="scope-preview-item">
              <view class="item-main">
                <span class="book-name">{{ getBookTitle(item.bookId) }}</span>
                <span class="chapter-count" v-if="item.chapters.length > 0">({{ item.chapters.length }}个章节)</span>
                <span class="chapter-count" v-else>(整本书)</span>
              </view>
              <!-- 显示该书/章节的自定义题量汇总 -->
              <view class="item-configs" v-if="hasCustomConfig(item)">
                <span class="config-tag" v-if="getScopeTotal(item, 'choice') > 0">选:{{ getScopeTotal(item, 'choice') }}</span>
                <span class="config-tag" v-if="getScopeTotal(item, 'fill') > 0">填:{{ getScopeTotal(item, 'fill') }}</span>
                <span class="config-tag" v-if="getScopeTotal(item, 'analysis') > 0">解:{{ getScopeTotal(item, 'analysis') }}</span>
              </view>
            </view>
          </view>
        </section>

        <!-- 考点模式 -->
        <section class="config-section" v-if="selectedSubjectId && selectionMode === 'knowledge'">
          <view class="section-header-row">
            <h2 class="section-title">1. 选择考点</h2>
            <button class="select-scope-btn" @click="showKnowledgeModal = true">
              {{ selectedKnowledgePoints.length > 0 ? `已选 ${selectedKnowledgePoints.length} 个考点` : '选择考点' }}
            </button>
          </view>
          
          <!-- 已选考点简览 -->
          <view class="selected-scope-preview" v-if="selectedKnowledgePoints.length > 0">
            <view v-for="point in selectedKnowledgePoints" :key="point.id" class="scope-preview-item">
              <view class="item-main">
                <span class="book-name">{{ point.name }}</span>
              </view>
              <view class="item-configs" v-if="point.choice > 0 || point.fill > 0 || point.analysis > 0">
                <span class="config-tag" v-if="point.choice > 0">选:{{ point.choice }}</span>
                <span class="config-tag" v-if="point.fill > 0">填:{{ point.fill }}</span>
                <span class="config-tag" v-if="point.analysis > 0">解:{{ point.analysis }}</span>
              </view>
            </view>
          </view>
        </section>

        <!-- 题型数量设置 -->
        <section class="config-section">
          <h2 class="section-title">2. 题型数量设置 (总计 {{ totalQuestions }} 题)</h2>
          <view class="count-setters">
            <view class="count-item">
              <view class="type-info">
                <span class="type-label">选择题</span>
                <span class="custom-hint" v-if="totalCustomCounts.choice > 0">(含自定义 {{ totalCustomCounts.choice }} 题)</span>
              </view>
              <view class="counter">
                <button @click="adjustCount('choice', -1)" :disabled="counts.choice <= totalCustomCounts.choice">-</button>
                <input 
                  type="number" 
                  v-model.number="counts.choice" 
                  :min="totalCustomCounts.choice" 
                  @input="userModifiedCounts.choice = true"
                />
                <button @click="adjustCount('choice', 1)">+</button>
              </view>
            </view>
            <view class="count-item">
              <view class="type-info">
                <span class="type-label">填空题</span>
                <span class="custom-hint" v-if="totalCustomCounts.fill > 0">(含自定义 {{ totalCustomCounts.fill }} 题)</span>
              </view>
              <view class="counter">
                <button @click="adjustCount('fill', -1)" :disabled="counts.fill <= totalCustomCounts.fill">-</button>
                <input 
                  type="number" 
                  v-model.number="counts.fill" 
                  :min="totalCustomCounts.fill" 
                  @input="userModifiedCounts.fill = true"
                />
                <button @click="adjustCount('fill', 1)">+</button>
              </view>
            </view>
            <view class="count-item">
              <view class="type-info">
                <span class="type-label">解答题</span>
                <span class="custom-hint" v-if="totalCustomCounts.analysis > 0">(含自定义 {{ totalCustomCounts.analysis }} 题)</span>
              </view>
              <view class="counter">
                <button @click="adjustCount('analysis', -1)" :disabled="counts.analysis <= totalCustomCounts.analysis">-</button>
                <input 
                  type="number" 
                  v-model.number="counts.analysis" 
                  :min="totalCustomCounts.analysis" 
                  @input="userModifiedCounts.analysis = true"
                />
                <button @click="adjustCount('analysis', 1)">+</button>
              </view>
            </view>
          </view>
        </section>

        <!-- 原生模板广告1 -->
        <!-- #ifdef MP-WEIXIN -->
        <view class="section-ad-container">
          <ad-custom 
            unit-id="adunit-2960f0cf4755f417" 
            @load="adLoad" 
            @error="adError" 
            @close="adClose"
          ></ad-custom>
        </view>
        <!-- #endif -->
      </template>

      <!-- 手动组卷模式内容 -->
      <template v-else-if="compositionMode === 'manual'">
        <section class="config-section manual-section">
          <view class="section-header-row">
            <view class="manual-header-info">
              <span class="manual-count" v-if="manualQuestions.length > 0">已选 {{ manualQuestions.length }} 题</span>
              <button v-if="manualQuestions.length > 0" class="clear-btn" @click="clearManualQuestions">清空</button>
            </view>
            <view class="manual-actions">
              <button class="action-chip" @click="searchByQuestionId">ID 添加</button>
              <button class="action-chip primary" @click="openSourceSelector">资源选择</button>
            </view>
          </view>

          <!-- 已选题目列表 -->
          <view v-if="manualQuestions.length > 0" class="manual-questions-grid">
            <view 
              v-for="(q, index) in manualQuestions" 
              :key="q.id + index" 
              class="manual-q-item"
              :class="{ dragging: dragIndex === index }"
              draggable="true"
              @dragstart="onDragStart($event, index)"
              @dragover.prevent="onDragOver($event, index)"
              @drop="onDrop($event, index)"
              @dragend="onDragEnd"
            >
              <image v-if="q.img" :src="q.img.replace('http://', 'https://')" class="manual-q-thumb" mode="widthFix" />
              <view v-else class="manual-q-no-thumb">
                <span class="q-type-tag">{{ q.type }}</span>
              </view>
              <view class="manual-q-number">{{ index + 1 }}</view>
              <view class="manual-q-remove" @click.stop="removeManualQuestion(index)">✕</view>
            </view>
          </view>
          <view class="manual-empty-tip" v-else>
            <span class="empty-icon">📂</span>
            <p class="tip">还没有添加题目，点击上方按钮开始挑选</p>
            <p class="tip" style="font-size: 24rpx; margin-top: 10rpx;">您可以从书架、收藏夹选择，或直接输入 ID</p>
          </view>
        </section>

        <!-- 原生模板广告2 -->
        <!-- #ifdef MP-WEIXIN -->
        <view class="section-ad-container">
          <ad-custom 
            unit-id="adunit-2960f0cf4755f417" 
            @load="adLoad" 
            @error="adError" 
            @close="adClose"
          ></ad-custom>
        </view>
        <!-- #endif -->
      </template>

      <!-- 我的组卷列表 -->
      <template v-if="compositionMode === 'my-papers'">
        <view class="papers-list" v-if="generatedPapers.length > 0">
          <view v-for="paper in generatedPapers" :key="paper.PaperID" class="paper-item" @click="goToPaper(paper.PaperID)">
            <view class="paper-info">
              <h3 class="paper-title">{{ paper.Title }}</h3>
              <p class="paper-meta">
                <span>{{ formatDate(paper.CreatedAt) }}</span>
                <span class="meta-divider">|</span>
                <span>{{ paper.QuestionCount }} 道题目</span>
              </p>
            </view>
            <view class="paper-action">
              <span class="action-btn">练习</span>
            </view>
          </view>
        </view>
        <view v-else class="empty-state">
          <view class="empty-icon">📝</view>
          <p>暂无组卷记录</p>
          <p class="tip">点击上方"智能组卷"或"手动组卷"开始</p>
        </view>
      </template>

      <view class="action-footer" v-if="compositionMode !== 'my-papers'">
        <view class="permission-tip-banner" v-if="paperPermission.role !== 1 && (!canGenerate || paperPermission.maxQuestions !== null)">
          <p class="permission-tip-text">
            <template v-if="!paperPermission.allowed">
              组卷功能暂不可用
            </template>
            <template v-else-if="paperPermission.maxQuestions !== null && totalQuestions > paperPermission.maxQuestions">
              题目数量超过限制（最多{{ paperPermission.maxQuestions }}题）
            </template>
            <template v-else-if="!canGenerate">
              {{ compositionMode === 'smart' ? '请选择科目、书籍及至少一个章节' : '请至少添加一道题目' }}
              <text v-if="paperPermission.maxQuestions !== null">（最多{{ paperPermission.maxQuestions }}题）</text>
            </template>
            <template v-else>
              每次组卷最多 {{ paperPermission.maxQuestions }} 题
            </template>
          </p>
        </view>
        <button 
          class="generate-btn" 
          :class="{ loading: generating, 'no-permission': !paperPermission.allowed || (paperPermission.maxQuestions !== null && totalQuestions > paperPermission.maxQuestions) }"
          @click="handleGenerateClick"
        >
          {{ generating ? '正在生成中...' : (compositionMode === 'smart' ? '开始智能组卷' : '完成手动组卷') }}
        </button>
      </view>
    </main>

    <!-- 资源选择弹窗 (手动模式) -->
    <view class="modal" v-if="showSourceSelector" @click="showSourceSelector = false">
      <view class="modal-content full-modal" @click.stop>
        <view class="modal-header">
          <h3 class="modal-title">选择题目资源</h3>
          <span class="close-btn" @click="showSourceSelector = false">×</span>
        </view>
        <view class="modal-body source-selector-body">
          <!-- 资源分类切换 -->
          <view class="source-tabs">
            <view v-for="tab in ['knowledge', 'bookshelf', 'favorite']" 
              :key="tab"
              class="source-tab"
              :class="{ active: currentSourceTab === tab }"
              @click="switchSourceTab(tab)"
            >
              {{ tab === 'bookshelf' ? '我的书架' : tab === 'knowledge' ? '考点' : '我的收藏' }}
            </view>
          </view>

          <!-- 书架内容 -->
          <view v-if="currentSourceTab === 'bookshelf'" class="source-content">
            <view v-if="!browsingSource" class="source-list">
              <view v-for="book in userBookshelf" :key="book.BookID" class="source-item" @click="browseSource(book)">
                <view class="source-item-icon">📚</view>
                <view class="source-item-info">
                  <view class="source-item-title">{{ book.BookTitle }}</view>
                  <view class="source-item-meta">{{ book.ContentType === 'mock_paper' ? '模拟卷' : book.ContentType === 'past_paper' ? '真题' : '书籍' }}</view>
                </view>
                <view class="source-item-arrow">❯</view>
              </view>
            </view>
            
            <!-- 正在浏览书籍详情 -->
            <view v-else class="source-detail">
              <view class="detail-header" @click="browsingSource = null">
                <span class="back-icon">❮</span>
                <span class="detail-title">{{ browsingSource.BookTitle }}</span>
              </view>
              
              <!-- 章节列表 -->
              <scroll-view v-if="!browsingChapter" class="chapter-list-simple" scroll-y>
                <view v-for="chap in sortedSourceChapters" :key="chap.name" class="chapter-row" @click="browseChapter(chap)">
                  <span>{{ chap.name }}</span>
                  <span class="q-count">{{ chap.questionCount || 0 }}题 ❯</span>
                </view>
              </scroll-view>

              <!-- 题目列表 -->
              <view v-else class="question-list-simple">
                <view class="detail-header sub" @click="browsingChapter = null">
                  <span class="back-icon">❮</span>
                  <span class="detail-title">{{ browsingChapter.name }}</span>
                </view>
                <scroll-view class="q-scroll-area" scroll-y>
                  <view v-if="loadingSourceQuestions" class="loading-inline">加载题目中...</view>
                  <view v-else class="q-items-grid">
                    <view 
                      v-for="q in sourceQuestions" 
                      :key="q.QuestionID" 
                      class="q-item-selectable"
                      :class="{ selected: isQuestionSelected(q.QuestionID) }"
                      @click="toggleManualQuestion(q)"
                    >
                      <image v-if="q.QuestionImg" :src="q.QuestionImg.replace('http://', 'https://')" class="q-thumb" mode="widthFix" />
                      <view v-else class="q-no-thumb">ID: {{ q.QuestionID }}</view>
                    </view>
                  </view>
                </scroll-view>
              </view>
            </view>
          </view>

          <!-- 考点内容 -->
          <view v-if="currentSourceTab === 'knowledge'" class="source-content">
            <scroll-view scroll-y class="source-scroll">
              <view v-if="knowledgePoints.length === 0" class="loading-inline">加载中...</view>
              <view v-else class="manual-knowledge-list">
                <!-- 科目层级 -->
                <view v-for="subject in knowledgePoints" :key="subject.id" class="manual-knowledge-subject">
                  <view class="manual-subject-title" @click="toggleManualKnowledgeSubject(subject.id)">
                    <text>{{ subject.name }}</text>
                    <text class="manual-toggle">{{ expandedManualSubjects.includes(subject.id) ? '▼' : '▶' }}</text>
                  </view>
                  
                  <!-- 章节层级 -->
                  <view v-if="expandedManualSubjects.includes(subject.id)" class="manual-chapter-list">
                    <view v-for="chapter in subject.chapters" :key="chapter.id" class="manual-chapter-item">
                      <view class="manual-chapter-header" @click="toggleManualKnowledgeChapter(chapter.id)">
                        <text class="manual-expand-icon">{{ expandedManualChapters.includes(chapter.id) ? '收起 ▲' : '章节 ▼' }}</text>
                        <text class="manual-chapter-name">{{ chapter.name }}</text>
                      </view>
                      
                      <!-- 考点层级（三级） -->
                      <view v-if="expandedManualChapters.includes(chapter.id)" class="manual-point-list">
                        <template v-for="point in chapter.points" :key="point.id">
                          <!-- 三级考点 -->
                          <view 
                            class="manual-point-item"
                            @click="browseLevel3Point(point)"
                          >
                            <view class="manual-point-left">
                              <view class="manual-point-icon">📖</view>
                              <text class="manual-point-name">{{ point.name }}</text>
                            </view>
                            <view class="manual-point-right">
                              <text class="manual-point-count">{{ point.questionCount || 0 }} 题</text>
                              <text class="manual-point-arrow">❯</text>
                            </view>
                          </view>
                        </template>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </scroll-view>
            
            <!-- 正在浏览考点详情 -->
            <view v-if="browsingKnowledgePoint" class="source-detail">
              <view class="detail-header" @click="browsingKnowledgePoint = null">
                <span class="back-icon">❮</span>
                <span class="detail-title">{{ browsingKnowledgePoint.name }}{{ browsingKnowledgePoint.isLevel3 ? ' (三级考点)' : '' }}</span>
              </view>
              
              <!-- 四级考点筛选（仅在三级考点页面显示） -->
              <view v-if="browsingKnowledgePoint.isLevel3 && browsingKnowledgePoint.level4List && browsingKnowledgePoint.level4List.length > 0" class="level4-filter-bar">
                <scroll-view scroll-x class="level4-filter-scroll">
                  <view class="level4-filter-list">
                    <view 
                      class="level4-filter-item"
                      :class="{ active: !browsingKnowledgePoint.selectedLevel4 }"
                      @click="selectLevel4Filter(null)"
                    >
                      <text>全部</text>
                    </view>
                    <view 
                      v-for="level4 in browsingKnowledgePoint.level4List" 
                      :key="level4.id"
                      class="level4-filter-item"
                      :class="{ active: browsingKnowledgePoint.selectedLevel4 === level4.id }"
                      @click="selectLevel4Filter(level4)"
                    >
                      <text>{{ level4.name }}</text>
                    </view>
                  </view>
                </scroll-view>
              </view>
              
              <scroll-view class="q-scroll-area" scroll-y>
                <view v-if="loadingKnowledgeQuestions" class="loading-inline">加载题目中...</view>
                <view v-else-if="filteredKnowledgeQuestions.length === 0" class="no-data">该考点暂无题目</view>
                <view v-else class="q-items-grid">
                  <view 
                    v-for="q in filteredKnowledgeQuestions" 
                    :key="q.QuestionID" 
                    class="q-item-selectable"
                    :class="{ selected: isQuestionSelected(q.QuestionID) }"
                    @click="toggleManualQuestion(q)"
                  >
                    <image v-if="q.QuestionImg" :src="q.QuestionImg.replace('http://', 'https://')" class="q-thumb" mode="widthFix" />
                    <view v-else class="q-no-thumb">ID: {{ q.QuestionID }}</view>
                  </view>
                </view>
              </scroll-view>
            </view>
          </view>

          <!-- 收藏夹内容 -->
          <view v-if="currentSourceTab === 'favorite'" class="source-content">
            <scroll-view class="q-scroll-area" scroll-y>
              <view v-if="loadingFavorites" class="loading-inline">加载收藏中...</view>
              <view v-else-if="favoriteQuestions.length === 0" class="no-data">暂无收藏题目</view>
              <view v-else class="q-items-grid">
                <view 
                  v-for="f in favoriteQuestions" 
                  :key="f.QuestionID" 
                  class="q-item-selectable"
                  :class="{ selected: isQuestionSelected(f.QuestionID) }"
                  @click="toggleManualQuestion(f)"
                >
                  <image v-if="f.QuestionImg" :src="f.QuestionImg.replace('http://', 'https://')" class="q-thumb" mode="widthFix" />
                  <view v-else class="q-no-thumb">ID: {{ f.QuestionID }}</view>
                </view>
              </view>
            </scroll-view>
          </view>
        </view>
      </view>
      <view class="modal-footer-fixed">
        <button class="confirm-btn" @click="showSourceSelector = false">完成选择</button>
      </view>
    </view>

    <!-- 命名弹窗 -->
    <view class="modal" v-if="showModal" @click="showModal = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <h3>试卷配置</h3>
          <span class="close-btn" @click="showModal = false">×</span>
        </view>
        <view class="modal-body">
          <view class="input-item">
            <label>试卷名称</label>
            <textarea 
              v-model="paperTitle"
              placeholder="请输入试卷名称" 
              class="paper-name-input"
              rows="1"
            ></textarea>
          </view>
          <view class="input-item">
            <label>备注信息</label>
            <textarea 
              v-model="paperRemark" 
              placeholder="请输入备注（可选）" 
              rows="3"
              class="paper-remark-textarea"
              @input="(e) => paperRemark = e.detail.value"
            ></textarea>
          </view>
        </view>
        <view class="modal-footer">
          <button class="cancel-btn" @click="showModal = false">取消</button>
          <button class="confirm-btn" @click="confirmGenerate" :disabled="!paperTitle">
            <text class="btn-text">确定组卷</text>
            <text class="btn-subtext">(观看广告后生成)</text>
          </button>
        </view>
      </view>
    </view>

    <!-- 范围选择弹窗 -->
    <view class="modal" v-if="showScopeModal" @click="showScopeModal = false">
      <view class="modal-content scope-modal" @click.stop>
        <view class="modal-header">
          <h3>选择组卷范围</h3>
          <span class="close-btn" @click="showScopeModal = false">×</span>
        </view>
        <view class="modal-body">
          <view class="book-list">
            <!-- 书籍分类 -->
            <view v-if="categorizedBooks.books.length > 0" class="book-category">
              <view class="category-title" @click.stop="toggleCategory('books')">
                <span>书籍</span>
                <span class="category-toggle">{{ expandedCategories.books ? '▼' : '▶' }}</span>
              </view>
              <view v-if="expandedCategories.books" class="category-content">
                <view v-for="book in categorizedBooks.books" :key="book.BookID" class="book-item">
                <view class="book-header">
                  <view class="book-header-left" @click="toggleBookSelection(book.BookID)">
                    <view class="checkbox" :class="{ checked: isBookSelected(book.BookID) }"></view>
                    <span class="book-name">{{ book.BookTitle }}</span>
                  </view>
                  <view class="expand-icon" @click="toggleBookExpand(book.BookID)">
                    {{ expandedBooks.includes(book.BookID) ? '收起 ▲' : '章节 ▼' }}
                  </view>
                </view>

                <!-- 书籍层级的题量设置 -->
                <view v-if="expandedBooks.includes(book.BookID) && isBookSelected(book.BookID) && getSelectedChaptersCount(book.BookID) === 0" class="scope-config-area" @click.stop="openBookQuestionCountModal(book.BookID)">
                  <view class="config-label">整本书题量设置:</view>
                  <view class="m-cfg-counts">
                    <text class="count-tag choice">选{{ getScopeConfig(book.BookID).choice || 0 }}</text>
                    <text class="count-tag fill">填{{ getScopeConfig(book.BookID).fill || 0 }}</text>
                    <text class="count-tag analysis">解{{ getScopeConfig(book.BookID).analysis || 0 }}</text>
                  </view>
                </view>
                
                <view v-if="expandedBooks.includes(book.BookID)" class="chapter-list">
                  <view v-if="loadingChapters[book.BookID]" class="loading-inline">加载章节中...</view>
                  <view v-else-if="!bookChapters[book.BookID] || bookChapters[book.BookID].length === 0" class="no-data">暂无章节信息</view>
                  <view v-else>
                    <view class="chapter-actions">
                      <span @click="selectAllChapters(book.BookID)">全选章节</span>
                      <span @click="deselectAllChapters(book.BookID)">清空章节</span>
                    </view>
                    <view class="chapter-list-vertical">
                      <view 
                        v-for="(chapter, cIndex) in bookChapters[book.BookID]" 
                        :key="chapter.name"
                        class="chapter-row-item"
                        :class="{ 
                          active: isChapterSelected(book.BookID, chapter.name),
                          'level-1': chapter.level === 1,
                          'level-2': chapter.level === 2
                        }"
                        @click="toggleChapterSelection(book.BookID, chapter.name)"
                      >
                        <view class="chapter-row-left">
                          <span class="chapter-index" :class="{ 'sub-index': chapter.level === 2 }">{{ chapter.level === 2 ? '└' : '' }}{{ cIndex + 1 }}</span>
                          <span class="chapter-name-text" :class="{ 'sub-name': chapter.level === 2 }">{{ chapter.name }}</span>
                        </view>
                        <view v-if="isChapterSelected(book.BookID, chapter.name)" class="chapter-row-config" @click.stop="openQuestionCountModal(book.BookID, chapter.name)">
                          <view class="m-cfg-counts">
                            <text class="count-tag choice">选{{ getScopeConfig(book.BookID, chapter.name).choice || 0 }}</text>
                            <text class="count-tag fill">填{{ getScopeConfig(book.BookID, chapter.name).fill || 0 }}</text>
                            <text class="count-tag analysis">解{{ getScopeConfig(book.BookID, chapter.name).analysis || 0 }}</text>
                          </view>
                        </view>
                        <view v-else class="chapter-check-icon">
                          <span>+</span>
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
              </view>
            </view>

            <!-- 真题卷分类 -->
            <view v-if="categorizedBooks.realPapers.length > 0" class="book-category">
              <view class="category-title" @click.stop="toggleCategory('realPapers')">
                <span>真题卷</span>
                <span class="category-toggle">{{ expandedCategories.realPapers ? '▼' : '▶' }}</span>
              </view>
              <view v-if="expandedCategories.realPapers" class="category-content">
                <view v-for="book in categorizedBooks.realPapers" :key="book.BookID" class="book-item">
                <view class="book-header">
                  <view class="book-header-left" @click="toggleBookSelection(book.BookID)">
                    <view class="checkbox" :class="{ checked: isBookSelected(book.BookID) }"></view>
                    <span class="book-name">{{ book.BookTitle }}</span>
                  </view>
                  <view class="expand-icon" @click="toggleBookExpand(book.BookID)">
                    {{ expandedBooks.includes(book.BookID) ? '收起 ▲' : '章节 ▼' }}
                  </view>
                </view>

                <view v-if="expandedBooks.includes(book.BookID) && isBookSelected(book.BookID) && getSelectedChaptersCount(book.BookID) === 0" class="scope-config-area" @click.stop="openBookQuestionCountModal(book.BookID)">
                  <view class="config-label">整本书题量设置:</view>
                  <view class="m-cfg-counts">
                    <text class="count-tag choice">选{{ getScopeConfig(book.BookID).choice || 0 }}</text>
                    <text class="count-tag fill">填{{ getScopeConfig(book.BookID).fill || 0 }}</text>
                    <text class="count-tag analysis">解{{ getScopeConfig(book.BookID).analysis || 0 }}</text>
                  </view>
                </view>
                
                <view v-if="expandedBooks.includes(book.BookID)" class="chapter-list">
                  <view v-if="loadingChapters[book.BookID]" class="loading-inline">加载章节中...</view>
                  <view v-else-if="!bookChapters[book.BookID] || bookChapters[book.BookID].length === 0" class="no-data">暂无章节信息</view>
                  <view v-else>
                    <view class="chapter-actions">
                      <span @click="selectAllChapters(book.BookID)">全选章节</span>
                      <span @click="deselectAllChapters(book.BookID)">清空章节</span>
                    </view>
                    <view class="chapter-list-vertical">
                      <view 
                        v-for="(chapter, cIndex) in bookChapters[book.BookID]" 
                        :key="chapter.name"
                        class="chapter-row-item"
                        :class="{ 
                          active: isChapterSelected(book.BookID, chapter.name),
                          'level-1': chapter.level === 1,
                          'level-2': chapter.level === 2
                        }"
                        @click="toggleChapterSelection(book.BookID, chapter.name)"
                      >
                        <view class="chapter-row-left">
                          <span class="chapter-index" :class="{ 'sub-index': chapter.level === 2 }">{{ chapter.level === 2 ? '└' : '' }}{{ cIndex + 1 }}</span>
                          <span class="chapter-name-text" :class="{ 'sub-name': chapter.level === 2 }">{{ chapter.name }}</span>
                        </view>
                        <view v-if="isChapterSelected(book.BookID, chapter.name)" class="chapter-row-config" @click.stop>
                          <view class="m-cfg-item" v-for="type in ['choice', 'fill', 'analysis']" :key="type">
                            <span>{{ type === 'choice' ? '选' : type === 'fill' ? '填' : '解' }}</span>
                            <input type="number" :value="getScopeConfig(book.BookID, chapter.name)[type]" @input="e => getScopeConfig(book.BookID, chapter.name)[type] = parseInt(e.detail.value || 0)" />
                          </view>
                        </view>
                        <view v-else class="chapter-check-icon">
                          <span>+</span>
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
              </view>
            </view>

            <!-- 模拟卷分类 -->
            <view v-if="categorizedBooks.mockPapers.length > 0" class="book-category">
              <view class="category-title" @click.stop="toggleCategory('mockPapers')">
                <span>模拟卷</span>
                <span class="category-toggle">{{ expandedCategories.mockPapers ? '▼' : '▶' }}</span>
              </view>
              <view v-if="expandedCategories.mockPapers" class="category-content">
                <view v-for="book in categorizedBooks.mockPapers" :key="book.BookID" class="book-item">
                <view class="book-header">
                  <view class="book-header-left" @click="toggleBookSelection(book.BookID)">
                    <view class="checkbox" :class="{ checked: isBookSelected(book.BookID) }"></view>
                    <span class="book-name">{{ book.BookTitle }}</span>
                  </view>
                  <view class="expand-icon" @click="toggleBookExpand(book.BookID)">
                    {{ expandedBooks.includes(book.BookID) ? '收起 ▲' : '章节 ▼' }}
                  </view>
                </view>

                <view v-if="expandedBooks.includes(book.BookID) && isBookSelected(book.BookID) && getSelectedChaptersCount(book.BookID) === 0" class="scope-config-area" @click.stop="openBookQuestionCountModal(book.BookID)">
                  <view class="config-label">整本书题量设置:</view>
                  <view class="m-cfg-counts">
                    <text class="count-tag choice">选{{ getScopeConfig(book.BookID).choice || 0 }}</text>
                    <text class="count-tag fill">填{{ getScopeConfig(book.BookID).fill || 0 }}</text>
                    <text class="count-tag analysis">解{{ getScopeConfig(book.BookID).analysis || 0 }}</text>
                  </view>
                </view>
                
                <view v-if="expandedBooks.includes(book.BookID)" class="chapter-list">
                  <view v-if="loadingChapters[book.BookID]" class="loading-inline">加载章节中...</view>
                  <view v-else-if="!bookChapters[book.BookID] || bookChapters[book.BookID].length === 0" class="no-data">暂无章节信息</view>
                  <view v-else>
                    <view class="chapter-actions">
                      <span @click="selectAllChapters(book.BookID)">全选章节</span>
                      <span @click="deselectAllChapters(book.BookID)">清空章节</span>
                    </view>
                    <view class="chapter-list-vertical">
                      <view 
                        v-for="(chapter, cIndex) in bookChapters[book.BookID]" 
                        :key="chapter.name"
                        class="chapter-row-item"
                        :class="{ 
                          active: isChapterSelected(book.BookID, chapter.name),
                          'level-1': chapter.level === 1,
                          'level-2': chapter.level === 2
                        }"
                        @click="toggleChapterSelection(book.BookID, chapter.name)"
                      >
                        <view class="chapter-row-left">
                          <span class="chapter-index" :class="{ 'sub-index': chapter.level === 2 }">{{ chapter.level === 2 ? '└' : '' }}{{ cIndex + 1 }}</span>
                          <span class="chapter-name-text" :class="{ 'sub-name': chapter.level === 2 }">{{ chapter.name }}</span>
                        </view>
                        <view v-if="isChapterSelected(book.BookID, chapter.name)" class="chapter-row-config" @click.stop>
                          <view class="m-cfg-item" v-for="type in ['choice', 'fill', 'analysis']" :key="type">
                            <span>{{ type === 'choice' ? '选' : type === 'fill' ? '填' : '解' }}</span>
                            <input type="number" :value="getScopeConfig(book.BookID, chapter.name)[type]" @input="e => getScopeConfig(book.BookID, chapter.name)[type] = parseInt(e.detail.value || 0)" />
                          </view>
                        </view>
                        <view v-else class="chapter-check-icon">
                          <span>+</span>
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
              </view>
            </view>
          </view>
        </view>
        <view class="modal-footer scope-modal-footer">
          <view class="scope-modal-counts">
            <view class="scope-count-item">
              <text class="count-tag-sm choice">选{{ calculateQuestionCounts().choice }}</text>
            </view>
            <view class="scope-count-item">
              <text class="count-tag-sm fill">填{{ calculateQuestionCounts().fill }}</text>
            </view>
            <view class="scope-count-item">
              <text class="count-tag-sm analysis">解{{ calculateQuestionCounts().analysis }}</text>
            </view>
            <view class="scope-count-total">
              <text class="total-label">共</text>
              <text class="total-value">{{ calculateQuestionCounts().total }}题</text>
            </view>
          </view>
          <button class="confirm-btn" @click="showScopeModal = false">确定</button>
        </view>
      </view>
    </view>

    <!-- 考点选择弹窗 -->
    <view class="modal" v-if="showKnowledgeModal" @click="closeKnowledgeModal">
      <view class="modal-content scope-modal" @click.stop>
        <view class="modal-header">
          <h3>选择考点</h3>
          <span class="close-btn" @click="closeKnowledgeModal">×</span>
        </view>
        <view class="modal-body scope-modal-body">
          <scroll-view scroll-y class="scope-scroll">
            <view v-if="knowledgePoints.length === 0" class="loading-inline">加载中...</view>
            <view v-else class="scope-category-list">
              <view v-for="subject in knowledgePoints" :key="subject.id" class="scope-category">
                <view class="category-title" @click="toggleKnowledgeSubject(subject.id)">
                  <text>{{ subject.name }}</text>
                  <text class="category-toggle">{{ expandedKnowledgeSubjects.includes(subject.id) ? '▼' : '▶' }}</text>
                </view>
                <view v-if="expandedKnowledgeSubjects.includes(subject.id)" class="category-content">
                  <view v-for="chapter in subject.chapters" :key="chapter.id" class="scope-book-item">
                    <view class="scope-book-header" @click="toggleKnowledgeChapter(chapter.id)">
                      <view class="scope-book-left">
                        <text class="expand-icon">{{ expandedKnowledgeChapters.includes(chapter.id) ? '收起 ▲' : '章节 ▼' }}</text>
                        <text class="scope-book-name">{{ chapter.name }}</text>
                      </view>
                    </view>
                    <view v-if="expandedKnowledgeChapters.includes(chapter.id)" class="scope-chapter-list">
                      <template v-for="point in chapter.points" :key="point.id">
                        <!-- 三级考点 -->
                        <view 
                          class="scope-chapter-row"
                          :class="{ active: isKnowledgePointSelected(point.id) }"
                          @click="toggleKnowledgePoint(point)"
                        >
                          <view class="scope-chapter-left">
                            <view class="scope-checkbox" :class="{ checked: isKnowledgePointSelected(point.id) }"></view>
                            <text class="scope-chapter-name">{{ point.name }}</text>
                          </view>
                          <view v-if="isKnowledgePointSelected(point.id)" class="scope-chapter-config" @click.stop="openKnowledgePointCountModal(point)">
                            <view class="m-cfg-counts">
                              <text class="count-tag choice">选{{ getKnowledgePointConfig(point.id).choice || 0 }}</text>
                              <text class="count-tag fill">填{{ getKnowledgePointConfig(point.id).fill || 0 }}</text>
                              <text class="count-tag analysis">解{{ getKnowledgePointConfig(point.id).analysis || 0 }}</text>
                            </view>
                          </view>
                          <view v-else class="scope-check-icon">
                            <text>+</text>
                          </view>
                        </view>
                        <!-- 四级考点 -->
                        <view 
                          v-if="getLevel4Categories(point).length > 0"
                          v-for="level4 in getLevel4Categories(point)" 
                          :key="level4.id"
                          class="scope-chapter-row level4-row"
                          :class="{ active: isKnowledgePointSelected(level4.id) }"
                          @click="toggleKnowledgePoint({ ...level4, parentId: point.id, parentName: point.name })"
                        >
                          <view class="scope-chapter-left">
                            <view class="scope-checkbox" :class="{ checked: isKnowledgePointSelected(level4.id) }"></view>
                            <text class="scope-chapter-name level4-name">{{ level4.name }}</text>
                          </view>
                          <view v-if="isKnowledgePointSelected(level4.id)" class="scope-chapter-config" @click.stop="openKnowledgePointCountModal({ ...level4, parentId: point.id, parentName: point.name })">
                            <view class="m-cfg-counts">
                              <text class="count-tag choice">选{{ getKnowledgePointConfig(level4.id).choice || 0 }}</text>
                              <text class="count-tag fill">填{{ getKnowledgePointConfig(level4.id).fill || 0 }}</text>
                              <text class="count-tag analysis">解{{ getKnowledgePointConfig(level4.id).analysis || 0 }}</text>
                            </view>
                          </view>
                          <view v-else class="scope-check-icon">
                            <text>+</text>
                          </view>
                        </view>
                      </template>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>
        <view class="modal-footer scope-modal-footer">
          <view class="scope-modal-counts">
            <view class="scope-count-item">
              <text class="count-tag-sm choice">选{{ selectedKnowledgePoints.reduce((sum, p) => sum + (p.choice || 0), 0) }}</text>
            </view>
            <view class="scope-count-item">
              <text class="count-tag-sm fill">填{{ selectedKnowledgePoints.reduce((sum, p) => sum + (p.fill || 0), 0) }}</text>
            </view>
            <view class="scope-count-item">
              <text class="count-tag-sm analysis">解{{ selectedKnowledgePoints.reduce((sum, p) => sum + (p.analysis || 0), 0) }}</text>
            </view>
            <view class="scope-count-total">
              <text class="total-label">共</text>
              <text class="total-value">{{ selectedKnowledgePoints.reduce((sum, p) => sum + (p.choice || 0) + (p.fill || 0) + (p.analysis || 0), 0) }}题</text>
            </view>
          </view>
          <button class="confirm-btn" @click="confirmKnowledgeModal">确定</button>
        </view>
      </view>
    </view>

    <!-- 考点数量设置弹窗 -->
    <view class="modal" v-if="showKnowledgeCountModal" @click="closeKnowledgeCountModal">
      <view class="modal-content count-modal" @click.stop>
        <view class="modal-header">
          <h3>设置考点题目数量</h3>
          <span class="close-btn" @click="closeKnowledgeCountModal">×</span>
        </view>
        <view class="modal-body count-modal-body">
          <view class="count-form">
            <view class="count-form-item">
              <text class="count-label">选择题</text>
              <view class="count-input-wrap">
                <button class="count-btn" @click="knowledgeCountModalData.choice > 0 && knowledgeCountModalData.choice--">-</button>
                <input 
                  type="number" 
                  v-model.number="knowledgeCountModalData.choice" 
                  class="count-input"
                />
                <button class="count-btn" @click="knowledgeCountModalData.choice++">+</button>
              </view>
            </view>
            <view class="count-form-item">
              <text class="count-label">填空题</text>
              <view class="count-input-wrap">
                <button class="count-btn" @click="knowledgeCountModalData.fill > 0 && knowledgeCountModalData.fill--">-</button>
                <input 
                  type="number" 
                  v-model.number="knowledgeCountModalData.fill" 
                  class="count-input"
                />
                <button class="count-btn" @click="knowledgeCountModalData.fill++">+</button>
              </view>
            </view>
            <view class="count-form-item">
              <text class="count-label">解答题</text>
              <view class="count-input-wrap">
                <button class="count-btn" @click="knowledgeCountModalData.analysis > 0 && knowledgeCountModalData.analysis--">-</button>
                <input 
                  type="number" 
                  v-model.number="knowledgeCountModalData.analysis" 
                  class="count-input"
                />
                <button class="count-btn" @click="knowledgeCountModalData.analysis++">+</button>
              </view>
            </view>
          </view>
        </view>
        <view class="count-modal-footer">
          <view class="count-modal-total">
            <text class="total-label">已选:</text>
            <text class="total-value">{{ (parseInt(knowledgeCountModalData.choice) || 0) + (parseInt(knowledgeCountModalData.fill) || 0) + (parseInt(knowledgeCountModalData.analysis) || 0) }}题</text>
          </view>
          <view class="count-modal-btns">
            <button class="cancel-btn" @click="closeKnowledgeCountModal">取消</button>
            <button class="confirm-btn" @click="confirmKnowledgeCountModal">确定</button>
          </view>
        </view>
      </view>
    </view>

    <!-- 题目数量设置弹窗 -->
    <view class="modal" v-if="showCountModal" @click="closeCountModal">
      <view class="modal-content count-modal" @click.stop>
        <view class="modal-header">
          <h3>设置题目数量</h3>
          <span class="close-btn" @click="closeCountModal">×</span>
        </view>
        <view class="modal-body count-modal-body">
          <view class="count-form">
            <view class="count-form-item">
              <text class="count-label">选择题</text>
              <view class="count-input-wrap">
                <button class="count-btn" @click="countModalData.choice > 0 && countModalData.choice--">-</button>
                <input 
                  type="number" 
                  v-model.number="countModalData.choice" 
                  class="count-input"
                />
                <button class="count-btn" @click="countModalData.choice++">+</button>
              </view>
            </view>
            <view class="count-form-item">
              <text class="count-label">填空题</text>
              <view class="count-input-wrap">
                <button class="count-btn" @click="countModalData.fill > 0 && countModalData.fill--">-</button>
                <input 
                  type="number" 
                  v-model.number="countModalData.fill" 
                  class="count-input"
                />
                <button class="count-btn" @click="countModalData.fill++">+</button>
              </view>
            </view>
            <view class="count-form-item">
              <text class="count-label">解答题</text>
              <view class="count-input-wrap">
                <button class="count-btn" @click="countModalData.analysis > 0 && countModalData.analysis--">-</button>
                <input 
                  type="number" 
                  v-model.number="countModalData.analysis" 
                  class="count-input"
                />
                <button class="count-btn" @click="countModalData.analysis++">+</button>
              </view>
            </view>
          </view>
        </view>
        <view class="count-modal-footer">
          <view class="count-modal-total">
            <text class="total-label">已选:</text>
            <text class="total-value">{{ (parseInt(countModalData.choice) || 0) + (parseInt(countModalData.fill) || 0) + (parseInt(countModalData.analysis) || 0) }}题</text>
          </view>
          <view class="count-modal-btns">
            <button class="cancel-btn" @click="closeCountModal">取消</button>
            <button class="confirm-btn" @click="confirmCountModal">确定</button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { request, BASE_URL } from '../../api/request';
import { onLoad, onShow } from '@dcloudio/uni-app';

const subjects = ref([]);
const selectedSubjectId = ref(null);
const fixedSubject = ref(false);
const availableBooks = ref([]);
const bookChapters = ref({});
const expandedBooks = ref([]);
const loadingChapters = ref({});
const selectedScope = ref([]); // [{ bookId, chapters: [] }]
const scopeConfigs = ref({}); // { 'book-1': { choice, fill, analysis }, 'chapter-1-Name': { choice, fill, analysis } }
const showScopeModal = ref(false);

// 选择模式: 'book' | 'knowledge'
const selectionMode = ref('book');

// 已选考点
const selectedKnowledgePoints = ref([]); // [{ id, name, choice, fill, analysis }]

// 考点选择弹窗
const showKnowledgeModal = ref(false);
const knowledgePoints = ref([]); // 考点列表
const expandedKnowledgeSubjects = ref([]);
const expandedKnowledgeChapters = ref([]);

// 题目数量设置弹窗
const showCountModal = ref(false);
const countModalTarget = ref({ bookId: null, chapterName: null, type: null });
const countModalValue = ref(0);
const countModalTitle = ref('');

// 分类展开状态
const expandedCategories = ref({
  books: true,
  realPapers: true,
  mockPapers: true
});

// 组卷模式：smart (智能), manual (手动), my-papers (我的组卷)
const compositionMode = ref('smart');

// 我的组卷列表
const generatedPapers = ref([]);

// 按类型分类书籍
const categorizedBooks = computed(() => {
  const books = [];
  const realPapers = []; // 真题卷
  const mockPapers = []; // 模拟卷

  availableBooks.value.forEach(book => {
    const title = book.BookTitle || '';
    // 判断是否包含年份（如2024年、2025年等）
    const hasYear = /\d{4}年/.test(title);
    // 判断是否包含"真题"
    const isRealPaper = title.includes('真题');
    // 判断是否包含"模考"或"模拟"
    const isMockPaper = title.includes('模考') || title.includes('模拟');

    if (isRealPaper || (hasYear && !isMockPaper)) {
      realPapers.push(book);
    } else if (isMockPaper) {
      mockPapers.push(book);
    } else {
      books.push(book);
    }
  });

  return {
    books,
    realPapers,
    mockPapers
  };
});

const fetchGeneratedPapers = async () => {
  const subjectId = selectedSubjectId.value || uni.getStorageSync('math_selected_subject_id');
  try {
    const res = await request({
      url: '/math/smart-papers',
      data: { subjectId }
    });
    generatedPapers.value = res.data || [];
  } catch (error) {
    console.error('获取组卷列表失败:', error);
  }
};

const goToPaper = (paperId) => {
  uni.navigateTo({
    url: `/pages/math/math-generated-paper?paperId=${paperId}`
  });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// 手动组卷相关
const manualQuestions = ref([]);
const userBookshelf = ref([]);
const browsingSource = ref(null);
const sourceChapters = ref([]);
const browsingChapter = ref(null);
const sourceQuestions = ref([]);
const loadingSourceQuestions = ref(false);
const showSourceSelector = ref(false);
const currentSourceTab = ref('bookshelf');
const favoriteQuestions = ref([]);
const loadingFavorites = ref(false);

// 手动组卷 - 考点相关
const browsingKnowledgePoint = ref(null);
const knowledgeQuestions = ref([]);
const loadingKnowledgeQuestions = ref(false);
const expandedManualSubjects = ref([]);
const expandedManualChapters = ref([]);
const expandedManualPoints = ref([]);
const level4CategoriesMap = ref(new Map()); // 存储每个三级考点的四级目录

// 根据四级考点筛选题目
const filteredKnowledgeQuestions = computed(() => {
  if (!browsingKnowledgePoint.value || !browsingKnowledgePoint.value.selectedLevel4) {
    return knowledgeQuestions.value;
  }
  // 如果选择了特定的四级考点，筛选出属于该考点的题目
  // 题目对象中应该有 LinkNames 字段，包含考点名称
  const selectedLevel4Name = browsingKnowledgePoint.value.level4List?.find(
    l => l.id === browsingKnowledgePoint.value.selectedLevel4
  )?.name;
  if (!selectedLevel4Name) return knowledgeQuestions.value;
  
  return knowledgeQuestions.value.filter(q => {
    // 检查题目的 LinkNames 是否包含选中的四级考点名称
    if (q.LinkNames) {
      return q.LinkNames.includes(selectedLevel4Name);
    }
    return false;
  });
});

// 选择四级考点筛选
const selectLevel4Filter = (level4) => {
  if (browsingKnowledgePoint.value) {
    browsingKnowledgePoint.value.selectedLevel4 = level4 ? level4.id : null;
  }
};

const LOCAL_STORAGE_KEY = 'math_manual_questions_draft';

const loadDraftFromStorage = () => {
  try {
    const saved = uni.getStorageSync(LOCAL_STORAGE_KEY);
    if (saved) {
      manualQuestions.value = JSON.parse(saved);
    }
  } catch (e) {
    console.error('加载草稿失败:', e);
  }
};

const saveDraftToStorage = () => {
  try {
    uni.setStorageSync(LOCAL_STORAGE_KEY, JSON.stringify(manualQuestions.value));
  } catch (e) {
    console.error('保存草稿失败:', e);
  }
};

watch(manualQuestions, () => {
  saveDraftToStorage();
}, { deep: true });

onMounted(() => {
  loadDraftFromStorage();
  fetchPaperPermission();
  
  // #ifdef MP-WEIXIN
  // 预加载激励视频广告
  initRewardedVideoAd();
  // #endif
});

// 获取用户组卷权限
const fetchPaperPermission = async () => {
  try {
    const res = await request({
      url: '/math/paper-permission',
      method: 'GET'
    });
    if (res.code === 0 && res.data) {
      paperPermission.value = res.data;
    }
  } catch (err) {
    console.error('获取组卷权限失败:', err);
  }
};

const searchByQuestionId = () => {
  uni.showModal({
    title: '通过 ID 添加题目',
    editable: true,
    placeholderText: '请输入题目 ID (多个用逗号分隔)',
    success: async (res) => {
      if (res.confirm && res.content) {
        const input = res.content.trim();
        const ids = input
          .split(/[\s,，]+/)
          .map(id => id.trim())
          .filter(id => id && !isNaN(id))
          .map(id => parseInt(id));
        
        if (ids.length === 0) {
          uni.showToast({ title: '请输入有效的数字 ID', icon: 'none' });
          return;
        }

        const newIds = ids.filter(id => !manualQuestions.value.some(mq => mq.id === id));
        
        if (newIds.length === 0) {
          uni.showToast({ title: '所有题目已存在', icon: 'none' });
          return;
        }

        uni.showLoading({ title: '验证题目中...' });
        
        try {
          const result = await request({
            url: '/math/questions/batch',
            method: 'POST',
            data: { ids: newIds }
          });
          
          uni.hideLoading();
          
          const questions = result.data || [];
          
          if (questions.length > 0) {
            const existingIds = new Set(questions.map(q => q.QuestionID));
            const notFoundIds = newIds.filter(id => !existingIds.has(id));
            
            if (notFoundIds.length > 0) {
              uni.showToast({ 
                title: `ID ${notFoundIds.slice(0, 3).join(', ')}${notFoundIds.length > 3 ? '...' : ''} 不存在`, 
                icon: 'none',
                duration: 2000
              });
            }
            
            const questionsToAdd = questions.map(q => ({
              id: q.QuestionID,
              type: q.QuestionType || '未知',
              source: 'ID添加',
              img: q.QuestionImg || ''
            }));
            
            manualQuestions.value.push(...questionsToAdd);
            
            if (questionsToAdd.length > 0) {
              uni.showToast({ 
                title: `成功添加 ${questionsToAdd.length} 题`, 
                icon: 'success' 
              });
            }
          } else {
            uni.showToast({ title: '未找到任何题目', icon: 'none' });
          }
        } catch (e) {
          uni.hideLoading();
          console.error('查询题目失败:', e);
          uni.showToast({ title: '网络错误', icon: 'none' });
        }
      }
    }
  });
};

const sortedSourceChapters = computed(() => {
  if (!sourceChapters.value || sourceChapters.value.length === 0) return [];
  return [...sourceChapters.value].sort((a, b) => {
    const extractChapterNum = (name) => {
      const match = name.match(/第([一二三四五六七八九十百零\d]+)章/);
      if (match) {
        const chineseToNum = (str) => {
          const map = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '百': 100 };
          if (/^\d+$/.test(str)) return parseInt(str);
          let result = 0;
          for (let char of str) {
            if (map[char] !== undefined) {
              result = result * 10 + map[char];
            }
          }
          return result;
        };
        return chineseToNum(match[1]);
      }
      return 999;
    };
    return extractChapterNum(a.name) - extractChapterNum(b.name);
  });
});

// 考点列表（用于手动组卷）
const knowledgePointsList = computed(() => {
  if (!knowledgePoints.value || knowledgePoints.value.length === 0) return [];
  
  const list = [];
  knowledgePoints.value.forEach(subject => {
    if (subject.chapters) {
      subject.chapters.forEach(chapter => {
        if (chapter.points) {
          chapter.points.forEach(point => {
            list.push({
              id: point.id,
              name: point.name,
              subjectId: subject.id,
              subjectName: subject.name,
              chapterId: chapter.id,
              chapterName: chapter.name,
              questionCount: point.questionCount || 0
            });
          });
        }
      });
    }
  });
  return list;
});

// 记录用户是否手动修改过全局题量
const userModifiedCounts = ref({
  choice: false,
  fill: false,
  analysis: false
});

const getBookTitle = (bookId) => {
  const book = availableBooks.value.find(b => b.BookID === bookId);
  return book ? book.BookTitle : '未知书籍';
};

const hasCustomConfig = (item) => {
  const bookConfig = scopeConfigs.value[`book-${item.bookId}`];
  if (bookConfig && (bookConfig.choice > 0 || bookConfig.fill > 0 || bookConfig.analysis > 0)) return true;
  
  return item.chapters.some(chapName => {
    const chapConfig = scopeConfigs.value[`chapter-${item.bookId}-${chapName}`];
    return chapConfig && (chapConfig.choice > 0 || chapConfig.fill > 0 || chapConfig.analysis > 0);
  });
};

const getScopeTotal = (item, type) => {
  let total = 0;
  if (item.chapters.length === 0) {
    const config = scopeConfigs.value[`book-${item.bookId}`];
    total = (config && config[type]) || 0;
  } else {
    item.chapters.forEach(chapName => {
      const chapConfig = scopeConfigs.value[`chapter-${item.bookId}-${chapName}`];
      total += (chapConfig && chapConfig[type]) || 0;
    });
  }
  return total;
};

const totalCustomCounts = computed(() => {
  const result = { choice: 0, fill: 0, analysis: 0 };
  selectedScope.value.forEach(item => {
    result.choice += getScopeTotal(item, 'choice');
    result.fill += getScopeTotal(item, 'fill');
    result.analysis += getScopeTotal(item, 'analysis');
  });
  return result;
});

const getScopeConfig = (bookId, chapterName = null) => {
  const key = chapterName ? `chapter-${bookId}-${chapterName}` : `book-${bookId}`;
  if (!scopeConfigs.value[key]) {
    scopeConfigs.value[key] = { choice: 0, fill: 0, analysis: 0 };
  }
  return scopeConfigs.value[key];
};

const updateScopeConfig = (bookId, chapterName, type, delta) => {
  const config = getScopeConfig(bookId, chapterName);
  const newVal = config[type] + delta;
  if (newVal >= 0) {
    config[type] = newVal;
  }
};

const counts = ref({
  choice: 10,
  fill: 6,
  analysis: 6
});

const generating = ref(false);
const showModal = ref(false);
const paperTitle = ref('');
const paperRemark = ref('');

// 用户组卷权限信息
// role: 0=普通用户, 1=超级管理员, 2,3,4...=其他管理员
const paperPermission = ref({
  allowed: true,
  role: 0,
  maxQuestions: null
});

// 处理生成按钮点击
const handleGenerateClick = () => {
  // 检查是否有选择范围/题目
  if (compositionMode.value === 'smart') {
    // 智能组卷模式：检查是否选择了范围
    const hasScope = selectedScope.value.length > 0 || selectedKnowledgePoints.value.length > 0;
    if (!hasScope) {
      uni.showToast({
        title: selectionMode.value === 'book' ? '请先选择书籍/章节' : '请先选择考点',
        icon: 'none'
      });
      return;
    }
  } else {
    // 手动组卷模式：检查是否添加了题目
    if (manualQuestions.value.length === 0) {
      uni.showToast({
        title: '请至少添加一道题目',
        icon: 'none'
      });
      return;
    }
  }

  // 检查题目数量是否超限
  const maxQuestions = paperPermission.value.maxQuestions;
  if (maxQuestions !== null && totalQuestions.value > maxQuestions) {
    uni.showToast({
      title: `题目数量超过限制（最多${maxQuestions}题）`,
      icon: 'none'
    });
    return;
  }

  // 检查权限
  if (!paperPermission.value.allowed) {
    uni.showToast({
      title: '组卷功能暂不可用',
      icon: 'none'
    });
    return;
  }

  // 打开命名弹窗
  showNamingPopup();
};

const showNamingPopup = () => {
  const subject = displaySubjects.value.find(s => s.id === selectedSubjectId.value);
  const subjectName = subject ? subject.name : '考研数学';
  const prefix = compositionMode.value === 'smart' ? '智能' : '手动';
  paperTitle.value = `${subjectName}${prefix}练习卷_${new Date().toLocaleDateString()}`;
  paperRemark.value = '';
  showModal.value = true;
};

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
      // 广告加载失败时，直接允许用户生成组卷
      uni.showToast({ title: '广告加载失败，免费为您生成组卷', icon: 'none' });
      generatePaper();
    });
    
    rewardedVideoAd.onClose((res) => {
      // 用户点击了【关闭广告】按钮
      if (res && res.isEnded) {
        // 正常播放结束，可以下发奖励
        console.log('广告观看完成，生成组卷');
        generatePaper();
      } else {
        // 播放中途退出，不下发奖励
        console.log('广告观看中途退出');
        uni.showToast({ title: '需要完整观看广告才能生成组卷', icon: 'none' });
      }
    });
  }
  // #endif
};

// 显示激励视频广告
const showRewardedVideoAd = () => {
  // #ifdef MP-WEIXIN
  if (!rewardedVideoAd) {
    initRewardedVideoAd();
  }
  
  if (rewardedVideoAd) {
    rewardedVideoAd.show().catch(() => {
      // 失败重试
      rewardedVideoAd.load()
        .then(() => rewardedVideoAd.show())
        .catch(err => {
          console.error('激励视频广告显示失败', err);
          // 广告显示失败时，直接允许用户生成组卷
          uni.showToast({ title: '广告加载失败，免费为您生成组卷', icon: 'none' });
          generatePaper();
        });
    });
  } else {
    // 不支持广告，直接生成
    generatePaper();
  }
  // #endif
  
  // #ifndef MP-WEIXIN
  // 非微信小程序环境，直接生成
  generatePaper();
  // #endif
};

const confirmGenerate = () => {
  showModal.value = false;
  // 显示激励视频广告，观看完成后生成组卷
  showRewardedVideoAd();
};

// 题目数量弹窗数据
const countModalData = ref({
  choice: 0,
  fill: 0,
  analysis: 0
});

// 打开题目数量设置弹窗（三个题型一起设置）- 章节
const openQuestionCountModal = (bookId, chapterName) => {
  countModalTarget.value = { bookId, chapterName, isBook: false };
  const config = getScopeConfig(bookId, chapterName);
  countModalData.value = {
    choice: config.choice || 0,
    fill: config.fill || 0,
    analysis: config.analysis || 0
  };
  showCountModal.value = true;
};

// 打开题目数量设置弹窗（三个题型一起设置）- 整本书
const openBookQuestionCountModal = (bookId) => {
  countModalTarget.value = { bookId, chapterName: null, isBook: true };
  const config = getScopeConfig(bookId);
  countModalData.value = {
    choice: config.choice || 0,
    fill: config.fill || 0,
    analysis: config.analysis || 0
  };
  showCountModal.value = true;
};

// 确认题目数量设置
const confirmCountModal = () => {
  const { bookId, chapterName, isBook } = countModalTarget.value;
  const config = getScopeConfig(bookId, chapterName);
  config.choice = parseInt(countModalData.value.choice) || 0;
  config.fill = parseInt(countModalData.value.fill) || 0;
  config.analysis = parseInt(countModalData.value.analysis) || 0;
  showCountModal.value = false;
};

// 关闭题目数量弹窗
const closeCountModal = () => {
  showCountModal.value = false;
};

// 获取考点数据
const fetchKnowledgePoints = async () => {
  try {
    const res = await request({
      url: '/math/knowledge-categories',
      method: 'GET'
    });
    if (res.data?.subjects) {
      knowledgePoints.value = res.data.subjects;
      // 默认展开第一个科目
      if (res.data.subjects.length > 0) {
        expandedKnowledgeSubjects.value = [res.data.subjects[0].id];
      }
    }
  } catch (err) {
    console.error('获取考点失败:', err);
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
};

// 切换科目展开
const toggleKnowledgeSubject = (subjectId) => {
  const index = expandedKnowledgeSubjects.value.indexOf(subjectId);
  if (index > -1) {
    expandedKnowledgeSubjects.value.splice(index, 1);
  } else {
    expandedKnowledgeSubjects.value.push(subjectId);
  }
};

// 切换章节展开
const toggleKnowledgeChapter = async (chapterId) => {
  const index = expandedKnowledgeChapters.value.indexOf(chapterId);
  if (index > -1) {
    expandedKnowledgeChapters.value.splice(index, 1);
  } else {
    expandedKnowledgeChapters.value.push(chapterId);
    // 加载该章节下所有三级考点的四级目录
    for (const subject of knowledgePoints.value) {
      for (const chapter of subject.chapters || []) {
        if (chapter.id === chapterId) {
          for (const point of chapter.points || []) {
            if (!level4CategoriesMap.value.has(point.id)) {
              await fetchLevel4CategoriesForPoint(point);
            }
          }
          break;
        }
      }
    }
  }
};

// 是否选中考点
const isKnowledgePointSelected = (pointId) => {
  return selectedKnowledgePoints.value.some(p => p.id === pointId);
};

// 切换考点选择
const toggleKnowledgePoint = (point) => {
  const index = selectedKnowledgePoints.value.findIndex(p => p.id === point.id);
  if (index > -1) {
    selectedKnowledgePoints.value.splice(index, 1);
  } else {
    selectedKnowledgePoints.value.push({
      id: point.id,
      name: point.name,
      choice: 0,
      fill: 0,
      analysis: 0
    });
  }
};

// 关闭考点选择弹窗
const closeKnowledgeModal = () => {
  showKnowledgeModal.value = false;
};

// 确认考点选择
const confirmKnowledgeModal = () => {
  showKnowledgeModal.value = false;
};

// 切换到考点模式
const switchToKnowledgeMode = () => {
  uni.showModal({
    title: '提示',
    content: '考点组卷算法还不成熟，暂不推荐使用该方法。建议优先使用书籍/章节组卷。',
    showCancel: true,
    cancelText: '取消',
    confirmText: '仍要使用',
    success: (res) => {
      if (res.confirm) {
        selectionMode.value = 'knowledge';
      }
    }
  });
};

// 获取考点配置
const getKnowledgePointConfig = (pointId) => {
  const point = selectedKnowledgePoints.value.find(p => p.id === pointId);
  return point || { choice: 0, fill: 0, analysis: 0 };
};

// 考点数量设置弹窗数据
const showKnowledgeCountModal = ref(false);
const knowledgeCountModalTarget = ref({ pointId: null, pointName: '' });
const knowledgeCountModalData = ref({ choice: 0, fill: 0, analysis: 0 });

// 打开考点数量设置弹窗
const openKnowledgePointCountModal = (point) => {
  knowledgeCountModalTarget.value = { pointId: point.id, pointName: point.name };
  const config = getKnowledgePointConfig(point.id);
  knowledgeCountModalData.value = {
    choice: config.choice || 0,
    fill: config.fill || 0,
    analysis: config.analysis || 0
  };
  showKnowledgeCountModal.value = true;
};

// 确认考点数量设置
const confirmKnowledgeCountModal = () => {
  const { pointId } = knowledgeCountModalTarget.value;
  const point = selectedKnowledgePoints.value.find(p => p.id === pointId);
  if (point) {
    point.choice = parseInt(knowledgeCountModalData.value.choice) || 0;
    point.fill = parseInt(knowledgeCountModalData.value.fill) || 0;
    point.analysis = parseInt(knowledgeCountModalData.value.analysis) || 0;
  }
  showKnowledgeCountModal.value = false;
};

// 关闭考点数量设置弹窗
const closeKnowledgeCountModal = () => {
  showKnowledgeCountModal.value = false;
};

// 监听弹窗打开，加载考点数据
watch(showKnowledgeModal, (newVal) => {
  if (newVal && knowledgePoints.value.length === 0) {
    fetchKnowledgePoints();
  }
});

// 计算已选各题型数量
const calculateQuestionCounts = () => {
  let choice = 0, fill = 0, analysis = 0;
  // 遍历所有选中的范围
  selectedScope.value.forEach(scope => {
    const bookId = scope.bookId;
    // 如果有选中章节
    if (scope.chapters && scope.chapters.length > 0) {
      scope.chapters.forEach(chapterName => {
        const config = scopeConfigs.value[`chapter-${bookId}-${chapterName}`] || {};
        choice += config.choice || 0;
        fill += config.fill || 0;
        analysis += config.analysis || 0;
      });
    } else {
      // 整本书的配置
      const config = scopeConfigs.value[`book-${bookId}`] || {};
      choice += config.choice || 0;
      fill += config.fill || 0;
      analysis += config.analysis || 0;
    }
  });
  return { choice, fill, analysis, total: choice + fill + analysis };
};

const displaySubjects = computed(() => {
  return subjects.value
    .filter(s => s && s.name && s.name !== '公共数学')
    .sort((a, b) => {
      const order = { '考研数学(一)': 1, '考研数学(二)': 2, '考研数学(三)': 3 };
      return (order[a.name] || 99) - (order[b.name] || 99);
    });
});

onLoad((options) => {
  if (options.subjectId) {
    selectedSubjectId.value = parseInt(options.subjectId);
    fixedSubject.value = true;
    fetchBooks(selectedSubjectId.value);
    fetchUserBookshelf(selectedSubjectId.value);
  } else {
    fetchSubjects();
  }
});

// 页面显示时刷新试卷列表（处理删除试卷后返回的情况）
onShow(() => {
  if (compositionMode.value === 'my-papers') {
    fetchGeneratedPapers();
  }
});

// 手动组卷函数
const fetchUserBookshelf = async (subjectId) => {
  try {
    const res = await request({ url: `/math/bookshelf?subjectId=${subjectId}` });
    userBookshelf.value = res.data || [];
  } catch (err) {
    console.error('获取书架失败:', err);
  }
};

const openSourceSelector = () => {
  showSourceSelector.value = true;
  if (currentSourceTab.value === 'favorite' && favoriteQuestions.value.length === 0) {
    fetchFavorites();
  }
  if (currentSourceTab.value === 'knowledge' && knowledgePoints.value.length === 0) {
    fetchKnowledgePoints();
  }
};

// 切换资源选项卡
const switchSourceTab = (tab) => {
  currentSourceTab.value = tab;
  if (tab === 'favorite' && favoriteQuestions.value.length === 0) {
    fetchFavorites();
  }
  if (tab === 'knowledge' && knowledgePoints.value.length === 0) {
    fetchKnowledgePoints();
  }
  // 重置浏览状态
  browsingKnowledgePoint.value = null;
  browsingSource.value = null;
  browsingChapter.value = null;
};

// 切换手动组卷考点科目展开
const toggleManualKnowledgeSubject = (subjectId) => {
  const index = expandedManualSubjects.value.indexOf(subjectId);
  if (index > -1) {
    expandedManualSubjects.value.splice(index, 1);
  } else {
    expandedManualSubjects.value.push(subjectId);
  }
};

// 切换手动组卷考点章节展开
const toggleManualKnowledgeChapter = (chapterId) => {
  const index = expandedManualChapters.value.indexOf(chapterId);
  if (index > -1) {
    expandedManualChapters.value.splice(index, 1);
  } else {
    expandedManualChapters.value.push(chapterId);
  }
};

// 切换手动组卷三级考点展开（显示四级目录）
const toggleManualKnowledgePoint = async (point) => {
  const index = expandedManualPoints.value.indexOf(point.id);
  if (index > -1) {
    expandedManualPoints.value.splice(index, 1);
  } else {
    expandedManualPoints.value.push(point.id);
    // 如果还没有加载四级目录，则加载
    if (!level4CategoriesMap.value.has(point.id)) {
      await fetchLevel4CategoriesForPoint(point);
    }
  }
};

// 获取四级目录
const fetchLevel4CategoriesForPoint = async (point) => {
  try {
    const res = await request({
      url: `/math/knowledge-point-level4?parentId=${point.id}`,
      method: 'GET'
    });
    const level4List = res.data || [];
    level4CategoriesMap.value.set(point.id, level4List);
  } catch (err) {
    console.error('获取四级目录失败:', err);
    level4CategoriesMap.value.set(point.id, []);
  }
};

// 获取四级目录列表
const getLevel4Categories = (point) => {
  return level4CategoriesMap.value.get(point.id) || [];
};

// 浏览四级考点题目
const browseLevel4Point = async (level4, parentPoint) => {
  console.log('浏览四级考点:', level4, '父级:', parentPoint);
  browsingKnowledgePoint.value = { ...level4, parentName: parentPoint.name };
  loadingKnowledgeQuestions.value = true;
  knowledgeQuestions.value = [];
  
  try {
    // 使用四级考点ID获取题目
    const res = await request({
      url: `/math/questions/by-knowledge-point?knowledgePointId=${level4.id}`,
      method: 'GET'
    });
    
    console.log('获取四级考点题目结果:', res);
    
    if (res.code === 0 && res.data) {
      knowledgeQuestions.value = res.data || [];
    }
  } catch (err) {
    console.error('获取四级考点题目失败:', err);
    uni.showToast({ title: '获取题目失败', icon: 'none' });
  } finally {
    loadingKnowledgeQuestions.value = false;
  }
};

// 浏览三级考点题目
const browseLevel3Point = async (point) => {
  console.log('浏览三级考点:', point);
  
  // 先加载四级考点列表
  let level4List = [];
  try {
    const res = await request({
      url: `/math/knowledge-point-level4?parentId=${point.id}`,
      method: 'GET'
    });
    level4List = res.data || [];
  } catch (err) {
    console.error('获取四级考点失败:', err);
  }
  
  browsingKnowledgePoint.value = { 
    ...point, 
    isLevel3: true,
    name: point.name,
    level4List: level4List,
    selectedLevel4: null
  };
  loadingKnowledgeQuestions.value = true;
  knowledgeQuestions.value = [];
  
  try {
    // 使用三级考点ID获取题目
    const res = await request({
      url: `/math/questions/by-knowledge-point?knowledgePointId=${point.id}`,
      method: 'GET'
    });
    
    console.log('获取三级考点题目结果:', res);
    
    if (res.code === 0 && res.data) {
      knowledgeQuestions.value = res.data || [];
    }
  } catch (err) {
    console.error('获取三级考点题目失败:', err);
    uni.showToast({ title: '获取题目失败', icon: 'none' });
  } finally {
    loadingKnowledgeQuestions.value = false;
  }
};

// 浏览考点（三级考点，直接显示所有题目）- 兼容旧代码
const browseKnowledgePoint = async (point, chapter = null, subject = null) => {
  browsingKnowledgePoint.value = point;
  loadingKnowledgeQuestions.value = true;
  knowledgeQuestions.value = [];
  
  try {
    // 使用考点题目接口获取题目（参考 math-knowledge-questions 页面）
    const res = await request({
      url: `/math/questions/by-knowledge-point?knowledgePointId=${point.id}`,
      method: 'GET'
    });
    
    if (res.code === 0 && res.data) {
      knowledgeQuestions.value = res.data || [];
    }
  } catch (err) {
    console.error('获取考点题目失败:', err);
    uni.showToast({ title: '获取题目失败', icon: 'none' });
  } finally {
    loadingKnowledgeQuestions.value = false;
  }
};

const fetchFavorites = async () => {
  if (!selectedSubjectId.value) return;
  loadingFavorites.value = true;
  try {
    const res = await request({ 
      url: `/math/favorites?subjectId=${selectedSubjectId.value}` 
    });
    favoriteQuestions.value = res.data || [];
  } catch (err) {
    console.error('获取收藏失败:', err);
  } finally {
    loadingFavorites.value = false;
  }
};

const browseSource = async (book) => {
  browsingSource.value = book;
  browsingChapter.value = null;
  sourceChapters.value = [];
  try {
    const res = await request({ url: `/math/book-chapters/${book.BookID}` });
    sourceChapters.value = res.data || [];
  } catch (err) {
    console.error('获取章节失败:', err);
  }
};

const browseChapter = async (chap) => {
  browsingChapter.value = chap;
  loadingSourceQuestions.value = true;
  sourceQuestions.value = [];
  try {
    const res = await request({ 
      url: `/math/book-questions/${browsingSource.value.BookID}/${encodeURIComponent(chap.name)}` 
    });
    sourceQuestions.value = res.data || [];
  } catch (err) {
    console.error('获取题目失败:', err);
  } finally {
    loadingSourceQuestions.value = false;
  }
};

const toggleManualQuestion = (q) => {
  const index = manualQuestions.value.findIndex(mq => mq.id === q.QuestionID);
  if (index > -1) {
    manualQuestions.value.splice(index, 1);
  } else {
    // 检查是否超过题目数量限制
    const maxQuestions = paperPermission.value.maxQuestions;
    if (maxQuestions !== null && manualQuestions.value.length >= maxQuestions) {
      uni.showToast({ 
        title: `最多只能选择${maxQuestions}题`, 
        icon: 'none' 
      });
      return;
    }
    
    manualQuestions.value.push({
      id: q.QuestionID,
      type: q.QuestionType || '未知',
      source: browsingSource.value ? browsingSource.value.BookTitle : 
              browsingKnowledgePoint.value ? browsingKnowledgePoint.value.name : '我的收藏',
      bookId: browsingSource.value ? browsingSource.value.BookID : 0,
      bookChapter: browsingChapter.value ? browsingChapter.value.name : '',
      img: q.QuestionImg || ''
    });
  }
};

const isQuestionSelected = (id) => {
  return manualQuestions.value.some(mq => mq.id === id);
};

const removeManualQuestion = (index) => {
  manualQuestions.value.splice(index, 1);
};

const clearManualQuestions = () => {
  uni.showModal({
    title: '确认清空',
    content: '确定要清空所有已选题目吗？',
    success: (res) => {
      if (res.confirm) {
        manualQuestions.value = [];
        uni.showToast({ title: '已清空', icon: 'success' });
      }
    }
  });
};

const dragIndex = ref(-1);

const onDragStart = (e, index) => {
  dragIndex.value = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', index.toString());
};

const onDragOver = (e, index) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
};

const onDrop = (e, targetIndex) => {
  e.preventDefault();
  if (dragIndex.value === -1 || dragIndex.value === targetIndex) return;
  
  const items = [...manualQuestions.value];
  const [removed] = items.splice(dragIndex.value, 1);
  items.splice(targetIndex, 0, removed);
  manualQuestions.value = items;
};

const onDragEnd = () => {
  dragIndex.value = -1;
};

watch(currentSourceTab, (newTab) => {
  if (newTab === 'favorite' && favoriteQuestions.value.length === 0) {
    fetchFavorites();
  }
});

const totalQuestions = computed(() => {
  if (compositionMode.value === 'manual') {
    return manualQuestions.value.length;
  }
  return counts.value.choice + counts.value.fill + counts.value.analysis;
});

// 监听自定义题量的变化，自动调整全局题量
watch(totalCustomCounts, (newVal) => {
  ['choice', 'fill', 'analysis'].forEach(type => {
    const custom = newVal[type];
    if (custom > 0) {
      // 如果有自定义，且用户没手动改过全局（或者是全局小于自定义），则跟随自定义
      if (!userModifiedCounts.value[type] || counts.value[type] < custom) {
        counts.value[type] = custom;
      }
    } else {
      // 如果没有自定义，且用户没手动改过全局，则恢复默认
      if (!userModifiedCounts.value[type]) {
        const defaults = { choice: 10, fill: 6, analysis: 6 };
        counts.value[type] = defaults[type];
      }
    }
  });
}, { deep: true });

const canGenerate = computed(() => {
  // 检查权限
  if (!paperPermission.value.allowed) return false;
  
  // 检查题目数量是否超过限制
  const maxQuestions = paperPermission.value.maxQuestions;
  if (maxQuestions !== null && totalQuestions.value > maxQuestions) return false;
  
  if (compositionMode.value === 'manual') {
    return selectedSubjectId.value && manualQuestions.value.length > 0;
  }
  // 智能组卷模式：检查是否选择了范围（书籍/章节 或 考点）
  const hasScope = selectedScope.value.length > 0 || selectedKnowledgePoints.value.length > 0;
  return selectedSubjectId.value && hasScope && totalQuestions.value > 0;
});

const fetchSubjects = async () => {
  try {
    const res = await request({ url: '/math/subjects' });
    subjects.value = res.data || [];
    if (subjects.value.length > 0) {
      const savedId = uni.getStorageSync('math_selected_subject_id');
      if (savedId) {
        selectedSubjectId.value = parseInt(savedId);
      } else {
        selectedSubjectId.value = subjects.value[0].id;
      }
    }
  } catch (err) {
    console.error('Fetch subjects error:', err);
  }
};

const fetchBooks = async (subjectId) => {
  if (!subjectId) return;
  try {
    const res = await request({ 
      url: '/math/books-by-subject',
      data: { subjectId }
    });
    availableBooks.value = res.data || [];
  } catch (err) {
    console.error('Fetch books error:', err);
  }
};

const selectSubject = (id) => {
  if (fixedSubject.value) return;
  selectedSubjectId.value = id;
  selectedScope.value = [];
  expandedBooks.value = [];
  fetchBooks(id);
  fetchUserBookshelf(id);
};

const toggleBookExpand = async (bookId) => {
  const index = expandedBooks.value.indexOf(bookId);
  if (index > -1) {
    expandedBooks.value.splice(index, 1);
  } else {
    expandedBooks.value.push(bookId);
    if (!bookChapters.value[bookId]) {
      await fetchBookChapters(bookId);
    }
  }
};

// 切换分类展开状态
const toggleCategory = (category) => {
  expandedCategories.value[category] = !expandedCategories.value[category];
};

// 解析章节层级和排序号
const parseChapterInfo = (chapterName) => {
  // 匹配"第X章"或"X."或"X、"开头的格式
  const match = chapterName.match(/第([一二三四五六七八九十百千万亿\d]+)章|^(\d+)[\.、\s]/);
  if (match) {
    const numStr = match[1] || match[2];
    // 将中文数字转换为阿拉伯数字
    const num = chineseToNumber(numStr) || parseInt(numStr) || 0;
    return { level: 1, order: num, name: chapterName };
  }
  // 匹配"X.Y"格式（如 1.2、2.3）表示子章节
  const subMatch = chapterName.match(/^(\d+)\.(\d+)/);
  if (subMatch) {
    const mainNum = parseInt(subMatch[1]);
    const subNum = parseInt(subMatch[2]);
    return { level: 2, order: mainNum * 100 + subNum, name: chapterName };
  }
  // 默认按原样处理
  return { level: 1, order: 9999, name: chapterName };
};

// 中文数字转阿拉伯数字
const chineseToNumber = (chinese) => {
  const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
  if (/^\d+$/.test(chinese)) return parseInt(chinese);
  
  let result = 0;
  let temp = 0;
  for (let i = 0; i < chinese.length; i++) {
    const char = chinese[i];
    const num = map[char];
    if (num === 10) {
      if (temp === 0) temp = 1;
      result += temp * 10;
      temp = 0;
    } else if (num) {
      temp = num;
    }
  }
  return result + temp;
};

const fetchBookChapters = async (bookId) => {
  loadingChapters.value[bookId] = true;
  try {
    const res = await request({ url: `/math/books/${bookId}` });
    const questions = res.data.questions || [];
    
    const chapterMap = {};
    questions.forEach(q => {
      const chapterName = (q.BookChapter && q.BookChapter.trim() !== "") ? q.BookChapter.trim() : "未分类章节";
      if (!chapterMap[chapterName]) {
        const info = parseChapterInfo(chapterName);
        chapterMap[chapterName] = { 
          name: chapterName,
          level: info.level,
          order: info.order
        };
      }
    });
    
    // 按层级和序号排序
    const chapters = Object.values(chapterMap);
    chapters.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.order - b.order;
    });
    
    bookChapters.value[bookId] = chapters;
  } catch (err) {
    console.error('Fetch chapters error:', err);
  } finally {
    loadingChapters.value[bookId] = false;
  }
};

const toggleBookSelection = (bookId) => {
  const index = selectedScope.value.findIndex(s => s.bookId === bookId);
  if (index > -1) {
    selectedScope.value.splice(index, 1);
    // 清理该书籍及其章节的自定义配置
    delete scopeConfigs.value[`book-${bookId}`];
    // 清理该书下所有章节的配置
    Object.keys(scopeConfigs.value).forEach(key => {
      if (key.startsWith(`chapter-${bookId}-`)) {
        delete scopeConfigs.value[key];
      }
    });
  } else {
    selectedScope.value.push({ bookId, chapters: [] });
    if (!expandedBooks.value.includes(bookId)) {
      toggleBookExpand(bookId);
    }
  }
};

const isBookSelected = (bookId) => {
  return selectedScope.value.some(s => s.bookId === bookId);
};

const getSelectedChaptersCount = (bookId) => {
  const item = selectedScope.value.find(s => s.bookId === bookId);
  return item ? item.chapters.length : 0;
};

const toggleChapterSelection = (bookId, chapterName) => {
  let bookScope = selectedScope.value.find(s => s.bookId === bookId);
  if (!bookScope) {
    bookScope = { bookId, chapters: [chapterName] };
    selectedScope.value.push(bookScope);
  } else {
    const cIndex = bookScope.chapters.indexOf(chapterName);
    if (cIndex > -1) {
      bookScope.chapters.splice(cIndex, 1);
      // 清理该章节的自定义配置
      delete scopeConfigs.value[`chapter-${bookId}-${chapterName}`];
    } else {
      bookScope.chapters.push(chapterName);
    }
  }
};

const isChapterSelected = (bookId, chapterName) => {
  const bookScope = selectedScope.value.find(s => s.bookId === bookId);
  return bookScope ? bookScope.chapters.includes(chapterName) : false;
};

const selectAllChapters = (bookId) => {
  const chapters = bookChapters.value[bookId] || [];
  let bookScope = selectedScope.value.find(s => s.bookId === bookId);
  if (!bookScope) {
    bookScope = { bookId, chapters: [] };
    selectedScope.value.push(bookScope);
  }
  bookScope.chapters = chapters.map(c => c.name);
};

const deselectAllChapters = (bookId) => {
  const bookScope = selectedScope.value.find(s => s.bookId === bookId);
  if (bookScope) {
    // 清理这些章节的自定义配置
    bookScope.chapters.forEach(chapName => {
      delete scopeConfigs.value[`chapter-${bookId}-${chapName}`];
    });
    bookScope.chapters = [];
  }
};

const adjustCount = (type, delta) => {
  userModifiedCounts.value[type] = true;
  const newVal = counts.value[type] + delta;
  if (newVal >= 0) {
    counts.value[type] = newVal;
    // 轻微震动反馈
    uni.vibrateShort({ success: () => {}, fail: () => {} });
  }
};

const generatePaper = async () => {
  if (!canGenerate.value || generating.value) return;

  // 检查题目数量限制
  const maxQuestions = paperPermission.value.maxQuestions;
  if (maxQuestions !== null && totalQuestions.value > maxQuestions) {
    uni.showToast({
      title: `题目数量超过限制（最多${maxQuestions}题）`,
      icon: 'none'
    });
    return;
  }

  generating.value = true;
  uni.showLoading({ title: '高质量组卷中...', mask: true });

  let postData = {
    subjectId: selectedSubjectId.value,
    title: paperTitle.value,
    remark: paperRemark.value,
    mode: compositionMode.value
  };

  if (compositionMode.value === 'smart') {
    // 检查是考点模式还是书籍/章节模式
    if (selectedKnowledgePoints.value.length > 0) {
      // 考点模式
      postData.knowledgePoints = selectedKnowledgePoints.value.map(point => ({
        id: point.id,
        name: point.name,
        choice: point.choice || 0,
        fill: point.fill || 0,
        analysis: point.analysis || 0
      }));
      postData.counts = counts.value;
    } else {
      // 书籍/章节模式
      const formattedScope = selectedScope.value.map(item => {
        const bookConfig = scopeConfigs.value[`book-${item.bookId}`];
        const chaptersWithConfigs = item.chapters.map(chapName => ({
          name: chapName,
          counts: scopeConfigs.value[`chapter-${item.bookId}-${chapName}`] || null
        }));

        return {
          bookId: item.bookId,
          chapters: chaptersWithConfigs,
          counts: (item.chapters.length === 0) ? bookConfig : null
        };
      });
      
      postData.scope = formattedScope;
      postData.counts = counts.value;
    }
  } else {
    // 手动模式
    postData.manualQuestions = manualQuestions.value;
  }

  try {
    const res = await request({
      url: '/math/smart-paper/generate',
      method: 'POST',
      data: postData
    });
    
    if (res.code === 0 && res.data.paperId) {
      uni.hideLoading();
      uni.navigateTo({
        url: `/pages/math/math-generated-paper?paperId=${res.data.paperId}`
      });
    } else {
      uni.showToast({ title: res.message || '生成失败', icon: 'none' });
    }
  } catch (err) {
    console.error('Generate paper error:', err);
    uni.showToast({ title: '服务器连接失败', icon: 'none' });
  } finally {
    generating.value = false;
    uni.hideLoading();
  }
};

watch(selectedSubjectId, (newId) => {
  if (newId) {
    fetchBooks(newId);
    fetchUserBookshelf(newId);
  }
});
</script>

<style scoped>
.config-container {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding-bottom: 120rpx;
}

/* 权限信息提示 - 微信橙色提醒样式 */
.permission-banner {
  background: #fffbe6;
  border-left: 4rpx solid #faad14;
  padding: 20rpx 30rpx;
  margin: 20rpx 30rpx 0;
  border-radius: 0 8rpx 8rpx 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.permission-banner.super-admin {
  background: #f6ffed;
  border-left-color: #52c41a;
}

.permission-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.permission-text {
  color: #d48806;
  font-size: 28rpx;
  font-weight: 500;
}

.permission-remaining {
  color: #d48806;
  font-size: 26rpx;
  background: rgba(255, 183, 77, 0.2);
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

.permission-remaining.warning {
  background: rgba(255, 82, 82, 0.8);
  color: #fff;
}

.max-questions-text {
  color: #d48806;
  font-size: 24rpx;
}

.super-admin .permission-text {
  color: #389e0d;
  font-weight: 600;
}

.top-bar {
  display: flex;
  align-items: center;
  padding: 40rpx 30rpx 20rpx;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}

.back-btn {
  font-size: 32rpx;
  color: #666;
  margin-right: 30rpx;
}

.page-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.main-content {
  padding: 16rpx;
}

.config-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 16rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.03);
}

.manual-section {
  padding: 16rpx;
}

.selected-scope-preview {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 12rpx;
}

.scope-preview-item {
  background: #f5f7fa;
  border-radius: 10rpx;
  padding: 12rpx 14rpx;
  border: 1rpx solid #e9ecef;
}

.item-main {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.book-name {
  font-size: 24rpx;
  color: #333;
  font-weight: 500;
}

.chapter-count {
  font-size: 20rpx;
  color: #4db6ac;
  background: rgba(77, 182, 172, 0.1);
  padding: 2rpx 10rpx;
  border-radius: 12rpx;
}

.item-configs {
  display: flex;
  gap: 8rpx;
  margin-top: 8rpx;
  padding-top: 8rpx;
  border-top: 1rpx solid #e0e0e0;
}

.config-tag {
  font-size: 20rpx;
  color: #4db6ac;
  background: rgba(77, 182, 172, 0.1);
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 16rpx;
  border-left: 8rpx solid #4db6ac;
  padding-left: 20rpx;
}

.subject-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.subject-chip {
  padding: 18rpx 44rpx;
  background: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  color: #5d6d7e;
  border: 2rpx solid #e9ecef;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.subject-chip.active {
  background: linear-gradient(135deg, #4db6ac, #26a69a);
  color: #fff;
  border-color: #4db6ac;
  box-shadow: 0 8rpx 16rpx rgba(77, 182, 172, 0.25);
  transform: translateY(-2rpx);
}

.book-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 8rpx 4rpx;
}

.book-category {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.category-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  padding: 28rpx 32rpx;
  background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 16rpx 16rpx 0 0;
}

.category-title:active {
  background: linear-gradient(135deg, #26a69a 0%, #4db6ac 100%);
}



.category-toggle {
  font-size: 24rpx;
  color: #fff;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  transition: transform 0.3s ease;
}

.category-content {
  display: flex;
  flex-direction: column;
  padding: 20rpx;
  gap: 12rpx;
  background: #fafafa;
}

.book-item {
  background: #fff;
  border-radius: 12rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  border: 1rpx solid #f0f0f0;
  transition: all 0.2s ease;
}

.book-item:active {
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
}

.book-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
  background: #fff;
  border-radius: 12rpx;
  margin-bottom: 12rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
}

.book-header-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.book-header:active {
  background: #f5f5f5;
  transform: scale(0.98);
}

.checkbox {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 50%;
  margin-right: 16rpx;
  position: relative;
  transition: all 0.2s ease;
  background: #fff;
}

.checkbox.checked {
  background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
  border-color: #4db6ac;
  box-shadow: 0 2rpx 8rpx rgba(77, 182, 172, 0.3);
}

.checkbox.checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10rpx;
  height: 16rpx;
  border: 3rpx solid #fff;
  border-top: none;
  border-left: none;
  transform: translate(-50%, -60%) rotate(45deg);
}

.book-name {
  flex: 1;
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
  line-height: 1.4;
}

.expand-icon {
  padding: 8rpx 16rpx;
  color: #4db6ac;
  font-size: 22rpx;
  background: rgba(77, 182, 172, 0.08);
  border-radius: 20rpx;
  margin-left: 12rpx;
  transition: all 0.2s ease;
}

.expand-icon:active {
  background: rgba(77, 182, 172, 0.15);
}

.book-tag {
  font-size: 18rpx;
  background: rgba(77, 182, 172, 0.1);
  color: #4db6ac;
  padding: 2rpx 10rpx;
  border-radius: 16rpx;
  margin-left: 8rpx;
}

.chapter-list {
  padding: 12rpx;
  background: #fff;
  border-top: 1rpx solid #eee;
}

.chapter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-bottom: 10rpx;
  font-size: 22rpx;
  color: #4db6ac;
}

.chapter-actions span {
  padding: 4rpx 8rpx;
}

.chapter-list-vertical {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 4rpx 0;
}

.chapter-row-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 16rpx;
  background: #fff;
  border: 1rpx solid #e9ecef;
  border-radius: 10rpx;
  transition: all 0.2s;
}

.chapter-row-item.level-1 {
  background: #fff;
  border-left: 4rpx solid #4db6ac;
}

.chapter-row-item.level-2 {
  background: #fafafa;
  border-left: 4rpx solid #ccc;
  margin-left: 30rpx;
}

.chapter-row-item.active {
  background: rgba(77, 182, 172, 0.1);
  border-color: #4db6ac;
}

.chapter-row-item.level-2.active {
  background: rgba(77, 182, 172, 0.05);
  border-left-color: #4db6ac;
}

.chapter-row-item:active {
  background: #f5f7fa;
}

.chapter-row-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex: 1;
}

.chapter-index {
  width: 36rpx;
  height: 36rpx;
  background: #f0f0f0;
  color: #666;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  font-weight: 500;
  flex-shrink: 0;
}

.chapter-index.sub-index {
  background: #e0e0e0;
  color: #999;
  font-size: 18rpx;
}

.chapter-row-item.active .chapter-index {
  background: #4db6ac;
  color: #fff;
}

.chapter-row-item.active .chapter-index.sub-index {
  background: #80cbc4;
  color: #fff;
}

.chapter-name-text {
  font-size: 24rpx;
  color: #333;
  flex: 1;
}

.chapter-name-text.sub-name {
  font-size: 22rpx;
  color: #666;
}

.chapter-row-config {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.chapter-check-icon {
  width: 36rpx;
  height: 36rpx;
  background: #f0f0f0;
  color: #999;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}

.chapter-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10rpx;
  padding: 4rpx 0;
}

.chapter-item {
  background: #f5f7fa;
  border: 1rpx solid #e9ecef;
  border-radius: 10rpx;
  padding: 16rpx 12rpx;
  font-size: 22rpx;
  color: #5d6d7e;
  text-align: center;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 70rpx;
  line-height: 1.3;
}

.chapter-item.active {
  background: rgba(77, 182, 172, 0.1);
  color: #4db6ac;
  border-color: #4db6ac;
}

.chapter-item:active {
  transform: scale(0.98);
}

.m-cfg-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 22rpx;
  color: #fff;
  background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2rpx 8rpx rgba(77, 182, 172, 0.3);
}

.m-cfg-item:active {
  transform: scale(0.95);
  box-shadow: 0 4rpx 12rpx rgba(77, 182, 172, 0.4);
}

.m-cfg-count {
  font-weight: 600;
  min-width: 24rpx;
  text-align: center;
}

.m-cfg-counts {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.count-tag {
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 12rpx;
  color: #fff;
  font-weight: 500;
}

.count-tag.choice {
  background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
}

.count-tag.fill {
  background: linear-gradient(135deg, #7986cb 0%, #5c6bc0 100%);
}

.count-tag.analysis {
  background: linear-gradient(135deg, #ff8a65 0%, #ff7043 100%);
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.section-header-row .section-title {
  margin-bottom: 0;
  flex: 1;
}

.mode-section {
  padding-bottom: 0;
}

.mode-section .mode-tabs {
  margin-bottom: 0;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.section-title::before {
  content: '';
  width: 6rpx;
  height: 28rpx;
  background: linear-gradient(to bottom, #4db6ac, #26a69a);
  border-radius: 3rpx;
}

.select-scope-btn {
  background: linear-gradient(135deg, #4db6ac, #26a69a);
  color: white;
  font-size: 22rpx;
  padding: 8rpx 20rpx;
  border-radius: 28rpx;
  border: none;
  transition: all 0.2s;
  line-height: 1.4;
  height: auto;
}

.select-scope-btn:active {
  transform: scale(0.96);
}

.mode-toggle-section {
  margin-bottom: 16rpx;
}

.mode-tabs {
  display: flex;
  background: #ebf0f5;
  border-radius: 50rpx;
  padding: 6rpx;
  position: relative;
}

.mode-tab {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 26rpx;
  color: #7f8c8d;
  border-radius: 40rpx;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 1;
}

.mode-tab.active {
  background: #fff;
  color: #4db6ac;
  font-weight: 600;
  box-shadow: 0 4rpx 15rpx rgba(0,0,0,0.08);
}

.manual-header-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.manual-count {
  font-size: 26rpx;
  color: #4db6ac;
  font-weight: 500;
}

.clear-btn {
  padding: 6rpx 16rpx;
  border-radius: 24rpx;
  font-size: 22rpx;
  background: #fff;
  color: #e74c3c;
  border: 1rpx solid #e74c3c;
  line-height: 1.4;
}

.clear-btn:active {
  background: #e74c3c;
  color: #fff;
}

.manual-actions {
  display: flex;
  gap: 12rpx;
}

.action-chip {
  padding: 8rpx 20rpx;
  border-radius: 28rpx;
  font-size: 24rpx;
  background: #fff;
  color: #5d6d7e;
  border: 1rpx solid #dcdde1;
  line-height: 1.4;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-chip::after {
  border: none;
}

.action-chip.primary {
  background: #4db6ac;
  color: #fff;
  border-color: #4db6ac;
}

.action-chip:active {
  opacity: 0.8;
  transform: translateY(1rpx);
}

.manual-questions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
  margin-top: 16rpx;
}

.manual-q-item {
  background: #fff;
  border-radius: 12rpx;
  border: 2rpx solid #f0f0f0;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
  cursor: grab;
}

.manual-q-item.dragging {
  opacity: 0.5;
  border-color: #4db6ac;
  box-shadow: 0 8rpx 24rpx rgba(77, 182, 172, 0.3);
}

.manual-q-item:active {
  cursor: grabbing;
}

.manual-q-item:active {
  transform: scale(0.98);
  border-color: #e74c3c;
}

.manual-q-thumb {
  width: 100%;
  display: block;
}

.manual-q-no-thumb {
  width: 100%;
  height: 100rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  gap: 8rpx;
}

.manual-q-no-thumb .q-idx {
  font-size: 32rpx;
  color: #333;
  font-weight: bold;
}

.manual-q-no-thumb .q-type-tag {
  font-size: 20rpx;
  background: rgba(77, 182, 172, 0.1);
  color: #4db6ac;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.manual-q-number {
  position: absolute;
  top: 8rpx;
  left: 8rpx;
  min-width: 36rpx;
  height: 36rpx;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  padding: 0 8rpx;
}

.manual-q-remove {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 36rpx;
  height: 36rpx;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
}

.q-idx {
  font-size: 26rpx;
  color: #95a5a6;
  font-family: monospace;
}

.q-type-tag {
  font-size: 22rpx;
  background: rgba(77, 182, 172, 0.1);
  color: #4db6ac;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  font-weight: 500;
}

.manual-empty-tip {
  padding: 120rpx 40rpx;
  text-align: center;
  background: #fcfdfe;
  border-radius: 24rpx;
  border: 2rpx dashed #d1d9e0;
  transition: all 0.3s;
}

.manual-empty-tip:hover {
  border-color: #4db6ac;
  background: rgba(77, 182, 172, 0.05);
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 30rpx;
  display: block;
}

.tip {
  font-size: 28rpx;
  color: #95a5a6;
  line-height: 1.6;
}

/* 弹窗样式进一步优化 */
.full-modal {
  width: 100vw;
  height: calc(100vh - 120rpx - env(safe-area-inset-bottom));
  border-radius: 30rpx 30rpx 0 0;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.source-selector-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 0;
}

.modal-header {
  padding: 24rpx 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1rpx solid #f0f0f0;
  flex-shrink: 0;
}

.modal-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #2c3e50;
}

.close-btn {
  font-size: 40rpx;
  color: #95a5a6;
  padding: 10rpx;
}

.source-tabs {
  display: flex;
  background: #f0f2f5;
  padding: 4rpx;
  border-radius: 10rpx;
  margin: 0 12rpx 12rpx;
}

.source-tab {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  font-size: 24rpx;
  color: #666;
  border-radius: 8rpx;
  transition: all 0.2s;
}

.source-tab.active {
  background: #fff;
  color: #4db6ac;
  font-weight: 500;
}

.source-tab.active::after {
  display: none;
}

.source-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  position: relative;
}

.source-scroll {
  flex: 1;
  height: 100%;
}

.source-scroll ::v-deep .uni-scroll-view-content {
  padding-bottom: 140rpx;
}

.source-list {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 140rpx;
}

/* 手动组卷考点层级样式 */
.manual-knowledge-list {
  padding: 12rpx 12rpx 140rpx 12rpx;
}

.manual-knowledge-subject {
  margin-bottom: 16rpx;
  background: #fff;
  border-radius: 12rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.manual-subject-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 28rpx;
  background: linear-gradient(135deg, #4db6ac, #26a69a);
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
}

.manual-toggle {
  font-size: 24rpx;
  opacity: 0.9;
}

.manual-chapter-list {
  padding: 12rpx;
}

.manual-chapter-item {
  margin-bottom: 12rpx;
  background: #f8f9fa;
  border-radius: 10rpx;
  overflow: hidden;
}

.manual-chapter-header {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  gap: 16rpx;
}

.manual-expand-icon {
  font-size: 22rpx;
  color: #4db6ac;
  font-weight: 500;
}

.manual-chapter-name {
  font-size: 28rpx;
  color: #2c3e50;
  font-weight: 600;
}

.manual-point-list {
  padding: 0 12rpx 12rpx;
}

.manual-point-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18rpx 20rpx;
  margin-bottom: 8rpx;
  background: #fff;
  border-radius: 8rpx;
  border: 1rpx solid #e8e8e8;
  transition: all 0.2s;
}

.manual-point-item:active {
  background: #f0f7f6;
  transform: scale(0.99);
}

.manual-point-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.manual-point-icon {
  font-size: 28rpx;
}

.manual-point-name {
  font-size: 26rpx;
  color: #333;
}

.manual-point-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.manual-point-count {
  font-size: 22rpx;
  color: #999;
}

.manual-point-arrow {
  font-size: 24rpx;
  color: #ccc;
}

/* 四级目录样式 */
.manual-level4-list {
  padding-left: 24rpx;
  background: #fafbfc;
}

.manual-level4-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 20rpx;
  margin-bottom: 6rpx;
  background: #fff;
  border-radius: 8rpx;
  border: 1rpx solid #e8e8e8;
  margin-left: 20rpx;
  transition: all 0.2s;
}

.manual-level4-item:active {
  background: #f0f7f6;
  transform: scale(0.99);
}

.manual-level4-left {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.manual-level4-icon {
  font-size: 24rpx;
}

.manual-level4-name {
  font-size: 24rpx;
  color: #555;
}

.manual-level4-right {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.manual-level4-count {
  font-size: 20rpx;
  color: #999;
}

.manual-level4-arrow {
  font-size: 22rpx;
  color: #ccc;
}

.source-item {
  display: flex;
  align-items: center;
  padding: 16rpx 14rpx;
  margin: 0 12rpx 8rpx;
  border-radius: 10rpx;
  background: #fff;
  border: 1rpx solid #f0f0f0;
  transition: all 0.2s;
}

.source-item:active {
  background: #f5f7fa;
  border-color: #4db6ac;
}

.source-item-title {
  font-size: 26rpx;
  font-weight: 500;
  color: #333;
}

.q-items-grid {
  padding: 8rpx 8rpx 140rpx 8rpx;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8rpx;
}

.q-item-selectable {
  border-radius: 10rpx;
  border: 1rpx solid #f0f0f0;
  overflow: hidden;
  background: #fff;
  transition: all 0.2s;
  position: relative;
}

.q-item-selectable.selected {
  border-color: #4db6ac;
  background: rgba(77, 182, 172, 0.1);
  box-shadow: 0 4rpx 12rpx rgba(77, 182, 172, 0.2);
}

.q-item-selectable.selected::after {
  content: '✓';
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 36rpx;
  height: 36rpx;
  background: #4db6ac;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: bold;
}

.q-thumb {
  width: 100%;
  display: block;
}

.q-no-thumb {
  width: 100%;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  color: #999;
  font-size: 22rpx;
}

.id-textarea {
  border-radius: 16rpx;
  border-color: #e0e6ed;
  background: #f9fbff;
  padding: 30rpx;
  line-height: 1.6;
}

.id-textarea:focus {
  border-color: #4db6ac;
  background: #fff;
}

.input-desc {
  margin-bottom: 20rpx;
  color: #7f8c8d;
}

.no-data {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
  font-size: 28rpx;
}

.loading-inline {
  text-align: center;
  padding: 40rpx 0;
  color: #999;
  font-size: 24rpx;
}

.config-label {
  font-size: 22rpx;
  color: #666;
}

.scope-config-area {
  padding: 12rpx 16rpx;
  background: #f5f7fa;
  border-top: 1rpx solid #eee;
}

.mini-counters {
  display: flex;
  gap: 16rpx;
  margin-top: 8rpx;
}

.mini-counter {
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 22rpx;
  color: #666;
}

.mini-counter .ctl {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 20rpx;
  border: 1rpx solid #e0e0e0;
  overflow: hidden;
}

.mini-counter button {
  width: 40rpx;
  height: 40rpx;
  border: none;
  background: transparent;
  color: #4db6ac;
  font-size: 28rpx;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-counter button::after {
  border: none;
}

.mini-counter input {
  width: 48rpx;
  height: 40rpx;
  text-align: center;
  font-size: 22rpx;
  background: transparent;
  border: none;
  padding: 0;
}

.count-setters {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.type-info {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.type-label {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}

.custom-hint {
  font-size: 22rpx;
  color: #999;
}

.count-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 0;
}

.counter {
  display: flex;
  align-items: center;
  background: #f5f7fa;
  border-radius: 32rpx;
  border: 1rpx solid #e9ecef;
  overflow: hidden;
  padding: 2rpx;
}

.counter button {
  width: 52rpx;
  height: 52rpx;
  border: none;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #4db6ac;
  transition: all 0.2s;
  line-height: 1;
  padding: 0;
  margin: 0;
}

.counter button:active {
  background: rgba(77, 182, 172, 0.1);
  transform: scale(0.9);
}

.counter button::after {
  border: none;
}

.counter input {
  width: 60rpx;
  text-align: center;
  font-size: 26rpx;
  font-weight: 600;
  color: #2c3e50;
  background: transparent;
}

.generate-btn {
  width: 100%;
  height: 80rpx;
  background: linear-gradient(135deg, #4db6ac, #26a69a);
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: bold;
  box-shadow: 0 8rpx 16rpx rgba(77, 182, 172, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  border: none;
}

.generate-btn:disabled {
  background: #dcdde1;
  color: #fff;
  box-shadow: none;
  opacity: 0.8;
}

.generate-btn.no-permission:disabled {
  background: #ff6b6b;
  opacity: 0.9;
}

.generate-btn:not(:disabled) {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 10rpx 20rpx rgba(77, 182, 172, 0.3); }
  50% { box-shadow: 0 10rpx 30rpx rgba(77, 182, 172, 0.5); }
  100% { box-shadow: 0 10rpx 20rpx rgba(77, 182, 172, 0.3); }
}

.generate-btn:not(:disabled):active {
  transform: translateY(2rpx) scale(0.98);
  box-shadow: 0 4rpx 10rpx rgba(77, 182, 172, 0.2);
  animation: none;
}

.q-count-badge {
  font-size: 22rpx;
  background: #e74c3c;
  color: #fff;
  padding: 2rpx 12rpx;
  border-radius: 20rpx;
  margin-left: 10rpx;
  font-weight: normal;
}

.action-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 20rpx 40rpx calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.05);
  z-index: 90;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.action-footer .tip {
  font-size: 22rpx;
  margin: 0;
}

/* 底部权限提示横幅 */
.permission-tip-banner {
  background: #fffbe6;
  border-left: 4rpx solid #faad14;
  padding: 16rpx 24rpx;
  border-radius: 0 8rpx 8rpx 0;
  width: 100%;
  margin-bottom: 12rpx;
}

.permission-tip-text {
  color: #d48806;
  font-size: 26rpx;
  margin: 0;
  text-align: center;
}

/* 原生模板广告容器 - 嵌入在section之间 */
.section-ad-container {
  margin: 20rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.papers-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 20rpx 24rpx;
}

.paper-item {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.paper-info {
  flex: 1;
}

.paper-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 8rpx;
}

.paper-meta {
  font-size: 24rpx;
  color: #999;
}

.meta-divider {
  margin: 0 12rpx;
}

.paper-action {
  padding-left: 20rpx;
}

.action-btn {
  font-size: 26rpx;
  color: #4db6ac;
  font-weight: 500;
}

.empty-state {
  text-align: center;
  padding: 80rpx 40rpx;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.empty-state p {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 12rpx;
}

.empty-state .tip {
  font-size: 24rpx;
  color: #999;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4rpx);
  display: flex;
  align-items: flex-end; /* 底部弹出更符合移动端习惯 */
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  width: 100%;
  max-height: 80vh;
  border-radius: 30rpx 30rpx 0 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
}

.scope-modal {
  max-height: 85vh;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-header {
  padding: 30rpx 40rpx;
  border-bottom: 1rpx solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-footer {
  padding: 30rpx 40rpx;
  display: flex;
  gap: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}

.scope-modal-footer {
  justify-content: space-between;
  align-items: center;
}

.scope-modal-counts {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.scope-count-item {
  display: flex;
  align-items: center;
}

.count-tag-sm {
  font-size: 22rpx;
  padding: 6rpx 14rpx;
  border-radius: 20rpx;
  color: #fff;
  font-weight: 500;
}

.count-tag-sm.choice {
  background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
}

.count-tag-sm.fill {
  background: linear-gradient(135deg, #7986cb 0%, #5c6bc0 100%);
}

.count-tag-sm.analysis {
  background: linear-gradient(135deg, #ff8a65 0%, #ff7043 100%);
}

.scope-count-total {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-left: 10rpx;
  padding-left: 16rpx;
  border-left: 2rpx solid #e0e0e0;
}

.cancel-btn, .confirm-btn {
  height: 90rpx;
  border-radius: 45rpx;
  font-size: 30rpx;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cancel-btn {
  flex: 1;
  max-width: 200rpx;
}

.confirm-btn {
  flex: 2;
  max-width: 400rpx;
}

.scope-modal-footer .confirm-btn {
  flex: 1;
  max-width: 280rpx;
  margin-left: 20rpx;
}

.cancel-btn {
  background: #f5f6f7;
  color: #7f8c8d;
  border: none;
}

.confirm-btn {
  background: linear-gradient(135deg, #4db6ac, #26a69a);
  color: #fff;
  border: none;
  box-shadow: 0 4rpx 12rpx rgba(77, 182, 172, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16rpx 32rpx;
}

.confirm-btn .btn-text {
  font-size: 30rpx;
  font-weight: 600;
}

.confirm-btn .btn-subtext {
  font-size: 20rpx;
  opacity: 0.9;
  margin-top: 4rpx;
}

.confirm-btn:disabled {
  opacity: 0.5;
  box-shadow: none;
}

.close-btn {
  font-size: 40rpx;
  color: #999;
  padding: 10rpx;
}

.modal-body {
  padding: 30rpx;
  flex: 1;
  overflow-y: auto;
}

.input-item {
  margin-bottom: 30rpx;
}

.input-item label {
  display: block;
  font-size: 28rpx;
  color: #7f8c8d;
  margin-bottom: 16rpx;
  font-weight: 500;
}

.paper-name-input, .paper-remark-textarea {
  width: 100%;
  background: #f8f9fa;
  border: 2rpx solid #e9ecef;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  transition: all 0.2s;
}

.paper-name-input {
  height: 76rpx;
  min-height: 76rpx;
  max-height: 76rpx;
  resize: none;
}

.paper-name-input:focus, .paper-remark-textarea:focus {
  background: #fff;
  border-color: #4db6ac;
  box-shadow: 0 0 0 4rpx rgba(77, 182, 172, 0.1);
}

.paper-remark-textarea {
  height: 180rpx;
}

.modal-footer {
  padding: 20rpx 30rpx;
  border-top: 2rpx solid #eee;
  display: flex;
  gap: 20rpx;
  align-items: center;
}

.modal-footer button {
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-footer .cancel-btn {
  flex: 1;
  max-width: 200rpx;
}

.modal-footer .confirm-btn {
  flex: 2;
  max-width: 400rpx;
}

.count-modal-footer {
  padding: 20rpx 30rpx;
  border-top: 2rpx solid #eee;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.count-modal-total {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.count-modal-btns {
  display: flex;
  gap: 16rpx;
}

.count-modal-btns button {
  height: 72rpx;
  border-radius: 36rpx;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 40rpx;
}

.total-label {
  font-size: 26rpx;
  color: #666;
}

.total-value {
  font-size: 30rpx;
  font-weight: 600;
  color: #4db6ac;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
  border: none;
}

.confirm-btn {
  background: #4db6ac;
  color: #fff;
  border: none;
}

/* 考点选择弹窗 - 与书籍弹窗样式一致 */
.scope-modal .scope-book-item {
  background: #fff;
  border-radius: 12rpx;
  margin-bottom: 12rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.scope-modal .scope-book-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
  background: #fff;
  transition: all 0.2s;
}

.scope-modal .scope-book-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.scope-modal .scope-book-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #2c3e50;
  margin-left: 16rpx;
}

.scope-modal .expand-icon {
  padding: 8rpx 16rpx;
  color: #4db6ac;
  font-size: 22rpx;
  background: rgba(77, 182, 172, 0.08);
  border-radius: 20rpx;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.scope-modal .scope-chapter-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 0 20rpx 20rpx 20rpx;
}

.scope-modal .scope-chapter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 16rpx;
  background: #fff;
  border: 1rpx solid #e9ecef;
  border-radius: 10rpx;
  transition: all 0.2s;
  border-left: 4rpx solid #4db6ac;
}

.scope-modal .scope-chapter-row.active {
  background: rgba(77, 182, 172, 0.1);
  border-color: #4db6ac;
}

.scope-modal .scope-chapter-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex: 1;
}

.scope-modal .scope-checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #ddd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.scope-modal .scope-checkbox.checked {
  background: #4db6ac;
  border-color: #4db6ac;
}

.scope-modal .scope-checkbox.checked::after {
  content: '✓';
  color: #fff;
  font-size: 20rpx;
  font-weight: bold;
}

.scope-modal .scope-chapter-name {
  font-size: 28rpx;
  color: #333;
}

/* 四级考点样式 */
.scope-modal .scope-chapter-row.level4-row {
  padding-left: 60rpx;
  background: #f8f9fa;
}

.scope-modal .scope-chapter-row.level4-row .scope-chapter-name.level4-name {
  font-size: 26rpx;
  color: #666;
}

.scope-modal .scope-check-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 28rpx;
  transition: all 0.2s;
}

.scope-modal .scope-chapter-row:hover .scope-check-icon {
  background: #4db6ac;
  color: #fff;
}

/* 题目数量设置弹窗 */
.count-modal {
  width: 600rpx;
  max-height: 600rpx;
}

.count-modal-body {
  padding: 20rpx;
}

.count-form {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.count-form-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 20rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
}

.count-label {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.count-input-wrap {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.count-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #4db6ac 0%, #26a69a 100%);
  color: #fff;
  font-size: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  box-shadow: 0 4rpx 12rpx rgba(77, 182, 172, 0.4);
  transition: all 0.2s ease;
}

.count-btn:active {
  transform: scale(0.95);
  box-shadow: 0 2rpx 8rpx rgba(77, 182, 172, 0.3);
}

.count-input {
  width: 100rpx;
  height: 64rpx;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  background: #fff;
  border: 2rpx solid #e0e0e0;
  border-radius: 8rpx;
}

.source-detail {
  background: #fff;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
}

.detail-header {
  display: flex;
  align-items: center;
  padding: 14rpx 16rpx;
  background: #f5f7fa;
  border-bottom: 1rpx solid #eee;
  flex-shrink: 0;
}

.detail-header.sub {
  background: #fff;
  border-bottom: 1rpx solid #f0f0f0;
  padding: 12rpx 16rpx;
}

.back-icon {
  font-size: 24rpx;
  color: #4db6ac;
  margin-right: 10rpx;
  padding: 4rpx;
}

.detail-title {
  font-size: 26rpx;
  font-weight: 500;
  color: #2c3e50;
  flex: 1;
}

.chapter-list-simple {
  padding: 12rpx 12rpx 140rpx 12rpx;
  flex: 1;
  height: 0;
}

.chapter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14rpx 12rpx;
  background: #f5f7fa;
  border-radius: 10rpx;
  margin-bottom: 8rpx;
  border: 1rpx solid #e9ecef;
  transition: all 0.2s;
}

.chapter-row:active {
  background: rgba(77, 182, 172, 0.1);
  border-color: #4db6ac;
}

.chapter-row span:first-child {
  font-size: 24rpx;
  color: #333;
  flex: 1;
}

.q-count {
  font-size: 20rpx;
  color: #4db6ac;
  background: rgba(77, 182, 172, 0.1);
  padding: 4rpx 10rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.question-list-simple {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.q-scroll-area {
  flex: 1;
  height: 0;
}

/* 四级考点筛选栏 */
.level4-filter-bar {
  background: #f8f9fa;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #e8e8e8;
}

.level4-filter-scroll {
  white-space: nowrap;
}

.level4-filter-list {
  display: flex;
  padding: 0 20rpx;
  gap: 12rpx;
}

.level4-filter-item {
  padding: 12rpx 24rpx;
  background: #fff;
  border-radius: 30rpx;
  border: 1rpx solid #e0e0e0;
  font-size: 24rpx;
  color: #666;
  transition: all 0.2s;
}

.level4-filter-item.active {
  background: linear-gradient(135deg, #4db6ac, #26a69a);
  color: #fff;
  border-color: #26a69a;
}

.level4-filter-item text {
  display: block;
  max-width: 200rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-footer-fixed {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 20rpx 30rpx calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.05);
  z-index: 1001;
}

.modal-footer-fixed .confirm-btn {
  width: 100%;
  height: 80rpx;
  background: linear-gradient(135deg, #4db6ac, #26a69a);
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.source-item-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.source-item-info {
  flex: 1;
}

.source-item-meta {
  font-size: 20rpx;
  color: #999;
  margin-top: 2rpx;
}

.source-item-arrow {
  color: #ccc;
  font-size: 22rpx;
}
</style>
