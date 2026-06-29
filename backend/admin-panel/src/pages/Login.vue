<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="login-header">
          <h2>管理后台登录</h2>
        </div>
      </template>
      <el-form :model="loginForm" :rules="loginRules" ref="loginFormRef" label-width="0px">
        <el-form-item prop="username">
          <el-input v-model="loginForm.username" placeholder="用户名/学号" prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="loginForm.password" type="password" placeholder="密码" prefix-icon="Lock" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" class="login-button" @click="handleLogin">登录</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const router = useRouter()
const loginFormRef = ref(null)
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: ''
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        // 使用本地服务器登录接口
        const response = await axios.post('/api/user/login', loginForm)
        const res = response.data
        
        if (res.code === 0 || res.code === 200) {
          const { token, role } = res.data
          
          if (role === 0) {
            ElMessage.error('权限不足，非管理员账号')
            loading.value = false
            return
          }
          
          localStorage.setItem('admin_token', token)
          localStorage.setItem('userRole', role)
          ElMessage.success('登录成功')
          router.push('/dashboard')
        } else {
          ElMessage.error(res.message || '登录失败')
        }
      } catch (error) {
        console.error('Login error:', error)
        ElMessage.error(error.response?.data?.message || '登录请求失败')
      } finally {
        loading.value = false
      }
    }
  })
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f0f2f5;
}

.login-card {
  width: 400px;
}

.login-header {
  text-align: center;
}

.login-header h2 {
  margin: 0;
  font-size: 24px;
  color: #303133;
}

.login-button {
  width: 100%;
}
</style>
