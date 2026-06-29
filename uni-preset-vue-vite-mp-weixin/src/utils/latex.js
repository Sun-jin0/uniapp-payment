// #ifdef H5
import katex from 'katex';
import renderMathInElement from 'katex/dist/contrib/auto-render';
import 'katex/dist/katex.min.css';

// 确保 katex 在全局可用，以便 auto-render 插件能找到它
if (typeof window !== 'undefined') {
  window.katex = katex;
  window.renderMathInElement = renderMathInElement;
}
// #endif



function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * 常见 LaTeX 符号到 Unicode 的映射
 */
const LATEX_TO_UNICODE = {
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\epsilon': 'ε',
  '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ', '\\iota': 'ι', '\\kappa': 'κ',
  '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', '\\omicron': 'ο',
  '\\pi': 'π', '\\rho': 'ρ', '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ',
  '\\phi': 'φ', '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
  '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ', '\\Xi': 'Ξ',
  '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
  '\\pm': '±', '\\mp': '∓', '\\times': '×', '\\div': '÷', '\\cdot': '·',
  '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈', '\\equiv': '≡',
  '\\subset': '⊂', '\\supset': '⊃', '\\subseteq': '⊆', '\\supseteq': '⊇',
  '\\in': '∈', '\\notin': '∉', '\\ni': '∋', '\\forall': '∀', '\\exists': '∃',
  '\\sum': '∑', '\\prod': '∏', '\\int': '∫', '\\oint': '∮',
  '\\sqrt': '√', '\\partial': '∂', '\\nabla': '∇', '\\infty': '∞',
  '\\rightarrow': '→', '\\leftarrow': '←', '\\Rightarrow': '⇒', '\\Leftarrow': '⇐',
  '\\leftrightarrow': '↔', '\\Leftrightarrow': '⇔', '\\uparrow': '↑', '\\downarrow': '↓',
  '\\angle': '∠', '\\perp': '⊥', '\\parallel': '∥', '\\triangle': '△',
  '\\circ': '∘', '\\bullet': '•', '\\star': '★', '\\oplus': '⊕', '\\otimes': '⊗',
  '\\cap': '∩', '\\cup': '∪', '\\emptyset': '∅', '\\therefore': '∴', '\\because': '∵',
  '\\prime': '′', '\\doubleprime': '″', '\\degree': '°', '\\%': '%', '\\$': '$',
  '\\{': '{', '\\}': '}', '\\_': '_', '\\#': '#', '\\&': '&',
  '\\ldots': '…', '\\cdots': '⋯', '\\vdots': '⋮', '\\ddots': '⋱',
  '\\frac': '', '\\left': '', '\\right': '', '\\mathrm': '', '\\text': '',
  '\\mathbf': '', '\\mathit': '', '\\mathcal': '', '\\mathbb': '',
  '\\,': ' ', '\\;': ' ', '\\!': '', '\\ ': ' ', '~': ' ',
  '\\quad': '  ', '\\qquad': '    ',
  '\\lt': '<', '\\gt': '>', '\\le': '≤', '\\ge': '≥',
};

/**
 * 将 LaTeX 公式转换为 Unicode 字符（用于微信小程序 rich-text）
 * @param {string} formula - LaTeX 公式内容（不含 $ 符号）
 * @returns {string} - Unicode 字符串
 */
function latexToUnicode(formula) {
  if (!formula || typeof formula !== 'string') return '';
  
  let result = formula;
  
  // 处理 \frac{a}{b} -> a/b
  result = result.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, (match, a, b) => {
    return `${latexToUnicode(a)}/${latexToUnicode(b)}`;
  });
  
  // 处理 \sqrt{x} -> √x
  result = result.replace(/\\sqrt\{([^}]*)\}/g, (match, content) => {
    return `√${latexToUnicode(content)}`;
  });
  
  // 处理 \sqrt[n]{x} -> ⁿ√x
  result = result.replace(/\\sqrt\[([^\]]*)\]\{([^}]*)\}/g, (match, n, content) => {
    return `${latexToUnicode(n)}√${latexToUnicode(content)}`;
  });
  
  // 处理 \mathrm{text}, \text{text}, \mathbf{text} 等
  result = result.replace(/\\(?:mathrm|text|mathbf|mathit|mathcal|mathbb)\{([^}]*)\}/g, '$1');
  
  // 处理 \left 和 \right (包括周围的空格)
  result = result.replace(/\\left\s*([(\[{|)])\s*/g, '$1');
  result = result.replace(/\\right\s*([)\]}|)])\s*/g, '$1');
  result = result.replace(/\\left\s*\\?/g, '');
  result = result.replace(/\\right\s*\\?/g, '');
  
  // 处理上标 ^{...}
  result = result.replace(/\^\{([^}]*)\}/g, (match, content) => {
    const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ';
    const normal = '0123456789+-=()abcdefghijklmnopqrstuvwxyz';
    let converted = '';
    for (const char of content) {
      const idx = normal.indexOf(char.toLowerCase());
      if (idx !== -1) {
        converted += superscripts[idx];
      } else {
        converted += char;
      }
    }
    return converted;
  });
  
  // 处理简单上标 ^x
  result = result.replace(/\^([0-9+\-=()])/g, (match, char) => {
    const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾';
    const normal = '0123456789+-=()';
    const idx = normal.indexOf(char);
    return idx !== -1 ? superscripts[idx] : match;
  });
  
  // 处理下标 _{...}
  result = result.replace(/_\{([^}]*)\}/g, (match, content) => {
    const subscripts = '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ';
    const normal = '0123456789+-=()aehijklmnoprstuvx';
    let converted = '';
    for (const char of content) {
      const idx = normal.indexOf(char.toLowerCase());
      if (idx !== -1) {
        converted += subscripts[idx];
      } else {
        converted += char;
      }
    }
    return converted;
  });
  
  // 处理简单下标 _x
  result = result.replace(/_([0-9+\-=()a-z])/gi, (match, char) => {
    const subscripts = '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ';
    const normal = '0123456789+-=()aehijklmnoprstuvx';
    const idx = normal.indexOf(char.toLowerCase());
    return idx !== -1 ? subscripts[idx] : match;
  });
  
  // 替换 LaTeX 符号为 Unicode
  for (const [latex, unicode] of Object.entries(LATEX_TO_UNICODE)) {
    result = result.split(latex).join(unicode);
  }
  
  // 清理多余空格
  result = result.replace(/\s+/g, ' ').trim();
  
  // 移除剩余的反斜杠命令（未识别的）
  result = result.replace(/\\[a-zA-Z]+/g, '');
  
  return result;
}

/**
 * 将文本中的 LaTeX 公式转换为 Unicode（用于微信小程序 rich-text）
 * @param {string} text - 包含 LaTeX 公式的文本
 * @returns {string} - 转换后的文本
 */
function convertLatexToUnicode(text) {
  if (!text || typeof text !== 'string') return '';
  
  let result = text;
  
  // 先处理行间公式 $$...$$（避免被行内公式匹配）
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    return latexToUnicode(formula);
  });
  
  // 再处理行内公式 $...$
  result = result.replace(/\$([\s\S]*?)\$/g, (match, formula) => {
    // 确保不是 $$ 的一部分
    if (formula.trim() === '') return match;
    return latexToUnicode(formula);
  });
  
  // 处理 \[...\] 和 \(...\) 格式
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => {
    return latexToUnicode(formula);
  });
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (match, formula) => {
    return latexToUnicode(formula);
  });
  
  return result;
}

/**
 * 提取匹配的大括号内容
 * @param {string} str - 从 { 开始的字符串
 * @returns {object} - { content: 内容, length: 消耗的字符数 }
 */
function extractBracedContent(str) {
  if (!str || str[0] !== '{') return { content: '', length: 0 };
  
  let depth = 0;
  let i = 0;
  
  while (i < str.length) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') depth--;
    
    i++;
    
    if (depth === 0) break;
  }
  
  return {
    content: str.substring(1, i - 1),
    length: i
  };
}

/**
 * 处理包含 \color 命令的公式
 * 将 $\color{#xxx}{内容}$ 保留为公式格式，让后端 markdown-server 处理颜色
 * @param {string} text - 原始文本
 * @returns {string} - 处理后的文本
 */
function processColorInLatex(text) {
  if (!text || typeof text !== 'string') return '';
  
  let result = '';
  let i = 0;
  
  while (i < text.length) {
    // 检查是否是 $\color{#xxx}{...}$ 模式（允许 $ 和 \color 之间有空白字符）
    if (text[i] === '$' && text.substring(i + 1).match(/^\s*\\color\{#([0-9A-Fa-f]{6})\}\s*\{/)) {
      const match = text.substring(i).match(/^\$\s*\\color\{#([0-9A-Fa-f]{6})\}\s*\{/);
      if (match) {
        const color = match[1];
        const braceStart = i + match[0].length - 1;
        const afterBrace = text.substring(braceStart);
        const braceResult = extractBracedContent(afterBrace);
        
        if (braceResult.length > 0) {
          // 检查大括号后面是否紧跟 $ 符号（允许有空白字符）
          const afterContent = text.substring(braceStart + braceResult.length);
          const afterMatch = afterContent.match(/^\s*\$/);
          if (afterMatch) {
            // 保留公式格式，让后端处理颜色
            // 格式: $\color{#xxx}{内容}$
            result += `$\\color{#${color}}{${braceResult.content.trim()}}$`;
            i = braceStart + braceResult.length + afterMatch[0].length;
            continue;
          }
        }
      }
    }
    
    result += text[i];
    i++;
  }
  
  return result;
}

/**
 * 预处理文本，将自定义标签转换为 Markdown
 * @param {string} text - 原始文本
 * @returns {string} - 处理后的 Markdown 文本
 */
function preprocessTextForMp(text) {
  if (!text || typeof text !== 'string') return '';
  
  let processed = text;
  
  // 0. 预处理：将所有 HTML 标签替换为占位符，保护它们不被错误解析
  const tagPlaceholders = [];
  processed = processed.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s+[^>]*)?\/?>/gi, (match) => {
    const placeholder = `__TAG_${tagPlaceholders.length}__`;
    tagPlaceholders.push(match);
    return placeholder;
  });
  
  // 0.0 转义所有 < 和 >，防止被解析为 HTML 标签
  processed = processed.replace(/</g, '\\lt').replace(/>/g, '\\gt');
  
  // 0.1 恢复所有 HTML 标签
  tagPlaceholders.forEach((tag, index) => {
    processed = processed.replace(`__TAG_${index}__`, tag);
  });
  
  // 0.2 将 <br> 标签统一转换为换行符
  processed = processed.replace(/<br\s*\/?>\n?/gi, '\n');
  
  // 0.2 处理公式内的 \color 命令
  processed = processColorInLatex(processed);
  
  // 0.3 处理公式内的 \mathbf 命令
  processed = processed.replace(/\$\\mathbf\{([^}]*)\}\$/g, (match, content) => {
    return `<strong>${content}</strong>`;
  });
  
  // 0.4 清理 LaTeX 公式内部的换行符（在 $...$ 之间）并转义 < 和 >
  // 先处理多行公式 $$...$$
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    let cleaned = formula.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    // 转义 < 和 > 为 HTML 实体，防止被解析为 HTML 标签
    cleaned = cleaned.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `$$${cleaned}$$`;
  });
  // 再处理单行公式 $...$
  processed = processed.replace(/\$([^$\n]+)\$/g, (match, formula) => {
    let cleaned = formula.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    // 转义 < 和 > 为 HTML 实体，防止被解析为 HTML 标签
    cleaned = cleaned.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `$${cleaned}$`;
  });
  
  // 1. 处理 《答案》等自定义标签 - 转换为 HTML，使用内联样式
  // 微信小程序中直接使用内联样式更可靠
  const answerLabelStyle = 'color:#fff;background-color:#009688;padding:2px 8px;margin-right:6px;border-radius:4px;font-size:13px;font-weight:bold;display:inline-block;';
  const analysisLabelStyle = 'color:#fff;background-color:#2196F3;padding:2px 8px;margin-right:6px;border-radius:4px;font-size:13px;font-weight:bold;display:inline-block;';
  const stepLabelStyle = 'color:#FF9800;font-weight:bold;display:inline-block;';
  const noteStyle = 'color:#009688;';
  
  processed = processed
    // 《答案》【答案】《/答案》→ 答案标签
    .replace(/《答案》\s*【答案】\s*《\/答案》/g, `<span style="${answerLabelStyle}">答案</span>`)
    // 《答案》【证明】《/答案》→ 证明标签
    .replace(/《答案》\s*【证明】\s*《\/答案》/g, `<span style="${answerLabelStyle}">证明</span>`)
    // 《答案》【解析】《/答案》→ 解析标签
    .replace(/《答案》\s*【解析】\s*《\/答案》/g, `<span style="${answerLabelStyle}">解析</span>`)
    // 《答案》...《/答案》→ 答案标签 + 内容
    .replace(/《答案》/g, `<span style="${answerLabelStyle}">答案</span>`)
    .replace(/《\/答案》/g, '')
    // 《分析》【解析】《/分析》→ 解析标签
    .replace(/《分析》\s*【解析】\s*《\/分析》/g, `<span style="${analysisLabelStyle}">解析</span>`)
    // 《分析》【思路分析】《/分析》→ 思路分析标签
    .replace(/《分析》\s*【思路分析】\s*《\/分析》/g, `<span style="${analysisLabelStyle}">思路分析</span>`)
    // 《分析》...《/分析》→ 分析标签 + 青色内容
    .replace(/《分析》/g, `<span style="${analysisLabelStyle}">分析</span><span style="${noteStyle}">`)
    .replace(/《\/分析》/g, '</span>')
    // 《点评》...《/点评》→ 删除不显示
    .replace(/《点评》[\s\S]*?《\/点评》/g, '')
    // 《注释》...《/注释》→ 青色文字
    .replace(/《注释》/g, `<span style="${noteStyle}">`)
    .replace(/《\/注释》/g, '</span>')
    // 《步骤》...《/步骤》→ 橙色加粗，无标签
    .replace(/《步骤》/g, `<span style="${stepLabelStyle}">`)
    .replace(/《\/步骤》/g, '</span>');
  
  // 2. 处理 \bold 和 \mathbf 命令（仅处理公式外的）
  // 注意：公式内的 \bold 和 \mathbf 会被保留，让后端处理
  // 只有当它们不在 $...$ 内时才转换为 Markdown 格式
  processed = processed
    .replace(/\\bold\{([^}]+)\}/g, (match, content, offset, string) => {
      // 检查是否在公式内
      const beforeMatch = string.substring(0, offset);
      const dollarCount = (beforeMatch.match(/\$/g) || []).length;
      if (dollarCount % 2 === 1) {
        // 在公式内，保留原样
        return match;
      }
      return `**${content}**`;
    })
    .replace(/\\mathbf\{([^}]+)\}/g, (match, content, offset, string) => {
      // 检查是否在公式内
      const beforeMatch = string.substring(0, offset);
      const dollarCount = (beforeMatch.match(/\$/g) || []).length;
      if (dollarCount % 2 === 1) {
        // 在公式内，保留原样
        return match;
      }
      return `**${content}**`;
    });
  
  // 3. 处理 Markdown 格式图片 ![alt](url) - 转换为 HTML img 标签
  processed = processed.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, url) => {
      // 解码 URL（处理被编码的字符）
      let decodedUrl = url;
      try {
        decodedUrl = decodeURIComponent(url);
      } catch (e) {
        // 解码失败则使用原 URL
      }
      // 去除 _yjs 等后缀
      let cleanUrl = decodedUrl.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '$2');
      // 微信小程序要求 HTTPS，将 HTTP 转换为 HTTPS
      cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');
      return `<img src="${cleanUrl}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:10px 0;" />`;
    }
  );
  
  // 3.1 处理 ! `url` 格式（带反引号的图片标记）
  processed = processed.replace(
    /!\s*`\s*(https?:\/\/[^\s`]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp)(?:_yjs|_thumb|_small|_medium|_large)?)\s*`/gi,
    (match, url) => {
      // 解码 URL（处理被编码的字符）
      let decodedUrl = url;
      try {
        decodedUrl = decodeURIComponent(url);
      } catch (e) {
        // 解码失败则使用原 URL
      }
      // 去除 _yjs 等后缀
      let cleanUrl = decodedUrl.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '$2');
      // 微信小程序要求 HTTPS，将 HTTP 转换为 HTTPS
      cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');
      return `<img src="${cleanUrl}" alt="" style="max-width:100%;height:auto;display:block;margin:10px 0;" />`;
    }
  );
  
  // 4. 处理图片URL（如 http://ysj-question.oss-cn-hangzhou.aliyuncs.com/...）
  processed = processed.replace(
    /(https?:\/\/[^\s<>"]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp))(?:_yjs|_thumb|_small|_medium|_large)?(?!["'])/gi,
    (match, url) => {
      // 去除 _yjs 等后缀
      let cleanUrl = url.replace(/(_yjs|_thumb|_small|_medium|_large)$/i, '');
      // 微信小程序要求 HTTPS，将 HTTP 转换为 HTTPS
      cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');
      return `<img src="${cleanUrl}" style="max-width:100%;height:auto;display:block;margin:10px 0;" />`;
    }
  );
  
  // 5. 解码 HTML 实体
  processed = processed
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
  
  // 6. 自动识别选择题选项并添加换行
  // 格式：$\left( \mathrm{A/B/C/D} \right)$ 或 (A) (B) (C) (D) 等
  // 在选项前添加换行符，确保每个选项单独一行
  processed = processed.replace(
    /([^\n])(\$\s*\\left\(\s*\\mathrm\{[A-D]\}\s*\\right\)\s*\$)/g,
    (match, before, option) => {
      return `${before}\n${option}`;
    }
  );
  processed = processed.replace(
    /([^\n])(\([A-D]\))/g,
    (match, before, option) => {
      if (before.match(/[A-D]$/)) {
        return match;
      }
      return `${before}\n${option}`;
    }
  );
  processed = processed.replace(
    /([^\n])([A-D]\.)/g,
    (match, before, option) => {
      if (before.match(/[A-D]$/)) {
        return match;
      }
      return `${before}\n${option}`;
    }
  );
  
  // 7. 不再手动转换换行符，让 towxml 的 markdown 解析器（breaks: true）自动处理
  // towxml 会自动将换行符转换为 <br> 标签
  
  return processed;
}

/**
 * 解析 HTML 字符串为节点数组
 * @param {string} html - HTML 字符串
 * @returns {Array} - 节点数组
 */
function parseHtmlToNodes(html, parentFormulas = []) {
  if (!html || typeof html !== 'string') return [];
  
  // 首先保护公式内容，将 $...$ 和 $$...$$ 替换为占位符
  const formulas = [...parentFormulas]; // 继承父级的 formulas
  // 使用 [\s\S] 来匹配包括换行符在内的所有字符
  let protectedHtml = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    const placeholder = `__FORMULA_${formulas.length}__`;
    formulas.push(match);
    return placeholder;
  });
  // 然后处理单行公式 $...$
  protectedHtml = protectedHtml.replace(/\$([^$\n]+)\$/g, (match, formula) => {
    const placeholder = `__FORMULA_${formulas.length}__`;
    formulas.push(match);
    return placeholder;
  });
  
  const nodes = [];
  let i = 0;
  
  while (i < protectedHtml.length) {
    // 检查是否是公式占位符
    const formulaMatch = protectedHtml.substring(i).match(/^__FORMULA_(\d+)__/);
    if (formulaMatch) {
      const formulaIndex = parseInt(formulaMatch[1]);
      const formula = formulas[formulaIndex];
      // 解析公式内容，将 HTML 实体转换回 < 和 >
      let formulaContent = formula.replace(/\$\$?/g, '').trim();
      formulaContent = formulaContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const unicodeFormula = latexToUnicode(formulaContent);
      nodes.push({
        type: 'text',
        text: unicodeFormula
      });
      i += formulaMatch[0].length;
      continue;
    }
    
    // 检查是否是标签
    if (protectedHtml[i] === '<') {
      const tagEnd = protectedHtml.indexOf('>', i);
      if (tagEnd === -1) break;
      
      const tagContent = protectedHtml.substring(i + 1, tagEnd);
      const isClosing = tagContent.startsWith('/');
      const tagName = isClosing ? tagContent.substring(1) : tagContent.split(' ')[0];
      
      if (!isClosing) {
        // 提取属性
        const attrs = {};
        const attrRegex = /(\w+)=['"]([^'"]*)['"]/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(tagContent)) !== null) {
          attrs[attrMatch[1]] = attrMatch[2];
        }
        
        // 检查是否是自闭合标签（如 img、br、hr 等）
        const selfClosingTags = ['img', 'br', 'hr', 'input', 'meta', 'link'];
        const isSelfClosing = tagContent.endsWith('/') || selfClosingTags.includes(tagName.toLowerCase());
        
        if (isSelfClosing) {
          // 自闭合标签
          nodes.push({
            type: 'element',
            tag: tagName,
            attrs: attrs,
            children: []
          });
          i = tagEnd + 1;
          continue;
        }
        
        // 开始标签 - 查找对应的结束标签
        const closeTagStart = protectedHtml.indexOf(`</${tagName}>`, tagEnd);
        if (closeTagStart !== -1) {
          const innerContent = protectedHtml.substring(tagEnd + 1, closeTagStart);
          
          // 递归解析内部内容，传递 formulas 数组
          const children = parseHtmlToNodes(innerContent, formulas);
          
          nodes.push({
            type: 'element',
            tag: tagName,
            attrs: attrs,
            children: children.length > 0 ? children : [{ type: 'text', text: innerContent }]
          });
          
          i = closeTagStart + `</${tagName}>`.length;
          continue;
        }
      }
      i = tagEnd + 1;
    } else {
      // 文本内容
      const nextTag = protectedHtml.indexOf('<', i);
      const textEnd = nextTag === -1 ? protectedHtml.length : nextTag;
      const text = protectedHtml.substring(i, textEnd);
      
      if (text) {
        nodes.push({
          type: 'text',
          text: text
        });
      }
      
      i = textEnd;
    }
  }
  
  return nodes;
}

/**
 * 解析包含公式的文本
 * @param {string} text - 文本
 * @returns {Array} - 节点数组
 */
function parseTextWithFormulas(text) {
  const parts = [];
  let lastIndex = 0;
  
  // 匹配 $...$ 和 $$...$$
  const regex = /\$\$?([^$]+)\$\$?/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // 添加公式前的文本
    if (match.index > lastIndex) {
      const textContent = text.substring(lastIndex, match.index);
      if (textContent) {
        parts.push({
          type: 'text',
          text: textContent
        });
      }
    }
    
    // 添加公式节点 - 将 LaTeX 转换为 Unicode
    const formulaText = match[1].trim();
    const unicodeFormula = latexToUnicode(formulaText);
    parts.push({
      type: 'text',
      text: unicodeFormula
    });
    
    lastIndex = regex.lastIndex;
  }
  
  // 添加剩余文本
  if (lastIndex < text.length) {
    const textContent = text.substring(lastIndex);
    if (textContent) {
      parts.push({
        type: 'text',
        text: textContent
      });
    }
  }
  
  // 如果没有公式，直接返回文本
  if (parts.length === 0 && text) {
    parts.push({
      type: 'text',
      text: text
    });
  }
  
  return parts;
}

/**
 * 简单的 Markdown 转 HTML 节点解析器（替代 towxml）
 * @param {string} text - 预处理后的文本
 * @returns {Object} - 节点对象
 */
function simpleMarkdownToNodes(text) {
  if (!text || typeof text !== 'string') {
    return {
      type: 'element',
      tag: 'div',
      children: []
    };
  }

  // 首先保护多行公式 $$...$$
  const multilineFormulas = [];
  let protectedText = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    const placeholder = `__MULTILINE_FORMULA_${multilineFormulas.length}__`;
    multilineFormulas.push(match);
    return placeholder;
  });

  // 将文本按换行分割
  const lines = protectedText.split('\n');
  const children = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // 检查是否是多行公式占位符
    const multilineMatch = line.match(/^__MULTILINE_FORMULA_(\d+)__$/);
    if (multilineMatch) {
      const formulaIndex = parseInt(multilineMatch[1]);
      const formula = multilineFormulas[formulaIndex];
      // 解析公式内容，将 HTML 实体转换回 < 和 >
      let formulaContent = formula.replace(/\$\$/g, '').trim();
      formulaContent = formulaContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const unicodeFormula = latexToUnicode(formulaContent);
      children.push({
        type: 'text',
        text: unicodeFormula
      });
      continue;
    }

    // 解析这一行（包含 HTML 标签和公式）
    const nodes = parseHtmlToNodes(line);
    
    if (nodes.length === 1) {
      children.push(nodes[0]);
    } else if (nodes.length > 1) {
      children.push({
        type: 'element',
        tag: 'div',
        attrs: {
          style: 'margin-bottom: 8px;'
        },
        children: nodes
      });
    }
  }

  return {
    type: 'element',
    tag: 'div',
    children: children.length > 0 ? children : [{ type: 'text', text: text }]
  };
}

/**
 * 解析包含 LaTeX 公式的文本为微信小程序可用的 nodes 对象
 * 适用于微信小程序
 * @param {string} text - 包含 LaTeX 公式的文本
 * @returns {Object} - 节点对象
 */
export function parseTextWithLatexForMp(text) {
  // #ifdef MP-WEIXIN
  if (!text || typeof text !== 'string') {
    return {
      type: 'element',
      tag: 'div',
      children: []
    };
  }

  try {
    // 1. 预处理文本
    let processedText = preprocessTextForMp(text);
    
    // 2. 使用简单的 Markdown 解析器（替代 towxml）
    const result = simpleMarkdownToNodes(processedText);
    
    return result || {
      type: 'element',
      tag: 'div',
      children: [{ type: 'text', text: text }]
    };
  } catch (error) {
    console.error('parseTextWithLatexForMp error:', error);
    // 出错时返回原始文本作为纯文本节点
    return {
      type: 'element',
      tag: 'div',
      children: [{ type: 'text', text: text }]
    };
  }
  // #endif
  
  // #ifndef MP-WEIXIN
  // 非 MP-WEIXIN 环境下返回空对象
  return {};
  // #endif
}

// H5 版本的 transformContextString 函数
// #ifdef H5
export function transformContextString(rawContextString) {
  if (typeof rawContextString !== 'string') return '';

  const placeholders = [];
  const createPlaceholder = (content, type = 'html') => {
    const p = `__LATEX_JS_${type.toUpperCase()}_PH_${placeholders.length}__`;
    placeholders.push({ p, content, type });
    return p;
  };

  let currentText = rawContextString.trim().replace(/\t/g, ' ').replace(/ {2,}/g, ' ');
  
  // 1. 提取并保护所有数学公式 (在反转义 HTML 之前，避免公式内的符号被破坏)
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
        strict: false,
        trust: true
      });
      return createPlaceholder(rendered, 'math');
    } catch (e) {
      console.warn('KaTeX render error:', e);
      return match;
    }
  });

  // 2. 反转义 HTML 实体
  currentText = currentText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

  // 3. 处理 《答案》《解析》等自定义标签（参考 que.php 的实现）
  const brPatternInHtml = "(?:<br\\s*\\/>\\s*(?:\\n)?)?";

  // 标签样式：更精致的圆角标签，带渐变和阴影效果
  const answerLabelStyle = 'display:inline-block;padding:4px 12px;border-radius:6px;background:linear-gradient(135deg,#009688 0%,#00796b 100%);color:#fff;font-size:13px;font-weight:600;margin-right:6px;box-shadow:0 2px 4px rgba(0,150,136,0.3);letter-spacing:0.5px;';
  const jiexiLabelStyle = 'display:inline-block;padding:4px 12px;border-radius:6px;background:linear-gradient(135deg,#2196F3 0%,#1976D2 100%);color:#fff;font-size:13px;font-weight:600;margin-right:6px;box-shadow:0 2px 4px rgba(33,150,243,0.3);letter-spacing:0.5px;';

  // 处理 《答案》【答案】《/答案》→ 答案标签
  const answerMarkerRegex = new RegExp(`《答案》${brPatternInHtml}【答案】${brPatternInHtml}《\\/答案》(?:\\s|${brPatternInHtml})*`, "g");
  currentText = currentText.replace(answerMarkerRegex, `<span class="tag-label-答案" style="${answerLabelStyle}">答案</span>`);

  // 处理 《答案》【证明】《/答案》→ 证明标签
  const answerMarkerRegex1 = new RegExp(`《答案》${brPatternInHtml}【证明】${brPatternInHtml}《\\/答案》(?:\\s|${brPatternInHtml})*`, "g");
  currentText = currentText.replace(answerMarkerRegex1, `<span class="tag-label-证明" style="${answerLabelStyle}">证明</span>`);

  // 处理 《解析》【解析】《/解析》→ 解析标签
  const jiexiMarkerRegex = new RegExp(`《解析》${brPatternInHtml}【解析】${brPatternInHtml}《\\/解析》(?:\\s|${brPatternInHtml})*`, "g");
  currentText = currentText.replace(jiexiMarkerRegex, `<span class="tag-label-解析" style="${jiexiLabelStyle}">解析</span>`);

  // 辅助函数：样式化自定义块 - 虚线边框版本（蓝色系）
  const styleCustomBlock = (contentToStyle, styleString, labelClass = '') => {
    let processedContent = contentToStyle.replace(/<strong>|<\/strong>|<b>|<\/b>/gi, '');
    let trimmedContent = processedContent.trim().replace(/^(<br\s*\/?>\s*)+|(<br\s*\/?>\s*)+$/gi, '');
    if (!trimmedContent) return '';
    return `<div style="margin:2px 0;padding:6px 10px;background:rgba(33,150,243,0.03);border:1px dashed #2196F3;border-radius:6px;"><span style="${styleString}">${trimmedContent}</span></div>`;
  };

  // 辅助函数：注释专用 - 不使用虚线框（青绿色）
  const styleCustomBlockNote = (contentToStyle, styleString, labelClass = '') => {
    let processedContent = contentToStyle.replace(/<strong>|<\/strong>|<b>|<\/b>/gi, '');
    let trimmedContent = processedContent.trim().replace(/^(<br\s*\/?>\s*)+|(<br\s*\/?>\s*)+$/gi, '');
    if (!trimmedContent) return '';
    return `<div style="margin:2px 0;padding:6px 10px;background:linear-gradient(135deg,rgba(0,150,136,0.08) 0%,rgba(0,150,136,0.03) 100%);border-left:3px solid #009688;border-radius:0 6px 6px 0;"><span style="${styleString}">${trimmedContent}</span></div>`;
  };

  const styleCustomBlock2 = (contentToStyle, styleString, labelClass = '') => {
    let processedContent = contentToStyle.replace(/<strong>|<\/strong>|<b>|<\/b>/gi, '');
    let trimmedContent = processedContent.trim().replace(/^(<br\s*\/?>\s*)+|(<br\s*\/?>\s*)+$/gi, '');
    if (!trimmedContent) return '';
    return `<div style="margin:2px 0;padding:6px 10px;background:linear-gradient(135deg,rgba(255,84,5,0.08) 0%,rgba(255,84,5,0.03) 100%);border-left:3px solid #FF5405;border-radius:0 6px 6px 0;"><span style="${styleString}">${trimmedContent}</span></div>`;
  };

  const commentaryTextStyle = "color:#1565C0;line-height:1.6;";
  const commentaryTextStyleNote = "color:#00796b;line-height:1.6;";
  const commentaryTextStyle2 = "color:#E64A19;line-height:1.6;";

  // 处理 《分析》...《/分析》
  currentText = currentText.replace(/《分析》([\s\S]*?)《\/分析》/g, (match, innerContent) =>
    styleCustomBlock(innerContent, commentaryTextStyle, 'tag-label-analysis')
  );

  // 处理 《思路分析》...《/思路分析》
  currentText = currentText.replace(/《思路分析》([\s\S]*?)《\/思路分析》/g, (match, innerContent) =>
    styleCustomBlock(innerContent, commentaryTextStyle, 'tag-label-思路分析')
  );

  // 处理 《注释》...《/注释》 - 不使用虚线框（保持青绿色）
  currentText = currentText.replace(/《注释》([\s\S]*?)《\/注释》/g, (match, innerContent) =>
    styleCustomBlockNote(innerContent, commentaryTextStyleNote, 'tag-label-注释')
  );

  // 处理 《点评》...《/点评》→ 移除（替换为空格）
  currentText = currentText.replace(/《点评》([\s\S]*?)《\/点评》/g, ' ');

  // 处理 《步骤》...《/步骤》
  currentText = currentText.replace(/《步骤》([\s\S]*?)《\/步骤》/g, (match, innerContent) =>
    styleCustomBlock2(innerContent, commentaryTextStyle2, 'tag-label-steps')
  );

  // 4. 处理 \color 和 \bold 命令
  currentText = currentText
    .replace(/\\color\{#([0-9A-Fa-f]{6})\}\{([^}]+)\}/g, '<span style="color:#$1;">$2</span>')
    .replace(/\\bold\{([^}]+)\}/g, '<b>$1</b>')
    .replace(/\\mathbf\{([^}]+)\}/g, '<b>$1</b>');

  // 5. 处理 Markdown 格式图片 ![alt](url) - 转换为 HTML img 标签
  // 先去除 _yjs 等后缀
  currentText = currentText.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, url) => {
      // 解码 URL（处理被编码的字符）
      let decodedUrl = url;
      try {
        decodedUrl = decodeURIComponent(url);
      } catch (e) {
        // 解码失败则使用原 URL
      }
      // 去除 _yjs 等后缀
      let cleanUrl = decodedUrl.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '$2');
      // 将 HTTP 转换为 HTTPS
      cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');
      return `<img src="${cleanUrl}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display='none'" />`;
    }
  );

  // 5.1 处理 ! `url` 格式（带反引号的图片标记）
  currentText = currentText.replace(
    /!\s*`\s*(https?:\/\/[^\s`]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp)(?:_yjs|_thumb|_small|_medium|_large)?)\s*`/gi,
    (match, url) => {
      // 解码 URL（处理被编码的字符）
      let decodedUrl = url;
      try {
        decodedUrl = decodeURIComponent(url);
      } catch (e) {
        // 解码失败则使用原 URL
      }
      // 去除 _yjs 等后缀
      let cleanUrl = decodedUrl.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '$2');
      // 将 HTTP 转换为 HTTPS
      cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');
      return `<img src="${cleanUrl}" alt="" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display='none'" />`;
    }
  );

  // 6. 处理图片URL（如 http://ysj-question.oss-cn-hangzhou.aliyuncs.com/...）
  // 使用否定前瞻避免匹配已经包含在 <img src="..."> 中的URL
  currentText = currentText.replace(
    /(https?:\/\/[^\s<>"]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp))(?:_yjs|_thumb|_small|_medium|_large)?(?!["'])/gi,
    (match, url) => {
      // 去除 _yjs 等后缀
      let cleanUrl = url.replace(/(_yjs|_thumb|_small|_medium|_large)$/i, '');
      // 将 HTTP 转换为 HTTPS
      cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');
      return `<img src="${cleanUrl}" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display='none'" />`;
    }
  );

  // 7. 还原占位符
  placeholders.forEach(({ p, content }) => {
    currentText = currentText.replace(p, content);
  });

  // 8. 将换行符转换为 <br>
  currentText = currentText.replace(/\n/g, '<br>');

  return currentText;
}
// #endif

// #ifndef H5
// 非 H5 版本的 transformContextString 函数（小程序环境）
export function transformContextString(rawContextString) {
  if (typeof rawContextString !== 'string') return '';

  let currentText = rawContextString.trim().replace(/\t/g, ' ').replace(/ {2,}/g, ' ');

  // 1. 处理 HTML 实体
  currentText = currentText
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#36;/g, '$');

  // 2. 处理 《答案》《解析》等自定义标签（参考 que.php 的实现）
  const brPatternInHtml = "(?:<br\\s*\\/>\\s*(?:\\n)?)?";

  // 标签样式：更精致的圆角标签，带渐变和阴影效果
  const answerLabelStyle = 'display:inline-block;padding:4px 12px;border-radius:6px;background:linear-gradient(135deg,#009688 0%,#00796b 100%);color:#fff;font-size:13px;font-weight:600;margin-right:6px;box-shadow:0 2px 4px rgba(0,150,136,0.3);letter-spacing:0.5px;';
  const jiexiLabelStyle = 'display:inline-block;padding:4px 12px;border-radius:6px;background:linear-gradient(135deg,#2196F3 0%,#1976D2 100%);color:#fff;font-size:13px;font-weight:600;margin-right:6px;box-shadow:0 2px 4px rgba(33,150,243,0.3);letter-spacing:0.5px;';

  // 处理 《答案》【答案】《/答案》→ 答案标签
  const answerMarkerRegex = new RegExp(`《答案》${brPatternInHtml}【答案】${brPatternInHtml}《\\/答案》(?:\\s|${brPatternInHtml})*`, "g");
  currentText = currentText.replace(answerMarkerRegex, `<span class="tag-label-答案" style="${answerLabelStyle}">答案</span>`);

  // 处理 《答案》【证明】《/答案》→ 证明标签
  const answerMarkerRegex1 = new RegExp(`《答案》${brPatternInHtml}【证明】${brPatternInHtml}《\\/答案》(?:\\s|${brPatternInHtml})*`, "g");
  currentText = currentText.replace(answerMarkerRegex1, `<span class="tag-label-证明" style="${answerLabelStyle}">证明</span>`);

  // 处理 《解析》【解析】《/解析》→ 解析标签
  const jiexiMarkerRegex = new RegExp(`《解析》${brPatternInHtml}【解析】${brPatternInHtml}《\\/解析》(?:\\s|${brPatternInHtml})*`, "g");
  currentText = currentText.replace(jiexiMarkerRegex, `<span class="tag-label-解析" style="${jiexiLabelStyle}">解析</span>`);

  // 辅助函数：样式化自定义块 - 虚线边框版本（蓝色系）
  const styleCustomBlock = (contentToStyle, styleString, labelClass = '') => {
    let processedContent = contentToStyle.replace(/<strong>|<\/strong>|<b>|<\/b>/gi, '');
    let trimmedContent = processedContent.trim().replace(/^(<br\s*\/?>\s*)+|(<br\s*\/?>\s*)+$/gi, '');
    if (!trimmedContent) return '';
    return `<div style="margin:2px 0;padding:6px 10px;background:rgba(33,150,243,0.03);border:1px dashed #2196F3;border-radius:6px;"><span style="${styleString}">${trimmedContent}</span></div>`;
  };

  // 辅助函数：注释专用 - 不使用虚线框（青绿色）
  const styleCustomBlockNote = (contentToStyle, styleString, labelClass = '') => {
    let processedContent = contentToStyle.replace(/<strong>|<\/strong>|<b>|<\/b>/gi, '');
    let trimmedContent = processedContent.trim().replace(/^(<br\s*\/?>\s*)+|(<br\s*\/?>\s*)+$/gi, '');
    if (!trimmedContent) return '';
    return `<div style="margin:2px 0;padding:6px 10px;background:linear-gradient(135deg,rgba(0,150,136,0.08) 0%,rgba(0,150,136,0.03) 100%);border-left:3px solid #009688;border-radius:0 6px 6px 0;"><span style="${styleString}">${trimmedContent}</span></div>`;
  };

  const styleCustomBlock2 = (contentToStyle, styleString, labelClass = '') => {
    let processedContent = contentToStyle.replace(/<strong>|<\/strong>|<b>|<\/b>/gi, '');
    let trimmedContent = processedContent.trim().replace(/^(<br\s*\/?>\s*)+|(<br\s*\/?>\s*)+$/gi, '');
    if (!trimmedContent) return '';
    return `<div style="margin:2px 0;padding:6px 10px;background:linear-gradient(135deg,rgba(255,84,5,0.08) 0%,rgba(255,84,5,0.03) 100%);border-left:3px solid #FF5405;border-radius:0 6px 6px 0;"><span style="${styleString}">${trimmedContent}</span></div>`;
  };

  const commentaryTextStyle = "color:#1565C0;line-height:1.6;";
  const commentaryTextStyleNote = "color:#00796b;line-height:1.6;";
  const commentaryTextStyle2 = "color:#E64A19;line-height:1.6;";

  // 处理 《分析》...《/分析》
  currentText = currentText.replace(/《分析》([\s\S]*?)《\/分析》/g, (match, innerContent) =>
    styleCustomBlock(innerContent, commentaryTextStyle, 'tag-label-analysis')
  );

  // 处理 《思路分析》...《/思路分析》
  currentText = currentText.replace(/《思路分析》([\s\S]*?)《\/思路分析》/g, (match, innerContent) =>
    styleCustomBlock(innerContent, commentaryTextStyle, 'tag-label-思路分析')
  );

  // 处理 《注释》...《/注释》 - 不使用虚线框（保持青绿色）
  currentText = currentText.replace(/《注释》([\s\S]*?)《\/注释》/g, (match, innerContent) =>
    styleCustomBlockNote(innerContent, commentaryTextStyleNote, 'tag-label-注释')
  );

  // 处理 《点评》...《/点评》→ 移除（替换为空格）
  currentText = currentText.replace(/《点评》([\s\S]*?)《\/点评》/g, ' ');

  // 处理 《步骤》...《/步骤》
  currentText = currentText.replace(/《步骤》([\s\S]*?)《\/步骤》/g, (match, innerContent) =>
    styleCustomBlock2(innerContent, commentaryTextStyle2, 'tag-label-steps')
  );

  // 3. 处理 \color 和 \bold 命令
  currentText = currentText
    .replace(/\\color\{#([0-9A-Fa-f]{6})\}\{([^}]+)\}/g, '<span style="color:#$1;">$2</span>')
    .replace(/\\bold\{([^}]+)\}/g, '<b>$1</b>')
    .replace(/\\mathbf\{([^}]+)\}/g, '<b>$1</b>');
  
  // 4. 处理 Markdown 格式图片
  // 使用更宽松的正则，匹配 URL 直到 .png/.jpg 等扩展名及后续参数
  currentText = currentText.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp|svg|bmp)[^\)]*)\)/gi,
    (match, alt, url) => {
      let decodedUrl = url;
      try {
        decodedUrl = decodeURIComponent(url);
      } catch (e) {}
      let cleanUrl = decodedUrl.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '$2');
      return `<img src="${cleanUrl}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:4px;" />`;
    }
  );
  
  // 4.5 处理裸图片 URL（不在 Markdown 格式中的图片链接）
  // 先保护已经处理过的 <img> 标签
  const existingImgs = [];
  currentText = currentText.replace(/<img[^>]+>/gi, (match) => {
    existingImgs.push(match);
    return `<!--EXISTING_IMG_${existingImgs.length - 1}-->`;
  });
  
  // 处理裸图片 URL
  currentText = currentText.replace(
    /(https?:\/\/[^\s<>"]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp))(?:_yjs|_thumb|_small|_medium|_large)?(?!["'])/gi,
    (match, url) => {
      let cleanUrl = url.replace(/(_yjs|_thumb|_small|_medium|_large)$/i, '');
      return `<img src="${cleanUrl}" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:4px;" />`;
    }
  );
  
  // 还原已有的 <img> 标签
  currentText = currentText.replace(/<!--EXISTING_IMG_(\d+)-->/g, (match, index) => {
    return existingImgs[parseInt(index)] || match;
  });
  
  // 5. 将 LaTeX 公式转换为 Unicode 字符
  currentText = convertLatexToUnicode(currentText);
  
  // 6. 保护代码块内的换行符，将代码块占位
  const codeBlocks = [];
  currentText = currentText.replace(/<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>/gi, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });
  
  // 7. 将换行符转换为 <br>（代码块外）
  currentText = currentText.replace(/\n/g, '<br>');
  
  // 8. 恢复代码块
  codeBlocks.forEach((block, index) => {
    currentText = currentText.replace(`__CODE_BLOCK_${index}__`, block);
  });
  
  return currentText;
}
// #endif

/**
 * 包装 LaTeX 命令（将未包裹的命令用 $...$ 包裹）
 * @param {string} text - 原始文本
 * @returns {string} - 处理后的文本
 */
export function wrapLatexCommands(text) {
  if (!text || typeof text !== 'string') return '';
  
  // 匹配常见的 LaTeX 命令，如果它们没有被 $ 包裹，则添加 $ 包裹
  const latexCommands = [
    '\\left', '\\right', '\\frac', '\\sum', '\\int', '\\lim', '\\infty',
    '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\zeta',
    '\\eta', '\\theta', '\\iota', '\\kappa', '\\lambda', '\\mu',
    '\\nu', '\\xi', '\\pi', '\\rho', '\\sigma', '\\tau',
    '\\upsilon', '\\phi', '\\chi', '\\psi', '\\omega',
    '\\Gamma', '\\Delta', '\\Theta', '\\Lambda', '\\Xi', '\\Pi',
    '\\Sigma', '\\Upsilon', '\\Phi', '\\Psi', '\\Omega',
    '\\sin', '\\cos', '\\tan', '\\cot', '\\sec', '\\csc',
    '\\arcsin', '\\arccos', '\\arctan', '\\ln', '\\log', '\\exp',
    '\\sqrt', '\\vec', '\\overrightarrow', '\\cdot', '\\times',
    '\\div', '\\pm', '\\mp', '\\leq', '\\geq', '\\neq',
    '\\approx', '\\equiv', '\\sim', '\\propto', '\\perp',
    '\\parallel', '\\angle', '\\triangle', '\\square', '\\circ',
    '\\degree', '\\prime', '\\partial', '\\nabla', '\\hbar',
    '\\ell', '\\Re', '\\Im', '\\wp', '\\aleph', '\\imath',
    '\\jmath', '\\varphi', '\\varepsilon', '\\vartheta',
    '\\varpi', '\\varrho', '\\varsigma',
    '\\rightarrow', '\\leftarrow', '\\Rightarrow', '\\Leftarrow',
    '\\leftrightarrow', '\\Leftrightarrow', '\\mapsto',
    '\\to', '\\gets', '\\longrightarrow', '\\longleftarrow',
    '\\subset', '\\supset', '\\subseteq', '\\supseteq',
    '\\in', '\\ni', '\\notin', '\\cup', '\\cap',
    '\\setminus', '\\emptyset', '\\forall', '\\exists',
    '\\nexists', '\\neg', '\\wedge', '\\vee', '\\top',
    '\\bot', '\\vdash', '\\models', '\\land', '\\lor',
    '\\lnot', '\\implies', '\\iff',
    '\\ldots', '\\cdots', '\\vdots', '\\ddots', '\\dots',
    '\\quad', '\\qquad', '\\,', '\\:', '\\;', '\\!', '\\ ',
    '\\big', '\\Big', '\\bigg', '\\Bigg',
    '\\bigl', '\\bigr', '\\Bigl', '\\Bigr',
    '\\biggl', '\\biggr', '\\Biggl', '\\Biggr',
    '\\begin', '\\end', '\\mathbf', '\\mathbb', '\\mathcal',
    '\\mathfrak', '\\mathscr', '\\mathrm', '\\mathit',
    '\\mathsf', '\\mathtt', '\\textbf',
    '\\textit', '\\textsf', '\\texttt', '\\emph',
    '\\underline', '\\overline', '\\widehat', '\\widetilde',
    '\\overbrace', '\\underbrace', '\\overset', '\\underset',
    '\\stackrel', '\\binom', '\\tbinom', '\\dbinom',
    '\\pmatrix', '\\bmatrix', '\\vmatrix', '\\Bmatrix',
    '\\matrix', '\\smallmatrix', '\\substack',
    '\\operatorname', '\\DeclareMathOperator', '\\text',
    '\\mbox', '\\hbox', '\\vbox', '\\vcenter',
    '\\raisebox', '\\lower', '\\moveleft', '\\moveright',
    '\\hspace', '\\vspace', '\\hfill', '\\vfill',
    '\\hrule', '\\vrule', '\\hline', '\\cline',
    '\\multicolumn', '\\rowcolor', '\\columncolor',
    '\\color', '\\textcolor', '\\colorbox', '\\fcolorbox',
    '\\pagecolor', '\\definecolor',
    '\\textup', '\\textsl', '\\textsc',
    '\\strike', '\\sout',
    '\\xlongequal', '\\underset', '\\overset'
  ];
  
  // 构建正则表达式，匹配未被 $ 包裹的 LaTeX 命令
  const commandPattern = new RegExp(
    `(?<![$\\])(${latexCommands.join('|')})(?![$])`,
    'g'
  );
  
  // 查找所有需要包裹的 LaTeX 片段
  let result = text;
  const matches = [];
  let match;
  
  while ((match = commandPattern.exec(text)) !== null) {
    const startPos = match.index;
    let endPos = startPos + match[0].length;
    
    // 跳过空白字符
    while (endPos < text.length && /\s/.test(text[endPos])) {
      endPos++;
    }
    
    // 如果后面跟着 {，找到匹配的 }
    if (text[endPos] === '{') {
      let braceDepth = 1;
      endPos++;
      while (endPos < text.length && braceDepth > 0) {
        if (text[endPos] === '{') braceDepth++;
        else if (text[endPos] === '}') braceDepth--;
        endPos++;
      }
    }
    
    matches.push({ start: startPos, end: endPos, text: text.slice(startPos, endPos) });
  }
  
  // 从后往前替换，避免位置偏移
  for (let i = matches.length - 1; i >= 0; i--) {
    const { start, end, text: matchText } = matches[i];
    result = result.slice(0, start) + '$' + matchText + '$' + result.slice(end);
  }
  
  return result;
}

/**
 * 处理文本中的 LaTeX 公式
 * @param {string} text - 原始文本
 * @returns {string} - 处理后的文本
 */
export function processLatexInText(text) {
  if (!text || typeof text !== 'string') return '';
  
  // 1. 首先包装未包裹的 LaTeX 命令
  let processed = wrapLatexCommands(text);
  
  // 2. 处理特殊字符和转义
  processed = processed
    .replace(/\\&/g, '&amp;')
    .replace(/\\%/g, '%')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\\$/g, '$');
  
  return processed;
}

/**
 * 检查文本是否包含 LaTeX 公式
 * @param {string} text - 文本
 * @returns {boolean} - 是否包含 LaTeX
 */
export function containsLatex(text) {
  if (!text || typeof text !== 'string') return false;
  
  // 匹配 $...$ 或 $$...$$ 或 \[...\] 或 \(...\)
  const latexPattern = /\$\$[\s\S]*?\$\$|\$[^\$]+\$|\\\[[\s\S]*?\\\]|\\\([^\)]+\\\)/;
  return latexPattern.test(text);
}

/**
 * 带重试机制的 KaTeX 渲染（用于 H5）
 * @param {string} element - DOM 元素选择器或元素
 * @param {Object} options - 渲染选项
 * @returns {Promise} - 渲染结果
 */
export function katexRenderWithRetry(element, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined' || !window.katex) {
        reject(new Error('KaTeX not available'));
        return;
      }
      
      const maxRetries = options.maxRetries || 3;
      let retries = 0;
      
      const attempt = () => {
        try {
          if (window.renderMathInElement) {
            window.renderMathInElement(element, {
              delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
              ],
              throwOnError: false,
              ...options
            });
            resolve();
          } else {
            throw new Error('renderMathInElement not available');
          }
        } catch (error) {
          retries++;
          if (retries < maxRetries) {
            setTimeout(attempt, 100);
          } else {
            reject(error);
          }
        }
      };
      
      attempt();
    } catch (error) {
      reject(error);
    }
  });
}
