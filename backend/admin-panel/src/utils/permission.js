// 角色定义
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  CONTENT_ADMIN: 'content_admin'
}

// 权限定义
export const PERMISSIONS = {
  USER_VIEW: 'user_view',
  USER_EDIT: 'user_edit',
  CONTENT_VIEW: 'content_view',
  CONTENT_EDIT: 'content_edit',
  SYSTEM_CONFIG: 'system_config'
}

// 角色权限映射
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.CONTENT_VIEW,
    PERMISSIONS.CONTENT_EDIT,
    PERMISSIONS.SYSTEM_CONFIG
  ],
  [ROLES.ADMIN]: [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.CONTENT_VIEW,
    PERMISSIONS.CONTENT_EDIT
  ],
  [ROLES.CONTENT_ADMIN]: [
    PERMISSIONS.CONTENT_VIEW,
    PERMISSIONS.CONTENT_EDIT
  ]
}

// 检查用户是否有某个权限
export const hasPermission = (role, permission) => {
  if (!role) return false
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes(permission)
}

// 获取用户角色
export const getUserRole = () => {
  // 这里应该从本地存储或API获取用户角色
  // 暂时返回超级管理员角色作为默认值
  return localStorage.getItem('userRole') || ROLES.SUPER_ADMIN
}

// 设置用户角色
export const setUserRole = (role) => {
  localStorage.setItem('userRole', role)
}
