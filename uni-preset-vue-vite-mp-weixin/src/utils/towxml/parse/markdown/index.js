let hljs;
try {
    hljs = require('../highlight/index');
} catch(e) {
    hljs = null;
}

const config = require('../../config'),
    mdOption = (()=>{
        let result = {
            html: true,
            xhtmlOut: true,
            typographer: true,
            breaks: true,
        };

        if(config.highlight && config.highlight.length && hljs){
            result.highlight = (code,lang,callback)=>{
                let lineLen = code.split(/\r|\n/ig).length,
                    result = hljs.highlightAuto(code).value;

                    result = result.replace(/\r|\n/g,'<br/>').replace(/ /g,'&nbsp;').replace(/\t/g,'&nbsp;&nbsp;&nbsp;&nbsp;');

                if(config.showLineNumber){
                    let lineStr = (()=>{
                        let str = `<ul class="h2w__lineNum">`;
                        for(let i=0;i<lineLen-1;i++){
                            str += `<li class="h2w__lineNumLine">${i+1}</li>`
                        };

                        str += `</ul>`;
                        return str;
                    })();
                    return lineStr + result;
                };
                return result;
            }
        };
        return result;
    })(),
    md = require('./markdown')(mdOption);

// 定义简单的插件函数
const subPlugin = function(md) {
    md.inline.ruler.after('emphasis', 'sub', function(state, silent) {
        var found,
            content,
            token,
            max = state.posMax,
            start = state.pos;
        if (state.src.charCodeAt(start) !== 0x7E) { return false; }
        if (silent) { return false; }
        if (start + 2 >= max) { return false; }
        state.pos = start + 1;
        while (state.pos < max) {
            if (state.src.charCodeAt(state.pos) === 0x7E) {
                found = true;
                break;
            }
            state.md.inline.skipToken(state);
        }
        if (!found || start + 1 === state.pos) {
            state.pos = start;
            return false;
        }
        content = state.src.slice(start + 1, state.pos);
        if (content.match(/(^|[^\\])(\\\\)*\s/)) {
            state.pos = start;
            return false;
        }
        state.posMax = state.pos;
        state.pos = start + 1;
        token = state.push('sub_open', 'sub', 1);
        token.markup = '~';
        token = state.push('text', '', 0);
        token.content = content;
        token = state.push('sub_close', 'sub', -1);
        token.markup = '~';
        state.pos = state.posMax + 1;
        state.posMax = max;
        return true;
    });
};

const supPlugin = function(md) {
    md.inline.ruler.after('emphasis', 'sup', function(state, silent) {
        var found,
            content,
            token,
            max = state.posMax,
            start = state.pos;
        if (state.src.charCodeAt(start) !== 0x5E) { return false; }
        if (silent) { return false; }
        if (start + 2 >= max) { return false; }
        state.pos = start + 1;
        while (state.pos < max) {
            if (state.src.charCodeAt(state.pos) === 0x5E) {
                found = true;
                break;
            }
            state.md.inline.skipToken(state);
        }
        if (!found || start + 1 === state.pos) {
            state.pos = start;
            return false;
        }
        content = state.src.slice(start + 1, state.pos);
        if (content.match(/(^|[^\\])(\\\\)*\s/)) {
            state.pos = start;
            return false;
        }
        state.posMax = state.pos;
        state.pos = start + 1;
        token = state.push('sup_open', 'sup', 1);
        token.markup = '^';
        token = state.push('text', '', 0);
        token.content = content;
        token = state.push('sup_close', 'sup', -1);
        token.markup = '^';
        state.pos = state.posMax + 1;
        state.posMax = max;
        return true;
    });
};

const insPlugin = function(md) {
    md.inline.ruler.after('emphasis', 'ins', function(state, silent) {
        var found,
            content,
            token,
            max = state.posMax,
            start = state.pos;
        if (state.src.charCodeAt(start) !== 0x2B || state.src.charCodeAt(start + 1) !== 0x2B) { return false; }
        if (silent) { return false; }
        if (start + 3 >= max) { return false; }
        state.pos = start + 2;
        while (state.pos < max) {
            if (state.src.charCodeAt(state.pos) === 0x2B && state.src.charCodeAt(state.pos + 1) === 0x2B) {
                found = true;
                break;
            }
            state.md.inline.skipToken(state);
        }
        if (!found || start + 2 === state.pos) {
            state.pos = start;
            return false;
        }
        content = state.src.slice(start + 2, state.pos);
        state.posMax = state.pos;
        state.pos = start + 2;
        token = state.push('ins_open', 'ins', 1);
        token.markup = '++';
        token = state.push('text', '', 0);
        token.content = content;
        token = state.push('ins_close', 'ins', -1);
        token.markup = '++';
        state.pos = state.posMax + 2;
        state.posMax = max;
        return true;
    });
};

const markPlugin = function(md) {
    md.inline.ruler.after('emphasis', 'mark', function(state, silent) {
        var found,
            content,
            token,
            max = state.posMax,
            start = state.pos;
        if (state.src.charCodeAt(start) !== 0x3D || state.src.charCodeAt(start + 1) !== 0x3D) { return false; }
        if (silent) { return false; }
        if (start + 3 >= max) { return false; }
        state.pos = start + 2;
        while (state.pos < max) {
            if (state.src.charCodeAt(state.pos) === 0x3D && state.src.charCodeAt(state.pos + 1) === 0x3D) {
                found = true;
                break;
            }
            state.md.inline.skipToken(state);
        }
        if (!found || start + 2 === state.pos) {
            state.pos = start;
            return false;
        }
        content = state.src.slice(start + 2, state.pos);
        state.posMax = state.pos;
        state.pos = start + 2;
        token = state.push('mark_open', 'mark', 1);
        token.markup = '==';
        token = state.push('text', '', 0);
        token.content = content;
        token = state.push('mark_close', 'mark', -1);
        token.markup = '==';
        state.pos = state.posMax + 2;
        state.posMax = max;
        return true;
    });
};

// 简化的emoji插件
const emojiPlugin = function(md) {
    // 简化的emoji支持
    md.core.ruler.after('inline', 'emoji', function(state) {
        var tokens = state.tokens;
        for (var i = 0; i < tokens.length; i++) {
            if (tokens[i].type === 'inline') {
                var content = tokens[i].content;
                // 简单的emoji替换
                content = content.replace(/:([a-z0-9_+-]+):/g, function(match, name) {
                    return '<g-emoji class="h2w__emoji h2w__emoji--' + name + '">' + match + '</g-emoji>';
                });
                tokens[i].content = content;
            }
        }
    });
};

// 简化的todo插件
const todoPlugin = function(md) {
    md.inline.ruler.after('emphasis', 'todo', function(state, silent) {
        var token,
            max = state.posMax,
            start = state.pos;
        if (state.src.charCodeAt(start) !== 0x5B) { return false; }
        if (state.src.charCodeAt(start + 2) !== 0x5D) { return false; }
        var marker = state.src.charCodeAt(start + 1);
        if (marker !== 0x20 && marker !== 0x78) { return false; }
        if (silent) { return false; }
        state.pos = start + 3;
        token = state.push('todo_open', 'todo', 1);
        token.markup = marker === 0x78 ? '[x]' : '[ ]';
        token.checked = marker === 0x78;
        state.pos = start + 3;
        state.posMax = max;
        return true;
    });
};

// LaTeX公式插件
const latexPlugin = function(md) {
    // 匹配行内公式 $...$ 和 \(...\)
    md.inline.ruler.after('escape', 'latex_inline', function(state, silent) {
        var start = state.pos,
            max = state.posMax,
            marker, content, token;

        // 检查是否是 $ 或 \(
        if (state.src.charCodeAt(start) === 0x24) { // $
            marker = '$';
            start++;
        } else if (state.src.charCodeAt(start) === 0x5C && state.src.charCodeAt(start + 1) === 0x28) { // \(
            marker = '\\(';
            start += 2;
        } else {
            return false;
        }

        if (silent) return false;

        // 查找结束标记
        var endMarker = marker === '$' ? '$' : '\\)';
        var end = state.src.indexOf(endMarker, start);
        if (end === -1) return false;

        content = state.src.slice(start, end);
        if (!content) return false;

        // 创建 latex token
        token = state.push('latex_inline', 'latex', 0);
        token.content = content;
        token.markup = marker;

        state.pos = end + endMarker.length;
        return true;
    });

    // 匹配块级公式 $$...$$ 和 \[...\]
    md.block.ruler.after('blockquote', 'latex_block', function(state, startLine, endLine, silent) {
        var start = state.bMarks[startLine] + state.tShift[startLine],
            max = state.eMarks[startLine],
            marker, content, token;

        // 检查是否是 $$ 或 \[
        var lineText = state.src.slice(start, max);
        if (lineText.slice(0, 2) === '$$') {
            marker = '$$';
        } else if (lineText.slice(0, 2) === '\\[') {
            marker = '\\[';
        } else {
            return false;
        }

        if (silent) return false;

        // 查找结束行
        var endMarker = marker === '$$' ? '$$' : '\\]';
        var nextLine = startLine + 1;
        var found = false;
        var lines = [lineText.slice(marker.length)];

        while (nextLine < endLine) {
            var nextLineText = state.src.slice(state.bMarks[nextLine], state.eMarks[nextLine]);
            var endPos = nextLineText.indexOf(endMarker);
            if (endPos !== -1) {
                lines.push(nextLineText.slice(0, endPos));
                found = true;
                break;
            }
            lines.push(nextLineText);
            nextLine++;
        }

        if (!found) return false;

        content = lines.join('\n');

        // 创建 latex token
        token = state.push('latex_block', 'latex', 0);
        token.content = content;
        token.markup = marker;
        token.block = true;

        state.line = nextLine + 1;
        return true;
    });
};

// 插件映射表
const plugins = {
    'sub': subPlugin,
    'sup': supPlugin,
    'ins': insPlugin,
    'mark': markPlugin,
    'emoji': emojiPlugin,
    'todo': todoPlugin,
    'latex': latexPlugin
};

// 应用Markdown解析扩展
if (config.markdown && Array.isArray(config.markdown)) {
    config.markdown.forEach(item => {
        if (plugins[item]) {
            md.use(plugins[item]);
        }
    });
}

// 定义emoji渲染规则
md.renderer.rules.emoji = function(token, index) {
    var item = token[index];
    return '<g-emoji class="h2w__emoji h2w__emoji--' + item.markup + '">' + item.content + '</g-emoji>';
};

// 定义LaTeX渲染规则
md.renderer.rules.latex_inline = function(tokens, idx) {
    return '<latex value="' + encodeURIComponent(tokens[idx].content).replace(/'/g, '%27') + '" type="line"></latex>';
};

md.renderer.rules.latex_block = function(tokens, idx) {
    return '<latex value="' + encodeURIComponent(tokens[idx].content).replace(/'/g, '%27') + '" type="block"></latex>';
};

// 导出模块
module.exports = function(str) {
    return md.render(str);
};
