// 主题管理工具

// 主题类型
export const THEME_MODES = {
  AUTO: 'auto',
  LIGHT: 'light',
  DARK: 'dark'
};

// 主题颜色配置
export const THEME_COLORS = {
  light: {
    // 背景色
    background: '#f5f5f5',
    cardBackground: '#ffffff',
    modalBackground: '#ffffff',
    
    // 文本色
    textPrimary: '#333333',
    textSecondary: '#666666',
    textTertiary: '#999999',
    
    // 边框色
    borderColor: '#f0f0f0',
    dividerColor: '#e0e0e0',
    
    // 强调色
    primaryColor: '#6666ff',
    secondaryColor: '#8888ff',
    successColor: '#43e97b',
    warningColor: '#fa8c16',
    errorColor: '#ff6b35',
    
    // 状态色
    activeColor: '#f0f4ff',
    inactiveColor: '#f9f9f9',
    
    // 阴影
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    lightShadowColor: 'rgba(0, 0, 0, 0.08)'
  },
  dark: {
    // 背景色
    background: '#1a1a1a',
    cardBackground: '#2d2d2d',
    modalBackground: '#2d2d2d',
    
    // 文本色
    textPrimary: '#ffffff',
    textSecondary: '#cccccc',
    textTertiary: '#999999',
    
    // 边框色
    borderColor: '#404040',
    dividerColor: '#333333',
    
    // 强调色
    primaryColor: '#8888ff',
    secondaryColor: '#aaaaff',
    successColor: '#53f98b',
    warningColor: '#fabc46',
    errorColor: '#ff7b45',
    
    // 状态色
    activeColor: '#3a3a7a',
    inactiveColor: '#333333',
    
    // 阴影
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    lightShadowColor: 'rgba(0, 0, 0, 0.2)'
  }
};

// 获取当前主题模式
export const getCurrentThemeMode = () => {
  const savedMode = uni.getStorageSync('themeMode');
  if (savedMode && Object.values(THEME_MODES).includes(savedMode)) {
    return savedMode;
  }
  return THEME_MODES.LIGHT;
};

// 获取实际应用的主题
export const getAppliedTheme = (mode) => {
  // 优先使用传入的mode参数
  let themeMode = mode;
  if (!mode || !Object.values(THEME_MODES).includes(mode)) {
    // 如果没有传入mode参数或mode参数无效，从本地存储获取
    themeMode = getCurrentThemeMode();
  }
  
  // 如果是自动模式，根据系统主题判断
  if (themeMode === THEME_MODES.AUTO) {
    const systemTheme = uni.getSystemInfoSync().theme;
    return systemTheme === 'dark' ? THEME_MODES.DARK : THEME_MODES.LIGHT;
  }
  
  return themeMode;
};

// 保存主题模式
export const saveThemeMode = (mode) => {
  if (Object.values(THEME_MODES).includes(mode)) {
    uni.setStorageSync('themeMode', mode);
    // 通知所有页面主题变化
    notifyThemeChange(mode);
  }
};

// 通知主题变化
export const notifyThemeChange = (mode) => {
  uni.$emit('themeChange', mode);
};

// 初始化主题
export const initTheme = () => {
  // 监听系统主题变化
  uni.onThemeChange((res) => {
    const currentMode = getCurrentThemeMode();
    if (currentMode === THEME_MODES.AUTO) {
      notifyThemeChange(THEME_MODES.AUTO);
    }
  });
};

// 获取主题颜色
export const getThemeColors = () => {
  const appliedTheme = getAppliedTheme();
  return THEME_COLORS[appliedTheme];
};

// 判断是否为暗黑主题
export const isDarkTheme = () => {
  return getAppliedTheme() === THEME_MODES.DARK;
};

// 获取主题样式类名
export const getThemeClass = () => {
  const appliedTheme = getAppliedTheme();
  return appliedTheme === THEME_MODES.DARK ? 'dark-mode' : '';
};