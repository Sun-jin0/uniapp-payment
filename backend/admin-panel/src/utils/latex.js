import katex from 'katex';
import renderMathInElement from 'katex/dist/contrib/auto-render';
import 'katex/dist/katex.min.css';

// 确保 katex 在全局可用，以便 auto-render 插件能找到它
if (typeof window !== 'undefined') {
  window.katex = katex;
  window.renderMathInElement = renderMathInElement;
}

/**
 * H5 版本的 transformContextString 函数
 * 将包含 LaTeX 公式的文本转换为 HTML
 */
export function transformContextString(rawContextString) {
  if (typeof rawContextString !== 'string') return '';

  const placeholders = [];
  const createPlaceholder = (content, type = 'html') => {
    const p = `__LATEX_JS_${type.toUpperCase()}_PH_${placeholders.length}__`;
    placeholders.push({ p, content, type });
    return p;
  };

  let currentText = rawContextString.trim().replace(/\t/g, ' ').replace(/ {2,}/g, ' ');
  
  // 0. 先处理HTML实体，确保 $ 符号正确
  currentText = currentText
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#36;/g, '$'); // 处理 $ 的 HTML 实体
  
  // 1. 提取并保护所有数学公式
  let mathRegex;
  try {
    mathRegex = /(\$\$[\s\S]*?\$\$)|((?<!\\)\$([\s\S]+?)(?<!\\)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g;
  } catch (e) {
    mathRegex = /(\$\$[\s\S]*?\$\$)|(\$([\s\S]+?)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g;
  }
  
  currentText = currentText.replace(mathRegex, (match, p1, p2, p3, p4, p5) => {
    let expression = '';
    let displayMode = false;
    
    if (p1) { // $$...$$
      expression = p1.slice(2, -2);
      displayMode = true;
    } else if (p2) { // $...$
      expression = p3;
      displayMode = false;
    } else if (p4) { // \[...\]
      expression = p4.slice(2, -2);
      displayMode = true;
    } else if (p5) { // \(...\)
      expression = p5.slice(2, -2);
      displayMode = false;
    }
    
    if (!expression.trim()) return match;
    
    try {
      const rendered = katex.renderToString(expression, {
        throwOnError: false,
        displayMode: displayMode,
        strict: false
      });
      return createPlaceholder(rendered, 'math');
    } catch (e) {
      console.warn('KaTeX render error:', e);
      return match;
    }
  });

  // 2. 处理其他HTML实体（$ 已经在前面处理过了）
  currentText = currentText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#36;/g, '$');

  // 3. 处理 《答案》等自定义标签
  currentText = currentText
    .replace(/《答案》/g, '<span style="color:#009688;font-weight:bold;">【答案】</span>')
    .replace(/《\/答案》/g, '')
    .replace(/《分析》/g, '<span style="color:#009688;font-weight:bold;">【思路分析】</span>')
    .replace(/《\/分析》/g, '')
    .replace(/《点评》/g, '<span style="color:#FF5405;font-weight:bold;">【点评】</span>')
    .replace(/《\/点评》/g, '')
    .replace(/《注释》/g, '<span style="color:#666;font-style:italic;">')
    .replace(/《\/注释》/g, '</span>')
    .replace(/《步骤》/g, '<span style="color:#FF5405;font-weight:bold;">')
    .replace(/《\/步骤》/g, '</span>');

  // 4. 处理 \color 和 \bold 命令
  currentText = currentText
    .replace(/\\color\{#([0-9A-Fa-f]{6})\}\{([^}]+)\}/g, '<span style="color:#$1;">$2</span>')
    .replace(/\\bold\{([^}]+)\}/g, '<b>$1</b>')
    .replace(/\\mathbf\{([^}]+)\}/g, '<b>$1</b>');

  // 5. 还原占位符
  placeholders.forEach(({ p, content }) => {
    currentText = currentText.replace(p, content);
  });

  return currentText;
}

/**
 * 包装 LaTeX 命令（将未包裹的命令用 $...$ 包裹）
 */
export function wrapLatexCommands(text) {
  if (!text || typeof text !== 'string') return '';
  
  const latexCommands = [
    '\\left', '\\right', '\\frac', '\\sqrt', '\\times', '\\div', '\\alpha', '\\beta', '\\gamma', '\\delta'
    // ... 简化版，按需添加
  ];
  
  const commandPattern = new RegExp(
    `(?<![$\\])(${latexCommands.map(c => c.replace(/\\/g, '\\\\')).join('|')})(?![$])`,
    'g'
  );
  
  return text.replace(commandPattern, '$$$1$$');
}
