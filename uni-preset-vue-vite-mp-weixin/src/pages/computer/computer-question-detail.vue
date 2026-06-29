<script setup>
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue';
import { request } from '../../api/request';
import { transformContextString } from '../../utils/latex';
import { processStem, countBlanks } from './utils/questionUtils';
import SvgIcon from '../../components/SvgIcon/SvgIcon.vue';
import { checkTextContent } from '@/utils/contentSecurity.js';
import MembershipModal from '@/components/MembershipModal/MembershipModal.vue';
import { checkAccess, recordQuestionView, getFreeLimit } from '@/composables/useMembershipCheck.js';

const FREE_LIMIT = getFreeLimit();
const isMember = ref(false);
const showMemberModal = ref(false);
const memberSubjectKey = ref('computer');
const memberPriceInfo = ref(null);

const closeMemberModal = () => { showMemberModal.value = false; };
const onMemberSubscribeSuccess = () => { isMember.value = true; showMemberModal.value = false; };
const onMemberLoginRequired = () => {
  showMemberModal.value = false;
  uni.showModal({
    title: '提示', content: '请先登录后再开通会员',
    confirmText: '去登录',
    success: (res) => { if (res.confirm) uni.navigateTo({ url: '/pages/login/login' }); }
  });
};

const statusBarHeight = ref(0);
const question = ref(null);
const loading = ref(true);
const showAnswer = ref(false);
const isFavorite = ref(false);
const studyMode = ref('practice'); // 'practice', 'test', 'recite'
const isDark = ref(false);
const questionList = ref([]); // 题目ID列表
const currentIndex = ref(0);
const showAnswerSheet = ref(false);
const showFeedback = ref(false);
const showSettings = ref(false);
const showAddNote = ref(false);
const noteContent = ref('');
const notes = ref([]);
const noteTab = ref('public'); // 'public', 'private'
const noteSortBy = ref('time'); // 'time', 'like'

const settings = ref({
  nightMode: false,
  recitationMode: false,
  autoNext: true,
  fontSizeLevel: 'standard', // small, standard, large, extra
  showVideoAnalysis: true
});

const currentUserId = ref(uni.getStorageSync('userId'));
const editingNote = ref(null);

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  
  // 如果是北京时间，加上时区偏移 (如果后端返回的是 UTC)
  // 这里假设后端返回的是标准 ISO 格式
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  if (year === now.getFullYear()) {
    return `${month}-${day} ${hours}:${minutes}`;
  }
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const dynamicFontSize = computed(() => {
  const levels = {
    small: { title: '30rpx', option: '28rpx', explanation: '28rpx', content: '28rpx' },
    standard: { title: '34rpx', option: '32rpx', explanation: '30rpx', content: '30rpx' },
    large: { title: '38rpx', option: '36rpx', explanation: '34rpx', content: '34rpx' },
    extra: { title: '42rpx', option: '40rpx', explanation: '38rpx', content: '38rpx' }
  };
  return levels[settings.value.fontSizeLevel] || levels.standard;
});
const feedbackType = ref('题目纠错');
const feedbackContent = ref('');
const wrongBookAdded = ref(false);
const answeredQuestions = ref([]); // 已回答的题目进度列表 (包含 QuestionID, UserAnswer, IsCorrect)
const answeredIds = computed(() => answeredQuestions.value.map(item => item.QuestionID));
const wrongQuestions = ref([]); // 回答错误的题目ID列表
const questionTags = ref([]); // 题目自定义标签列表 (已弃用，移至列表页)

const userChoice = ref(null);
const multiChoice = ref([]); // 多选题用户的答案
const subAnswers = ref({}); // 解答题小题用户的答案
const blankAnswers = ref([]); // 填空题用户的答案

const currentContext = ref('default');

const getTypeName = (type) => {
  const types = {
    1: '单选题',
    2: '多选题',
    3: '填空题',
    4: '解答题',
    5: '判断题'
  };
  return types[type] || '其他题型';
};

const goHome = () => {
  uni.switchTab({
    url: '/pages/index/index'
  });
};

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 0;

  // 初始化设置
  const savedSettings = uni.getStorageSync('practice_settings');
  if (savedSettings) {
    settings.value = { ...settings.value, ...JSON.parse(savedSettings) };
    isDark.value = settings.value.nightMode;
    studyMode.value = settings.value.recitationMode ? 'recite' : 'practice';
  } else {
    // 兼容旧的主题设置
    const savedTheme = uni.getStorageSync('theme');
    isDark.value = savedTheme === 'dark';
    settings.value.nightMode = isDark.value;
  }

  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options || {};
  let questionId = options.questionId;
  currentContext.value = options.context || 'default';
  studyMode.value = options.mode || 'practice';

  // 获取题目列表（如果有的话，用于上下题导航）
  const savedList = uni.getStorageSync('computer_question_list');
  if (savedList) {
    questionList.value = JSON.parse(savedList);
  }

  // 获取已回答题目列表 (必须在 fetchQuestionDetail 之前)
  await fetchAnsweredQuestions();

  // 如果没有传入 questionId，尝试从本地缓存获取上次刷题的位置
  if (!questionId) {
    const lastId = uni.getStorageSync(`last_pos_${currentContext.value}`);
    if (lastId && questionList.value.includes(parseInt(lastId))) {
      questionId = lastId;
      uni.showToast({ title: '已自动回到上次刷题位置', icon: 'none' });
    } else if (questionList.value.length > 0) {
      questionId = questionList.value[0];
    }
  }

  if (questionId) {
      currentIndex.value = questionList.value.indexOf(parseInt(questionId));
      if (currentIndex.value === -1) currentIndex.value = 0;
      
      await fetchQuestionDetail(questionId);
      await checkFavoriteStatus(questionId);
      await checkWrongBookStatus(questionId);
      
      // 记录刷题进度：保存当前题目ID作为上次刷题位置
      uni.setStorageSync(`last_pos_${currentContext.value}`, questionId);
    }

  // #ifdef H5
  // 手动绑定 wheel 事件以支持 non-passive 模式，从而可以 preventDefault
  nextTick(() => {
    const container = document.querySelector('.app-container');
    if (container) {
      container.addEventListener('wheel', onWheel, { passive: false });
    }
  });
  // #endif
});

// #ifdef H5
onUnmounted(() => {
  const container = document.querySelector('.app-container');
  if (container) {
    container.removeEventListener('wheel', onWheel);
  }
});
// #endif

const fetchAnsweredQuestions = async () => {
  try {
    const res = await request({
      url: '/computer1/progress/list',
      data: { context: currentContext.value }
    });
    answeredQuestions.value = res.data || [];
    wrongQuestions.value = (res.data || []).filter(item => item.IsCorrect === 0).map(item => item.QuestionID);
  } catch (e) {
    console.error('获取已做题目列表失败:', e);
  }
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  uni.setStorageSync('theme', isDark.value ? 'dark' : 'light');
};

const toggleStudyMode = () => {
  studyMode.value = studyMode.value === 'recite' ? 'practice' : 'recite';
  if (studyMode.value === 'recite') {
    showAnswer.value = true;
  } else {
    showAnswer.value = false;
  }
};

const changeFontSize = (delta) => {
  fontSize.value = Math.max(12, Math.min(24, fontSize.value + delta));
};

const scrollTop = ref(0);
const oldScrollTop = ref(0);

// 滑动切换题目逻辑
const touchStartX = ref(0);
const touchStartY = ref(0);
const isMouseDown = ref(false); // 增加鼠标点击状态
const minSwipeDistance = 40; // 稍微减小最小滑动距离，提高灵敏度
const wheelCooldown = ref(false); // 滚轮防抖锁

const onTouchStart = (e) => {
  // 兼容触摸和鼠标
  const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
  const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
  touchStartX.value = clientX;
  touchStartY.value = clientY;
  if (e.type === 'mousedown') isMouseDown.value = true;
};

const onTouchEnd = (e) => {
  if (e.type === 'mouseup') {
    if (!isMouseDown.value) return;
    isMouseDown.value = false;
  }

  const clientX = e.type === 'touchend' ? e.changedTouches[0].clientX : e.clientX;
  const clientY = e.type === 'touchend' ? e.changedTouches[0].clientY : e.clientY;
  
  const deltaX = clientX - touchStartX.value;
  const deltaY = clientY - touchStartY.value;

  // 确保是水平滑动且距离足够，且水平滑动距离大于垂直滑动距离
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
    if (deltaX > 20) { // 右滑：上一题
      if (currentIndex.value > 0) {
        goToQuestion(currentIndex.value - 1);
      } else {
        uni.showToast({ title: '已经是第一题了', icon: 'none' });
      }
    } else if (deltaX < -20) { // 左滑：下一题
      if (currentIndex.value < questionList.value.length - 1) {
        goToQuestion(currentIndex.value + 1);
      } else {
        uni.showToast({ title: '已经是最后一题了', icon: 'none' });
      }
    }
  }
};

const onWheel = (e) => {
  // 只有当水平滚动明显大于垂直滚动时才触发切题
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20) {
    // 阻止浏览器默认的水平滑动行为（如回退/前进）
    if (e.cancelable) e.preventDefault();
    
    if (wheelCooldown.value) return;
    
    wheelCooldown.value = true;
    if (e.deltaX < 0) { // 向右滚/滑：上一题
      if (currentIndex.value > 0) {
        goToQuestion(currentIndex.value - 1);
      } else {
        uni.showToast({ title: '已经是第一题了', icon: 'none' });
      }
    } else { // 向左滚/滑：下一题
      if (currentIndex.value < questionList.value.length - 1) {
        goToQuestion(currentIndex.value + 1);
      } else {
        uni.showToast({ title: '已经是最后一题了', icon: 'none' });
      }
    }
    
    // 设置 500ms 冷却时间，防止连续触发
    setTimeout(() => {
      wheelCooldown.value = false;
    }, 500);
  }
};

const onScroll = (e) => {
  oldScrollTop.value = e.detail.scrollTop;
};

// 判断题目是否已答对
const isCorrectlyAnswered = computed(() => {
  if (!question.value) return false;
  const progress = answeredQuestions.value.find(p => p.QuestionID === question.value.question_id);
  return progress && progress.IsCorrect === 1;
});

const goToQuestion = async (index) => {
  if (index < 0 || index >= questionList.value.length) return;
  const nextId = questionList.value[index];
  currentIndex.value = index;
  showAnswerSheet.value = false;

  // 会员检查：第20题及以后需要检查会员状态
  if (index >= FREE_LIMIT && !isMember.value) {
    checkAccess(index);
  }

  // 记录做题次数
  recordView();

  // 重置临时答题状态
  userChoice.value = null;
  multiChoice.value = [];
  subAnswers.value = {};
  blankAnswers.value = [];
  
  // 核心逻辑：先通过 answeredIds 判断是否已做过，如果已做过，展开解析
  const hasDone = answeredIds.value.includes(nextId);
  if (hasDone) {
    showAnswer.value = true;
  } else {
    showAnswer.value = studyMode.value === 'recite';
  }
  
  // 滚动到顶部
  scrollTop.value = oldScrollTop.value;
  nextTick(() => {
    scrollTop.value = 0;
  });

  await fetchQuestionDetail(nextId);
  await checkFavoriteStatus(nextId);
  await checkWrongBookStatus(nextId);
  uni.setStorageSync(`last_pos_${currentContext.value}`, nextId);

  // 自动滚动到顶部
  uni.pageScrollTo({
    scrollTop: 0,
    duration: 200
  });
};

const checkWrongBookStatus = async (questionId) => {
  // 假设后端有检查错题本状态的接口，如果没有则通过本地或通用逻辑判断
  try {
    const res = await request({ 
      url: '/computer1/wrong-book/check',
      data: { questionId }
    });
    wrongBookAdded.value = res.data.exists;
  } catch (e) {
    wrongBookAdded.value = false;
  }
};

const toggleWrongBook = async () => {
  try {
    const res = await request({ 
      url: '/computer1/wrong-book/toggle',
      method: 'POST',
      data: { questionId: question.value.question_id }
    });
    wrongBookAdded.value = res.data.added;
    uni.showToast({
      title: wrongBookAdded.value ? '已加入错题本' : '已从错题本移除',
      icon: 'none'
    });
  } catch (error) {
    console.error('操作错题本失败:', error);
  }
};

const submitFeedback = async () => {
  if (!feedbackContent.value.trim()) {
    uni.showToast({ title: '请输入反馈内容', icon: 'none' });
    return;
  }

  // 内容安全检测
  uni.showLoading({ title: '内容检测中...' });
  const checkResult = await checkTextContent(feedbackContent.value);
  uni.hideLoading();

  if (!checkResult.isSafe) {
    uni.showToast({
      title: checkResult.message,
      icon: 'none',
      duration: 3000
    });
    return;
  }

  try {
    await request({
      url: '/computer1/feedback',
      method: 'POST',
      data: {
        questionId: question.value.question_id,
        type: feedbackType.value,
        content: feedbackContent.value
      }
    });
    uni.showToast({ title: '反馈提交成功', icon: 'success' });
    showFeedback.value = false;
    feedbackContent.value = '';
  } catch (error) {
    console.error('提交反馈失败:', error);
  }
};

const saveSettings = () => {
  uni.setStorageSync('practice_settings', JSON.stringify(settings.value));
};

const toggleSetting = (key) => {
  settings.value[key] = !settings.value[key];
  if (key === 'nightMode') {
    isDark.value = settings.value.nightMode;
  } else if (key === 'recitationMode') {
    studyMode.value = settings.value.recitationMode ? 'recite' : 'practice';
    showAnswer.value = settings.value.recitationMode;
  }
  saveSettings();
};

const replyTo = ref(null);
const replyContent = ref('');

const fetchNotes = async (questionId) => {
  if (!questionId) return;
  try {
    const res = await request({
      url: '/computer1/notes',
      data: {
        questionId: questionId,
        tab: noteTab.value,
        sort: noteSortBy.value
      }
    });
    const parentNotes = res.data || [];
    // 为每个笔记获取回复
    const notesWithReplies = await Promise.all(parentNotes.map(async (note) => {
      try {
        const replyRes = await request({
          url: '/computer1/notes/replies',
          data: { noteId: note.note_id }
        });
        return {
          ...note,
          replies: replyRes.data || [],
          isRepliesExpanded: false
        };
      } catch (e) {
        console.error(`获取回复失败 for note ${note.note_id}:`, e);
        return { ...note, replies: [] };
      }
    }));
    notes.value = notesWithReplies;
  } catch (e) {
    console.error('获取笔记失败:', e);
  }
};

const openReply = (note) => {
  replyTo.value = { id: note.note_id, username: note.username };
  replyContent.value = '';
};

const submitReply = async () => {
  if (!replyContent.value.trim()) {
    uni.showToast({ title: '请输入回复内容', icon: 'none' });
    return;
  }
  
  try {
    await request({
      url: '/computer1/notes',
      method: 'POST',
      data: {
        questionId: question.value.question_id,
        content: replyContent.value,
        isPublic: 1,
        parentId: replyTo.value.id
      }
    });
    
    uni.showToast({ title: '回复成功', icon: 'success' });
    replyTo.value = null;
    replyContent.value = '';
    fetchNotes(question.value.question_id);
  } catch (error) {
    console.error('回复失败:', error);
    uni.showToast({ title: '回复失败', icon: 'none' });
  }
};

const submitNote = async () => {
  if (!noteContent.value.trim()) {
    uni.showToast({ title: '请输入笔记内容', icon: 'none' });
    return;
  }
  try {
    let res;
    if (editingNote.value) {
      res = await request({
        url: '/computer1/notes',
        method: 'PUT',
        data: {
          note_id: editingNote.value.note_id,
          content: noteContent.value,
          isPublic: 1
        }
      });
    } else {
      res = await request({
        url: '/computer1/notes',
        method: 'POST',
        data: {
          questionId: question.value.question_id,
          content: noteContent.value
        }
      });
    }
    
    if (res.code === 0) {
      uni.showToast({ title: editingNote.value ? '修改成功' : '发布成功', icon: 'success' });
      showAddNote.value = false;
      noteContent.value = '';
      editingNote.value = null;
      fetchNotes(question.value.question_id);
    }
  } catch (e) {
    console.error('发布笔记失败:', e);
    uni.showToast({ title: editingNote.value ? '修改失败' : '发布失败', icon: 'none' });
  }
};

const deleteReply = async (reply, parentNote) => {
  uni.showModal({
    title: '提示',
    content: '确定要删除这条回复吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const response = await request({
            url: '/computer1/notes',
            method: 'DELETE',
            data: { note_id: reply.note_id }
          });
          if (response.code === 0) {
            uni.showToast({ title: '删除成功', icon: 'success' });
            fetchNotes(question.value.question_id);
          }
        } catch (error) {
          uni.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    }
  });
};

const deleteNote = async (note) => {
  uni.showModal({
    title: '提示',
    content: '确定要删除这条笔记吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const response = await request({
            url: '/computer1/notes',
            method: 'DELETE',
            data: { note_id: note.note_id }
          });
          if (response.code === 0) {
            uni.showToast({ title: '删除成功', icon: 'success' });
            fetchNotes(question.value.question_id);
          }
        } catch (error) {
          uni.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    }
  });
};

const editNote = (note) => {
  editingNote.value = note;
  noteContent.value = note.content;
  showAddNote.value = true;
};

const showNoteActions = (note) => {
  const noteUserId = note.user_id || note.userId;
  const isMine = String(noteUserId) === String(currentUserId.value);
  const items = isMine ? ['修改', '删除'] : ['回复'];
  
  uni.showActionSheet({
    itemList: items,
    success: (res) => {
      if (isMine) {
        if (res.tapIndex === 0) editNote(note);
        else if (res.tapIndex === 1) deleteNote(note);
      } else {
        if (res.tapIndex === 0) openReply(note);
      }
    }
  });
};

const showReplyActions = (reply, parentNote) => {
  const replyUserId = reply.user_id || reply.userId;
  const isMine = String(replyUserId) === String(currentUserId.value);
  if (!isMine) return;

  uni.showActionSheet({
    itemList: ['删除'],
    success: (res) => {
      if (res.tapIndex === 0) deleteReply(reply, parentNote);
    }
  });
};

const toggleNoteLike = async (note) => {
  try {
    const res = await request({
      url: '/computer1/notes/toggle-like',
      method: 'POST',
      data: {
        noteId: note.note_id
      }
    });
    note.is_liked = res.data.isLiked;
    note.like_count = res.data.likeCount;
  } catch (e) {
    console.error('点赞失败:', e);
  }
};

const toggleNoteSort = () => {
  noteSortBy.value = noteSortBy.value === 'time' ? 'like' : 'time';
  fetchNotes(question.value.question_id);
};

const fetchQuestionDetail = async (questionId) => {
  loading.value = true;
  try {
    const res = await request({ 
      url: `/computer1/questions/${questionId}`
    });
    const data = res.data;
    
    // 获取笔记
    fetchNotes(questionId);
    
      // 数据处理函数
      const processData = (data) => {
        // 重置用户输入
        userChoice.value = null;
        multiChoice.value = [];
        subAnswers.value = {};
        blankAnswers.value = [];
        
        // 恢复之前的答题状态
        const progress = answeredQuestions.value.find(p => p.QuestionID === parseInt(questionId));
        if (progress && progress.UserAnswer) {
          try {
            if (data.exercise_type === 1 || data.exercise_type === 5) {
              userChoice.value = progress.UserAnswer;
            } else if (data.exercise_type === 2) {
              multiChoice.value = progress.UserAnswer.split(',').filter(v => v);
              userChoice.value = multiChoice.value.join(''); // 同步多选的 userChoice
            } else if (data.exercise_type === 3) {
              blankAnswers.value = JSON.parse(progress.UserAnswer);
            } else if (data.exercise_type === 4) {
              subAnswers.value = JSON.parse(progress.UserAnswer);
            }
          } catch (e) {
            console.error('恢复答题状态失败:', e);
          }
          showAnswer.value = true;
        } else {
          // 如果没有做过，根据模式决定是否显示答案
          showAnswer.value = studyMode.value === 'recite';
        }

      if (data.stem) {
        data.originalStem = data.stem; // 保存原始题干
        data.truncatedStem = null;

        // 如果是选择题或判断题且没有选项，尝试从题干中提取
        if ((data.exercise_type === 1 || data.exercise_type === 2 || data.exercise_type === 5) && (!data.options || data.options.length === 0)) {
          const options = [];
          // 改进的选项提取正则：支持更多格式，并将末尾分隔符设为可选
          const labelPattern = /(?:\\\(|\\\[|\$)?\s*(?:\\left\(\s*)?(?:\\mathrm\{|\\\{\\rm\s*|（|\()?([A-D])(?:\s*\})?(?:\s*\\right\))?(?:\s*）|\))?\s*(?:\\\)|\\\]|\$)?[\.\s\、\)\:]?/g;
          
          const matches = [];
          let m;
          const tempRegex = new RegExp(labelPattern);
          while ((m = tempRegex.exec(data.stem)) !== null) {
            matches.push({
              index: m.index,
              length: m[0].length,
              label: m[1],
              fullMatch: m[0]
            });
          }
          
          if (matches.length >= 2) {
            for (let i = 0; i < matches.length; i++) {
              const start = matches[i].index + matches[i].length;
              const end = (i < matches.length - 1) ? matches[i+1].index : data.stem.length;
              let content = data.stem.substring(start, end).trim();
              
              // 移除末尾可能的换行符或分段
              content = content.replace(/<br\s*\/?>/gi, '').replace(/\n/g, '').trim();

              options.push({
                option_key: matches[i].label,
                option_value: content
              });
            }
            data.options = options;
            // 从题干中截断选项部分，保存到 truncatedStem
            data.truncatedStem = data.stem.substring(0, matches[0].index).trim();
          } else {
            // 备用方案：更通用的普通匹配
            const optionRegex = /([A-D])[\.\s\、\)\:]\s*([\s\S]*?)(?=(?:\s*[A-D][\.\s\、\)\:])|$)/g;
            let match;
            const matches2 = [];
            while ((match = optionRegex.exec(data.stem)) !== null) {
              matches2.push({
                label: match[1],
                content: match[2].trim(),
                index: match.index
              });
            }
            if (matches2.length >= 2) {
              matches2.forEach(m => {
                options.push({
                  option_key: m.label,
                  option_value: m.content.replace(/<br\s*\/?>/gi, '').replace(/\n/g, '').trim()
                });
              });
              data.options = options;
              data.truncatedStem = data.stem.substring(0, matches2[0].index).trim();
            }
          }
        }

        const totalBlanks = countBlanks(data.stem);
        if (totalBlanks > 0) {
          blankAnswers.value = new Array(totalBlanks).fill('');
        }
        
        // 对题干进行通用处理
        data.stem = processStem(data.stem);
        data.originalStem = processStem(data.originalStem);
        if (data.truncatedStem) {
          data.truncatedStem = processStem(data.truncatedStem);
        }
        
        // 处理选项中的 LaTeX
        if (data.options && data.options.length > 0) {
          data.options = data.options.map(opt => ({
            ...opt,
            option_value: processStem(opt.option_value)
          }));
        }

        // 如果是解答题且没有小题，初始化主答案
        if (data.exercise_type === 4 && (!data.subs || data.subs.length === 0)) {
          subAnswers.value['main'] = '';
        }
      }
      
      // 处理答案和解析中的 LaTeX 和标签
      if (data.exercise_type === 3 && (!data.answer || data.answer === '') && data.options && data.options.length > 0) {
        // 如果是填空题且没有 answer 字段，尝试从 options 构造
        const answers = data.options.map(opt => opt.option_value || '');
        data.answer = JSON.stringify(answers);
      }

      if (data.answer) {
        data.originalAnswer = data.answer; // 保存原始答案用于校验
        if (data.exercise_type === 3) {
          try {
            const answers = JSON.parse(data.answer);
            if (Array.isArray(answers)) {
              data.answer = answers.map((ans, i) => `<div class="blank-answer-item"><span class="blank-num">(${i + 1})</span> <span class="blank-val">${ans}</span></div>`).join('');
            }
          } catch (e) {
            // 非 JSON 格式保持原样
          }
        }
        data.answer = processStem(data.answer);
      }
      if (data.analysis) data.analysis = processStem(data.analysis);
      if (data.commentary) data.commentary = processStem(data.commentary);
      if (data.method) data.method = processStem(data.method);
      
      if (data.subs) {
        data.subs.forEach((sub, index) => {
          // 初始化小题答案
          subAnswers.value[sub.sub_id || index] = '';
          
          if (sub.stem) {
            sub.stem = processStem(sub.stem);
          }
          if (sub.answer) sub.answer = processStem(sub.answer);
          if (sub.analysis) sub.analysis = processStem(sub.analysis);
        });
      }
      
      return data;
    };

    question.value = processData(res.data);
  } catch (error) {
    console.error('获取题目详情失败:', error);
  } finally {
    loading.value = false;
  }
};

const checkFavoriteStatus = async (questionId) => {
  try {
    const res = await request({ 
      url: '/computer1/favorites/check',
      data: { questionId }
    });
    isFavorite.value = res.data.isFavorite;
    // 获取题目标签
    questionTags.value = res.data.tags || [];
  } catch (error) {
    console.error('检查收藏状态失败:', error);
  }
};

const toggleFavorite = async () => {
  try {
    const res = await request({ 
      url: '/computer1/favorites/toggle',
      method: 'POST',
      data: { questionId: question.value.question_id }
    });
    isFavorite.value = res.data.isFavorite;
    uni.showToast({
      title: res.message,
      icon: 'none'
    });
  } catch (error) {
    console.error('切换收藏状态失败:', error);
  }
};

const selectOption = async (option) => {
  if (showAnswer.value) return;
  
  // 多选题逻辑 (exercise_type === 2)
  if (question.value.exercise_type === 2) {
    const index = multiChoice.value.indexOf(option.option_key);
    if (index > -1) {
      multiChoice.value.splice(index, 1);
    } else {
      multiChoice.value.push(option.option_key);
      multiChoice.value.sort(); // 保持 A,B,C 顺序
    }
    userChoice.value = multiChoice.value.join('');
  } else {
    // 单选和判断
    userChoice.value = option.option_key;
    // 单选/判断立即提交
    await submitAnswer();
  }
};

const submitAnswer = async () => {
  if (showAnswer.value) return;

  // 对于多选，如果没有选择则提示
  if (question.value.exercise_type === 2 && multiChoice.value.length === 0) {
    uni.showToast({ title: '请选择答案', icon: 'none' });
    return;
  }
  
  // 对于单选/判断，如果没有选择则提示
  if ((question.value.exercise_type === 1 || question.value.exercise_type === 5) && !userChoice.value) {
    uni.showToast({ title: '请选择答案', icon: 'none' });
    return;
  }

  showAnswer.value = true;
  if (!answeredIds.value.includes(question.value.question_id)) {
    answeredQuestions.value.push({ QuestionID: question.value.question_id });
  }
  
  // 判断对错并加入错题列表
  let isCorrect = false;
  const type = question.value.exercise_type;
  const answer = question.value.originalAnswer || question.value.answer;

  if (type === 1 || type === 5) {
    // 单选和判断
    isCorrect = userChoice.value === answer;
  } else if (type === 2) {
    // 多选
    isCorrect = userChoice.value === answer;
  } else if (type === 3) {
    // 填空题校验
    try {
      const correctAnswers = JSON.parse(answer);
      if (Array.isArray(correctAnswers)) {
        isCorrect = blankAnswers.value.length === correctAnswers.length && 
                    blankAnswers.value.every((ans, i) => (ans || '').trim() === (correctAnswers[i] || '').trim());
      } else {
        isCorrect = blankAnswers.value[0] === answer;
      }
    } catch (e) {
      isCorrect = blankAnswers.value[0] === answer;
    }
  } else {
    // 解答题暂定为对
    isCorrect = true;
  }
      
  if (!isCorrect && !wrongQuestions.value.includes(question.value.question_id)) {
    wrongQuestions.value.push(question.value.question_id);
  } else if (isCorrect) {
    const index = wrongQuestions.value.indexOf(question.value.question_id);
    if (index > -1) wrongQuestions.value.splice(index, 1);
  }

  // 错题本逻辑
  if (type !== 4) { // 非解答题才自动操作错题本
    if (!isCorrect && !wrongBookAdded.value) {
      toggleWrongBook();
    } else if (isCorrect && wrongBookAdded.value) {
      toggleWrongBook();
    }
  }

  // 更新学习进度
  await updateProgress(isCorrect);

  // 做对自动下一题
  if (type !== 4 && isCorrect && settings.value.autoNext && currentIndex.value < questionList.value.length - 1) {
    setTimeout(() => {
      goToQuestion(currentIndex.value + 1);
    }, 800);
  }
};

const updateProgress = async (isCorrect) => {
  try {
    let lastAnswer = userChoice.value;
    if (question.value.exercise_type === 2) {
      lastAnswer = multiChoice.value.join(',');
    } else if (question.value.exercise_type === 3) {
      lastAnswer = JSON.stringify(blankAnswers.value);
    } else if (question.value.exercise_type === 4) {
      lastAnswer = JSON.stringify(subAnswers.value);
    }

    await request({
      url: '/computer1/progress',
      method: 'POST',
      data: {
        questionId: question.value.question_id,
        status: 'completed',
        lastAnswer: lastAnswer,
        isCorrect: isCorrect ? 1 : 0,
        context: currentContext.value
      }
    });

    // 同步更新本地状态
    const qId = question.value.question_id;
    const existingIndex = answeredQuestions.value.findIndex(p => p.QuestionID === qId);
    const newProgress = {
      QuestionID: qId,
      UserAnswer: lastAnswer,
      IsCorrect: isCorrect ? 1 : 0
    };

    if (existingIndex > -1) {
      answeredQuestions.value[existingIndex] = newProgress;
    } else {
      answeredQuestions.value.push(newProgress);
    }

    // 更新错误题目列表
    const wrongIndex = wrongQuestions.value.indexOf(qId);
    if (!isCorrect && wrongIndex === -1) {
      wrongQuestions.value.push(qId);
    } else if (isCorrect && wrongIndex > -1) {
      wrongQuestions.value.splice(wrongIndex, 1);
    }
  } catch (error) {
    console.error('更新进度失败:', error);
  }
};

const goBack = () => {
  uni.navigateBack();
};

const previewImage = (content) => {
  // 从 HTML 字符串中提取所有图片链接
  const imgRegex = /<img[^>]+src="([^">]+)"/g;
  const urls = [];
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }
  
  if (urls.length > 0) {
    uni.previewImage({
      urls: urls,
      current: urls[0]
    });
  }
};

const handleContentClick = (e, content) => {
  // 检查点击的是否是图片
  if (e.target.tagName === 'IMG' || (e.detail && e.detail.target && e.detail.target.tagName === 'IMG')) {
    const src = e.target.src || (e.detail && e.detail.target && e.detail.target.src);
    if (src) {
      // 提取所有图片用于预览
      const imgRegex = /<img[^>]+src="([^">]+)"/g;
      const urls = [];
      let match;
      while ((match = imgRegex.exec(content)) !== null) {
        urls.push(match[1]);
      }
      
      uni.previewImage({
        urls: urls.length > 0 ? urls : [src],
        current: src
      });
    }
  }
};
</script>

<template>
  <view 
      class="app-container" 
      :class="{ 'dark-mode': isDark }" 
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
      @mousedown="onTouchStart"
      @mouseup="onTouchEnd"
      @wheel="onWheel"
    >
    <view class="custom-nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-left">
          <view class="back-btn" @click="goBack">
            <text class="back-icon">❮</text>
          </view>
        </view>
        
        <view class="nav-title">
          <text>{{ question?.exam_full_name || question?.chapter_name || '计算机刷题' }}</text>
          <text class="progress-text" v-if="questionList.length > 0">
            ({{ currentIndex + 1 }}/{{ questionList.length }})
          </text>
        </view>
        
        <view class="nav-right">
          <view class="nav-tool-btn" @click="goHome">
            <SvgIcon name="home" size="40" fill="#fff" />
          </view>
          <view class="nav-tool-btn" @click="showSettings = true">
            <SvgIcon name="settings" size="40" fill="#fff" />
          </view>
        </view>
      </view>
      <!-- 进度条 -->
      <view class="progress-bar-container" v-if="questionList.length > 0">
        <view class="progress-bar-fill" :style="{ width: ((currentIndex + 1) / questionList.length * 100) + '%' }"></view>
      </view>
    </view>

    <scroll-view 
        scroll-y 
        class="content-scroll" 
        :scroll-top="scrollTop"
        @scroll="onScroll"
      >
      <view v-if="loading" class="loading-state">
        <text>正在加载题目详情...</text>
      </view>
      <view v-else-if="!question" class="no-data">
        <text>题目不存在</text>
      </view>
      <view v-else class="question-detail">
        <!-- 题目元信息 -->
        <view class="question-info" v-if="question">
          <view class="info-left">
            <text class="info-item type">{{ question.exercise_type_name || getTypeName(question.exercise_type) }}</text>
            <text class="info-item chapter-tag" v-if="question.chapter_name || question.tags?.[0]?.tag_name">
              {{ question.chapter_name || question.tags?.[0]?.tag_name }}
            </text>
          </view>
        </view>

        <!-- 题干 -->
        <view class="stem-section" @click="handleContentClick($event, question.stem)">
          <view class="stem-text" v-html="studyMode === 'test' ? (question.truncatedStem || question.stem) : (question.originalStem || question.stem)"></view>
        </view>

        <!-- 填空题输入区 -->
        <view class="blanks-input-section" v-if="blankAnswers.length > 0">
          <view v-for="(answer, index) in blankAnswers" :key="index" class="blank-input-item">
            <text class="blank-label">填空 ({{ index + 1 }})</text>
            <input 
              class="blank-input" 
              v-model="blankAnswers[index]" 
              placeholder="请输入答案"
              :disabled="showAnswer"
              @blur="updateProgress(false)"
            />
          </view>
        </view>

        <!-- 解答题主输入区 -->
        <view class="saq-input-section" v-if="question.exercise_type === 4 && (!question.subs || question.subs.length === 0)">
          <textarea 
            class="saq-input" 
            v-model="subAnswers['main']" 
            placeholder="请输入您的答案..."
            :disabled="showAnswer"
            @blur="updateProgress(true)"
          />
        </view>

        <!-- 选项 (单选/多选/判断) -->
        <view class="options-section" v-if="question.exercise_type !== 3 && (studyMode === 'test' || !question.truncatedStem) && question.options && question.options.length > 0">
          <view 
            v-for="option in question.options" 
            :key="option.option_key"
            class="option-item"
            :class="{
              'selected': question.exercise_type === 2 ? multiChoice.includes(option.option_key) : userChoice === option.option_key,
              'correct': showAnswer && (question.answer || '').includes(option.option_key),
              'wrong': showAnswer && (question.exercise_type === 2 ? multiChoice.includes(option.option_key) : userChoice === option.option_key) && !(question.answer || '').includes(option.option_key)
            }"
            @click="selectOption(option); handleContentClick($event, option.option_value)"
          >
            <view class="option-key">
              <text v-if="question.exercise_type === 2" class="multi-indicator">
                {{ multiChoice.includes(option.option_key) ? '✓' : '' }}
              </text>
              <text>{{ option.option_key }}</text>
            </view>
            <view class="option-value" v-html="option.option_value"></view>
          </view>
        </view>

        <!-- 查看答案/下一题 按钮 (移至题目下方) -->
        <view class="question-action-bar" v-if="question && !isCorrectlyAnswered">
          <button v-if="!showAnswer" class="submit-btn inline" @click="submitAnswer">查看答案</button>
          <button v-else-if="currentIndex < questionList.length - 1" class="next-btn inline" @click="goToQuestion(currentIndex + 1)">下一题</button>
        </view>

        <!-- 小题 (如果是综合题) -->
        <view class="subs-section" v-if="question.subs && question.subs.length > 0">
          <view v-for="(sub, index) in question.subs" :key="sub.sub_id" class="sub-item" @click="handleContentClick($event, sub.stem + sub.answer + sub.analysis)">
            <view class="sub-header">
              <text class="sub-index">({{ index + 1 }})</text>
              <text class="sub-score" v-if="sub.score">[{{ sub.score }}分]</text>
            </view>
            <view class="sub-stem" v-html="sub.stem"></view>
            
            <view class="sub-input-section" v-if="question.exercise_type === 4">
              <textarea 
                class="sub-input" 
                v-model="subAnswers[sub.sub_id || index]" 
                placeholder="请输入该小题的答案..."
                :disabled="showAnswer"
                @blur="updateProgress(true)"
              />
            </view>

            <view v-if="showAnswer" class="sub-answer-section">
              <view class="sub-answer">
                <text class="label">【答案】</text>
                <view v-html="sub.answer"></view>
              </view>
              <view class="sub-analysis" v-if="sub.analysis">
                <text class="label">【解析】</text>
                <view v-html="sub.analysis"></view>
              </view>
            </view>
          </view>
        </view>

        <!-- 答案和解析 -->
        <view class="answer-section" v-if="showAnswer" @click="handleContentClick($event, question.answer + question.analysis + question.commentary + question.method)">
          <!-- 选择题、判断题的网格化答案展示 -->
          <view v-if="[1, 2, 5].includes(question.exercise_type)" class="answer-grid-card">
            <view class="answer-grid">
              <view v-if="studyMode !== 'recite'" class="grid-item">
                <text class="label">我的答案</text>
                <text class="value" :class="{ 
                  'correct': userChoice === (question.originalAnswer || question.answer),
                  'error': userChoice && userChoice !== (question.originalAnswer || question.answer)
                }">
                  {{ userChoice || '无' }}
                </text>
              </view>
              <view class="grid-item">
                <text class="label">正确答案</text>
                <text class="value correct">{{ question.originalAnswer || question.answer }}</text>
              </view>
              <view v-if="studyMode !== 'recite'" class="grid-item">
                <text class="label">结果</text>
                <text class="value" :class="{ 
                  'correct': userChoice === (question.originalAnswer || question.answer),
                  'error': userChoice !== (question.originalAnswer || question.answer)
                }">
                  {{ userChoice === (question.originalAnswer || question.answer) ? '正确' : '错误' }}
                </text>
              </view>
            </view>
          </view>

          <!-- 填空、解答题的答案展示（仅当有答案时显示） -->
          <view v-else-if="question.answer && question.answer.trim() !== '' && question.answer.trim() !== '<p></p>'" class="answer-box">
            <view class="answer-title">正确答案</view>
            <view class="answer-content" v-html="question.answer"></view>
          </view>
          
          <view class="analysis-box" v-if="(settings.showVideoAnalysis && question.video_url) || (question.analysis && question.analysis.trim() !== '' && question.analysis.trim() !== '<p></p>') || (question.commentary && question.commentary.trim() !== '' && question.commentary.trim() !== '<p></p>') || (question.method && question.method.trim() !== '' && question.method.trim() !== '<p></p>') || (question.tags && question.tags.length > 0)">
            <view class="analysis-title">题目解析</view>
            <view class="analysis-content">
              <!-- 视频解析 -->
              <view v-if="settings.showVideoAnalysis && question.video_url" class="video-container">
                <video 
                  class="analysis-video" 
                  :src="question.video_url" 
                  controls
                  poster="/static/video-poster.png"
                ></video>
              </view>

              <view v-if="question.analysis && question.analysis.trim() !== '' && question.analysis.trim() !== '<p></p>'" v-html="question.analysis"></view>
              <view v-if="question.commentary && question.commentary.trim() !== '' && question.commentary.trim() !== '<p></p>'" class="extra-analysis">
                <text class="label">【点评】</text>
                <view v-html="question.commentary"></view>
              </view>
              <view v-if="question.method && question.method.trim() !== '' && question.method.trim() !== '<p></p>'" class="extra-analysis">
                <text class="label">【方法】</text>
                <view v-html="question.method"></view>
              </view>

              <!-- 考点标签 -->
              <view v-if="question.tags && question.tags.length > 0" class="tags-section">
                <view class="tags-title">考点：</view>
                <view class="tags-container">
                  <view v-for="tag in question.tags" :key="tag.tag_id" class="tag-item">
                    {{ tag.tag_name }}
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 笔记部分 -->
        <view class="notes-section" v-if="showAnswer || studyMode === 'recite'">
          <view class="notes-header">
            <view class="notes-title">
              <view class="title-line"></view>
              <text>笔记</text>
            </view>
            <view class="add-note-btn" @click="showAddNote = true">
              <SvgIcon name="edit" size="24" fill="currentColor" />
              <text>添加笔记</text>
            </view>
          </view>

          <view class="notes-sub-header">
            <view class="notes-tabs">
              <view 
                class="tab-item" 
                :class="{ active: noteTab === 'public' }"
                @click="noteTab = 'public'; fetchNotes(question.question_id)"
              >公开笔记</view>
              <view 
                class="tab-item" 
                :class="{ active: noteTab === 'private' }"
                @click="noteTab = 'private'; fetchNotes(question.question_id)"
              >个人笔记</view>
            </view>
            <view class="note-sort" @click="toggleNoteSort">
              <text>{{ noteSortBy === 'time' ? '最新发布' : '最多点赞' }}</text>
              <text class="sort-icon">⇅</text>
            </view>
          </view>

        <view class="notes-list" v-if="notes.length > 0">
          <view v-for="note in notes" :key="note.note_id" class="note-item">
            <view class="note-left">
              <image :src="note.avatar || note.avatar_url || note.user_avatar || '/static/avatar-default.png'" class="user-avatar" @error="note.avatar = '/static/avatar-default.png'"></image>
            </view>
            <view class="note-right">
              <view class="note-user-row">
                <text class="username">{{ note.username }}</text>
                <view class="note-meta">
                  <view class="more-btn" @click="showNoteActions(note)">
                    <SvgIcon name="more" size="32" fill="#999" />
                  </view>
                </view>
              </view>
              <view class="note-content" v-html="note.content"></view>
              <view class="note-footer">
                <view class="note-info-left">
                  <text class="time">{{ formatDate(note.create_time) }}</text>
                  <text class="reply-link" @click="openReply(note)">回复</text>
                </view>
                <view class="note-info-right">
                  <view class="footer-action" :class="{ active: note.is_liked }" @click="toggleNoteLike(note)">
                    <SvgIcon :name="note.is_liked ? 'like-fill' : 'like'" size="28" :fill="note.is_liked ? '#00bfa5' : '#999'" />
                    <text class="count" :class="{ 'active-like': note.is_liked }">{{ note.like_count || 0 }}</text>
                  </view>
                </view>
              </view>

              <!-- 回复列表 -->
              <view class="replies-container" v-if="note.replies && note.replies.length > 0">
                <view class="reply-toggle" @click="note.isRepliesExpanded = !note.isRepliesExpanded">
                  <text>{{ note.isRepliesExpanded ? '收起回复' : '展开 ' + note.replies.length + ' 条回复' }}</text>
                  <text class="arrow" :class="{ up: note.isRepliesExpanded }">⌄</text>
                </view>
                <view class="replies-list" v-if="note.isRepliesExpanded">
                  <view v-for="reply in note.replies" :key="reply.note_id" class="reply-item" @longpress="showReplyActions(reply, note)">
                    <view class="reply-header">
                      <text class="reply-user">{{ reply.username }}:</text>
                      <text 
                        v-if="String(reply.user_id || reply.userId) === String(currentUserId)" 
                        class="delete-reply-btn" 
                        @click.stop="deleteReply(reply, note)"
                      >删除</text>
                    </view>
                    <view class="reply-text" v-html="reply.content"></view>
                    <view class="reply-footer-row">
                      <text class="time">{{ formatDate(reply.create_time) }}</text>
                      <view class="footer-action" :class="{ active: reply.is_liked }" @click="toggleNoteLike(reply)">
                        <SvgIcon :name="reply.is_liked ? 'like-fill' : 'like'" size="24" :fill="reply.is_liked ? '#00bfa5' : '#999'" />
                        <text class="count" :class="{ 'active-like': reply.is_liked }">{{ reply.like_count || 0 }}</text>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
          <view v-else class="empty-notes">
            <text>还没有笔记，快来分享吧~</text>
          </view>
        </view>

        <view class="bottom-placeholder"></view>
      </view>
    </scroll-view>

    <!-- 回复弹窗 -->
    <view class="modal-mask" v-if="replyTo" @click="replyTo = null">
      <view class="reply-modal animated fadeInUp" @click.stop>
        <view class="modal-header">
          <text>回复 @{{ replyTo.username }}</text>
          <text class="close-btn" @click="replyTo = null">✕</text>
        </view>
        <view class="note-form">
          <textarea 
            v-model="replyContent" 
            placeholder="写下你的回复..." 
            class="note-input"
            auto-focus
            fixed
          ></textarea>
          <view class="modal-footer">
            <button class="cancel-btn" @click="replyTo = null">取消</button>
            <button class="note-submit" @click="submitReply">发送</button>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="action-section" v-if="question">
      <view class="nav-actions">
        <view class="nav-btn-group">
          <view class="nav-btn" @click="toggleFavorite" :class="{ 'active': isFavorite }">
            <SvgIcon :name="isFavorite ? 'star-fill' : 'star'" size="44" :fill="isFavorite ? '#ffc107' : '#666'" />
            <text class="btn-text">收藏</text>
          </view>
          <view class="nav-btn" @click="showAnswerSheet = true">
            <SvgIcon name="menu" size="44" fill="#666" />
            <text class="btn-text">答题卡</text>
          </view>
          <view class="nav-btn" @click="showFeedback = true">
            <SvgIcon name="warning" size="44" fill="#666" />
            <text class="btn-text">反馈</text>
          </view>
        </view>
        
        <view class="main-nav-btns">
          <view class="side-nav-btn" @click="goToQuestion(currentIndex - 1)" :class="{ 'disabled': currentIndex <= 0 }">
            <text>上一题</text>
          </view>
          <view class="side-nav-btn" @click="goToQuestion(currentIndex + 1)" :class="{ 'disabled': currentIndex >= questionList.length - 1 }">
            <text>下一题</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 答题卡弹窗 -->
    <view class="modal-mask" v-if="showAnswerSheet" @click="showAnswerSheet = false">
      <view class="answer-sheet-modal" @click.stop>
        <view class="modal-header">
          <text>答题卡</text>
          <view class="close-btn" @click="showAnswerSheet = false">
            <SvgIcon name="close" size="32" fill="#999" />
          </view>
        </view>
        <scroll-view scroll-y class="sheet-content">
          <view class="sheet-status-legend">
            <view class="legend-item"><view class="status-dot current"></view><text>当前</text></view>
            <view class="legend-item"><view class="status-dot done"></view><text>正确({{ answeredQuestions.length - wrongQuestions.length }})</text></view>
            <view class="legend-item"><view class="status-dot error"></view><text>错误({{ wrongQuestions.length }})</text></view>
            <view class="legend-item"><view class="status-dot undone"></view><text>未做({{ questionList.length - answeredQuestions.length }})</text></view>
          </view>
          <view class="sheet-grid">
            <view 
              v-for="(id, index) in questionList" 
              :key="id" 
              class="sheet-item"
              :class="{ 
                'current': index === currentIndex,
                'done': answeredIds.includes(id) && !wrongQuestions.includes(id),
                'error': wrongQuestions.includes(id)
              }"
              @click="goToQuestion(index)"
            >
              {{ index + 1 }}
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 反馈弹窗 -->
    <view class="modal-mask" v-if="showFeedback" @click="showFeedback = false">
      <view class="feedback-modal" @click.stop>
        <view class="modal-header">
          <text>题目反馈</text>
          <text class="close-btn" @click="showFeedback = false">✕</text>
        </view>
        <view class="feedback-form">
          <picker :range="['题目纠错', '内容不全', '答案错误', '其他问题']" @change="(e) => feedbackType = ['题目纠错', '内容不全', '答案错误', '其他问题'][e.detail.value]">
            <view class="picker-item">反馈类型：{{ feedbackType }}</view>
          </picker>
          <textarea class="feedback-input" v-model="feedbackContent" placeholder="请详细描述题目问题..."></textarea>
          <button class="feedback-submit" @click="submitFeedback">提交反馈</button>
        </view>
      </view>
    </view>

    <!-- 设置弹窗 -->
    <view class="modal-mask" v-if="showSettings" @click="showSettings = false">
      <view class="settings-modal" @click.stop>
        <view class="modal-header">
          <text>系统设置</text>
          <text class="close-btn" @click="showSettings = false">✕</text>
        </view>
        <view class="settings-list">
          <view class="setting-item">
            <text>背题模式</text>
            <switch :checked="settings.recitationMode" @change="toggleSetting('recitationMode')" color="#4db6ac" />
          </view>
          <view class="setting-item">
            <text>做对自动下一题</text>
            <switch :checked="settings.autoNext" @change="toggleSetting('autoNext')" color="#4db6ac" />
          </view>
          <view class="setting-item">
            <text>夜间模式</text>
            <switch :checked="settings.nightMode" @change="toggleSetting('nightMode')" color="#4db6ac" />
          </view>
          <view class="setting-item column">
            <text>字体大小</text>
            <view class="font-size-levels">
              <view 
                v-for="level in ['small', 'standard', 'large', 'extra']" 
                :key="level"
                class="level-item"
                :class="{ active: settings.fontSizeLevel === level }"
                @click="settings.fontSizeLevel = level; saveSettings();"
              >
                {{ {small: 'A较小', standard: 'A标准', large: 'A较大', extra: 'A超大'}[level] }}
              </view>
            </view>
          </view>
          <view class="setting-item">
            <text>视频解析</text>
            <switch :checked="settings.showVideoAnalysis" @change="toggleSetting('showVideoAnalysis')" color="#4db6ac" />
          </view>
        </view>
      </view>
    </view>

    <!-- 添加笔记弹窗 -->
    <view class="modal-mask" v-if="showAddNote" @click="showAddNote = false">
      <view class="note-modal" @click.stop>
        <view class="modal-header">
          <text>添加笔记</text>
          <text class="close-btn" @click="showAddNote = false">✕</text>
        </view>
        <view class="note-form">
          <textarea class="note-input" v-model="noteContent" placeholder="请输入您的笔记内容..." focus></textarea>
          <button class="note-submit" @click="submitNote">发布笔记</button>
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

<style scoped>
.app-container {
  --primary-color: #4db6ac;
  --bg-color: #f5f7fa;
  --card-bg: #ffffff;
  --text-main: #333333;
  --text-secondary: #666666;
  --text-light: #999999;
  --border-color: #f0f0f0;
  --accent-bg: #e0f2f1;
  --primary-gradient: linear-gradient(135deg, #4db6ac 0%, #00897b 100%);
  --shadow-lg: 0 10rpx 30rpx rgba(0,0,0,0.1);
  --base-font-size: 16px;
  
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
}

.app-container.dark-mode {
  --bg-color: #1a1a1a;
  --card-bg: #242424;
  --text-main: #cccccc;
  --text-secondary: #999999;
  --text-light: #666666;
  --border-color: #333333;
  --accent-bg: #1e3a3a;
}

.custom-nav-bar {
  background-color: var(--primary-color);
  z-index: 100;
  color: #ffffff;
  flex-shrink: 0;
}

.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  position: relative;
}

.nav-left {
  position: absolute;
  left: 30rpx;
  z-index: 10;
}

.nav-right {
  position: absolute;
  right: 30rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 15rpx;
  z-index: 10;
}

.nav-tool-btn {
  padding: 10rpx;
}

.tool-text-icon {
  font-size: 24rpx;
  font-weight: bold;
  color: #ffffff;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
}

.nav-title {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.nav-title text:first-child {
  font-size: 32rpx;
  font-weight: bold;
  color: #ffffff;
}

.progress-text {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.8);
}

.progress-bar-container {
  height: 4rpx;
  background: rgba(255, 255, 255, 0.2);
  width: 100%;
}

.progress-bar-fill {
  height: 100%;
  background: #ffffff;
  transition: width 0.3s;
}

.mode-toggle-btn {
  width: 50rpx;
  height: 50rpx;
  border-radius: 25rpx;
  border: 2rpx solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 24rpx;
}

.mode-toggle-btn.recite-active {
  background-color: #ffffff;
  color: var(--primary-color);
}

.mode-char {
  font-size: 24rpx;
  font-weight: bold;
}

.nav-tool-btn, .back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-icon {
  font-size: 36rpx;
}

.back-icon {
  font-size: 40rpx;
  color: #ffffff;
}

.question-detail {
  padding: 30rpx;
}

.question-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.info-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
  flex: 1;
}

.info-item.type, .info-item.chapter-tag {
  background: var(--accent-bg);
  color: var(--primary-color);
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 20rpx;
  max-width: 300rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-item.source {
  font-size: 20rpx;
  color: var(--text-light);
}

.info-actions {
  display: flex;
  gap: 16rpx;
}

.info-action-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
  background: var(--card-bg);
  padding: 8rpx 20rpx;
  border-radius: 30rpx;
  border: 1rpx solid var(--border-color);
}

.info-action-btn.active {
  color: var(--primary-color);
  border-color: var(--primary-color);
  background: var(--accent-bg);
}

.stem-section {
  line-height: 1.6;
  color: var(--text-main);
  margin-bottom: 40rpx;
}

.stem-text {
  line-height: 1.7;
  color: var(--text-main);
  font-size: v-bind('dynamicFontSize.title');
  word-break: break-word;
}

.option-value {
  flex: 1;
  font-size: v-bind('dynamicFontSize.option');
  line-height: 1.5;
  color: var(--text-main);
}

.blank-input {
  height: 80rpx;
  background: var(--card-bg);
  border: 2rpx solid var(--border-color);
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: v-bind('dynamicFontSize.content');
  width: 100%;
  box-sizing: border-box;
  transition: all 0.3s;
}

:deep(.blank-val) {
  color: var(--text-main);
  word-break: break-all;
  font-size: v-bind('dynamicFontSize.content');
}

.saq-input, .sub-input {
  width: 100%;
  height: 100rpx; /* 进一步减小高度 */
  background: var(--bg-color);
  border: 2rpx solid var(--border-color);
  border-radius: 20rpx;
  padding: 20rpx;
  font-size: v-bind('dynamicFontSize.content');
  box-sizing: border-box;
  color: var(--text-main);
  transition: all 0.3s;
  line-height: 1.6;
}

.sub-stem {
  font-size: v-bind('dynamicFontSize.title');
  line-height: 1.6;
  color: var(--text-main);
  margin-bottom: 10rpx;
}

.sub-stem :deep(p) {
  margin: 0;
  padding: 0;
}

.analysis-content, .sub-answer, .sub-analysis, .extra-analysis view {
  font-size: v-bind('dynamicFontSize.explanation');
  color: var(--text-main);
  line-height: 1.8;
}

.sub-answer-section {
  margin-top: 24rpx;
  padding: 24rpx;
  background: rgba(25, 118, 210, 0.05);
  border-radius: 12rpx;
  border-left: 6rpx solid var(--primary-color);
  font-size: v-bind('dynamicFontSize.explanation');
}

:deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8rpx;
}

.analysis-card {
  margin-top: 40rpx;
  background: var(--accent-bg);
  border-radius: 16rpx;
  padding: 30rpx;
}

.analysis-title {
  font-size: v-bind('dynamicFontSize.explanation');
  font-weight: bold;
  color: var(--primary-color);
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.analysis-content {
  font-size: v-bind('dynamicFontSize.explanation');
  color: var(--text-main);
  line-height: 1.8;
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #ffffff;
  display: flex;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -2rpx 10rpx rgba(0,0,0,0.05);
  gap: 20rpx;
}

.action-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: bold;
}

.action-btn.prev {
  background: var(--accent-bg);
  color: var(--primary-color);
}

.action-btn.next {
  background: var(--primary-color);
  color: #ffffff;
}

/* 填空题样式 */
.blanks-input-section {
  margin: 20rpx 0;
  padding: 20rpx;
  background: var(--bg-color);
  border-radius: 20rpx;
  border: 1rpx solid var(--border-color);
}

.blank-input-item {
  margin-bottom: 16rpx;
}

.blank-input-item:last-child {
  margin-bottom: 0;
}

.blank-label {
  font-size: 0.8em;
  color: var(--text-secondary);
  margin-bottom: 8rpx;
  display: block;
  font-weight: 500;
}

/* 填空题答案在详情区的样式 */
:deep(.blank-answer-item) {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
  padding: 6rpx 16rpx;
  background: rgba(25, 118, 210, 0.05);
  border-radius: 8rpx;
}

:deep(.blank-num) {
  font-weight: bold;
  color: var(--primary-color);
  margin-right: 12rpx;
  font-size: 0.85em;
}

:deep(.blank-val) {
  color: var(--text-main);
  word-break: break-all;
  font-size: v-bind('dynamicFontSize.content');
}

.blank-input {
  height: 80rpx;
  background: var(--card-bg);
  border: 2rpx solid var(--border-color);
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: v-bind('dynamicFontSize.content');
  width: 100%;
  box-sizing: border-box;
  transition: all 0.3s;
}

.blank-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4rpx rgba(25, 118, 210, 0.1);
}

.saq-input-section {
  margin: 10rpx 0;
}

.saq-input, .sub-input {
  width: 100%;
  height: 100rpx;
  background: var(--bg-color);
  border: 2rpx solid var(--border-color);
  border-radius: 20rpx;
  padding: 20rpx;
  font-size: v-bind('dynamicFontSize.content');
  box-sizing: border-box;
  color: var(--text-main);
  transition: all 0.3s;
  line-height: 1.6;
}

.saq-input:focus, .sub-input:focus {
  border-color: var(--primary-color);
  background: var(--card-bg);
  box-shadow: 0 0 0 4rpx rgba(25, 118, 210, 0.1);
}

.sub-item {
  margin-top: 10rpx;
  margin-bottom: 10rpx;
  padding: 24rpx;
  background: var(--card-bg);
  border-radius: 16rpx;
  border: 1rpx solid var(--border-color);
}

.option-item {
  display: flex;
  margin-top: 10rpx;
  margin-bottom: 10rpx;
  padding: 16rpx 24rpx;
  background: var(--card-bg);
  border: 2rpx solid var(--border-color);
  border-radius: 16rpx;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  align-items: center;
}

.option-item:active {
  transform: scale(0.99);
  background: var(--bg-color);
}

.option-item.selected {
  border-color: var(--primary-color);
  background: rgba(25, 118, 210, 0.04);
}

.option-item.correct {
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.04);
}

.option-item.wrong {
  border-color: #f44336;
  background: rgba(244, 67, 54, 0.04);
}

.option-key {
  width: 56rpx;
  height: 56rpx;
  min-width: 56rpx;
  font-weight: bold;
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
  border-radius: 50%;
  margin-right: 24rpx;
  font-size: v-bind('dynamicFontSize.option');
  border: 2rpx solid var(--border-color);
}

.option-item.selected .option-key {
  background: var(--primary-color);
  color: #fff;
  border-color: var(--primary-color);
}

.option-item.correct .option-key {
  background: #4caf50;
  color: #fff;
  border-color: #4caf50;
}

.option-item.wrong .option-key {
  background: #f44336;
  color: #fff;
  border-color: #f44336;
}

.option-value {
  flex: 1;
  font-size: v-bind('dynamicFontSize.option');
  line-height: 1.5;
  color: var(--text-main);
}

/* 综合题/小题样式 */
.subs-section {
  margin-top: 40rpx;
  border-top: 1rpx dashed var(--border-color);
  padding-top: 30rpx;
}

.sub-item {
  margin-bottom: 40rpx;
  padding: 24rpx;
  background: var(--bg-color);
  border-radius: 20rpx;
}

.sub-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 10rpx;
}

.sub-index {
  font-weight: bold;
  color: var(--primary-color);
  font-size: v-bind('dynamicFontSize.title');
}

.sub-score {
  font-size: 0.8em;
  color: var(--text-light);
}

.sub-stem {
  font-size: v-bind('dynamicFontSize.title');
  line-height: 1.6;
  color: var(--text-main);
  margin-bottom: 20rpx;
}

.sub-answer-section {
  margin-top: 24rpx;
  padding: 24rpx;
  background: rgba(25, 118, 210, 0.05);
  border-radius: 12rpx;
  border-left: 6rpx solid var(--primary-color);
}

.sub-answer, .sub-analysis {
  margin-bottom: 16rpx;
}

.sub-answer:last-child, .sub-analysis:last-child {
  margin-bottom: 0;
}

.sub-answer .label, .sub-analysis .label {
  font-weight: bold;
  color: var(--primary-color);
  font-size: v-bind('dynamicFontSize.explanation');
  margin-bottom: 8rpx;
  display: block;
}

/* 答案解析区域 */
.answer-section {
  margin-top: 40rpx;
  animation: fadeIn 0.3s ease;
}

  /* 答案网格展示 */
  .answer-grid-card {
    background: var(--card-bg);
    border-radius: 20rpx;
    padding: 30rpx;
    margin-bottom: 30rpx;
    box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05);
    border: 1rpx solid var(--border-color);
  }

  .answer-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20rpx;
    text-align: center;
  }

  .grid-item {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
    padding: 16rpx;
    background: var(--bg-color);
    border-radius: 12rpx;
  }

  .grid-item .label {
    font-size: 22rpx;
    color: var(--text-light);
  }

  .grid-item .value {
    font-size: 32rpx;
    font-weight: bold;
    color: var(--text-main);
  }

  .grid-item .value.correct {
    color: #4caf50;
  }

  .grid-item .value.error {
    color: #f44336;
  }

  .answer-box {
    background: rgba(76, 175, 80, 0.08);
    border-radius: 12rpx;
    padding: 24rpx;
    margin-bottom: 24rpx;
    border-left: 8rpx solid #4CAF50;
  }

.answer-title {
  font-size: v-bind('dynamicFontSize.explanation');
  font-weight: bold;
  color: #2e7d32;
  margin-bottom: 12rpx;
}

.answer-content {
  font-size: v-bind('dynamicFontSize.title');
  font-weight: bold;
  color: #1b5e20;
}

.analysis-box {
  background: var(--bg-color);
  border-radius: 16rpx;
  padding: 24rpx;
  border: 2rpx solid var(--border-color);
  margin-top: 30rpx;
  position: relative;
}

.analysis-title {
  font-size: v-bind('dynamicFontSize.explanation');
  font-weight: bold;
  color: #f57c00;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.analysis-title::before {
  content: '💡';
  font-size: 1.1em;
}

.analysis-content, .sub-answer, .sub-analysis, .answer-content, .extra-analysis view {
  font-size: v-bind('dynamicFontSize.explanation');
  line-height: 1.8;
  color: var(--text-main);
}

.sub-stem {
  font-size: v-bind('dynamicFontSize.title');
  line-height: 1.6;
  color: var(--text-main);
  margin-bottom: 20rpx;
}

.option-value {
  font-size: v-bind('dynamicFontSize.option');
  line-height: 1.5;
  color: var(--text-main);
}

.blank-val, .blank-input, .saq-input, .sub-input {
  font-size: v-bind('dynamicFontSize.content');
  height: 100rpx; 
}

.extra-analysis {
  margin-top: 24rpx;
  padding: 20rpx;
  background: var(--card-bg);
  border-radius: 12rpx;
  border-left: 6rpx solid #f57c00;
}

.extra-analysis .label {
  font-weight: bold;
  color: #f57c00;
  font-size: 0.85em;
  margin-bottom: 12rpx;
  display: block;
}

/* 填空题空格样式 */
:deep(.blank-placeholder) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 80rpx;
  height: 44rpx;
  margin: 0 8rpx;
  padding: 0 10rpx;
  border-bottom: 3rpx solid var(--primary-color);
  background: rgba(25, 118, 210, 0.05);
  color: var(--primary-color);
  font-weight: bold;
  vertical-align: middle;
  border-radius: 4rpx 4rpx 0 0;
}

:deep(.blank-index) {
  font-size: 20rpx;
  margin-right: 4rpx;
  color: var(--primary-color);
  background: rgba(25, 118, 210, 0.1);
  padding: 2rpx 6rpx;
  border-radius: 4rpx;
}

:deep(.blank-underline) {
  flex: 1;
}

.dark-mode .answer-box {
  background: rgba(76, 175, 80, 0.15);
  border-left-color: #66bb6a;
}

.dark-mode .answer-title {
  color: #a5d6a7;
}

.dark-mode .answer-content {
  color: #c8e6c9;
}

.dark-mode .analysis-box {
  background: rgba(25, 118, 210, 0.12);
}

.video-container {
  width: 100%;
  height: 400rpx;
  background: #000;
  border-radius: 12rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}

.analysis-video {
  width: 100%;
  height: 100%;
}

.tags-section {
  margin-top: 30rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--border-color);
}

.tags-title {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-bottom: 12rpx;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.tag-item {
  background: var(--accent-bg);
  color: var(--primary-color);
  font-size: 24rpx;
  padding: 6rpx 20rpx;
  border-radius: 30rpx;
  border: 1rpx solid rgba(77, 182, 172, 0.2);
}

.dark-mode .tag-item {
  background: rgba(77, 182, 172, 0.1) !important;
  color: #4db6ac !important;
  border-color: rgba(77, 182, 172, 0.3) !important;
}

.action-section {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 30px);
  max-width: 500px;
  z-index: 100;
}

.nav-actions {
  display: flex;
  align-items: center;
  background: var(--card-bg);
  padding: 10rpx 16rpx;
  border-radius: 60rpx;
  box-shadow: var(--shadow-lg);
  border: 1rpx solid var(--border-color);
  gap: 8rpx;
}

.nav-btn-group {
  display: flex;
  gap: 16rpx;
  padding-right: 16rpx;
  border-right: 1rpx solid var(--border-color);
}

.nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  min-width: 70rpx;
  transition: all 0.2s;
}

.nav-btn:active {
  transform: scale(0.9);
}

.tool-icon {
  font-size: 32rpx;
  line-height: 1;
}

.btn-text {
  font-size: 18rpx;
  color: var(--text-secondary);
}

.nav-btn.active .tool-icon {
  color: #fbc02d;
}

.nav-btn.active .btn-text {
  color: var(--primary-color);
  font-weight: bold;
}

.main-nav-btns {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.side-nav-btn {
  font-size: 24rpx;
  color: var(--text-secondary);
  padding: 0 16rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.side-nav-btn.disabled {
  opacity: 0.3;
}

.main-action {
  flex: 1;
}

.submit-btn, .next-btn {
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  border: none;
}

.submit-btn {
  background: var(--primary-gradient);
  color: #fff;
}

.submit-btn.test-mode {
  background: #2196f3 !important; /* 测试模式下使用蓝色背景 */
  color: #ffffff !important;
}

.next-btn {
  background: #4caf50;
  color: #fff;
}

/* 弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.answer-sheet-modal, .feedback-modal, .settings-modal {
  width: 100%;
  background: var(--card-bg);
  border-radius: 40rpx 40rpx 0 0;
  padding: 40rpx 30rpx;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  height: 85vh; /* 改为固定高度 85vh，确保 flex: 1 的 scroll-view 能生效 */
  display: flex;
  flex-direction: column;
}

.sheet-content {
  flex: 1;
  min-height: 0; /* 必须设置 min-height: 0 才能在 flex 容器中正常滚动 */
  padding-bottom: 40rpx;
}

/* 笔记部分样式 */
.notes-section {
  margin-top: 40rpx;
  padding-top: 30rpx;
  border-top: 1rpx solid var(--border-color);
}

.notes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.notes-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-main);
}

.title-line {
  width: 6rpx;
  height: 28rpx;
  background: var(--primary-color);
  border-radius: 3rpx;
}

.add-note-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 24rpx;
  background: var(--accent-bg);
  color: var(--primary-color);
  border-radius: 30rpx;
  font-size: 24rpx;
}

.notes-sub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.notes-tabs {
  display: flex;
  gap: 30rpx;
  border-bottom: none;
  margin-bottom: 0;
}

.tab-item {
  font-size: 26rpx;
  color: var(--text-secondary);
  padding: 10rpx 0;
  position: relative;
}

.tab-item.active {
  color: var(--primary-color);
  font-weight: bold;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4rpx;
  background: var(--primary-color);
  border-radius: 2rpx;
}

.note-sort {
  display: flex;
  align-items: center;
  gap: 4rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
}

.sort-icon {
  transition: transform 0.3s;
}

.sort-icon.rotated {
  transform: rotate(180deg);
}

.note-item {
  display: flex;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--border-color);
}

.note-item:last-child {
  border-bottom: none;
}

.note-left {
  flex-shrink: 0;
  margin-right: 20rpx;
}

.user-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: var(--bg-color);
}

.note-right {
  flex: 1;
  min-width: 0;
}

.note-user-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.username {
  font-size: 24rpx;
  font-weight: 500;
  color: var(--text-secondary);
}

.more-btn {
  padding: 4rpx;
  color: var(--text-light);
}

.more-dot {
  font-size: 28rpx;
}

.note-content {
  font-size: v-bind('dynamicFontSize.explanation');
  color: var(--text-main);
  line-height: 1.6;
  word-break: break-all;
  margin-bottom: 16rpx;
}

.note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.note-time-reply {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.time {
  font-size: 20rpx;
  color: var(--text-light);
}

.reply-btn {
  font-size: 22rpx;
  color: var(--primary-color);
  font-weight: 500;
}

.note-actions {
  display: flex;
  align-items: center;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
  color: var(--text-secondary);
}

.action-item.active {
  color: var(--primary-color);
}

.action-item .count {
  font-size: 22rpx;
}

/* 笔记回复样式 */
.replies-container {
  margin-top: 20rpx;
  background: var(--bg-color);
  border-radius: 12rpx;
  padding: 16rpx;
}

.expand-replies {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 12rpx 0;
  color: var(--primary-color);
  font-size: 24rpx;
}

.expand-replies .arrow {
  transition: transform 0.3s;
}

.expand-replies .arrow.up {
  transform: rotate(180deg);
}

.replies-list {
  margin-top: 10rpx;
}

.reply-item {
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--border-color);
}

.reply-item:last-child {
  border-bottom: none;
}

.reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.reply-user {
  font-size: 26rpx;
  color: var(--primary-color);
  font-weight: 500;
}

.reply-text {
  font-size: 28rpx;
  color: var(--text-main);
  line-height: 1.6;
  margin-bottom: 8rpx;
  display: block;
}

.reply-footer-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reply-footer-row .time {
  font-size: 22rpx;
  color: var(--text-light);
}

.delete-reply-btn {
  font-size: 22rpx;
  color: #f44336;
  padding: 4rpx 12rpx;
}

.empty-notes {
  padding: 60rpx 0;
  text-align: center;
  color: var(--text-light);
  font-size: 24rpx;
}

/* 设置样式 */
.settings-list {
  padding: 20rpx 0;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx 0;
  border-bottom: 1rpx solid var(--border-color);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item.column {
  flex-direction: column;
  align-items: flex-start;
  gap: 20rpx;
}

.font-size-levels {
  display: flex;
  width: 100%;
  background: var(--bg-color);
  border-radius: 12rpx;
  padding: 8rpx;
  gap: 8rpx;
}

.level-item {
  flex: 1;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: var(--text-secondary);
  border-radius: 8rpx;
  transition: all 0.2s;
}

.level-item.active {
  background: #fff;
  color: var(--primary-color);
  font-weight: bold;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
}

.font-stepper {
  display: flex;
  align-items: center;
  gap: 30rpx;
  background: var(--bg-color);
  padding: 10rpx 30rpx;
  border-radius: 40rpx;
}

.stepper-btn {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--primary-color);
  padding: 0 10rpx;
}

.font-size-val {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-main);
  min-width: 40rpx;
  text-align: center;
}

.note-user-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

/* 统一改为更多按钮样式，交互见参考页面 */

/* 笔记弹窗样式 */
.note-modal, .reply-modal {
  width: 100%;
  background: var(--card-bg);
  border-radius: 40rpx 40rpx 0 0;
  padding: 40rpx 30rpx;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
}

.note-form {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
  padding: 20rpx 0;
}

.note-input {
  width: 100%;
  height: 300rpx;
  background: var(--bg-color);
  border-radius: 16rpx;
  padding: 24rpx;
  font-size: 28rpx;
  color: var(--text-main);
  box-sizing: border-box;
}

.note-submit {
  background: var(--primary-color);
  color: #fff;
  border-radius: 40rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  border: none;
  flex: 1;
  font-size: 32rpx;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
  margin-top: 10rpx;
}

.cancel-btn {
  background: var(--bg-color);
  color: var(--text-secondary);
  border-radius: 40rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  border: 1rpx solid var(--border-color);
  flex: 1;
  font-size: 32rpx;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid var(--border-color);
  margin-bottom: 20rpx;
}

.sheet-status-legend {
  display: flex;
  justify-content: space-around;
  padding: 20rpx 0 40rpx;
  border-bottom: 1rpx solid var(--border-color);
  margin-bottom: 30rpx;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
}

.status-dot {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
}

.sheet-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 20rpx;
  padding: 20rpx 0;
}

.sheet-item {
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
  border-radius: 16rpx;
  font-size: 28rpx;
  color: var(--text-main);
  border: 2rpx solid transparent;
  transition: all 0.2s;
}

.sheet-item.current {
  border-color: var(--primary-color);
  color: var(--primary-color);
  font-weight: bold;
  background: rgba(25, 118, 210, 0.1);
}

.sheet-item.done {
  background: rgba(76, 175, 80, 0.1);
  color: #2e7d32;
}

.sheet-item.error {
  background: rgba(244, 67, 54, 0.1);
  color: #d32f2f;
}

.sheet-item.undone {
  background: var(--bg-color);
  color: var(--text-secondary);
}

/* 状态颜色定义 */
.status-dot.current { background: var(--primary-color); border: 2rpx solid var(--primary-color); }
.status-dot.done { background: #4caf50; }
.status-dot.error { background: #f44336; }
.status-dot.undone { background: var(--bg-color); border: 1rpx solid var(--border-color); }

.feedback-form {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.picker-item {
  padding: 20rpx;
  background: var(--bg-color);
  border-radius: 10rpx;
  font-size: 26rpx;
}

.feedback-input {
  width: 100%;
  height: 200rpx;
  background: var(--bg-color);
  border-radius: 10rpx;
  padding: 20rpx;
  font-size: 26rpx;
  box-sizing: border-box;
  color: var(--text-main);
}

.feedback-submit {
  background: var(--primary-color);
  color: #fff;
  border-radius: 40rpx;
  margin-top: 20rpx;
}

.bottom-placeholder {
  height: 150rpx;
}

.content-scroll {
  flex: 1;
  height: 0;
}

.loading-state, .no-data {
  text-align: center;
  padding: 100rpx 0;
  color: var(--text-light);
}
</style>
