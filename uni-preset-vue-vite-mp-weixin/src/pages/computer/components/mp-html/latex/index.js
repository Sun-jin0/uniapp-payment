/**
 * @fileoverview latex 插件
 * katex.min.js来源 https://github.com/rojer95/katex-mini
 */
import parse  from './katex.min'

function Latex () {

}

Latex.prototype.onParse = function (node, vm) {
  // $...$ 或 \(...\) 包裹的内容为latex公式
  if (!vm.options.editable && node.type === 'text' && (node.text.includes('$') || node.text.includes('\\(') || node.text.includes('\\['))) {
    // 修复常见的 LaTeX 语法问题
    let text = node.text
    // 修复 \left{ 和 \right} 为 \left\{ 和 \right\}
    // 注意：在 JavaScript 字符串中，\\ 表示一个反斜杠
    text = text.replace(/\\left\{/g, '\\left\\{')
    text = text.replace(/\\right\}/g, '\\right\\}')
    // 修复其他常见的语法问题
    text = text.replace(/\\left\(/g, '\\left(')
    text = text.replace(/\\right\)/g, '\\right)')
    text = text.replace(/\\left\[/g, '\\left[')
    text = text.replace(/\\right\]/g, '\\right]')
    text = text.replace(/\\left\|/g, '\\left|')
    text = text.replace(/\\right\|/g, '\\right|')
    
    const children = []
    let lastIndex = 0
    
    // 使用正则表达式匹配 $$...$$、$...$、\[...\] 和 \(...\)
    // 先匹配块级公式，再匹配行内公式
    // 注意：\(...\) 使用非贪婪匹配，但需要处理嵌套括号
    const regex = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\$([^\$\n]*?)\$|\\\(([\s\S]*?)\\\)/g
    let match
    
    while ((match = regex.exec(text)) !== null) {
      // 添加匹配前的文本
      if (match.index > lastIndex) {
        children.push({
          type: 'text',
          text: text.substring(lastIndex, match.index)
        })
      }
      
      if (match[1] !== undefined) {
        // 块公式 $$...$$
        try {
          const formula = match[1].trim()
          const nodes = parse.default(formula, {
            displayMode: true,
            strict: false
          })
          children.push({
            name: 'div',
            attrs: {
              style: 'text-align:center;margin:10px 0;'
            },
            children: nodes
          })
        } catch (e) {
          // 解析失败，显示原始文本
          children.push({
            type: 'text',
            text: match[0]
          })
        }
      } else if (match[2] !== undefined) {
        // 块公式 \[...\]
        try {
          const formula = match[2].trim()
          const nodes = parse.default(formula, {
            displayMode: true,
            strict: false
          })
          children.push({
            name: 'div',
            attrs: {
              style: 'text-align:center;margin:10px 0;'
            },
            children: nodes
          })
        } catch (e) {
          // 解析失败，显示原始文本
          children.push({
            type: 'text',
            text: match[0]
          })
        }
      } else if (match[3] !== undefined) {
        // 行内公式 $...$
        try {
          const formula = match[3].trim()
          const nodes = parse.default(formula, {
            strict: false
          })
          children.push({
            name: 'span',
            attrs: {},
            l: 'T',
            f: 'display:inline;word-wrap:break-word;white-space:normal;vertical-align:middle;',
            children: nodes
          })
        } catch (e) {
          // 解析失败，显示原始文本
          children.push({
            type: 'text',
            text: match[0]
          })
        }
      } else if (match[4] !== undefined) {
        // 行内公式 \(...\)
        try {
          const formula = match[4].trim()
          const nodes = parse.default(formula, {
            strict: false
          })
          children.push({
            name: 'span',
            attrs: {},
            l: 'T',
            f: 'display:inline;word-wrap:break-word;white-space:normal;vertical-align:middle;',
            children: nodes
          })
        } catch (e) {
          // 解析失败，显示原始文本
          children.push({
            type: 'text',
            text: match[0]
          })
        }
      }
      
      lastIndex = match.index + match[0].length
    }
    
    // 添加剩余的文本
    if (lastIndex < text.length) {
      children.push({
        type: 'text',
        text: text.substring(lastIndex)
      })
    }
    
    // 如果有公式被解析，替换当前节点
    if (children.length > 0) {
      delete node.type
      delete node.text
      node.name = 'span'
      node.attrs = {}
      node.children = children
    }
  }
}

export default Latex
