<template>
  <div class="article-edit">
    <el-page-header @back="goBack">
      <template #content>
        <span class="page-title">{{ pageTitle }}</span>
      </template>
      <template #extra>
        <div class="header-actions">
          <el-button @click="handleSave(false)" :loading="saving">存为草稿</el-button>
          <el-button type="primary" @click="handleSave(true)" :loading="saving">发布内容</el-button>
        </div>
      </template>
    </el-page-header>

    <el-card class="edit-card">
      <el-form 
        ref="formRef"
        :model="form" 
        :rules="rules"
        label-width="100px" 
        class="edit-form"
      >
        <el-row :gutter="20">
          <!-- 左侧基本信息 -->
          <el-col :span="16">
            <el-form-item label="内容类型" prop="type">
              <el-radio-group v-model="form.type" @change="handleTypeChange">
                <el-radio-button label="article">文章</el-radio-button>
                <el-radio-button label="notice">通知</el-radio-button>
                <el-radio-button label="ad">广告</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="表现形式" prop="noticeType" v-if="form.type !== 'ad'">
              <el-radio-group v-model="form.noticeType">
                <el-radio label="article">富文本文章</el-radio>
                <el-radio label="link">跳转链接</el-radio>
                <el-radio label="wechat">微信链接</el-radio>
              </el-radio-group>
            </el-form-item>

            <!-- 微信链接解析 -->
            <el-form-item 
              v-if="form.noticeType === 'wechat' && form.type !== 'ad'" 
              label="微信链接"
            >
              <div class="wechat-parse-box">
                <el-input 
                  v-model="wechatUrl" 
                  placeholder="请输入微信公众号文章链接"
                  clearable
                >
                  <template #append>
                    <el-button :loading="parsing" @click="handleParseWechat">解析</el-button>
                  </template>
                </el-input>
                <div class="form-tip">解析后将自动填充标题、封面和链接地址</div>
              </div>
            </el-form-item>

            <el-form-item label="内容标题" prop="title">
              <el-input v-model="form.title" placeholder="请输入内容标题" maxlength="100" show-word-limit />
            </el-form-item>

            <el-form-item label="分类标签" prop="category" v-if="form.type !== 'ad'">
              <el-select v-model="form.category" placeholder="请选择或输入分类" filterable allow-create>
                <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
              </el-select>
            </el-form-item>

            <el-form-item label="作者" prop="author" v-if="form.type === 'article'">
              <el-input v-model="form.author" placeholder="请输入作者" />
            </el-form-item>

            <el-form-item label="摘要/描述" prop="description" v-if="form.type !== 'ad' && form.noticeType !== 'pan_resource'">
              <el-input 
                v-model="form.description" 
                type="textarea" 
                placeholder="请输入摘要内容" 
                :rows="3"
                maxlength="200"
                show-word-limit
              />
            </el-form-item>

            <el-form-item label="跳转链接" prop="linkUrl" v-if="form.noticeType === 'link' || form.noticeType === 'wechat' || form.type === 'ad'">
              <el-input v-model="form.linkUrl" placeholder="请输入完整的跳转链接 (http:// 或 https://)" />
            </el-form-item>

            <el-form-item label="按钮文字" prop="buttonText" v-if="form.type === 'ad'">
              <el-input v-model="form.buttonText" placeholder="默认：查看详情" />
            </el-form-item>

            <!-- 文章内容编辑器 -->
            <el-form-item
              label="正文内容"
              prop="content"
              v-if="form.noticeType === 'article' && form.type !== 'ad'"
            >
              <RichEditor
                v-model="form.content"
                placeholder="请输入文章正文内容"
                :height="400"
              />
            </el-form-item>
          </el-col>

          <!-- 右侧封面图等设置 -->
          <el-col :span="8">
            <el-form-item label="封面图" prop="imageUrl">
              <el-upload
                class="cover-uploader"
                action="#"
                :show-file-list="false"
                :auto-upload="false"
                :on-change="handleCoverChange"
              >
                <img v-if="form.imageUrl" :src="form.imageUrl" class="cover-preview" />
                <el-icon v-else class="cover-uploader-icon"><Plus /></el-icon>
              </el-upload>
              <div class="form-tip">建议比例 4:3，支持 jpg/png 格式</div>
            </el-form-item>

            <el-form-item label="启用状态" prop="isActive">
              <el-switch v-model="form.isActive" />
              <span class="status-text">{{ form.isActive ? '立即发布/启用' : '存为草稿/禁用' }}</span>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, getCurrentInstance } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import RichEditor from '../components/RichEditor.vue'

const { proxy } = getCurrentInstance()
const adminApi = proxy.$api.adminApi
const router = useRouter()
const route = useRoute()

// 状态
const formRef = ref(null)
const saving = ref(false)
const parsing = ref(false)
const wechatUrl = ref('')
// 从数据库获取分类列表
const categories = ref([])

// 加载分类列表
const fetchCategories = async () => {
  try {
    const res = await adminApi.getNoticeCategories()
    if (res.code === 0 && res.data) {
      categories.value = res.data.map(c => c.name)
    }
  } catch (error) {
    console.error('获取分类失败:', error)
  }
}

const form = ref({
  id: null,
  type: 'article',
  noticeType: 'article',
  category: '',
  title: '',
  description: '',
  content: '',
  author: '管理员',
  imageUrl: '',
  linkUrl: '',
  buttonText: '',
  isActive: true
})

const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  linkUrl: [{ 
    validator: (rule, value, callback) => {
      if ((form.value.noticeType === 'link' || form.value.noticeType === 'wechat' || form.value.type === 'ad') && !value) {
        callback(new Error('请输入跳转链接'))
      } else {
        callback()
      }
    }, 
    trigger: 'blur' 
  }]
}

const pageTitle = computed(() => {
  const isEdit = !!form.value.id
  const typeMap = {
    article: isEdit ? '编辑文章' : '发布文章',
    notice: isEdit ? '编辑通知' : '添加通知',
    ad: isEdit ? '编辑广告' : '添加广告'
  }
  return typeMap[form.value.type] || '内容编辑'
})

onMounted(() => {
  fetchCategories()
  const { id, type } = route.query
  if (id) {
    form.value.id = id
    fetchDetail(id)
  }
  if (type) {
    form.value.type = type
    if (type === 'ad') {
      form.value.noticeType = 'link'
    }
  }
})

const fetchDetail = async (id) => {
  try {
    const res = await adminApi.getNoticeDetail(id)
    if (res.code === 0 && res.data) {
      const data = res.data
      form.value = {
        id: data._id || data.id,
        type: data.type || 'notice',
        noticeType: data.noticeType || 'article',
        category: data.category || '',
        title: data.title || '',
        description: data.description || '',
        content: data.content || '',
        author: data.author || '管理员',
        imageUrl: data.imageUrl || '',
        linkUrl: data.linkUrl || '',
        buttonText: data.buttonText || '',
        isActive: data.isActive !== undefined ? !!data.isActive : true
      }
    }
  } catch (error) {
    console.error('Fetch detail error:', error)
  }
}

const handleTypeChange = (val) => {
  if (val === 'ad') {
    form.value.noticeType = 'link'
  }
  // 不再自动修改 noticeType，保持用户的选择
}

const handleCoverChange = async (file) => {
  try {
    const res = await adminApi.uploadImage(file.raw)
    if (res.code === 0) {
      form.value.imageUrl = res.data.url
      ElMessage.success('上传成功')
    }
  } catch (error) {
    console.error('Upload error:', error)
  }
}

const handleParseWechat = async () => {
  if (!wechatUrl.value) {
    return ElMessage.warning('请输入微信链接')
  }
  parsing.value = true
  try {
    const res = await adminApi.parseWechatUrl(wechatUrl.value)
    if (res.code === 0 && res.data) {
      const data = res.data
      form.value.title = data.title || form.value.title
      form.value.imageUrl = data.cover || form.value.imageUrl
      form.value.linkUrl = wechatUrl.value
      ElMessage.success('解析成功')
    }
  } catch (error) {
    console.error('Parse error:', error)
  } finally {
    parsing.value = false
  }
}

const handleSave = async (isPublish) => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    form.value.isActive = isPublish
    saving.value = true
    try {
      let res
      const submitData = { ...form.value }
      // 直接使用用户选择的 noticeType，不再强制修改
      if (submitData.id) {
        res = await adminApi.updateNotice(submitData.id, submitData)
      } else {
        res = await adminApi.createNotice(submitData)
      }

      if (res.code === 0) {
        ElMessage.success(isPublish ? '发布成功' : '已存为草稿')
        router.back()
      }
    } catch (error) {
      console.error('Save error:', error)
    } finally {
      saving.value = false
    }
  })
}

const goBack = () => {
  router.back()
}
</script>

<style scoped>
.article-edit {
  padding: 20px;
}

.page-title {
  font-size: 18px;
  font-weight: bold;
}

.edit-card {
  margin-top: 20px;
  border-radius: 8px;
}

.edit-form {
  padding: 20px 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.wechat-parse-box {
  width: 100%;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}

.status-text {
  margin-left: 12px;
  font-size: 14px;
  color: #606266;
}

.cover-uploader {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  width: 240px;
  height: 180px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: border-color 0.3s;
}

.cover-uploader:hover {
  border-color: #409eff;
}

.cover-uploader-icon {
  font-size: 28px;
  color: #8c939d;
}

.cover-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

:deep(.el-form-item__label) {
  font-weight: bold;
}
</style>
