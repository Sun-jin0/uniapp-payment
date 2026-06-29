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
      <text class="nav-title">{{ title || '西医综合练习' }}</text>
      <view class="nav-right-placeholder"></view>
    </view>

    <!-- 进度条与统计 -->
    <view class="progress-section">
      <view class="progress-info">
        <view class="progress-info-left">
          <view class="question-type-tag">
            <text>{{ currentQuestionTypeLabel }}</text>
          </view>
          <view class="question-number-tag" v-if="currentQuestion?.number">
            <text>{{ currentQuestion.number }}</text>
          </view>
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

      <!-- 会员状态提示 -->
      <view class="membership-status-bar" v-if="!isMember && currentIndex < FREE_LIMIT">
        <text class="status-text">免费刷题: {{ currentIndex + 1 }}/{{ FREE_LIMIT }}</text>
        <view class="status-progress">
          <view class="status-progress-fill" :style="{ width: ((currentIndex + 1) / FREE_LIMIT * 100) + '%' }"></view>
        </view>
      </view>
      <view class="membership-status-bar vip-bar" v-else-if="isMember">
        <text class="vip-icon">VIP</text>
        <text class="status-text">会员已开通</text>
      </view>
    </view>

    <!-- 练习内容区域 -->
    <swiper 
      v-if="questions.length > 0"
      :key="questions.length"
      class="content-area" 
      :current="currentIndex" 
      @change="onSwiperChange"
      :duration="250"
      easing-function="linear"
    >
      <swiper-item v-for="(question, qIndex) in questions" :key="qIndex">
        <scroll-view 
          class="swiper-scroll" 
          scroll-y 
          :enable-back-to-top="true" 
          :show-scrollbar="false"
          :enhanced="true"
        >
          <view class="practice-container">
            <!-- 题目卡片 -->
            <view class="question-card">
              <view class="question-header">
                <view class="question-title-wrap">
                   <text v-if="question.score" class="question-score-tag">{{ question.score }}分</text>
                  <view class="question-title" :style="{ fontSize: dynamicFontSize.title }">
                    <rich-text :nodes="formatTitle(question.topic)"></rich-text>
                  </view>
                 
                </view>
              </view>
              
              <!-- 题目图片 -->
              <view v-if="question.topic_image" class="question-image-box">
                <image :src="question.topic_image" mode="widthFix" @tap="previewImage(question.topic_image)"></image>
              </view>
              
              <!-- 选项列表 -->
              <view v-if="question.content && question.content.options" class="options-list">
                <view 
                  v-for="(option, index) in question.content.options" 
                  :key="index"
                  class="option-item"
                  :class="getOptionClass(qIndex, index)"
                  @tap="handleSelect(qIndex, index)"
                >
                  <view class="option-label">{{ String.fromCharCode(65 + index) }}</view>
                  <view class="option-content" :style="{ fontSize: dynamicFontSize.option }">
                    <rich-text :nodes="formatContent(option.text || option, 'option')"></rich-text>
                  </view>
                  <view v-if="shouldShowAnswer(qIndex)" class="result-icon">
                    <SvgIcon v-if="isCorrectOption(question, index)" name="correct" size="32" fill="#4caf50" />
                    <SvgIcon v-else-if="isSelectedOption(qIndex, index)" name="error" size="32" fill="#f44336" />
                  </view>
                </view>
              </view>

              <!-- 题目报错按钮 -->
              <view class="question-report-wrap">
                <view class="report-btn" @tap="openCorrection(question)">
                  <SvgIcon name="help" size="28" fill="#999" />
                  <text>题目报错</text>
                </view>
              </view>
            </view>
            
            <!-- 答案解析区域 -->
            <view v-if="shouldShowAnswer(qIndex)" class="answer-section animated fadeInUp">
              <!-- 相关学习资料通知栏 -->
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

              <!-- 答题统计卡片 -->
              <view class="answer-combined-card card-style compact-card">
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
              </view>

              <!-- 教材还原/考点归纳 (西医特色) -->
              <view v-if="question.exam_center_restore" class="explanation-card card-style">
                <view class="section-header">
                  <view class="section-title">
                    <view class="title-line"></view>
                    <text>教材还原 / 考点归纳</text>
                  </view>
                </view>
                <view class="explanation-content" :style="{ fontSize: dynamicFontSize.explanation }">
                  <rich-text :nodes="formatExplanation(question.exam_center_restore)"></rich-text>
                </view>
                <view v-if="question.exam_center_restore_image" class="analysis-image-box">
                  <image :src="question.exam_center_restore_image" mode="widthFix" @tap="previewImage(question.exam_center_restore_image)"></image>
                </view>
              </view>

              <!-- 题目解析 (有的话就展示) -->
              <view v-if="question.explanation" class="explanation-card card-style">
                <view class="section-header">
                  <view class="section-title">
                    <view class="title-line"></view>
                    <text>题目解析</text>
                  </view>
                </view>
                <view class="explanation-content" :style="{ fontSize: dynamicFontSize.explanation }">
                  <rich-text :nodes="formatExplanation(question.explanation)"></rich-text>
                </view>
              </view>

              <!-- 题目解析 -->
              <view v-if="question.basic_analysis" class="explanation-card card-style">
                <view class="section-header">
                  <view class="section-title">
                    <view class="title-line"></view>
                    <text>题目解析</text>
                  </view>
                </view>
                <view class="explanation-content" :style="{ fontSize: dynamicFontSize.explanation }">
                  <rich-text :nodes="formatExplanation(question.basic_analysis)"></rich-text>
                </view>
                <view v-if="question.basic_analysis_image" class="analysis-image-box">
                  <image :src="question.basic_analysis_image" mode="widthFix" @tap="previewImage(question.basic_analysis_image)"></image>
                </view>
              </view>

              <!-- 分项解析 (新) -->
              <view v-if="question.itemize_analysis" class="explanation-card card-style">
                <view class="section-header">
                  <view class="section-title">
                    <view class="title-line"></view>
                    <text>分项解析</text>
                  </view>
                </view>
                <view class="explanation-content" :style="{ fontSize: dynamicFontSize.explanation }">
                  <rich-text :nodes="formatExplanation(question.itemize_analysis)"></rich-text>
                </view>
                <view v-if="question.itemize_analysis_image" class="analysis-image-box">
                  <image :src="question.itemize_analysis_image" mode="widthFix" @tap="previewImage(question.itemize_analysis_image)"></image>
                </view>
              </view>

              <!-- 知识总结 -->
              <view v-if="question.comparison_summary || question.comparison_images" class="explanation-card card-style">
                <view class="section-header">
                  <view class="section-title">
                    <view class="title-line"></view>
                    <text>知识总结</text>
                  </view>
                </view>
                <view v-if="question.comparison_summary" class="comparison-summary-box">
                  <rich-text :nodes="formatExplanation(question.comparison_summary)"></rich-text>
                </view>
                <!-- 对比总结多图支持 -->
                <view v-if="question.comparison_images" class="analysis-image-box">
                   <view v-for="(img, idx) in formatImageList(question.comparison_images)" :key="idx" class="multi-image-item">
                     <image :src="img" mode="widthFix" @tap="previewImage(img)"></image>
                   </view>
                </view>
              </view>

              <!-- 视频解析 (新 - 有视频且管理员开关开启才显示) -->
              <view v-if="question.video_analysis && settings.showVideoAnalysis" class="explanation-card card-style">
                <view class="section-header">
                  <view class="section-title">
                    <view class="title-line"></view>
                    <text>视频解析</text>
                  </view>
                </view>
                <view class="video-container">
                  <video 
                    class="analysis-video" 
                    :src="question.video_analysis" 
                    controls
                    object-fit="contain"
                    :poster="question.topic_image || ''"
                  ></video>
                </view>
              </view>

              <!-- 考点总结图 -->
              <view v-if="question.knowledge_image" class="explanation-card card-style">
                <view class="section-header">
                  <view class="section-title">
                    <view class="title-line"></view>
                    <text>考点总结</text>
                  </view>
                </view>
                <view class="knowledge-image-box">
                  <image :src="question.knowledge_image" mode="widthFix" @tap="previewImage(question.knowledge_image)"></image>
                </view>
              </view>

              <!-- 笔记部分 (参考公共刷题页面完善) -->
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
                    <text>{{ noteSortBy === 'time' ? '最新发布' : '最多点赞' }}</text>
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
                    v-for="note in (questionStates[currentIndex]?.isNotesExpanded ? filteredNotes : filteredNotes.slice(0, 3))" 
                    :key="note.id" 
                    class="note-item"
                  >
                    <view class="note-left">
                      <image class="user-avatar" :src="note.avatar || '/static/logo.png'"></image>
                    </view>
                    <view class="note-right">
                      <view class="note-user-row">
                      <text class="username">{{ note.username }}</text>
                      <view class="note-meta">
                        <view class="more-btn" @tap="showNoteActions(note)">
                          <SvgIcon name="more" size="32" fill="#999" />
                        </view>
                      </view>
                    </view>
                    <view class="note-content">
                      <rich-text :nodes="formatExplanation(note.content)"></rich-text>
                    </view>
                    
                    <!-- 笔记回复列表 -->
                    <view class="note-replies-container" v-if="note.replies && note.replies.length > 0">
                      <view class="reply-toggle" @tap="note.isRepliesExpanded = !note.isRepliesExpanded">
                        <text>{{ note.isRepliesExpanded ? '收起回复' : '展开 ' + note.replies.length + ' 条回复' }}</text>
                        <view class="toggle-icon" :class="{ rotated: note.isRepliesExpanded }">
                          <svg width="10" height="10" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M37 18L24 31L11 18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </view>
                      </view>
                      <view class="note-replies" v-if="note.isRepliesExpanded">
                        <view v-for="reply in note.replies" :key="reply.id" class="reply-item" @longpress="showReplyActions(reply, note)">
                          <text class="reply-user">{{ reply.username }}:</text>
                          <rich-text class="reply-content" :nodes="formatExplanation(reply.content)"></rich-text>
                          <text 
                            v-if="String(reply.user_id || reply.userId) === String(currentUserId)" 
                            class="delete-reply-btn" 
                            @tap="deleteReply(reply, note)"
                          >删除</text>
                        </view>
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
                        <text class="note-date">{{ formatDate(note.create_time || note.createdAt) }}</text>
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
                    @tap="questionStates[currentIndex].isNotesExpanded = !questionStates[currentIndex].isNotesExpanded"
                  >
                    <text>{{ questionStates[currentIndex]?.isNotesExpanded ? '收起部分笔记' : '展开全部 ' + filteredNotes.length + ' 条笔记' }}</text>
                    <view class="toggle-icon" :class="{ rotated: questionStates[currentIndex]?.isNotesExpanded }">
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
              <button class="main-action-btn" @tap="confirmAnswer(qIndex)">确定答案</button>
            </view>
          </view>
          
          <!-- 底部占位 -->
          <view style="height: 140rpx;"></view>
        </scroll-view>
      </swiper-item>
      
    </swiper>

    <!-- 加载/空状态 -->
    <view v-else class="content-area">
      <view v-if="loading" class="loading-box">
        <view class="loading-icon"></view>
        <text>正在加载题目...</text>
      </view>
      <view v-else class="empty-box">
        <SvgIcon name="empty" size="120" fill="#ccc" />
        <text>暂无相关题目</text>
      </view>
    </view>

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

      <view class="nav-btns">
        <view class="nav-btn" :class="{ disabled: currentIndex === 0 }" @tap="currentIndex > 0 && (currentIndex--)">上一题</view>
        <view class="nav-btn next" :class="{ disabled: currentIndex === totalCount - 1 }" @tap="currentIndex < totalCount - 1 && (currentIndex++)">下一题</view>
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
              v-for="index in totalCount" 
              :key="index"
              class="sheet-item"
              :class="getSheetItemClass(index - 1)"
              @tap="jumpToQuestion(index - 1)"
            >
              {{ index }}
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
            <switch :checked="settings.nightMode" @change="e => { settings.nightMode = e.detail.value; saveUserSettings(); }" color="#4db6ac" />
          </view>
          <view class="setting-item">
            <text>显示视频解析</text>
            <switch :checked="settings.showVideoAnalysis" @change="e => { settings.showVideoAnalysis = e.detail.value; saveUserSettings(); }" color="#4db6ac" />
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

    <!-- 添加/编辑笔记弹窗 -->
    <view class="modal-mask" v-if="showAddNoteModal" @tap="showAddNoteModal = false">
      <view class="note-modal animated fadeInUp" @tap.stop>
        <view class="modal-header">
          <text>{{ editingNote ? '编辑笔记' : '添加笔记' }}</text>
          <text class="close" @tap="showAddNoteModal = false">✕</text>
        </view>
        <view class="note-modal-content">
          <textarea 
            v-model="addNoteContent" 
            :placeholder="editingNote ? '编辑你的笔记...' : '分享你的学习笔记...'" 
            class="note-textarea"
            auto-focus
            fixed
          ></textarea>
          <view class="note-options">
            <view class="public-toggle" @tap="isPublicNote = !isPublicNote">
              <SvgIcon :name="isPublicNote ? 'sun' : 'lock'" size="32" fill="#4db6ac" />
              <text>{{ isPublicNote ? '公开 (所有人可见)' : '私密 (仅自己可见)' }}</text>
            </view>
          </view>
          <view class="note-modal-footer">
            <button class="cancel-btn" @tap="showAddNoteModal = false">取消</button>
            <button class="submit-btn" @tap="submitNote">{{ editingNote ? '保存修改' : '立即发布' }}</button>
          </view>
        </view>
      </view>
    </view>

    <!-- 题目报错弹窗 -->
    <view class="modal-mask" v-if="showFeedback" @tap="showFeedback = false">
      <view class="feedback-modal animated fadeInUp" @tap.stop>
        <view class="modal-header">
          <text>题目报错</text>
          <text class="close" @tap="showFeedback = false">✕</text>
        </view>
        <view class="feedback-content">
          <view class="feedback-type-list">
            <view 
              v-for="type in feedbackTypes" 
              :key="type"
              class="type-item"
              :class="{ active: feedbackType === type }"
              @tap="feedbackType = type"
            >
              {{ type }}
            </view>
          </view>
          <textarea 
            v-model="feedbackContent" 
            placeholder="请详细描述题目问题，我们将尽快核实处理..." 
            class="feedback-textarea"
            fixed
          ></textarea>
          <view class="feedback-footer">
            <button class="cancel-btn" @tap="showFeedback = false">取消</button>
            <button class="submit-btn" @tap="submitFeedback">提交反馈</button>
          </view>
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
import { ref, computed, onMounted, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import medicalApi from '@/api/medical';
import publicApi from '@/api/public';
import SvgIcon from '@/components/SvgIcon/SvgIcon.vue';
import { checkTextContent } from '@/utils/contentSecurity.js';
import MembershipModal from '@/components/MembershipModal/MembershipModal.vue';
import { checkAccess, recordQuestionView, getFreeLimit } from '@/composables/useMembershipCheck.js';

const FREE_LIMIT = getFreeLimit();
const isMember = ref(false);
const showMemberModal = ref(false);
const memberSubjectKey = ref('med');
const memberPriceInfo = ref(null);

const getStatusBarHeight = () => {
  try {
    return uni.getSystemInfoSync().statusBarHeight || 0;
  } catch (e) {
    return 0;
  }
};

const statusBarHeight = ref(getStatusBarHeight());
const title = ref('');
const questions = ref([]);
const currentIndex = ref(0);
const loading = ref(true);
const totalCount = ref(0);
const page = ref(1);
const pageSize = ref(10);
const hasMore = ref(true);
const questionStates = ref([]);
const notes = ref([]);
const currentUserId = ref(uni.getStorageSync('userId'));
const showAnswerSheet = ref(false);
const showSettings = ref(false);
const showAddNoteModal = ref(false);
const showFeedback = ref(false);
const feedbackContent = ref('');
const feedbackType = ref('题目错误');
const feedbackTypes = ['题目错误', '答案错误', '解析错误', '图片模糊', '其他问题'];
const addNoteContent = ref('');
const isPublicNote = ref(true);
const noteTab = ref('public'); // public 或 private
const noteSortBy = ref('time'); // time 或 likes
const replyTo = ref(null);
const replyContent = ref('');
const editingNote = ref(null);
const initialParams = ref({});

// 设置
const settings = ref({
  autoNext: true,
  nightMode: false,
  recitationMode: false,
  fontSizeLevel: 'standard',
  showVideoAnalysis: true // 管理员设置开关，默认为 true
});

// 过滤后的笔记
const filteredNotes = computed(() => {
  if (!notes.value) return [];
  let result = [...notes.value];

  // 1. 选项卡筛选
  if (noteTab.value === 'private') {
    // 个人笔记：仅显示当前用户的（包括私密和公开）
    result = result.filter(note => {
      const noteUserId = note.user_id || note.userId;
      return String(noteUserId) === String(currentUserId.value);
    });
  } else {
    // 公开笔记：显示所有公开的笔记
    result = result.filter(note => (note.is_public === 1 || note.isPublic === 1));
  }

  // 2. 排序逻辑
  if (noteSortBy.value === 'time') {
    return result.sort((a, b) => new Date(b.create_time || b.createdAt) - new Date(a.create_time || a.createdAt));
  } else if (noteSortBy.value === 'likes') {
    return result.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  }
  return result;
});

// 动态字体大小
const dynamicFontSize = computed(() => {
  const levels = {
    small: { title: '30rpx', option: '28rpx', explanation: '28rpx' },
    standard: { title: '34rpx', option: '32rpx', explanation: '30rpx' },
    large: { title: '38rpx', option: '36rpx', explanation: '34rpx' },
    extra: { title: '42rpx', option: '40rpx', explanation: '38rpx' }
  };
  return levels[settings.value.fontSizeLevel];
});

const currentQuestion = computed(() => questions.value[currentIndex.value] || {});
const currentQuestionTypeLabel = computed(() => {
  const types = {
    'A1': 'A1型题',
    'A2': 'A2型题',
    'B': 'B型题',
    'X': 'X型题'
  };
  return types[currentQuestion.value.question_type] || '题目';
});

const progress = computed(() => {
  if (totalCount.value === 0) return 0;
  return ((currentIndex.value + 1) / totalCount.value) * 100;
});

const correctCount = computed(() => questionStates.value.filter(s => s.status === 'correct').length);
const errorCount = computed(() => questionStates.value.filter(s => s.status === 'error').length);
const sessionAccuracy = computed(() => {
  const total = correctCount.value + errorCount.value;
  return total === 0 ? '0%' : Math.round((correctCount.value / total) * 100) + '%';
});

// 通知栏相关
const relatedArticles = ref({ popular: [], newest: [] });
const articleLoading = ref(false);

const articleGroups = computed(() => {
  const groups = [];
  const addedIds = new Set();
  
  [...relatedArticles.value.popular, ...relatedArticles.value.newest].forEach(article => {
    if (!addedIds.has(article.id)) {
      addedIds.add(article.id);
      groups.push(article);
    }
  });
  
  return groups;
});

const fetchRelatedArticles = async () => {
  if (articleLoading.value) return;
  articleLoading.value = true;
  try {
    const res = await publicApi.getRelatedArticles();
    if (res.code === 0 && res.data) {
      relatedArticles.value = res.data;
    }
  } catch (error) {
    console.error('获取相关文章失败:', error);
  } finally {
    articleLoading.value = false;
  }
};

const goToArticle = async (articleId) => {
  uni.showLoading({ title: '加载中...' });
  try {
    const res = await publicApi.getNoticeById(articleId);
    if (res.code === 0 && res.data) {
      const article = res.data;
      
      if ((article.noticeType === 'link' || article.noticeType === 'wechat') && article.linkUrl) {
        uni.hideLoading();
        uni.navigateTo({
          url: `/pages/webview/webview?url=${encodeURIComponent(article.linkUrl)}`
        });
        return;
      }
      
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

const isFavorite = computed(() => questionStates.value[currentIndex.value]?.isFavorite);

// 监听当前题目变化或背题模式切换，加载笔记
watch([currentIndex, () => settings.value.recitationMode], ([newIdx, newRecMode]) => {
  if (questions.value.length > 0 && questions.value[newIdx]) {
    if (newRecMode || (questionStates.value[newIdx] && questionStates.value[newIdx].showAnswer)) {
      fetchNotes(questions.value[newIdx].question_id);
    }
  }
}, { immediate: false });

onLoad((options) => {
  const { mode, courseId, chapterId, year, title: pageTitle } = options;
  title.value = pageTitle || '西医综合';
  
  // 生成 progressKey
  let progressKey = 'med_general';
  if (chapterId) {
    progressKey = `med_chapter_${chapterId}`;
  } else if (courseId) {
    progressKey = `med_course_${courseId}`;
  } else if (year) {
    progressKey = `med_year_${year}`;
  }
  
  // 更新最近练习
  const practiceItem = {
    id: courseId || chapterId || year || 'med',
    title: pageTitle || '西医综合',
    icon: 'paint-brush',
    url: `/pages/med/med-practice?mode=${mode}&courseId=${courseId}&chapterId=${chapterId}&year=${year}&title=${pageTitle}`,
    category: 'professional',
    progressKey
  };
  uni.setStorageSync('lastPracticeSubject', practiceItem);
  
  // 统一参数名称为下划线形式，以匹配后端预期，并过滤无效参数
  const params = {
    mode
  };
  
  if (courseId && courseId !== 'undefined') params.course_id = courseId;
  if (chapterId && chapterId !== 'undefined') params.chapter_id = chapterId;
  if (year && year !== 'undefined') params.year = year;
  
  initialParams.value = params;
  fetchQuestions(true);
  loadUserSettings();
  fetchRelatedArticles();
});

const fetchQuestions = async (isFirstLoad = true) => {
  if (isFirstLoad) {
    loading.value = true;
    page.value = 1;
    questions.value = [];
    questionStates.value = [];
    hasMore.value = true;
  } else {
    if (!hasMore.value || loading.value) return;
    loading.value = true;
  }

  try {
    const params = {
      ...initialParams.value,
      page: page.value,
      pageSize: pageSize.value
    };
    
    const res = await medicalApi.getMedQuestions(params);
    console.log('API Response:', res);
    if (res.code === 0 && res.data) {
      const list = res.data.list || [];
      console.log('Questions list:', list);
      
      if (list.length === 0) {
        if (isFirstLoad) {
          questions.value = [];
          totalCount.value = 0;
        }
        hasMore.value = false;
        return;
      }

      const newQuestions = list.map((q, index) => {
        // 兼容 snake_case 和 camelCase
        const normalized = {
          ...q,
          question_id: q.question_id || q.questionId,
          question_bank_id: q.question_bank_id || q.questionBankId,
          question_bank_category_id: q.question_bank_category_id || q.questionBankCategoryId,
          question_type_option: q.question_type_option || q.questionTypeOption,
          column_id: q.column_id || q.columnId,
          question_type: q.type || q.question_type || q.questionType || q.questionBankType || '',
          topic: q.topic || '',
          content: q.content || '',
          answer: q.answer || '',
          number: q.number || '',
          topic_image: q.topic_image || q.topicImage || '',
          source: q.source,
          score: q.score,
          score_describe: q.score_describe || q.scoreDescribe,
          exam_center_restore: q.exam_center_restore || q.examCenterRestore,
          exam_center_restore_image: q.exam_center_restore_image || q.examCenterRestoreImage,
          basic_analysis: q.basic_analysis || q.basicAnalysis,
          basic_analysis_image: q.basic_analysis_image || q.basicAnalysisImage,
          itemize_analysis: q.itemize_analysis || q.itemizeAnalysis,
          itemize_analysis_image: q.itemize_analysis_image || q.itemizeAnalysisImage,
          video_analysis: q.video_analysis || q.videoAnalysis,
          comparison_summary: q.comparison_summary || q.comparisonSummary,
          comparison_images: q.comparison_images || q.comparisonImages,
          mind_map: q.mind_map || q.mindMap,
          mind_map_image: q.mind_map_image || q.mindMapImage,
          knowledge_image: q.knowledge_image || q.knowledgeImage,
          school_name: q.school_name || q.schoolName,
          tags: q.tags,
          sort: q.sort,
          exam_rate: q.exam_rate || q.examRate,
          collect_total: q.collect_total || q.collectTotal,
          answer_total: q.answer_total || q.answerTotal,
          right_total: q.right_total || q.rightTotal,
          right_rate: q.right_rate || q.rightRate
        };
        
        // 安全处理 content
        let processedContent = normalized.content;
        if (typeof processedContent === 'string' && processedContent.trim()) {
          try {
            // 处理可能存在的 HTML 实体
            const unescaped = processedHtml(processedContent);
            processedContent = JSON.parse(unescaped);
          } catch (e) {
            console.error('JSON parse error for question content:', e);
            processedContent = { options: [] };
          }
        } else if (!processedContent || typeof processedContent !== 'object') {
          processedContent = { options: [] };
        }
        
        // 兼容 options 格式 (数组或对象)
        if (Array.isArray(processedContent)) {
          processedContent = { options: processedContent };
        } else if (processedContent && !processedContent.options) {
          processedContent = { options: [] };
        }
        
        return {
          ...normalized,
          content: processedContent
        };
      });

      questions.value = [...questions.value, ...newQuestions];
      totalCount.value = res.data.total || (isFirstLoad ? questions.value.length : totalCount.value);
      
      const newStates = newQuestions.map(q => ({
        userAnswer: '',
        showAnswer: false,
        isCorrect: false,
        status: 'unanswered',
        isFavorite: false,
        isNotesExpanded: false
      }));
      questionStates.value = [...questionStates.value, ...newStates];
      
      hasMore.value = questions.value.length < totalCount.value;
      page.value++;

      // 如果是背题模式，加载第一题的笔记
      if (isFirstLoad && settings.value.recitationMode && questions.value[0]) {
        fetchNotes(questions.value[0].question_id);
      }

      // 处理跳转到指定题目
      if (isFirstLoad && initialParams.value.jumpQuestionId) {
        const jumpId = String(initialParams.value.jumpQuestionId);
        const jumpIndex = questions.value.findIndex(q => String(q.question_id) === jumpId);
        if (jumpIndex > -1) {
          currentIndex.value = jumpIndex;
          // 清除跳转标记，避免后续加载重复跳转
          initialParams.value.jumpQuestionId = null;
        }
      }
    }
  } catch (error) {
    console.error('fetchQuestions error:', error);
  } finally {
    loading.value = false;
  }
};

// 辅助函数：处理 HTML 实体解码
const processedHtml = (str) => {
  if (!str) return '';
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
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
    const result = checkAccess('med', newIndex);
    if (result.showPrompt && !result.canAccess) {
      memberPriceInfo.value = result.subjectInfo;
      showMemberModal.value = true;
    }
  }
  
  // 记录做题次数
  recordQuestionView('med');
  
  if (shouldShowAnswer(newIndex)) {
    fetchNotes(questions.value[newIndex].question_id);
  }
  
  // 检查是否需要加载更多 - 提前 5 题就开始加载
  if (newIndex >= questions.value.length - 5 && hasMore.value) {
    loadMore();
  }
  
  // 保存进度到本地
  savePracticeProgressToList(newIndex);
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
  
  const params = initialParams.value;
  let progressKey = 'med_general';
  let url = `/pages/med/med-practice?mode=${params.mode}`;
  
  if (params.chapter_id) {
    progressKey = `med_chapter_${params.chapter_id}`;
    url += `&chapterId=${params.chapter_id}`;
  } else if (params.course_id) {
    progressKey = `med_course_${params.course_id}`;
    url += `&courseId=${params.course_id}`;
  } else if (params.year) {
    progressKey = `med_year_${params.year}`;
    url += `&year=${params.year}`;
  }
  
  url += `&title=${encodeURIComponent(title.value)}&startIndex=${index}`;
  
  const practiceItem = {
    type: 'med',
    subject: '医学',
    id: params.chapter_id || params.course_id || params.year || 'med',
    title: title.value,
    url: url,
    icon: 'paint-brush',
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

const shouldShowAnswer = (index) => {
  return settings.value.recitationMode || questionStates.value[index]?.showAnswer;
};

const handleSelect = (qIndex, oIndex) => {
  const state = questionStates.value[qIndex];
  if (state.showAnswer) return;
  
  const label = String.fromCharCode(65 + oIndex);
  const question = questions.value[qIndex];
  
  if (question.question_type === 'X') {
    let selected = state.userAnswer ? state.userAnswer.split('') : [];
    const idx = selected.indexOf(label);
    if (idx > -1) selected.splice(idx, 1);
    else selected.push(label);
    state.userAnswer = selected.sort().join('');
  } else {
    state.userAnswer = label;
  }
};

const confirmAnswer = async (index) => {
  const state = questionStates.value[index];
  const question = questions.value[index];
  
  if (!state.userAnswer) {
    uni.showToast({ title: '请先选择答案', icon: 'none' });
    return;
  }
  
  state.showAnswer = true;
  state.isCorrect = state.userAnswer === question.answer;
  state.status = state.isCorrect ? 'correct' : 'error';
  
  // 异步记录进度
  medicalApi.updateMedPracticeProgress({
    questionId: question.question_id,
    isCorrect: state.isCorrect ? 1 : 0,
    userAnswer: state.userAnswer
  }).catch(err => console.error('update progress error:', err));

  fetchNotes(question.question_id);
  
  if (state.isCorrect && settings.value.autoNext && currentIndex.value < totalCount.value - 1) {
    setTimeout(() => {
      currentIndex.value++;
    }, 1000);
  }
};

const fetchNotes = async (questionId) => {
  if (!questionId) return;
  try {
    const res = await medicalApi.getMedQuestionNotes({ questionId });
    if (res.code === 0) {
      const parentNotes = Array.isArray(res.data) ? res.data : [];
      // 为每个笔记获取回复
      const notesWithReplies = await Promise.all(parentNotes.map(async (note) => {
        try {
          const replyRes = await medicalApi.getMedNoteReplies({ noteId: note.id });
          return {
            ...note,
            replies: replyRes.code === 0 ? replyRes.data : [],
            isRepliesExpanded: false
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
    const res = await medicalApi.addMedQuestionNote({
      questionId: question.question_id,
      content: replyContent.value,
      isPublic: 1, // 回复默认公开
      parentId: replyTo.value.id
    });
    
    if (res.code === 0) {
      uni.showToast({ title: '回复成功', icon: 'success' });
      replyTo.value = null;
      replyContent.value = '';
      fetchNotes(question.question_id);
    }
  } catch (error) {
    console.error('submitReply error:', error);
    uni.showToast({ title: '回复失败', icon: 'none' });
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
      res = await medicalApi.updateMedQuestionNote({
        id: editingNote.value.id,
        content: addNoteContent.value,
        isPublic: isPublicNote.value ? 1 : 0
      });
    } else {
      // 新增笔记
      res = await medicalApi.addMedQuestionNote({
        questionId: question.question_id,
        content: addNoteContent.value,
        isPublic: isPublicNote.value ? 1 : 0
      });
    }
    
    if (res.code === 0) {
      uni.showToast({ title: editingNote.value ? '修改成功' : '发布成功', icon: 'success' });
      showAddNoteModal.value = false;
      editingNote.value = null;
      fetchNotes(question.question_id);
    }
  } catch (error) {
    console.error('submitNote error:', error);
    uni.showToast({ title: editingNote.value ? '修改失败' : '发布失败', icon: 'none' });
  }
};

const toggleNoteLike = async (note) => {
  const oldIsLiked = note.isLiked;
  const oldLikeCount = note.likeCount || 0;
  
  note.isLiked = !oldIsLiked;
  note.likeCount = oldLikeCount + (note.isLiked ? 1 : -1);

  try {
    const res = await medicalApi.toggleMedNoteLike({ noteId: note.id });
    if (res.code !== 0) {
      note.isLiked = oldIsLiked;
      note.likeCount = oldLikeCount;
    }
  } catch (error) {
    note.isLiked = oldIsLiked;
    note.likeCount = oldLikeCount;
  }
};

const showSortOptions = () => {
  const items = ['最新发布', '最多点赞'];
  uni.showActionSheet({
    itemList: items,
    success: (res) => {
      noteSortBy.value = res.tapIndex === 0 ? 'time' : 'likes';
    }
  });
};

const deleteNote = async (note) => {
  const noteId = typeof note === 'object' ? note.id : note;
  const noteOwnerId = typeof note === 'object' ? (note.user_id || note.userId) : null;
  
  if (noteOwnerId && String(noteOwnerId) !== String(currentUserId.value)) {
    uni.showToast({ title: '只能删除自己的笔记', icon: 'none' });
    return;
  }

  uni.showModal({
    title: '提示',
    content: '确定要删除这条笔记吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const response = await medicalApi.deleteMedQuestionNote({ id: noteId });
          if (response.code === 0) {
            uni.showToast({ title: '删除成功', icon: 'success' });
            fetchNotes(currentQuestion.value.question_id);
          }
        } catch (error) {
          uni.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    }
  });
};

const editNote = (note) => {
  const noteOwnerId = note.user_id || note.userId;
  if (String(noteOwnerId) !== String(currentUserId.value)) {
    uni.showToast({ title: '只能修改自己的笔记', icon: 'none' });
    return;
  }
  editingNote.value = { ...note, is_public: note.is_public || (note.isPublic ? 1 : 0) };
  addNoteContent.value = note.content;
  isPublicNote.value = (note.is_public === 1 || note.isPublic);
  showAddNoteModal.value = true;
};

const showReplyActions = (reply, note) => {
  const replyUserId = reply.user_id || reply.userId;
  const isMine = String(replyUserId) === String(currentUserId.value);
  if (!isMine) return;

  uni.showActionSheet({
    itemList: ['删除'],
    success: (res) => {
      if (res.tapIndex === 0) {
        deleteReply(reply, note);
      }
    }
  });
};

const deleteReply = async (reply, note) => {
  const replyOwnerId = reply.user_id || reply.userId;
  if (String(replyOwnerId) !== String(currentUserId.value)) {
    uni.showToast({ title: '只能删除自己的回复', icon: 'none' });
    return;
  }
  uni.showModal({
    title: '提示',
    content: '确定要删除这条回复吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const response = await medicalApi.deleteMedQuestionNote({ id: reply.id });
          if (response.code === 0) {
            uni.showToast({ title: '删除成功', icon: 'success' });
            // 更新本地数据
            note.replies = note.replies.filter(r => r.id !== reply.id);
          }
        } catch (error) {
          console.error('deleteReply error:', error);
          uni.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    }
  });
};

const showNoteActions = (note) => {
  const noteUserId = note.user_id || note.userId;
  const isMine = String(noteUserId) === String(currentUserId.value);
  const itemList = isMine ? ['编辑', '删除'] : ['举报'];
  
  uni.showActionSheet({
    itemList,
    success: (res) => {
      if (isMine) {
        if (res.tapIndex === 0) {
          editNote(note);
        } else if (res.tapIndex === 1) {
          deleteNote(note);
        }
      } else {
        if (res.tapIndex === 0) {
          uni.showToast({ title: '已举报', icon: 'none' });
        }
      }
    }
  });
};

const toggleFavorite = async () => {
  const state = questionStates.value[currentIndex.value];
  try {
    const res = await medicalApi.toggleMedFavorite({
      questionId: currentQuestion.value.question_id
    });
    if (res.code === 0) {
      state.isFavorite = !state.isFavorite;
      uni.showToast({ title: state.isFavorite ? '收藏成功' : '已取消收藏', icon: 'none' });
    }
  } catch (error) {}
};

const jumpToQuestion = async (index) => {
  if (index >= questions.value.length && hasMore.value) {
    uni.showLoading({ title: '加载中...' });
    while (index >= questions.value.length && hasMore.value) {
      await fetchQuestions(false);
    }
    uni.hideLoading();
  }
  currentIndex.value = index;
  showAnswerSheet.value = false;
};

const getOptionClass = (qIndex, oIndex) => {
  const state = questionStates.value[qIndex];
  const question = questions.value[qIndex];
  if (!state || !question) return '';
  
  const label = String.fromCharCode(65 + oIndex);
  
  if (!state.showAnswer && !settings.value.recitationMode) {
    return (state.userAnswer && state.userAnswer.includes(label)) ? 'selected' : '';
  }
  
  const isCorrect = question.answer.includes(label);
  const isSelected = state.userAnswer.includes(label);
  
  if (isCorrect) return 'correct';
  if (isSelected && !isCorrect) return 'error';
  return '';
};

const isCorrectOption = (question, index) => {
  return question.answer.includes(String.fromCharCode(65 + index));
};

const isSelectedOption = (qIndex, index) => {
  return questionStates.value[qIndex]?.userAnswer.includes(String.fromCharCode(65 + index));
};

const getSheetItemClass = (index) => {
  const state = questionStates.value[index];
  const classes = [];
  
  // 始终标记当前选中的题目
  if (index === currentIndex.value) classes.push('current');
  
  if (!state) return classes.join(' ');
  
  if (state.status === 'correct') classes.push('correct');
  else if (state.status === 'error') classes.push('error');
  else if (state.userAnswer) classes.push('answered');
  
  return classes.join(' ');
};

const formatContent = (text, type = 'explanation', isRich = false) => {
  if (!text) return '';
  
  // 确保 text 是字符串
  let processedHtml = String(text);
  
  // 1. 预处理：规范化换行符
  processedHtml = processedHtml.replace(/\\n/g, '\n');
  
  // 2. 核心解码：多次解码以防止双重编码 (e.g. &amp;lt;p&amp;gt;)
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

  // 3. 处理 Markdown 表格 (西医综合常见)
  if (processedHtml.includes('|') && processedHtml.includes('\n')) {
    const lines = processedHtml.split('\n');
    let tableHtml = '';
    let inTable = false;
    let tableRows = [];

    const newLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        // 跳过分割线 | :--- | :--- |
        if (line.includes('---') || line.includes(':--')) {
          continue;
        }
        const cells = line.split('|').filter(c => c.trim() !== '' || line.indexOf('|' + c + '|') !== -1);
        // 清洗单元格内容
        const cleanCells = cells.map(c => c.trim()).filter((c, idx) => {
          // 过滤掉开头和结尾的空字符串（由 split '|' 产生）
          return true; 
        });
        
        // 重新处理 cells 逻辑，因为 split 会在首尾产生空元素
        const actualCells = line.substring(1, line.length - 1).split('|').map(c => c.trim());
        tableRows.push(actualCells);
      } else {
        if (inTable) {
          // 渲染表格
          let html = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #ddd;">';
          tableRows.forEach((row, rowIndex) => {
            html += '<tr>';
            row.forEach(cell => {
              const tag = rowIndex === 0 ? 'th' : 'td';
              const style = `border: 1px solid #ddd; padding: 8px; text-align: left; ${rowIndex === 0 ? 'background-color: #f2f2f2; font-weight: bold;' : ''}`;
              // 单元格内可能还有加粗等 Markdown
              let cellContent = cell.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
              html += `<${tag} style="${style}">${cellContent}</${tag}>`;
            });
            html += '</tr>';
          });
          html += '</table>';
          newLines.push(html);
          inTable = false;
        }
        if (line) {
          // 处理行内加粗
          let processedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          newLines.push(processedLine);
        } else {
          newLines.push('');
        }
      }
    }
    // 处理最后一个表格
    if (inTable) {
      let html = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #ddd;">';
      tableRows.forEach((row, rowIndex) => {
        html += '<tr>';
        row.forEach(cell => {
          const tag = rowIndex === 0 ? 'th' : 'td';
          const style = `border: 1px solid #ddd; padding: 8px; text-align: left; ${rowIndex === 0 ? 'background-color: #f2f2f2; font-weight: bold;' : ''}`;
          let cellContent = cell.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          html += `<${tag} style="${style}">${cellContent}</${tag}>`;
        });
        html += '</tr>';
      });
      html += '</table>';
      newLines.push(html);
    }
    processedHtml = newLines.join('\n');
  } else {
    // 非表格内容也处理一下加粗
    processedHtml = processedHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  // 处理常用 HTML 实体字符
  processedHtml = processedHtml.replace(/&nbsp;/g, '\u00A0');
  processedHtml = processedHtml.replace(/&mdash;/g, '\u2014');
  processedHtml = processedHtml.replace(/&lsquo;/g, '\u2018');
  processedHtml = processedHtml.replace(/&rsquo;/g, '\u2019');
  processedHtml = processedHtml.replace(/&ldquo;/g, '\u201C');
  processedHtml = processedHtml.replace(/&rdquo;/g, '\u201D');

  // 检查是否为 HTML
  const isHtml = /<[a-z/][\s\S]*>/i.test(processedHtml);
  
  // 统一包裹容器：提供基础样式，但不覆盖内联样式
  const wrapStart = `<div style="text-align: justify; word-break: break-all; margin: 0; padding: 0; line-height: 1.6; color: #333;">`;
  const wrapEnd = `</div>`;

  if (isHtml || isRich) {
    // 仅进行必要的结构清理，避免 rich-text 渲染出多余的空行
    processedHtml = processedHtml.replace(/>\s*\n\s*</g, '><');
    
    // 处理文本中的换行，如果是富文本，通常 \n 应该转为 <br/>
    if (!/<(p|div|br|table)/i.test(processedHtml)) {
      processedHtml = processedHtml.replace(/\n+/g, '<br/>');
    }

    return wrapStart + processedHtml + wrapEnd;
  }
  
  // 3. 纯文本处理
  return wrapStart + processedHtml.trim().replace(/\n+/g, '<br/>') + wrapEnd;
};

const formatTitle = (text) => {
  return formatContent(text, 'title');
};

const formatExplanation = (text) => {
  return formatContent(text, 'explanation');
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

const goBack = () => uni.navigateBack();
const goHome = () => uni.reLaunch({ url: '/pages/index/index' });

const loadUserSettings = () => {
  const saved = uni.getStorageSync('med_user_settings');
  if (saved) settings.value = { ...settings.value, ...JSON.parse(saved) };
};

const saveUserSettings = () => {
  uni.setStorageSync('med_user_settings', JSON.stringify(settings.value));
};

const openCorrection = (question) => {
  showFeedback.value = true;
};

const submitFeedback = async () => {
  if (!feedbackContent.value.trim()) {
    uni.showToast({ title: '请输入反馈内容', icon: 'none' });
    return;
  }
  try {
    const question = currentQuestion.value;
    if (!question) return;
    
    await medicalApi.submitQuestionFeedback({
      questionId: question.question_id,
      type: feedbackType.value,
      content: feedbackContent.value
    });
    
    uni.showToast({ title: '反馈提交成功', icon: 'success' });
    showFeedback.value = false;
    feedbackContent.value = '';
  } catch (error) {
    console.error('提交反馈失败:', error);
    uni.showToast({ title: '提交失败，请重试', icon: 'none' });
  }
};

const toggleRecitation = () => {
  settings.value.recitationMode = !settings.value.recitationMode;
  saveUserSettings();
};

const previewImage = (url) => {
  if (!url) return;
  uni.previewImage({
    urls: [url],
    current: url
  });
};

const formatImageList = (images) => {
  if (!images) return [];
  if (Array.isArray(images)) return images;
  if (typeof images === 'string') {
    if (images.startsWith('[') && images.endsWith(']')) {
      try {
        return JSON.parse(images);
      } catch (e) {
        return images.split(',').map(s => s.trim());
      }
    }
    return images.split(',').map(s => s.trim());
  }
  return [];
};

const playVideo = (url) => {
  if (!url) return;
  // 这里可以根据实际情况实现视频播放逻辑，比如跳转页面或显示弹窗
  uni.showModal({
    title: '视频解析',
    content: '正在跳转至视频解析页面...',
    showCancel: false,
    success: () => {
      // 实际开发中可以使用 uni.navigateTo 或在当前页显示 video 组件
      console.log('Play video:', url);
    }
  });
};
</script>

<style lang="scss" scoped>
.container {
  height: 100vh;
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Times New Roman', Times, serif;
 
  
  &.night-mode {
    background-color: #1a1a1a;
    color: #ccc;
    .question-card, .card-style, .bottom-action-card, .modal-mask .answer-sheet-modal, .modal-mask .settings-modal {
      background-color: #242424;
      color: #ccc;
    }
    .nav-bar { background: #1a1a1a; }
  }
}

.status-bar { width: 100%; }

.nav-bar {
  height: 88rpx;
  background: #4db6ac;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  position: sticky;
  top: 0;
  z-index: 100;
  
  .nav-left {
    display: flex;
    align-items: center;
    width: 160rpx;
    
    .back-btn {
      padding: 10rpx;
    }
    
    .nav-icon-btn {
      margin-left: 10rpx;
      padding: 10rpx;
    }
  }

  .nav-title {
    flex: 1;
    color: #fff;
    font-size: 32rpx;
    font-weight: bold;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nav-right-placeholder {
    width: 160rpx;
  }
}

.progress-section {
  background: #fff;
  padding: 16rpx 24rpx;
  
  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10rpx;
    
    .progress-info-left {
      display: flex;
      gap: 10rpx;
    }
    
    .question-type-tag, .question-number-tag {
      background: #e0f2f1;
      color: #4db6ac;
      padding: 2rpx 10rpx;
      border-radius: 20rpx;
      font-size: 18rpx;
    }
    
    .count-box {
      display: flex;
      align-items: center;
      .current { font-size: 26rpx; font-weight: bold; color: #4db6ac; }
      .total { font-size: 20rpx; color: #999; margin: 0 10rpx 0 4rpx; }
      
      .recitation-toggle {
        padding: 2rpx 10rpx;
        border: 1px solid #4db6ac;
        border-radius: 20rpx;
        font-size: 18rpx;
        color: #4db6ac;
        &.active { background: #4db6ac; color: #fff; }
      }
    }
  }
  
  .progress-bar-bg {
    height: 4rpx;
    background: #f0f0f0;
    border-radius: 2rpx;
    .progress-active {
      height: 100%;
      background: #4db6ac;
      border-radius: 2rpx;
      transition: width 0.3s;
    }
  }

  /* 会员状态提示条 */
  .membership-status-bar {
    display: flex;
    align-items: center;
    padding: 8rpx 20rpx;
    margin-top: 4rpx;
    gap: 12rpx;

    .status-text {
      font-size: 22rpx;
      color: #ff9800;
      white-space: nowrap;
    }

    .status-progress {
      flex: 1;
      height: 8rpx;
      background: #fff3e0;
      border-radius: 4rpx;
      overflow: hidden;

      .status-progress-fill {
        height: 100%;
        background: #ff9800;
        border-radius: 4rpx;
        transition: width 0.3s;
      }
    }

    &.vip-bar {
      background: #e8f5e9;
      border-radius: 12rpx;
      padding: 8rpx 20rpx;

      .vip-icon {
        font-size: 18rpx;
        font-weight: bold;
        color: #4caf50;
        background: #c8e6c9;
        padding: 2rpx 10rpx;
        border-radius: 6rpx;
      }

      .status-text {
        color: #4caf50;
      }
    }
  }
}

.content-area {
  flex: 1;
  height: 0;
}

.swiper-scroll {
  height: 100%;
}

.practice-container {
  padding: 16rpx 24rpx;
}

.question-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.04);
  
  .question-title-wrap {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8rpx;

    .question-number-tag {
      background: #f5f5f5;
      color: #666;
      padding: 4rpx 12rpx;
      border-radius: 6rpx;
      font-size: 22rpx;
      white-space: nowrap;
    }

    .question-score-tag {
      background: #fff8e1;
      color: #ffa000;
      padding: 4rpx 12rpx;
      border-radius: 6rpx;
      font-size: 22rpx;
      white-space: nowrap;
    }

    .question-title {
      flex: 1;
      min-width: 0;
      line-height: 1.6;
      color: #333;
      font-size: 32rpx;
      font-weight: 500;
    }
  }
  
  .question-image-box {
    margin-bottom: 20rpx;
    image { width: 100%; border-radius: 8rpx; }
  }
}

.options-list {
  .option-item {
    display: flex;
    align-items: center;
    padding: 8rpx 20rpx;
    background: #f8f9fa;
    border-radius: 10rpx;
    margin-bottom: 10rpx;
    border: 1rpx solid transparent;
    transition: all 0.2s;
    min-height: 64rpx;
    
    &.selected {
      background: #e0f2f1;
      border-color: #4db6ac;
      .option-label { background: #4db6ac; color: #fff; border-color: #4db6ac; }
    }
    
    &.correct {
      background: #e8f5e9;
      border-color: #4caf50;
      .option-label { background: #4caf50; color: #fff; border-color: #4caf50; }
    }
    
    &.error {
      background: #ffebee;
      border-color: #f44336;
      .option-label { background: #f44336; color: #fff; border-color: #f44336; }
    }
    
    .option-label {
      width: 40rpx;
      height: 40rpx;
      background: #fff;
      border: 1rpx solid #ddd;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22rpx;
      margin-right: 12rpx;
      flex-shrink: 0;
    }
    
    .option-content {
      flex: 1;
      color: #444;
      line-height: 1.4;
      font-size: 26rpx;
    }
    
    .result-icon { margin-left: 8rpx; }
  }
}

.question-report-wrap {
  display: flex;
  justify-content: flex-end;
  .report-btn {
    display: flex;
    align-items: center;
    font-size: 20rpx;
    color: #999;
    padding: 6rpx;
    text { margin-left: 4rpx; }
  }
}

.card-style {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.04);
}

.section-header {
  margin-bottom: 12rpx;
  .section-title {
    display: flex;
    align-items: center;
    .title-line {
      width: 6rpx;
      height: 24rpx;
      background: #4db6ac;
      border-radius: 3rpx;
      margin-right: 10rpx;
    }
    text { font-size: 26rpx; font-weight: bold; color: #333; }
  }
}

.answer-grid {
  display: flex;
  justify-content: space-around;
  .grid-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    .label { font-size: 22rpx; color: #999; margin-bottom: 6rpx; }
    .value {
      font-size: 28rpx;
      font-weight: bold;
      &.correct { color: #4caf50; }
      &.error { color: #f44336; }
      &.score { color: #ffb74d; }
    }
  }
}

.explanation-content {
  line-height: 1.6;
  color: #555;
  font-size: 26rpx;
}

.analysis-image-box {
  margin-top: 16rpx;
  image {
    width: 100%;
    border-radius: 8rpx;
  }
  .multi-image-item {
    margin-bottom: 12rpx;
    &:last-child { margin-bottom: 0; }
  }
}

.video-placeholder {
  margin-top: 16rpx;
  background: #f5fcfb;
  border: 1px dashed #4db6ac;
  border-radius: 12rpx;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  
  text {
    font-size: 24rpx;
    color: #4db6ac;
  }
}

.comparison-summary-box {
  margin-top: 16rpx;
  background-color: #f9f9f9;
  padding: 20rpx;
  border-radius: 8rpx;
  line-height: 1.6;
  color: #444;
  font-size: 26rpx;
}

.knowledge-image-box {
  image { width: 100%; border-radius: 8rpx; }
}

.notes-section {
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #f0f0f0;

  .ad-container {
    margin-bottom: 20rpx;
    width: 100%;
  }

  .notes-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;

    .section-title {
      display: flex;
      align-items: center;
      .title-line {
        width: 6rpx;
        height: 24rpx;
        background-color: #4db6ac;
        margin-right: 10rpx;
        border-radius: 3rpx;
      }
      text {
        font-size: 28rpx;
        font-weight: bold;
        color: #333;
      }
    }

    .add-note-btn {
      display: flex;
      align-items: center;
      background-color: #4db6ac;
      padding: 6rpx 16rpx;
      border-radius: 30rpx;
      color: #fff;
      font-size: 22rpx;
      
      text {
        margin-left: 4rpx;
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
    margin-bottom: 12rpx;

    .notes-tabs {
      display: flex;
      background-color: #f5f7fa;
      padding: 4rpx;
      border-radius: 30rpx;

      .tab-item {
        padding: 4rpx 20rpx;
        font-size: 22rpx;
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
      font-size: 22rpx;
      color: #999;
      
      .sort-icon {
        margin-left: 4rpx;
        display: flex;
        align-items: center;
      }
    }
  }

  .notes-list {
    .note-item {
      display: flex;
      padding: 16rpx 0;
      border-bottom: 1rpx solid #f5f5f5;
      &:last-child { border-bottom: none; }

      .note-left {
        flex-shrink: 0;
        margin-right: 16rpx;
        
        .user-avatar {
          width: 56rpx;
          height: 56rpx;
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
          margin-bottom: 8rpx;

          .username {
            font-size: 24rpx;
            color: #666;
            font-weight: 500;
          }

          .more-btn {
            padding: 2rpx;
            &:active { opacity: 0.7; }
          }
        }

        .note-content {
          font-size: 26rpx;
          color: #333;
          line-height: 1.5;
          margin-bottom: 12rpx;
          word-break: break-all;
        }

        .note-replies-container {
          margin-bottom: 12rpx;
          
          .reply-toggle {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding: 4rpx 0;
            margin-bottom: 6rpx;
            
            text {
              font-size: 22rpx;
              color: #4db6ac;
              font-weight: 500;
            }
            
            .toggle-icon {
              margin-left: 4rpx;
              display: flex;
              align-items: center;
              color: #4db6ac;
              transition: transform 0.3s;
              
              &.rotated {
                transform: rotate(180deg);
              }
            }
          }
          
          .note-replies {
            background-color: #f8f9fa;
            padding: 12rpx 16rpx;
            border-radius: 10rpx;
            
            .reply-item {
              font-size: 22rpx;
              margin-bottom: 4rpx; // 减小回复项之间的间距
              line-height: 1.4;
              display: flex; // 使用 flex 布局
              align-items: flex-start; // 对齐顶部
              
              &:last-child { margin-bottom: 0; }
              
              .reply-user { 
                color: #4db6ac; 
                font-weight: 500; 
                margin-right: 8rpx;
                white-space: nowrap; // 确保用户名不换行
              }
              
              .reply-content { 
                color: #555;
                flex: 1; // 占据剩余空间
                word-break: break-all;
                display: inline; // 确保内容紧随用户名
              }

              .delete-reply-btn {
                color: #f44336;
                font-size: 20rpx;
                margin-left: 12rpx;
                flex-shrink: 0;
                opacity: 0.8;
                &:active { opacity: 1; }
              }
            }
          }
        }

        .reply-input-box {
          margin-bottom: 16rpx;
          .reply-textarea {
            width: 100%;
            min-height: 70rpx;
            background-color: #f9f9f9;
            border: 1rpx solid #eee;
            border-radius: 10rpx;
            padding: 12rpx;
            font-size: 24rpx;
            box-sizing: border-box;
          }
          .reply-btns {
            display: flex;
            justify-content: flex-end;
            margin-top: 8rpx;
            text {
              font-size: 22rpx;
              padding: 6rpx 24rpx;
              border-radius: 30rpx;
              margin-left: 12rpx;
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
            font-size: 20rpx;
            color: #bbb;

            .reply-link {
              margin-left: 16rpx;
              color: #4db6ac;
              font-size: 22rpx;
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
              margin-left: 24rpx;
              font-size: 22rpx;
              color: #999;

              text {
                margin-left: 4rpx;
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
      padding: 40rpx 0;
      text-align: center;
      font-size: 22rpx;
      color: #bbb;
    }

    .expand-notes-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16rpx 0;
      color: #4db6ac;
      font-size: 22rpx;
      border-top: 1rpx solid #f5f5f5;
      
      .toggle-icon {
        margin-left: 6rpx;
        transition: transform 0.3s ease;
        display: flex;
        align-items: center;
        
        &.rotated {
          transform: rotate(180deg);
        }
      }
    }
  }
}

.confirm-btn-wrap {
  margin-top: 30rpx;
  .main-action-btn {
    background: #4db6ac;
    color: #fff;
    border-radius: 44rpx;
    height: 80rpx;
    line-height: 80rpx;
    font-size: 30rpx;
    font-weight: bold;
    &::after { border: none; }
  }
}

.bottom-action-card {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  box-shadow: 0 -2rpx 20rpx rgba(0,0,0,0.05);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: 30rpx;
  padding-right: 30rpx;
  z-index: 99;
  
  .action-item {
    display: flex;
    align-items: center;
    padding: 8rpx 16rpx;
    margin-right: 20rpx;
    .num {
      font-size: 26rpx;
      font-weight: bold;
      margin-left: 6rpx;
      &.success { color: #4caf50; }
      &.danger { color: #f44336; }
    }
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

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.6);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  
  .answer-sheet-modal, .settings-modal, .note-modal {
    width: 100%;
    background: #fff;
    border-radius: 30rpx 30rpx 0 0;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    
    .modal-header {
      padding: 30rpx;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1rpx solid #eee;
      text { font-size: 32rpx; font-weight: bold; }
      .close { font-size: 40rpx; color: #999; padding: 10rpx; }
    }
  }
}

.sheet-content {
    height: 70vh; 
    width: 100%;
    padding: 15rpx;
    box-sizing: border-box;
    overflow-y: auto;
    .sheet-grid {
      display: flex;
      flex-wrap: wrap;
      width: 100%;
      box-sizing: border-box;
      .sheet-item {
        width: 11%;
        margin: 0.75%;
        aspect-ratio: 1;
        border: 1rpx solid #ddd;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22rpx;
        color: #666;
        box-sizing: border-box;
        margin-bottom: 15rpx;
      
      &.answered { background: #e0f2f1; color: #4db6ac; border-color: #4db6ac; }
      &.correct { background: #e8f5e9; color: #4caf50; border-color: #4caf50; }
      &.error { background: #ffebee; color: #f44336; border-color: #f44336; }
    }
  }
}

.settings-content {
  padding: 30rpx;
  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 30rpx 0;
    border-bottom: 1rpx solid #f5f5f5;
    text { font-size: 30rpx; color: #333; }
    
    &.column {
      flex-direction: column;
      align-items: flex-start;
      .label { margin-bottom: 20rpx; }
    }
  }
}

.font-size-levels {
  display: flex;
  width: 100%;
  justify-content: space-between;
  .level-item {
    flex: 1;
    text-align: center;
    padding: 15rpx 0;
    background: #f5f7fa;
    margin: 0 10rpx;
    border-radius: 8rpx;
    font-size: 26rpx;
    color: #666;
    &.active { background: #4db6ac; color: #fff; }
  }
}

.note-modal-content {
  padding: 30rpx;
  .note-textarea {
    width: 100%;
    height: 300rpx;
    background: #f8f9fa;
    border-radius: 16rpx;
    padding: 20rpx;
    box-sizing: border-box;
    font-size: 28rpx;
    margin-bottom: 30rpx;
  }
  .note-options {
    margin-bottom: 40rpx;
    .public-toggle {
      display: flex;
      align-items: center;
      color: #4db6ac;
      font-size: 26rpx;
      text { margin-left: 10rpx; }
    }
  }
  .submit-note-btn {
    background: #4db6ac;
    color: #fff;
    border-radius: 44rpx;
    &::after { border: none; }
  }
}

.animated {
  animation-duration: 0.3s;
  animation-fill-mode: both;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translate3d(0, 100%, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

.fadeInUp { animation-name: fadeInUp; }

.loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400rpx;
  color: #999;
  font-size: 28rpx;
  .loading-icon {
    width: 60rpx;
    height: 60rpx;
    border: 4rpx solid #f3f3f3;
    border-top: 4rpx solid #4db6ac;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20rpx;
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
/* 笔记操作菜单 */
/* 视频容器 */
.video-container {
  width: 100%;
  margin-top: 20rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background: #000;
  .analysis-video {
    width: 100%;
    height: 400rpx;
  }
}

/* 弹窗底部按钮修复 */
.note-modal-footer {
  display: flex;
  gap: 20rpx;
  margin-top: 20rpx;
  button {
    flex: 1; // 按钮等宽
    margin: 0;
    font-size: 28rpx;
    height: 80rpx; // 统一高度
    line-height: 80rpx;
    border-radius: 40rpx;
    &::after { border: none; }
    &.cancel-btn { background: #f5f5f5; color: #666; }
    &.submit-btn { background: #4db6ac; color: #fff; }
  }
}

/* 纠错弹窗样式 */
.feedback-modal {
  width: 100%;
  background: #fff;
  border-radius: 30rpx 30rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  
  .modal-header {
    padding: 30rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1rpx solid #eee;
    text { font-size: 32rpx; font-weight: bold; }
    .close { font-size: 40rpx; color: #999; padding: 10rpx; }
  }
  
  .feedback-content {
    padding: 30rpx;
    
    .feedback-type-list {
      display: flex;
      flex-wrap: wrap;
      gap: 20rpx;
      margin-bottom: 30rpx;
      
      .type-item {
        padding: 12rpx 30rpx;
        background: #f5f5f5;
        border-radius: 30rpx;
        font-size: 26rpx;
        color: #666;
        border: 1rpx solid transparent;
        
        &.active {
          background: #e0f2f1;
          color: #4db6ac;
          border-color: #4db6ac;
        }
      }
    }
    
    .feedback-textarea {
      width: 100%;
      height: 240rpx;
      background: #f8f9fa;
      border-radius: 16rpx;
      padding: 20rpx;
      box-sizing: border-box;
      font-size: 28rpx;
      margin-bottom: 30rpx;
    }
    
    .feedback-footer {
      display: flex;
      gap: 20rpx;
      
      button {
        flex: 1;
        height: 88rpx;
        line-height: 88rpx;
        border-radius: 44rpx;
        font-size: 30rpx;
        &::after { border: none; }
        
        &.cancel-btn {
          background: #f5f5f5;
          color: #666;
        }
        
        &.submit-btn {
          background: #4db6ac;
          color: #fff;
        }
      }
    }
  }
}

// 相关学习资料通知栏
.related-articles-section {
  margin: 4rpx 0;
  overflow: hidden;
  background-color: rgba(77, 182, 172, 0.05);
  border-radius: 8rpx;
  border: 1rpx solid rgba(77, 182, 172, 0.08);
  
  .article-carousel {
    height: 40rpx;
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
          font-size: 16rpx;
          color: #00897b;
          font-weight: bold;
          margin-right: 10rpx;
          flex-shrink: 0;
          background: transparent;
          padding: 0;
          &.hot {
            color: #ff5252;
            background: transparent;
          }
        }
        
        .article-title {
          flex: 1;
          font-size: 26rpx;
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
</style>
