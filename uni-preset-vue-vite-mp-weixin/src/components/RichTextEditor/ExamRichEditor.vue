<template>
  <view class="exam-rich-editor">
    <view class="toolbar" v-if="showToolbar">
      <view class="toolbar-group">
        <view class="toolbar-item" @tap="format('bold')" :class="{ active: formats.bold }">
          <text class="toolbar-icon bold">B</text>
        </view>
        <view class="toolbar-item" @tap="format('italic')" :class="{ active: formats.italic }">
          <text class="toolbar-icon italic">I</text>
        </view>
        <view class="toolbar-item" @tap="format('underline')" :class="{ active: formats.underline }">
          <text class="toolbar-icon underline">U</text>
        </view>
      </view>
      <view class="toolbar-divider"></view>
      <view class="toolbar-group">
        <view class="toolbar-item" @tap="format('list', 'ordered')" :class="{ active: formats.list === 'ordered' }">
          <text class="toolbar-icon">1.</text>
        </view>
        <view class="toolbar-item" @tap="format('list', 'bullet')" :class="{ active: formats.list === 'bullet' }">
          <text class="toolbar-icon">•</text>
        </view>
      </view>
      <view class="toolbar-divider"></view>
      <view class="toolbar-group">
        <view class="toolbar-item" @tap="insertImage">
          <text class="toolbar-icon">📷</text>
        </view>
        <view class="toolbar-item" @tap="showCodeInput = true">
          <text class="toolbar-icon">&lt;/&gt;</text>
        </view>
        <view class="toolbar-item" @tap="showFormulaInput = true">
          <text class="toolbar-icon">∑</text>
        </view>
      </view>
      <view class="toolbar-divider"></view>
      <view class="toolbar-group">
        <view class="toolbar-item" @tap="removeFormat">
          <text class="toolbar-icon">✖</text>
        </view>
      </view>
    </view>
    
    <!-- 代码输入弹窗 -->
    <view v-if="showCodeInput" class="modal-overlay" @click="showCodeInput = false">
      <view class="modal-content" @click.stop>
        <view class="modal-title">插入代码</view>
        <textarea 
          class="code-textarea" 
          v-model="codeInput" 
          placeholder="请输入代码..."
        />
        <view class="modal-buttons">
          <button class="modal-btn cancel" @click="showCodeInput = false">取消</button>
          <button class="modal-btn confirm" @click="confirmInsertCode">确定</button>
        </view>
      </view>
    </view>
    
    <!-- 公式输入弹窗 -->
    <view v-if="showFormulaInput" class="modal-overlay" @click="showFormulaInput = false">
      <view class="modal-content" @click.stop>
        <view class="modal-title">插入公式 (LaTeX)</view>
        <textarea 
          class="formula-textarea" 
          v-model="formulaInput" 
          placeholder="请输入LaTeX公式，如：x^2 + y^2 = z^2"
        />
        <view class="formula-preview" v-if="formulaInput">
          <text class="preview-label">预览:</text>
          <text class="preview-content">{{ renderSimpleFormulaToText(formulaInput) }}</text>
        </view>
        <view class="formula-examples">
          <text class="examples-title">常用示例:</text>
          <view class="example-tags">
            <text class="example-tag" @click="insertFormulaExample('x^2')">x²</text>
            <text class="example-tag" @click="insertFormulaExample('x_i')">xᵢ</text>
            <text class="example-tag" @click="insertFormulaExample('\\frac{a}{b}')">分数</text>
            <text class="example-tag" @click="insertFormulaExample('\\sqrt{x}')">√x</text>
            <text class="example-tag" @click="insertFormulaExample('\\sum_{i=1}^{n}')">∑</text>
            <text class="example-tag" @click="insertFormulaExample('\\int_{a}^{b}')">∫</text>
          </view>
        </view>
        <view class="modal-buttons">
          <button class="modal-btn cancel" @click="showFormulaInput = false">取消</button>
          <button class="modal-btn confirm" @click="confirmInsertFormula">确定</button>
        </view>
      </view>
    </view>
    <editor
      :id="editorId"
      class="editor-content"
      :placeholder="placeholder"
      :read-only="disabled"
      @ready="onEditorReady"
      @statuschange="onStatusChange"
      @input="onEditorInput"
    ></editor>
  </view>
</template>

<script setup>
import { ref, onMounted, watch, getCurrentInstance } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '请输入答案...'
  },
  showToolbar: {
    type: Boolean,
    default: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

const editorId = 'editor-' + Math.random().toString(36).slice(2, 9);
const formats = ref({});
const isReady = ref(false);
let editorCtx = null;

// 弹窗相关
const showCodeInput = ref(false);
const codeInput = ref('');
const showFormulaInput = ref(false);
const formulaInput = ref('');

const instance = getCurrentInstance();

const onEditorReady = () => {
  uni.createSelectorQuery()
    .in(instance)
    .select(`#${editorId}`)
    .context((res) => {
      editorCtx = res.context;
      isReady.value = true;
      if (props.modelValue) {
        editorCtx.setContents({
          html: props.modelValue
        });
      }
    })
    .exec();
};

watch(() => props.modelValue, (newVal) => {
  if (isReady.value && editorCtx) {
    editorCtx.getContents({
      success: (res) => {
        if (res.html !== newVal) {
          editorCtx.setContents({
            html: newVal
          });
        }
      }
    });
  }
});

const onEditorInput = (e) => {
  emit('update:modelValue', e.detail.html);
  emit('change', e.detail.html);
};

const onStatusChange = (e) => {
  formats.value = e.detail;
};

const format = (name, value) => {
  if (!editorCtx || props.disabled) return;
  editorCtx.format(name, value);
};

const removeFormat = () => {
  if (!editorCtx || props.disabled) return;
  editorCtx.removeFormat();
};

// 插入图片
const insertImage = () => {
  if (!editorCtx || props.disabled) return;
  
  uni.chooseImage({
    count: 1,
    success: (res) => {
      const tempFilePath = res.tempFilePaths[0];
      // 上传图片到服务器
      uploadImage(tempFilePath);
    }
  });
};

// 上传图片
const uploadImage = (filePath) => {
  uni.showLoading({ title: '上传中...' });
  
  // 获取API基础URL
  const apiBaseUrl = uni.getStorageSync('apiBaseUrl') || 'https://yizhansa.cn/api';
  const token = uni.getStorageSync('token') || '';
  
  console.log('上传图片到:', `${apiBaseUrl}/upload/image`);
  console.log('Token:', token ? '已设置' : '未设置');
  
  uni.uploadFile({
    url: `${apiBaseUrl}/upload/image`,
    filePath: filePath,
    name: 'image',
    header: {
      'Authorization': token ? `Bearer ${token}` : ''
    },
    success: (res) => {
      uni.hideLoading();
      console.log('上传响应:', res);
      try {
        const data = JSON.parse(res.data);
        console.log('解析后的数据:', data);
        if (data.code === 0 || data.code === 200) {
          const imageUrl = data.data?.url || data.data;
          console.log('图片URL:', imageUrl);
          // 插入图片到编辑器
          if (editorCtx && editorCtx.insertImage) {
            editorCtx.insertImage({
              src: imageUrl,
              alt: '图片',
              width: '100%',
              success: () => {
                uni.showToast({ title: '插入成功', icon: 'success' });
                // 触发内容更新
                setTimeout(() => {
                  editorCtx.getContents({
                    success: (contents) => {
                      emit('update:modelValue', contents.html);
                      emit('change', contents.html);
                    }
                  });
                }, 100);
              },
              fail: (err) => {
                console.error('插入图片到编辑器失败:', err);
                uni.showToast({ title: '插入失败', icon: 'none' });
              }
            });
          } else {
            // 降级方案：使用insertHtml
            const imgHtml = `<img src="${imageUrl}" style="max-width:100%;" alt="图片"/><p><br></p>`;
            if (editorCtx.insertHtml) {
              editorCtx.insertHtml({ html: imgHtml });
            }
            uni.showToast({ title: '插入成功', icon: 'success' });
          }
        } else {
          uni.showToast({ title: data.message || '上传失败', icon: 'none' });
        }
      } catch (e) {
        console.error('解析上传结果失败:', e, '原始数据:', res.data);
        uni.showToast({ title: '上传失败: 解析错误', icon: 'none' });
      }
    },
    fail: (err) => {
      uni.hideLoading();
      console.error('上传图片失败:', err);
      uni.showToast({ title: '上传失败: ' + (err.errMsg || '网络错误'), icon: 'none' });
    }
  });
};

// 确认插入代码
const confirmInsertCode = () => {
  if (!editorCtx || props.disabled || !codeInput.value) {
    showCodeInput.value = false;
    return;
  }
  
  // 使用简单文本格式插入代码，避免HTML解析问题
  const codeText = codeInput.value;
  const codeBlock = `\n\n【代码】\n${codeText}\n【代码结束】\n\n`;
  
  // 使用 insertText 在光标位置插入
  if (editorCtx.insertText) {
    editorCtx.insertText({
      text: codeBlock,
      success: () => {
        codeInput.value = '';
        showCodeInput.value = false;
        uni.showToast({ title: '插入成功', icon: 'success' });
        // 触发内容更新
        setTimeout(() => {
          editorCtx.getContents({
            success: (res) => {
              emit('update:modelValue', res.html);
              emit('change', res.html);
            }
          });
        }, 100);
      },
      fail: (err) => {
        console.error('插入代码失败:', err);
        uni.showToast({ title: '插入失败', icon: 'none' });
      }
    });
  } else {
    // 降级方案：追加到末尾
    insertTextAtEnd(codeBlock);
  }
};

// 在末尾插入文本
const insertTextAtEnd = (text) => {
  editorCtx.getContents({
    success: (res) => {
      const currentHtml = res.html || '';
      // 提取纯文本
      const currentText = currentHtml.replace(/<[^>]+>/g, '');
      const newText = currentText + text;
      editorCtx.setContents({
        html: `<p>${newText.replace(/\n/g, '<br>')}</p>`,
        success: () => {
          codeInput.value = '';
          showCodeInput.value = false;
          uni.showToast({ title: '插入成功', icon: 'success' });
          emit('update:modelValue', `<p>${newText.replace(/\n/g, '<br>')}</p>`);
          emit('change', `<p>${newText.replace(/\n/g, '<br>')}</p>`);
        },
        fail: (err) => {
          console.error('设置内容失败:', err);
          uni.showToast({ title: '插入失败', icon: 'none' });
        }
      });
    }
  });
};

// 插入公式示例
const insertFormulaExample = (example) => {
  formulaInput.value = (formulaInput.value || '') + example;
};

// 确认插入公式
const confirmInsertFormula = () => {
  if (!editorCtx || props.disabled || !formulaInput.value) {
    showFormulaInput.value = false;
    return;
  }
  
  // 渲染公式为可读的数学符号（纯文本）
  const renderedFormula = renderSimpleFormulaToText(formulaInput.value);
  const formulaText = ` [${renderedFormula}] `;
  
  // 使用 insertText 在光标位置插入
  if (editorCtx.insertText) {
    editorCtx.insertText({
      text: formulaText,
      success: () => {
        formulaInput.value = '';
        showFormulaInput.value = false;
        uni.showToast({ title: '插入成功', icon: 'success' });
        // 触发内容更新
        setTimeout(() => {
          editorCtx.getContents({
            success: (res) => {
              emit('update:modelValue', res.html);
              emit('change', res.html);
            }
          });
        }, 100);
      },
      fail: (err) => {
        console.error('插入公式失败:', err);
        uni.showToast({ title: '插入失败', icon: 'none' });
      }
    });
  } else {
    // 降级方案
    insertTextAtEnd(formulaText);
  }
};

// 将公式渲染为纯文本（用于插入编辑器）
const renderSimpleFormulaToText = (latex) => {
  if (!latex) return '';
  
  let result = latex;
  
  // 处理分数 \frac{a}{b}
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)');
  
  // 处理平方根 \sqrt{x}
  result = result.replace(/\\sqrt\{([^}]+)\}/g, '√$1');
  
  // 处理求和 \sum_{i=1}^{n}
  result = result.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, 'Σ($1→$2)');
  
  // 处理积分 \int_{a}^{b}
  result = result.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫($1→$2)');
  
  // 处理上标 ^{} 和 ^
  result = result.replace(/\^\{([^}]+)\}/g, '^$1');
  result = result.replace(/\^([a-zA-Z0-9])/g, '^$1');
  
  // 处理下标 _{} 和 _
  result = result.replace(/_\{([^}]+)\}/g, '_$1');
  result = result.replace(/_([a-zA-Z0-9])/g, '_$1');
  
  // 处理常见数学符号
  result = result.replace(/\\times/g, '×');
  result = result.replace(/\\div/g, '÷');
  result = result.replace(/\\pm/g, '±');
  result = result.replace(/\\cdot/g, '·');
  result = result.replace(/\\infty/g, '∞');
  
  // 希腊字母
  result = result.replace(/\\alpha/g, 'α');
  result = result.replace(/\\beta/g, 'β');
  result = result.replace(/\\gamma/g, 'γ');
  result = result.replace(/\\delta/g, 'δ');
  result = result.replace(/\\theta/g, 'θ');
  result = result.replace(/\\lambda/g, 'λ');
  result = result.replace(/\\mu/g, 'μ');
  result = result.replace(/\\pi/g, 'π');
  result = result.replace(/\\sigma/g, 'σ');
  result = result.replace(/\\phi/g, 'φ');
  result = result.replace(/\\omega/g, 'ω');
  
  // 大写希腊字母
  result = result.replace(/\\Gamma/g, 'Γ');
  result = result.replace(/\\Delta/g, 'Δ');
  result = result.replace(/\\Theta/g, 'Θ');
  result = result.replace(/\\Lambda/g, 'Λ');
  result = result.replace(/\\Pi/g, 'Π');
  result = result.replace(/\\Sigma/g, 'Σ');
  result = result.replace(/\\Phi/g, 'Φ');
  result = result.replace(/\\Omega/g, 'Ω');
  
  // 其他数学符号
  result = result.replace(/\\leq/g, '≤');
  result = result.replace(/\\geq/g, '≥');
  result = result.replace(/\\neq/g, '≠');
  result = result.replace(/\\approx/g, '≈');
  result = result.replace(/\\rightarrow/g, '→');
  result = result.replace(/\\leftarrow/g, '←');
  result = result.replace(/\\in/g, '∈');
  result = result.replace(/\\subset/g, '⊂');
  result = result.replace(/\\cup/g, '∪');
  result = result.replace(/\\cap/g, '∩');
  result = result.replace(/\\emptyset/g, '∅');
  result = result.replace(/\\int/g, '∫');
  result = result.replace(/\\sum/g, '∑');
  result = result.replace(/\\sqrt/g, '√');
  
  return result;
};

// 简单公式渲染（将LaTeX转换为可读的HTML）
const renderSimpleFormula = (latex) => {
  if (!latex) return '';
  
  let result = latex;
  
  // 处理分数 \frac{a}{b}
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<span style="display:inline-block;text-align:center;vertical-align:middle;margin:0 4px;"><span style="display:block;border-bottom:1px solid currentColor;padding:0 2px;">$1</span><span style="display:block;">$2</span></span>');
  
  // 处理平方根 \sqrt{x}
  result = result.replace(/\\sqrt\{([^}]+)\}/g, '√<span style="border-top:1px solid currentColor;padding:0 2px;">$1</span>');
  
  // 处理求和 \sum_{i=1}^{n}
  result = result.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, '<span style="display:inline-block;text-align:center;vertical-align:middle;font-size:0.8em;"><span style="display:block;">$2</span><span style="display:block;font-size:1.2em;margin:-2px 0;">Σ</span><span style="display:block;">$1</span></span>');
  
  // 处理积分 \int_{a}^{b}
  result = result.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '<span style="display:inline-block;text-align:center;vertical-align:middle;font-size:0.8em;"><span style="display:block;">$2</span><span style="display:block;font-size:1.2em;margin:-2px 0;">∫</span><span style="display:block;">$1</span></span>');
  
  // 处理上标 ^{} 和 ^
  result = result.replace(/\^\{([^}]+)\}/g, '<sup style="font-size:0.7em;vertical-align:super;">$1</sup>');
  result = result.replace(/\^([a-zA-Z0-9])/g, '<sup style="font-size:0.7em;vertical-align:super;">$1</sup>');
  
  // 处理下标 _{} 和 _
  result = result.replace(/_\{([^}]+)\}/g, '<sub style="font-size:0.7em;vertical-align:sub;">$1</sub>');
  result = result.replace(/_([a-zA-Z0-9])/g, '<sub style="font-size:0.7em;vertical-align:sub;">$1</sub>');
  
  // 处理常见数学符号
  result = result.replace(/\\times/g, '×');
  result = result.replace(/\\div/g, '÷');
  result = result.replace(/\\pm/g, '±');
  result = result.replace(/\\mp/g, '∓');
  result = result.replace(/\\infty/g, '∞');
  result = result.replace(/\\infin/g, '∞');
  result = result.replace(/\\cdot/g, '·');
  result = result.replace(/\\cdots/g, '⋯');
  result = result.replace(/\\ldots/g, '…');
  result = result.replace(/\\vdots/g, '⋮');
  result = result.replace(/\\ddots/g, '⋱');
  
  // 希腊字母
  result = result.replace(/\\alpha/g, 'α');
  result = result.replace(/\\beta/g, 'β');
  result = result.replace(/\\gamma/g, 'γ');
  result = result.replace(/\\delta/g, 'δ');
  result = result.replace(/\\epsilon/g, 'ε');
  result = result.replace(/\\varepsilon/g, 'ε');
  result = result.replace(/\\zeta/g, 'ζ');
  result = result.replace(/\\eta/g, 'η');
  result = result.replace(/\\theta/g, 'θ');
  result = result.replace(/\\vartheta/g, 'ϑ');
  result = result.replace(/\\iota/g, 'ι');
  result = result.replace(/\\kappa/g, 'κ');
  result = result.replace(/\\lambda/g, 'λ');
  result = result.replace(/\\mu/g, 'μ');
  result = result.replace(/\\nu/g, 'ν');
  result = result.replace(/\\xi/g, 'ξ');
  result = result.replace(/\\pi/g, 'π');
  result = result.replace(/\\varpi/g, 'ϖ');
  result = result.replace(/\\rho/g, 'ρ');
  result = result.replace(/\\varrho/g, 'ϱ');
  result = result.replace(/\\sigma/g, 'σ');
  result = result.replace(/\\varsigma/g, 'ς');
  result = result.replace(/\\tau/g, 'τ');
  result = result.replace(/\\upsilon/g, 'υ');
  result = result.replace(/\\phi/g, 'φ');
  result = result.replace(/\\varphi/g, 'ϕ');
  result = result.replace(/\\chi/g, 'χ');
  result = result.replace(/\\psi/g, 'ψ');
  result = result.replace(/\\omega/g, 'ω');
  
  // 大写希腊字母
  result = result.replace(/\\Gamma/g, 'Γ');
  result = result.replace(/\\Delta/g, 'Δ');
  result = result.replace(/\\Theta/g, 'Θ');
  result = result.replace(/\\Lambda/g, 'Λ');
  result = result.replace(/\\Xi/g, 'Ξ');
  result = result.replace(/\\Pi/g, 'Π');
  result = result.replace(/\\Sigma/g, 'Σ');
  result = result.replace(/\\Upsilon/g, 'Υ');
  result = result.replace(/\\Phi/g, 'Φ');
  result = result.replace(/\\Psi/g, 'Ψ');
  result = result.replace(/\\Omega/g, 'Ω');
  
  // 其他数学符号
  result = result.replace(/\\leq/g, '≤');
  result = result.replace(/\\geq/g, '≥');
  result = result.replace(/\\neq/g, '≠');
  result = result.replace(/\\approx/g, '≈');
  result = result.replace(/\\equiv/g, '≡');
  result = result.replace(/\\sim/g, '∼');
  result = result.replace(/\\simeq/g, '≃');
  result = result.replace(/\\cong/g, '≅');
  result = result.replace(/\\propto/g, '∝');
  result = result.replace(/\\perp/g, '⊥');
  result = result.replace(/\\parallel/g, '∥');
  result = result.replace(/\\angle/g, '∠');
  result = result.replace(/\\triangle/g, '△');
  result = result.replace(/\\square/g, '□');
  result = result.replace(/\\rightarrow/g, '→');
  result = result.replace(/\\leftarrow/g, '←');
  result = result.replace(/\\Rightarrow/g, '⇒');
  result = result.replace(/\\Leftarrow/g, '⇐');
  result = result.replace(/\\leftrightarrow/g, '↔');
  result = result.replace(/\\Leftrightarrow/g, '⇔');
  result = result.replace(/\\forall/g, '∀');
  result = result.replace(/\\exists/g, '∃');
  result = result.replace(/\\nexists/g, '∄');
  result = result.replace(/\\in/g, '∈');
  result = result.replace(/\\notin/g, '∉');
  result = result.replace(/\\subset/g, '⊂');
  result = result.replace(/\\subseteq/g, '⊆');
  result = result.replace(/\\supset/g, '⊃');
  result = result.replace(/\\supseteq/g, '⊇');
  result = result.replace(/\\cup/g, '∪');
  result = result.replace(/\\cap/g, '∩');
  result = result.replace(/\\emptyset/g, '∅');
  result = result.replace(/\\varnothing/g, '∅');
  result = result.replace(/\\infty/g, '∞');
  result = result.replace(/\\nabla/g, '∇');
  result = result.replace(/\\partial/g, '∂');
  result = result.replace(/\\int/g, '∫');
  result = result.replace(/\\iint/g, '∬');
  result = result.replace(/\\iiint/g, '∭');
  result = result.replace(/\\oint/g, '∮');
  result = result.replace(/\\sum/g, '∑');
  result = result.replace(/\\prod/g, '∏');
  result = result.replace(/\\sqrt/g, '√');
  
  return result;
};

// HTML转义
const escapeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// 获取内容
const getContents = (callback) => {
  if (editorCtx) {
    editorCtx.getContents({
      success: (res) => {
        callback && callback(res);
      }
    });
  }
};

// 设置内容
const setContents = (html) => {
  if (editorCtx) {
    editorCtx.setContents({ html });
  }
};

defineExpose({
  getContents,
  setContents
});
</script>

<style scoped>
.exam-rich-editor {
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  overflow: hidden;
  background-color: #fff;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  padding: 6px 8px;
  background-color: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  align-items: center;
  gap: 4px;
}

.toolbar-group {
  display: flex;
  align-items: center;
}

.toolbar-item {
  height: 28px;
  min-width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 1px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.toolbar-item:active {
  background-color: #d9d9d9;
}

.toolbar-item.active {
  background-color: #409eff;
}

.toolbar-item.active .toolbar-icon {
  color: #fff;
}

.toolbar-icon {
  font-size: 14px;
  color: #606266;
}

.toolbar-icon.bold { font-weight: bold; }
.toolbar-icon.italic { font-style: italic; }
.toolbar-icon.underline { text-decoration: underline; }

.toolbar-divider {
  width: 1px;
  height: 18px;
  background-color: #dcdfe6;
  margin: 0 6px;
}

.editor-content {
  width: 100%;
  min-height: 150px;
  max-height: 400px;
  padding: 8px 12px;
  box-sizing: border-box;
  font-size: 14px;
  line-height: 1.5;
}

/* 编辑器内图片样式 */
.editor-content img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  cursor: pointer;
}

/* 编辑器内段落样式 */
.editor-content p {
  margin: 6px 0;
  min-height: 1em;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  width: 80vw;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-title {
  font-size: 18px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 16px;
  color: #333;
}

.code-textarea, .formula-textarea {
  width: 100%;
  min-height: 120px;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  box-sizing: border-box;
  margin-bottom: 16px;
}

.formula-preview {
  background: #f0f9ff;
  border: 1px dashed #1890ff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.preview-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  display: block;
}

.preview-content {
  font-size: 20px;
  color: #1890ff;
  font-family: 'Times New Roman', serif;
  display: block;
  padding: 12px 0;
  font-style: italic;
}

.formula-examples {
  margin-bottom: 16px;
}

.examples-title {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  display: block;
}

.example-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.example-tag {
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
}

.example-tag:active {
  background: #e6f7ff;
  border-color: #1890ff;
  color: #1890ff;
}

.modal-buttons {
  display: flex;
  gap: 12px;
}

.modal-btn {
  flex: 1;
  height: 40px;
  border-radius: 8px;
  font-size: 16px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-btn.cancel {
  background: #f5f7fa;
  color: #606266;
}

.modal-btn.confirm {
  background: #409eff;
  color: #fff;
}
</style>
