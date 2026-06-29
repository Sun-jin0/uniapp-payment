﻿<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { onLoad } from '@dcloudio/uni-app';
import { request, BASE_URL } from '../../api/request';
import medicalApi from '../../api/medical';
import publicApi from '../../api/public';
import { transformContextString } from '../../utils/latex';
import SvgIcon from '../../components/SvgIcon/SvgIcon.vue';
import MpHtml from './components/mp-html/mp-html.vue';
import { checkTextContent } from '@/utils/contentSecurity.js';
import MembershipModal from '@/components/MembershipModal/MembershipModal.vue';
import { checkAccess, recordQuestionView, getFreeLimit } from '@/composables/useMembershipCheck.js';

// 检测内容是否包含 LaTeX 公式或代码块
const hasLatex = (text) => {
  if (!text || typeof text !== 'string') return false;
  // 检测常见的 LaTeX 公式标记
  const hasLatexFormula = /\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\\[a-zA-Z]+\{/.test(text);
  // 检测代码块标记 ``` 或 ---
  const hasCodeBlock = /```[\s\S]*?```|---[\s\S]*?---/.test(text);
  return hasLatexFormula || hasCodeBlock;
};

// 检测内容是否包含代码块（markdown格式或<pre>标签）
const hasCodeBlock = (text) => {
  if (!text || typeof text !== 'string') return false;
  // 检测 markdown 代码块
  if (/```[\s\S]*?```|---[\s\S]*?---/.test(text)) return true;
  // 检测 <pre> 标签
  if (/<pre[\s\S]*?<\/pre>/i.test(text)) return true;
  return false;
};

// 检查内容是否有实际意义（去除HTML标签和空白字符后是否为空）
const hasRealContent = (text) => {
  if (!text || typeof text !== 'string') return false;
  // 移除所有HTML标签
  const textWithoutTags = text.replace(/<[^>]+>/g, '');
  // 移除所有空白字符后检查是否为空
  return textWithoutTags.trim().length > 0;
};

// 解析内容，将图片和非图片内容分离
const parseContentWithImages = (text) => {
  if (!text || typeof text !== 'string') return [{ type: 'html', content: text }];

  const result = [];
  let lastIndex = 0;

  // 匹配图片标签
  const imgRegex = /<img[^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(text)) !== null) {
    // 添加图片前的 HTML 内容
    if (match.index > lastIndex) {
      const htmlContent = text.substring(lastIndex, match.index);
      if (htmlContent.trim()) {
        result.push({ type: 'html', content: htmlContent });
      }
    }

    // 提取图片 URL
    let imgTag = match[0];
    const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
    if (srcMatch) {
      const processedSrc = adjustImageUrl(srcMatch[1]);
      result.push({ type: 'image', src: processedSrc });
    }

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余内容
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex);
    if (remaining.trim()) {
      result.push({ type: 'html', content: remaining });
    }
  }

  return result.length > 0 ? result : [{ type: 'html', content: text }];
};

// 给 HTML 中的图片添加样式，但不分离内容
const addImageStyles = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  let result = text;
  
  // 1. 先将 Markdown 图片 ![alt](url) 转换为 HTML <img>
  // 使用更宽松的正则，匹配 URL 直到 .png/.jpg 等扩展名及后续参数
  result = result.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp|svg|bmp)[^\)]*)\)/gi, (match, alt, url) => {
    // 处理图片 URL
    const processedUrl = adjustImageUrl(url);
    return `<img src="${processedUrl}" alt="${alt}" style="max-width: 100%; height: auto; display: block;" />`;
  });
  
  // 2. 给已有的 HTML img 标签添加样式，并处理 src
  result = result.replace(/<img([^>]*)>/gi, (match, attrs) => {
    // 提取 src
    let src = '';
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (srcMatch) {
      src = adjustImageUrl(srcMatch[1]);
    }
    
    // 移除原有的 src 属性
    let newAttrs = attrs.replace(/\s*src=["'][^"']*["']/i, '');
    
    // 如果已经有 style 属性，则替换它
    if (/style="[^"]*"/i.test(newAttrs)) {
      newAttrs = newAttrs.replace(/style="[^"]*"/i, 'style="max-width: 100%; height: auto; display: block;"');
    } else {
      // 否则添加 style 属性
      newAttrs = newAttrs + ' style="max-width: 100%; height: auto; display: block;"';
    }
    
    // 重新组合 img 标签，确保 src 是第一个属性
    return `<img src="${src}"${newAttrs}>`;
  });
  
  return result;
};

// 解析内容，将代码块转换为数组格式
const parseContentWithCodeBlocks = (text) => {
  if (!text || typeof text !== 'string') return [{ type: 'text', content: text }];

  const result = [];
  let lastIndex = 0;

  // 首先匹配 <pre> 标签
  const preRegex = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
  let match;
  let hasPreTag = false;

  while ((match = preRegex.exec(text)) !== null) {
    hasPreTag = true;
    // 添加 <pre> 前的文本
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }

    // 提取 <pre> 标签内的内容，移除 <code> 标签
    let codeContent = match[1];
    codeContent = codeContent.replace(/<code[^>]*>/gi, '').replace(/<\/code>/gi, '');
    codeContent = codeContent.replace(/<[^>]+>/g, ''); // 移除其他 HTML 标签
    codeContent = codeContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

    // 添加代码块
    result.push({
      type: 'code',
      lang: 'text',
      content: codeContent.trim()
    });

    lastIndex = match.index + match[0].length;
  }

  // 如果有 <pre> 标签，添加剩余文本
  if (hasPreTag && lastIndex < text.length) {
    result.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
    return result;
  }

  // 然后匹配 ``` 代码块
  const markdownCodeRegex = /```([\w]*)\n?([\s\S]*?)```/g;
  lastIndex = 0;
  let hasMarkdownCode = false;

  while ((match = markdownCodeRegex.exec(text)) !== null) {
    hasMarkdownCode = true;
    // 添加代码块前的文本
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }

    // 添加代码块
    result.push({
      type: 'code',
      lang: match[1] || 'text',
      content: match[2].trim()
    });

    lastIndex = match.index + match[0].length;
  }

  // 如果有 markdown 代码块，添加剩余文本
  if (hasMarkdownCode && lastIndex < text.length) {
    result.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
    return result;
  }

  return [{ type: 'text', content: text }];
};


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
const questions = ref([]);
const allQuestionIds = ref([]); // 存储所有题目ID
const loadedQuestionIds = ref(new Set()); // 已加载的题目ID

// 获取文件基础路径 (从 BASE_URL 提取，如 http://localhost:3000/api -> http://localhost:3000)
const getFileBaseUrl = () => {
  if (!BASE_URL) return 'https://cheese.yanzhishi.cn';
  const url = BASE_URL.replace(/\/api\/?$/, '');
  return url;
};
const FILE_BASE_URL = getFileBaseUrl();
const currentIndex = ref(0);
const scrollTop = ref(0);
const loading = ref(true);
const pageOptions = ref({});

// 分页加载配置 - 每次只加载3题
const PAGE_SIZE = 3;

// 加载指定范围的题目
const loadQuestionsRange = async (startIndex, endIndex) => {
  if (allQuestionIds.value.length === 0) return;
  
  const idsToLoad = [];
  for (let i = startIndex; i < endIndex && i < allQuestionIds.value.length; i++) {
    const qid = allQuestionIds.value[i];
    if (!loadedQuestionIds.value.has(String(qid))) {
      idsToLoad.push(qid);
    }
  }
  
  if (idsToLoad.length === 0) return;
  
  try {
    const res = await request({
      url: '/computer1/questions/batch-details',
      method: 'POST',
      data: { questionIds: idsToLoad }
    });
    
    if (res.code === 0 && res.data) {
      res.data.forEach(q => {
        const processedQ = processQuestionData(q);
        const index = allQuestionIds.value.findIndex(id => String(id) === String(q.question_id));
        if (index !== -1) {
          questions.value[index] = processedQ;
          loadedQuestionIds.value.add(String(q.question_id));
          
          // 初始化题目状态
          if (!questionStates.value[index]) {
            const stemText = processedQ.originalStem || processedQ.stem || '';
            const totalBlanks = countBlanks(stemText);
            const subAnswers = {};
            
            if (processedQ.subs && processedQ.subs.length > 0) {
              processedQ.subs.forEach((sub, idx) => {
                const id = sub.sub_id || sub.id || idx;
                subAnswers[id] = '';
              });
            } else if (processedQ.exercise_type === 4 || processedQ.exercise_type_name?.includes('解答') || processedQ.exercise_type_name?.includes('综合')) {
              subAnswers['main'] = '';
            }
            
            questionStates.value[index] = {
              userAnswer: '',
              shortAnswer: '', 
              multiChoice: [],
              blankAnswers: totalBlanks > 0 ? new Array(totalBlanks).fill('') : [],
              subAnswers: subAnswers,
              isCorrect: false,
              showAnswer: settings.value.recitationMode,
              isFavorite: false,
              isWrongBook: false,
              loaded: true,
              notes: [], 
              status: 'undone',
              isNotesExpanded: false
            };
          }
        }
      });
    }
  } catch (error) {
    // 加载题目详情失败
  }
};

// 根据当前索引加载附近题目
const loadNearbyQuestions = async (centerIndex) => {
  const buffer = 1;
  const start = Math.max(0, centerIndex - buffer);
  const end = Math.min(allQuestionIds.value.length, centerIndex + buffer + 1);
  await loadQuestionsRange(start, end);
};

onLoad((options) => {
  pageOptions.value = options || {};
  
  // 如果 URL 中没有指定 questionId，检查是否有保存的进度
  if (!options.questionId) {
    const savedProgress = getSavedProgress(options);
    if (savedProgress && savedProgress.url) {
      const urlParams = extractParamsFromUrl(savedProgress.url);
      if (urlParams.questionId) {
        pageOptions.value.questionId = urlParams.questionId;
      }
    }
  }
  
  // 在 onLoad 中调用 fetchQuestions，确保参数已设置
  fetchQuestions();
  fetchRelatedArticles();
});

// 从 URL 中提取参数
const extractParamsFromUrl = (url) => {
  const params = {};
  if (!url) return params;
  
  const queryString = url.split('?')[1];
  if (!queryString) return params;
  
  queryString.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[key] = decodeURIComponent(value);
    }
  });
  
  return params;
};

// 获取保存的进度
const getSavedProgress = (options) => {
  const progressList = uni.getStorageSync('practiceProgressList') || [];
  if (!Array.isArray(progressList) || progressList.length === 0) return null;
  
  // 根据当前参数构建 progressKey
  let currentProgressKey = null;
  
  if (options.mode === 'wrong_book') {
    currentProgressKey = 'computer_wrong_book';
  } else if (options.chapterId) {
    currentProgressKey = `computer_chapter_${options.chapterId}`;
  } else if (options.tagId) {
    currentProgressKey = `computer_tag_${options.tagId}`;
  } else if (options.examGroupId) {
    currentProgressKey = `computer_exam_${options.examGroupId}`;
  }
  
  // 如果有 progressKey，查找匹配的进度
  if (currentProgressKey) {
    return progressList.find(item => item.progressKey === currentProgressKey);
  }
  
  return null;
};

const errorMsg = ref('');
const showAnswerSheet = ref(false);
const showSettings = ref(false);
const showFeedback = ref(false);
const feedbackType = ref('题目纠错');
const feedbackContent = ref('');

// 笔记系统状态
const notes = ref([]);
const showAddNoteModal = ref(false);
const addNoteContent = ref('');
const isPublicNote = ref(true);
const editingNote = ref(null);
const replyTo = ref(null); // { id, username }
const replyContent = ref('');
const noteTab = ref('public'); // public 或 private
const noteSortBy = ref('time'); // time 或 likes
const currentUserId = ref(uni.getStorageSync('userId') || '1'); // 模拟当前用户ID

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

// 笔记系统方法
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
          return { ...note, replies: [] };
        }
      }));
      notes.value = notesWithReplies;
    }
  } catch (error) {
    // fetchNotes error
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

const sortedNotes = computed(() => {
  const list = [...notes.value];
  if (noteSortBy.value === 'time') {
    return list.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
  } else {
    return list.sort((a, b) => (b.likeCount || b.likes || 0) - (a.likeCount || a.likes || 0));
  }
});

// 设置相关
const settings = ref({
  autoNext: true,
  nightMode: uni.getStorageSync('theme') === 'dark',
  recitationMode: false,
  fontSizeLevel: 'standard',
  showVideoAnalysis: true,
  removeWhenCorrect: uni.getStorageSync('computer_remove_when_correct') !== false // 默认开启
});

// 监听设置变化并保存
watch(() => settings.value.removeWhenCorrect, (newVal) => {
  uni.setStorageSync('computer_remove_when_correct', newVal);
});

// 状态管理
const questionStates = ref([]); // 存储每道题的状态
const totalCount = computed(() => questions.value.length);
const progress = computed(() => totalCount.value > 0 ? ((currentIndex.value + 1) / totalCount.value) * 100 : 0);

// 4.3 统计填空位数量
const countBlanks = (stem) => {
  if (!stem) return 0;
  // 1. 匹配标准标识 **1** 或 $*$1$*$
  const markerRegex = /[\$＄][\*＊][\$＄](\d+)[\$＄][\*＊][\$＄]|[\$＄][\*＊](\d+)[\*＊][\$＄]|[\*＊](\d+)[\*＊]/g;
  const markers = stem.match(markerRegex) || [];
  
  // 2. 匹配下划线 ___
  const underscoreRegex = /\[_{3,}\]|\(_{3,}\)|_{3,}/g;
  const underscores = stem.match(underscoreRegex) || [];
  
  // 3. 匹配 (1) (2) 这种形式
  const indexRegex = /\((\d+)\)|（(\d+)）/g;
  const indices = stem.match(indexRegex) || [];
  
  const count = Math.max(markers.length, underscores.length, indices.length);
  return count > 0 ? count : 1;
};

const correctCount = computed(() => questionStates.value.filter(s => s && s.status === 'correct').length);
const errorCount = computed(() => questionStates.value.filter(s => s && s.status === 'error').length);

// 通知栏相关
const relatedArticles = ref({ popular: [], newest: [] });
const articleLoading = ref(false);

const articleGroups = computed(() => {
  const groups = [];
  const addedIds = new Set();
  
  // 合并热门和最新，去重
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
    // 获取相关文章失败
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

// 统计相关
const sessionStats = ref({
  correct: 0,
  wrong: 0,
  answered: 0
});

const sessionAccuracy = computed(() => {
  const total = correctCount.value + errorCount.value;
  return total === 0 ? '0%' : Math.round((correctCount.value / total) * 100) + '%';
});

const currentQuestion = computed(() => questions.value[currentIndex.value]);

const formatName = (name) => {
  if (!name) return '';
  return name.trim().replace(/^专业基础\((.*)\)$/, '$1').replace(/^专业基础/, '');
};

// 导航栏标题（优先显示章名称，无章节信息时再显示试卷名称）
const navTitle = computed(() => {
  const q = currentQuestion.value;
  if (!q) return '计算机刷题';

  // 1. 最高优先级：章节练习模式 - 科目 + 章名称（核心改造：优先走章节逻辑）
  let subject = q.major_name || q.subject_name || '';
  const chapter = q.chapter_name || q.category_name || ''; // chapter_name 即为章的名称
  
  // 格式化名称（复用你原有格式化方法，统一名称展示规则）
  subject = formatName(subject);
  const formattedChapter = formatName(chapter);

  // 有章名称/科目时，优先组合展示
  if (formattedChapter) {
    return subject ? `${subject} - ${formattedChapter}` : formattedChapter;
  }
  // 仅有科目无章名称时，显示科目
  if (subject) {
    return subject;
  }

  // 2. 降级逻辑：无任何章节信息时，再显示试卷名称（保留原有试卷名称处理逻辑）
  if (q.exam_paper_name || q.exam_full_name || q.exam_group_name) {
    // 过滤纯数字长ID的试卷名称，避免展示无意义ID
    const paperName = q.exam_paper_name;
    if (paperName && !(paperName.length > 15 && /^\d+$/.test(paperName))) {
      return formatName(paperName);
    }
    const name = q.exam_full_name || q.exam_group_name;
    return name ? formatName(name) : '计算机刷题';
  }

  // 兜底：无任何信息时显示默认标题
  return '计算机刷题';
});

// 题目来源信息
const getQuestionSource = (q) => {
  if (!q) return '';
  const parts = [];
  if (q.exam_time) parts.push(q.exam_time);
  if (q.from_school) parts.push(q.from_school);
  if (q.exam_code) parts.push(q.exam_code);
  return parts.join(' · ');
};

watch(currentQuestion, (newVal) => {
  // 当前题目变化监听
}, { immediate: true });

const currentQuestionTypeLabel = computed(() => {
  const q = currentQuestion.value;
  if (!q) return '';
  const typeLabels = {
    1: '单选题',
    2: '多选题',
    3: '填空题',
    4: '解答题',
    5: '判断题',
    6: '算法题',
    7: '应用题'
  };
  return q.exercise_type_name || typeLabels[q.exercise_type] || '题目';
});

// 动态字体大小
const dynamicFontSize = computed(() => {
  const levels = {
    small: { title: '30rpx', option: '28rpx', explanation: '28rpx' },
    standard: { title: '34rpx', option: '32rpx', explanation: '30rpx' },
    large: { title: '38rpx', option: '36rpx', explanation: '34rpx' },
    extra: { title: '42rpx', option: '40rpx', explanation: '38rpx' }
  };
  return levels[settings.value.fontSizeLevel] || levels.standard;
});

onMounted(async () => {
  const systemInfo = uni.getSystemInfoSync();
  statusBarHeight.value = systemInfo.statusBarHeight || 0;
  loadUserSettings();
});

// 保存当前刷题状态到首页显示
const saveCurrentPracticeState = () => {
  const options = pageOptions.value;
  const totalQuestions = allQuestionIds.value.length || questions.value.length;
  const currentQuestionNum = currentIndex.value + 1;
  
  let practiceState = {
    type: 'computer',
    subject: '计算机',
    currentIndex: currentQuestionNum,
    totalQuestions: totalQuestions,
    timestamp: Date.now()
  };
  
  // 根据模式设置标题、URL 和唯一标识
  if (options.mode === 'wrong_book') {
    practiceState.title = '计算机 - 错题本';
    practiceState.url = `/pages/computer/computer-practice?mode=wrong_book`;
    practiceState.progressKey = 'computer_wrong_book';
  } else if (options.chapterId) {
    practiceState.title = '计算机 - 章节练习';
    practiceState.url = `/pages/computer/computer-practice?questionId=${allQuestionIds.value[currentIndex.value]}&context=${options.context || ''}&chapterId=${options.chapterId}&majorId=${options.majorId || ''}`;
    practiceState.progressKey = `computer_chapter_${options.chapterId}`;
    practiceState.id = options.chapterId;
  } else if (options.tagId) {
    practiceState.title = '计算机 - 考点练习';
    practiceState.url = `/pages/computer/computer-practice?questionId=${allQuestionIds.value[currentIndex.value]}&context=${options.context || ''}&tagId=${options.tagId}&chapterId=${options.chapterId || ''}&majorId=${options.majorId || ''}`;
    practiceState.progressKey = `computer_tag_${options.tagId}`;
    practiceState.id = options.tagId;
  } else if (options.examGroupId) {
    practiceState.title = '计算机 - 历年真题';
    practiceState.url = `/pages/computer/computer-practice?questionId=${allQuestionIds.value[currentIndex.value]}&context=${options.context || ''}&examGroupId=${options.examGroupId}`;
    practiceState.progressKey = `computer_exam_${options.examGroupId}`;
    practiceState.id = options.examGroupId;
  } else {
    practiceState.title = '计算机刷题';
    practiceState.url = `/pages/computer/computer-practice?questionId=${allQuestionIds.value[currentIndex.value] || ''}`;
    practiceState.progressKey = 'computer_general';
  }
  
  // 保存到进度列表
  savePracticeProgressToList(practiceState);
};

// 保存进度到列表
const savePracticeProgressToList = (practiceItem) => {
  if (!practiceItem || !practiceItem.progressKey) return;
  
  let progressList = uni.getStorageSync('practiceProgressList') || [];
  
  if (!Array.isArray(progressList)) {
    progressList = [];
  }
  
  const existingIndex = progressList.findIndex(item => 
    item.progressKey === practiceItem.progressKey
  );
  
  if (existingIndex !== -1) {
    progressList.splice(existingIndex, 1);
  }
  
  progressList.unshift(practiceItem);
  
  if (progressList.length > 10) {
    progressList = progressList.slice(0, 10);
  }
  
  uni.setStorageSync('practiceProgressList', progressList);
};

const fetchQuestions = async () => {
  loading.value = true;
  errorMsg.value = '';
  
  // 获取页面参数 (优先使用 onLoad 获取的参数)
  const options = pageOptions.value;
  const questionId = options.questionId;
  const mode = options.mode;
  
  try {
    let res;
    
    // 错题本模式：从错题本获取题目
    if (mode === 'wrong_book') {
      const userId = uni.getStorageSync('userId');
      if (!userId) {
        uni.showToast({ title: '请先登录', icon: 'none' });
        errorMsg.value = '请先登录';
        loading.value = false;
        return;
      }

      const wrongBookRes = await request({
        url: '/computer1/wrong-book',
        method: 'GET',
        data: { userId }
      });

      if (wrongBookRes.code === 0 && wrongBookRes.data && wrongBookRes.data.questions) {
        const questionIds = wrongBookRes.data.questions.map(q => q.question_id || q.id);
        
        if (questionIds.length > 0) {
          // 存储所有题目ID，但只加载前3道
          allQuestionIds.value = questionIds;
          // 初始化题目数组（用空对象占位）
          questions.value = new Array(questionIds.length).fill(null);
          // 只加载前3道题
          const initialIds = questionIds.slice(0, Math.min(PAGE_SIZE, questionIds.length));
          res = await request({
            url: '/computer1/questions/batch-details',
            method: 'POST',
            data: { questionIds: initialIds }
          });
        } else {
          errorMsg.value = '错题本为空';
          loading.value = false;
          return;
        }
      } else {
        errorMsg.value = '获取错题失败';
        loading.value = false;
        return;
      }
    } else {
      // 优先从本地缓存获取过滤后的题目列表
      const cachedIdsJson = uni.getStorageSync('computer_question_list');
      const cachedContext = uni.getStorageSync('computer_question_context');
      const currentContext = options.context || '';
      
      let idList = [];
      // 只有当上下文匹配时才使用缓存的 ID 列表
      if (cachedIdsJson && cachedContext === currentContext) {
        try {
          idList = JSON.parse(cachedIdsJson);
        } catch (e) {
          // 解析题目ID列表失败
        }
      }
      
      if (idList.length > 0) {
        // 存储所有题目ID
        allQuestionIds.value = idList;
        // 初始化题目数组（用空对象占位）
        questions.value = new Array(idList.length).fill(null);
        
        // 确定要加载的题目ID
        let idsToLoad;
        if (questionId) {
          // 如果有目标题目ID，找到它的索引并加载它附近的题目
          const targetIndex = idList.findIndex(id => String(id) === String(questionId));
          if (targetIndex !== -1) {
            // 设置当前索引
            currentIndex.value = targetIndex;
            // 加载目标题目附近的题目
            const start = Math.max(0, targetIndex - 1);
            const end = Math.min(idList.length, targetIndex + 2);
            idsToLoad = idList.slice(start, end);
          } else {
            // 目标题目不在列表中，加载前3道
            idsToLoad = idList.slice(0, Math.min(PAGE_SIZE, idList.length));
          }
        } else {
          // 没有目标题目，加载前3道
          idsToLoad = idList.slice(0, Math.min(PAGE_SIZE, idList.length));
        }
        
        res = await request({
          url: '/computer1/questions/batch-details',
          method: 'POST',
          data: { questionIds: idsToLoad }
        });
      } else if (options.majorId === 'tutorial' && options.chapterId) {
        // 教辅模式：获取章节下的题目
        // 清除缓存，确保获取最新数据
        uni.removeStorageSync('computer_question_list');
        uni.removeStorageSync('computer_question_context');
        
        res = await request({
          url: `/computer/tutorial-chapters/${options.chapterId}/questions`,
          // 添加时间戳防止缓存
          data: { _t: Date.now() }
        });
        
        // 教辅模式也需要设置 allQuestionIds 以支持分页加载
        if (res.code === 0 && res.data && res.data.length > 0) {
          const questionIds = res.data.map(q => q.question_id);
          allQuestionIds.value = questionIds;
          // 初始化题目数组（用空对象占位）
          questions.value = new Array(questionIds.length).fill(null);
          
          // 如果有保存的 questionId，跳转到对应位置
          if (questionId) {
            const targetIndex = questionIds.findIndex(id => String(id) === String(questionId));
            if (targetIndex !== -1) {
              currentIndex.value = targetIndex;
            }
          }
        }
      } else {
        // 降级方案：根据参数获取
        const params = {};
        if (options.chapterId) params.chapterId = options.chapterId;
        if (options.tagId) params.tagId = options.tagId;
        if (options.majorId) params.majorId = options.majorId;
        if (options.examGroupId) params.examGroupId = options.examGroupId;
        
        // 如果没有任何参数，使用原来的硬编码作为兜底
        if (Object.keys(params).length === 0) {
          // 如果没有任何参数，抛出错误
          throw new Error('缺失查询参数');
        }
        
        res = await request({
          url: '/computer1/questions',
          data: params
        });
      }
    }
    
    if (res.code === 0 && res.data && res.data.length > 0) {
      // 处理加载的题目数据
      const loadedQuestions = res.data.map(q => processQuestionData(q));
      
      // 如果是分页加载模式（有 allQuestionIds），将题目放入对应位置
      if (allQuestionIds.value.length > 0) {
        loadedQuestions.forEach((q) => {
          // 找到题目在 allQuestionIds 中的索引
          const index = allQuestionIds.value.findIndex(id => String(id) === String(q.question_id));
          if (index !== -1) {
            questions.value[index] = q;
            loadedQuestionIds.value.add(String(q.question_id));
          }
        });
      } else {
        // 非分页模式，直接赋值
        questions.value = loadedQuestions;
      }
      
      // 如果指定了跳转的题目ID，定位到该题
      if (questionId) {
        const index = questions.value.findIndex(q => q && String(q.question_id) === String(questionId));
        if (index > -1) {
          currentIndex.value = index;
          // 加载目标题目附近的题目
          await loadNearbyQuestions(index);
        }
      }

      // 初始化题目状态（只初始化已加载的）
      if (!questionStates.value || questionStates.value.length === 0) {
        questionStates.value = new Array(questions.value.length).fill(null);
      }
      
      loadedQuestions.forEach((q) => {
        // 找到题目在 questions 数组中的正确索引
        const qIndex = allQuestionIds.value.length > 0 
          ? allQuestionIds.value.findIndex(id => String(id) === String(q.question_id))
          : questions.value.findIndex(item => item && String(item.question_id) === String(q.question_id));
        
        if (qIndex !== -1 && !questionStates.value[qIndex]) {
          const stemText = q.originalStem || q.stem || '';
          const totalBlanks = countBlanks(stemText);
          const subAnswers = {};
          
          // 安全初始化 subAnswers
          if (q.subs && q.subs.length > 0) {
            q.subs.forEach((sub, subIdx) => {
              const id = sub.sub_id || sub.id || subIdx;
              subAnswers[id] = '';
            });
          } else if (q.exercise_type === 4 || q.exercise_type_name?.includes('解答') || q.exercise_type_name?.includes('综合')) {
            subAnswers['main'] = '';
          }

          questionStates.value[qIndex] = {
            userAnswer: '',
            shortAnswer: '', 
            multiChoice: [],
            blankAnswers: totalBlanks > 0 ? new Array(totalBlanks).fill('') : [],
            subAnswers: subAnswers,
            isCorrect: false,
            showAnswer: settings.value.recitationMode,
            isFavorite: false,
            isWrongBook: false,
            loaded: true,
            notes: [], 
            status: 'undone',
            isNotesExpanded: false
          };
        }
      });
      
      // 加载当前索引附近的题目
      if (questions.value.length > 0) {
        await loadNearbyQuestions(currentIndex.value);
        await loadQuestionDetails(currentIndex.value);
      }
      
      // 保存当前刷题状态到首页
      saveCurrentPracticeState();
    } else {
      errorMsg.value = '暂无相关题目';
    }
  } catch (error) {
    errorMsg.value = '网络请求失败，请稍后重试';
  } finally {
    loading.value = false;
  }
};

// 处理题目图片
const adjustImageUrl = (imageUrl) => {
  if (!imageUrl) return imageUrl;
  if (imageUrl.startsWith('//')) {
    imageUrl = 'https:' + imageUrl;
  } else if (!imageUrl.toLowerCase().startsWith('http') && !imageUrl.startsWith('data:')) {
    // 只有不以 http(s) 开头的相对路径才补全域名
    const baseUrl = FILE_BASE_URL || 'https://cheese.yanzhishi.cn';
    imageUrl = baseUrl + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl);
  }
  
  // 1. 规范化协议和域名为小写
  imageUrl = imageUrl.replace(/^(HTTP|HTTPS):\/\/([^\/]+)/i, (match, proto, domain) => {
    return proto.toLowerCase() + '://' + domain.toLowerCase();
  });

  // 2. 统一图片后缀为小写 (支持带参数的 URL，如 .PNG?v=1)
  imageUrl = imageUrl.replace(/\.(PNG|JPG|JPEG|GIF|WEBP)(\?.*)?$/i, (match, ext, query) => {
    return '.' + ext.toLowerCase() + (query || '');
  });
  
  return imageUrl;
};

// 处理题干、解析和答案中的图片
const fixHtmlImages = (html) => {
  if (!html) return html;
  
  let result = html;
  
  // 0. 先将 Markdown 图片 ![alt](url) 转换为 HTML <img>
  // 使用更宽松的正则，匹配 URL 直到 .png/.jpg 等扩展名及后续参数
  result = result.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp|svg|bmp)[^\)]*)\)/gi, (match, alt, url) => {
    return `<img src="${url}" alt="${alt}" style="max-width: 100%; height: auto; display: block;" />`;
  });
  
  // 1. 处理 <img> 标签及其所有属性
  return result.replace(/<img([^>]+)>/gi, (match, fullAttrs) => {
    // 提取 src
    let src = '';
    const srcMatch = fullAttrs.match(/src=["']([^"']+)["']/i);
    if (srcMatch) {
      src = adjustImageUrl(srcMatch[1]);
    } else {
      return match; // 没有 src 属性的 img 标签不处理
    }

    let attrs = fullAttrs;
    let styleStr = 'max-width: 100%;';
    
    // 提取并移除已有的 style 属性进行合并
    attrs = attrs.replace(/style=["']([^"']*)["']/i, (m, existingStyle) => {
      if (existingStyle) {
        // 如果原有 style 不包含 max-width，则追加
        if (!existingStyle.toLowerCase().includes('max-width')) {
          styleStr = `${existingStyle}${existingStyle.trim().endsWith(';') ? '' : ';'} ${styleStr}`;
        } else {
          styleStr = existingStyle;
        }
      }
      return '';
    });

    // 提取 width 和 height 并转换为 style (如果 style 中还没有对应属性)
    attrs = attrs.replace(/\s+width=["'](\d+)["']/i, (m, w) => {
      if (!styleStr.toLowerCase().includes('width:')) {
        styleStr += ` width: ${w}px;`;
      }
      return '';
    });
    attrs = attrs.replace(/\s+height=["'](\d+)["']/i, (m, h) => {
      if (!styleStr.toLowerCase().includes('height:')) {
        styleStr += ` height: ${h}px;`;
      }
      return '';
    });

    // 移除原始的 src 属性
    attrs = attrs.replace(/\s+src=["']([^"']+)["']/i, '');

    // 重新组合 img 标签，确保 src 是第一个属性且 style 被正确合并
    return `<img src="${src}" style="${styleStr.trim()}"${attrs}>`;
  });
};

const processQuestionData = (data) => {
  if (!data) return data;

  const possibleStemFields = ['stem', 'title', 'question', 'content_stem', 'question_stem'];
  const possibleAnswerFields = ['answer', 'originalAnswer', 'standardAnswer', 'result', 'standard_answer', 'correct_answer'];
  const possibleAnalysisFields = ['analysis', 'commentary', 'method', 'explanation', 'analysis_text', 'solution'];

  // 保存最原始的题干备份，绝不修改
  data.originalStem = data.stem || '';

  if (data.stem) {
    data.truncatedStem = null;

    // 如果是选择题或判断题且没有选项，尝试从题干中提取
    if ((data.exercise_type === 1 || data.exercise_type === 2 || data.exercise_type === 5) && (!data.options || data.options.length === 0)) {
      const options = [];
      
      // 优化正则：排除 pre 和 code 标签内的内容
      const labelPattern = /(?:\\\(|\\\[|\$)?\s*(?:\\left\(\s*)?(?:\\mathrm\{|\\\{\\rm\s*|（|\()?([A-D])(?:\s*\})?(?:\s*\\right\))?(?:\s*）|\))?\s*(?:\\\)|\\\]|\$)?[\.\s\、\)\:]/g;
      
      const matches = [];
      let m;
      const tempRegex = new RegExp(labelPattern);
      while ((m = tempRegex.exec(data.stem)) !== null) {
        // 检查匹配到的位置是否在代码块之外
        const beforeMatch = data.stem.substring(0, m.index);
        const openPre = (beforeMatch.match(/<pre/gi) || []).length;
        const closePre = (beforeMatch.match(/<\/pre>/gi) || []).length;
        const openCode = (beforeMatch.match(/<code/gi) || []).length;
        const closeCode = (beforeMatch.match(/<\/code>/gi) || []).length;
        
        if (openPre === closePre && openCode === closeCode) {
          matches.push({
            index: m.index,
            length: m[0].length,
            label: m[1],
            fullMatch: m[0]
          });
        }
      }
      
      if (matches.length >= 2) {
        for (let i = 0; i < matches.length; i++) {
          const start = matches[i].index + matches[i].length;
          const end = (i < matches.length - 1) ? matches[i+1].index : data.stem.length;
          let content = data.stem.substring(start, end).trim();
          content = content.replace(/<br\s*\/?>/gi, '').replace(/\n/g, '').trim();

          options.push({
            option_key: matches[i].label,
            option_value: content
          });
        }
        data.options = options;
        
        // 截断逻辑：只有当截断位置后的内容主要是选项时才截断
        const prefix = data.stem.substring(0, matches[0].index).trim();
        // 如果截断前缀太短或者只包含基础标签，或者截断点在代码块之后很久，则认为截断失败
        if (prefix.replace(/<[^>]+>/g, '').length > 0) {
           // 检查截断点之后是否还有大量非选项内容
           data.truncatedStem = prefix;
        }
      }
    }

    // 填空题提取逻辑
    if (data.exercise_type === 3 && (!data.options || data.options.length === 0)) {
      // 如果题干包含答案标识且没有选项，尝试将答案从题干分离（可选）
      // 这里保持简单，填空题通常不截断题干
    }

    if (data.topic_image) {
      data.topic_image = adjustImageUrl(data.topic_image);
    }
    
    data.stem = fixHtmlImages(data.stem);
    data.analysis = fixHtmlImages(data.analysis);
    data.answer = fixHtmlImages(data.answer);

    // 处理选项中的 LaTeX
    if (data.options && data.options.length > 0) {
      data.options = data.options.map(opt => ({
        ...opt,
        option_value: opt.option_value
      }));
    }

    // 校准填空题正确答案逻辑
    if (data.exercise_type === 3 && (!data.answer || data.answer === '') && data.options && data.options.length > 0) {
      const answers = data.options.map(opt => opt.option_value || '');
      data.answer = JSON.stringify(answers);
    }
  }

  // 统一选项数据结构
  if (data.options && data.options.length > 0) {
    data.content = data.content || {};
    data.content.options = data.options.map(opt => ({
      text: fixHtmlImages(opt.option_value || opt.content || opt.text || opt),
      label: opt.option_key || opt.label || opt.key || ''
    }));
  }

  // 确定主答案
  for (const field of possibleAnswerFields) {
    if (data[field]) {
      data.answer = data[field];
      break;
    }
  }

  if (data.answer) {
    data.originalAnswer = data.answer;
    if (data.exercise_type === 3) {
      try {
        const answers = JSON.parse(data.answer);
        if (Array.isArray(answers)) {
          data.displayAnswer = answers.map((ans, i) => {
            // 彻底清理标签，确保没有 div, p, span
            const cleanAns = String(ans).replace(/<(p|div|span)[^>]*>|<\/(p|div|span)>/gi, '').trim();
            return `<span class="blank-answer-item" style="display: block; margin-bottom: 12rpx; line-height: 1.5;"><span class="blank-num" style="color: #4db6ac; font-weight: bold; margin-right: 12rpx;">(${i + 1})</span><span class="blank-val" style="color: #333;">${cleanAns}</span></span>`;
          }).join('');
        }
      } catch (e) {
        const cleanAns = String(data.answer).replace(/<(p|div|span)[^>]*>|<\/(p|div|span)>/gi, '').trim();
        data.displayAnswer = `<span class="blank-answer-item" style="display: block; margin-bottom: 12rpx; line-height: 1.5;"><span class="blank-num" style="color: #4db6ac; font-weight: bold; margin-right: 12rpx;">(1)</span><span class="blank-val" style="color: #333;">${cleanAns}</span></span>`;
      }
    }
    data.answer = data.answer;
  }
  
  // 确定主解析
  for (const field of possibleAnalysisFields) {
    if (data[field]) {
      data.analysis = data[field]; // 移除 processStem
      break;
    }
  }
  
  if (data.commentary) {}
  if (data.method) {}

  if (data.subs) {
    data.subs.forEach((sub) => {
      // 提取子题题干
      for (const field of possibleStemFields) {
        if (sub[field]) {
          sub.stem = fixHtmlImages(sub[field]);
          break;
        }
      }
      
      // 处理子题答案字段
      for (const field of possibleAnswerFields) {
        if (sub[field]) {
          sub.answer = fixHtmlImages(sub[field]);
          sub.originalAnswer = sub.answer; 
          break;
        }
      }
      
      // 处理子题解析字段
      for (const field of possibleAnalysisFields) {
        if (sub[field]) {
          sub.analysis = fixHtmlImages(sub[field]);
          break;
        }
      }
      
      // 如果子题没有解析，尝试从 content 获取
      if (!sub.analysis && sub.content && sub.content.analysis) {
        sub.analysis = fixHtmlImages(sub.content.analysis);
      }
    });
  }

  return data;
};

const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').trim();
};

const loadQuestionDetails = async (index) => {
  if (index < 0 || index >= questions.value.length) return;
  const question = questions.value[index];
  if (!question) return;

  // 始终尝试获取笔记，不仅仅是在第一次加载时
  fetchNotes(question.question_id);

  // 确保 questionStates[index] 存在
  if (!questionStates.value[index]) {
    const stemText = question.originalStem || question.stem || '';
    const totalBlanks = countBlanks(stemText);
    const subAnswers = {};
    
    if (question.subs && question.subs.length > 0) {
      question.subs.forEach((sub, idx) => {
        const id = sub.sub_id || sub.id || idx;
        subAnswers[id] = '';
      });
    } else if (question.exercise_type === 4 || question.exercise_type_name?.includes('解答') || question.exercise_type_name?.includes('综合')) {
      subAnswers['main'] = '';
    }
    
    questionStates.value[index] = {
      userAnswer: '',
      shortAnswer: '', 
      multiChoice: [],
      blankAnswers: totalBlanks > 0 ? new Array(totalBlanks).fill('') : [],
      subAnswers: subAnswers,
      isCorrect: false,
      showAnswer: settings.value.recitationMode,
      isFavorite: false,
      isWrongBook: false,
      loaded: false
    };
  }

  if (questionStates.value[index].loaded) return;

  try {
    const [detailRes, favRes, wrongRes] = await Promise.all([
      request({ url: `/computer1/questions/${question.question_id}` }),
      request({ url: '/computer1/favorites/check', data: { questionId: question.question_id } }),
      request({ url: '/computer1/wrong-book/check', data: { questionId: question.question_id } })
    ]);
    
    if (detailRes.code === 0 && detailRes.data) {
      // 合并详情数据（包含 options 等）
      const detailedQuestion = processQuestionData(detailRes.data);
      questions.value[index] = { ...question, ...detailedQuestion };
    }
    
    questionStates.value[index].isFavorite = favRes.data.isFavorite;
    questionStates.value[index].isWrongBook = wrongRes.data.exists;
    questionStates.value[index].loaded = true;

    // 预加载下一题
    if (index + 1 < questions.value.length) {
      prefetchQuestion(index + 1);
    }
  } catch (e) {
    // 加载题目详情失败
  }
};

const prefetchQuestion = async (index) => {
  const question = questions.value[index];
  if (!question) return;
  
  // 确保 questionStates[index] 存在
  if (!questionStates.value[index]) {
    const stemText = question.originalStem || question.stem || '';
    const totalBlanks = countBlanks(stemText);
    const subAnswers = {};
    
    if (question.subs && question.subs.length > 0) {
      question.subs.forEach((sub, idx) => {
        const id = sub.sub_id || sub.id || idx;
        subAnswers[id] = '';
      });
    } else if (question.exercise_type === 4 || question.exercise_type_name?.includes('解答') || question.exercise_type_name?.includes('综合')) {
      subAnswers['main'] = '';
    }
    
    questionStates.value[index] = {
      userAnswer: '',
      shortAnswer: '', 
      multiChoice: [],
      blankAnswers: totalBlanks > 0 ? new Array(totalBlanks).fill('') : [],
      subAnswers: subAnswers,
      isCorrect: false,
      showAnswer: settings.value.recitationMode,
      isFavorite: false,
      isWrongBook: false,
      loaded: false
    };
  }
  
  if (questionStates.value[index].loaded) return;
  
  try {
    const res = await request({ url: `/computer1/questions/${question.question_id}` });
    if (res.code === 0 && res.data) {
      questions.value[index] = { ...question, ...processQuestionData(res.data) };
      questionStates.value[index].loaded = true;
      // 预加载收藏状态
      checkStatus(index);
    }
  } catch (e) {}
};

const checkStatus = async (index) => {
  const question = questions.value[index];
  try {
    const [favRes, wrongRes] = await Promise.all([
      request({ url: '/computer1/favorites/check', data: { questionId: question.question_id } }),
      request({ url: '/computer1/wrong-book/check', data: { questionId: question.question_id } })
    ]);
    questionStates.value[index].isFavorite = favRes.data.isFavorite;
    questionStates.value[index].isWrongBook = wrongRes.data.exists;
  } catch (e) {}
};

const handleSelect = (qIndex, oIndex) => {
  const state = questionStates.value[qIndex];
  const question = questions.value[qIndex];
  
  if (!state) {
    console.log('handleSelect: state not found for index', qIndex);
    return;
  }
  
  if (state.showAnswer || settings.value.recitationMode) {
    console.log('handleSelect: showAnswer or recitationMode', state.showAnswer, settings.value.recitationMode);
    return;
  }
  
  if (!question) {
    console.log('handleSelect: question not found for index', qIndex);
    return;
  }
  
  const optionKey = String.fromCharCode(65 + oIndex);
  
  if (question.exercise_type === 2) {
    // 多选题：切换选择状态，不立即提交
    let selected = state.userAnswer ? state.userAnswer.split('') : [];
    const idx = selected.indexOf(optionKey);
    if (idx > -1) {
      selected.splice(idx, 1);
    } else {
      selected.push(optionKey);
    }
    state.userAnswer = selected.sort().join('');
  } else {
    // 单选题：选择答案，不立即提交（等待点击确定按钮）
    state.userAnswer = optionKey;
  }
};

const confirmAnswer = async (index) => {
  const state = questionStates.value[index];
  const question = questions.value[index];
  
  if (!state || !question) return;
  
  if (state.showAnswer) return; // 防止重复提交

  let isSkipJudgment = false;

  // 先判断是否是解答题（根据名称或类型）
  if (question.exercise_type_name?.includes('解答') || question.exercise_type_name?.includes('综合')) {
    // 解答题
    const hasInput = Object.values(state.subAnswers || {}).some(ans => ans && ans.trim()) || (state.shortAnswer && state.shortAnswer.trim());
    if (!hasInput) {
      // 如果没有输入，直接查看答案，不计对错
      isSkipJudgment = true;
      state.isCorrect = false;
      state.status = 'answered';
    } else {
      state.status = 'answered';
      state.isCorrect = true; // 解答题默认设为对，以解析为准
    }
  } else if ([1, 2, 5].includes(question.exercise_type)) {
    if (!state.userAnswer) {
      if (question.exercise_type === 2) {
        uni.showToast({ title: '请至少选择一个选项', icon: 'none' });
      } else {
        uni.showToast({ title: '请选择一个选项', icon: 'none' });
      }
      return;
    }
    
    // 校验选择题
    const rawAnswer = question.originalAnswer || question.answer || '';
    // 移除 HTML 标签并只保留大写字母用于比对
    const standardAnswer = stripHtml(rawAnswer).replace(/[^A-Z]/gi, '').toUpperCase();
    state.isCorrect = state.userAnswer === standardAnswer;
    state.status = state.isCorrect ? 'correct' : 'error';
  } else if (question.exercise_type === 3 || question.exercise_type_name?.includes('填空')) {
    // 填空题校验
    const hasInput = state.blankAnswers.some(ans => ans && ans.trim());
    if (!hasInput) {
      // 如果没有输入，直接查看答案，不计对错
      isSkipJudgment = true;
      state.isCorrect = false;
      state.status = 'answered';
    } else {
      try {
        const answerStr = question.originalAnswer || question.answer;
        const correctAnswers = JSON.parse(answerStr);
        if (Array.isArray(correctAnswers)) {
          state.isCorrect = state.blankAnswers.length === correctAnswers.length && 
                           state.blankAnswers.every((ans, i) => (ans || '').trim() === (correctAnswers[i] || '').trim());
        } else {
          state.isCorrect = (state.blankAnswers[0] || '').trim() === (answerStr || '').trim();
        }
      } catch (e) {
        state.isCorrect = (state.blankAnswers[0] || '').trim() === (question.originalAnswer || question.answer || '').trim();
      }
      state.status = state.isCorrect ? 'correct' : 'error';
    }
  } else if (question.exercise_type === 4) {
    // 解答题（仅根据类型判断）
    const hasInput = Object.values(state.subAnswers || {}).some(ans => ans && ans.trim()) || (state.shortAnswer && state.shortAnswer.trim());
    if (!hasInput) {
      // 如果没有输入，直接查看答案，不计对错
      isSkipJudgment = true;
      state.isCorrect = false;
      state.status = 'answered';
    } else {
      state.status = 'answered';
      state.isCorrect = true; // 解答题默认设为对，以解析为准
    }
  }

  state.showAnswer = true;
  
  // 更新统计 (只有在不是跳过判定且不是解答题时才计入正确/错误)
  if (!isSkipJudgment) {
    if (state.isCorrect) {
      sessionStats.value.correct++;
    } else if (state.status === 'error') {
      sessionStats.value.wrong++;
    }
    sessionStats.value.answered++;
  }

  // 异步记录进度
  let lastAnswer = state.userAnswer;
  if (question.exercise_type === 3 || question.exercise_type_name?.includes('填空')) {
    lastAnswer = JSON.stringify(state.blankAnswers);
  } else if (question.exercise_type === 4 || question.exercise_type_name?.includes('解答') || question.exercise_type_name?.includes('综合')) {
    lastAnswer = JSON.stringify(state.subAnswers || { main: state.shortAnswer });
  }

  try {
    await request({
      url: '/computer1/progress',
      method: 'POST',
      data: {
        questionId: question.question_id,
        isCorrect: state.isCorrect ? 1 : 0,
        userAnswer: lastAnswer,
        status: 'completed'
      }
    });
  } catch (err) {
    // update progress error
  }

  // 如果答错了，自动加入错题本
  if (!state.isCorrect && state.status === 'error') {
    try {
      const userId = uni.getStorageSync('userId');
      if (userId) {
        await request({
          url: '/computer1/wrong-book',
          method: 'POST',
          data: {
            userId: userId,
            questionId: question.question_id
          }
        });
      }
    } catch (err) {
      // add to wrong book error
    }
  }

  // 错题本模式下，更新状态
  if (pageOptions.value.mode === 'wrong_book' && !isSkipJudgment) {
    try {
      const userId = uni.getStorageSync('userId');
      if (userId) {
        await request({
          url: '/computer1/wrong-book/update-status',
          method: 'POST',
          data: {
            userId: userId,
            questionId: question.question_id,
            isCorrect: state.isCorrect,
            removeFromWrongBook: settings.value.removeWhenCorrect
          }
        });
        
        if (state.isCorrect && settings.value.removeWhenCorrect) {
          uni.showToast({
            title: '已从错题本移除',
            icon: 'success'
          });
        }
      }
    } catch (err) {
      // update wrong book status error
    }
  }

  // 自动下一题逻辑 (填空解答题且跳过判定时不自动跳转)
  if (!isSkipJudgment && state.isCorrect && settings.value.autoNext && currentIndex.value < totalCount.value - 1) {
    setTimeout(() => {
      if (currentIndex.value === index) {
        currentIndex.value++;
      }
    }, 1000);
  }
};

const jumpToQuestion = async (index) => {
  currentIndex.value = index;
  scrollTop.value = 0;
  showAnswerSheet.value = false;

  // 会员检查：第20题及以后需要检查会员状态
  if (index >= FREE_LIMIT && !isMember.value) {
    const result = checkAccess('computer', index);
    if (result.showPrompt && !result.canAccess) {
      memberPriceInfo.value = result.subjectInfo;
      showMemberModal.value = true;
    }
  }

  // 记录做题次数
  recordQuestionView('computer');

  await loadNearbyQuestions(index);
  loadQuestionDetails(index);
  // 保存当前刷题状态
  saveCurrentPracticeState();
};

const updateProgress = (index) => {
  const state = questionStates.value[index];
  const question = questions.value[index];
  if (!state || state.showAnswer || settings.value.recitationMode) return;

  let lastAnswer = state.userAnswer;
  if (question.exercise_type === 3 || question.exercise_type_name?.includes('填空')) {
    lastAnswer = JSON.stringify(state.blankAnswers);
  } else if (question.exercise_type_name?.includes('解答') || question.exercise_type_name?.includes('综合')) {
    lastAnswer = JSON.stringify(state.subAnswers || { main: state.shortAnswer });
  }

  request({
    url: '/computer1/progress',
    method: 'POST',
    data: {
      questionId: question.question_id,
      isCorrect: 0,
      userAnswer: lastAnswer,
      status: 'answering'
    }
  }).catch(() => {
    // update progress error
  });
};

const getSheetItemClass = (index) => {
  const state = questionStates.value[index];
  const classes = [];

  if (index === currentIndex.value) classes.push('current');

  if (!state) return classes.join(' ');

  if (state.status === 'correct') classes.push('correct');
  else if (state.status === 'error') classes.push('error');
  else if (state.userAnswer) classes.push('answered');

  return classes.join(' ');
};

// 获取题型简称
const getShortTypeName = (typeName) => {
  if (!typeName) return '';
  if (typeName.includes('单选')) return '单选';
  if (typeName.includes('多选')) return '多选';
  if (typeName.includes('填空')) return '填空';
  if (typeName.includes('解答')) return '解答';
  if (typeName.includes('综合')) return '综合';
  if (typeName.includes('判断')) return '判断';
  return typeName.substring(0, 2);
};

// 获取题型样式类（用于答题卡颜色区分）
const getQuestionTypeClass = (question) => {
  const typeName = question?.exercise_type_name || '';
  if (typeName.includes('解答') || typeName.includes('综合')) return 'type-essay';
  if (typeName.includes('填空')) return 'type-blank';
  if (typeName.includes('多选')) return 'type-multi';
  if (typeName.includes('判断')) return 'type-judge';
  return 'type-single'; // 默认单选
};

const toggleFavorite = async () => {
  const index = currentIndex.value;
  const question = questions.value[index];
  const state = questionStates.value[index];
  
  try {
    const res = await request({ 
      url: '/computer1/favorites/toggle',
      method: 'POST',
      data: { questionId: question.question_id }
    });
    state.isFavorite = res.data.isFavorite;
    uni.showToast({ title: state.isFavorite ? '收藏成功' : '已取消收藏', icon: 'none' });
  } catch (error) {
    // 切换收藏状态失败
  }
};

const loadUserSettings = () => {
  const saved = uni.getStorageSync('computer_user_settings');
  if (saved) settings.value = { ...settings.value, ...JSON.parse(saved) };
};

const saveUserSettings = () => {
  uni.setStorageSync('computer_user_settings', JSON.stringify(settings.value));
};

const toggleRecitation = () => {
  settings.value.recitationMode = !settings.value.recitationMode;
  questionStates.value.forEach(state => {
    if (state) {
      state.showAnswer = settings.value.recitationMode || !!state.userAnswer;
    }
  });
  saveUserSettings();
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

const onScroll = (e) => {
  // 可以在这里处理滚动事件
};

const goToPrevQuestion = async () => {
  if (currentIndex.value > 0) {
    const newIndex = currentIndex.value - 1;
    currentIndex.value = newIndex;
    scrollTop.value = 0;

    // 会员检查：第20题及以后需要检查会员状态
    if (newIndex >= FREE_LIMIT && !isMember.value) {
      const result = checkAccess('computer', newIndex);
      if (result.showPrompt && !result.canAccess) {
        memberPriceInfo.value = result.subjectInfo;
        showMemberModal.value = true;
      }
    }

    // 记录做题次数
    recordQuestionView('computer');

    await loadNearbyQuestions(currentIndex.value);
    loadQuestionDetails(currentIndex.value);
  }
};

const goToNextQuestion = async () => {
  if (currentIndex.value < totalCount.value - 1) {
    const newIndex = currentIndex.value + 1;
    currentIndex.value = newIndex;
    scrollTop.value = 0;

    // 会员检查：第20题及以后需要检查会员状态
    if (newIndex >= FREE_LIMIT && !isMember.value) {
      const result = checkAccess('computer', newIndex);
      if (result.showPrompt && !result.canAccess) {
        memberPriceInfo.value = result.subjectInfo;
        showMemberModal.value = true;
      }
    }

    // 记录做题次数
    recordQuestionView('computer');

    await loadNearbyQuestions(currentIndex.value);
    loadQuestionDetails(currentIndex.value);
    // 保存当前刷题状态
    saveCurrentPracticeState();
  }
};

const scrollToTop = () => {
  scrollTop.value = 0;
};

const previewImage = (url) => {
  if (!url) return;
  uni.previewImage({
    urls: [url],
    current: url
  });
};

const handleImageTap = (attrs) => {
  if (attrs && attrs.src) {
    previewImage(attrs.src);
  }
};

const getOptionClass = (qIndex, oIndex) => {
  const state = questionStates.value[qIndex];
  const question = questions.value[qIndex];
  if (!state || !question) return '';
  
  const label = String.fromCharCode(65 + oIndex);
  
  if (!state.showAnswer && !settings.value.recitationMode) {
    return (state.userAnswer && state.userAnswer.includes(label)) ? 'selected' : '';
  }
  
  const isCorrect = (question.answer || '').includes(label);
  const isSelected = (state.userAnswer || '').includes(label);
  
  if (isCorrect) return 'correct';
  if (isSelected && !isCorrect) return 'error';
  return '';
};

const isCorrectOption = (question, index) => {
  return (question.answer || '').includes(String.fromCharCode(65 + index));
};

const isSelectedOption = (qIndex, index) => {
  return (questionStates.value[qIndex]?.userAnswer || '').includes(String.fromCharCode(65 + index));
};

const shouldShowAnswer = (qIndex) => {
  return questionStates.value[qIndex]?.showAnswer || settings.value.recitationMode;
};

const formatContent = (text, type = 'explanation', isRich = false, qIndex = -1, exerciseType = null) => {
  if (!text) {
    return '';
  }
  
  try {
    let processedHtml = String(text);

  // 如果没有显式传 exerciseType，尝试从 questions 中获取
  if (exerciseType === null && qIndex !== -1 && questions.value[qIndex]) {
    exerciseType = questions.value[qIndex].exercise_type;
  }

  // 1. 预处理：规范化换行符和基础 LaTeX/富文本初步处理
  processedHtml = processedHtml.replace(/\\n/g, '\n');
  
  // 识别并标记代码块，防止被 transformContextString 破坏
  const codeBlocks = [];
  // 改进正则：支持嵌套的 <code> 标签在 <pre> 内部的情况，并保留原始 class 属性
  processedHtml = processedHtml.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (match, content) => {
    const placeholder = `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length}__`;
    codeBlocks.push({ placeholder, match });
    return placeholder;
  });
  
  // 处理独立的 code 标签（不在 pre 内部的）
  processedHtml = processedHtml.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (match, content) => {
    // 如果已经在占位符中了，不再处理
    if (match.includes('__CODE_BLOCK_PLACEHOLDER_')) return match;
    const placeholder = `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length}__`;
    codeBlocks.push({ placeholder, match });
    return placeholder;
  });

  // 先执行通用的 transformContextString，它会处理 LaTeX 和基础 HTML 标签
  processedHtml = transformContextString(processedHtml);

  // 还原代码块
  codeBlocks.forEach(({ placeholder, match }) => {
    // 识别是 pre 还是独立的 code
    const isPre = /^<pre/i.test(match);
    
    // 提取核心内容，如果是 <pre><code>...</code></pre> 则只取最内层
    let codeContent = '';
    const innerCodeMatch = match.match(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/i);
    if (innerCodeMatch) {
      codeContent = innerCodeMatch[1];
    } else {
      const generalMatch = match.match(/<(pre|code)[^>]*>([\s\S]*?)<\/\1>/i);
      codeContent = generalMatch ? generalMatch[2] : '';
    }
    
    // 彻底清理 transformContextString 可能带入的标签
    codeContent = codeContent.replace(/<span[^>]*>|<\/span>/gi, '');
    // 移除可能存在的内部 p 标签
    codeContent = codeContent.replace(/<p[^>]*>|<\/p>/gi, '\n');
    
    // 缩进优化：将 4 个或 2 个空格的缩进减小，或者处理 tab
    // 计算机代码常见的 4 空格缩进在移动端太占空间，改为 2 空格
    codeContent = codeContent.replace(/^(\s{4,})/gm, (match) => {
      return '  '.repeat(Math.ceil(match.length / 4));
    });
    // 处理 Tab
    codeContent = codeContent.replace(/\t/g, '  ');
    
    // 规范化 HTML 实体：先统一解码，再统一转义，确保在 pre/code 标签内是安全的
    codeContent = codeContent
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ');

    // 处理代码块中的 LaTeX 公式（如 $\leftarrow$）
    // 将常见的 LaTeX 符号替换为对应的 Unicode 字符
    const latexSymbols = {
      '\\leftarrow': '←',
      '\\rightarrow': '→',
      '\\Leftarrow': '⇐',
      '\\Rightarrow': '⇒',
      '\\leftrightarrow': '↔',
      '\\Leftrightarrow': '⇔',
      '\\uparrow': '↑',
      '\\downarrow': '↓',
      '\\Uparrow': '⇑',
      '\\Downarrow': '⇓',
      '\\leq': '≤',
      '\\geq': '≥',
      '\\neq': '≠',
      '\\approx': '≈',
      '\\equiv': '≡',
      '\\pm': '±',
      '\\times': '×',
      '\\div': '÷',
      '\\cdot': '·',
      '\\infty': '∞',
      '\\alpha': 'α',
      '\\beta': 'β',
      '\\gamma': 'γ',
      '\\delta': 'δ',
      '\\Delta': 'Δ',
      '\\theta': 'θ',
      '\\lambda': 'λ',
      '\\mu': 'μ',
      '\\pi': 'π',
      '\\sigma': 'σ',
      '\\Sigma': 'Σ',
      '\\phi': 'φ',
      '\\omega': 'ω'
    };
    
    // 处理 $...$ 格式的行内公式
    codeContent = codeContent.replace(/\$([^$]+)\$/g, (match, formula) => {
      let result = formula;
      // 替换 LaTeX 符号
      for (const [latex, unicode] of Object.entries(latexSymbols)) {
        result = result.replace(new RegExp(latex.replace(/\\/g, '\\\\'), 'g'), unicode);
      }
      return result;
    });
    
    // 转义回 HTML 实体，防止 rich-text 解析错误
    const escapeHTML = (str) => str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
    
    codeContent = escapeHTML(codeContent);

    // 重新设计代码块：采用浅色主题（与主色调一致），优化阅读体验
    // 自动换行，避免横向滚动与题目切换冲突
    const styledCode = isPre
      ? `<div style="width: 100%; background: #e0f2f1; border-radius: 8px; margin: 12px 0; border: 1px solid #b2dfdb; overflow: hidden;">
          <pre style="display: block; margin: 0; padding: 16px; color: #333; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; overflow-wrap: break-word;">${codeContent}</pre>
         </div>`
      : `<code style="background: #e0f2f1; color: #333; padding: 2px 6px; border-radius: 4px; font-family: 'Consolas', 'Monaco', monospace; word-break: break-all; border: 1px solid #b2dfdb; margin: 0 4px; font-size: 15px;">${codeContent}</code>`;
    
    processedHtml = processedHtml.replace(placeholder, styledCode);
  });

  // 2. 题干特有的填空/横线处理 (在 transformContextString 之后执行)
  if (type === 'title' || type === 'option' || type === 'explanation') {
    // 移除题干末尾可能存在的重复索引
    if (type === 'title' && qIndex !== -1 && exerciseType === 3) {
      processedHtml = processedHtml.replace(/\s*[\(（]\d+[\)）]\s*$/g, '');
    }

    // 替换带序号的标识符：$1$, **1**, [1], (1)
    const blankRegex = /[\$＄][\*＊][\$＄](\d+)[\$＄][\*＊][\$＄]|[\$＄][\*＊](\d+)[\*＊][\$＄]|[\*＊](\d+)[\*＊]/g;
    processedHtml = processedHtml.replace(blankRegex, (match, p1, p2, p3) => {
      const num = p1 || p2 || p3;
      // 只有填空题（type 3）才渲染为带横线的占位符，其他题型仅显示序号
      if (exerciseType === 3) {
        return `<span class="blank-placeholder" data-index="${num}"><span class="blank-index">(${num})</span><span class="blank-underline"></span></span>`;
      }
      return `(${num})`;
    });

    // 只有填空题才进行后续的横线处理
    if (exerciseType === 3) {
      // 处理 (1)____ 这种组合情况
      processedHtml = processedHtml.replace(/[\(（](\d+)[\)）]([\s\u3000_]{1,50})/g, (match, num) => {
        return `<span class="blank-placeholder" data-index="${num}"><span class="blank-index">(${num})</span><span class="blank-underline"></span></span>`;
      });

      // 处理独立的 (1) (2) 等
      processedHtml = processedHtml.replace(/(?<!blank-index">)[\(（](\d+)[\)）](?!\d)/g, (match, num) => {
        return `<span class="blank-placeholder" data-index="${num}"><span class="blank-index">(${num})</span><span class="blank-underline"></span></span>`;
      });

      // 处理不带序号的横线标识
      const simpleUnderline = '<span class="blank-placeholder" data-type="simple"><span class="blank-underline"></span></span>';
      processedHtml = processedHtml.replace(/\[_{1,}\]|\(_{1,}\)|_{2,20}/g, simpleUnderline);
      processedHtml = processedHtml.replace(/\[[\s\u3000]{1,}\]|\([\s\u3000]{1,}\)|（[\s\u3000]{1,}）/g, simpleUnderline);
      processedHtml = processedHtml.replace(/_{3,}/g, simpleUnderline);
      processedHtml = processedHtml.replace(/[\s\u3000]{3,20}/g, simpleUnderline);
      
      // 清理重复
      processedHtml = processedHtml.replace(/<span class="blank-placeholder"[^>]*><span class="blank-placeholder"/g, '<span class="blank-placeholder"');
    }
  }

  // 3. 处理填空题 JSON 格式的答案展示
  if (type === 'explanation' && isRich && exerciseType === 3) {
    try {
      if (processedHtml.includes('blank-answer-item')) {
        // 已格式化
      } else {
        const parsed = JSON.parse(processedHtml);
        if (Array.isArray(parsed)) {
          processedHtml = parsed.map((ans, i) => {
            const cleanAns = String(ans).replace(/<(p|div|span)[^>]*>|<\/(p|div|span)>/gi, '').trim();
            const hasIndex = /^\s*[\(（]?\d+[\)）\.\s\、]/.test(cleanAns);
            return `<span class="blank-answer-item" style="display: block; margin-bottom: 8rpx;">${hasIndex ? '' : `<span class="blank-num">(${i + 1})</span>`} <span class="blank-val">${cleanAns}</span></span>`;
          }).join('');
        }
      }
    } catch (e) {
      // 不是 JSON 或者是简单字符串
      if (processedHtml && !processedHtml.includes('blank-answer-item')) {
         const cleanText = processedHtml.replace(/<(p|div|span)[^>]*>|<\/(p|div|span)>/gi, '').trim();
         if (cleanText) {
           const hasIndex = /^\s*[\(（]?\d+[\)）\.\s\、]/.test(cleanText);
           processedHtml = `<span class="blank-answer-item" style="display: block; margin-bottom: 8rpx;">${hasIndex ? '' : '<span class="blank-num">(1)</span> '} <span class="blank-val">${cleanText}</span></span>`;
         }
      }
    }
  }

  // 4. 实体处理：移除全局解码，仅保留必要的特殊字符转换
  processedHtml = processedHtml
    .replace(/&nbsp;/g, '\u00A0');

  // 5. 标签清理：移除冗余的容器标签，保持结构扁平化
  // 仅移除空标签或极端嵌套，保留基础结构以支持富文本
  processedHtml = processedHtml.replace(/<p\s*>\s*<\/p>/gi, '');
  
  // 移除多余的 br
  processedHtml = processedHtml.replace(/(<br\s*\/?>){3,}/gi, '<br/><br/>');

  // 6. 处理图片渲染逻辑 (确保 URL 正确并适配样式)
  processedHtml = processedHtml.replace(/<img\s+[^>]*?src\s*=\s*["']([^"']+)["'][^>]*>/gi, (match, src) => {
    let finalSrc = src;
    if (src.startsWith('//')) {
      finalSrc = 'https:' + src;
    } else if (!src.toLowerCase().startsWith('http') && !src.startsWith('data:')) {
      const baseUrl = FILE_BASE_URL || 'https://cheese.yanzhishi.cn';
      finalSrc = baseUrl + (src.startsWith('/') ? src : '/' + src);
    }
    
    finalSrc = finalSrc.replace(/^(HTTP|HTTPS):\/\/([^\/]+)/i, (m, proto, domain) => proto.toLowerCase() + '://' + domain.toLowerCase());
    finalSrc = finalSrc.replace(/\.(PNG|JPG|JPEG|GIF|WEBP)(\?.*)?$/i, (m, ext, query) => '.' + ext.toLowerCase() + (query || ''));

    const styleMatch = match.match(/style=["']([^"']*)["']/i);
    const existingStyle = styleMatch ? styleMatch[1] : '';
    const newStyle = `max-width:100%;height:auto;margin:10px 0;display:block;${existingStyle}`;
    
    return `<img src="${finalSrc}" referrerpolicy="no-referrer" style="${newStyle}" />`;
  });

  // 7. 处理代码块换行和样式
  // 已经在代码块还原阶段（步骤1）处理完毕，此处仅作为兜底清理 placeholder
  if (processedHtml.includes('__CODE_BLOCK_PLACEHOLDER_')) {
    processedHtml = processedHtml.replace(/__CODE_BLOCK_PLACEHOLDER_\d+__/g, '');
  }

  // 8. 最终清理与统一包裹
  processedHtml = processedHtml.replace(/&nbsp;/g, '\u00A0');
  
  // 9. 处理段落换行 - 针对题干和解析类型
  if (type === 'title' || type === 'explanation') {
    // 保护已渲染的 HTML 元素（公式、代码块、图片等）
    const renderedElements = [];
    // 保护代码块
    processedHtml = processedHtml.replace(/<div[^>]*>\s*<pre[\s\S]*?<\/pre>\s*<\/div>/gi, (match) => {
      const placeholder = `__RENDERED_ELEMENT_${renderedElements.length}__`;
      renderedElements.push({ placeholder, content: match });
      return placeholder;
    });
    // 保护公式（katex 渲染的 span）
    processedHtml = processedHtml.replace(/<span[^>]*class="katex[\s\S]*?<\/span>/gi, (match) => {
      const placeholder = `__RENDERED_ELEMENT_${renderedElements.length}__`;
      renderedElements.push({ placeholder, content: match });
      return placeholder;
    });
    // 保护图片
    processedHtml = processedHtml.replace(/<img[^>]*>/gi, (match) => {
      const placeholder = `__RENDERED_ELEMENT_${renderedElements.length}__`;
      renderedElements.push({ placeholder, content: match });
      return placeholder;
    });
    
    // 标准化换行符
    processedHtml = processedHtml.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // 如果内容没有使用 <p> 标签包裹，则按段落分割
    if (!processedHtml.includes('<p') && !processedHtml.includes('<div')) {
      // 将多个连续换行符视为段落分隔
      const paragraphs = processedHtml.split(/\n{2,}/).filter(p => p.trim());
      if (paragraphs.length > 1) {
        processedHtml = paragraphs.map(p => {
          // 段落内部单个换行转为 <br>
          const withBr = p.replace(/\n/g, '<br>');
          return `<p style="margin: 0 0 12px 0; line-height: 1.8;">${withBr}</p>`;
        }).join('');
      } else if (paragraphs.length === 1) {
        // 只有一个段落，将单个换行转为 <br>
        processedHtml = paragraphs[0].replace(/\n/g, '<br>');
      }
    } else {
      // 已有 HTML 标签，只处理剩余的换行符
      processedHtml = processedHtml.replace(/\n/g, '<br>');
    }
    
    // 恢复被保护的元素
    renderedElements.forEach(({ placeholder, content }) => {
      processedHtml = processedHtml.replace(placeholder, content);
    });
  } else if (!/<(p|div|br|table|img|pre)/i.test(processedHtml)) {
    // 其他类型且没有 HTML 标签的，将换行转为 <br>
    processedHtml = processedHtml.replace(/\n+/g, '<br/>');
  }
    
    return processedHtml;
  } catch (e) {
    return `<div class="content-error">${text}</div>`;
  }
};

const formatTitle = (text, qIndex = -1, exerciseType = null) => formatContent(text, 'title', false, qIndex, exerciseType);
const formatExplanation = (text, qIndex = -1, exerciseType = null) => formatContent(text, 'explanation', false, qIndex, exerciseType);

// 预处理内容（用于 mp-html 渲染）
const preprocessContent = (content) => {
  if (!content) return '';

  let text = content;

  // 处理裸图片 URL（不在 Markdown 格式中的图片链接）
  // 使用负向前瞻确保不匹配到 HTML 标签内的 URL，也不匹配 Markdown 图片格式中的 URL
  text = text.replace(/(?<!!\[)(https?:\/\/[^\s<>"]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp))(?:_yjs|_thumb|_small|_medium|_large)?(?!["'])(?![^<]*>)/gi, (match, url) => {
    let cleanUrl = url.replace(/(_yjs|_thumb|_small|_medium|_large)$/i, '');
    return `![image](${cleanUrl})`;
  });

  // 处理 Markdown 格式图片，移除 _yjs 等后缀
  text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp|svg|bmp))(?:_yjs|_thumb|_small|_medium|_large)?([^\)]*)\)/gi, (match, alt, url, rest) => {
    return `![${alt}](${url}${rest})`;
  });

  return text;
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
    
    await request({
      url: '/computer1/feedback',
      method: 'POST',
      data: {
        questionId: question.question_id,
        type: feedbackType.value,
        content: feedbackContent.value
      }
    });
    uni.showToast({ title: '反馈提交成功', icon: 'success' });
    showFeedback.value = false;
    feedbackContent.value = '';
  } catch (error) {
    uni.showToast({ title: '提交失败，请重试', icon: 'none' });
  }
};

// 页面分享配置
// #ifdef MP-WEIXIN
onShareAppMessage(() => {
  return {
    title: `考研刷题宝 - 一起刷题备考`,
    path: `/pages/index/index`,
    imageUrl: '/static/logo.png'
  };
});

onShareTimeline(() => {
  return {
    title: `考研刷题宝 - 一起刷题备考`,
    imageUrl: '/static/logo.png'
  };
});
// #endif
</script>

<!-- v20260129-01: 优化填空题横线、移除冗余标签并修复图片渲染 -->
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
      <text class="nav-title">{{ navTitle }}</text>
      <view class="nav-right-placeholder"></view>
    </view>

    <!-- 进度条与统计 -->
    <view class="progress-section">
      <view class="progress-info">
        <view class="progress-info-left">
          <view class="question-type-tag">
            <text>{{ currentQuestionTypeLabel }}</text>
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
    </view>

    <!-- 练习内容区域 -->
    <scroll-view 
      v-if="questions.length > 0 && currentQuestion"
      class="content-area" 
      scroll-y 
      :enable-back-to-top="true" 
      :show-scrollbar="false"
      :enhanced="true"
      :scroll-top="scrollTop"
      @scroll="onScroll"
    >
      <view class="practice-container">
        <!-- 题目卡片 -->
        <view class="question-card">
          <view class="question-header">
            <view class="question-title-wrap">
              <!-- 题号和来源信息在同一行 -->
              <view class="question-header-row">
                <text class="question-index">{{ currentIndex + 1 }}.</text>
                <text v-if="getQuestionSource(currentQuestion)" class="question-source">{{ getQuestionSource(currentQuestion) }}</text>
                <text v-if="currentQuestion.score" class="question-score-tag">{{ currentQuestion.score }}分</text>
              </view>
              
              <!-- 题目内容 -->
              <view class="question-title-content">
                <view class="question-title" :style="{ fontSize: dynamicFontSize.title }">
                  <!-- 如果是填空题，先尝试行内渲染 -->
                  <!-- #ifdef H5 -->
                  <mp-html v-if="currentQuestion.exercise_type === 3" :content="currentQuestion.truncatedStem || currentQuestion.stem" class="title-rich-text" markdown @imgtap="handleImageTap"></mp-html>
                  <!-- 其他题型：如果有截断题干则显示截断的，否则显示完整的原始题干 -->
                  <mp-html v-else :content="currentQuestion.truncatedStem || currentQuestion.originalStem" class="title-rich-text" markdown @imgtap="handleImageTap"></mp-html>
                  <!-- #endif -->
                  <!-- #ifdef MP-WEIXIN -->
                  <template v-if="currentQuestion.exercise_type === 3">
                    <template v-if="hasCodeBlock(currentQuestion.truncatedStem || currentQuestion.stem)">
                      <view v-for="(segment, idx) in parseContentWithCodeBlocks(currentQuestion.truncatedStem || currentQuestion.stem)" :key="idx">
                        <view v-if="segment.type === 'code'" class="code-block-wrapper">
                          <scroll-view 
                            class="code-block-scroll" 
                            scroll-x="true"
                            scroll-with-animation="true"
                          >
                            <view class="code-block-content">
                              <view class="code-content-text">{{ segment.content }}</view>
                            </view>
                          </scroll-view>
                        </view>
                        <template v-else>
                          <template v-for="(item, i) in parseContentWithImages(segment.content)" :key="i">
                            <mp-html v-if="item.type === 'html'" :content="item.content" markdown @imgtap="handleImageTap"></mp-html>
                            <image v-else-if="item.type === 'image'" :src="item.src" mode="widthFix" style="max-width: 100%; display: block;" @click="previewImage(item.src)"></image>
                          </template>
                        </template>
                      </view>
                    </template>
                    <template v-else>
                      <template v-for="(item, idx) in parseContentWithImages(currentQuestion.truncatedStem || currentQuestion.stem)" :key="idx">
                        <mp-html v-if="item.type === 'html'" :content="item.content" markdown @imgtap="handleImageTap"></mp-html>
                        <image v-else-if="item.type === 'image'" :src="item.src" mode="widthFix" style="max-width: 100%; display: block;" @click="previewImage(item.src)"></image>
                      </template>
                    </template>
                  </template>
                  <template v-else>
                    <template v-if="hasCodeBlock(currentQuestion.truncatedStem || currentQuestion.originalStem)">
                      <view v-for="(segment, idx) in parseContentWithCodeBlocks(currentQuestion.truncatedStem || currentQuestion.originalStem)" :key="idx">
                        <view v-if="segment.type === 'code'" class="code-block-wrapper">
                          <scroll-view 
                            class="code-block-scroll" 
                            scroll-x="true"
                            scroll-with-animation="true"
                          >
                            <view class="code-block-content">
                              <view class="code-content-text">{{ segment.content }}</view>
                            </view>
                          </scroll-view>
                        </view>
                        <template v-else>
                          <template v-for="(item, i) in parseContentWithImages(segment.content)" :key="i">
                            <mp-html v-if="item.type === 'html'" :content="item.content" markdown @imgtap="handleImageTap"></mp-html>
                            <image v-else-if="item.type === 'image'" :src="item.src" mode="widthFix" style="max-width: 100%; display: block;" @click="previewImage(item.src)"></image>
                          </template>
                        </template>
                      </view>
                    </template>
                    <template v-else>
                      <template v-for="(item, idx) in parseContentWithImages(currentQuestion.truncatedStem || currentQuestion.originalStem)" :key="idx">
                        <mp-html v-if="item.type === 'html'" :content="item.content" markdown @imgtap="handleImageTap"></mp-html>
                        <image v-else-if="item.type === 'image'" :src="item.src" mode="widthFix" style="max-width: 100%; display: block;" @click="previewImage(item.src)"></image>
                      </template>
                    </template>
                  </template>
                  <!-- #endif -->
                </view>
              </view>
            </view>
          </view>
          
          <!-- 题目图片 (如果有的话) -->
          <view v-if="currentQuestion.topic_image" class="question-image-box">
            <image :src="currentQuestion.topic_image" mode="widthFix" @tap="previewImage(currentQuestion.topic_image)"></image>
          </view>
          
          <!-- 选项列表 (选择题) -->
          <view v-if="[1, 2, 5].includes(currentQuestion.exercise_type) && currentQuestion.options && currentQuestion.options.length > 0" class="options-list">
            <view 
              v-for="(option, index) in currentQuestion.options" 
              :key="index"
              class="option-item"
              :class="getOptionClass(currentIndex, index)"
              @tap="handleSelect(currentIndex, index)"
            >
              <view class="option-label">{{ String.fromCharCode(65 + index) }}</view>
              <view class="option-content" :style="{ fontSize: dynamicFontSize.option }">
                <template v-for="(item, idx) in parseContentWithImages(option.option_value || option.text || option)" :key="idx">
                  <mp-html v-if="item.type === 'html'" :content="item.content" markdown @imgtap="handleImageTap"></mp-html>
                  <image v-else-if="item.type === 'image'" :src="item.src" mode="widthFix" style="max-width: 100%; display: block;" @click="previewImage(item.src)"></image>
                </template>
              </view>
              <view v-if="shouldShowAnswer(currentIndex)" class="result-icon">
                <SvgIcon v-if="isCorrectOption(currentQuestion, index)" name="correct" size="32" fill="#4caf50" />
                <SvgIcon v-else-if="isSelectedOption(currentIndex, index)" name="error" size="32" fill="#f44336" />
              </view>
            </view>
          </view>

          <!-- 确定答案按钮 (选择题且未显示答案时显示) -->
          <view v-if="[1, 2, 5].includes(currentQuestion.exercise_type) && !shouldShowAnswer(currentIndex) && questionStates[currentIndex]?.userAnswer" class="confirm-btn-wrap">
            <button class="main-action-btn" @tap="confirmAnswer(currentIndex)">确定答案</button>
          </view>

          <!-- 填空题 输入区域 -->
          <view v-if="currentQuestion.exercise_type === 3" class="blank-input-section">
            <view class="blank-input-card">
              <view v-for="(ans, bIdx) in (questionStates[currentIndex]?.blankAnswers || [])" :key="bIdx" class="blank-input-item">
                <textarea 
                  v-model="questionStates[currentIndex].blankAnswers[bIdx]" 
                  class="blank-textarea"
                  :placeholder="'请输入填空 (' + (bIdx + 1) + ') 的答案'"
                  placeholder-style="color: #bbb;"
                  :disabled="shouldShowAnswer(currentIndex)"
                  auto-height
                  @blur="updateProgress(currentIndex)"
                />
              </view>
            </view>
          </view>

          <!-- 解答题 输入区域 -->
          <view v-if="currentQuestion.exercise_type === 4 || currentQuestion.exercise_type_name?.includes('解答') || currentQuestion.exercise_type_name?.includes('综合')" class="short-answer-section">
            <!-- 有小题的情况 -->
            <view v-if="currentQuestion.subs && currentQuestion.subs.length > 0" class="sub-questions">
              <view v-for="(sub, sIdx) in currentQuestion.subs" :key="sub.sub_id || sub.id || sIdx" class="sub-item">
                <view class="sub-header" v-if="sub.score">
                  <text class="sub-score">[{{ sub.score }}分]</text>
                </view>
                <view class="sub-stem">
                  <view class="sub-index">{{ sIdx + 1 }}.</view>
                  <mp-html :content="sub.stem" markdown @imgtap="handleImageTap"></mp-html>
                </view>
                <textarea 
                  v-if="questionStates[currentIndex]?.subAnswers"
                  v-model="questionStates[currentIndex].subAnswers[sub.sub_id || sub.id || sIdx]" 
                  class="short-answer-textarea"
                  placeholder="请输入你的解答内容..."
                  placeholder-style="color: #bbb;"
                  :disabled="shouldShowAnswer(currentIndex)"
                  auto-height
                  @blur="updateProgress(currentIndex)"
                ></textarea>
                
                <!-- 小题答案解析 -->
                <view v-if="shouldShowAnswer(currentIndex)" class="sub-answer-section animated fadeIn">
                  <view class="sub-answer-item">
                    <text class="label">【答案】</text>
                    <view class="value">
                      <!-- #ifdef H5 -->
                      <mp-html :content="sub.answer || sub.originalAnswer || sub.standard_answer || sub.correct_answer" @imgtap="handleImageTap"></mp-html>
                      <!-- #endif -->
                      <!-- #ifdef MP-WEIXIN -->
                      <template v-if="hasCodeBlock(sub.answer || sub.originalAnswer || sub.standard_answer || sub.correct_answer)">
                        <view v-for="(segment, idx) in parseContentWithCodeBlocks(sub.answer || sub.originalAnswer || sub.standard_answer || sub.correct_answer)" :key="idx">
                          <view v-if="segment.type === 'code'" class="code-block-wrapper">
                            <scroll-view class="code-block-scroll" scroll-x="true" scroll-with-animation="true">
                              <view class="code-block-content">
                                <view class="code-content-text">{{ segment.content }}</view>
                              </view>
                            </scroll-view>
                          </view>
                          <template v-else>
                            <template v-for="(item, i) in parseContentWithImages(segment.content)" :key="i">
                              <mp-html v-if="item.type === 'html'" :content="item.content" markdown domain="https://s3.hi168.com" @imgtap="handleImageTap"></mp-html>
                              <image v-else-if="item.type === 'image'" :src="item.src" mode="widthFix" style="max-width: 100%; display: block;" @click="previewImage(item.src)"></image>
                            </template>
                          </template>
                        </view>
                      </template>
                      <template v-else>
                        <template v-for="(item, idx) in parseContentWithImages(sub.answer || sub.originalAnswer || sub.standard_answer || sub.correct_answer)" :key="idx">
                          <mp-html v-if="item.type === 'html'" :content="item.content" markdown domain="https://s3.hi168.com" @imgtap="handleImageTap"></mp-html>
                          <image v-else-if="item.type === 'image'" :src="item.src" mode="widthFix" style="max-width: 100%; display: block;" @click="previewImage(item.src)"></image>
                        </template>
                      </template>
                      <!-- #endif -->
                    </view>
                  </view>
                  <view class="sub-answer-item" v-if="sub.analysis || sub.commentary || sub.method || sub.explanation || sub.solution">
                    <text class="label">【解析】</text>
                    <view class="value">
                      <!-- #ifdef H5 -->
                      <mp-html :content="sub.analysis || sub.commentary || sub.method || sub.explanation || sub.solution" @imgtap="handleImageTap"></mp-html>
                      <!-- #endif -->
                      <!-- #ifdef MP-WEIXIN -->
                      <template v-if="hasCodeBlock(sub.analysis || sub.commentary || sub.method || sub.explanation || sub.solution)">
                        <view v-for="(segment, idx) in parseContentWithCodeBlocks(sub.analysis || sub.commentary || sub.method || sub.explanation || sub.solution)" :key="idx">
                          <view v-if="segment.type === 'code'" class="code-block-wrapper">
                            <scroll-view class="code-block-scroll" scroll-x="true" scroll-with-animation="true">
                              <view class="code-block-content">
                                <view class="code-content-text">{{ segment.content }}</view>
                              </view>
                            </scroll-view>
                          </view>
                          <template v-else>
                            <template v-for="(item, i) in parseContentWithImages(segment.content)" :key="i">
                              <mp-html v-if="item.type === 'html'" :content="item.content" markdown domain="https://s3.hi168.com" @imgtap="handleImageTap"></mp-html>
                              <image v-else-if="item.type === 'image'" :src="item.src" mode="widthFix" style="max-width: 100%; display: block;" @click="previewImage(item.src)"></image>
                            </template>
                          </template>
                        </view>
                      </template>
                      <template v-else>
                        <template v-for="(item, idx) in parseContentWithImages(sub.analysis || sub.commentary || sub.method || sub.explanation || sub.solution)" :key="idx">
                          <mp-html v-if="item.type === 'html'" :content="item.content" markdown domain="https://s3.hi168.com" @imgtap="handleImageTap"></mp-html>
                          <image v-else-if="item.type === 'image'" :src="item.src" mode="widthFix" style="max-width: 100%; display: block;" @click="previewImage(item.src)"></image>
                        </template>
                      </template>
                      <!-- #endif -->
                    </view>
                  </view>
                </view>
              </view>
            </view>
            <!-- 无小题的情况 -->
            <view v-else>
              <textarea 
                v-if="questionStates[currentIndex]"
                v-model="questionStates[currentIndex].shortAnswer" 
                class="short-answer-textarea"
                placeholder="请输入你的解答内容..."
                placeholder-style="color: #bbb;"
                :disabled="shouldShowAnswer(currentIndex)"
                auto-height
                @blur="updateProgress(currentIndex)"
              ></textarea>
            </view>
          </view>

          <!-- 题目报错按钮 -->
          <view class="question-report-wrap">
            <view class="report-btn" @tap="openCorrection(currentQuestion)">
              <SvgIcon name="warning" size="28" fill="#999" />
              <text>题目报错</text>
            </view>
          </view>
        </view>
        
        <!-- 答案解析区域 -->
        <view v-if="shouldShowAnswer(currentIndex)" class="answer-section animated fadeInUp">
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

          <!-- 答题统计卡片 - 仅选择题显示 -->
          <view v-if="[1, 2, 5].includes(currentQuestion.exercise_type)" class="answer-combined-card card-style compact-card">
            <view class="answer-grid">
              <view v-if="!settings.recitationMode" class="grid-item no-border">
                <text class="label">我的</text>
                <text class="value" :class="questionStates[currentIndex]?.userAnswer ? (questionStates[currentIndex]?.isCorrect ? 'correct' : 'error') : ''">
                  {{ questionStates[currentIndex]?.userAnswer || '无' }}
                </text>
              </view>
              <view class="grid-item no-border">
                <text class="label">答案</text>
                <view class="value correct">
                  <!-- 对于简单的选择题答案，使用 rich-text 渲染以处理可能的 HTML 标签 -->
                  <rich-text :nodes="currentQuestion.answer"></rich-text>
                </view>
              </view>
              <view v-if="!settings.recitationMode" class="grid-item no-border">
                <text class="label">结果</text>
                <text class="value" :class="questionStates[currentIndex]?.isCorrect ? 'correct' : 'error'">
                  {{ questionStates[currentIndex]?.isCorrect ? '对' : '错' }}
                </text>
              </view>
              <view class="grid-item no-border">
                <text class="label">正确率</text>
                <text class="value score">{{ sessionAccuracy }}</text>
              </view>
            </view>
          </view>

          <!-- 填空题 答案展示 -->
          <view v-if="currentQuestion.exercise_type === 3" class="explanation-card card-style">
            <view class="section-header">
              <view class="section-title">
                <view class="title-line"></view>
                <text>正确答案</text>
              </view>
            </view>
            <view class="explanation-content" :style="{ fontSize: dynamicFontSize.explanation }">
              <!-- #ifdef H5 -->
              <mp-html :content="currentQuestion.displayAnswer || currentQuestion.answer" @imgtap="handleImageTap"></mp-html>
              <!-- #endif -->
              <!-- #ifdef MP-WEIXIN -->
              <template v-for="(item, idx) in parseContentWithImages(currentQuestion.displayAnswer || currentQuestion.answer)" :key="idx">
                <mp-html v-if="item.type === 'html'" :content="item.content" markdown domain="https://s3.hi168.com" @imgtap="handleImageTap"></mp-html>
                <image v-else-if="item.type === 'image'" :src="item.src" mode="widthFix" style="max-width: 100%; display: block;" @click="previewImage(item.src)"></image>
              </template>
              <!-- #endif -->
            </view>
          </view>

          <!-- 解答题 答案展示 (无小题时) -->
          <view v-if="(currentQuestion.exercise_type === 4 || currentQuestion.exercise_type_name?.includes('解答') || currentQuestion.exercise_type_name?.includes('综合')) && (!currentQuestion.subs || currentQuestion.subs.length === 0) && currentQuestion.answer" class="explanation-card card-style">
            <view class="section-header">
              <view class="section-title">
                <view class="title-line"></view>
                <text>参考答案</text>
              </view>
            </view>
            <view class="explanation-content" :style="{ fontSize: dynamicFontSize.explanation }">
              <!-- #ifdef H5 -->
              <mp-html :content="currentQuestion.answer" @imgtap="handleImageTap"></mp-html>
              <!-- #endif -->
              <!-- #ifdef MP-WEIXIN -->
              <template v-for="(item, idx) in parseContentWithImages(currentQuestion.answer)" :key="idx">
                <mp-html v-if="item.type === 'html'" :content="item.content" markdown domain="https://s3.hi168.com" @imgtap="handleImageTap"></mp-html>
                <image v-else-if="item.type === 'image'" :src="item.src" mode="widthFix" style="max-width: 100%; display: block;" @click="previewImage(item.src)"></image>
              </template>
              <!-- #endif -->
            </view>
          </view>

          <!-- 题目解析 -->
          <view v-if="hasRealContent(currentQuestion.analysis)" class="explanation-card card-style">
            <view class="section-header">
              <view class="section-title">
                <view class="title-line"></view>
                <text>题目解析</text>
              </view>
            </view>
            <view class="explanation-content" :style="{ fontSize: dynamicFontSize.explanation }">
              <!-- #ifdef H5 -->
              <mp-html :content="currentQuestion.analysis" @imgtap="handleImageTap"></mp-html>
              <!-- #endif -->
              <!-- #ifdef MP-WEIXIN -->
              <template v-for="(item, idx) in parseContentWithImages(currentQuestion.analysis)" :key="idx">
                <mp-html v-if="item.type === 'html'" :content="item.content" markdown domain="https://s3.hi168.com" @imgtap="handleImageTap"></mp-html>
                <image v-else-if="item.type === 'image'" :src="item.src" mode="widthFix" style="max-width: 100%; display: block;" @click="previewImage(item.src)"></image>
              </template>
              <!-- #endif -->
            </view>
          </view>

          <!-- 考点展示 -->
          <view v-if="currentQuestion.tags && currentQuestion.tags.length > 0" class="explanation-card card-style">
            <view class="section-header">
              <view class="section-title">
                <view class="title-line"></view>
                <text>考点</text>
              </view>
            </view>
            <view class="tags-container">
              <template v-for="tag in currentQuestion.tags" :key="tag.tag_id">
                <view v-if="tag.tag_name && tag.tag_name.trim() && !/^\d+$/.test(tag.tag_name.trim())" class="tag-item">
                  {{ tag.tag_name.trim().replace(/^专业基础\((.*)\)$/, '$1').replace(/^专业基础/, '') }}
                </view>
              </template>
            </view>
          </view>

          <!-- 视频解析 (有视频且设置开启才显示) -->
          <view v-if="settings.showVideoAnalysis && currentQuestion.video_url" class="explanation-card card-style">
            <view class="section-header">
              <view class="section-title">
                <view class="title-line"></view>
                <text>视频解析</text>
              </view>
            </view>
            <view class="video-container">
              <video 
                class="analysis-video" 
                :src="currentQuestion.video_url" 
                controls
                object-fit="contain"
                :poster="currentQuestion.topic_image || ''"
              ></video>
            </view>
          </view>

          <!-- 笔记区域 -->
          <view class="notes-section card-style">
            
            <view class="notes-header">
              <view class="section-title">
                <view class="title-line"></view>
                <text>笔记</text>
              </view>
              <view class="add-note-btn" @tap="openAddNote">
                <SvgIcon name="edit" size="30" fill="#fff" />
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
                  <SvgIcon name="sort" size="24" fill="#999" />
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
                    <!-- #ifdef H5 -->
                    <mp-html :content="note.content" @imgtap="handleImageTap"></mp-html>
                    <!-- #endif -->
                    <!-- #ifdef MP-WEIXIN -->
                    <mp-html v-if="hasLatex(note.content)" :content="note.content" markdown @imgtap="handleImageTap"></mp-html>
                    <rich-text v-else :nodes="note.content"></rich-text>
                    <!-- #endif -->
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
                        <view class="reply-content-row">
                          <text class="reply-user">{{ reply.username }}:</text>
                          <!-- #ifdef H5 -->
                          <mp-html class="reply-content" :content="reply.content" @imgtap="handleImageTap"></mp-html>
                          <!-- #endif -->
                          <!-- #ifdef MP-WEIXIN -->
                          <mp-html v-if="hasLatex(reply.content)" class="reply-content" :content="reply.content" markdown @imgtap="handleImageTap"></mp-html>
                          <rich-text v-else class="reply-content" :nodes="reply.content"></rich-text>
                          <!-- #endif -->
                          <text
                            v-if="String(reply.user_id || reply.userId) === String(currentUserId)"
                            class="delete-reply-btn"
                            @tap.stop="deleteReply(reply, note)"
                          >删除</text>
                        </view>
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
                        <SvgIcon :name="note.isLiked ? 'like-fill' : 'like'" size="28" :fill="note.isLiked ? 'var(--primary-color)' : '#999'" />
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

              <view v-if="filteredNotes.length === 0" class="empty-notes" @tap="openAddNote">
                暂无笔记，快来抢沙发吧~
              </view>
            </view>
          </view>
        </view>

        <!-- 操作按钮区域 -->
        <view class="confirm-btn-wrap">
          <!-- 多选题/填空题/解答题未提交时显示确认按钮 -->
          <button 
            v-if="([2, 3, 4].includes(currentQuestion.exercise_type) || currentQuestion.exercise_type_name?.includes('解答') || currentQuestion.exercise_type_name?.includes('综合')) && !shouldShowAnswer(currentIndex) && !settings.recitationMode" 
            class="main-action-btn" 
            @tap="confirmAnswer(currentIndex)"
          >
            {{ ([3, 4].includes(currentQuestion.exercise_type) || currentQuestion.exercise_type_name?.includes('解答') || currentQuestion.exercise_type_name?.includes('综合')) ? '查看参考答案' : '确定答案' }}
          </button>
          
          <!-- 已显示答案且不是最后一题时显示下一题按钮 -->
          <button 
            v-if="shouldShowAnswer(currentIndex) && currentIndex < totalCount - 1" 
            class="main-action-btn next-btn" 
            @tap="goToNextQuestion"
          >下一题</button>
        </view>
      </view>
      
      <!-- 底部占位 -->
      <view style="height: 140rpx;"></view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="bottom-action-bar" v-if="questions.length > 0">
      <view class="action-item">
        <SvgIcon name="correct" size="40" fill="#4caf50" />
        <text class="num success">{{ correctCount }}</text>
      </view>
      <view class="action-item">
        <SvgIcon name="error" size="40" fill="#f44336" />
        <text class="num danger">{{ errorCount }}</text>
      </view>
      <view class="action-item" @tap="toggleFavorite">
        <SvgIcon :name="questionStates[currentIndex]?.isFavorite ? 'star-fill' : 'star'" size="44" :fill="questionStates[currentIndex]?.isFavorite ? '#ffb74d' : '#666'" />
      </view>
      <view class="action-item" @tap="showAnswerSheet = true">
        <SvgIcon name="answer-sheet" size="44" fill="#666" />
      </view>
      
      <view class="nav-btns">
        <view class="nav-btn" :class="{ disabled: currentIndex === 0 }" @tap="goToPrevQuestion">上一题</view>
        <view class="nav-btn next" :class="{ disabled: currentIndex === totalCount - 1 }" @tap="goToNextQuestion">下一题</view>
      </view>
    </view>

    <!-- 答题卡弹窗 -->
    <view class="modal-mask" v-if="showAnswerSheet" @tap="showAnswerSheet = false">
      <view class="answer-sheet-modal animated fadeInUp" @tap.stop>
        <view class="modal-header">
          <text>答题卡</text>
          <text class="close" @tap="showAnswerSheet = false">✕</text>
        </view>
        <!-- 题型颜色说明 -->
        <view class="type-legend">
          <view class="legend-item"><view class="legend-dot type-single"></view><text>单选</text></view>
          <view class="legend-item"><view class="legend-dot type-multi"></view><text>多选</text></view>
          <view class="legend-item"><view class="legend-dot type-blank"></view><text>填空</text></view>
          <view class="legend-item"><view class="legend-dot type-essay"></view><text>解答</text></view>
          <view class="legend-item"><view class="legend-dot type-judge"></view><text>判断</text></view>
        </view>
        <scroll-view scroll-y class="sheet-content">
          <view class="sheet-grid">
            <view 
              v-for="(item, index) in questions" 
              :key="index"
              class="sheet-item"
              :class="[...getSheetItemClass(index).split(' '), getQuestionTypeClass(item)]"
              @tap="jumpToQuestion(index)"
            >
              {{ index + 1 }}
            </view>
          </view>
        </scroll-view>
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
            placeholder-style="color: #999;"
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

    <!-- 回复笔记弹窗 -->
    <view class="modal-mask" v-if="replyTo" @tap="replyTo = null">
      <view class="reply-modal animated fadeInUp" @tap.stop>
        <view class="modal-header">
          <text>回复 @{{ replyTo.username }}</text>
          <text class="close" @tap="replyTo = null">✕</text>
        </view>
        <view class="note-modal-content">
          <textarea 
            v-model="replyContent" 
            placeholder="写下你的回复..." 
            class="note-textarea"
            auto-focus
            fixed
            placeholder-style="color: #999;"
          ></textarea>
          <view class="note-modal-footer">
            <button class="cancel-btn" @tap="replyTo = null">取消</button>
            <button class="submit-btn" @tap="submitReply">发送回复</button>
          </view>
        </view>
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
            <text>视频解析</text>
            <switch :checked="settings.showVideoAnalysis" @change="e => { settings.showVideoAnalysis = e.detail.value; saveUserSettings(); }" color="#4db6ac" />
          </view>
          <view class="setting-item" v-if="pageOptions.mode === 'wrong_book'">
            <text>做对移除错题本</text>
            <switch :checked="settings.removeWhenCorrect" @change="e => { settings.removeWhenCorrect = e.detail.value; }" color="#4db6ac" />
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

    <!-- 反馈弹窗 -->
    <view class="modal-mask" v-if="showFeedback" @tap="showFeedback = false">
      <view class="feedback-modal animated fadeInUp" @tap.stop>
        <view class="modal-header">
          <text>题目反馈</text>
          <text class="close" @tap="showFeedback = false">✕</text>
        </view>
        <view class="feedback-content">
          <view class="feedback-type">
            <text class="label">反馈类型</text>
            <picker 
              :range="['题目纠错', '内容不全', '答案错误', '图片模糊', '其他问题']" 
              @change="(e) => feedbackType = ['题目纠错', '内容不全', '答案错误', '图片模糊', '其他问题'][e.detail.value]"
            >
              <view class="picker-value">
                {{ feedbackType }}
                <text class="arrow">▼</text>
              </view>
            </picker>
          </view>
          <view class="feedback-input-wrap">
            <text class="label">详细描述</text>
            <textarea 
              v-model="feedbackContent" 
              placeholder="请详细描述您发现的问题，以便我们尽快修复..." 
              class="feedback-textarea"
              fixed
              placeholder-style="color: #999;"
            ></textarea>
          </view>
          <view class="modal-footer">
            <button class="cancel-btn" @tap="showFeedback = false">取消</button>
            <button class="confirm-btn" @tap="submitFeedback">提交反馈</button>
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

<style lang="scss" scoped>
// 代码块样式
.code-block-wrapper {
  margin: 16rpx 0;
  background-color: #f0f9f8;
  border-radius: 8rpx;
  border: 1rpx solid #5FBDB5;
  width: 100%;
  
  .code-block-scroll {
    width: 100%;
    white-space: nowrap;
    
    .code-block-content {
      display: inline-flex;
      padding: 20rpx;
      width: 150%;
      
      .code-content-text {
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 28rpx;
        color: #000000;
        font-weight: 500;
        line-height: 1.5;
        white-space: pre;
        flex-shrink: 0;
      }
    }
  }
}

// 虚拟滚动相关样式
.question-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  
  .placeholder-content {
    text-align: center;
    color: #999;
    
    .placeholder-text {
      font-size: 36rpx;
      display: block;
      margin-bottom: 20rpx;
    }
    
    .placeholder-hint {
      font-size: 28rpx;
      color: #bbb;
    }
  }
}

.container {
  height: 100vh;
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
  overflow: hidden; // 保持 hidden，由内部 scroll-view 处理滚动
  position: fixed; // 使用 fixed 锁定屏幕高度
  width: 100%;
  top: 0;
  left: 0;
  font-family: 'Times New Roman', serif;
  
  // 西医主题变量
  --primary-color: #4db6ac;
  --primary-light: #e0f2f1;
  --correct-color: #4caf50;
  --error-color: #f44336;
  --warning-color: #ffb74d;
  
  &.night-mode {
    background-color: #1a1a1a;
    color: #ffffff;
    
    .note-replies {
      background-color: #242424 !important;
      .reply-item {
        .reply-content { color: #bbb !important; }
        .reply-user { color: var(--primary-color) !important; }
      }
    }

    .question-card, 
    .card-style, 
    .bottom-action-bar, 
    .settings-modal,
    .progress-section {
      background-color: #242424 !important;
      color: #ffffff !important;
    }

    .answer-sheet-modal, .settings-modal, .note-modal, .reply-modal, .feedback-modal {
      background-color: #242424 !important;
      .modal-header text { color: #ffffff !important; }
      .sheet-item {
        background: #333 !important; 
        color: #ffffff !important;
        border-color: #444 !important;
        // 题型颜色区分（暗黑模式）- 未做的题只显示边框颜色
        &.type-essay { border-color: #ff9800 !important; color: #ffb74d !important; background: transparent !important; }
        &.type-blank { border-color: #9c27b0 !important; color: #ce93d8 !important; background: transparent !important; }
        &.type-multi { border-color: #2196f3 !important; color: #90caf9 !important; background: transparent !important; }
        &.type-judge { border-color: #795548 !important; color: #bcaaa4 !important; background: transparent !important; }
        &.type-single { border-color: #4caf50 !important; color: #81c784 !important; background: transparent !important; }
        // 已做的题显示背景色
        &.type-essay.answered,
        &.type-essay.correct,
        &.type-essay.error { background: #3d2e1f !important; }
        &.type-blank.answered,
        &.type-blank.correct,
        &.type-blank.error { background: #2d1f2d !important; }
        &.type-multi.answered,
        &.type-multi.correct,
        &.type-multi.error { background: #1a2d3d !important; }
        &.type-judge.answered,
        &.type-judge.correct,
        &.type-judge.error { background: #2d2624 !important; }
        &.type-single.answered,
        &.type-single.correct,
        &.type-single.error { background: #1b3320 !important; }
      }
      // 题型颜色说明（暗黑模式）
      .type-legend {
        border-bottom-color: #333 !important;
        .legend-item {
          text { color: #bbb !important; }
          .legend-dot {
            &.type-single { border-color: #4caf50 !important; background: #1b3320 !important; }
            &.type-multi { border-color: #2196f3 !important; background: #1a2d3d !important; }
            &.type-blank { border-color: #9c27b0 !important; background: #2d1f2d !important; }
            &.type-essay { border-color: #ff9800 !important; background: #3d2e1f !important; }
            &.type-judge { border-color: #795548 !important; background: #2d2624 !important; }
          }
        }
      }
      .note-textarea, .reply-textarea, .feedback-textarea {
        background: #333 !important;
        color: #ffffff !important;
        border-color: #444 !important;
      }
      .picker-value {
        background: #333 !important;
        color: #ffffff !important;
        border-color: #444 !important;
      }
    }

    .note-modal-content {
      .note-textarea { background: #333 !important; color: #ffffff !important; }
      .note-modal-footer button.cancel-btn { background: #333 !important; color: #bbb !important; }
    }

    .answer-sheet-modal {
      background: #242424 !important;
      .modal-header text { color: #ffffff !important; }
      .sheet-item {
        background: transparent !important; 
        color: #ffffff !important;
        border-color: #444 !important;
        // 题型颜色区分（暗黑模式）- 未做的题只显示边框颜色
        &.type-essay { border-color: #ff9800 !important; color: #ffb74d !important; background: transparent !important; }
        &.type-blank { border-color: #9c27b0 !important; color: #ce93d8 !important; background: transparent !important; }
        &.type-multi { border-color: #2196f3 !important; color: #90caf9 !important; background: transparent !important; }
        &.type-judge { border-color: #795548 !important; color: #bcaaa4 !important; background: transparent !important; }
        &.type-single { border-color: #4caf50 !important; color: #81c784 !important; background: transparent !important; }
        // 已做的题显示背景色
        &.type-essay.answered,
        &.type-essay.correct,
        &.type-essay.error { background: #3d2e1f !important; }
        &.type-blank.answered,
        &.type-blank.correct,
        &.type-blank.error { background: #2d1f2d !important; }
        &.type-multi.answered,
        &.type-multi.correct,
        &.type-multi.error { background: #1a2d3d !important; }
        &.type-judge.answered,
        &.type-judge.correct,
        &.type-judge.error { background: #2d2624 !important; }
        &.type-single.answered,
        &.type-single.correct,
        &.type-single.error { background: #1b3320 !important; }
        &.current { border-color: var(--primary-color) !important; color: var(--primary-color) !important; background: #242424 !important; }
        &.answered { color: var(--primary-color) !important; border-color: var(--primary-color) !important; }
        &.correct { color: #81c784 !important; border-color: #81c784 !important; }
        &.error { color: #e57373 !important; border-color: #e57373 !important; }
      }
      // 题型颜色说明（暗黑模式）
      .type-legend {
        border-bottom-color: #333 !important;
        .legend-item {
          text { color: #bbb !important; }
          .legend-dot {
            &.type-single { border-color: #4caf50 !important; background: #1b3320 !important; }
            &.type-multi { border-color: #2196f3 !important; background: #1a2d3d !important; }
            &.type-blank { border-color: #9c27b0 !important; background: #2d1f2d !important; }
            &.type-essay { border-color: #ff9800 !important; background: #3d2e1f !important; }
            &.type-judge { border-color: #795548 !important; background: #2d2624 !important; }
          }
        }
      }
    }
    
    .nav-bar { background: #1a1a1a; }
    .progress-section { background: #242424 !important; }
    .question-type-tag { background: #333 !important; color: var(--primary-color) !important; }
    .option-item {
      background: #2a2a2a !important;
      border-color: #333 !important;
      .option-label { background: #333 !important; color: #ffffff !important; }
      .option-content { color: #ffffff !important; }
      &.selected { background: #1a3a3a !important; border-color: var(--primary-color) !important; }
    }
    .question-title { color: #ffffff !important; }
    .question-source { background: #333 !important; color: #888 !important; }
    .question-index { color: var(--primary-color) !important; }
    .progress-bar-bg { background: #333; }
    .explanation-content { color: #ffffff !important; }
    .section-title text { color: #ffffff !important; }
    .count-box .total { color: #bbb; }
    .note-item { background: #2a2a2a; border-bottom-color: #333; }
    .note-content { color: #ffffff !important; }
    .note-textarea { background: #333; color: #ffffff; }
    .username { color: #eee !important; }
    .note-date { color: #aaa !important; }
    .note-tabs .tab-item { color: #aaa !important; &.active { color: #fff !important; } }
    .no-notes { background: #2a2a2a !important; color: #aaa !important; }
    .blank-input-card { background: #2a2a2a !important; border-color: #333 !important; }
    .blank-textarea { background: #333 !important; color: #fff !important; border-color: #444 !important; }
    .short-answer-textarea { background: #333 !important; color: #fff !important; border-color: #444 !important; }
    .sub-item { background: #2a2a2a !important; border-color: #333 !important; }
    .sub-answer-section { background: #1b3320 !important; border-color: #2e7d32 !important; .label { color: #81c784 !important; } .value { color: #eee !important; } }
  /* 填空题占位符样式 */
  :deep(.blank-placeholder) {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    margin: 0 4rpx;
    
    .blank-index {
      font-size: 24rpx;
      color: var(--primary-color);
      font-weight: bold;
      margin-right: 4rpx;
    }
    
    .blank-underline {
      display: inline-block;
      min-width: 80rpx;
      height: 2rpx;
      background: #333;
      margin-top: 24rpx;
    }
  }

  :deep(.blank-underline-placeholder) {
    display: inline-block;
    min-width: 100rpx;
    height: 2rpx;
    background: #333;
    margin: 0 8rpx;
    vertical-align: middle;
    transform: translateY(8rpx);
  }

  &.night-mode {
    .blank-underline { background: #666; }
    .blank-underline-placeholder { background: #666; }
  }

  .correct-answer-card { background: #1b3320 !important; border-color: #2e7d32 !important; .section-title text, .explanation-content { color: #81c784 !important; } }
    .sub-stem { color: #fff !important; }
    .nav-btn { background: #333 !important; color: #fff !important; border-color: #444 !important; &.next { background: var(--primary-color) !important; border-color: var(--primary-color) !important; } }
    .action-item .num { color: #fff !important; }
    .setting-item { border-bottom-color: #333 !important; text { color: #fff !important; } }
    .font-size-levels { background: #333 !important; .level-item { color: #aaa !important; &.active { background: #444 !important; color: var(--primary-color) !important; } } }
    
    // 覆盖 rich-text 内部样式
    rich-text {
      color: #ffffff !important;
    }

    .sub-answer-section {
      background: #1e2632 !important;
      border-left-color: var(--primary-color) !important;
      .label { color: var(--primary-color) !important; }
      .value { color: #eee !important; }
    }

    .explanation-card {
      background: #1e2632 !important;
      .section-title text { color: #eee !important; }
      .explanation-content { 
        color: #ccc !important; 
        .blank-answer-item {
          background: #151b24 !important;
          .blank-val { color: #ccc !important; }
        }
      }
      // 深度修改 rich-text 内部图片样式
      :deep(img) {
        box-shadow: 0 2rpx 10rpx rgba(255,255,255,0.05) !important;
      }
    }

    .blank-input-section {
      .blank-label { color: #999 !important; }
      .blank-input { background: #333 !important; color: #fff !important; border-color: #444 !important; }
    }
  }
}

.status-bar { width: 100%; }

.nav-bar {
  height: 88rpx;
  background: var(--primary-color);
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  position: relative;
  z-index: 100;
  
  .nav-left {
    display: flex;
    align-items: center;
    width: 160rpx;
    
    .back-btn { padding: 10rpx; }
    .nav-icon-btn { margin-left: 10rpx; padding: 10rpx; }
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
      background: var(--primary-light);
      color: var(--primary-color);
      padding: 4rpx 16rpx;
      border-radius: 20rpx;
      font-size: 20rpx;
      font-weight: 500;
    }
    
    .count-box {
      display: flex;
      align-items: center;
      .current { font-size: 28rpx; font-weight: bold; color: var(--primary-color); }
      .total { font-size: 22rpx; color: #999; margin: 0 12rpx 0 4rpx; }
      
      .recitation-toggle {
        padding: 4rpx 16rpx;
        border: 2rpx solid var(--primary-color);
        border-radius: 20rpx;
        font-size: 20rpx;
        color: var(--primary-color);
        transition: all 0.2s;
        &.active { background: var(--primary-color); color: #fff; }
      }
    }
  }
  
  .progress-bar-bg {
    height: 6rpx;
    background: #f0f0f0;
    border-radius: 3rpx;
    overflow: hidden;
    .progress-active {
      height: 100%;
      background: var(--primary-color);
      border-radius: 3rpx;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }
}

.content-area {
  flex: 1;
  height: 0;
}

.practice-container {
  padding: 24rpx;
  padding-bottom: 140rpx;
}

.question-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 10rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}

.question-header {
  margin-bottom: 10rpx;
}

  .question-title-wrap {
    display: flex;
    flex-direction: column; // 改为纵向布局以支持 meta 信息在上方
    
    .question-meta {
      margin-bottom: 8rpx;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8rpx;
    }
    
    .question-source {
      font-size: 22rpx;
      color: #999;
      background: #f0f4f8;
      padding: 4rpx 16rpx;
      border-radius: 4rpx;
      display: inline-block;
    }

    .question-title-content {
      display: flex;
      flex-direction: column; // 改为纵向布局，题号和来源在一行，题目内容在下一行
      align-items: flex-start;
    }
    
    .question-header-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12rpx;
      margin-bottom: 8rpx;
    }
    
    .question-index {
      font-weight: bold;
      color: var(--primary-color);
      flex-shrink: 0;
      line-height: 1.0;
    }
    
    .question-title {
      flex: 1;
      font-weight: 500;
      line-height: 1.6;
      color: #333;
      display: flex;
      align-items: flex-start;
      flex-wrap: wrap;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
      
      .title-rich-text {
        flex: 1;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        overflow-x: hidden;
      }
    }

    .question-title :deep(p) {
      margin: 0 0 2px 0;
      padding: 0;
      display: block;
      line-height: 1.4;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      
      &:last-child {
        margin-bottom: 0;
      }
    }
    
    /* pre 标签样式 - 允许自动换行 */
    .question-title :deep(pre),
    .question-title :deep(rich-text pre),
    .question-title :deep(.rich-text pre) {
      width: 100% !important;
      box-sizing: border-box !important;
      white-space: pre-wrap !important;
      word-wrap: break-word !important;
      word-break: break-all !important;
      overflow-x: hidden !important;
      display: block !important;
    }
    
    /* 确保 pre 标签外层的 div 也不会超出边界 */
    .question-title :deep(div:has(> pre)),
    .question-title :deep(div[style*="overflow-x"]) {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      overflow-x: auto !important;
      margin: 2px 0 !important;
    }
    
    /* pre 标签样式 */
    .question-title :deep(pre) {
      margin: 2px 0 !important;
      padding: 8px 12px !important;
      background-color: #f0f9f8 !important;
      border-radius: 8rpx !important;
      border: 1rpx solid #5FBDB5 !important;
      line-height: 1.0 !important;
    }
    
    /* code 标签样式 */
    .question-title :deep(code) {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
      font-size: 28rpx !important;
      line-height: 1.0 !important;
      background: transparent !important;
    }
    
    /* br 标签间距 */
    .question-title :deep(br) {
      display: none !important;
    }
    
    /* 确保 rich-text 内容不会超出 */
    .title-rich-text {
      flex: 1;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
      
      /* 限制图片宽度 */
      :deep(img) {
        max-width: 100% !important;
        height: auto !important;
        display: block !important;
      }
    }

  /* 填空题横线样式 */
  :deep(.blank-placeholder) {
    display: inline-flex;
    align-items: baseline;
    margin: 0 8rpx;
    color: var(--primary-color);
    vertical-align: middle;
    border-bottom: 2rpx solid var(--primary-color);
    min-width: 80rpx;
    justify-content: center;
  }

  :deep(.blank-index) {
    font-size: 24rpx;
    font-weight: normal;
    margin-right: 4rpx;
    color: #666;
  }

  :deep(.blank-underline) {
    display: none; /* 移除内部的横线标签，改用父容器的边框 */
  }
  
  .question-score-tag {
    font-size: 22rpx;
    color: #999;
    margin-left: 12rpx;
    margin-top: 8rpx;
    flex-shrink: 0;
  }
}

.options-list {
  margin-top: 30rpx;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 16rpx 20rpx;
  border: 2rpx solid #f0f0f0;
  border-radius: 16rpx;
  margin-top: 12rpx;
  margin-bottom: 12rpx;
  transition: all 0.2s;
  
  &:active { background-color: #f9f9f9; transform: scale(0.99); }
  
  &.selected {
    border-color: var(--primary-color);
    background-color: var(--primary-light);
    .option-label { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
  }
  
  &.correct {
    border-color: var(--correct-color);
    background-color: #e8f5e9;
    .option-label { background: var(--correct-color); color: #fff; border-color: var(--correct-color); }
  }
  
  &.error {
    border-color: var(--error-color);
    background-color: #ffebee;
    .option-label { background: var(--error-color); color: #fff; border-color: var(--error-color); }
    .option-content { color: #d32f2f; }
  }

  &.error .option-content :deep(code),
  &.error .option-content :deep(pre),
  &.error .option-content :deep(.math-display),
  &.error .option-content :deep(.math-inline) {
    color: #333 !important;
    white-space: pre-wrap !important;
    word-break: break-all !important;
  }
  
  .option-label {
    width: 48rpx;
    height: 48rpx;
    border: 2rpx solid #ddd;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
    font-weight: 500;
    margin-right: 12rpx;
    flex-shrink: 0;
    transition: all 0.2s;
  }
  
  .option-content {
    flex: 1;
    font-size: 30rpx;
    color: #444;
    word-break: break-all;
    white-space: normal;
    overflow: visible;
  }

  .option-content :deep(rich-text) {
    word-break: break-all;
    white-space: normal;
  }

  .option-content :deep(p) {
    margin: 0;
    padding: 0;
  }
  
  .result-icon {
    margin-left: 12rpx;
  }
}

.multi-submit-wrap {
  margin-top: 40rpx;
  .submit-btn {
    background: var(--primary-color);
    color: #fff;
    border-radius: 40rpx;
    font-size: 30rpx;
    height: 84rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6rpx 16rpx rgba(77, 182, 172, 0.3);
    &[disabled] { opacity: 0.5; box-shadow: none; }
  }
}

.question-report-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 10rpx;
  .report-btn {
    display: flex;
    align-items: center;
    font-size: 24rpx;
    color: #999;
    padding: 10rpx;
    text { margin-left: 6rpx; }
  }
}

.confirm-btn-wrap {
  margin: 30rpx 0;
  padding: 0 40rpx;
}

.answer-section {
  margin-top: 30rpx;
}

.card-style {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 10rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}

.answer-combined-card {
  .answer-grid {
    display: flex;
    justify-content: space-around;
    .grid-item {
      text-align: center;
      flex: 1;
      .label { font-size: 24rpx; color: #999; display: block; margin-bottom: 10rpx; }
      .value { font-size: 34rpx; font-weight: bold; 
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 48rpx;
        &.correct { color: var(--correct-color); }
        &.error { color: var(--error-color); }
        &.score { color: #ff9800; }
      }
    }
  }
}

.explanation-card {
  .section-header {
    margin-bottom: 24rpx;
    .section-title {
      display: flex;
      align-items: center;
      font-size: 32rpx;
      font-weight: bold;
      color: #333;
      .title-line {
        width: 8rpx;
        height: 32rpx;
        background: var(--primary-color);
        border-radius: 4rpx;
        margin-right: 16rpx;
      }
    }
  }
  .explanation-content {
    padding: 0 10rpx;
    line-height: 1.8;
    color: #333;

    .blank-answer-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 16rpx;
      padding: 12rpx 20rpx;
      background: #f8f9fa;
      border-radius: 8rpx;
      
      &:last-child { margin-bottom: 0; }
      
      .blank-num {
        color: var(--primary-color);
        font-weight: bold;
        margin-right: 16rpx;
        flex-shrink: 0;
        margin-top: 4rpx;
      }
      .blank-val {
        color: #333;
        flex: 1;
        word-break: break-all;
        line-height: 1.6;
      }

      .blank-val :deep(p) {
        margin: 0;
        display: inline;
      }

      .blank-val div,
      .blank-val p,
      .blank-val span {
        display: inline;
        margin: 0;
        padding: 0;
      }
    }
  }
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 0 10rpx;
  
  .tag-item {
    background: #f0f4f8;
    color: #546e7a;
    font-size: 24rpx;
    padding: 6rpx 20rpx;
    border-radius: 30rpx;
    border: 1rpx solid #e1e8ed;
    transition: all 0.2s;
    
    &:active {
      background: #e1e8ed;
    }
  }
}

.video-container {
  width: 100%;
  height: 400rpx;
  background: #000;
  border-radius: 12rpx;
  overflow: hidden;
  margin-top: 20rpx;
  
  .analysis-video {
    width: 100%;
    height: 100%;
  }
}

.short-answer-section {
  padding: 0;
  
  .short-answer-textarea {
    width: 100%;
    height: 300rpx;
    background: #f8f9fa;
    border: 1rpx solid #e9ecef;
    border-radius: 12rpx;
    padding: 20rpx;
    font-size: 30rpx;
    color: #333;
    box-sizing: border-box;
    margin-top: 10rpx;
    margin-bottom: 10rpx;
  }
  
  .submit-short-answer {
    display: flex;
    justify-content: flex-end;
    
    .confirm-btn {
      margin: 0;
      height: 72rpx;
      line-height: 72rpx;
      padding: 0 40rpx;
      font-size: 28rpx;
      background: var(--primary-color);
      color: #fff;
      border-radius: 36rpx;
    }
  }
}

.notes-section {
  .ad-container {
    margin-bottom: 20rpx;
    width: 100%;
  }

  .notes-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30rpx;

    .section-title {
      display: flex;
      align-items: center;
      font-size: 32rpx;
      font-weight: bold;
      color: #333;
      .title-line {
        width: 8rpx;
        height: 32rpx;
        background: var(--primary-color);
        border-radius: 4rpx;
        margin-right: 16rpx;
      }
    }

    .add-note-btn {
      display: flex;
      align-items: center;
      background: var(--primary-color);
      padding: 8rpx 24rpx;
      border-radius: 30rpx;
      color: #fff;
      font-size: 24rpx;
      transition: all 0.2s;
      
      &:active { opacity: 0.8; transform: scale(0.95); }
      text { margin-left: 8rpx; font-weight: 500; }
    }
  }

  .notes-sub-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 20rpx;
    border-bottom: 1rpx solid #f5f5f5;
    margin-bottom: 20rpx;

    .notes-tabs {
      display: flex;
      
      .tab-item {
        font-size: 28rpx;
        color: #999;
        margin-right: 40rpx;
        position: relative;
        padding: 10rpx 0;
        transition: all 0.2s;

        &.active {
          color: #333;
          font-weight: bold;
          
          &::after {
            content: '';
            position: absolute;
            bottom: -4rpx;
            left: 50%;
            transform: translateX(-50%);
            width: 30rpx;
            height: 4rpx;
            background: var(--primary-color);
            border-radius: 2rpx;
          }
        }
      }
    }

    .note-sort-v2 {
      display: flex;
      align-items: center;
      font-size: 24rpx;
      color: #999;
      
      .sort-icon { margin-left: 6rpx; display: flex; align-items: center; }
    }
  }

  .note-item {
    display: flex;
    padding: 30rpx 0;
    border-bottom: 1rpx solid #f5f5f5;

    &:last-child { border-bottom: none; }

    .note-left {
      margin-right: 20rpx;
      .user-avatar {
        width: 72rpx;
        height: 72rpx;
        border-radius: 50%;
        background: #f0f0f0;
      }
    }

  .note-right {
    flex: 1;

    .note-replies-container {
      margin-top: 16rpx;
      
      .reply-toggle {
        display: flex;
        align-items: center;
        font-size: 22rpx;
        color: var(--primary-color);
        margin-bottom: 8rpx;
        
        .toggle-icon {
          margin-left: 4rpx;
          transition: transform 0.2s;
          &.rotated { transform: rotate(180deg); }
        }
      }
    }

    .note-replies {
      background-color: #f8f9fa;
      padding: 12rpx 16rpx;
      border-radius: 10rpx;
      
      .reply-item {
        margin-bottom: 6rpx;
        &:last-child { margin-bottom: 0; }
        
        .reply-content-row {
          display: flex;
          align-items: flex-start;
          font-size: 24rpx;
          line-height: 1.4;
          
          .reply-user { 
            color: var(--primary-color); 
            font-weight: 500; 
            margin-right: 8rpx;
            white-space: nowrap;
          }
          
          .reply-content { 
            color: #555;
            flex: 1;
            word-break: break-all;
            display: inline;
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

    .note-user-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12rpx;

        .username {
          font-size: 26rpx;
          color: #666;
          font-weight: 500;
        }
      }

      .note-content {
        font-size: 28rpx;
        color: #333;
        line-height: 1.6;
        margin-bottom: 20rpx;
        text-align: justify;
      }

      .note-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .note-info-left {
          display: flex;
          align-items: center;
          font-size: 22rpx;
          color: #999;

          .reply-link {
            margin-left: 24rpx;
            color: var(--primary-color);
          }
        }

        .note-info-right {
          .footer-action {
            display: flex;
            align-items: center;
            font-size: 22rpx;
            color: #999;
            padding: 10rpx 0;
            
            text { margin-left: 8rpx; }
            .active-like { color: var(--primary-color); }
          }
        }
      }
    }
  }

  .empty-notes {
    padding: 60rpx 0;
    text-align: center;
    font-size: 26rpx;
    color: #999;
    background: #fcfcfc;
    border: 1rpx dashed #eee;
    border-radius: 16rpx;
    margin: 20rpx 0;
  }
}

.note-textarea {
  width: 100%;
  min-height: 240rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 24rpx;
  font-size: 28rpx;
  line-height: 1.6;
  box-sizing: border-box;
  margin-bottom: 40rpx;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
  
  button {
    flex: 1;
    height: 88rpx;
    border-radius: 44rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
    font-weight: bold;
    border: none;
    
    &::after { border: none; }
    
    &.cancel-btn { background: #f5f7fa; color: #666; }
    &.confirm-btn { background: var(--primary-color); color: #fff; }
  }
}

.confirm-btn-wrap {
  margin: 40rpx 0;
  padding: 0 40rpx;
  
  .main-action-btn {
     background: var(--primary-color);
     color: #fff;
     width: 100%;
     height: 88rpx;
     border-radius: 44rpx;
     display: flex;
     align-items: center;
     justify-content: center;
     font-size: 32rpx;
     font-weight: bold;
     box-shadow: 0 8rpx 20rpx rgba(77, 182, 172, 0.3);
     border: none;
     margin: 0;
     padding: 0;
     line-height: 88rpx;
     
     &:active { transform: scale(0.98); opacity: 0.9; }
     &::after { border: none; }

     &.next-btn {
       background: #fff;
       color: var(--primary-color);
       border: 2rpx solid var(--primary-color);
       box-shadow: none;
     }
   }
}

.bottom-action-bar {
  height: 110rpx;
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.06);
  position: fixed;
  bottom: 0;
  width: 100%;
  box-sizing: border-box;
  z-index: 90;
  padding-bottom: env(safe-area-inset-bottom);
  
  .action-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-right: 30rpx;
    
    .num {
      font-size: 20rpx;
      margin-top: 4rpx;
      &.success { color: var(--correct-color); }
      &.danger { color: var(--error-color); }
    }
    
    &:active { opacity: 0.7; }
  }
  
  .nav-btns {
    flex: 1;
    display: flex;
    justify-content: flex-end;
    gap: 16rpx;
    
    .nav-btn {
      padding: 18rpx 32rpx;
      border-radius: 36rpx;
      font-size: 26rpx;
      font-weight: 500;
      border: 2rpx solid var(--primary-color);
      color: var(--primary-color);
      transition: all 0.2s;

      &.next { background: var(--primary-color); color: #fff; }
      &.disabled { opacity: 0.3; }
      &:active:not(.disabled) { transform: scale(0.95); }
    }
  }
}

.settings-modal {
  width: 100%;
  background: #fff;
  border-radius: 40rpx 40rpx 0 0;
  padding: 40rpx 30rpx;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  
  .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40rpx;
      flex-shrink: 0;
      text { font-size: 36rpx; font-weight: bold; color: #333; }
      .close { font-size: 44rpx; color: #999; padding: 10rpx; }
    }
  
  .settings-content {
    .setting-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 30rpx 0;
      border-bottom: 2rpx solid #f5f5f5;
      
      text { font-size: 30rpx; color: #333; }
      
      &.column {
        flex-direction: column;
        align-items: flex-start;
        .label { margin-bottom: 24rpx; }
      }
    }
    
    .font-size-levels {
      display: flex;
      width: 100%;
      background: #f5f7fa;
      border-radius: 12rpx;
      padding: 8rpx;
      box-sizing: border-box;
      
      .level-item {
        flex: 1;
        height: 72rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 26rpx;
        color: #666;
        border-radius: 8rpx;
        transition: all 0.2s;
        
        &.active { background: #fff; color: var(--primary-color); font-weight: bold; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05); }
      }
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
  backdrop-filter: blur(4rpx);
  
  .answer-sheet-modal, .settings-modal, .note-modal, .reply-modal, .feedback-modal {
    width: 100%;
    background: #fff;
    border-radius: 40rpx 40rpx 0 0;
    padding: 40rpx 30rpx;
    padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40rpx;
      flex-shrink: 0;
      text { font-size: 36rpx; font-weight: bold; color: #333; }
      .close { font-size: 44rpx; color: #999; padding: 10rpx; }
    }
  }

  .answer-sheet-modal {
    // 答题卡头部减小间距
    .modal-header {
      margin-bottom: 10rpx;
    }
    
    // 题型颜色说明
    .type-legend {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      padding: 8rpx 30rpx;
      margin-bottom: 0;
      border-bottom: 1rpx solid #f0f0f0;
      
      .legend-item {
        display: flex;
        align-items: center;
        margin: 6rpx 16rpx;
        
        .legend-dot {
          width: 24rpx;
          height: 24rpx;
          border-radius: 50%;
          margin-right: 8rpx;
          border: 2rpx solid;
          
          &.type-single { border-color: #4caf50; background: #e8f5e9; }
          &.type-multi { border-color: #2196f3; background: #e3f2fd; }
          &.type-blank { border-color: #9c27b0; background: #f3e5f5; }
          &.type-essay { border-color: #ff9800; background: #fff8e1; }
          &.type-judge { border-color: #795548; background: #efebe9; }
        }
        
        text {
          font-size: 24rpx;
          color: #666;
        }
      }
    }
    
    .sheet-content {
      flex: 1;
      height: 60vh;
      overflow-y: auto;
      padding: 15rpx;
      box-sizing: border-box;
      
      .sheet-grid {
        display: flex;
        flex-wrap: wrap;
        width: 100%;
        padding: 10rpx 0;
        
        .sheet-item {
          width: 80rpx;
          height: 80rpx;
          margin: 10rpx;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28rpx;
          color: #666;
          border: 2rpx solid #eee;
          border-radius: 50%;
          transition: all 0.2s;
          
          // 题型颜色区分 - 未做的题只显示边框颜色
          &.type-essay { border-color: #ff9800; color: #f57c00; }
          &.type-blank { border-color: #9c27b0; color: #7b1fa2; }
          &.type-multi { border-color: #2196f3; color: #1976d2; }
          &.type-judge { border-color: #795548; color: #5d4037; }
          &.type-single { border-color: #4caf50; color: #388e3c; }
          
          // 已做的题显示背景色
          &.type-essay.answered,
          &.type-essay.correct,
          &.type-essay.error { background: #fff8e1; }
          &.type-blank.answered,
          &.type-blank.correct,
          &.type-blank.error { background: #f3e5f5; }
          &.type-multi.answered,
          &.type-multi.correct,
          &.type-multi.error { background: #e3f2fd; }
          &.type-judge.answered,
          &.type-judge.correct,
          &.type-judge.error { background: #efebe9; }
          &.type-single.answered,
          &.type-single.correct,
          &.type-single.error { background: #e8f5e9; }
          
          &.current { 
            border-color: var(--primary-color); 
            color: var(--primary-color); 
            background: #fff;
            font-weight: bold;
          }
          &.correct { color: var(--correct-color); border-color: var(--correct-color); }
          &.error { color: var(--error-color); border-color: var(--error-color); }
          &.answered { color: var(--primary-color); border-color: var(--primary-color); }
        }
      }
    }
  }

  .note-modal, .reply-modal, .feedback-modal {
    .note-modal-content, .feedback-content {
      padding: 0 10rpx;
      .note-textarea, .feedback-textarea {
        width: 100%;
        height: 300rpx;
        background: #f8f9fa;
        border-radius: 16rpx;
        padding: 24rpx;
        box-sizing: border-box;
        font-size: 30rpx;
        color: #333;
        margin-bottom: 30rpx;
      }
      .feedback-type {
        margin-bottom: 30rpx;
        .label {
          font-size: 28rpx;
          color: #666;
          margin-bottom: 16rpx;
          display: block;
        }
        .picker-value {
          height: 88rpx;
          background: #f8f9fa;
          border-radius: 16rpx;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 24rpx;
          font-size: 30rpx;
          color: #333;
          border: 1rpx solid #eee;
          .arrow {
            font-size: 24rpx;
            color: #ccc;
          }
        }
      }
      .feedback-input-wrap {
        margin-bottom: 40rpx;
        .label {
          font-size: 28rpx;
          color: #666;
          margin-bottom: 16rpx;
          display: block;
        }
      }
      .note-options {
        margin-bottom: 40rpx;
        .public-toggle {
          display: flex;
          align-items: center;
          color: var(--primary-color);
          font-size: 28rpx;
          text { margin-left: 12rpx; }
        }
      }
      .note-modal-footer, .modal-footer {
        display: flex;
        gap: 24rpx;
        button {
          flex: 1;
          height: 88rpx;
          line-height: 88rpx;
          border-radius: 44rpx;
          font-size: 30rpx;
          font-weight: bold;
          &::after { border: none; }
          &.cancel-btn { background: #f5f5f5; color: #666; }
          &.submit-btn, &.confirm-btn { background: var(--primary-color); color: #fff; }
        }
      }
    }
  }
}

  .blank-input-section {
    margin-top: 30rpx;
    
    .blank-input-card {
      background: #f8f9fa;
      border-radius: 20rpx;
      padding: 24rpx;
      border: 1rpx solid #edf0f2;
    }
    
    .blank-input-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin-bottom: 24rpx;
      &:last-child { margin-bottom: 0; }
      
      .blank-textarea {
        width: 100%;
        min-height: 64rpx;
        background: #fff;
        border: 2rpx solid #e0e4e8;
        border-radius: 16rpx;
        padding: 12rpx 20rpx;
        font-size: 30rpx;
        color: #333;
        box-sizing: border-box;
        transition: all 0.2s;
        text-align: left;
        
        &:focus {
          border-color: var(--primary-color);
          background: #fff;
          box-shadow: 0 0 0 4rpx rgba(77, 182, 172, 0.1);
        }
        
        &[disabled] {
          background: #f5f7f9;
          color: #666;
          border-color: #eee;
        }
      }
    }
  }

  .submit-btn-wrap {
    margin: 40rpx 0 20rpx;
    padding: 0 20rpx;
    
    .submit-btn {
      width: 100%;
      height: 88rpx;
      background: var(--primary-color);
      color: #fff;
      border-radius: 44rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32rpx;
      font-weight: bold;
      box-shadow: 0 8rpx 20rpx rgba(77, 182, 172, 0.3);
      border: none;
      
      &:active { transform: scale(0.98); opacity: 0.9; }
      &::after { border: none; }
    }
  }

  .short-answer-section {
    margin-top: 30rpx;
    
    .sub-questions {
      .sub-item {
        margin-top: 10rpx;
        margin-bottom: 10rpx;
        background: #fff;
        border-radius: 20rpx;
        padding: 24rpx;
        border: 1rpx solid #edf0f2;
        &:last-child { margin-bottom: 0; }
        
        .sub-header {
          display: flex;
          align-items: center;
          margin-bottom: 10rpx;
          
          .sub-score {
            font-size: 24rpx;
            color: #999;
            background: #f5f5f5;
            padding: 2rpx 12rpx;
            border-radius: 8rpx;
          }
        }
        
        .sub-stem {
          font-size: 30rpx;
          color: #333;
          line-height: 1.6;
          margin-bottom: 10rpx;
          display: block;
        }

        .sub-stem .sub-index {
          font-weight: bold;
          color: var(--primary-color);
          margin-right: 12rpx;
          display: inline;
        }

        .sub-stem :deep(p) {
          margin: 0;
          padding: 0;
          display: inline;
        }
        
        .sub-stem :deep(img) {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 10rpx 0;
        }
      }
    }
    
    .short-answer-textarea {
      width: 100%;
      min-height: 120rpx;
      background: #f8f9fa;
      border: 2rpx solid #e0e4e8;
      border-radius: 20rpx;
      padding: 20rpx 24rpx;
      font-size: 30rpx;
      color: #333;
      line-height: 1.5;
      box-sizing: border-box;
      transition: all 0.2s;
      
      &:focus {
        border-color: var(--primary-color);
        background: #fff;
        box-shadow: 0 0 0 4rpx rgba(77, 182, 172, 0.1);
      }
      
      &[disabled] {
        background: #f5f7f9;
        color: #777;
        border-color: #eee;
      }
    }
  }

  .correct-answer-card {
    background: #e8f5e9 !important;
    border-left: 8rpx solid #4caf50 !important;
    margin-top: 20rpx;
    
    .section-title text {
      color: #2e7d32 !important;
      font-weight: bold;
    }
    
    .explanation-content {
      color: #2e7d32 !important;
    }
  }

.sub-answer-section {
    margin-top: 24rpx;
    padding: 24rpx;
    background: #f1f8e9;
    border-radius: 12rpx;
    border-left: 6rpx solid #81c784;
    
    .sub-answer-item {
      display: flex;
      flex-direction: column;
      margin-bottom: 16rpx;
      &:last-child { margin-bottom: 0; }
      
      .label {
        font-weight: bold;
        color: #2e7d32;
        margin-bottom: 8rpx;
        font-size: 26rpx;
      }
      .value {
        flex: 1;
        color: #333;
        line-height: 1.6;
      }
    }
  }

.animated { animation-duration: 0.4s; animation-fill-mode: both; }
@keyframes fadeInUp {
  from { opacity: 0; transform: translate3d(0, 40rpx, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
.fadeInUp { animation-name: fadeInUp; }

// 相关学习资料通知栏
.related-articles-section {
  margin: 4rpx 0;
  overflow: hidden;
  background-color: rgba(102, 126, 234, 0.05);
  border-radius: 8rpx;
  border: 1rpx solid rgba(102, 126, 234, 0.08);
  
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
          color: #667eea;
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
          color: #5a67d8;
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
