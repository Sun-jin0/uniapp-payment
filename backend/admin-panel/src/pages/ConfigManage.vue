<template>
  <div class="config-manage">
    <div class="page-header">
      <div class="left">
        <h2>系统配置</h2>
        <p class="subtitle">管理首页倒计时、考研目标日期及全局设置</p>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="never" class="config-card">
          <template #header>
            <div class="card-header">
              <span>倒计时设置</span>
            </div>
          </template>
          
          <el-form :model="configs" label-width="120px" v-loading="loading">
            <el-form-item label="标题">
              <el-input v-model="configs.countdown_title" placeholder="例如：考研倒计时" />
            </el-form-item>
            
            <el-form-item label="目标日期">
              <el-date-picker
                v-model="configs.countdown_date"
                type="date"
                placeholder="选择目标日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                @change="handleDateChange"
                style="width: 100%"
              />
            </el-form-item>
            
            <el-form-item label="剩余天数">
              <el-input-number 
                v-model="configs.countdown_days" 
                :min="0" 
                @change="handleDaysChange"
                style="width: 100%"
              />
              <div class="form-tip">修改天数会自动更新目标日期</div>
            </el-form-item>
            
            <el-form-item label="备注/鼓励语">
              <el-input 
                v-model="configs.countdown_note" 
                type="textarea" 
                rows="3"
                placeholder="例如：加油，考研人！" 
              />
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="saveConfigs" :loading="saving">
                保存设置
              </el-button>
              <el-button @click="loadConfigs">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="never" class="config-card">
          <template #header>
            <div class="card-header">
              <span>预览效果</span>
            </div>
          </template>
          
          <div class="preview-container">
            <div class="countdown-preview">
              <div class="preview-title">{{ configs.countdown_title || '考研倒计时' }}</div>
              <div class="preview-days">
                <span class="days-num">{{ configs.countdown_days || 0 }}</span>
                <span class="days-unit">天</span>
              </div>
              <div class="preview-date">目标日期: {{ configs.countdown_date || '未设置' }}</div>
              <div class="preview-note">{{ configs.countdown_note || '坚持就是胜利！' }}</div>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="config-card mt-20">
          <template #header>
            <div class="card-header">
              <span>其他系统配置</span>
            </div>
          </template>
          <div class="placeholder-text">暂无其他配置项</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '../api'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const saving = ref(false)

const configs = ref({
  countdown_title: '',
  countdown_date: '',
  countdown_days: 0,
  countdown_note: ''
})

const calculateDays = (dateStr) => {
  if (!dateStr) return 0
  const target = new Date(dateStr)
  const now = new Date()
  target.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  const diff = target.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return days > 0 ? days : 0
}

const handleDateChange = (val) => {
  if (val) {
    configs.value.countdown_days = calculateDays(val)
  }
}

const handleDaysChange = (days) => {
  if (days !== null) {
    const target = new Date()
    target.setHours(0, 0, 0, 0)
    target.setDate(target.getDate() + days)
    const y = target.getFullYear()
    const m = String(target.getMonth() + 1).padStart(2, '0')
    const d = String(target.getDate()).padStart(2, '0')
    configs.value.countdown_date = `${y}-${m}-${d}`
  }
}

const loadConfigs = async () => {
  loading.value = true
  try {
    const res = await adminApi.getConfigs()
    if (res.code === 0 && res.data) {
      res.data.forEach(item => {
        if (Object.prototype.hasOwnProperty.call(configs.value, item.config_key)) {
          if (item.config_key === 'countdown_days') {
            configs.value[item.config_key] = parseInt(item.config_value) || 0
          } else {
            configs.value[item.config_key] = item.config_value
          }
        }
      })
      
      // If days is not provided by backend, calculate it
      if (configs.value.countdown_date && !configs.value.countdown_days) {
        configs.value.countdown_days = calculateDays(configs.value.countdown_date)
      }
    }
  } catch (error) {
    console.error('Failed to load configs:', error)
    ElMessage.error('加载配置失败')
  } finally {
    loading.value = false
  }
}

const saveConfigs = async () => {
  saving.value = true
  try {
    const updates = [
      { key: 'countdown_title', value: configs.value.countdown_title, description: '倒计时标题' },
      { key: 'countdown_date', value: configs.value.countdown_date, description: '目标日期' },
      { key: 'countdown_note', value: configs.value.countdown_note, description: '备注信息' }
    ]

    for (const update of updates) {
      await adminApi.saveConfigs(update)
    }
    
    ElMessage.success('保存成功')
  } catch (error) {
    console.error('Failed to save configs:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfigs()
})
</script>

<style scoped>
.config-manage {
  padding: 10px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.subtitle {
  margin: 5px 0 0;
  color: #909399;
  font-size: 14px;
}

.config-card {
  margin-bottom: 20px;
}

.card-header {
  font-weight: bold;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
  line-height: 1;
}

.preview-container {
  display: flex;
  justify-content: center;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.countdown-preview {
  width: 280px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px 20px;
  border-radius: 20px;
  text-align: center;
  box-shadow: 0 10px 20px rgba(0,0,0,0.1);
}

.preview-title {
  font-size: 16px;
  opacity: 0.9;
  margin-bottom: 15px;
}

.preview-days {
  margin-bottom: 15px;
}

.days-num {
  font-size: 64px;
  font-weight: bold;
}

.days-unit {
  font-size: 20px;
  margin-left: 5px;
}

.preview-date {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 10px;
}

.preview-note {
  font-size: 14px;
  font-style: italic;
  padding-top: 15px;
  border-top: 1px solid rgba(255,255,255,0.2);
}

.mt-20 {
  margin-top: 20px;
}

.placeholder-text {
  color: #C0C4CC;
  text-align: center;
  padding: 40px 0;
  font-size: 14px;
}
</style>