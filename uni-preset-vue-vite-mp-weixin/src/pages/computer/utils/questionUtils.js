import { transformContextString } from '../../../utils/latex';

/**
 * 处理题干，识别填空题标识并渲染 LaTeX
 * @param {string} stem 题干字符串
 * @returns {string} 处理后的 HTML 字符串
 */
export const processStem = (stem) => {
  if (!stem) return '';

  // 0. 规范化 HTML 实体 (处理大写实体如 &NBSP;)
  let processedStem = stem.replace(/&[A-Za-z0-9]+;/g, (match) => match.toLowerCase());

  // 1. 代码块保护与美化 (处理 <pre> 和 <code>)
  const codePlaceholders = [];
  processedStem = processedStem.replace(/<(pre|code)[^>]*>([\s\S]*?)<\/\1>/gi, (match, tag, content) => {
    const isPre = tag.toLowerCase() === 'pre';
    const placeholder = `__CODE_BLOCK_PLACEHOLDER_${codePlaceholders.length}__`;

    // 提取核心内容并清理 HTML 标签
    let codeContent = content
      .replace(/<(p|div)[^>]*>/gi, '\n') // 换行标签转为换行符
      .replace(/<[^>]+>/g, '')           // 移除其他所有标签
      .replace(/&lt;/g, '<')             // 解码常见实体，防止二次转义
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    // 转义 HTML
    codeContent = codeContent.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);

    // 缩进优化：将 4 个或 2 个空格的缩进减小，或者处理 tab
    // 计算机代码常见的 4 空格缩进在移动端太占空间，改为 2 空格
    codeContent = codeContent.replace(/^(\s{4,})/gm, (match) => {
      return '  '.repeat(Math.ceil(match.length / 4));
    });
    // 处理 Tab
    codeContent = codeContent.replace(/\t/g, '  ');

    // 浅色主题代码块样式 - 自动换行，避免横向滚动与题目切换冲突
    const styledCode = isPre
      ? `<div style="width: 100%; background: #e0f2f1; border-radius: 8px; margin: 2px 0; border: 1px solid #b2dfdb; overflow: hidden;">
          <pre style="display: block; margin: 0; padding: 4px 8px; color: #333; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; line-height: 1.4; white-space: pre-wrap; word-break: break-all; overflow-wrap: break-word;">${codeContent}</pre>
        </div>`
      : `<code style="background: #e0f2f1; color: #333; padding: 2px 6px; border-radius: 4px; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px;">${codeContent}</code>`;

    codePlaceholders.push({ placeholder, content: styledCode });
    return placeholder;
  });

  // 2. 保护填空占位符 (如 ___, (1), (2) 等)
  const blankPlaceholders = [];
  processedStem = processedStem.replace(/(_{3,}|\([\d一二三四五六七八九十]+\))/g, (match) => {
    const placeholder = `__BLANK_PLACEHOLDER_${blankPlaceholders.length}__`;
    blankPlaceholders.push({ placeholder, content: match });
    return placeholder;
  });

  // 3. 处理 LaTeX 公式（在保护其他 HTML 之前，确保公式能被正确渲染）
  processedStem = transformContextString(processedStem);

  // 4. 保护已有的 HTML 标签 (包括 <u> 和 <span>，但不包括已渲染的公式)
  const htmlPlaceholders = [];
  processedStem = processedStem.replace(/<(\w+)[^>]*>[\s\S]*?<\/\1>/g, (match) => {
    // 跳过已渲染的 katex 公式
    if (match.includes('class="katex"')) return match;
    const placeholder = `__HTML_PLACEHOLDER_${htmlPlaceholders.length}__`;
    htmlPlaceholders.push({ placeholder, content: match });
    return placeholder;
  });

  // 5. 恢复填空占位符
  blankPlaceholders.forEach(({ placeholder, content }) => {
    processedStem = processedStem.replace(placeholder, content);
  });

  // 6. 恢复 HTML 标签
  htmlPlaceholders.forEach(({ placeholder, content }) => {
    processedStem = processedStem.replace(placeholder, content);
  });

  // 7. 恢复代码块
  codePlaceholders.forEach(({ placeholder, content }) => {
    processedStem = processedStem.replace(placeholder, content);
  });

  // 8. 处理填空题下划线样式
  processedStem = processedStem.replace(/_{3,}/g, '<span style="display: inline-block; min-width: 120rpx; text-align: center; border-bottom: 2rpx solid #333; margin: 0 8rpx;"></span>');

  // 9. 保护已渲染的 HTML 元素（公式、代码块、图片等），防止被段落分割破坏
  const renderedElements = [];
  // 保护代码块
  processedStem = processedStem.replace(/<div[^>]*>\s*<pre[\s\S]*?<\/pre>\s*<\/div>/gi, (match) => {
    const placeholder = `__RENDERED_ELEMENT_${renderedElements.length}__`;
    renderedElements.push({ placeholder, content: match });
    return placeholder;
  });
  // 保护公式（katex 渲染的 span）
  processedStem = processedStem.replace(/<span[^>]*class="katex[\s\S]*?<\/span>/gi, (match) => {
    const placeholder = `__RENDERED_ELEMENT_${renderedElements.length}__`;
    renderedElements.push({ placeholder, content: match });
    return placeholder;
  });
  // 保护图片
  processedStem = processedStem.replace(/<img[^>]*>/gi, (match) => {
    const placeholder = `__RENDERED_ELEMENT_${renderedElements.length}__`;
    renderedElements.push({ placeholder, content: match });
    return placeholder;
  });

  // 10. 处理段落换行：将连续的换行符转换为段落
  // 先标准化换行符
  processedStem = processedStem.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // 将多个连续换行符视为段落分隔
  const paragraphs = processedStem.split(/\n{2,}/).filter(p => p.trim());
  // 将单个换行符转换为 <br>
  const formattedParagraphs = paragraphs.map(p => {
    // 如果段落内部有单个换行，转为 <br>
    const withBr = p.replace(/\n/g, '<br>');
    return `<p style="margin: 0 0 2px 0; line-height: 1.6;">${withBr}</p>`;
  });
  
  let result = formattedParagraphs.join('');
  
  // 11. 恢复已渲染的 HTML 元素
  renderedElements.forEach(({ placeholder, content }) => {
    result = result.replace(placeholder, content);
  });
  
  return `<div style="text-align: justify; word-break: break-all; color: #333;">${result}</div>`;
};

/**
 * 计算填空数量
 * @param {string} stem 题干字符串
 * @returns {number} 填空数量
 */
export const countBlanks = (stem) => {
  if (!stem) return 0;
  const matches = stem.match(/_{3,}/g);
  return matches ? matches.length : 0;
};
