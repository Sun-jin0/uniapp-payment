<template>
  <view class="checkin-category">
    <!-- 顶部背景 -->
    <view class="header-bg">
      <view class="header-content">
        <text class="category-title">{{ categoryName }}</text>
        <view class="stats-row">
          <text class="stats-text">{{ canPreRegister ? (preRegisterCount || 0) : joinCount }} 人{{ canPreRegister ? '报名' : '参加' }}</text>
          <text class="stats-divider">|</text>
          <text class="stats-text">{{ checkinCount }} 次打卡</text>
        </view>
        <view class="time-info" v-if="categoryStartTime || categoryEndTime">
          <image class="time-icon" src="/static/icons/clock.png" mode="aspectFit" />
          <text class="time-text" v-if="categoryStartTime && !categoryEndTime">开始: {{ formatDateTime(categoryStartTime) }}</text>
          <text class="time-text" v-else-if="!categoryStartTime && categoryEndTime">截止: {{ formatDateTime(categoryEndTime) }}</text>
          <text class="time-text" v-else>{{ formatDateTime(categoryStartTime) }} ~ {{ formatDateTime(categoryEndTime) }}</text>
        </view>
        <view class="header-btns">
          <view class="invite-btn" @click="inviteFriend">
            <text class="invite-text">邀请好友</text>
          </view>
          <view class="pre-register-btn" v-if="canPreRegister && !isPreRegistered" @click="doPreRegister">
            <text class="pre-text">预报名</text>
          </view>
          <view class="pre-registered-btn" v-if="canPreRegister && isPreRegistered" @click="doPreRegister">
            <text class="pre-text">取消报名</text>
          </view>
          <view class="checkin-btn" v-if="canCheckin" @click="showCheckinModal">
            <text class="pre-text">打卡</text>
          </view>
          <view class="checked-in-btn" v-if="hasCheckedInToday">
            <text class="pre-text">今日已打卡</text>
          </view>
          <view class="ended-btn" v-if="isEnded">
            <text class="pre-text">已结束</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Tab切换 -->
    <view class="tab-bar">
      <view class="tab-slider" :style="{ 
        transform: currentTab === 'dynamic' ? 'translateX(0)' : 'translateX(172rpx)'
      }"></view>
      <view 
        class="tab-item" 
        :class="{ active: currentTab === 'dynamic' }"
        @click="currentTab = 'dynamic'"
      >
        <text class="tab-text">成员动态</text>
      </view>
      <view 
        class="tab-item" 
        :class="{ active: currentTab === 'mine' }"
        @click="currentTab = 'mine'"
      >
        <text class="tab-text">我的打卡</text>
      </view>
      <view class="sort-btn" @click="toggleSort">
        <image 
          class="sort-icon" 
          :class="{ 'sort-asc': sortOrder === 'asc' }"
          src="/static/icons/paixu.png" 
          mode="aspectFit" 
        />
        <text class="sort-text">{{ sortOrder === 'desc' ? '倒序' : '正序' }}</text>
      </view>
    </view>

    <!-- 成员动态 -->
    <view class="dynamic-list" v-if="currentTab === 'dynamic'">
      <template v-for="(item, index) in dynamics" :key="item.id">
        <view class="dynamic-item">
        <view class="user-info">
          <image 
            v-if="item.avatar" 
            class="user-avatar-img" 
            :src="String(item.avatar)" 
            mode="aspectFill"
          />
          <view v-else class="user-avatar" :style="{ background: item.avatarColor }">
            <text class="avatar-text">{{ (item.nickname || '用户').charAt(0) }}</text>
          </view>
          <view class="user-meta">
            <view class="user-header">
              <text class="user-name">{{ item.nickname || '用户' }}</text>
              <text class="checkin-info">第{{ item.day }}天打卡 | 已坚持{{ item.totalDays }}天</text>
            </view>
          </view>
          <view v-if="isAdmin" class="admin-delete-btn" @click="adminDeleteRecord(item)">
            <image class="delete-icon-small" src="/static/icons/shanchu.png" mode="aspectFit" />
          </view>
        </view>
        <view class="dynamic-content">
          <text class="dynamic-text">{{ item.content }}</text>
          <view class="dynamic-images" v-if="item.images && item.images.filter(img => img && String(img).trim()).length > 0">
            <image 
              v-for="(img, idx) in item.images.filter(img => img && String(img).trim())" 
              :key="idx"
              class="dynamic-image" 
              :src="String(img)" 
              mode="aspectFill"
              @click="previewImage(item.images.filter(img => img && String(img).trim()), idx)"
            />
          </view>
        </view>
        <view class="dynamic-footer">
          <text class="dynamic-time">{{ formatDynamicTime(item.time) }}</text>
          <view class="action-btns">
            <view class="action-btn" @click="likeDynamic(item)">
              <image 
                class="heart-icon" 
                :src="item.isLiked ? '/static/icons/like-full.png' : '/static/icons/like.png'" 
                mode="aspectFit" 
              />
              <text class="action-count">{{ item.likeCount }}</text>
            </view>
            <view class="action-btn" @click="commentDynamic(item)">
              <image class="comment-icon" src="/static/icons/pinglun.png" mode="aspectFit" />
              <text class="action-count">{{ item.commentCount || (item.comments ? item.comments.length : 0) }}</text>
            </view>
          </view>
        </view>
        </view>
      </template>
    </view>

    <!-- 我的打卡 -->
    <scroll-view 
      v-if="currentTab === 'mine'" 
      class="content-scroll tab-content-enter" 
      scroll-y
    >
      <view class="my-stats">
        <view class="stat-item">
          <text class="stat-num">{{ myConsecutiveDays }}</text>
          <text class="stat-label">打卡次数</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ myTotalCheckins }}</text>
          <text class="stat-label">累计打卡天数</text>
        </view>
      </view>
      <!-- 朋友圈样式时间线 -->
      <view class="timeline-list">
        <view class="timeline-group" v-for="group in groupedMyRecords" :key="group.date">
          <!-- 日期头部 - 垂直排列 -->
          <view class="timeline-header">
            <view class="date-node">
              <text class="date-day">{{ group.day }}</text>
              <text class="date-month">{{ group.month }}月</text>
            </view>
            <view class="date-tag-below">
              <text class="date-tag-text">{{ group.displayDate }}</text>
            </view>
          </view>
          <!-- 该日期的打卡记录 -->
          <view class="timeline-records">
            <view class="timeline-card" v-for="record in group.records" :key="record.id">
              <view class="card-header">
                <text class="card-time">{{ formatTime(record.time) }}</text>
                <text class="card-title" v-if="record.title">{{ record.title }}</text>
              </view>
              <text class="card-content">{{ record.content }}</text>
              <view class="card-images" v-if="record.images && record.images.filter(img => img && String(img).trim()).length > 0">
                <image 
                  v-for="(img, idx) in record.images.filter(img => img && String(img).trim())" 
                  :key="idx"
                  class="card-image" 
                  :class="{ 'single-image': record.images.filter(img => img && String(img).trim()).length === 1, 'multi-image': record.images.filter(img => img && String(img).trim()).length > 1 }"
                  :src="String(img)" 
                  mode="aspectFill"
                  @click="previewImage(record.images.filter(img => img && String(img).trim()), idx)"
                />
              </view>
              <view class="card-footer">
                <text class="card-task">{{ record.taskName }}</text>
                <view class="card-actions">
                  <view class="action-icon-btn edit-icon-btn" @click="editRecord(record)">
                    <image class="record-action-icon" src="https://img.icons8.com/ios/50/999999/pencil.png" mode="aspectFit" />
                  </view>
                  <view class="action-icon-btn delete-icon-btn" @click="deleteRecord(record)">
                    <image class="record-action-icon" src="/static/icons/shanchu.png" mode="aspectFit" />
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 底部打卡按钮 -->
    <view class="bottom-bar" v-if="canCheckin || isEnded || hasCheckedInToday">
      <view v-if="canCheckin" class="checkin-float-btn" @click="showCheckinModal">
        <image class="check-icon" src="/static/icons/daka.png" mode="aspectFit" />
        <text class="btn-label">打卡</text>
      </view>
      <view v-else-if="hasCheckedInToday" class="checkin-float-btn checked-in">
        <image class="check-icon" src="/static/icons/daka.png" mode="aspectFit" />
        <text class="btn-label">今日已打卡</text>
      </view>
      <view v-else-if="isEnded" class="checkin-float-btn ended">
        <image class="check-icon" src="https://img.icons8.com/ios/50/ffffff/time-out.png" mode="aspectFit" />
        <text class="btn-label">已结束</text>
      </view>
    </view>

    <!-- 打卡弹窗 -->
    <view class="modal" v-if="showModal" @click="closeModal">
      <view class="modal-content" @click.stop>
        <!-- 固定头部 -->
        <view class="modal-header">
          <text class="modal-title">今日打卡</text>
          <view class="close-btn" @click="closeModal">
            <image class="close-icon" src="/static/icons/close.png" mode="aspectFit" />
          </view>
        </view>
        
        <!-- 可滚动内容区 -->
        <scroll-view class="modal-body" scroll-y>
          <!-- 打卡类型选择 -->
          <view class="checkin-type-section">
            <text class="section-label">打卡类型</text>
            <view class="checkin-type-options">
              <view 
                :class="['type-option', checkinType === 'normal' ? 'active' : '']" 
                @click="checkinType = 'normal'"
              >
                <image class="type-icon" src="https://img.icons8.com/ios/50/FF8C42/edit.png" mode="aspectFit" />
                <text class="type-text">普通打卡</text>
              </view>
              <view 
                :class="['type-option', checkinType === 'questions' ? 'active' : '']" 
                @click="selectQuestionCheckin"
              >
                <image class="type-icon" src="https://img.icons8.com/ios/50/2196f3/pencil.png" mode="aspectFit" />
                <text class="type-text">做题打卡</text>
                <text v-if="todayQuestions > 0" class="type-badge">{{ todayQuestions }}题</text>
              </view>
            </view>
          </view>
          
          <!-- 标题输入 -->
          <view class="form-item">
            <view class="form-header">
              <text class="form-label">打卡标题</text>
              <text class="char-count">{{ (checkinTitle || '').length }}/30</text>
            </view>
            <input 
              class="title-input" 
              :value="checkinTitle"
              @input="checkinTitle = $event.detail.value"
              placeholder="请输入打卡标题（选填）"
              maxlength="30"
            />
          </view>
          
          <!-- 内容输入区域 -->
          <view class="form-item">
            <view class="form-header">
              <text class="form-label">打卡内容</text>
              <text class="char-count">{{ (checkinContent || '').length }}/500</text>
            </view>
            <textarea 
              class="content-input" 
              :value="checkinContent"
              @input="checkinContent = $event.detail.value"
              placeholder="记录今天的学习心得，分享你的进步..."
              maxlength="500"
              auto-height
            />
          </view>
          
          <!-- 图片上传区域 -->
          <view class="upload-section">
            <view class="upload-header">
              <text class="upload-label">添加图片</text>
              <text class="upload-hint">{{ checkinImages.length }}/9</text>
            </view>
            <view class="image-upload">
              <view class="upload-item" v-for="(img, idx) in checkinImages" :key="idx">
                <image class="upload-img" :src="String(img || '')" mode="aspectFill" />
                <view class="delete-img" @click="checkinImages.splice(idx, 1)">
                  <image class="delete-icon" src="/static/icons/close.png" mode="aspectFit" />
                </view>
              </view>
              <view class="upload-add" @click="chooseImage" v-if="checkinImages.length < 9">
                <image class="plus-icon" src="/static/icons/plus.png" mode="aspectFit" />
                <text class="upload-text">添加</text>
              </view>
            </view>
          </view>
        </scroll-view>
        
        <!-- 固定底部提交按钮 -->
        <view class="submit-section">
          <button class="submit-btn" @click="submitCheckin">提交打卡</button>
        </view>
      </view>
    </view>
  </view>

  <!-- 评论弹窗 -->
  <view class="modal" v-if="showCommentModal" @click="closeCommentModal">
    <view class="modal-content comment-modal" @click.stop>
      <view class="modal-header">
        <text class="modal-title">评论</text>
        <view class="close-btn" @click="closeCommentModal">
          <image class="close-icon" src="/static/icons/close.png" mode="aspectFit" />
        </view>
      </view>
      
      <scroll-view class="comment-body" scroll-y>
        <view class="comment-list" v-if="currentCommentItem && currentCommentItem.comments && currentCommentItem.comments.length > 0">
          <view class="comment-item" v-for="comment in currentCommentItem.comments" :key="comment.id">
            <image 
              v-if="comment.avatar" 
              class="comment-avatar-img" 
              :src="String(comment.avatar)" 
              mode="aspectFill"
            />
            <view v-else class="comment-avatar" :style="{ background: getAvatarColor(comment.nickname) }">
              <text class="comment-avatar-text">{{ (comment.nickname || '用户').charAt(0) }}</text>
            </view>
            <view class="comment-content">
              <view class="comment-header">
                <text class="comment-nickname">{{ comment.nickname || '用户' }}</text>
                <view class="comment-header-right">
                  <text class="comment-time">{{ comment.time }}</text>
                  <view class="comment-more-btn" @click="toggleCommentActions(comment)" v-if="String(comment.userId) === String(currentUserId) || isAdmin">
                    <image class="more-icon" src="https://img.icons8.com/ios/50/999999/more.png" mode="aspectFit" />
                  </view>
                </view>
              </view>
              <!-- 编辑状态 -->
              <view v-if="editingCommentId === comment.id" class="comment-edit-box">
                <textarea 
                  class="comment-edit-input"
                  :value="editCommentContent"
                  @input="editCommentContent = $event.detail.value"
                  placeholder="请输入评论内容..."
                  maxlength="200"
                  auto-height
                />
                <view class="comment-edit-btns">
                  <text class="edit-cancel" @click="cancelEditComment">取消</text>
                  <text class="edit-confirm" @click="submitEditComment">保存</text>
                </view>
              </view>
              <!-- 正常显示 -->
              <text v-else class="comment-text">{{ comment.content }}</text>
              <!-- 操作按钮 -->
              <view v-if="showActionsCommentId === comment.id && editingCommentId !== comment.id" class="comment-actions">
                <view v-if="String(comment.userId) === String(currentUserId)" class="action-item" @click="startEditComment(comment)">
                  <image class="action-icon" src="https://img.icons8.com/ios/50/999999/pencil.png" mode="aspectFit" />
                  <text class="action-text">修改</text>
                </view>
                <view class="action-item delete" @click="deleteComment(comment.id)">
                  <image class="action-icon" src="/static/icons/shanchu.png" mode="aspectFit" />
                  <text class="action-text delete-text">删除</text>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view class="empty-comment" v-else>
          <text class="empty-text">暂无评论，快来抢沙发吧~</text>
        </view>
      </scroll-view>
      
      <view class="comment-input-bar">
        <input 
          class="comment-input" 
          :value="commentContent"
          @input="commentContent = $event.detail.value"
          placeholder="说点什么..."
          maxlength="200"
        />
        <view class="comment-submit-btn" @click="submitComment">
          <text class="submit-text">发送</text>
        </view>
      </view>
    </view>
  </view>

  <!-- 编辑弹窗 -->
  <view class="modal" v-if="showEditModal" @click="closeEditModal">
    <view class="modal-content edit-modal" @click.stop>
      <view class="modal-header">
        <text class="modal-title">编辑打卡</text>
        <view class="close-btn" @click="closeEditModal">
          <image class="close-icon" src="/static/icons/close.png" mode="aspectFit" />
        </view>
      </view>
      
      <scroll-view class="modal-body" scroll-y>
        <view class="form-item">
          <view class="form-header">
            <text class="form-label">打卡标题</text>
            <text class="char-count">{{ (editTitle || '').length }}/30</text>
          </view>
          <input 
            class="title-input" 
            :value="editTitle"
            @input="editTitle = $event.detail.value"
            placeholder="请输入打卡标题（选填）"
            maxlength="30"
          />
        </view>
        
        <view class="form-item">
          <view class="form-header">
            <text class="form-label">打卡内容</text>
            <text class="char-count">{{ (editContent || '').length }}/500</text>
          </view>
          <textarea 
            class="content-input" 
            :value="editContent"
            @input="editContent = $event.detail.value"
            placeholder="修改你的打卡内容..."
            maxlength="500"
            auto-height
          />
        </view>
        
        <view class="upload-section">
          <view class="upload-header">
            <text class="upload-label">添加图片</text>
            <text class="upload-hint">{{ editImages.length }}/9</text>
          </view>
          <view class="image-upload">
            <view class="upload-item" v-for="(img, idx) in editImages" :key="idx">
              <image class="upload-img" :src="String(img || '')" mode="aspectFill" />
              <view class="delete-img" @click="editImages.splice(idx, 1)">
                <image class="delete-icon" src="/static/icons/close.png" mode="aspectFit" />
              </view>
            </view>
            <view class="upload-add" @click="chooseEditImage" v-if="editImages.length < 9">
              <image class="plus-icon" src="/static/icons/plus.png" mode="aspectFit" />
              <text class="upload-text">添加</text>
            </view>
          </view>
        </view>
      </scroll-view>
      
      <view class="submit-section">
        <button class="submit-btn" @click="submitEdit">保存修改</button>
      </view>
    </view>
  </view>

  <!-- 生成打卡图弹窗 -->
  <view class="modal" v-if="showShareCardModal" @click="closeShareCardModal">
    <view class="modal-content share-card-modal" @click.stop>
      <view class="modal-header">
        <text class="modal-title">打卡成就</text>
        <view class="close-btn" @click="closeShareCardModal">
          <image class="close-icon" src="/static/icons/close.png" mode="aspectFit" />
        </view>
      </view>
      
      <view class="share-card-body">
        <view class="share-card-container" ref="shareCardRef">
          <image class="share-card-bg" :src="SHARE_CARD_BG" mode="aspectFill" />
          <view class="ticket-header">
            <text class="ticket-brand">QUIZ MASTER</text>
            <text class="ticket-date">{{ formatDateTime(new Date()) }}</text>
            <view class="ticket-route">
              <text class="route-from">今日</text>
              <view class="route-plane">
                <text class="plane-line"></text>
                <text class="plane-icon">✈</text>
                <text class="plane-line"></text>
              </view>
              <text class="route-to">打卡</text>
            </view>
          </view>
          
          <view class="ticket-divider">
            <view class="divider-circle left"></view>
            <view class="divider-dash"></view>
            <view class="divider-circle right"></view>
          </view>
          
          <view class="ticket-bottom">
            <view class="ticket-body">
              <view class="ticket-section">
                <text class="section-label">做题数量</text>
                <view class="section-value-row">
                  <text class="section-value">{{ todayQuestions }}</text>
                  <text class="section-unit">题</text>
                </view>
              </view>
              
              <view class="ticket-divider-vertical"></view>
              
              <view class="ticket-section">
                <text class="section-label">累计打卡</text>
                <view class="section-value-row">
                  <text class="section-value">{{ myTotalCheckins }}</text>
                  <text class="section-unit">天</text>
                </view>
              </view>
            </view>
            
            <view class="ticket-footer">
              <text class="ticket-slogan">坚持每一天，进步看得见</text>
            </view>
          </view>
        </view>
      </view>
      
      <!-- 隐藏的 canvas 用于小程序生成图片 -->
      <canvas id="checkinCanvas" type="2d" class="hidden-canvas"></canvas>
      
      <view class="submit-section">
        <button class="submit-btn share-btn" @click="shareCard" :disabled="isGenerating || !generatedShareImage">
          <text class="btn-icon">📤</text>
          <text>分享打卡</text>
        </button>
        <button class="submit-btn" @click="publishCheckin" :disabled="isGenerating">{{ isGenerating ? '生成中...' : '发布打卡' }}</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import request, { BASE_URL } from '../../api/request.js';
import * as htmlToImage from 'html-to-image';
import { checkTextContent, checkImageContent } from '../../utils/contentSecurity.js';

// 微信小程序分享配置
// #ifdef MP-WEIXIN
uni.showShareMenu({
  withShareTicket: true,
  menus: ['shareAppMessage', 'shareTimeline']
});
// #endif

const compressImage = (tempFilePath) => {
  return new Promise((resolve, reject) => {
    // #ifdef H5
    resolve(tempFilePath);
    // #endif
    // #ifndef H5
    uni.compressImage({
      src: tempFilePath,
      quality: 70,
      success: (res) => {
        resolve(res.tempFilePath);
      },
      fail: (err) => {
        console.error('压缩图片失败:', err);
        resolve(tempFilePath);
      }
    });
    // #endif
  });
};

const uploadImage = (tempFilePath) => {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token') || '';
    const uploadUrl = BASE_URL + '/upload/image';
    
    console.log('上传图片URL:', uploadUrl);
    console.log('上传文件路径:', tempFilePath);
    
    uni.uploadFile({
      url: uploadUrl,
      filePath: tempFilePath,
      name: 'image',
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (uploadRes) => {
        console.log('上传响应:', uploadRes);
        try {
          const res = JSON.parse(uploadRes.data);
          if (res.code === 0) {
            console.log('上传成功，URL:', res.data.url);
            resolve(res.data.url);
          } else {
            console.error('上传失败:', res.message);
            reject(new Error(res.message || '上传失败'));
          }
        } catch (e) {
          console.error('解析响应失败:', e);
          reject(e);
        }
      },
      fail: (err) => {
        console.error('上传请求失败:', err);
        reject(err);
      }
    });
  });
};

const categoryId = ref('');
const categoryName = ref('');
const joinCount = ref(0);
const checkinCount = ref(0);
const currentTab = ref('dynamic');
const sortOrder = ref('desc');
const showModal = ref(false);
const checkinTitle = ref('');
const checkinContent = ref('');
const checkinImages = ref([]);
const loading = ref(false);
const checkinType = ref('normal');
const todayQuestions = ref(0);
const isAdmin = ref(false);

const categoryStartTime = ref(null);
const categoryEndTime = ref(null);
const preRegisterCount = ref(0);
const isPreRegistered = ref(false);
const hasCheckedInToday = ref(false);

const showCommentModal = ref(false);
const currentCommentItem = ref(null);
const commentContent = ref('');
const currentUserId = ref(uni.getStorageSync('userId') || '');
const editingCommentId = ref(null);
const editCommentContent = ref('');
const showActionsCommentId = ref(null);

const dynamics = ref([]);
const myConsecutiveDays = ref(0);
const myTotalCheckins = ref(0);
const myRecords = ref([]);

// 打卡图分享相关
const showShareCardModal = ref(false);
const shareCardRef = ref(null);
const generatedShareImage = ref(''); // 存储生成的分享图片
const SHARE_CARD_BG = 'https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1776494672794-73xpv5.jpg';

// 分享配置
const shareConfig = computed(() => {
  // 根据做题数量生成不同的激励文案
  const questions = todayQuestions.value || 0;
  const days = myTotalCheckins.value || 0;
  
  let title = '';
  let desc = '';
  
  if (questions >= 50) {
    title = `🔥 今日刷题 ${questions} 题，战斗力爆表！`;
    desc = `我在 ${categoryName.value || '打卡'} 坚持学习，已累计打卡 ${days} 天！💪 一起加入，成就更好的自己！`;
  } else if (questions >= 20) {
    title = `📚 今日刷题 ${questions} 题，进步看得见！`;
    desc = `坚持打卡第 ${days} 天，每一题都是向梦想迈进的一步！✨ 一起来学习吧！`;
  } else if (questions >= 10) {
    title = `✅ 今日刷题 ${questions} 题， steadily进步中~`;
    desc = `积少成多，已累计打卡 ${days} 天！🌟 坚持就是胜利，你也来试试吧！`;
  } else if (questions > 0) {
    title = `📝 今日刷题 ${questions} 题，开启学习模式！`;
    desc = `打卡第 ${days} 天，每天进步一点点！🎯 一起来打卡学习吧！`;
  } else {
    title = `🎯 我在 ${categoryName.value || '学习打卡'} 坚持学习！`;
    desc = `已累计打卡 ${days} 天，坚持每一天，进步看得见！💪 一起加入吧！`;
  }
  
  // 连续打卡加成
  if (myConsecutiveDays.value >= 7) {
    title = `🏆 连续打卡 ${myConsecutiveDays.value} 天！` + title;
  } else if (myConsecutiveDays.value >= 3) {
    title = `🔥 连续 ${myConsecutiveDays.value} 天！` + title;
  }
  
  const path = `/pages/checkin/checkin-category?id=${categoryId.value}&name=${encodeURIComponent(categoryName.value || '打卡')}`;
  
  return {
    title,
    desc,
    path,
    imageUrl: generatedShareImage.value || SHARE_CARD_BG
  };
});

// 微信小程序分享配置 - 直接定义在全局作用域
// #ifdef MP-WEIXIN
// 使用 defineExpose 暴露分享函数给小程序框架
// #endif

const getAvatarColor = (name) => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
  const charCode = (name || '用户').charCodeAt(0);
  return colors[charCode % colors.length];
};

const canPreRegister = computed(() => {
  if (!categoryStartTime.value) return false;
  const now = new Date();
  const startTime = new Date(categoryStartTime.value);
  return now < startTime;
});

const canCheckin = computed(() => {
  const now = new Date();
  const startTime = categoryStartTime.value ? new Date(categoryStartTime.value) : null;
  const endTime = categoryEndTime.value ? new Date(categoryEndTime.value) : null;

  if (startTime && now < startTime) {
    return false;
  }
  if (endTime && now > endTime) {
    return false;
  }
  // 检查今天是否已经打卡
  if (hasCheckedInToday.value) {
    return false;
  }
  return true;
});

const isEnded = computed(() => {
  if (!categoryEndTime.value) return false;
  const now = new Date();
  const endTime = new Date(categoryEndTime.value);
  return now > endTime;
});

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const mins = date.getMinutes().toString().padStart(2, '0');
  return `${month}-${day} ${hours}:${mins}`;
};

// 按日期分组的打卡记录（朋友圈样式）
const groupedMyRecords = computed(() => {
  const groups = {};
  myRecords.value.forEach(record => {
    const date = record.date || (record.time ? record.time.split(' ')[0] : new Date().toISOString().split('T')[0]);
    if (!groups[date]) {
      const dateObj = new Date(date);
      groups[date] = {
        date: date,
        displayDate: formatDisplayDate(date),
        day: dateObj.getDate(),
        month: dateObj.getMonth() + 1,
        records: []
      };
    }
    groups[date].records.push(record);
  });
  return Object.values(groups).sort((a, b) => {
    if (sortOrder.value === 'desc') {
      return new Date(b.date) - new Date(a.date);
    } else {
      return new Date(a.date) - new Date(b.date);
    }
  });
});

// 格式化日期显示（今天、昨天、星期几、具体日期）
const formatDisplayDate = (dateStr) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const date = new Date(dateStr);
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (dateStr === todayStr) return '今天';
  if (dateStr === yesterdayStr) return '昨天';

  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dayDiff = Math.floor((today - date) / (1000 * 60 * 60 * 24));

  if (dayDiff < 7) {
    return weekdays[date.getDay()];
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  if (isNaN(date.getTime())) {
    // 如果解析失败，尝试旧格式
    const parts = timeStr.split(' ');
    if (parts.length > 1 && parts[1]) {
      return parts[1].substring(0, 5);
    }
    return timeStr.substring(0, 5);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const formatDynamicTime = (timeStr) => {
  if (!timeStr) return '';
  
  let date;
  if (timeStr.includes('T')) {
    date = new Date(timeStr);
  } else {
    date = new Date(timeStr.replace(' ', 'T'));
  }
  
  if (isNaN(date.getTime())) {
    return timeStr;
  }
  
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) {
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${diffDays}天前 ${hours}:${mins}`;
  }
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const mins = date.getMinutes().toString().padStart(2, '0');
  
  return `${month}月${day}日 ${hours}:${mins}`;
};

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options;
  categoryId.value = options.id;
  categoryName.value = decodeURIComponent(options.name || '数据结构基础打卡训练');
  
  const role = uni.getStorageSync('role');
  isAdmin.value = role && role != 0 && role != '0';
  console.log('当前用户角色:', role, '是否管理员:', isAdmin.value);
  
  loadCategoryData();
  loadDynamics();
  loadMyRecords();
  loadTodayQuestions();
});

const loadCategoryData = async () => {
  try {
    const res = await request.get(`/checkin-category/categories/${categoryId.value}`);
    const data = res.data;
    joinCount.value = data.join_count || 0;
    checkinCount.value = data.checkin_count || 0;
    if (data.userStats) {
      myConsecutiveDays.value = data.userStats.consecutive_days || 0;
      myTotalCheckins.value = data.userStats.total_checkins || 0;
    }
    categoryStartTime.value = data.start_time || null;
    categoryEndTime.value = data.end_time || null;
    preRegisterCount.value = data.pre_register_count || 0;
    isPreRegistered.value = data.is_pre_registered || false;
  } catch (error) {
    console.error('加载类别数据失败:', error);
  }
};

const loadDynamics = async () => {
  try {
    loading.value = true;
    const res = await request.get(`/checkin-category/categories/${categoryId.value}/dynamics`, {
      limit: 20
    });
    dynamics.value = res.data.list.map(item => ({
      id: item.id,
      nickname: item.nickname || '用户',
      avatar: item.avatar,
      avatarColor: getRandomColor(),
      day: item.day || 1,
      totalDays: item.totalDays || 1,
      content: item.content,
      title: item.title,
      images: item.images || [],
      time: item.checkin_time,
      likeCount: item.like_count || 0,
      isLiked: item.isLiked || false,
      commentCount: item.comment_count || 0,
      comments: []
    }));
  } catch (error) {
    console.error('加载动态失败:', error);
  } finally {
    loading.value = false;
  }
};

const loadMyRecords = async () => {
  try {
    const res = await request.get(`/checkin-category/categories/${categoryId.value}/my-records`, {
      limit: 50,
      order: sortOrder.value
    });
    myRecords.value = res.data.list.map(item => ({
      id: item.id,
      taskName: item.task_name || categoryName.value,
      title: item.title || '',
      content: item.content,
      images: item.images || [],
      time: item.checkin_time,
      date: item.checkin_date
    }));
    if (res.data.stats) {
      myTotalCheckins.value = res.data.stats.total_checkins || 0;
      myConsecutiveDays.value = res.data.stats.consecutive_days || 0;
    }
    // 检查今天是否已经打卡
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    hasCheckedInToday.value = myRecords.value.some(record => {
      const recordDate = record.date ? record.date.split('T')[0] : '';
      return recordDate === todayStr;
    });
  } catch (error) {
    console.error('加载我的记录失败:', error);
  }
};

const loadTodayQuestions = async () => {
  try {
    const res = await request.get('/study/stats');
    if (res.data && res.data.todayQuestions !== undefined) {
      todayQuestions.value = res.data.todayQuestions;
    }
  } catch (error) {
    console.error('加载今日做题数失败:', error);
  }
};

const selectQuestionCheckin = async () => {
  checkinType.value = 'questions';
  
  if (todayQuestions.value <= 0) {
    uni.showToast({ title: '今日暂无做题记录', icon: 'none' });
    return;
  }
  
  checkinTitle.value = `今日做题 ${todayQuestions.value} 题`;
  checkinContent.value = `今天完成了 ${todayQuestions.value} 道题目的练习，继续加油！`;
  showShareCardModal.value = true;
  
  // 预生成打卡图
  setTimeout(async () => {
    try {
      isGenerating.value = true;
      const imagePath = await drawTicketCard();
      const uploadedUrl = await uploadTicketImage(imagePath);
      generatedShareImage.value = uploadedUrl;
      uni.showToast({ title: '打卡图已生成', icon: 'none' });
    } catch (error) {
      console.error('预生成图片失败:', error);
    } finally {
      isGenerating.value = false;
    }
  }, 500);
};

// 关闭打卡图弹窗
const closeShareCardModal = () => {
  showShareCardModal.value = false;
  // 清空生成的图片，下次打开时重新生成
  generatedShareImage.value = '';
};

// 分享打卡图
const shareCard = () => {
  if (!generatedShareImage.value) {
    uni.showToast({ title: '请先生成打卡图', icon: 'none' });
    return;
  }
  
  // #ifdef MP-WEIXIN
  // 小程序直接唤起分享菜单
  uni.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
  uni.showToast({ title: '点击右上角分享', icon: 'none' });
  // #endif
  
  // #ifdef H5
  uni.showToast({ title: '请点击右上角分享', icon: 'none' });
  // #endif
};

const isGenerating = ref(false);

const isH5 = () => {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
};

const drawTicketCard = () => {
  return new Promise((resolve, reject) => {
    // H5 使用 html-to-image，小程序使用 canvas 绘制
    if (isH5()) {
      // H5 环境：使用 html-to-image
      setTimeout(() => {
        const cardElement = document.querySelector('.share-card-container');
        if (!cardElement) {
          reject(new Error('卡片元素不存在'));
          return;
        }
        
        htmlToImage.toPng(cardElement, {
          quality: 0.95,
          pixelRatio: 2,
          skipAutoScale: true,
        })
        .then((dataUrl) => {
          resolve(dataUrl);
        })
        .catch((error) => {
          console.error('生成图片失败:', error);
          reject(error);
        });
      }, 100);
    } else {
      // 小程序环境：使用 canvas 2d 绘制
      drawTicketCardWithCanvas(resolve, reject);
    }
  });
};

const drawTicketCardWithCanvas = (resolve, reject) => {
  const width = 280;
  const height = 360;
  
  // 获取 canvas 节点
  const query = uni.createSelectorQuery();
  query.select('#checkinCanvas').fields({ node: true, size: true }).exec((res) => {
    if (!res[0] || !res[0].node) {
      reject(new Error('Canvas 节点不存在'));
      return;
    }
    
    const canvas = res[0].node;
    const ctx = canvas.getContext('2d');
    
    canvas.width = width;
    canvas.height = height;
    
    // 填充白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    const drawCard = (hasBgImage = false) => {
      if (!hasBgImage) {
        // 使用渐变背景
        const gradient = ctx.createLinearGradient(0, 0, width, height * 0.58);
        gradient.addColorStop(0, '#FF8C42');
        gradient.addColorStop(1, '#FF6B6B');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height * 0.58);
      }
      
      // 绘制文字
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('QUIZ MASTER', width / 2, 28);
      
      ctx.font = '11px sans-serif';
      const now = new Date();
      const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      ctx.fillText(dateStr, width / 2, 48);
      
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('今日', width / 2 - 60, 85);
      ctx.fillText('打卡', width / 2 + 60, 85);
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(width / 2 - 30, 80);
      ctx.lineTo(width / 2 + 30, 80);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('✈', width / 2, 82);
      
      // 分割线区域
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, height * 0.58, width, 6);
      
      // 圆形缺口
      ctx.beginPath();
      ctx.arc(0, height * 0.58 + 3, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(width, height * 0.58 + 3, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // 虚线
      ctx.strokeStyle = '#e0e0e0';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10, height * 0.58 + 3);
      ctx.lineTo(width - 10, height * 0.58 + 3);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // 下半部分背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, height * 0.58 + 6, width, height * 0.42 - 6);
      
      // 做题数量和累计打卡
      ctx.fillStyle = '#999999';
      ctx.font = '11px sans-serif';
      ctx.fillText('做题数量', width / 4, height * 0.58 + 40);
      ctx.fillText('累计打卡', width * 3 / 4, height * 0.58 + 40);
      
      ctx.fillStyle = '#FF8C42';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(String(todayQuestions.value), width / 4 - 10, height * 0.58 + 80);
      ctx.fillText(String(myTotalCheckins.value), width * 3 / 4 - 10, height * 0.58 + 80);
      
      ctx.fillStyle = '#666666';
      ctx.font = '13px sans-serif';
      ctx.fillText('题', width / 4 + 18, height * 0.58 + 80);
      ctx.fillText('天', width * 3 / 4 + 18, height * 0.58 + 80);
      
      // 竖线分隔
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width / 2, height * 0.58 + 50);
      ctx.lineTo(width / 2, height * 0.58 + 95);
      ctx.stroke();
      
      // 底部标语
      ctx.fillStyle = '#999999';
      ctx.font = '11px sans-serif';
      ctx.fillText('坚持每一天，进步看得见', width / 2, height - 20);
      
      // 导出图片
      uni.canvasToTempFilePath({
        canvas: canvas,
        success: (res) => {
          resolve(res.tempFilePath);
        },
        fail: (err) => {
          reject(err);
        }
      });
    };
    
    // 加载背景图片
    const bgImg = canvas.createImage();
    bgImg.onload = () => {
      ctx.drawImage(bgImg, 0, 0, width, height * 0.58);
      drawCard(true);
    };
    bgImg.onerror = () => {
      console.warn('背景图片加载失败，使用渐变背景');
      drawCard(false);
    };
    bgImg.src = SHARE_CARD_BG;
  });
};

const uploadTicketImage = (filePath) => {
  return new Promise((resolve, reject) => {
    if (isH5()) {
      const formData = new FormData();
      const arr = filePath.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      formData.append('image', blob, 'checkin.png');
      
      fetch(`${BASE_URL}/upload/image`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${uni.getStorageSync('token')}`
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.code === 0) {
          resolve(data.data.url);
        } else {
          reject(new Error(data.message));
        }
      })
      .catch(reject);
    } else {
      uni.uploadFile({
        url: `${BASE_URL}/upload/image`,
        filePath: filePath,
        name: 'image',
        header: {
          'Authorization': `Bearer ${uni.getStorageSync('token')}`
        },
        success: (res) => {
          const data = JSON.parse(res.data);
          if (data.code === 0) {
            resolve(data.data.url);
          } else {
            reject(new Error(data.message));
          }
        },
        fail: reject
      });
    }
  });
};

// 发布打卡
const publishCheckin = async () => {
  const token = uni.getStorageSync('token');
  if (!token) {
    uni.showModal({
      title: '提示',
      content: '请先登录后再打卡',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          uni.navigateTo({ url: '/pages/login/login' });
        }
      }
    });
    return;
  }
  
  if (!categoryId.value) {
    uni.showToast({ title: '数据错误，请刷新页面', icon: 'none' });
    return;
  }
  
  isGenerating.value = true;
  
  try {
    let uploadedUrl = generatedShareImage.value;
    
    // 如果没有预生成的图片，则重新生成
    if (!uploadedUrl) {
      const imagePath = await drawTicketCard();
      uploadedUrl = await uploadTicketImage(imagePath);
      generatedShareImage.value = uploadedUrl;
    }
    
    await request.post('/checkin-category/records', {
      categoryId: categoryId.value,
      title: `今日做题 ${todayQuestions.value} 题`,
      content: `今天完成了 ${todayQuestions.value} 道题目的练习，累计打卡 ${myTotalCheckins.value} 天，继续加油！`,
      images: [uploadedUrl]
    });
    
    uni.showToast({ title: '打卡成功', icon: 'success' });
    
    // 延迟后提示分享
    setTimeout(() => {
      uni.showModal({
        title: '打卡成功',
        content: '是否分享给好友？',
        confirmText: '去分享',
        cancelText: '暂不',
        success: (res) => {
          if (res.confirm) {
            // #ifdef MP-WEIXIN
            // 小程序唤起分享菜单
            // #endif
            // #ifdef H5
            uni.showToast({ title: '请点击右上角分享', icon: 'none' });
            // #endif
          }
        }
      });
    }, 500);
    
    closeShareCardModal();
    closeModal();
    loadMyRecords();
    loadDynamics();
    loadCategoryData();
  } catch (error) {
    console.error('打卡失败:', error);
    // 显示具体的错误信息
    const errorMsg = error.message || '打卡失败';
    uni.showToast({ title: errorMsg, icon: 'none' });
    
    // 如果今天已打卡，关闭弹窗并刷新状态
    if (error.message && error.message.includes('今日已打卡')) {
      closeShareCardModal();
      closeModal();
      loadMyRecords();
      loadCategoryData();
    }
  } finally {
    isGenerating.value = false;
  }
};

const doPreRegister = async () => {
  const token = uni.getStorageSync('token');
  if (!token) {
    uni.showModal({
      title: '提示',
      content: '请先登录后再预报名',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          uni.navigateTo({ url: '/pages/login/login' });
        }
      }
    });
    return;
  }
  
  try {
    const res = await request.post(`/checkin-category/categories/${categoryId.value}/pre-register`);
    isPreRegistered.value = res.data.registered;
    preRegisterCount.value = res.data.registered ? preRegisterCount.value + 1 : Math.max(0, preRegisterCount.value - 1);
    uni.showToast({ title: res.data.message, icon: 'success' });
  } catch (error) {
    console.error('预报名失败:', error);
    uni.showToast({ title: '预报名失败', icon: 'none' });
  }
};

const getRandomColor = () => {
  const colors = ['#ffd93d', '#667eea', '#00b894', '#fd79a8', '#a29bfe'];
  return colors[Math.floor(Math.random() * colors.length)];
};

const goBack = () => {
  uni.navigateBack();
};

const inviteFriend = () => {
  // #ifdef H5
  uni.showModal({
    title: '邀请好友',
    content: '点击右上角分享按钮，邀请好友一起学习打卡！',
    showCancel: false,
    confirmText: '知道了'
  });
  // #endif
  // #ifdef MP-WEIXIN
  uni.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
  uni.showToast({ title: '点击右上角分享', icon: 'none' });
  // #endif
  // #ifdef APP-PLUS
  uni.share({
    provider: 'weixin',
    type: 0,
    title: shareConfig.value.title,
    summary: shareConfig.value.desc,
    imageUrl: shareConfig.value.imageUrl || SHARE_CARD_BG,
    href: 'https://yizhansa.cn',
    success: function(res) {
      uni.showToast({ title: '分享成功', icon: 'success' });
    },
    fail: function(err) {
      console.error('分享失败:', err);
    }
  });
  // #endif
};

const toggleSort = () => {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
  uni.showToast({
    title: sortOrder.value === 'desc' ? '已按时间倒序' : '已按时间正序',
    icon: 'none',
    duration: 1000
  });
  loadMyRecords();
};

const loadMoreDynamics = () => {
};

const likeDynamic = async (item) => {
  if (!item) return;
  try {
    const res = await request.post(`/checkin-category/records/${item.id}/like`);
    item.isLiked = res.data.liked;
    item.likeCount = (item.likeCount || 0) + (res.data.liked ? 1 : -1);
  } catch (error) {
    console.error('点赞失败:', error);
  }
};

const commentDynamic = async (item) => {
  if (!item) return;
  currentCommentItem.value = item;
  showCommentModal.value = true;
  
  try {
    const res = await request.get(`/checkin-category/records/${item.id}/comments`);
    if (currentCommentItem.value) {
      currentCommentItem.value.comments = res.data.list.map(c => ({
        id: c.id,
        nickname: c.nickname || '用户',
        avatar: c.avatar,
        content: c.content,
        time: new Date(c.created_at).toTimeString().slice(0, 5),
        userId: c.user_id
      }));
    }
  } catch (error) {
    console.error('加载评论失败:', error);
  }
};

const submitComment = async () => {
  const content = commentContent.value || '';
  if (!content.trim()) {
    uni.showToast({ title: '请输入评论内容', icon: 'none' });
    return;
  }
  
  if (!currentCommentItem.value) {
    uni.showToast({ title: '数据错误', icon: 'none' });
    return;
  }
  
  try {
    await request.post(`/checkin-category/records/${currentCommentItem.value.id}/comments`, {
      content: content
    });
    
    commentContent.value = '';
    uni.showToast({ title: '评论成功', icon: 'success' });
    
    const res = await request.get(`/checkin-category/records/${currentCommentItem.value.id}/comments`);
    if (currentCommentItem.value) {
      currentCommentItem.value.comments = res.data.list.map(c => ({
        id: c.id,
        nickname: c.nickname || '用户',
        avatar: c.avatar,
        content: c.content,
        time: new Date(c.created_at).toTimeString().slice(0, 5),
        userId: c.user_id
      }));
      currentCommentItem.value.commentCount = res.data.total;
    }
  } catch (error) {
    console.error('评论失败:', error);
  }
};

const closeCommentModal = () => {
  showCommentModal.value = false;
  currentCommentItem.value = null;
  commentContent.value = '';
};

const toggleCommentActions = (comment) => {
  if (showActionsCommentId.value === comment.id) {
    showActionsCommentId.value = null;
  } else {
    showActionsCommentId.value = comment.id;
  }
};

const startEditComment = (comment) => {
  editingCommentId.value = comment.id;
  editCommentContent.value = comment.content;
  showActionsCommentId.value = null;
};

const cancelEditComment = () => {
  editingCommentId.value = null;
  editCommentContent.value = '';
};

const submitEditComment = async () => {
  if (!editCommentContent.value.trim()) {
    uni.showToast({ title: '请输入评论内容', icon: 'none' });
    return;
  }
  
  try {
    await request.put(`/checkin-category/comments/${editingCommentId.value}`, {
      content: editCommentContent.value
    });
    
    if (currentCommentItem.value && currentCommentItem.value.comments) {
      const index = currentCommentItem.value.comments.findIndex(c => c.id === editingCommentId.value);
      if (index !== -1) {
        currentCommentItem.value.comments[index].content = editCommentContent.value;
      }
    }
    
    editingCommentId.value = null;
    editCommentContent.value = '';
    uni.showToast({ title: '修改成功', icon: 'success' });
  } catch (error) {
    console.error('修改评论失败:', error);
  }
};

const deleteComment = async (commentId) => {
  showActionsCommentId.value = null;
  try {
    const comment = currentCommentItem.value?.comments?.find(c => c.id === commentId);
    const isOwnComment = comment && String(comment.userId) === String(currentUserId.value);
    
    if (isOwnComment) {
      await request.delete(`/checkin-category/comments/${commentId}`);
    } else if (isAdmin.value) {
      await request.delete(`/checkin-category/admin/comments/${commentId}`);
    } else {
      uni.showToast({ title: '无权限删除', icon: 'none' });
      return;
    }
    
    if (currentCommentItem.value && currentCommentItem.value.comments) {
      const index = currentCommentItem.value.comments.findIndex(c => c.id === commentId);
      if (index !== -1) {
        currentCommentItem.value.comments.splice(index, 1);
        currentCommentItem.value.commentCount = Math.max(0, (currentCommentItem.value.commentCount || 0) - 1);
        uni.showToast({ title: '删除成功', icon: 'success' });
      }
    }
  } catch (error) {
    console.error('删除评论失败:', error);
    uni.showToast({ title: '删除失败', icon: 'none' });
  }
};

const previewImage = (urls, current) => {
  const stringUrls = urls.map(url => String(url || ''));
  uni.previewImage({ urls: stringUrls, current: stringUrls[current] });
};

const showCheckinModal = () => {
  checkinType.value = 'normal';
  checkinTitle.value = '';
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  checkinType.value = 'normal';
  checkinTitle.value = '';
  checkinContent.value = '';
  checkinImages.value = [];
};

const chooseImage = async () => {
  uni.chooseImage({
    count: 9 - checkinImages.value.length,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      uni.showLoading({ title: '检测图片中...' });
      
      const uploadedUrls = [];
      for (const tempFilePath of res.tempFilePaths) {
        try {
          // 先进行图片内容安全检测
          const checkResult = await checkImageContent(tempFilePath);
          if (!checkResult.isSafe) {
            uni.hideLoading();
            uni.showToast({ title: checkResult.message || '图片含有违规内容', icon: 'none' });
            return;
          }
          
          uni.showLoading({ title: '上传图片中...' });
          
          const compressedPath = await compressImage(tempFilePath);
          const uploadedUrl = await uploadImage(compressedPath);
          uploadedUrls.push(uploadedUrl);
        } catch (error) {
          console.error('图片处理失败:', error);
        }
      }
      
      uni.hideLoading();
      checkinImages.value.push(...uploadedUrls);
      
      if (uploadedUrls.length < res.tempFilePaths.length) {
        uni.showToast({ title: '部分图片上传失败', icon: 'none' });
      }
    }
  });
};

const submitCheckin = async () => {
  const content = checkinContent.value || '';
  const images = checkinImages.value || [];
  
  if (!content.trim() && images.length === 0) {
    uni.showToast({ title: '请输入打卡内容', icon: 'none' });
    return;
  }
  
  if (!categoryId.value) {
    uni.showToast({ title: '数据错误，请刷新页面', icon: 'none' });
    return;
  }
  
  const token = uni.getStorageSync('token');
  if (!token) {
    uni.showModal({
      title: '提示',
      content: '请先登录后再打卡',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          uni.navigateTo({ url: '/pages/login/login' });
        }
      }
    });
    return;
  }
  
  // 文本内容安全检测（scene=4 社交日志）
  if (content && content.trim()) {
    uni.showLoading({ title: '检测内容中...' });
    const textCheckResult = await checkTextContent(content, 4);
    uni.hideLoading();
    
    if (!textCheckResult.isSafe) {
      uni.showToast({ title: textCheckResult.message || '内容含有违规信息', icon: 'none' });
      return;
    }
  }
  
  try {
    console.log('Submitting checkin:', {
      categoryId: categoryId.value,
      title: checkinTitle.value || '',
      content: content,
      images: images
    });
    
    await request.post('/checkin-category/records', {
      categoryId: categoryId.value,
      title: checkinTitle.value || '',
      content: content,
      images: images
    });
    
    uni.showToast({ title: '打卡成功', icon: 'success' });
    closeModal();
    loadMyRecords();
    loadDynamics();
    loadCategoryData();
  } catch (error) {
    console.error('打卡失败:', error);
    // 显示错误信息
    const errorMsg = error.message || '打卡失败';
    uni.showToast({ title: errorMsg, icon: 'none' });
    
    if (error.message && error.message.includes('未授权')) {
      uni.showModal({
        title: '提示',
        content: '登录已过期，请重新登录',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            uni.navigateTo({ url: '/pages/login/login' });
          }
        }
      });
    } else if (error.message && error.message.includes('今日已打卡')) {
      // 如果今天已打卡，关闭弹窗并刷新状态
      closeModal();
      loadMyRecords();
      loadCategoryData();
    }
  }
};

const deleteRecord = (record) => {
  uni.showModal({
    title: '提示',
    content: '确定要删除这条打卡记录吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await request.delete(`/checkin-category/records/${record.id}`);
          const index = myRecords.value.findIndex(r => r.id === record.id);
          if (index > -1) {
            myRecords.value.splice(index, 1);
            myTotalCheckins.value = Math.max(0, myTotalCheckins.value - 1);
            uni.showToast({ title: '删除成功', icon: 'success' });
          }
          loadCategoryData();
        } catch (error) {
          console.error('删除记录失败:', error);
          uni.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    }
  });
};

const adminDeleteRecord = async (item) => {
  try {
    await request.delete(`/checkin-category/admin/records/${item.id}`);
    const index = dynamics.value.findIndex(d => d.id === item.id);
    if (index > -1) {
      dynamics.value.splice(index, 1);
      uni.showToast({ title: '删除成功', icon: 'success' });
    }
    loadCategoryData();
  } catch (error) {
    console.error('管理员删除记录失败:', error);
    uni.showToast({ title: '删除失败', icon: 'none' });
  }
};

// 编辑打卡记录
const editingRecord = ref(null);
const showEditModal = ref(false);
const editTitle = ref('');
const editContent = ref('');
const editImages = ref([]);

const editRecord = (record) => {
  editingRecord.value = record;
  editTitle.value = record.title || '';
  editContent.value = record.content;
  editImages.value = record.images ? [...record.images] : [];
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editingRecord.value = null;
  editTitle.value = '';
  editContent.value = '';
  editImages.value = [];
};

const chooseEditImage = async () => {
  uni.chooseImage({
    count: 9 - editImages.value.length,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      uni.showLoading({ title: '处理图片中...' });
      
      const uploadedUrls = [];
      for (const tempFilePath of res.tempFilePaths) {
        try {
          const compressedPath = await compressImage(tempFilePath);
          const uploadedUrl = await uploadImage(compressedPath);
          uploadedUrls.push(uploadedUrl);
        } catch (error) {
          console.error('图片处理失败:', error);
        }
      }
      
      uni.hideLoading();
      editImages.value = [...editImages.value, ...uploadedUrls];
      
      if (uploadedUrls.length < res.tempFilePaths.length) {
        uni.showToast({ title: '部分图片上传失败', icon: 'none' });
      }
    }
  });
};

const submitEdit = async () => {
  const content = editContent.value || '';
  if (!content.trim()) {
    uni.showToast({ title: '请输入内容', icon: 'none' });
    return;
  }
  if (editingRecord.value) {
    try {
      await request.put(`/checkin-category/records/${editingRecord.value.id}`, {
        title: editTitle.value || '',
        content: content,
        images: editImages.value || []
      });
      
      editingRecord.value.title = editTitle.value || '';
      editingRecord.value.content = content;
      editingRecord.value.images = [...(editImages.value || [])];
      uni.showToast({ title: '修改成功', icon: 'success' });
      closeEditModal();
    } catch (error) {
      console.error('修改记录失败:', error);
    }
  }
};

// 暴露变量给 Options API 使用（小程序分享）
// #ifdef MP-WEIXIN
defineExpose({
  shareConfig,
  categoryId,
  categoryName,
  generatedShareImage
});
// #endif
</script>

<!-- #ifdef MP-WEIXIN -->
<script>
// 微信小程序分享配置 - 使用 Options API 方式
export default {
  onShareAppMessage() {
    // 从页面实例获取数据
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const data = currentPage?.$vm || {};
    
    const title = data.shareConfig?.title || '🔥 学习打卡，一起进步！';
    const desc = data.shareConfig?.desc || '坚持每一天，进步看得见！💪';
    const path = data.shareConfig?.path || '/pages/checkin/checkin-home';
    const imageUrl = data.shareConfig?.imageUrl || '';
    
    return {
      title: title,
      desc: desc,
      path: path,
      imageUrl: imageUrl
    };
  },
  onShareTimeline() {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const data = currentPage?.$vm || {};
    
    const title = data.shareConfig?.title || '🔥 学习打卡，一起进步！';
    const query = `id=${data.categoryId || ''}&name=${encodeURIComponent(data.categoryName || '打卡')}`;
    const imageUrl = data.shareConfig?.imageUrl || '';
    
    return {
      title: title,
      query: query,
      imageUrl: imageUrl
    };
  }
}
</script>
<!-- #endif -->

<style scoped>
/* 配色方案：温暖的橙黄色系，协调统一 */
:root {
  --primary: #FF8C42;
  --primary-light: #FFB347;
  --primary-dark: #E86A33;
  --secondary: #FFF5E6;
  --accent: #FFD93D;
  --text-primary: #2D3436;
  --text-secondary: #636E72;
  --text-tertiary: #B2BEC3;
  --bg-page: #F8F9FA;
  --bg-card: #FFFFFF;
  --success: #00B894;
  --error: #FF7675;
  --tab-inactive: #F8F9FA;
}

.checkin-category {
  height: 100vh;
  background: var(--bg-page);
  display: flex;
  flex-direction: column;
  padding-bottom: 140rpx;
  box-sizing: border-box;
}

/* 顶部背景 - 与导航栏保持同色系 */
.header-bg {
  position: relative;
  background: url('https://s3.hi168.com/hi168-26998-7111ilq6/uploads/1776430628218-1zjz9l.png') center/cover no-repeat;
  padding: 30rpx 40rpx 30rpx;
}

.header-bg::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.7) 100%);
}

.header-content {
  position: relative;
  z-index: 1;
}

.category-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #fff;
  display: block;
  margin-bottom: 15rpx;
  text-shadow: 0 2rpx 4rpx rgba(0,0,0,0.1);
}

.stats-row {
  display: flex;
  align-items: center;
  margin-bottom: 15rpx;
  flex-wrap: wrap;
}

.stats-text {
  font-size: 28rpx;
  color: #fff;
  font-weight: 500;
}

.stats-text.pre-register {
  color: #FFD93D;
}

.stats-divider {
  color: rgba(255,255,255,0.6);
  margin: 0 20rpx;
}

.time-info {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.time-icon {
  width: 28rpx;
  height: 28rpx;
  margin-right: 10rpx;
}

.time-text {
  font-size: 24rpx;
  color: rgba(255,255,255,0.9);
}

.header-btns {
  display: flex;
  gap: 20rpx;
}

.invite-btn {
  display: inline-flex;
  align-items: center;
  background: rgba(0,0,0,0.5);
  padding: 16rpx 32rpx;
  border-radius: 35rpx;
  border: 1rpx solid rgba(255,255,255,0.2);
  backdrop-filter: blur(10rpx);
}

.pre-register-btn {
  display: inline-flex;
  align-items: center;
  background: #FF8C42;
  padding: 16rpx 32rpx;
  border-radius: 35rpx;
}

.pre-registered-btn {
  display: inline-flex;
  align-items: center;
  background: #909399;
  padding: 16rpx 32rpx;
  border-radius: 35rpx;
}

.checkin-btn {
  display: inline-flex;
  align-items: center;
  background: #FF8C42;
  padding: 16rpx 32rpx;
  border-radius: 35rpx;
}

.ended-btn {
  display: inline-flex;
  align-items: center;
  background: #dcdfe6;
  padding: 16rpx 32rpx;
  border-radius: 35rpx;
}

.ended-btn .pre-text {
  color: #909399;
}

.checked-in-btn {
  display: inline-flex;
  align-items: center;
  background: #00B894;
  padding: 16rpx 32rpx;
  border-radius: 35rpx;
}

.pre-text {
  font-size: 26rpx;
  color: #fff;
  font-weight: 500;
}

.user-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 10rpx;
}

.invite-text {
  font-size: 26rpx;
  color: #fff;
  font-weight: 500;
}

/* Tab栏 - 简洁白色 */
.tab-bar {
  display: flex;
  background: var(--bg-page);
  padding: 16rpx 20rpx;
  gap: 12rpx;
  justify-content: flex-start;
  position: relative;
}

.tab-slider {
  position: absolute;
  left: 20rpx;
  top: 16rpx;
  width: 160rpx;
  height: 64rpx;
  background: #FFB347;
  border-radius: 40rpx;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;
  box-shadow: 0 4rpx 16rpx rgba(255, 179, 71, 0.4);
}

.tab-item {
  width: 160rpx;
  padding: 8rpx 0;
  text-align: center;
  position: relative;
  background: var(--bg-card);
  border-radius: 40rpx;
  border: 2rpx solid transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
}

.tab-item.active {
  background: transparent;
  border-color: transparent;
}

.tab-item:active {
  transform: scale(0.95);
}

.tab-text {
  font-size: 28rpx;
  color: var(--text-primary);
  font-weight: 500;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.tab-item.active .tab-text {
  color: #fff;
  font-weight: 600;
}

.sort-btn {
  display: flex;
  align-items: center;
  padding: 8rpx 16rpx;
  background: var(--bg-card);
  border-radius: 40rpx;
  border: 2rpx solid #FFB347;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
  flex-shrink: 0;
  margin-left: auto;
}

.sort-btn:active {
  transform: scale(0.95);
  background: var(--bg-card);
}

.sort-icon {
  width: 24rpx;
  height: 24rpx;
  margin-right: 6rpx;
  transition: transform 0.3s ease;
}

.sort-icon.sort-asc {
  transform: rotate(180deg);
}

.sort-text {
  font-size: 24rpx;
  color: #FFB347;
  font-weight: 600;
  transition: all 0.3s ease;
  white-space: nowrap;
}

/* 内容区域 */
.content-scroll {
  flex: 1;
  overflow: hidden;
}

/* Tab 内容切换动画 - 滑动效果 */
.tab-content-enter {
  animation: tabSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes tabSlideIn {
  0% {
    opacity: 0;
    transform: translateX(100rpx);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 成员动态 */
.dynamic-list {
  padding: 20rpx;
}

.dynamic-item {
  background: var(--bg-card);
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.06);
  border: 2rpx dashed #FFB347;
}

.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.user-avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  margin-right: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #fff;
}

.user-avatar-img {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  margin-right: 20rpx;
  border: 3rpx solid #fff;
}

.avatar-text {
  font-size: 38rpx;
  color: #fff;
  font-weight: 700;
  text-shadow: 0 2rpx 4rpx rgba(0,0,0,0.1);
}

.user-meta {
  flex: 1;
}

.user-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-name {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary);
  flex-shrink: 0;
}

.checkin-info {
  font-size: 22rpx;
  color: var(--primary);
  font-weight: 600;
  background: linear-gradient(135deg, rgba(255,140,66,0.1) 0%, rgba(255,179,71,0.1) 100%);
  padding: 4rpx 12rpx;
  border-radius: 16rpx;
  display: inline-block;
  flex-shrink: 0;
}

.dynamic-content {
  margin-bottom: 16rpx;
  background: linear-gradient(135deg, #FAFAFA 0%, #F5F5F5 100%);
  padding: 20rpx;
  border-radius: 20rpx;
}

.dynamic-text {
  font-size: 30rpx;
  color: var(--text-primary);
  line-height: 1.7;
  display: block;
  margin-bottom: 16rpx;
  font-weight: 500;
}

.dynamic-images {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.dynamic-image {
  width: 200rpx;
  height: 200rpx;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.08);
}

.dynamic-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12rpx;
  border-top: 2rpx solid #F0F0F0;
}

.dynamic-time {
  font-size: 24rpx;
  color: var(--text-tertiary);
  font-weight: 500;
}

.action-btns {
  display: flex;
  gap: 24rpx;
}

.action-btn {
  display: flex;
  align-items: center;
  padding: 10rpx 20rpx;
  background: #F8F9FA;
  border-radius: 24rpx;
  transition: all 0.2s;
}

.action-btn:active {
  background: #FFE5D9;
  transform: scale(0.98);
}

.heart-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 8rpx;
}

.comment-icon {
  width: 32rpx;
  height: 32rpx;
}

.action-count {
  font-size: 26rpx;
  color: var(--text-secondary);
  font-weight: 600;
}

/* 我的打卡 */
.my-stats {
  display: flex;
  justify-content: space-around;
  background: var(--bg-card);
  padding: 16rpx 40rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04);
}

.stat-item {
  text-align: center;
}

.stat-num {
  font-size: 52rpx;
  font-weight: 700;
  color: var(--primary);
  display: block;
  margin-bottom: 10rpx;
}

.stat-label {
  font-size: 26rpx;
  color: var(--text-secondary);
}

/* 朋友圈样式时间线 - 精致版 */
.timeline-list {
  padding: 0 20rpx 40rpx;
}

.timeline-group {
  position: relative;
  margin-bottom: 40rpx;
}

/* 左侧时间线 */
.timeline-group::before {
  content: '';
  position: absolute;
  left: 36rpx;
  top: 80rpx;
  bottom: -20rpx;
  width: 2rpx;
  background: linear-gradient(180deg, #FF8C42 0%, #FFB347 50%, rgba(255,179,71,0.2) 100%);
}

.timeline-group:last-child::before {
  display: none;
}

/* 日期头部 - 垂直排列 */
.timeline-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 0;
  padding-left: 0;
  width: 80rpx;
}

.date-node {
  width: 72rpx;
  height: 72rpx;
  background: linear-gradient(135deg, #FF8C42 0%, #FFB347 100%);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 20rpx rgba(255,140,66,0.35);
  border: 4rpx solid #fff;
  z-index: 1;
}

.date-day {
  font-size: 28rpx;
  color: #fff;
  font-weight: 700;
  line-height: 1;
}

.date-month {
  font-size: 18rpx;
  color: rgba(255,255,255,0.9);
  margin-top: 2rpx;
}

.date-tag-below {
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.date-tag-text {
  font-size: 24rpx;
  color: #FF8C42;
  font-weight: 600;
}

/* 打卡记录卡片 */
.timeline-records {
  padding-left: 100rpx;
  margin-top: -144rpx;
}

.timeline-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 6rpx 24rpx rgba(0,0,0,0.06);
  position: relative;
  border: 2rpx dashed #FFB347;
}

.timeline-card::before {
  content: '';
  position: absolute;
  left: -68rpx;
  top: 36rpx;
  width: 16rpx;
  height: 16rpx;
  background: #FFB347;
  border-radius: 50%;
  border: 4rpx solid #fff;
  box-shadow: 0 2rpx 8rpx rgba(255,140,66,0.3);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.card-time {
  font-size: 24rpx;
  color: var(--primary);
  font-weight: 600;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.card-time::before {
  content: '';
  width: 8rpx;
  height: 8rpx;
  background: var(--primary);
  border-radius: 50%;
  margin-right: 10rpx;
}

.card-title {
  font-size: 26rpx;
  color: #FFB347;
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-content {
  font-size: 30rpx;
  color: var(--text-primary);
  line-height: 1.7;
  margin-bottom: 20rpx;
}

.card-images {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.card-image {
  border-radius: 16rpx;
}

.card-image.single-image {
  width: 100%;
  max-width: 400rpx;
  height: 400rpx;
}

.card-image.multi-image {
  width: 200rpx;
  height: 200rpx;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 20rpx;
  border-top: 2rpx solid #F0F0F0;
}

.card-task {
  font-size: 24rpx;
  color: var(--text-tertiary);
  background: #F8F9FA;
  padding: 8rpx 16rpx;
  border-radius: 12rpx;
}

.card-actions {
  display: flex;
  gap: 20rpx;
}

.action-icon-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.record-action-icon {
  width: 28rpx;
  height: 28rpx;
  filter: brightness(0.4);
}

.edit-icon-btn {
  background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%);
  border: 2rpx solid #90CAF9;
}

.edit-icon-btn .record-action-icon {
  filter: brightness(0) saturate(100%) invert(38%) sepia(89%) saturate(1523%) hue-rotate(186deg) brightness(92%) contrast(88%);
}

.edit-icon-btn:active {
  background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%);
  transform: scale(0.95);
}

.edit-icon-btn:active .record-action-icon {
  filter: brightness(0) invert(1);
}

.delete-icon-btn {
  background: linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%);
  border: 2rpx solid #EF9A9A;
}

.delete-icon-btn .record-action-icon {
  filter: brightness(0) saturate(100%) invert(30%) sepia(95%) saturate(2294%) hue-rotate(338deg) brightness(84%) contrast(92%);
}

.delete-icon-btn:active {
  background: linear-gradient(135deg, #D32F2F 0%, #C62828 100%);
  transform: scale(0.95);
}

.delete-icon-btn:active .record-action-icon {
  filter: brightness(0) invert(1);
}

/* 编辑弹窗 - 更紧凑 */
.edit-modal {
  height: 85vh;
}

/* 底部打卡按钮 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 140rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background: linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%);
  padding-bottom: env(safe-area-inset-bottom);
  padding-right: 40rpx;
}

.checkin-float-btn {
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(135deg, #FF8C42, #FFB347);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 30rpx rgba(255,140,66,0.4);
}

.checkin-float-btn.pre-register {
  background: linear-gradient(135deg, #667eea, #764ba2);
  box-shadow: 0 8rpx 30rpx rgba(102,126,234,0.4);
}

.checkin-float-btn.pre-registered {
  background: linear-gradient(135deg, #00B894, #00CEC9);
  box-shadow: 0 8rpx 30rpx rgba(0,184,148,0.4);
}

.checkin-float-btn.ended {
  background: #dcdfe6;
  box-shadow: none;
}

.checkin-float-btn.checked-in {
  background: #00B894;
  box-shadow: 0 8rpx 30rpx rgba(0,184,148,0.4);
}

.check-icon {
  width: 40rpx;
  height: 40rpx;
  margin-bottom: 4rpx;
}

.btn-label {
  font-size: 24rpx;
  color: #fff;
  font-weight: 600;
}

/* 打卡弹窗 - 美化版 */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  width: 100%;
  height: 85vh;
  background: linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%);
  border-radius: 40rpx 40rpx 0 0;
  box-shadow: 0 -20rpx 60rpx rgba(0,0,0,0.15);
  animation: slideUp 0.3s ease;
  display: flex;
  flex-direction: column;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40rpx 40rpx 20rpx;
  border-bottom: 2rpx solid #F0F0F0;
  flex-shrink: 0;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 30rpx 40rpx;
}

.modal-title {
  font-size: 38rpx;
  font-weight: 700;
  color: var(--text-primary);
  position: relative;
}

.modal-title::after {
  content: '';
  position: absolute;
  bottom: -22rpx;
  left: 0;
  width: 60rpx;
  height: 4rpx;
  background: linear-gradient(90deg, #FF8C42, #FFB347);
  border-radius: 2rpx;
}

.close-btn {
  width: 60rpx;
  height: 60rpx;
  background: #F5F5F5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:active {
  background: #EBEBEB;
  transform: scale(0.95);
}

.close-icon {
  width: 32rpx;
  height: 32rpx;
}

/* 打卡类型选择 */
.checkin-type-section {
  margin-bottom: 20rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 20rpx 25rpx 25rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04);
  border: 2rpx solid #F5F5F5;
}

.section-label {
  font-size: 28rpx;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 18rpx;
  display: block;
}

.checkin-type-options {
  display: flex;
  gap: 16rpx;
}

.type-option {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 16rpx 12rpx;
  background: #F8F9FA;
  border-radius: 16rpx;
  border: 2rpx solid transparent;
  transition: all 0.3s ease;
  position: relative;
}

.type-option.active {
  background: linear-gradient(135deg, rgba(255,140,66,0.1) 0%, rgba(255,179,71,0.1) 100%);
  border-color: #FF8C42;
}

.type-icon {
  width: 36rpx;
  height: 36rpx;
  margin-right: 10rpx;
}

.type-text {
  font-size: 26rpx;
  color: var(--text-primary);
  font-weight: 500;
}

.type-badge {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  background: #2196f3;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
}

/* 管理员删除按钮 */
.admin-delete-btn {
  padding: 8rpx 16rpx;
  margin-left: auto;
}

.delete-icon-small {
  width: 36rpx;
  height: 36rpx;
  opacity: 0.6;
}

.admin-delete-btn:active .delete-icon-small {
  opacity: 1;
}

/* 表单区域 - 卡片式设计 */
.form-item {
  margin-bottom: 20rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 20rpx 25rpx 25rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04);
  border: 2rpx solid #F5F5F5;
  transition: all 0.3s ease;
}

.form-item:last-child {
  margin-bottom: 0;
}

.form-item:focus-within {
  border-color: rgba(255,140,66,0.3);
  box-shadow: 0 8rpx 30rpx rgba(255,140,66,0.08);
}

.form-label {
  font-size: 28rpx;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 18rpx;
  display: block;
  position: relative;
  padding-left: 16rpx;
}

.form-label::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 6rpx;
  height: 24rpx;
  background: linear-gradient(180deg, #FF8C42, #FFB347);
  border-radius: 3rpx;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.char-count {
  font-size: 24rpx;
  color: var(--text-tertiary);
  background: #F8F9FA;
  padding: 6rpx 14rpx;
  border-radius: 20rpx;
}

/* 标题输入 - 原生input样式 */
.title-input {
  width: 100%;
  background: #F8F9FA;
  border-radius: 16rpx;
  padding: 0 22rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  height: 90rpx;
  line-height: 90rpx;
  box-sizing: border-box;
}

.title-input::placeholder {
  font-weight: 400;
  color: #BDBDBD;
}

/* 内容输入 - 原生textarea样式 */
.content-input {
  width: 100%;
  background: #F8F9FA;
  border-radius: 16rpx;
  padding: 18rpx 22rpx;
  font-size: 30rpx;
  line-height: 1.7;
  color: var(--text-primary);
  min-height: 140rpx;
  box-sizing: border-box;
}

.content-input::placeholder {
  color: #BDBDBD;
}

/* 图片上传区域美化 */
.upload-section {
  margin-bottom: 0;
}

.upload-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.upload-label {
  font-size: 28rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

.upload-hint {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

.image-upload {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.upload-item {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.08);
}

.upload-img {
  width: 100%;
  height: 100%;
  border-radius: 16rpx;
}

.delete-img {
  position: absolute;
  top: -6rpx;
  right: -6rpx;
  width: 36rpx;
  height: 36rpx;
  background: var(--error);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(255,118,117,0.4);
  border: 2rpx solid #fff;
  z-index: 10;
}

.delete-icon {
  width: 20rpx;
  height: 20rpx;
}

.upload-add {
  width: 120rpx;
  height: 120rpx;
  border: 3rpx dashed #E0E0E0;
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FAFAFA 0%, #F5F5F5 100%);
  transition: all 0.3s;
}

.upload-add:active {
  border-color: var(--primary-light);
  background: linear-gradient(135deg, #FFF5E6 0%, #FFF0D9 100%);
}

.plus-icon {
  width: 36rpx;
  height: 36rpx;
  margin-bottom: 6rpx;
}

.upload-text {
  font-size: 22rpx;
  color: var(--text-tertiary);
}

/* 提交按钮美化 */
.submit-section {
  padding: 20rpx 40rpx 40rpx;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  border-top: 2rpx solid #F0F0F0;
  flex-shrink: 0;
  background: #FAFAFA;
}

.submit-btn {
  width: 100%;
  height: 100rpx;
  background: linear-gradient(135deg, #FF8C42 0%, #FFB347 100%);
  color: #fff;
  font-size: 34rpx;
  font-weight: 600;
  border-radius: 50rpx;
  border: none;
  box-shadow: 0 12rpx 40rpx rgba(255,140,66,0.35);
  position: relative;
  overflow: hidden;
}

.submit-btn::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  transition: left 0.5s;
}

.submit-btn:active {
  transform: scale(0.98);
  box-shadow: 0 8rpx 30rpx rgba(255,140,66,0.3);
}

.submit-btn:active::after {
  left: 100%;
}

.share-btn {
  background: linear-gradient(135deg, #4ECDC4 0%, #45B7D1 100%);
  box-shadow: 0 12rpx 40rpx rgba(78,205,196,0.35);
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.share-btn:active {
  box-shadow: 0 8rpx 30rpx rgba(78,205,196,0.3);
}

.share-btn[disabled] {
  background: linear-gradient(135deg, #cccccc 0%, #dddddd 100%);
  box-shadow: none;
  opacity: 0.7;
}

.btn-icon {
  font-size: 36rpx;
}

/* 评论弹窗样式 */
.comment-modal {
  height: 70vh;
  display: flex;
  flex-direction: column;
}

.comment-body {
  flex: 1;
  padding: 20rpx 40rpx;
  box-sizing: border-box;
  width: 100%;
  height: 0;
}

.comment-list {
  padding-bottom: 20rpx;
  width: 100%;
  box-sizing: border-box;
}

.comment-item {
  display: flex;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #F5F5F5;
  width: 100%;
  box-sizing: border-box;
}

.comment-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.comment-avatar-text {
  font-size: 28rpx;
  color: #fff;
  font-weight: 600;
}

.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
  gap: 12rpx;
}

.comment-nickname {
  font-size: 26rpx;
  color: var(--text-primary);
  font-weight: 600;
  flex-shrink: 0;
}

.comment-header-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.comment-time {
  font-size: 22rpx;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.comment-more-btn {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.comment-more-btn:active {
  background: #F5F5F5;
}

.more-icon {
  width: 32rpx;
  height: 32rpx;
}

.comment-text {
  font-size: 26rpx;
  color: var(--text-secondary);
  line-height: 1.6;
}

.empty-comment {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: var(--text-tertiary);
}

.comment-input-bar {
  display: flex;
  align-items: center;
  padding: 20rpx 40rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 2rpx solid #F0F0F0;
  background: #fff;
  gap: 20rpx;
}

.comment-input {
  flex: 1;
  height: 72rpx;
  background: #F5F5F5;
  border-radius: 36rpx;
  padding: 0 30rpx;
  font-size: 28rpx;
}

.comment-submit-btn {
  padding: 16rpx 32rpx;
  background: linear-gradient(135deg, #FF8C42 0%, #FFB347 100%);
  border-radius: 36rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 140, 66, 0.3);
}

.comment-submit-btn:active {
  transform: scale(0.95);
}

.submit-text {
  font-size: 26rpx;
  color: #fff;
  font-weight: 600;
}

/* 评论头像图片 */
.comment-avatar-img {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  margin-right: 20rpx;
  flex-shrink: 0;
}

/* 评论内联编辑 */
.comment-edit-box {
  margin-top: 12rpx;
}

.comment-edit-input {
  width: 100%;
  min-height: 120rpx;
  padding: 16rpx;
  font-size: 26rpx;
  line-height: 1.5;
  box-sizing: border-box;
  border: 2rpx solid #E0E0E0;
  border-radius: 12rpx;
  background: #FAFAFA;
}

.comment-edit-btns {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 12rpx;
}

.edit-cancel {
  padding: 10rpx 24rpx;
  font-size: 24rpx;
  color: #666;
  background: #F5F5F5;
  border-radius: 24rpx;
}

.edit-confirm {
  padding: 10rpx 24rpx;
  font-size: 24rpx;
  color: #fff;
  background: linear-gradient(135deg, #FF8C42 0%, #FFB347 100%);
  border-radius: 24rpx;
}

/* 评论操作按钮 */
.comment-actions {
  display: flex;
  gap: 24rpx;
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #F0F0F0;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  background: #F8F8F8;
}

.action-item:active {
  background: #F0F0F0;
}

.action-item.delete {
  background: #FFF5F5;
}

.action-icon {
  width: 28rpx;
  height: 28rpx;
}

.action-text {
  font-size: 24rpx;
  color: #666;
}

.action-text.delete-text {
  color: #FF6B6B;
}

/* 打卡图分享弹窗 */
.share-card-modal {
  height: auto;
  max-height: 90vh;
  padding-bottom: 40rpx;
}

.share-card-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 30rpx;
}

.share-canvas {
  width: 300px;
  height: 400px;
  border-radius: 20rpx;
  box-shadow: 0 8rpx 30rpx rgba(0,0,0,0.15);
  display: none;
}

.share-card-container {
  width: 280px;
  height: 360px;
  background: #ffffff;
  border-radius: 14px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(255, 140, 66, 0.3);
}

.hidden-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
  width: 280px;
  height: 360px;
  opacity: 0;
  pointer-events: none;
}

.share-card-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 60%;
  object-fit: cover;
}

.ticket-header {
  position: relative;
  z-index: 1;
  padding: 20px 15px 15px;
  text-align: center;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.ticket-brand {
  display: block;
  font-size: 12px;
  font-weight: bold;
  letter-spacing: 3px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.ticket-date {
  display: block;
  font-size: 11px;
  opacity: 0.8;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.ticket-route {
  display: flex;
  align-items: center;
  justify-content: center;
}

.route-from, .route-to {
  font-size: 24px;
  font-weight: bold;
}

.route-plane {
  display: flex;
  align-items: center;
  margin: 0 12px;
}

.plane-line {
  width: 25px;
  height: 2px;
  background: rgba(255,255,255,0.6);
}

.plane-icon {
  font-size: 16px;
  margin: 0 6px;
}

.ticket-divider {
  position: absolute;
  top: 60%;
  left: 0;
  right: 0;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 10;
  background: #fff;
}

.divider-circle {
  width: 18px;
  height: 18px;
  background: #f5f5f5;
  border-radius: 50%;
  position: absolute;
  z-index: 2;
}

.divider-circle.left {
  left: -9px;
}

.divider-circle.right {
  right: -9px;
}

.divider-dash {
  flex: 1;
  height: 2px;
  background: repeating-linear-gradient(
    90deg,
    #ddd 0px,
    #ddd 6px,
    transparent 6px,
    transparent 12px
  );
  margin: 0 15px;
}

.ticket-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40%;
  background: #fff;
  padding: 12px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.ticket-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.ticket-section {
  text-align: center;
  flex: 1;
}

.section-label {
  display: block;
  font-size: 11px;
  color: #999;
  margin-bottom: 6px;
  letter-spacing: 1px;
}

.section-value-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
}

.section-value {
  font-size: 28px;
  font-weight: bold;
  color: #FF8C42;
  line-height: 1;
}

.section-unit {
  font-size: 12px;
  color: #666;
  margin-left: 4px;
}

.ticket-divider-vertical {
  width: 1px;
  height: 30px;
  background: #eee;
}

.ticket-footer {
  text-align: center;
  padding: 6px 0;
}

.ticket-slogan {
  display: block;
  font-size: 11px;
  color: #999;
  letter-spacing: 2px;
}
</style>
