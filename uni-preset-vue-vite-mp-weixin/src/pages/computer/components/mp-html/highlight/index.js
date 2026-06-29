/**
 * @fileoverview highlight 插件
 * Include prismjs (https://prismjs.com)
 */
import prism  from './prism.min.js'
import config  from './config'
import Parser  from '../parser'

function Highlight (vm) {
  this.vm = vm
}

Highlight.prototype.onParse = function (node, vm) {
  if (node.name === 'pre') {
    if (vm.options.editable) {
      node.attrs.class = (node.attrs.class || '') + ' hl-pre'
      return
    }
    let i
    for (i = node.children.length; i--;) {
      if (node.children[i].name === 'code') break
    }
    if (i === -1) return
    const code = node.children[i]
    let className = code.attrs.class + ' ' + node.attrs.class
    i = className.indexOf('language-')
    if (i === -1) {
      i = className.indexOf('lang-')
      if (i === -1) {
        className = 'language-text'
        i = 9
      } else {
        i += 5
      }
    } else {
      i += 9
    }
    let j
    for (j = i; j < className.length; j++) {
      if (className[j] === ' ') break
    }
    const lang = className.substring(i, j)
    if (code.children.length) {
      const text = this.vm.getText(code.children).replace(/&amp;/g, '&').replace(/\n+$/, '')
      if (!text) return
      if (node.c) {
        node.c = undefined
      }
      // #ifdef H5
      // H5端使用prism进行语法高亮
      if (prism.languages[lang]) {
        code.children = (new Parser(this.vm).parse(
          // 加一层 pre 保留空白符
          '<pre>' + prism.highlight(text, prism.languages[lang], lang).replace(/token /g, 'hl-') + '</pre>'))[0].children
      } else {
        // 没有高亮时，将文本包装在 span 中并设置为黑色
        code.children = [{
          type: 'text',
          text: text
        }]
      }
      // #endif
      // #ifndef H5
      // 非H5端（微信小程序等）不进行语法高亮，只保留代码文本
      code.children = [{
        type: 'text',
        text: text
      }]
      // #endif
      node.attrs.class = 'hl-pre'
      node.attrs.style = 'background-color:#f0f9f8;padding:10px;border-radius:4px;white-space:pre-wrap;border:1px solid #5FBDB5;'
      code.attrs.class = 'hl-code'
      code.attrs.style = 'color:#000000;font-weight:500;'
      if (config.showLanguageName) {
        node.children.push({
          name: 'div',
          attrs: {
            class: 'hl-language',
            style: 'user-select:none'
          },
          children: [{
            type: 'text',
            text: lang
          }]
        })
      }
      if (config.copyByLongPress) {
        node.attrs.style += (node.attrs.style || '') + ';user-select:none'
        node.attrs['data-content'] = text
        vm.expose()
      }
      if (config.showLineNumber) {
        const line = text.split('\n').length; const children = []
        for (let k = line; k--;) {
          children.push({
            name: 'span',
            attrs: {
              class: 'span'
            }
          })
        }
        node.children.push({
          name: 'span',
          attrs: {
            class: 'line-numbers-rows'
          },
          children
        })
      }
    }
  }
}

export default Highlight
