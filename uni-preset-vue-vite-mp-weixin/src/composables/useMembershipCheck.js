/**
 * 会员系统 - 混合模式
 * 优先从后端数据库获取数据，无网络时回退到本地存储
 */

import membershipApi from '@/api/membership.js'

const STORAGE_PREFIX = 'membership_'
const DAILY_PREFIX = 'membership_daily_'
const FREE_LIMIT = 20

// 科目配置
const SUBJECT_CONFIG = [
  { key: 'math', name: '数学', icon: 'M', color: '#4caf50', bgColor: '#e8f5e9' },
  { key: 'english', name: '英语', icon: 'E', color: '#2196f3', bgColor: '#e3f2fd' },
  { key: 'politics', name: '政治', icon: 'P', color: '#f44336', bgColor: '#fce4ec' },
  { key: 'computer', name: '计算机', icon: 'C', color: '#ff9800', bgColor: '#fff3e0' },
  { key: 'med', name: '西医综合', icon: 'Y', color: '#9c27b0', bgColor: '#f3e5f5' },
  { key: 'public', name: '公共课', icon: 'G', color: '#607d8b', bgColor: '#eceff1' }
]

function getApi() {
  return membershipApi
}

function hasToken() {
  return !!uni.getStorageSync('token')
}

export function getSubjectConfig() {
  const custom = uni.getStorageSync('membership_subjects_config')
  if (custom && Array.isArray(custom) && custom.length > 0) {
    return custom
  }
  return SUBJECT_CONFIG
}

export function addSubject(subject) {
  const list = getSubjectConfig()
  const exists = list.find(s => s.key === subject.key)
  if (!exists) {
    list.push({
      key: subject.key,
      name: subject.name || subject.key,
      icon: (subject.name || subject.key).charAt(0),
      color: subject.color || '#ff9800',
      bgColor: subject.bgColor || '#fff3e0'
    })
    uni.setStorageSync('membership_subjects_config', list)
  }
  return list
}

// ========== 本地存储回退 ==========

export function hasValidMembershipLocal(subjectKey) {
  const data = uni.getStorageSync(STORAGE_PREFIX + subjectKey)
  if (!data) return false
  const now = Date.now()
  const expireAt = new Date(data.expireAt).getTime()
  return data.status === 'active' && expireAt > now
}

export function getTodayCountLocal(subjectKey) {
  const today = new Date().toISOString().split('T')[0]
  return uni.getStorageSync(DAILY_PREFIX + today + '_' + subjectKey) || 0
}

export function recordQuestionViewLocal(subjectKey) {
  const today = new Date().toISOString().split('T')[0]
  const key = DAILY_PREFIX + today + '_' + subjectKey
  const current = uni.getStorageSync(key) || 0
  uni.setStorageSync(key, current + 1)
}

export function getAllMembershipsLocal() {
  const subjects = getSubjectConfig()
  return subjects.map(subject => {
    const data = uni.getStorageSync(STORAGE_PREFIX + subject.key)
    const isMember = data ? hasValidMembershipLocal(subject.key) : false
    return {
      subjectKey: subject.key,
      displayName: subject.name,
      icon: subject.icon,
      color: subject.color,
      bgColor: subject.bgColor,
      isMember,
      expireAt: data ? data.expireAt : null,
      price: data ? (data.pricePaid || 9.9) : 9.9,
      originalPrice: 29.9,
      durationDays: 30
    }
  })
}

export function subscribeMembershipLocal(subjectKey, priceInfo) {
  const subject = getSubjectConfig().find(s => s.key === subjectKey)
  if (!subject) return { success: false, message: '科目不存在' }

  const now = new Date()
  const existing = uni.getStorageSync(STORAGE_PREFIX + subjectKey)
  const durationDays = priceInfo?.durationDays || 30

  let expireAt
  if (existing && existing.expireAt) {
    const currentExpire = new Date(existing.expireAt).getTime()
    const baseTime = Math.max(currentExpire, now.getTime())
    expireAt = new Date(baseTime + durationDays * 24 * 60 * 60 * 1000)
  } else {
    expireAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
  }

  const data = {
    status: 'active',
    expireAt: expireAt.toISOString(),
    pricePaid: priceInfo?.price || 9.9,
    createdAt: existing ? existing.createdAt : now.toISOString(),
    updatedAt: now.toISOString()
  }
  uni.setStorageSync(STORAGE_PREFIX + subjectKey, data)

  return {
    success: true,
    data: { subjectKey, displayName: subject.name, expireAt: expireAt.toISOString(), status: 'active' },
    message: `${subject.name}会员开通成功`
  }
}

// ========== 后端 API 优先 ==========

/**
 * 获取所有科目会员状态（优先后端）
 */
export async function getAllMemberships() {
  if (!hasToken()) return getAllMembershipsLocal()

  const api = getApi()
  if (!api) return getAllMembershipsLocal()

  try {
    const res = await api.getMySubscriptions()
    if (res.code === 0 && res.data) {
      // 缓存到本地
      if (res.data.subscriptions) {
        res.data.subscriptions.forEach(sub => {
          if (sub.isValid) {
            uni.setStorageSync(STORAGE_PREFIX + sub.subjectKey, {
              status: 'active',
              expireAt: sub.expireAt,
              updatedAt: new Date().toISOString()
            })
          }
        })
      }

      // 合并后端价格配置和本地科目配置
      const subjects = getSubjectConfig()
      const prices = res.data.availableSubjects || []

      return subjects.map(subject => {
        const priceInfo = prices.find(p => p.subjectKey === subject.key)
        const sub = res.data.subscriptions ? res.data.subscriptions.find(s => s.subjectKey === subject.key) : null

        return {
          subjectKey: subject.key,
          displayName: priceInfo?.displayName || subject.name,
          icon: subject.icon,
          color: subject.color,
          bgColor: subject.bgColor,
          isMember: sub ? sub.isValid : false,
          expireAt: sub ? sub.expireAt : null,
          price: priceInfo ? priceInfo.price : 9.9,
          originalPrice: priceInfo ? priceInfo.originalPrice : 29.9,
          durationDays: priceInfo ? priceInfo.durationDays : 30
        }
      })
    }
  } catch (e) {
    console.warn('getAllMemberships API fail, fallback to local:', e.message)
  }
  return getAllMembershipsLocal()
}

/**
 * 检查某科目是否有有效会员（同步兼容）
 * 返回本地计算结果，后台异步同步后端数据
 */
export function hasValidMembership(subjectKey) {
  // 先返回本地结果
  const localResult = hasValidMembershipLocal(subjectKey)

  // 后台异步同步
  if (hasToken()) {
    const api = getApi()
    if (api) {
      api.getStatus(subjectKey).then(res => {
        if (res.code === 0 && res.data && res.data.hasMembership) {
          // 更新本地缓存
          const data = uni.getStorageSync(STORAGE_PREFIX + subjectKey) || {}
          data.status = 'active'
          data.updatedAt = new Date().toISOString()
          uni.setStorageSync(STORAGE_PREFIX + subjectKey, data)
        }
      }).catch(() => {})
    }
  }

  return localResult
}

/**
 * 检查题目访问权限（同步兼容）
 * 返回本地计算结果，后台异步同步后端数据
 */
export function checkAccess(subjectKey, questionIndex) {
  const localResult = checkAccessLocal(subjectKey, questionIndex)

  // 后台异步同步
  if (hasToken()) {
    const api = getApi()
    if (api) {
      api.checkAccess({ subjectKey, questionIndex }).then(res => {
        if (res.code === 0 && res.data) {
          const d = res.data
          if (d.isMember) {
            const data = uni.getStorageSync(STORAGE_PREFIX + subjectKey) || {}
            data.status = 'active'
            data.updatedAt = new Date().toISOString()
            uni.setStorageSync(STORAGE_PREFIX + subjectKey, data)
          }
        }
      }).catch(() => {})
    }
  }

  return localResult
}

function checkAccessLocal(subjectKey, questionIndex) {
  const isMember = hasValidMembershipLocal(subjectKey)
  if (isMember) {
    return { canAccess: true, showPrompt: false, remaining: Infinity, isMember: true }
  }
  if (questionIndex < FREE_LIMIT) {
    return { canAccess: true, showPrompt: false, remaining: FREE_LIMIT - questionIndex, isMember: false }
  }
  const subject = getSubjectConfig().find(s => s.key === subjectKey)
  return {
    canAccess: false,
    showPrompt: true,
    reason: 'free_limit_exceeded',
    freeLimit: FREE_LIMIT,
    remaining: 0,
    isMember: false,
    subjectInfo: subject ? {
      subjectKey: subject.key,
      displayName: subject.name,
      price: 9.9,
      originalPrice: 29.9,
      durationDays: 30
    } : null
  }
}

/**
 * 记录做题次数（同步兼容）
 */
export function recordQuestionView(subjectKey) {
  recordQuestionViewLocal(subjectKey)

  // 后台异步同步到后端
  if (hasToken()) {
    const api = getApi()
    if (api) {
      api.recordView({ subjectKey }).catch(() => {})
    }
  }
}

/**
 * 开通会员
 */
export async function subscribeMembership(subjectKey, priceInfo) {
  if (!hasToken()) {
    return subscribeMembershipLocal(subjectKey, priceInfo)
  }

  const api = getApi()
  if (!api) return subscribeMembershipLocal(subjectKey, priceInfo)

  try {
    const res = await api.subscribe({ subjectKey })
    if (res.code === 0 && res.data) {
      // 同步到本地
      if (res.data.subscription) {
        uni.setStorageSync(STORAGE_PREFIX + subjectKey, {
          status: 'active',
          expireAt: res.data.subscription.expireAt,
          updatedAt: new Date().toISOString()
        })
      }
      return { success: true, message: res.data.message || '开通成功' }
    }
    return { success: false, message: res.message || '开通失败' }
  } catch (e) {
    console.warn('subscribeMembership API fail, fallback to local:', e.message)
    return subscribeMembershipLocal(subjectKey, priceInfo)
  }
}

/**
 * 获取免费题数限制
 */
export function getFreeLimit() {
  return FREE_LIMIT
}
