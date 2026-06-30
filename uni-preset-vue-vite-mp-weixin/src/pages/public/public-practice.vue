<template>
  <view class="container" :class="{ 'night-mode': settings.nightMode }">
    <!-- 状态栏占位 -->
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    
    <!-- 顶部导航栏 -->
    <view class="nav-bar">
      <view class="nav-left">
        <view class="back-btn" @tap="goBack">
          <SvgIcon name="back" size="44" fill="#fff" />
        </view>
        <view class="nav-icon-btn" @tap="showSettings = true">
          <SvgIcon name="settings" size="44" fill="#fff" />
        </view>
      </view>
      <text class="nav-title">{{ bookTitle || '练习' }}</text>
      <view class="nav-right-placeholder"></view>
    </view>

    <!-- 进度条与统计 -->
    <view class="progress-section">
      <view class="progress-info">
        <view class="progress-info-left">
          <!-- 左侧显示当前题型标签 -->
          <view class="question-type-tag">
            <text>{{ currentQuestionTypeName }}</text>
          </view>
        </view>

        <view class="progress-percentage" v-if="totalCount > 0">
          <text>{{ displayProgress }}%</text>
        </view>

        <view class="count-box">
          <text class="current">{{ currentIndex + 1 }}</text>
          <text class="total">/{{ totalCount }}</text>
          <view 
            class="recitation-toggle" 
            :class="{ active: settings.recitationMode }"
            @tap="toggleRecitation"
          >
            <text>{{ settings.recitationMode ? '背题模式' : '做题模式' }}</text>
          </view>
        </view>
      </view>
      <view class="progress-bar-bg">
        <view class="progress-active" :style="{ width: progress + '%' }"></view>
      </view>
    </view>

    <!-- 练习内容区域 (Swiper 实现左右滑动) -->
    <swiper 
      class="content-area" 
      :current="currentIndex" 
      @change="onSwiperChange"
      :duration="250"
      easing-function="linear"
      :indicator-dots="false"
      :autoplay="false"
      :circular="false"
      :acceleration="false"
      :disable-programmatic-animation="false"
    >
      <swiper-item v-for="(question, qIndex) in questions" :key="qIndex">
        <scroll-view 
          class="swiper-scroll" 
          scroll-y 
          :enable-back-to-top="true" 
          style="touch-action: pan-y;"
          :show-scrollbar="false"
          :enhanced="true"
          :bounces="false"
        >
          <view class="practice-container">
            <!-- 题目模式 -->
            <view v-if="!isCardMode" class="question-mode">
              <!-- 题目卡片 -->
              <view class="question-card">
                <view class="question-header">
                  <view class="question-title" :style="{ fontSize: dynamicFontSize.title, fontWeight: 'normal' }">
                    <rich-text :nodes="formatTitle(question.title_richtext || question.title, true)"></rich-text>
                  </view>
                </view>
                
                <view v-if="isChoiceQuestion(question)" class="options-list">
                  <view 
                    v-for="(option, index) in question.options" 
                    :key="index"
                    class="option-item"
                    :class="getOptionClass(qIndex, index)"
                    @tap="handleSelect(qIndex, index)"
                  >
                    <view class="option-label">{{ String.fromCharCode(65 + index) }}</view>
                    <view class="option-content" :style="{ fontSize: dynamicFontSize.option }">
                      <rich-text :nodes="formatContent(option, 'option', true)"></rich-text>
                    </view>
                    <view v-if="shouldShowAnswer(qIndex)" class="result-icon">
                      <SvgIcon v-if="question.answer.includes(String.fromCharCode(65 + index))" name="correct" size="32" fill="#4caf50" />
                      <SvgIcon v-else-if="questionStates[qIndex]?.userAnswer.includes(String.fromCharCode(65 + index))" name="error" size="32" fill="#f44336" />
                    </view>
                  </view>
                </view>

                <!-- 非选择题的小题显示 (分析题不需要单独拆分显示) -->
                <view v-else-if="![6, 7].includes(question.type) && getSubQuestions(question.title).length > 0" class="sub-questions-list">
                  <view 
                    v-for="(sub, sIdx) in getSubQuestions(question.title)" 
                    :key="sIdx"
                    class="sub-question-item"
                  >
                    <rich-text :nodes="formatTitle(sub, true)"></rich-text>
                  </view>
                </view>

                <!-- 题目报错按钮 (移动至选项下方右侧) -->
                <view class="question-report-wrap">
                  <view class="report-btn" @tap="openCorrection(question)">
                    <view class="report-icon-box">
                      <svg width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="none" stroke="#999" stroke-width="4" stroke-linejoin="round"/>
                        <path d="M24 19C24 17.3431 25.3431 16 27 16C28.6569 16 30 17.3431 30 19C30 20.6569 28.6569 22 27 22C25.3431 22 24 23.3431 24 25V27" stroke="#999" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M24 33V35" stroke="#999" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </view>
                    <text>题目报错</text>
                  </view>
                </view>
              </view>
              
              <!-- 答案解析 -->
              <view v-if="shouldShowAnswer(qIndex)" class="answer-section animated fadeInUp">
                <!-- 相关学习资料 -->
                <view class="related-articles-section" v-if="articleGroups.length > 0">
                  <swiper 
                    class="article-carousel" 
                    :vertical="true"
                    :autoplay="true"
                    :circular="true"
                    interval="3000"
                    :indicator-dots="false"
                    :disable-touch="false"
                  >
                    <swiper-item v-for="article in articleGroups" :key="article.id">
                      <view class="article-carousel-item" @tap="goToArticle(article.id)">
                        <view class="carousel-content">
                          <text class="article-tag" :class="{ 'hot': relatedArticles.popular.some(p => p.id === article.id) }">
                            {{ article.category || (relatedArticles.popular.some(p => p.id === article.id) ? '热门' : '最新') }}
                          </text>
                          <text class="article-title">{{ article.title }}</text>
                        </view>
                      </view>
                    </swiper-item>
                  </swiper>
                </view>

                <!-- 答题详情与记忆口诀 (组合卡片) - 仅选择题显示 -->
                <view v-if="isChoiceQuestion(question)" class="answer-combined-card card-style compact-card">
                <view class="answer-grid">
                  <view v-if="!settings.recitationMode" class="grid-item no-border">
                    <text class="label">我的</text>
                    <text class="value" :class="questionStates[qIndex]?.userAnswer ? (questionStates[qIndex]?.isCorrect ? 'correct' : 'error') : ''">
                      {{ questionStates[qIndex]?.userAnswer || '无' }}
                    </text>
                  </view>
                  <view class="grid-item no-border">
                    <text class="label">答案</text>
                    <text class="value correct">{{ question.answer }}</text>
                  </view>
                  <view v-if="!settings.recitationMode" class="grid-item no-border">
                    <text class="label">结果</text>
                    <text class="value" :class="questionStates[qIndex]?.isCorrect ? 'correct' : 'error'">
                      {{ questionStates[qIndex]?.isCorrect ? '对' : '错' }}
                    </text>
                  </view>
                  <view class="grid-item no-border">
                    <text class="label">正确率</text>
                    <text class="value score">{{ sessionAccuracy }}</text>
                  </view>
                </view>
                  
                  <view v-if="question.mnemonic" class="mnemonic-section">
                    <view class="mnemonic-header">
                      <view class="mnemonic-tag">
                        <SvgIcon name="brain" size="24" fill="#f57f17" />
                        <text>记忆口诀</text>
                      </view>
                      <view 
                        v-if="question.mnemonic && question.mnemonic.length > 30" 
                        class="mnemonic-toggle"
                        @tap="questionStates[qIndex].isMnemonicExpanded = !questionStates[qIndex].isMnemonicExpanded"
                      >
                        <text>{{ questionStates[qIndex]?.isMnemonicExpanded ? '收起' : '展开' }}</text>
                        <view class="toggle-icon" :class="{ rotated: questionStates[qIndex]?.isMnemonicExpanded }">
                          <svg width="10" height="10" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M37 18L24 31L11 18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </view>
                      </view>
                    </view>
                    <view 
                      class="mnemonic-content"
                    >
                      <rich-text :nodes="formatContent(question.mnemonic, 'explanation', true)"></rich-text>
                    </view>
                  </view>
                </view>
                
                <!-- 答案卡片 (非选择题独立显示) -->
                <view class="answer-card card-style" v-if="shouldShowAnswer(qIndex) && !isChoiceQuestion(question)">
                  <view class="section-header no-margin">
                    <view class="section-title">
                      <view class="title-line"></view>
                      <text>正确答案</text>
                    </view>
                  </view>
                  <view class="subjective-answer-section" :style="{ fontSize: dynamicFontSize.explanation }">
                    <rich-text :nodes="formatExplanation(question.answer_richtext || question.answer, true)"></rich-text>
                  </view>
                </view>
                
                <!-- 解析卡片 -->
                <view class="explanation-card card-style" v-if="shouldShowAnswer(qIndex) && ((question.explanation && question.explanation !== '暂无解析') || question.explanation_richtext)">
                  <!-- 解析内容区域 -->
                  <view class="explanation-main" :style="{ fontSize: dynamicFontSize.explanation }" :class="{ 'explanation-collapsed': !questionStates[qIndex]?.isExplanationExpanded && question.explanation && question.explanation.length > 100 }">
                    <view class="section-header" :class="{ 'no-margin': isChoiceQuestion(question) }">
                      <view class="section-title">
                        <view class="title-line"></view>
                        <text>{{ isChoiceQuestion(question) ? '题目解析' : '参考解析' }}</text>
                      </view>
                    </view>
                    <rich-text :nodes="formatExplanation(question.explanation_richtext || question.explanation, true)"></rich-text>
                  </view>
                  
                  <view 
                    v-if="isChoiceQuestion(question) && question.explanation && question.explanation.length > 100" 
                    class="expand-toggle-btn" 
                    @tap="questionStates[qIndex].isExplanationExpanded = !questionStates[qIndex].isExplanationExpanded"
                  >
                    <text>{{ questionStates[qIndex]?.isExplanationExpanded ? '收起解析' : '展开更多解析' }}</text>
                    <view class="toggle-icon" :class="{ rotated: questionStates[qIndex]?.isExplanationExpanded }">
                      <svg width="12" height="12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M37 18L24 31L11 18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </view>
                  </view>
                </view>

                <!-- 笔记部分 (独立卡片) -->
                <view class="notes-section card-style">
                  
                  <view class="notes-header">
                    <view class="section-title">
                      <view class="title-line"></view>
                      <text>笔记</text>
                    </view>
                    <view class="add-note-btn" @tap="openAddNote">
                      <SvgIcon name="edit" size="24" fill="#fff" />
                      <text>添加笔记</text>
                    </view>
                  </view>
                  
                  <view class="notes-sub-header">
                    <view class="notes-tabs">
                      <view 
                        class="tab-item" 
                        :class="{ active: noteTab === 'public' }"
                        @tap="noteTab = 'public'"
                      >公开笔记</view>
                      <view 
                        class="tab-item" 
                        :class="{ active: noteTab === 'private' }"
                        @tap="noteTab = 'private'"
                      >个人笔记</view>
                    </view>
                    <view class="note-sort-v2" @tap="showSortOptions">
                      <text>默认排序</text>
                      <view class="sort-icon">
                        <svg width="12" height="12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M19 6V42" stroke="#999" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M7 17.8994L19 5.89941" stroke="#999" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M29 42.1006V6.10059" stroke="#999" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M29 42.1006L41 30.1006" stroke="#999" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </view>
                    </view>
                  </view>
                  
                  <view class="notes-list">
                    <view 
                      v-for="(note, nIdx) in (questionStates[qIndex]?.isNotesExpanded ? filteredNotes : filteredNotes.slice(0, 3))" 
                      :key="note.id" 
                      class="note-item"
                    >
                      <!-- 左侧头像 -->
                      <view class="note-left">
                        <image class="user-avatar" :src="note.avatar || '/static/logo.png'"></image>
                      </view>
                      
                      <!-- 右侧内容区 -->
                      <view class="note-right">
                        <view class="note-user-row">
                          <text class="username">{{ note.username }}</text>
                          <view class="more-btn" @tap="showNoteActions(note)">
                            <SvgIcon name="more" size="32" fill="#999" />
                          </view>
                        </view>
                        
                        <view class="note-content">
                          <rich-text :nodes="formatContent(note.content)"></rich-text>
                        </view>
                        
                        <!-- 笔记回复列表 -->
                        <view class="note-replies" v-if="note.replies && note.replies.length > 0">
                          <view v-for="reply in note.replies" :key="reply.id" class="reply-item">
                            <text class="reply-user">{{ reply.username }}:</text>
                            <rich-text class="reply-content" :nodes="formatContent(reply.content)"></rich-text>
                          </view>
                        </view>

                        <!-- 回复输入框 -->
                        <view class="reply-input-box" v-if="replyTo && replyTo.id === note.id">
                          <textarea 
                            v-model="replyContent" 
                            placeholder="请输入回复内容..." 
                            class="reply-textarea"
                            fixed
                            auto-height
                          ></textarea>
                          <view class="reply-btns">
                            <text class="cancel" @tap="replyTo = null">取消</text>
                            <text class="submit" @tap="submitReply">发送</text>
                          </view>
                        </view>

                        <view class="note-footer">
                          <view class="note-info-left">
                            <text class="note-date">{{ formatDate(note.createdAt) }}</text>
                            <text class="reply-link" @tap="openReply(note)">回复</text>
                          </view>
                          <view class="note-info-right">
                            <view class="footer-action" @tap="toggleNoteLike(note)">
                              <SvgIcon :name="note.isLiked ? 'like-fill' : 'like'" size="28" :fill="note.isLiked ? '#4db6ac' : '#999'" />
                              <text :class="{ 'active-like': note.isLiked }">{{ note.likeCount || 0 }}</text>
                            </view>
                          </view>
                        </view>
                      </view>
                    </view>
                    
                    <!-- 展开更多笔记按钮 -->
                    <view 
                      v-if="filteredNotes.length > 3" 
                      class="expand-notes-btn" 
                      @tap="questionStates[qIndex].isNotesExpanded = !questionStates[qIndex].isNotesExpanded"
                    >
                      <text>{{ questionStates[qIndex]?.isNotesExpanded ? '收起部分笔记' : '展开全部 ' + filteredNotes.length + ' 条笔记' }}</text>
                      <view class="toggle-icon" :class="{ rotated: questionStates[qIndex]?.isNotesExpanded }">
                        <svg width="12" height="12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M37 18L24 31L11 18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </view>
                    </view>

                    <view v-if="filteredNotes.length === 0" class="empty-notes">
                      暂无笔记，快来抢沙发吧~
                    </view>
                  </view>
                </view>
              </view>

              <!-- 确认按钮 (仅在未显示答案且非背题模式时显示) -->
              <view v-if="!shouldShowAnswer(qIndex) && !settings.recitationMode" class="confirm-btn-wrap">
                <button class="main-action-btn" @tap="confirmAnswer(qIndex)">
                  {{ isChoiceQuestion(question) ? '确定答案' : '查看答案' }}
                </button>
              </view>
            </view>

            <!-- 知识卡模式 -->
            <view v-else class="card-mode" :class="{ 'memory-card-mode': question.type === 7 }">
              <view class="card-box animated flipInY" :class="{ 'is-flipped': questionStates[qIndex]?.showCardAnswer }" @tap="questionStates[qIndex].showCardAnswer = true">
                <!-- 记忆卡题干 (始终显示) -->
                <view class="card-header-v2">
                  <view class="section-header no-margin">
                    <view class="section-title">
                      <view class="title-line"></view>
                      <text>题目</text>
                    </view>
                  </view>
                  <view class="subjective-content" :style="{ fontSize: dynamicFontSize.title, padding: '0 20rpx' }">
                    <rich-text :nodes="formatTitle(question.title_richtext || question.title, true)"></rich-text>
                  </view>
                </view>
              </view>

              <!-- 点击显示答案按钮 (卡片下方) -->
              <view 
                v-if="!questionStates[qIndex]?.showCardAnswer && !settings.recitationMode" 
                class="show-answer-btn"
                @tap="questionStates[qIndex].showCardAnswer = true"
              >
                <view class="btn-content">
                  <text>点击显示答案</text>
                  <svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 34L12 22H36L24 34Z" fill="currentColor"/>
                  </svg>
                </view>
              </view>

              <!-- 答案解析卡片 (点击显示后出现) -->
              <view v-if="(questionStates[qIndex]?.showCardAnswer || settings.recitationMode) && ((question.answer && question.answer !== '无') || (question.explanation && question.explanation !== '暂无解析'))" class="explanation-card card-style animated fadeInUp">
                <view class="explanation-main" :style="{ fontSize: dynamicFontSize.explanation }">
                  <!-- 答案 -->
                  <block v-if="question.answer">
                    <view class="section-header no-margin">
                      <view class="section-title">
                        <view class="title-line"></view>
                        <text>正确答案</text>
                      </view>
                    </view>
                    <rich-text :nodes="formatContent(question.answer_richtext || question.answer, 'explanation', true)"></rich-text>
                  </block>

                  <!-- 解析 -->
                  <block v-if="(question.explanation && question.explanation !== '暂无解析') || question.explanation_richtext">
                    <view v-if="question.answer" class="section-divider"></view>
                    <view class="section-header no-margin">
                      <view class="section-title">
                        <view class="title-line"></view>
                        <text>知识详情</text>
                      </view>
                    </view>
                    <rich-text :nodes="formatExplanation(question.explanation_richtext || question.explanation, true)"></rich-text>
                  </block>

                  <view v-if="question.mnemonic" class="mnemonic-section" style="margin-top: 20rpx;">
                    <view v-if="question.answer || (question.explanation && question.explanation !== '暂无解析')" class="section-divider"></view>
                    <view class="mnemonic-header">
                      <view class="mnemonic-tag">
                        <SvgIcon name="brain" size="24" fill="#f57f17" />
                        <text>记忆口诀</text>
                      </view>
                    </view>
                    <rich-text :nodes="formatContent(question.mnemonic, 'explanation', true)"></rich-text>
                  </view>
                </view>
                
                <!-- 隐藏答案按钮 -->
                <view 
                  class="hide-answer-btn-v2" 
                  @tap.stop="questionStates[qIndex].showCardAnswer = false"
                >
                  <text>点击隐藏答案</text>
                  <view class="hide-icon">
                    <svg width="12" height="12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13 30L24 19L35 30" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </view>
                </view>
              </view>

              <!-- 笔记部分 (独立卡片) - 知识卡模式不显示广告 -->
              <view v-if="questionStates[qIndex]?.showCardAnswer || settings.recitationMode" class="notes-section card-style">
                  <view class="notes-header">
                    <view class="section-title">
                      <view class="title-line"></view>
                      <text>笔记</text>
                    </view>
                    <view class="add-note-btn" @tap="openAddNote">
                      <SvgIcon name="edit" size="24" fill="#fff" />
                      <text>添加笔记</text>
                    </view>
                  </view>
                  
                  <view class="notes-sub-header">
                    <view class="notes-tabs">
                      <view 
                        class="tab-item" 
                        :class="{ active: noteTab === 'public' }"
                        @tap="noteTab = 'public'"
                      >公开笔记</view>
                      <view 
                        class="tab-item" 
                        :class="{ active: noteTab === 'private' }"
                        @tap="noteTab = 'private'"
                      >个人笔记</view>
                    </view>
                    <view class="note-sort-v2" @tap="showSortOptions">
                      <text>默认排序</text>
                      <view class="sort-icon">
                        <svg width="12" height="12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M19 6V42" stroke="#999" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M7 17.8994L19 5.89941" stroke="#999" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M29 42.1006V6.10059" stroke="#999" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M29 42.1006L41 30.1006" stroke="#999" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </view>
                    </view>
                  </view>
                  
                  <view class="notes-list">
                    <view 
                      v-for="(note, nIdx) in (questionStates[qIndex]?.isNotesExpanded ? filteredNotes : filteredNotes.slice(0, 3))" 
                      :key="note.id" 
                      class="note-item"
                    >
                      <!-- 左侧头像 -->
                      <view class="note-left">
                        <image class="user-avatar" :src="note.avatar || '/static/logo.png'"></image>
                      </view>
                      
                      <!-- 右侧内容区 -->
                      <view class="note-right">
                        <view class="note-user-row">
                          <text class="username">{{ note.username }}</text>
                          <view class="more-btn" @tap="showNoteActions(note)">
                            <SvgIcon name="more" size="32" fill="#999" />
                          </view>
                        </view>
                        
                        <view class="note-content">
                          <rich-text :nodes="formatContent(note.content)"></rich-text>
                        </view>
                        
                        <!-- 笔记回复列表 -->
                        <view class="note-replies" v-if="note.replies && note.replies.length > 0">
                          <view v-for="reply in note.replies" :key="reply.id" class="reply-item">
                            <text class="reply-user">{{ reply.username }}:</text>
                            <rich-text class="reply-content" :nodes="formatContent(reply.content)"></rich-text>
                          </view>
                        </view>

                        <!-- 回复输入框 -->
                        <view class="reply-input-box" v-if="replyTo && replyTo.id === note.id">
                          <textarea 
                            v-model="replyContent" 
                            placeholder="请输入回复内容..." 
                            class="reply-textarea"
                            fixed
                            auto-height
                          ></textarea>
                          <view class="reply-btns">
                            <text class="cancel" @tap="replyTo = null">取消</text>
                            <text class="submit" @tap="submitReply">发送</text>
                          </view>
                        </view>

                        <view class="note-footer">
                          <view class="note-info-left">
                            <text class="note-date">{{ formatDate(note.createdAt) }}</text>
                            <text class="reply-link" @tap="openReply(note)">回复</text>
                          </view>
                          <view class="note-info-right">
                            <view class="footer-action" @tap="toggleNoteLike(note)">
                              <SvgIcon :name="note.isLiked ? 'like-fill' : 'like'" size="28" :fill="note.isLiked ? '#4db6ac' : '#999'" />
                              <text :class="{ 'active-like': note.isLiked }">{{ note.likeCount || 0 }}</text>
                            </view>
                          </view>
                        </view>
                      </view>
                    </view>
                    
                    <!-- 展开更多笔记按钮 -->
                    <view 
                      v-if="filteredNotes.length > 3" 
                      class="expand-notes-btn" 
                      @tap="questionStates[qIndex].isNotesExpanded = !questionStates[qIndex].isNotesExpanded"
                    >
                      <text>{{ questionStates[qIndex]?.isNotesExpanded ? '收起部分笔记' : '展开全部 ' + filteredNotes.length + ' 条笔记' }}</text>
                      <view class="toggle-icon" :class="{ rotated: questionStates[qIndex]?.isNotesExpanded }">
                        <svg width="12" height="12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M37 18L24 31L11 18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </view>
                    </view>

                    <view v-if="filteredNotes.length === 0" class="empty-notes">
                      暂无笔记，快来抢沙发吧~
                    </view>
                  </view>
              </view>



             <!-- 隐藏答案占位 (仅在显示答案后显示) -->
             <view 
               v-if="question.type === 7 && !settings.recitationMode && questionStates[qIndex]?.showCardAnswer" 
               class="hide-answer-placeholder" 
               @tap="questionStates[qIndex].showCardAnswer = false"
             >
             </view>
            </view>
          </view>
          <!-- 底部占位 -->
          <view style="height: 140rpx;"></view>
        </scroll-view>
      </swiper-item>
      
      <!-- 空数据状态 (仅在非加载中且无数据时显示) -->
      <swiper-item v-if="!loading && questions.length === 0">
        <view class="empty-box">
          <image class="empty-img" src="/static/images/empty.png" mode="aspectFit"></image>
          <text>该书籍暂无题目数据</text>
        </view>
      </swiper-item>
      
      <!-- 初始加载状态 -->
      <swiper-item v-if="isInitialLoading">
        <view class="loading-box">
          <view class="loading-icon"></view>
          <text>正在加载题目...</text>
        </view>
      </swiper-item>
    </swiper>

    <!-- 底部操作栏 -->
    <view class="bottom-action-card">
      <view class="action-item">
        <SvgIcon name="correct" size="40" fill="#4caf50" />
        <text class="num success">{{ correctCount }}</text>
      </view>
      <view class="action-item">
        <SvgIcon name="error" size="40" fill="#f44336" />
        <text class="num danger">{{ errorCount }}</text>
      </view>
      <view class="action-item" @tap="toggleFavorite">
        <SvgIcon name="star" size="44" :fill="isFavorite ? '#ffb74d' : '#666'" />
      </view>
      <view class="action-item" @tap="showAnswerSheet = true">
        <SvgIcon name="answer-sheet" size="44" fill="#666" />
      </view>
      <view class="action-item" @tap="toggleChapters">
        <SvgIcon name="menu" size="44" fill="#666" />
      </view>

      <view class="nav-btns">
        <view class="nav-btn" :class="{ disabled: currentIndex === 0 }" @tap="currentIndex > 0 && (currentIndex--)">上一题</view>
        <view class="nav-btn next" :class="{ disabled: currentIndex === totalCount - 1 }" @tap="currentIndex < totalCount - 1 && (currentIndex++)">下一题</view>
      </view>
    </view>

    <!-- 知识卡底部悬浮操作按钮 (真正固定位置) -->
    <view v-if="currentQuestion.type === 7 && !settings.recitationMode" class="memory-card-actions">
      <view class="memory-btn master" @tap="handleCardAction('mastered', currentIndex)">
        <text>已掌握</text>
      </view>
      <view class="memory-btn unknown" @tap="handleCardAction('forgotten', currentIndex)">
        <text>不记得</text>
      </view>
    </view>

    <!-- 答题卡弹窗 -->
    <view class="modal-mask" v-if="showAnswerSheet" @tap="showAnswerSheet = false">
      <view class="answer-sheet-modal animated fadeInUp" @tap.stop>
        <view class="modal-header">
          <text>答题卡</text>
          <text class="close" @tap="showAnswerSheet = false">✕</text>
        </view>
        <scroll-view scroll-y class="sheet-content">
          <view class="sheet-grid">
            <view 
              v-for="(q, index) in questions" 
              :key="index"
              class="sheet-item"
              :class="getSheetItemClass(index)"
              @tap="jumpToQuestion(index)"
            >
              {{ index + 1 }}
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
    
    <!-- 章节目录弹窗 -->
    <view class="modal-mask" v-if="showChapters" @tap="showChapters = false">
      <view class="chapters-modal animated fadeInUp" @tap.stop>
        <view class="modal-header">
          <text>目录</text>
          <text class="close" @tap="showChapters = false">✕</text>
        </view>
        <scroll-view 
          scroll-y 
          class="chapters-content" 
          :scroll-into-view="activeChapterScrollId"
          :scroll-with-animation="true"
        >
          <view v-if="loadingChapters" class="loading-chapters">
            <text>正在加载目录...</text>
          </view>
          <view v-else-if="chapters.length === 0" class="empty-chapters">
            <text>暂无目录数据</text>
          </view>
          <view v-else class="chapters-list">
            <view 
              v-for="chapter in visibleChapters" 
              :key="chapter.id" 
              :id="'chapter-' + chapter.id"
              class="chapter-item"
              :class="['level-' + chapter.level, { active: isChapterActive(chapter), 'deepest-active': isDeepestActiveChapter(chapter) }]"
              @tap="onChapterTap(chapter)"
            >
              <view class="chapter-left">
                <view 
                  v-if="chapter.hasChildren" 
                  class="expand-icon" 
                  :class="{ rotated: chapter.isExpanded }"
                  @tap.stop="toggleChapterExpand(chapter)"
                >
                  <svg width="12" height="12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M37 18L24 31L11 18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </view>
                <view v-else class="expand-placeholder"></view>
                <text class="chapter-name">{{ chapter.name }}</text>
              </view>
              <text class="chapter-count" v-if="chapter.question_count">{{ chapter.question_count }}题</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 设置弹窗 -->
    <view class="modal-mask" v-if="showSettings" @tap="showSettings = false">
      <view class="settings-modal animated fadeInUp" @tap.stop>
        <view class="modal-header">
          <text>系统设置</text>
          <text class="close" @tap="showSettings = false">✕</text>
        </view>
        <view class="settings-content">
          <view class="setting-item">
            <text>自动下一题</text>
            <switch :checked="settings.autoNext" @change="e => { settings.autoNext = e.detail.value; saveUserSettings(); }" color="#4db6ac" />
          </view>
          <view class="setting-item">
            <text>夜间模式</text>
            <switch :checked="settings.nightMode" @change="e => { settings.nightMode = e.detail.value; uni.setStorageSync('theme', e.detail.value ? 'dark' : 'light'); saveUserSettings(); }" color="#4db6ac" />
          </view>
          <view class="setting-item">
            <text>自动移出错题本</text>
            <switch :checked="settings.autoRemoveWrong" @change="e => { settings.autoRemoveWrong = e.detail.value; saveUserSettings(); }" color="#4db6ac" />
          </view>
          <view class="setting-item column">
            <text class="label">字体大小</text>
            <view class="font-size-levels">
              <view 
                v-for="level in ['small', 'standard', 'large', 'extra']" 
                :key="level"
                class="level-item"
                :class="{ active: settings.fontSizeLevel === level }"
                @tap="settings.fontSizeLevel = level; saveUserSettings();"
              >
                {{ {small: 'A较小', standard: 'A标准', large: 'A较大', extra: 'A超大'}[level] }}
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 添加笔记弹窗 -->
    <view class="modal-mask" v-if="showAddNoteModal" @tap="showAddNoteModal = false">
      <view class="note-modal animated fadeInUp" @tap.stop>
        <view class="modal-header">
          <text>添加笔记</text>
          <text class="close" @tap="showAddNoteModal = false">✕</text>
        </view>
        <view class="note-modal-content">
          <textarea 
            v-model="addNoteContent" 
            placeholder="记下这一题的要点，方便以后复习..." 
            class="note-textarea"
            auto-focus
          ></textarea>
          <view class="note-options">
            <view class="public-toggle" @tap="isPublicNote = !isPublicNote">
              <SvgIcon :name="isPublicNote ? 'sun' : 'lock'" size="32" fill="#4db6ac" />
              <text>{{ isPublicNote ? '公开 (所有人可见)' : '私密 (仅自己可见)' }}</text>
            </view>
          </view>
          <button class="submit-note-btn" @tap="submitNote">发布笔记</button>
        </view>
      </view>
    </view>

    <!-- 纠错弹窗 -->
    <view class="modal-mask" v-if="showCorrection" @tap="showCorrection = false">
      <view class="correction-modal animated fadeInUp" @tap.stop>
        <view class="modal-header">
          <text>题目纠错</text>
          <text class="close" @tap="showCorrection = false">✕</text>
        </view>
        <view class="correction-content">
          <textarea v-model="correctionReason" placeholder="请描述题目错误原因..." class="correction-input"></textarea>
          <button class="submit-btn" @tap="submitCorrection">提交纠错</button>
        </view>
      </view>
    </view>

    <!-- 会员开通弹窗 -->
    <MembershipModal
      :visible="showMemberModal"
      :subjectKey="memberSubjectKey"
      :priceInfo="memberPriceInfo"
      @close="closeMemberModal"
      @success="onMemberSubscribeSuccess"
      @login-required="onMemberLoginRequired"
    />
  </view>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import publicApi from '@/api/public';
import userApi from '@/api/user';
import { BASE_URL } from '@/api/request';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';
import { checkTextContent } from '@/utils/contentSecurity.js';
import MembershipModal from '@/components/MembershipModal/MembershipModal.vue';
import { checkAccess, recordQuestionView, getFreeLimit } from '@/composables/useMembershipCheck.js';

const FREE_LIMIT = getFreeLimit();
const isMember = ref(false);
const showMemberModal = ref(false);
const memberSubjectKey = ref('public');
const memberPriceInfo = ref(null);

const statusBarHeight = ref(0);
const bookId = ref(null);
const mode = ref('order');
const chapterId = ref(null);
const questionType = ref(null);
const bookTitle = ref('');
const questions = ref([]);
const currentIndex = ref(0);
const loading = ref(true);
const page = ref(1);
const pageSize = ref(50); // 增加每页数量，减少加载频率
const totalQuestions = ref(0);
const hasMore = ref(true);
const isInitialLoading = ref(true);

// 笔记排序
const noteSortBy = ref('time'); // 'time' | 'likes'
const noteTab = ref('public'); // 'public' | 'private'

// 相关资料与笔记数据
const relatedArticles = ref({ popular: [], newest: [] });
const notes = ref([]);
const currentUserId = ref(uni.getStorageSync('userId'));
const showAddNoteModal = ref(false);
const addNoteContent = ref('');
const isPublicNote = ref(true);
const replyTo = ref(null);
const replyContent = ref('');
const editingNote = ref(null);

const openAddNote = () => {
  editingNote.value = null;
  addNoteContent.value = '';
  isPublicNote.value = true;
  showAddNoteModal.value = true;
};

const openReply = (note) => {
  replyTo.value = { id: note.id, username: note.username };
  replyContent.value = '';
};

const submitReply = async () => {
  if (!replyContent.value.trim()) {
    uni.showToast({ title: '请输入回复内容', icon: 'none' });
    return;
  }
  
  // 内容安全检测
  uni.showLoading({ title: '内容检测中...' });
  const checkResult = await checkTextContent(replyContent.value);
  uni.hideLoading();
  
  if (!checkResult.isSafe) {
    uni.showToast({
      title: checkResult.message,
      icon: 'none',
      duration: 3000
    });
    return;
  }
  
  const question = questions.value[currentIndex.value];
  if (!question) return;

  try {
    const res = await publicApi.addQuestionNote({
      questionId: question.id,
      content: replyContent.value,
      isPublic: 1, // 回复默认公开
      parentId: replyTo.value.id
    });
    
    if (res.code === 0) {
      uni.showToast({ title: '回复成功', icon: 'success' });
      replyTo.value = null;
      replyContent.value = '';
      fetchNotes(question.id);
    }
  } catch (error) {
    console.error('submitReply error:', error);
    uni.showToast({ title: '回复失败', icon: 'none' });
  }
};

// 相关资料分组 (单条显示，用于垂直轮播)
const articleGroups = computed(() => {
  // 分别截取前5篇
  const popular = (relatedArticles.value?.popular || []).slice(0, 5);
  const newest = (relatedArticles.value?.newest || []).slice(0, 5);
  
  // 合并并去重 (防止同一篇文章既是热门又是最新)
  const all = [...popular, ...newest];
  const unique = [];
  const ids = new Set();
  
  for (const item of all) {
    if (!ids.has(item.id)) {
      ids.add(item.id);
      unique.push(item);
    }
  }
  
  return unique;
});

// 笔记排序切换
const changeNoteSort = (sort) => {
  noteSortBy.value = sort;
  const question = questions.value[currentIndex.value];
  if (question) {
    fetchNotes(question.id);
  }
};

// 触控板/滚轮切换锁
const isWheeling = ref(false);
const handleWheel = (e) => {
  // 排除垂直滚动（deltaY 较大时），只处理水平滚动（deltaX）
  if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
  
  // 阈值判断，防止误触
  if (Math.abs(e.deltaX) < 20) return;
  
  if (isWheeling.value) return;
  isWheeling.value = true;
  
  if (e.deltaX > 0) {
    // 向右划，下一题
    if (currentIndex.value < totalCount.value - 1) {
      currentIndex.value++;
    }
  } else {
    // 向左划，上一题
    if (currentIndex.value > 0) {
      currentIndex.value--;
    }
  }
  
  // 锁定一段时间，防止连续切题
  setTimeout(() => {
    isWheeling.value = false;
  }, 500);
};

// 键盘监听
const handleKeyDown = (e) => {
  // 排除在输入框（如纠错弹窗）时的按键
  if (showCorrection.value) return;

  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      if (currentIndex.value > 0) {
        currentIndex.value--;
      }
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      if (currentIndex.value < totalCount.value - 1) {
        currentIndex.value++;
      }
      break;
  }
};

onMounted(() => {
  // #ifdef H5
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('wheel', handleWheel, { passive: false });
  // #endif
});

onUnmounted(() => {
  // #ifdef H5
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('wheel', handleWheel);
  // #endif
});

// 题目状态追踪
const questionStates = ref([]);
const correctCount = computed(() => {
  return questionStates.value.filter(state => state.status === 'correct').length;
});

const errorCount = computed(() => {
  return questionStates.value.filter(state => state.status === 'error').length;
});

const sessionAccuracy = computed(() => {
  const total = correctCount.value + errorCount.value;
  if (total === 0) return '0%';
  return Math.round((correctCount.value / total) * 100) + '%';
});

// 弹窗状态
const showAnswerSheet = ref(false);
const showChapters = ref(false);
const chapters = ref([]);
const loadingChapters = ref(false);
const activeChapterScrollId = ref('');

// 计算当前题目所属章节名称
const currentChapterName = computed(() => {
  if (!chapters.value || chapters.value.length === 0) return '';
  
  // 寻找包含当前 index 的章节
  // 优先寻找 level 2 的章节，如果没有则寻找 level 1
  let level2Chapter = null;
  let level1Chapter = null;
  let deepestChapter = null;

  for (const item of chapters.value) {
    if (item.start_index !== undefined && item.end_index !== undefined) {
      if (currentIndex.value >= item.start_index && currentIndex.value <= item.end_index) {
        if (item.level === 2) {
          level2Chapter = item;
        } else if (item.level === 1) {
          level1Chapter = item;
        }
        
        if (!deepestChapter || item.level > deepestChapter.level) {
          deepestChapter = item;
        }
      }
    }
  }
  
  // 优先返回第二级章节，如果没有则按深度返回
  if (level2Chapter) return level2Chapter.name;
  if (level1Chapter) return level1Chapter.name;
  return deepestChapter ? deepestChapter.name : '';
});

// 监听目录弹窗打开，自动定位
watch(() => showChapters.value, (newVal) => {
  if (newVal && chapters.value.length > 0) {
    // 在扁平化列表中寻找当前题目所属的章节 ID
    let activeId = null;
    let maxLevel = -1;
    
    for (const item of chapters.value) {
      if (item.start_index !== undefined && item.end_index !== undefined) {
        if (currentIndex.value >= item.start_index && currentIndex.value <= item.end_index) {
          if (item.level > maxLevel) {
            maxLevel = item.level;
            activeId = item.id;
          }
        }
      }
    }
    
    if (activeId) {
      // 确保其所有父级都已展开，否则 scroll-into-view 不起作用
      const chapter = chapters.value.find(c => c.id === activeId);
      if (chapter && chapter.parentId) {
        let currParentId = chapter.parentId;
        while (currParentId) {
          const parent = chapters.value.find(c => c.id === currParentId);
          if (parent) {
            parent.isExpanded = true;
            currParentId = parent.parentId;
          } else {
            currParentId = null;
          }
        }
      }

      // 稍微延迟确保 DOM 已渲染且动画开始
      setTimeout(() => {
        activeChapterScrollId.value = 'chapter-' + activeId;
      }, 300);
    }
  } else {
    activeChapterScrollId.value = '';
  }
});

const showSettings = ref(false);
const showCorrection = ref(false);
const correctionReason = ref('');
const currentCorrectingQuestion = ref(null);

// 系统设置
const settings = ref({
  autoNext: true,
  nightMode: uni.getStorageSync('theme') === 'dark',
  fontSizeLevel: 'standard', // 'small', 'standard', 'large', 'extra'
  recitationMode: false,
  autoRemoveWrong: true
});

// 动态字体大小计算
const dynamicFontSize = computed(() => {
  const levels = {
    small: { title: '26rpx', option: '26rpx', explanation: '26rpx' },
    standard: { title: '30rpx', option: '30rpx', explanation: '30rpx' },
    large: { title: '34rpx', option: '34rpx', explanation: '34rpx' },
    extra: { title: '38rpx', option: '38rpx', explanation: '38rpx' }
  };
  return levels[settings.value.fontSizeLevel] || levels.standard;
});

const totalCount = computed(() => totalQuestions.value || questions.value.length);
const currentQuestion = computed(() => questions.value[currentIndex.value] || {});

const isChoiceQuestion = (question) => {
  if (!question) return false;
  // 1:单选, 2:多选, 3:判断
  return [1, 2, 3].includes(question.type) && 
         question.options && 
         question.options.length > 0 && 
         question.options[0] !== '';
};

// 获取题型名称
const getQuestionTypeName = (type) => {
  const types = {
    1: '单选题',
    2: '多选题',
    3: '判断题',
    4: '填空题',
    5: '简答题',
    6: '分析题',
    7: '知识卡',
    8: '论述题',
    10: '知识卡'
  };
  return types[type] || '练习题';
};

const currentQuestionTypeName = computed(() => {
  const question = questions.value[currentIndex.value];
  if (!question) return '';
  if (question.type === 7) return '知识卡';
  return getQuestionTypeName(question.type);
});

// 提取小题
const getSubQuestions = (title) => {
  if (!title) return [];
  // 匹配 (1) 或 （1）开头的部分，直到遇到下一个 (n) 或 （n）
  const regex = /[(（]\d+[)）][^(（]*/g;
  const matches = title.match(regex);
  if (!matches) return [];
  return matches.map(m => m.trim()).filter(m => m.length > 5); // 过滤掉太短的误匹配
};

const getMainTitle = (title) => {
  if (!title) return '';
  const subQuestions = getSubQuestions(title);
  if (subQuestions.length === 0) return title;
  
  // 找到第一个小题出现的位置，截取之前的部分
  const firstSub = subQuestions[0];
  const index = title.indexOf(firstSub);
  if (index === -1) return title;
  return title.substring(0, index).trim();
};
const displayProgress = computed(() => {
  if (totalCount.value <= 0) return 0;
  // 计算进度：当前题目的序号 / 总题数
  // 注意：currentIndex 是 0-indexed
  return Math.min(100, Math.round(((currentIndex.value + 1) / totalCount.value) * 100));
});
const progress = computed(() => totalCount.value > 0 ? ((currentIndex.value + 1) / totalCount.value) * 100 : 0);
const isCardMode = computed(() => [7, 10].includes(currentQuestion.value.type) || currentQuestion.value.isKnowledgeCard);
const isFavorite = computed(() => {
  const state = questionStates.value[currentIndex.value];
  return state?.isFavorite || false;
});

const filteredNotes = computed(() => {
  if (!notes.value) return [];
  let result = [...notes.value];

  // 1. 选项卡筛选
  if (noteTab.value === 'private') {
    // 个人笔记：仅显示当前用户的（包括私密和公开）
    result = result.filter(note => note.userId === currentUserId.value);
  } else {
    // 公开笔记：显示所有公开的笔记
    result = result.filter(note => note.isPublic === 1);
  }

  // 2. 排序逻辑
  if (noteSortBy.value === 'time') {
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (noteSortBy.value === 'likes') {
    return result.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  }
  return result;
});

// 是否显示答案逻辑
const shouldShowAnswer = (qIndex) => {
  if (settings.value.recitationMode) return true;
  return questionStates.value[qIndex]?.showAnswer || false;
};

// 监听背题模式或当前题目变化，加载相关资料和笔记
let lastFetchedQuestionId = null;
const onQuestionActive = async (index) => {
  const question = questions.value[index];
  if (!question || question.id === lastFetchedQuestionId) return;
  
  // 只有在显示答案或背题模式时才加载，节省流量
  if (shouldShowAnswer(index)) {
    lastFetchedQuestionId = question.id;
    fetchNotes(question.id);
  }
};

const fetchRelatedArticles = async () => {
  try {
    const res = await publicApi.getRelatedArticles();
    if (res.code === 0) {
      relatedArticles.value = res.data;
    }
  } catch (error) {
    console.error('fetchRelatedArticles error:', error);
  }
};

const fetchNotes = async (questionId) => {
  try {
    const res = await publicApi.getQuestionNotes({ questionId });
    if (res.code === 0) {
      const parentNotes = Array.isArray(res.data) ? res.data : [];
      // 为每个笔记获取回复
      const notesWithReplies = await Promise.all(parentNotes.map(async (note) => {
        try {
          const replyRes = await publicApi.getNoteReplies({ noteId: note.id });
          return {
            ...note,
            replies: replyRes.code === 0 ? replyRes.data : []
          };
        } catch (e) {
          console.error(`fetchReplies error for note ${note.id}:`, e);
          return { ...note, replies: [] };
        }
      }));
      notes.value = notesWithReplies;
    }
  } catch (error) {
    console.error('fetchNotes error:', error);
  }
};

const submitNote = async () => {
  if (!addNoteContent.value.trim()) {
    uni.showToast({ title: '请输入笔记内容', icon: 'none' });
    return;
  }
  
  // 内容安全检测
  uni.showLoading({ title: '内容检测中...' });
  const checkResult = await checkTextContent(addNoteContent.value);
  uni.hideLoading();
  
  if (!checkResult.isSafe) {
    uni.showToast({
      title: checkResult.message,
      icon: 'none',
      duration: 3000
    });
    return;
  }
  
  const question = questions.value[currentIndex.value];
  if (!question) return;

  try {
    let res;
    if (editingNote.value) {
      // 修改笔记
      res = await publicApi.updateQuestionNote({
        noteId: editingNote.value.id,
        content: addNoteContent.value,
        isPublic: isPublicNote.value ? 1 : 0
      });
    } else {
      // 新增笔记
      res = await publicApi.addQuestionNote({
        questionId: question.id,
        content: addNoteContent.value,
        isPublic: isPublicNote.value ? 1 : 0
      });
    }
    
    if (res.code === 0) {
      uni.showToast({ title: editingNote.value ? '修改成功' : '发布成功', icon: 'success' });
      showAddNoteModal.value = false;
      editingNote.value = null;
      fetchNotes(question.id);
    }
  } catch (error) {
    console.error('submitNote error:', error);
    uni.showToast({ title: editingNote.value ? '修改失败' : '发布失败', icon: 'none' });
  }
};

const toggleNoteLike = async (note) => {
  // 乐观更新
  const oldIsLiked = note.isLiked;
  const oldLikeCount = note.likeCount || 0;
  
  note.isLiked = !oldIsLiked;
  note.likeCount = oldLikeCount + (note.isLiked ? 1 : -1);

  try {
    const res = await publicApi.toggleNoteLike({ noteId: note.id });
    if (res.code === 0) {
      // 最终以服务器返回为准
      note.isLiked = res.data.isLiked;
      note.likeCount = res.data.likeCount;
    } else {
      // 失败回滚
      note.isLiked = oldIsLiked;
      note.likeCount = oldLikeCount;
    }
  } catch (error) {
    console.error('toggleNoteLike error:', error);
    // 失败回滚
    note.isLiked = oldIsLiked;
    note.likeCount = oldLikeCount;
  }
};

const toggleNoteStar = async (note) => {
  // 乐观更新
  const oldIsStarred = note.isStarred;
  const oldStarCount = note.starCount || 0;
  
  note.isStarred = !oldIsStarred;
  note.starCount = oldStarCount + (note.isStarred ? 1 : -1);

  try {
    // 模拟 API 调用
    // const res = await publicApi.toggleNoteStar({ noteId: note.id });
    // if (res.code === 0) {
    //   note.isStarred = res.data.isStarred;
    //   note.starCount = res.data.starCount;
    // }
  } catch (error) {
    console.error('toggleNoteStar error:', error);
    // 失败回滚
    note.isStarred = oldIsStarred;
    note.starCount = oldStarCount;
  }
};

const editNote = (note) => {
  editingNote.value = note;
  addNoteContent.value = note.content;
  isPublicNote.value = note.isPublic === 1;
  showAddNoteModal.value = true;
};

const deleteNote = async (noteId) => {
  uni.showModal({
    title: '提示',
    content: '确定要删除这条笔记吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const response = await publicApi.deleteQuestionNote({ noteId: noteId });
          if (response.code === 0) {
            uni.showToast({ title: '删除成功', icon: 'success' });
            const question = questions.value[currentIndex.value];
            if (question) fetchNotes(question.id);
          }
        } catch (error) {
          console.error('deleteNote error:', error);
          uni.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    }
  });
};

const showNoteActions = (note) => {
  const itemList = note.userId === currentUserId.value ? ['修改', '删除'] : ['举报'];
  uni.showActionSheet({
    itemList,
    success: (res) => {
      if (note.userId === currentUserId.value) {
        if (res.tapIndex === 0) editNote(note);
        else if (res.tapIndex === 1) deleteNote(note.id);
      } else {
        if (res.tapIndex === 0) uni.showToast({ title: '已举报', icon: 'none' });
      }
    }
  });
};

const goToArticle = async (articleId) => {
  uni.showLoading({ title: '加载中...' });
  try {
    const res = await publicApi.getNoticeById(articleId);
    if (res.code === 0 && res.data) {
      const article = res.data;
      
      // 如果是跳转链接或微信链接类型，直接跳转
      if ((article.noticeType === 'link' || article.noticeType === 'wechat') && article.linkUrl) {
        uni.hideLoading();
        uni.navigateTo({
          url: `/pages/webview/webview?url=${encodeURIComponent(article.linkUrl)}`
        });
        return;
      }
      
      // 否则跳转到文章详情页
      uni.navigateTo({
        url: `/pages/article/article-detail?id=${articleId}`
      });
    } else {
      uni.showToast({ title: '文章不存在', icon: 'none' });
    }
  } catch (error) {
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    uni.hideLoading();
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  
  // 重置时间部分进行日期比较
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today - thatDay) / (1000 * 60 * 60 * 24));
  
  const diffMs = now - date;
  if (diffMs < 60000) return '刚刚';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}分钟前`;
  if (diffMs < 86400000 && diffDays === 0) return `${Math.floor(diffMs / 3600000)}小时前`;
  
  if (diffDays === 1) return '昨天';
  if (diffDays === 2) return '前天';
  
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y === now.getFullYear() ? `${m}-${d}` : `${y}-${m}-${d}`;
};

const toggleRecitation = () => {
  settings.value.recitationMode = !settings.value.recitationMode;
  saveUserSettings();
  if (settings.value.recitationMode) {
    onQuestionActive(currentIndex.value);
  }
};

onLoad(async (options) => {
  // 未登录直接跳转登录
  const token = uni.getStorageSync('token');
  if (!token) {
    uni.reLaunch({ url: '/pages/login/login' });
    return;
  }

  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight;
  currentUserId.value = uni.getStorageSync('userId');
  
  if (options.bookId) {
    bookId.value = options.bookId;
    mode.value = options.mode || 'order';
    chapterId.value = options.chapterId || null;
    questionType.value = options.type || null;
    
    // bookTitle 始终显示书籍名称
    const rawTitle = options.title || '练习';
    try {
      // 尝试二次解码，处理某些平台双重编码的问题
      bookTitle.value = decodeURIComponent(decodeURIComponent(rawTitle));
    } catch (e) {
      bookTitle.value = decodeURIComponent(rawTitle);
    }
    
    // 如果传了 memoryMode，更新设置
    if (options.memoryMode === '1') {
      settings.value.recitationMode = true;
    }
    
    initData();
  } else if (options.subject && (options.category || options.categoryId)) {
    // 如果没有 bookId 但有 subject 和 category，尝试获取该分类下的第一个书籍
    try {
      loading.value = true;
      const res = await publicApi.getPublicBooks({
        subject: options.subject,
        categoryId: options.category || options.categoryId,
        level: 2 // 二级分类
      });
      
      if (res.code === 0 && res.data && res.data.length > 0) {
        const firstBook = res.data[0];
        bookId.value = firstBook.id;
        bookTitle.value = firstBook.title;
        initData();
      } else {
        uni.showToast({ title: '未找到相关题库', icon: 'none' });
        setTimeout(() => uni.navigateBack(), 1500);
      }
    } catch (error) {
      console.error('Fetch books error:', error);
      uni.showToast({ title: '加载失败', icon: 'none' });
      setTimeout(() => uni.navigateBack(), 1500);
    } finally {
      loading.value = false;
    }
  } else {
    uni.showToast({ title: '参数错误', icon: 'none' });
    setTimeout(() => uni.navigateBack(), 1500);
  }
});

const initData = () => {
  fetchQuestions();
  fetchUserSettings();
  fetchRelatedArticles();
  fetchChapters(); // 加载章节信息以显示当前章节名称
};

const fetchUserSettings = async () => {
  try {
    const res = await userApi.getUserSettings();
    if (res.code === 0 && res.data) {
      const data = res.data;
      settings.value = {
        autoNext: data.autoNext === 1 || data.autoNext === true,
        nightMode: data.nightMode === 1 || data.nightMode === true || uni.getStorageSync('theme') === 'dark',
        fontSizeLevel: data.fontSizeLevel || 'standard',
        recitationMode: data.recitationMode === 1 || data.recitationMode === true,
        autoRemoveWrong: data.autoRemoveWrong === 1 || data.autoRemoveWrong === true
      };
    }
  } catch (error) {
    console.error('fetchUserSettings error:', error);
  }
};

const saveUserSettings = async () => {
  try {
    await userApi.updateUserSettings({
      autoNext: settings.value.autoNext ? 1 : 0,
      nightMode: settings.value.nightMode ? 1 : 0,
      fontSizeLevel: settings.value.fontSizeLevel,
      recitationMode: settings.value.recitationMode ? 1 : 0,
      autoRemoveWrong: settings.value.autoRemoveWrong ? 1 : 0
    });
  } catch (error) {
    console.error('saveUserSettings error:', error);
  }
};

const fetchQuestions = async (isFirstLoad = true) => {
  if (isFirstLoad) {
    loading.value = true;
    isInitialLoading.value = true;
    page.value = 1;
    questions.value = [];
    questionStates.value = [];
  } else {
    if (!hasMore.value || loading.value) return;
    loading.value = true;
  }

  try {
    const res = await publicApi.getPublicQuestions({ 
      bookId: bookId.value,
      mode: mode.value,
      chapterId: chapterId.value,
      type: questionType.value,
      page: page.value,
      pageSize: pageSize.value
    });
    
    // 处理题目模式
    const processQuestion = (q) => {
      // 1. 处理选项：确保是数组
      let options = q.options;
      if (typeof options === 'string') {
        try {
          options = JSON.parse(options);
        } catch (e) {
          options = [];
        }
      }
      
      // 2. 移除题目和解析中的 HTML 标签以进行文本判断
      const cleanTitle = (q.title || '').replace(/<[^>]*>/g, '');
      const cleanExplanation = (q.explanation || '').replace(/<[^>]*>/g, '');
      
      // 3. 判断是否为“概述”或无数据
      // 如果没有选项，且题目内容包含“概述”、“说明”或长度很短，且解析也包含“暂无”等
      const isOverview = (!options || options.length === 0) && 
                        (cleanTitle.includes('概述') || cleanTitle.includes('说明') || cleanTitle.length < 10) &&
                        (cleanExplanation.includes('暂无') || cleanExplanation.length < 10);
      
      // 4. 如果是概述，强制标记为知识卡模式，而不是过滤掉
      const isKnowledgeCard = q.isKnowledgeCard || q.type === 10 || isOverview;
      
      return {
        ...q,
        options,
        isOverview,
        isKnowledgeCard,
        averageScore: q.averageScore ? parseFloat(q.averageScore).toFixed(1) : (Math.random() * 20 + 70).toFixed(1)
      };
    };

    if (res.code === 0 && res.data) {
      const { list = [], total = 0, lastIndex = 0 } = res.data;
      totalQuestions.value = total;
      
      // 处理并标记题目
      const processedList = list.map(processQuestion);
      
      // 过滤掉真正没有任何内容的题目（如果还有的话）
      const filteredList = processedList.filter(q => {
        const cleanTitle = (q.title || '').replace(/<[^>]*>/g, '').trim();
        return cleanTitle.length > 0;
      });

      const newQuestions = filteredList;

      const newStates = newQuestions.map((q) => ({
        userAnswer: '',
        showAnswer: false,
        showCardAnswer: false,
        isCorrect: false,
        isFavorite: q.isFavorite === 1 || q.isFavorite === true,
        status: 'unanswered',
        isExplanationExpanded: false,
        isMnemonicExpanded: false,
        isNotesExpanded: false
      }));

      questions.value = [...questions.value, ...newQuestions];
      questionStates.value = [...questionStates.value, ...newStates];

      hasMore.value = questions.value.length < totalQuestions.value;
      
      if (isFirstLoad) {
        if (mode.value === 'continue' && lastIndex > 0) {
          // 继续练习模式：跳转到上次记录的索引
          const targetIndex = lastIndex;
          if (targetIndex < totalQuestions.value) {
            // 如果目标题目尚未加载，继续加载直到加载到目标索引
            while (targetIndex >= questions.value.length && hasMore.value) {
              page.value++;
              const moreRes = await publicApi.getPublicQuestions({
                bookId: bookId.value,
                mode: mode.value,
                chapterId: chapterId.value,
                type: questionType.value,
                page: page.value,
                pageSize: pageSize.value
              });
              if (moreRes.code === 0 && moreRes.data.list) {
                        const moreList = moreRes.data.list.map(processQuestion).filter(q => {
                          const cleanTitle = (q.title || '').replace(/<[^>]*>/g, '').trim();
                          return cleanTitle.length > 0;
                        });
                        questions.value = [...questions.value, ...moreList];
                questionStates.value = [...questionStates.value, ...moreList.map(q => ({
                  userAnswer: '',
                  showAnswer: false,
                  showCardAnswer: false,
                  isCorrect: false,
                  isFavorite: q.isFavorite === 1 || q.isFavorite === true,
                  status: 'unanswered',
                  isExplanationExpanded: false,
                  isMnemonicExpanded: false,
                  isNotesExpanded: false
                }))];
                hasMore.value = questions.value.length < totalQuestions.value;
              } else {
                break;
              }
            }
            currentIndex.value = targetIndex;
            onQuestionActive(targetIndex);
          }
        } else if (lastIndex > 0 && lastIndex < total && mode.value !== 'chapter' && mode.value !== 'category') {
          // 其他普通模式：询问是否跳转到上次进度
          uni.showModal({
            title: '提示',
            content: `上次练习到第 ${lastIndex + 1} 题，是否继续？`,
            success: async (mRes) => {
              if (mRes.confirm) {
                const targetIndex = lastIndex;
                if (targetIndex >= questions.value.length && hasMore.value) {
                  uni.showLoading({ title: '加载进度...' });
                  try {
                    while (targetIndex >= questions.value.length && hasMore.value) {
                      page.value++;
                      const moreRes = await publicApi.getPublicQuestions({
                        bookId: bookId.value,
                        mode: mode.value,
                        chapterId: chapterId.value,
                        type: questionType.value,
                        page: page.value,
                        pageSize: pageSize.value
                      });
                      if (moreRes.code === 0 && moreRes.data.list) {
                        const moreList = moreRes.data.list.map(processQuestion).filter(q => {
                          const cleanTitle = (q.title || '').replace(/<[^>]*>/g, '').trim();
                          return cleanTitle.length > 0;
                        });
                        questions.value = [...questions.value, ...moreList];
                        questionStates.value = [...questionStates.value, ...moreList.map(q => ({
                          userAnswer: '',
                          showAnswer: false,
                          showCardAnswer: false,
                          isCorrect: false,
                          isFavorite: q.isFavorite === 1 || q.isFavorite === true,
                          status: 'unanswered',
                          isExplanationExpanded: false,
                          isMnemonicExpanded: false,
                          isNotesExpanded: false
                        }))];
                        hasMore.value = questions.value.length < totalQuestions.value;
                      } else {
                        break;
                      }
                    }
                  } finally {
                    uni.hideLoading();
                  }
                }
                currentIndex.value = targetIndex;
                onQuestionActive(currentIndex.value);
              } else {
                currentIndex.value = 0;
                onQuestionActive(0);
              }
            }
          });
        } else {
          currentIndex.value = 0;
          onQuestionActive(0);
        }
      }
      
      page.value++;
    }
  } catch (error) {
    console.error('fetchQuestions error:', error);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    if (isFirstLoad) {
      loading.value = false;
      isInitialLoading.value = false;
    } else {
      loading.value = false;
    }
  }
};

const loadMore = async () => {
  if (hasMore.value && !loading.value) {
    await fetchQuestions(false);
  }
};

const onSwiperChange = (e) => {
  const newIndex = e.detail.current;
  currentIndex.value = newIndex;

  // 会员检查：第20题及以后需要检查会员状态
  if (newIndex >= FREE_LIMIT && !isMember.value) {
    const result = checkAccess('public', newIndex);
    if (result.showPrompt && !result.canAccess) {
      memberPriceInfo.value = result.subjectInfo;
      showMemberModal.value = true;
    }
  }

  // 记录做题次数
  recordQuestionView('public');

  // 检查是否需要加载更多 - 提前 10 题就开始加载，确保无感
  if (newIndex >= questions.value.length - 10 && hasMore.value) {
    loadMore();
  }
  
  // 保存进度
  saveProgress(newIndex);

  // 触发相关资料和笔记加载
  onQuestionActive(newIndex);
};

const saveProgress = async (index) => {
  const token = uni.getStorageSync('token');
  if (token) {
    try {
      await publicApi.updatePracticeProgress({
        bookId: bookId.value,
        lastIndex: index
      });
    } catch (error) {
      console.error('saveProgress error:', error);
    }
  }
  
  // 保存到本地进度列表
  savePracticeProgressToList(index);
};

// 会员弹窗方法
const closeMemberModal = () => { showMemberModal.value = false; };

const onMemberSubscribeSuccess = () => {
  isMember.value = true;
  showMemberModal.value = false;
};

const onMemberLoginRequired = () => {
  showMemberModal.value = false;
  uni.showModal({
    title: '提示',
    content: '请先登录后再开通会员',
    confirmText: '去登录',
    success: (res) => {
      if (res.confirm) {
        uni.navigateTo({ url: '/pages/login/login' });
      }
    }
  });
};

// 保存进度到列表
const savePracticeProgressToList = (index) => {
  const question = questions.value[index];
  if (!question) return;
  
  let progressKey = `public_book_${bookId.value}`;
  if (mode.value === 'chapter' && chapterId.value) {
    progressKey = `public_chapter_${chapterId.value}`;
  } else if (mode.value === 'wrong') {
    progressKey = `public_wrong_${bookId.value}`;
  } else if (mode.value === 'favorite') {
    progressKey = `public_favorite_${bookId.value}`;
  } else if (mode.value === 'category' && questionType.value) {
    progressKey = `public_type_${bookId.value}_${questionType.value}`;
  }
  
  let url = `/pages/public/public-practice?bookId=${bookId.value}&mode=${mode.value}&title=${encodeURIComponent(bookTitle.value)}`;
  if (chapterId.value) url += `&chapterId=${chapterId.value}`;
  if (questionType.value) url += `&type=${questionType.value}`;
  url += `&startIndex=${index}`;
  
  const practiceItem = {
    type: 'public',
    subject: '公共课',
    id: bookId.value,
    title: bookTitle.value,
    bookTitle: bookTitle.value,
    bookId: bookId.value,
    url: url,
    icon: 'books',
    progressKey,
    currentIndex: index + 1,
    totalQuestions: totalCount.value,
    timestamp: Date.now()
  };
  
  let progressList = uni.getStorageSync('practiceProgressList') || [];
  if (!Array.isArray(progressList)) {
    progressList = [];
  }
  
  const existingIndex = progressList.findIndex(item => item.progressKey === progressKey);
  if (existingIndex !== -1) {
    progressList.splice(existingIndex, 1);
  }
  
  progressList.unshift(practiceItem);
  
  if (progressList.length > 10) {
    progressList = progressList.slice(0, 10);
  }
  
  uni.setStorageSync('practiceProgressList', progressList);
};

// 广告事件处理
const adLoad = () => {
  console.log('原生模板广告加载成功');
};

const adError = (err) => {
  console.error('原生模板广告加载失败', err);
};

const adClose = () => {
  console.log('原生模板广告关闭');
};

const formatContent = (text, type = 'explanation', isRich = false) => {
  if (!text) return '';
  
  // 1. 预处理：规范化换行符
  let processedHtml = text.replace(/\\n/g, '\n');
  
  // 2. 核心解码：多次解码以防止双重编码 (e.g. &lt;p&gt;)
  let prev;
  let count = 0;
  while (processedHtml !== prev && count < 3) {
    prev = processedHtml;
    processedHtml = processedHtml
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    count++;
  }

  // 处理常用 HTML 实体字符
  processedHtml = processedHtml.replace(/&nbsp;/g, '\u00A0');
  processedHtml = processedHtml.replace(/&mdash;/g, '\u2014');
  processedHtml = processedHtml.replace(/&lsquo;/g, '\u2018');
  processedHtml = processedHtml.replace(/&rsquo;/g, '\u2019');
  processedHtml = processedHtml.replace(/&ldquo;/g, '\u201C');
  processedHtml = processedHtml.replace(/&rdquo;/g, '\u201D');

  // 统一注入图片样式，确保宽度一致，添加 !important 覆盖默认样式
  processedHtml = processedHtml.replace(/<img/gi, '<img style="max-width:100% !important;height:auto !important;width:auto !important;display:block;margin:10px auto;"');

  // 检查是否为 HTML
  const isHtml = /<[a-z/][\s\S]*>/i.test(processedHtml);
  
  // 统一包裹层样式
  const wrapStart = `<div style="text-align: justify; margin: 0; padding: 0; line-height: 1.6; color: inherit; width: 100%; font-size: inherit;">`;
  const wrapEnd = `</div>`;

  if (isRich) {
    // rich-text 模式：如果是纯文本则处理换行，如果是 HTML 则直接返回（但也包裹一层以确保样式一致）
    const content = isHtml ? processedHtml : processedHtml.trim().replace(/\n+/g, '<br/>');
    return wrapStart + content + wrapEnd;
  }
  
  // 非 rich-text 模式：添加更多结构化处理
  if (isHtml) {
    // 1. 彻底移除所有原始内联样式
    processedHtml = processedHtml.replace(/style\s*=\s*["'][^"']*["']/gi, '');
    
    // 2. 移除冗余的空标签和空段落
    processedHtml = processedHtml.replace(/<(p|div)[^>]*>(?:\s|\u00A0|<br\/?>)*<\/\1>/gi, '');
    
    // 3. 仅保留最基础的结构化样式（边距归零），移除所有美化类注入（缩进、颜色等）
    const replacements = [
      { tag: 'p', style: 'margin: 0; padding: 0;' },
      { tag: 'div', style: 'margin: 0; padding: 0;' },
      { tag: 'strong', style: 'font-weight: bold;' },
      { tag: 'b', style: 'font-weight: bold;' },
      { tag: 'table', style: 'width: 100%; border-collapse: collapse; margin: 10rpx 0; border: 1px solid #eee;' },
      { tag: 'td', style: 'padding: 4rpx; border: 1px solid #eee;' },
      { tag: 'th', style: 'padding: 4rpx; border: 1px solid #eee; background: #fafafa;' }
    ];

    replacements.forEach(({ tag, style }) => {
      const tagRegex = new RegExp(`<${tag}(\\s+[^>]*)?>`, 'gi');
      processedHtml = processedHtml.replace(tagRegex, `<${tag} style="${style}">`);
    });

    // 4. 清除标签之间的换行符，避免产生多余空行
    processedHtml = processedHtml.replace(/>\s*\n\s*</g, '><');
    
    // 如果没有段落标签，将换行符转为 <br/>
    if (!/<p/i.test(processedHtml)) {
      processedHtml = processedHtml.replace(/\n+/g, '<br/>');
    }

    return wrapStart + processedHtml + wrapEnd;
  }
  
  // 纯文本处理
  return wrapStart + processedHtml.trim().replace(/\n+/g, '<br/>') + wrapEnd;
};

const formatExplanation = (text, isRich = false) => formatContent(text, 'explanation', isRich);
const formatTitle = (text, isRich = false) => formatContent(text, 'title', isRich);

const showSortOptions = () => {
  uni.showActionSheet({
    itemList: ['最新排序', '热门排序'],
    success: (res) => {
      if (res.tapIndex === 0) {
        changeNoteSort('time');
      } else {
        changeNoteSort('likes');
      }
    }
  });
};

const handleSelect = (qIndex, oIndex) => {
  const state = questionStates.value[qIndex];
  if (state.showAnswer) return;
  
  const question = questions.value[qIndex];
  const label = String.fromCharCode(65 + oIndex);
  
  if (question.type === 2) { // 多选
    let selected = state.userAnswer ? state.userAnswer.split('') : [];
    const idx = selected.indexOf(label);
    if (idx > -1) selected.splice(idx, 1);
    else selected.push(label);
    state.userAnswer = selected.sort().join('');
  } else {
    state.userAnswer = label;
  }
};

const getOptionClass = (qIndex, oIndex) => {
  const state = questionStates.value[qIndex];
  const question = questions.value[qIndex];
  if (!state || !question) return '';
  
  const label = String.fromCharCode(65 + oIndex);
  if (!state.showAnswer) {
    return state.userAnswer.includes(label) ? 'selected' : '';
  }
  
  const isCorrectOption = question.answer.includes(label);
  const isSelectedOption = state.userAnswer.includes(label);
  
  if (isCorrectOption) return 'correct';
  if (isSelectedOption && !isCorrectOption) return 'error';
  return '';
};

const confirmAnswer = async (qIndex) => {
  const state = questionStates.value[qIndex];
  const question = questions.value[qIndex];
  
  if (isChoiceQuestion(question) && !state.userAnswer) {
    uni.showToast({ title: '请先选择答案', icon: 'none' });
    return;
  }
  
  state.showAnswer = true;
  state.isCorrect = isChoiceQuestion(question) ? state.userAnswer === question.answer : true;
  
  // 触发相关资料和笔记加载
  onQuestionActive(qIndex);
  
  // 提交答题记录到后端更新平均分（仅登录用户）
  const token = uni.getStorageSync('token');
  if (token) {
    try {
      await publicApi.submitAnswer({
        questionId: question.id,
        isCorrect: state.isCorrect
      });
    } catch (error) {
      console.error('submitAnswer error:', error);
    }
  }
  
  if (state.isCorrect) {
    state.status = 'correct';
    // 自动下一题 - 仅限选择题
    if (isChoiceQuestion(question) && settings.value.autoNext && currentIndex.value < totalCount.value - 1) {
      setTimeout(() => {
        currentIndex.value++;
      }, 1000);
    }
  } else {
    state.status = 'error';
    // 错题逻辑已在后端 submitAnswer 中处理
  }
};

const handleCardAction = async (action, qIndex) => {
  const state = questionStates.value[qIndex];
  const question = questions.value[qIndex];
  
  if (action === 'mastered') {
    state.isCorrect = true;
    state.status = 'correct';
  } else if (action === 'vague') {
    state.isCorrect = false; // 模糊视为错题
    state.status = 'error';
  } else if (action === 'forgotten') {
    state.isCorrect = false;
    state.status = 'error';
  }
  
  state.showAnswer = true;
  state.showCardAnswer = true;
  
  // 提交答题记录（仅登录用户）
  const token = uni.getStorageSync('token');
  if (token) {
    try {
      await publicApi.submitAnswer({
        questionId: question.id,
        isCorrect: state.isCorrect
      });
    } catch (error) {
      console.error('handleCardAction submitAnswer error:', error);
    }
  }
  
  // 自动下一题
  if (settings.value.autoNext && currentIndex.value < totalCount.value - 1) {
    setTimeout(() => {
      currentIndex.value++;
    }, 800);
  }
};

const toggleChapters = () => {
  showChapters.value = !showChapters.value;
  if (showChapters.value && chapters.value.length === 0) {
    fetchChapters();
  }
};

const fetchChapters = async () => {
  loadingChapters.value = true;
  try {
    const res = await publicApi.getBookChapters({ bookId: bookId.value });
    if (res.code === 0 && res.data) {
      // 展平树形结构用于目录显示
      const flattened = [];
      const flatten = (list, level = 1, parentId = null) => {
        if (!Array.isArray(list)) return;
        list.forEach(item => {
          flattened.push({
            ...item,
            level,
            parentId,
            isExpanded: level === 1, // 默认只展开第一层
            hasChildren: !!(item.children && Array.isArray(item.children) && item.children.length > 0)
          });
          if (item.children && Array.isArray(item.children) && item.children.length > 0) {
            flatten(item.children, level + 1, item.id);
          }
        });
      };
      
      const chapterData = res.data.chapters || (Array.isArray(res.data) ? res.data : []);
      flatten(chapterData);
      chapters.value = flattened;
    }
  } catch (error) {
    console.error('fetchChapters error:', error);
  } finally {
    loadingChapters.value = false;
  }
};

const visibleChapters = computed(() => {
  if (!chapters.value) return [];
  
  const expandedIds = new Set();
  // 找出所有展开的章节 ID
  chapters.value.forEach(c => {
    if (c.isExpanded) expandedIds.add(c.id);
  });

  return chapters.value.filter(chapter => {
    if (chapter.level === 1) return true;
    
    // 检查所有祖先是否都展开
    let current = chapter;
    while (current.parentId) {
      const parent = chapters.value.find(c => c.id === current.parentId);
      if (!parent || !parent.isExpanded) return false;
      current = parent;
    }
    return true;
  });
});

const toggleChapterExpand = (chapter) => {
  chapter.isExpanded = !chapter.isExpanded;
};

const onChapterTap = (chapter) => {
  if (chapter.hasChildren) {
    toggleChapterExpand(chapter);
  } else {
    jumpToChapter(chapter);
  }
};

const isChapterActive = (chapter) => {
  if (chapterId.value !== null) {
    return chapterId.value === chapter.id;
  }
  
  // 如果当前题目索引在章节范围内，则视为激活（包括父级章节）
  return currentIndex.value >= chapter.start_index && currentIndex.value <= chapter.end_index;
};

// 判断是否为当前最深层的激活章节（用于更强的高亮）
const isDeepestActiveChapter = (chapter) => {
  if (!isChapterActive(chapter)) return false;
  
  let maxLevel = -1;
  let deepestId = null;
  
  for (const item of chapters.value) {
    if (currentIndex.value >= item.start_index && currentIndex.value <= item.end_index) {
      if (item.level > maxLevel) {
        maxLevel = item.level;
        deepestId = item.id;
      }
    }
  }
  return chapter.id === deepestId;
};

const jumpToChapter = async (chapter) => {
  showChapters.value = false;
  
  // 如果当前已经是该章节，则不重复加载
  if (chapterId.value === chapter.id) return;

  // 如果是从章节列表进入（有特定的 chapterId），或者点击了新章节
  if (chapterId.value !== null) {
    chapterId.value = chapter.id;
    await fetchQuestions(true);
    currentIndex.value = 0;
    onQuestionActive(0);
    return;
  }

  // 全书模式下的跳转逻辑
  const targetIndex = chapter.start_index;
  if (targetIndex < 0) return;
  
  // 如果目标题目尚未加载，需要先加载
  if (targetIndex >= questions.value.length) {
    uni.showLoading({ title: '跳转中...' });
    try {
      while (targetIndex >= questions.value.length && hasMore.value) {
        await fetchQuestions(false);
      }
    } finally {
      uni.hideLoading();
    }
  }
  
  if (targetIndex < questions.value.length) {
    currentIndex.value = targetIndex;
    onSwiperChange({ detail: { current: targetIndex } });
  }
};

const jumpToQuestion = (index) => {
  currentIndex.value = index;
  showAnswerSheet.value = false;
  onQuestionActive(index);
};

const getSheetItemClass = (index) => {
  const state = questionStates.value[index];
  if (!state) return '';
  const classes = [];
  if (index === currentIndex.value) classes.push('current');
  if (state.status) classes.push(state.status);
  return classes.join(' ');
};

const toggleFavorite = async () => {
  const token = uni.getStorageSync('token');
  if (!token) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }

  const question = questions.value[currentIndex.value];
  const state = questionStates.value[currentIndex.value];
  if (!question || !state) return;

  try {
    const res = await publicApi.toggleFavorite({
      questionId: question.id,
      bookId: bookId.value
    });
    
    if (res.code === 0) {
      state.isFavorite = res.data.isFavorite;
      uni.showToast({
        title: state.isFavorite ? '收藏成功' : '取消收藏',
        icon: 'none'
      });
    }
  } catch (error) {
    console.error('toggleFavorite error:', error);
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
};

const openCorrection = (question) => {
  currentCorrectingQuestion.value = question;
  correctionReason.value = '';
  showCorrection.value = true;
};

const submitCorrection = async () => {
  if (!correctionReason.value.trim()) {
    uni.showToast({ title: '请输入纠错原因', icon: 'none' });
    return;
  }
  
  try {
    const res = await publicApi.submitFeedback({
      questionId: currentCorrectingQuestion.value.id,
      content: correctionReason.value,
      type: '题目纠错'
    });
    
    if (res.code === 0) {
      uni.showToast({ title: '反馈已提交', icon: 'success' });
      showCorrection.value = false;
    } else {
      uni.showToast({ title: res.message || '提交失败', icon: 'none' });
    }
  } catch (error) {
    console.error('submitFeedback error:', error);
    uni.showToast({ title: '提交出错', icon: 'none' });
  }
};

const goBack = () => {
  uni.navigateBack();
};

</script>

<style lang="scss" scoped>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f7f9fc;
  transition: all 0.3s;
  overflow: hidden; // 核心：禁止页面滚动
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overscroll-behavior: none;
  user-select: none;
  touch-action: none;
  font-family: 'Times New Roman', Times, serif;

  :deep(rich-text) img {
    max-width: 100% !important;
    width: auto !important;
    height: auto !important;
    display: block !important;
    margin: 10px auto !important;
  }

  :deep(rich-text) p,
  :deep(rich-text) div,
  :deep(rich-text) span {
    font-size: inherit !important;
  }

  :deep(rich-text) table {
    max-width: 100% !important;
    overflow-x: auto !important;
  }

  &.night-mode {
    background-color: #121212;
    color: #e0e0e0;
    
    .status-bar {
      background-color: #1f1f1f;
    }
    
    .nav-bar {
      background-color: #1f1f1f;
    }
  }

  /* 记忆卡底部操作按钮 - 提升到容器级别并修正定位 */
  .memory-card-actions {
    position: fixed;
    bottom: calc(100rpx + env(safe-area-inset-bottom)); // 降低位置
    left: 30rpx;
    right: 30rpx;
    display: flex;
    justify-content: space-between;
    gap: 24rpx;
    z-index: 999;
    padding: 8rpx 0; // 减小内边距

    .memory-btn {
      flex: 1;
      height: 72rpx; // 减小高度
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12rpx; // 稍微减小圆角
      font-size: 28rpx; // 稍微减小字号
      font-weight: bold;
      color: #fff;
      box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.15); // 减弱阴影
      transition: all 0.2s;
      
      &:active {
        transform: scale(0.96);
        opacity: 0.9;
      }

      &.master {
        background: linear-gradient(135deg, #4db6ac, #26a69a);
      }
      &.unknown {
        background: linear-gradient(135deg, #ff8a80, #f44336);
      }
    }
  }

  /* 知识卡/记忆卡模式样式 */
  .card-mode {
      padding: 30rpx;
      display: flex;
      flex-direction: column;
      height: auto; // 改为 auto，允许根据内容变化
      box-sizing: border-box;
      
      &.memory-card-mode {
        padding-bottom: 180rpx; // 减小底部边距
      }

      .card-box {
        background-color: #fff;
        border-radius: 20rpx;
        padding: 40rpx;
        box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.06);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 200rpx; // 进一步降低最小高度
        height: auto;
        position: relative;
        transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        transform-style: preserve-3d;
        border: 1rpx solid rgba(0,0,0,0.05);
        margin-bottom: 24rpx; // 添加底部间距，与笔记区域分隔

        .card-header-v2 {
          width: 100%;
          .card-title {
            font-size: 36rpx;
            line-height: 1.6;
            color: #333;
            font-weight: bold;
            text-align: justify;
          }
        }

        .card-body {
          width: 100%;
          margin-top: 40rpx;
          
          .divider {
            height: 2rpx;
            background: linear-gradient(to right, transparent, #eee, transparent);
            margin: 30rpx 0;
          }
          .card-label {
            font-size: 26rpx;
            color: #4db6ac;
            margin-bottom: 20rpx;
            font-weight: bold;
            display: flex;
            align-items: center;
            &::before {
              content: '';
              width: 8rpx;
              height: 24rpx;
              background-color: #4db6ac;
              margin-right: 12rpx;
              border-radius: 4rpx;
            }
          }
          .card-text {
            font-size: 30rpx;
            line-height: 1.7;
            color: #444;
            text-align: justify;
            
            &.answer-text {
              color: #4db6ac;
              font-weight: 500;
              background-color: rgba(77, 182, 172, 0.05);
              padding: 20rpx;
              border-radius: 12rpx;
              margin-bottom: 30rpx;
            }
          }
          .mnemonic-box {
            margin-top: 40rpx;
            background-color: #fff9c4;
            padding: 24rpx;
            border-radius: 16rpx;
            border: 1rpx dashed #f57f17;
            .mnemonic-label {
              font-size: 26rpx;
              color: #f57f17;
              font-weight: bold;
              margin-bottom: 12rpx;
              display: flex;
              align-items: center;
            }
            .mnemonic-content {
              font-size: 28rpx;
              color: #5d4037;
              line-height: 1.5;
            }
          }
        }
      }

      .show-answer-btn {
        width: 100%;
        margin-top: 60rpx;
        display: flex;
        justify-content: center;
        align-items: center;
      
        .btn-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8rpx;
          color: #bbb;
          font-size: 26rpx;
          padding: 12rpx 28rpx;
          border-radius: 30rpx;
          background-color: transparent;
          border: 1rpx solid #ddd;
        
          &:active {
            color: #999;
            border-color: #bbb;
          }
        }
      }

      .hide-answer-btn-v2 {
        margin-top: 20rpx;
        padding: 20rpx;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #999;
        font-size: 26rpx;
        border-top: 1rpx dashed #eee;
        
        .hide-icon {
          margin-left: 8rpx;
          display: flex;
          align-items: center;
        }
        
        &:active {
          color: #4db6ac;
        }
      }
  }


/* 夜间模式适配 */
.night-mode {
  .card-mode .card-box {
    background-color: #242424;
    box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.3);
    border-color: rgba(255,255,255,0.05);
    .card-header-v2 .card-title { color: #e0e0e0; }
    .card-body {
      .divider { background: linear-gradient(to right, transparent, #333, transparent); }
      .card-text { color: #b0b0b0; }
      .mnemonic-box {
        background-color: rgba(255, 249, 196, 0.05);
        border-color: rgba(245, 127, 23, 0.3);
        .mnemonic-label { color: #ffa726; }
        .mnemonic-content { color: #b0b0b0; }
      }
    }

  }

  .progress-section {
    background-color: #1e1e1e;
    .progress-info {
      .question-type-tag {
        background-color: rgba(77, 182, 172, 0.15);
        color: #4db6ac;
        border-color: rgba(77, 182, 172, 0.3);
      }
    }
    .progress-bar-bg { background-color: #333; }
  }

  .progress-percentage {
    flex: 1;
    text-align: center;
    font-size: 24rpx;
    color: #4db6ac;
    font-weight: bold;
    opacity: 0.8;
  }
    
  .card-style {
    background-color: #1e1e1e;
    border-color: #333;
    box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.2);
  }

  .answer-info-card {
    .grid-item {
      border-right-color: #333;
      .label { color: #888; }
      .value { color: #eee; }
    }
  }

  .related-articles-section, .notes-section, .explanation-card {
    .section-title text { color: #eee; }
    .article-carousel-item {
      background-color: transparent;
    }
    .note-item {
      border-bottom-color: #333;
      .username { color: #aaa; }
      .note-content { color: #999; }
    }
  }

  .option-item {
    background-color: #252525;
    border-color: #333;
    .option-content { color: #bbb; }
    .option-label { border-color: #444; color: #888; }
    
    &.selected {
      background-color: #004d40;
      border-color: #4db6ac;
    }
  }
  
  .sub-question-item {
    background-color: #252525;
    border-color: #333;
    color: #bbb;
  }
  
  .question-header .question-title { color: #eee; }
  
  .subjective-answer-section {
    background-color: #1a2a28;
    border-left-color: #4db6ac;
  }
  
  .explanation-main {
    .section-title text { color: #eee; }
    .explanation-main { color: #bbb; }
    border-top-color: #333;
  }
  
  .expand-toggle-btn, .expand-notes-btn {
    background-color: #252525;
    color: #4db6ac;
  }

  .bottom-action-card {
    background-color: #1e1e1e;
    border-top: 1px solid #333;
    .action-item { color: #bbb; }
  }
  
  .modal-mask .answer-sheet-modal,
  .modal-mask .settings-modal,
  .modal-mask .correction-modal,
  .modal-mask .note-modal {
    background-color: #1e1e1e;
    color: #eee;
    .modal-header { border-bottom-color: #333; }
    .setting-item { 
      border-bottom-color: #333; 
      color: #bbb;
      .font-size-levels .level-item {
        background-color: #2c2c2c;
        color: #888;
        &.active {
          background-color: #4db6ac;
          color: #fff;
        }
      }
    }
    .note-textarea {
      background-color: #2c2c2c;
      color: #eee;
    }
  }

  /* 答题卡夜间模式适配 */
  .answer-sheet-modal {
    .sheet-grid .sheet-item {
        background-color: #333;
        color: #888;
        &.current {
          background-color: #004d40;
          color: #4db6ac;
        }
        &.correct { background-color: #1b5e20; color: #81c784; }
        &.error { background-color: #b71c1c; color: #e57373; }
    }
  }
}


.status-bar {
  width: 100%;
  background-color: #4db6ac;
  transition: all 0.3s;
}

// 通用卡片样式
.card-style {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx; // 稍微增加内边距
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.03);
  margin-bottom: 24rpx; // 增加底部外边距
  border: 1rpx solid rgba(0,0,0,0.02);
  
  &.compact-card {
    padding: 8rpx 12rpx; // 进一步减小
    margin-bottom: 12rpx;
    min-height: auto;
  }
}

.answer-combined-card {
  .answer-grid {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12rpx 10rpx;
    
    .grid-item {
      display: flex;
      flex-direction: column; // 改为纵向排列更清晰
      align-items: center;
      background-color: transparent;
      padding: 0;
      flex: 1;
      
      .label {
        font-size: 22rpx; // 减小标签字号
        color: #999;
        margin-right: 0;
        margin-bottom: 6rpx;
      }
      .value {
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
        &.correct { color: #4caf50; }
        &.error { color: #f44336; }
        &.score { color: #ff9800; }
      }
    }
  }

  .mnemonic-section {
    padding-top: 8rpx; // 减小内边距
    margin-top: 2rpx; // 减小外边距
    border-top: 1rpx solid #f5f5f5;
    
    .mnemonic-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8rpx;
      
      .mnemonic-tag {
        display: flex;
        align-items: center;
        text {
          font-size: 20rpx;
          color: #f57f17;
          font-weight: bold;
          margin-left: 8rpx;
        }
      }

      .mnemonic-toggle {
        display: flex;
        align-items: center;
        color: #f57f17;
        font-size: 20rpx;
        
        .toggle-icon {
          margin-left: 4rpx;
          transition: transform 0.3s ease;
          display: flex;
          align-items: center;
          
          &.rotated {
            transform: rotate(180deg);
          }
        }
      }
    }

    .mnemonic-content {
      background-color: #fffde7;
      padding: 8rpx 12rpx;
      border-radius: 8rpx;
    }
  }
}

.section-header {
  margin-bottom: 16rpx;
  &.no-margin {
    margin-bottom: 12rpx;
  }
  .section-title {
    display: flex;
    align-items: center;
    .title-line {
      width: 6rpx;
      height: 24rpx;
      background-color: #4db6ac;
      margin-right: 12rpx;
      border-radius: 3rpx;
    }
    text {
      font-size: 28rpx;
      font-weight: bold;
      color: #333;
    }
  }
}

.section-divider {
  height: 1rpx;
  border-top: 1rpx dashed #eee;
  margin: 30rpx 0;
  width: 100%;
}

.subjective-answer-section {
  margin: 20rpx 0 30rpx 0;
  background-color: #f5fdfc;
  padding: 24rpx;
  border-radius: 12rpx;
  border-left: 8rpx solid #4db6ac;
}

.explanation-card {
  .explanation-main {
    margin-top: 20rpx;
    padding-top: 20rpx;
    border-top: 1rpx dashed #eee;
  }
}

.explanation-main, .subjective-answer-section {
  color: #444;
  line-height: 1.6;
}

.explanation-main :deep(strong), .subjective-answer-section :deep(strong) {
  font-weight: bold;
}

.explanation-main :deep(p), .subjective-answer-section :deep(p) {
  margin-bottom: 12rpx;
}

.explanation-main :deep(p:last-child), .subjective-answer-section :deep(p:last-child) {
  margin-bottom: 0;
}

.explanation-main :deep(br), .subjective-answer-section :deep(br) {
  display: block;
  content: "";
  margin: 0;
  padding: 0;
}

  .expand-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16rpx 0 8rpx;
    color: #4db6ac;
    font-size: 24rpx;
    
    .toggle-icon {
      margin-left: 8rpx;
      transition: transform 0.3s ease;
      display: flex;
      align-items: center;
      
      &.rotated {
        transform: rotate(180deg);
      }
    }
  }

  .explanation-collapsed {
    max-height: 350rpx;
    overflow: hidden;
    position: relative;
    
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 80rpx;
      background: linear-gradient(transparent, rgba(255,255,255,0.9));
      pointer-events: none;
    }
  }


.night-mode .explanation-card {
  .section-title text { color: #eee; }
  .explanation-main {
    color: #bbb;
  }
  .explanation-collapsed::after {
    background: linear-gradient(transparent, rgba(45,45,45,0.9));
  }
}

.article-swiper {
  height: 320rpx;
  margin-top: 10rpx;
  
  .article-group {
    display: flex;
    flex-direction: column;
  }
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20rpx;
  height: 88rpx;
  background-color: #4db6ac;
  color: #fff;
  
  .nav-left {
    display: flex;
    align-items: center;
    width: 160rpx; // 给左侧按钮留足空间
  }
  
  .back-btn {
    width: 60rpx;
    height: 88rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
  }

  .nav-icon-btn {
    width: 60rpx;
    height: 88rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36rpx;
    margin-left: 4rpx;
  }

  .nav-title {
    font-size: 30rpx;
    font-weight: 500;
    flex: 1;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nav-right-placeholder {
    width: 160rpx; // 与左侧等宽，确保标题居中
  }
}

/* 章节目录弹窗样式 */
.chapters-modal {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 70vh;
  background-color: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
  z-index: 1001;

  .modal-header {
    padding: 30rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1rpx solid #eee;
    font-weight: bold;
    font-size: 32rpx;

    .close {
      padding: 10rpx;
      color: #999;
      font-weight: normal;
    }
  }

  .chapters-content {
    flex: 1;
    overflow: hidden;

    .loading-chapters, .empty-chapters {
      padding: 100rpx 0;
      text-align: center;
      color: #999;
      font-size: 28rpx;
    }

    .chapters-list {
      padding: 20rpx 0;

      .chapter-item {
        padding: 24rpx 30rpx;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1rpx solid #f5f5f5;

        &:active {
          background-color: #f9f9f9;
        }

        &.active {
          background-color: #f1f8f7; // 包含当前题目的章节使用极浅背景色
          .chapter-name {
            color: #4db6ac;
          }
        }

        &.deepest-active {
          background-color: #b2dfdb; // 当前定位到的最深层章节使用明显背景色
          .chapter-name {
            color: #00796b;
            font-weight: bold;
          }
        }

        &.level-1 {
          font-weight: bold;
          background-color: #fcfcfc;
          padding: 20rpx 30rpx; // 稍微减小一级章节高度
        }

        &.level-2 {
          padding-left: 60rpx;
          padding-top: 12rpx;
          padding-bottom: 12rpx;
          .chapter-name {
            font-size: 26rpx;
          }
        }

        &.level-3 {
          padding-left: 90rpx;
          padding-top: 8rpx;
          padding-bottom: 8rpx;
          .chapter-name {
            font-size: 24rpx;
          }
        }

        .chapter-left {
          display: flex;
          align-items: center;
          flex: 1;
          margin-right: 20rpx;
          overflow: hidden;

          .expand-icon {
            padding: 10rpx;
            margin-left: -10rpx;
            margin-right: 4rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.3s ease;
            color: #999;
            
            &.rotated {
              transform: rotate(180deg);
            }
          }

          .expand-placeholder {
            width: 32rpx;
            margin-right: 4rpx;
          }

          .chapter-name {
            font-size: 28rpx;
            color: #333;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }

        .chapter-count {
          font-size: 24rpx;
          color: #999;
        }
      }
    }
  }
}

.night-mode .chapters-modal {
  background-color: #1e1e1e;
  color: #eee;
  .modal-header {
    border-bottom-color: #333;
  }
  .chapters-list .chapter-item {
    border-bottom-color: #333;
    &.active {
      background-color: #1a2e2c;
    }
    &.deepest-active {
      background-color: #004d40;
    }
    &.level-1 {
      background-color: #252525;
    }
    .chapter-name {
      color: #eee;
    }
  }
}

.progress-section {
  padding: 14rpx 30rpx; // 减小内边距
  background-color: #fff;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8rpx; // 减小边距
    
    .progress-info-left {
      display: flex;
      align-items: center;
      
      .question-type-tag {
        background-color: #e0f2f1;
        color: #4db6ac;
        font-size: 20rpx;
        padding: 4rpx 16rpx;
        border-radius: 8rpx;
        font-weight: bold;
        border: 1rpx solid rgba(77, 182, 172, 0.3);
        box-shadow: 0 2rpx 4rpx rgba(77, 182, 172, 0.1);
      }
    }
    
    .count-box {
      display: flex;
      align-items: center;
      font-size: 26rpx;
      .current {
        color: #4db6ac;
        font-weight: bold;
      }
      .total {
        color: #999;
      }
      .recitation-toggle {
        font-size: 24rpx;
        padding: 6rpx 20rpx;
        border-radius: 30rpx;
        background-color: #f0f0f0;
        color: #666;
        margin-left: 20rpx;
        transition: all 0.3s;
        &.active {
          background-color: #e0f2f1;
          color: #4db6ac;
          border: 1rpx solid #4db6ac;
        }
      }
    }
  }
  .progress-bar-bg {
    height: 6rpx;
    background-color: #eee;
    border-radius: 3rpx;
    overflow: hidden;
    .progress-active {
      height: 100%;
      background-color: #4db6ac;
      transition: width 0.3s ease;
    }
  }
}

.content-area {
  flex: 1;
  width: 100%;
  height: 0; // 确保 flex: 1 在各种浏览器中表现一致
  
  swiper-item,
  uni-swiper-item { // 明确指定 uni-swiper-item 样式
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: transparent !important; // 确保背景透明
  }
  
  .swiper-scroll {
    height: 100%;
    width: 100%;
    overflow-x: hidden;
    touch-action: pan-y; // 核心：题目内容区域仅允许垂直滚动
    
    /* 隐藏滚动条 - 针对不同平台 */
    &::-webkit-scrollbar {
      display: none;
      width: 0 !important;
      height: 0 !important;
      -webkit-appearance: none;
      background: transparent;
    }
    
    // 兼容 Firefox
    scrollbar-width: none;
    // 兼容 IE
    -ms-overflow-style: none;
  }
}

.question-report-wrap {
  display: flex;
  justify-content: flex-end;
  padding: 0 10rpx 10rpx 0; // 调整内边距使其贴合右下角
  margin-top: -10rpx; // 向上微调，使其更靠近选项
  
  .report-btn {
    display: flex;
    align-items: center;
    font-size: 24rpx;
    color: #999;
    
    .report-icon-box {
      width: 32rpx;
      height: 32rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 6rpx;
    }
    
    &:active {
      opacity: 0.7;
    }
  }
}

.night-mode .question-report-wrap .report-btn {
  color: #666;
}

.related-articles-section {
  margin: 4rpx 0; // 进一步减小外边距
  overflow: hidden;
  background-color: rgba(77, 182, 172, 0.05);
  border-radius: 8rpx;
  border: 1rpx solid rgba(77, 182, 172, 0.08);
  
  .article-carousel {
    height: 40rpx; // 高度从 48rpx 减小到 40rpx
    width: 100%;
    
    .article-carousel-item {
      height: 40rpx;
      width: 100%;
      display: flex;
      align-items: center;
      padding: 0 16rpx;
      overflow: hidden;
      background-color: transparent !important;
      
      .carousel-content {
        display: flex;
        align-items: center;
        flex: 1;
        overflow: hidden;
        
        .article-tag {
          font-size: 16rpx; // 进一步减小字号
          color: #00897b;
          font-weight: bold;
          margin-right: 10rpx;
          flex-shrink: 0;
          &.hot {
            color: #ff5252;
          }
        }
        
        .article-title {
          flex: 1;
          font-size: 26rpx; // 增大字号
          color: #00796b;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 500;
        }
      }
    }
  }
}

.night-mode {
  .progress-section {
    background-color: #1e1e1e;
    box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.2);
    
    .question-type-tag {
      background-color: rgba(77, 182, 172, 0.15);
      color: #4db6ac;
      border-color: rgba(77, 182, 172, 0.4);
      box-shadow: none;
    }
    
    .count-box {
        .total {
          color: #666;
        }
        .recitation-toggle {
          background-color: #2c2c2c;
          color: #888;
          &.active {
            background-color: rgba(77, 182, 172, 0.2);
            color: #4db6ac;
            border-color: #4db6ac;
          }
        }
      }

      .progress-bar-bg {
        background-color: #333;
      }
    }

  .related-articles-section {
    background-color: rgba(77, 182, 172, 0.05);
    border-color: rgba(77, 182, 172, 0.1);
    
    .article-title {
      color: #80cbc4 !important;
    }
    .article-tag {
      color: #4db6ac !important;
      &.hot {
        color: #ff8a80 !important;
      }
    }
  }
}

.notes-section {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;

  .ad-container {
    margin-bottom: 20rpx;
    width: 100%;
  }

  .notes-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24rpx;

    .section-title {
      display: flex;
      align-items: center;
      .title-line {
        width: 6rpx;
        height: 28rpx;
        background-color: #4db6ac;
        margin-right: 12rpx;
        border-radius: 3rpx;
      }
      text {
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
      }
    }

    .add-note-btn {
      display: flex;
      align-items: center;
      background-color: #4db6ac;
      padding: 8rpx 20rpx;
      border-radius: 30rpx;
      color: #fff;
      font-size: 24rpx;
      
      text {
        margin-left: 6rpx;
      }
      
      &:active {
        opacity: 0.8;
      }
    }
  }

  .notes-sub-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;

    .notes-tabs {
      display: flex;
      background-color: #f5f7fa;
      padding: 6rpx;
      border-radius: 30rpx;

      .tab-item {
        padding: 6rpx 24rpx;
        font-size: 24rpx;
        color: #999;
        border-radius: 24rpx;
        transition: all 0.2s;

        &.active {
          background-color: #e0f2f1;
          color: #4db6ac;
          font-weight: 500;
        }
      }
    }

    .note-sort-v2 {
      display: flex;
      align-items: center;
      font-size: 24rpx;
      color: #999;
      
      .sort-icon {
        margin-left: 6rpx;
        display: flex;
        align-items: center;
      }
    }
  }

  .notes-list {
    .note-item {
      display: flex;
      padding: 24rpx 0;
      border-bottom: 1rpx solid #f5f5f5;
      &:last-child { border-bottom: none; }

      .note-left {
        flex-shrink: 0;
        margin-right: 20rpx;
        
        .user-avatar {
          width: 64rpx;
          height: 64rpx;
          border-radius: 50%;
          background-color: #f0f0f0;
        }
      }

      .note-right {
        flex: 1;
        min-width: 0; // 防止内容溢出

        .note-user-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12rpx;

          .username {
            font-size: 26rpx;
            color: #666;
            font-weight: 500;
          }

          .more-btn {
            padding: 4rpx;
            &:active { opacity: 0.7; }
          }
        }

        .note-content {
          font-size: 28rpx;
          color: #333;
          line-height: 1.6;
          margin-bottom: 16rpx;
        }

        .note-replies {
          background-color: #f8f9fa;
          padding: 16rpx 20rpx;
          border-radius: 12rpx;
          margin-bottom: 16rpx;
          
          .reply-item {
            font-size: 24rpx;
            margin-bottom: 12rpx;
            line-height: 1.4;
            &:last-child { margin-bottom: 0; }
            .reply-user { color: #4db6ac; font-weight: 500; margin-right: 8rpx; }
            .reply-content { color: #555; }
          }
        }

        .reply-input-box {
          margin-bottom: 20rpx;
          .reply-textarea {
            width: 100%;
            min-height: 80rpx;
            background-color: #f9f9f9;
            border: 1rpx solid #eee;
            border-radius: 12rpx;
            padding: 16rpx;
            font-size: 26rpx;
            box-sizing: border-box;
          }
          .reply-btns {
            display: flex;
            justify-content: flex-end;
            margin-top: 12rpx;
            text {
              font-size: 24rpx;
              padding: 8rpx 28rpx;
              border-radius: 30rpx;
              margin-left: 16rpx;
            }
            .cancel { color: #999; background-color: #f0f0f0; }
            .submit { color: #fff; background-color: #4db6ac; }
          }
        }

        .note-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          
          .note-info-left {
            display: flex;
            align-items: center;
            font-size: 22rpx;
            color: #bbb;

            .reply-link {
              margin-left: 20rpx;
              color: #4db6ac;
              font-size: 24rpx;
              font-weight: 500;
              &:active { opacity: 0.7; }
            }
          }

          .note-info-right {
            display: flex;
            align-items: center;

            .footer-action {
              display: flex;
              align-items: center;
              margin-left: 30rpx;
              font-size: 24rpx;
              color: #999;

              text {
                margin-left: 6rpx;
                &.active-like { color: #4db6ac; }
                &.active-star { color: #ffb74d; }
              }
              
              &:active {
                transform: scale(1.1);
              }
            }
          }
        }
      }
    }
    
    .empty-notes {
      padding: 60rpx 0;
      text-align: center;
      font-size: 24rpx;
      color: #bbb;
    }

    .expand-notes-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24rpx 0;
      color: #4db6ac;
      font-size: 24rpx;
      border-top: 1rpx solid #f5f5f5;
      
      .toggle-icon {
        margin-left: 8rpx;
        transition: transform 0.3s ease;
        display: flex;
        align-items: center;
        
        &.rotated {
          transform: rotate(180deg);
        }
      }

      &:active {
        opacity: 0.7;
      }
    }
  }
}

.note-modal {
  width: 100%;
  background-color: #fff;
  border-radius: 32rpx 32rpx 0 0;
  .note-modal-content {
    padding: 40rpx;
    .note-textarea {
      width: 100%;
      height: 300rpx;
      background-color: #f9f9f9;
      border-radius: 16rpx;
      padding: 24rpx;
      font-size: 28rpx;
      box-sizing: border-box;
      margin-bottom: 30rpx;
    }
    .note-options {
      margin-bottom: 40rpx;
      .public-toggle {
        display: flex;
        align-items: center;
        font-size: 26rpx;
        color: #666;
      }
    }
    .submit-note-btn {
      width: 100%;
      height: 88rpx;
      background-color: #4db6ac;
      color: #fff;
      border-radius: 44rpx;
      font-size: 32rpx;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}

.practice-container {
  padding: 20rpx 30rpx; // 减小顶部边距
  padding-bottom: 200rpx; // 进一步增加底部边距，防止内容被底部操作栏挡住
}

.question-header {
  margin-bottom: 10rpx;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.question-header .question-title {
  color: #333;
  line-height: 1.5;
  font-weight: normal;
  flex: 1;
  user-select: none;
  text-align: justify;
}

.question-header .question-title :deep(strong) {
  font-weight: bold;
}

.question-header .question-title :deep(p) {
  margin-bottom: 12rpx;
  display: block;
  text-align: justify;
}

.option-item {
  display: flex;
  align-items: center;
  background-color: #fff;
  padding: 10rpx 20rpx; // 进一步减小 padding
  border-radius: 12rpx;
  margin-bottom: 10rpx; // 减小外边距
  border: 2rpx solid #eee;
  box-shadow: 0 2rpx 6rpx rgba(0,0,0,0.01);
  transition: all 0.2s;
  user-select: none;
  
  .option-label {
    width: 44rpx;
    height: 44rpx;
    border-radius: 50%;
    border: 2rpx solid #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16rpx;
    font-size: 24rpx;
    color: #666;
    flex-shrink: 0;
  }
  
  .option-content {
    flex: 1;
    color: #333;
    line-height: 1.4;
  }

  .result-icon {
    margin-left: 10rpx;
    font-size: 28rpx;
    .icon-correct { color: #4caf50; }
    .icon-error { color: #f44336; }
  }
  
  &.selected {
    background-color: #e0f2f1;
    border-color: #4db6ac;
    .option-label {
      background-color: #4db6ac;
      color: #fff;
      border-color: #4db6ac;
    }
  }
  
  &.correct {
    background-color: #e8f5e9;
    border-color: #4caf50;
    color: #2e7d32;
    .option-label {
      background-color: #4caf50;
      color: #fff;
      border-color: #4caf50;
    }
    .option-content {
      color: #2e7d32;
    }
  }
  
  &.error {
    background-color: #ffebee;
    border-color: #f44336;
    color: #c62828;
    .option-label {
      background-color: #f44336;
      color: #fff;
      border-color: #f44336;
    }
    .option-content {
      color: #c62828;
    }
  }
}

.sub-questions-list {
  margin-top: 30rpx;
  padding: 0 10rpx;
}

.sub-question-item {
  background-color: #f8f9fa;
  padding: 24rpx;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
  border: 1rpx solid #eee;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.02);
  text-align: justify;
}

.sub-question-item :deep(.indent) {
  text-indent: 2em;
  margin-bottom: 8rpx;
  display: block;
}

.sub-question-item :deep(.no-indent) {
  text-indent: 0;
  margin-bottom: 8rpx;
  display: block;
}

.confirm-btn-wrap {
  margin-top: 20rpx; // 减小间距
  .main-action-btn {
    width: 100%;
    height: 80rpx;
    background-color: #4db6ac;
    color: #fff;
    border-radius: 40rpx;
    font-size: 30rpx;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.bottom-action-card {
  height: 96rpx; // 减小高度
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 30rpx; // 增加左右内边距
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -2rpx 15rpx rgba(0,0,0,0.05);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 99;
  
  .action-item {
    display: flex;
    flex-direction: row; // 确保是横向排列
    align-items: center;
    justify-content: center;
    color: #666;
    margin-right: 30rpx;
    
    .num {
      font-size: 28rpx; // 稍微增大数字字号
      font-weight: bold;
      margin-left: 10rpx; // 增加图标和文字的间距
      line-height: 1;
      &.success { color: #4caf50; }
      &.danger { color: #f44336; }
    }
    
    .active { color: #f44336; }
  }

  .nav-btns {
    flex: 1;
    display: flex;
    justify-content: flex-end;
    gap: 16rpx;
    
    .nav-btn {
      padding: 14rpx 24rpx;
      border-radius: 36rpx;
      font-size: 24rpx;
      font-weight: 500;
      border: 2rpx solid #4db6ac;
      color: #4db6ac;
      transition: all 0.2s;

      &.next { background: #4db6ac; color: #fff; }
      &.disabled { opacity: 0.3; }
      &:active:not(.disabled) { transform: scale(0.95); }
    }
  }
}

// 弹窗通用样式
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.6);
  z-index: 999;
  display: flex;
  align-items: flex-end;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  font-size: 32rpx;
  font-weight: bold;
  .close {
    font-size: 36rpx;
    color: #999;
    padding: 10rpx;
  }
}

.answer-sheet-modal {
  width: 100%;
  background-color: #fff;
  border-radius: 32rpx 32rpx 0 0;
  max-height: 80vh;
  .sheet-content {
    padding: 30rpx;
    height: 60vh; // 使用固定高度确保滚动
    overflow-y: auto; // 确保溢出滚动
    -webkit-overflow-scrolling: touch; // 优化 iOS 滚动
    
    .sheet-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr); // 增加到6列，使圆圈变小
      gap: 20rpx; // 稍微减小间距
      padding: 20rpx 0;
      
      .sheet-item {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background-color: #f5f5f5;
        color: #666;
        font-size: 24rpx; // 减小字号
        border: 2rpx solid transparent;
        transition: all 0.2s;
        
        &.current {
          border-color: #4db6ac;
          color: #4db6ac;
          background-color: #e0f2f1;
          font-weight: bold;
        }
        
        &.correct {
          background-color: #e8f5e9;
          color: #4caf50;
        }
        
        &.error {
          background-color: #ffebee;
          color: #f44336;
        }
        
        &:active {
          transform: scale(0.9);
        }
      }
    }

    .night-mode {
      .sheet-item {
        background-color: #333;
        color: #888;
        &.current {
          background-color: #004d40;
          color: #4db6ac;
        }
        &.correct { background-color: #1b5e20; color: #81c784; }
        &.error { background-color: #b71c1c; color: #e57373; }
      }
    }
  }
}

.settings-modal {
  width: 100%;
  background-color: #fff;
  border-radius: 32rpx 32rpx 0 0;
  .settings-content {
    padding: 40rpx;
    .setting-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 30rpx 0;
      border-bottom: 1rpx solid #f5f5f5;
      font-size: 30rpx;
      color: #333;
      
      &.column {
        flex-direction: column;
        align-items: flex-start;
        .label { margin-bottom: 20rpx; }
      }

      .font-size-levels {
        display: flex;
        width: 100%;
        justify-content: space-between;
        .level-item {
          flex: 1;
          height: 60rpx;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f5f5f5;
          margin: 0 10rpx;
          border-radius: 30rpx;
          font-size: 24rpx;
          color: #666;
          transition: all 0.2s;
          &:first-child { margin-left: 0; }
          &:last-child { margin-right: 0; }
          &.active {
            background-color: #4db6ac;
            color: #fff;
          }
        }
      }
    }
  }
}

.correction-modal {
  width: 100%;
  background-color: #fff;
  border-radius: 32rpx 32rpx 0 0;
  .correction-content {
    padding: 40rpx;
    .correction-input {
      width: 100%;
      height: 200rpx;
      background-color: #f9f9f9;
      border-radius: 12rpx;
      padding: 20rpx;
      font-size: 28rpx;
      box-sizing: border-box;
      margin-bottom: 30rpx;
    }
    .submit-btn {
      width: 100%;
      height: 90rpx;
      background-color: #4db6ac;
      color: #fff;
      border-radius: 45rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32rpx;
      font-weight: bold;
    }
  }
}

.question-card {
  background-color: #fff;
  border-radius: 20rpx;
  padding: 20rpx; // 减小内边距
  box-shadow: 0 2rpx 15rpx rgba(0,0,0,0.04);
  margin-bottom: 16rpx; // 减小边距
  }

  .animated {
    animation-duration: 0.4s;
    animation-fill-mode: both;
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translate3d(0, 40rpx, 0); }
    to { opacity: 1; transform: translate3d(0, 0, 0); }
  }
  .fadeInUp { animation-name: fadeInUp; }

  @keyframes flipInY {
    from { transform: perspective(400px) rotate3d(0, 1, 0, 90deg); opacity: 0; }
    to { transform: perspective(400px); opacity: 1; }
  }
  .flipInY { animation-name: flipInY; }

  .empty-box {
    padding-top: 150rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #999;
    font-size: 28rpx;
    .empty-img { width: 200rpx; height: 200rpx; margin-bottom: 30rpx; }
  }

  .loading-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 150rpx;
    color: #999;
    font-size: 26rpx;
    .loading-icon {
      width: 50rpx;
      height: 50rpx;
      border: 4rpx solid #f3f3f3;
      border-top: 4rpx solid #4db6ac;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16rpx;
    }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .safe-area-bottom {
    height: env(safe-area-inset-bottom);
  }
}
</style>
