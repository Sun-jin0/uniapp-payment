/**
 * 剪贴板工具函数
 * 处理微信小程序剪贴板 API，包括隐私协议未声明时的降级处理
 */

// 全局隐私协议弹窗引用
let privacyAgreementRef = null;

/**
 * 设置隐私协议弹窗引用
 * @param {Object} ref - PrivacyAgreement 组件引用
 */
export const setPrivacyAgreementRef = (ref) => {
  privacyAgreementRef = ref;
};

/**
 * 检查隐私协议状态
 * @returns {Promise<{needAuthorization: boolean, privacyContractName: string}>}
 */
const checkPrivacySetting = () => {
  return new Promise((resolve) => {
    // #ifdef MP-WEIXIN
    if (wx.getPrivacySetting) {
      wx.getPrivacySetting({
        success: (res) => {
          resolve({
            needAuthorization: res.needAuthorization,
            privacyContractName: res.privacyContractName || '《小程序隐私保护指引》'
          });
        },
        fail: () => {
          resolve({ needAuthorization: false, privacyContractName: '' });
        }
      });
    } else {
      resolve({ needAuthorization: false, privacyContractName: '' });
    }
    // #endif
    // #ifndef MP-WEIXIN
    resolve({ needAuthorization: false, privacyContractName: '' });
    // #endif
  });
};

/**
 * 打开隐私协议页面
 */
const openPrivacyContract = () => {
  // #ifdef MP-WEIXIN
  if (wx.openPrivacyContract) {
    wx.openPrivacyContract({
      success: () => {
        console.log('打开隐私协议成功');
      },
      fail: (err) => {
        console.error('打开隐私协议失败', err);
      }
    });
  }
  // #endif
};

/**
 * 显示隐私协议同意弹窗
 * @param {string} privacyContractName - 隐私协议名称
 * @returns {Promise<boolean>} - 用户是否同意
 */
const showPrivacyAgreementModal = (privacyContractName) => {
  return new Promise((resolve) => {
    // 如果有全局弹窗引用，使用它
    if (privacyAgreementRef) {
      privacyAgreementRef.show(privacyContractName).then(resolve);
      return;
    }

    // 否则使用简单的提示
    uni.showModal({
      title: '需要同意隐私协议',
      content: `您需要同意${privacyContractName}才能使用复制功能。`,
      confirmText: '去设置',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 跳转到设置页面或显示隐私协议
          openPrivacyContract();
        }
        resolve(false);
      }
    });
  });
};

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @param {Object} options - 配置选项
 * @param {string} options.successMsg - 复制成功提示文本
 * @param {string} options.failMsg - 复制失败提示文本
 * @param {boolean} options.showModal - 失败时是否显示弹窗手动复制
 * @param {string} options.modalTitle - 弹窗标题
 * @returns {Promise<boolean>} - 是否复制成功
 */
export const copyToClipboard = async (text, options = {}) => {
  const {
    successMsg = '复制成功',
    failMsg = '复制失败',
    showModal = true,
    modalTitle = '请手动复制'
  } = options;

  // 先检查隐私协议状态
  const privacySetting = await checkPrivacySetting();

  // 如果需要授权且用户未同意，显示隐私协议弹窗
  if (privacySetting.needAuthorization) {
    const agreed = await showPrivacyAgreementModal(privacySetting.privacyContractName);
    if (!agreed) {
      return false;
    }
    // 用户同意后，再次尝试检查隐私协议状态
    const newSetting = await checkPrivacySetting();
    if (newSetting.needAuthorization) {
      // 如果还需要授权，说明用户还没有真正同意，返回失败
      return false;
    }
  }

  return new Promise((resolve) => {
    uni.setClipboardData({
      data: text,
      success: () => {
        uni.showToast({
          title: successMsg,
          icon: 'success',
          duration: 2000
        });
        resolve(true);
      },
      fail: (err) => {
        console.error('复制失败:', err);

        // 检查是否是隐私协议未声明的错误
        const isPrivacyError = err.errMsg && (
          err.errMsg.includes('privacy agreement') ||
          err.errMsg.includes('scope is not declared')
        );

        if (isPrivacyError) {
          console.warn('剪贴板 API 未在隐私协议中声明，请在小程序后台添加剪贴板权限声明');
          showPrivacyAgreementModal(privacySetting.privacyContractName || '《小程序隐私保护指引》');
        } else if (showModal) {
          // 显示弹窗让用户手动复制
          uni.showModal({
            title: modalTitle,
            content: text,
            showCancel: false,
            confirmText: '知道了',
            success: () => {
              resolve(false);
            }
          });
        } else {
          // 静默失败，不显示错误提示（避免影响用户体验）
          uni.showToast({
            title: failMsg,
            icon: 'none',
            duration: 2000
          });
          resolve(false);
        }
        resolve(false);
      }
    });
  });
};

/**
 * 获取剪贴板内容
 * @returns {Promise<string|null>} - 剪贴板内容
 */
export const getClipboardData = () => {
  return new Promise((resolve) => {
    uni.getClipboardData({
      success: (res) => {
        resolve(res.data);
      },
      fail: (err) => {
        console.error('获取剪贴板失败:', err);
        resolve(null);
      }
    });
  });
};

export default {
  copyToClipboard,
  getClipboardData,
  setPrivacyAgreementRef
};
