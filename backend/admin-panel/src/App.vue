<template>
  <el-container v-if="route.path !== '/login' && !route.meta?.public" class="layout-container">
    <el-aside width="240px">
      <div class="logo">
        <h2>管理后台</h2>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="el-menu-vertical"
        router
      >
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        
        <el-menu-item index="/user/list">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>

        <el-menu-item index="/membership">
          <el-icon><Medal /></el-icon>
          <span>会员管理</span>
        </el-menu-item>

        <el-sub-menu index="resource">
          <template #title>
            <el-icon><Files /></el-icon>
            <span>内容管理</span>
          </template>
          <el-menu-item index="/video/list">视频管理</el-menu-item>
          <el-menu-item index="/content/notice">内容管理</el-menu-item>
          <el-menu-item index="/banner">轮播图管理</el-menu-item>
          <el-menu-item index="/avatar-frame">头像框管理</el-menu-item>
          <el-menu-item index="/nav">导航管理</el-menu-item>
          <el-menu-item index="/homepage-card">首页卡片</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="questions">
          <template #title>
            <el-icon><Reading /></el-icon>
            <span>题库管理</span>
          </template>
          <el-menu-item index="/questions/public-manage">公共课综合管理</el-menu-item>
          <el-menu-item index="/questions/politics-manage">政治综合管理</el-menu-item>
          <el-menu-item index="/questions/math-manage">数学综合管理</el-menu-item>
          <el-menu-item index="/questions/paper-import">试卷导入</el-menu-item>
          <el-menu-item index="/questions/med-manage">西医综合管理</el-menu-item>
          <el-menu-item index="/questions/computer-manage">计算机综合管理</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/online-exam">
          <el-icon><Timer /></el-icon>
          <span>在线考试管理</span>
        </el-menu-item>
        
        <el-menu-item index="/computer/papers">
          <el-icon><Reading /></el-icon>
          <span>计算机试卷管理</span>
        </el-menu-item>
        <el-menu-item index="/computer/tutorials">
          <el-icon><Notebook /></el-icon>
          <span>教辅管理</span>
        </el-menu-item>

        <el-sub-menu index="system">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系统设置</span>
          </template>
          <el-menu-item index="/system/config">倒计时</el-menu-item>
          <el-menu-item index="/system/pan">网盘管理</el-menu-item>
          <el-menu-item index="/image-storage">图床管理</el-menu-item>
          <el-menu-item index="/qq-groups">QQ群管理</el-menu-item>
          <el-menu-item index="/cards">卡牌管理</el-menu-item>
          <el-menu-item index="/checkin">打卡管理</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    
    <el-container>
      <el-header>
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentPageTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-dropdown>
            <span class="user-info">
              管理员 <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      
      <el-main>
        <router-view v-slot="{ Component }">
          <keep-alive include="MathPaperSelect">
            <component :is="Component" :key="route.path" />
          </keep-alive>
        </router-view>
      </el-main>
      
      <el-footer class="footer">
        <div class="icp-info">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
            苏ICP备2026042805号-1
          </a>
        </div>
      </el-footer>
    </el-container>
  </el-container>
  <router-view v-else v-slot="{ Component }">
    <keep-alive include="MathPaperSelect">
      <component :is="Component" :key="route.path" />
    </keep-alive>
  </router-view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Odometer, User, Files, Reading, Setting, ArrowDown, Timer, Picture, Notebook, Collection, Medal } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const activeMenu = computed(() => route.path)
const currentPageTitle = computed(() => route.meta.title || '仪表盘')

const logout = () => {
  localStorage.removeItem('admin_token')
  router.push('/login')
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #002140;
  color: white;
}

.logo h2 {
  margin: 0;
  font-size: 18px;
}

.el-aside {
  background-color: #001529;
  color: white;
}

.el-menu {
  border-right: none;
}

.el-header {
  background-color: white;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}

.el-main {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}

.footer {
  background-color: white;
  border-top: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  flex-shrink: 0;
}

.icp-info {
  font-size: 12px;
  color: #666;
}

.icp-info a {
  color: #666;
  text-decoration: none;
  transition: color 0.3s;
}

.icp-info a:hover {
  color: #409eff;
}

.icp-info .divider {
  margin: 0 10px;
  color: #ccc;
}
</style>
