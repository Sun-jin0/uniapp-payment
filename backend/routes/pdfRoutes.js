const express = require('express');
const router = express.Router();
const mysqlPool = require('../config/mysql');

/**
 * 获取试卷列表
 * GET /api/pdf/papers
 */
router.get('/papers', async (req, res) => {
    try {
        // 查询智能组卷表
        const [papers] = await mysqlPool.query(
            `SELECT PaperID, PaperName, PrintToken 
             FROM math_generated_papers 
             ORDER BY PaperID DESC 
             LIMIT 50`
        );
        
        res.json({
            code: 200,
            data: papers
        });
    } catch (error) {
        console.error('获取试卷列表失败:', error);
        res.status(500).json({ code: 500, error: '获取试卷列表失败' });
    }
});

/**
 * 生成试卷 PDF
 * GET /api/pdf/paper/:paperId
 */
router.get('/paper/:paperId', async (req, res) => {
    try {
        const { paperId } = req.params;
        
        // 获取试卷信息
        const [papers] = await mysqlPool.query(
            'SELECT * FROM math_papers WHERE PaperID = ?',
            [paperId]
        );
        
        if (papers.length === 0) {
            return res.status(404).json({ error: '试卷不存在' });
        }
        
        const paper = papers[0];
        
        // 获取试卷题目
        const [questions] = await mysqlPool.query(
            `SELECT q.*, bq.QuestionImg 
             FROM math_paper_questions pq
             JOIN math_questions q ON pq.QuestionID = q.QuestionID
             LEFT JOIN bus_question bq ON q.QuestionID = bq.QuestionID
             WHERE pq.PaperID = ?
             ORDER BY pq.SortOrder`,
            [paperId]
        );
        
        // 生成 HTML
        const html = generatePaperHTML(paper, questions);
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
        
    } catch (error) {
        console.error('生成 PDF 失败:', error);
        res.status(500).json({ error: '生成 PDF 失败' });
    }
});

/**
 * 生成试卷 HTML
 */
function generatePaperHTML(paper, questions) {
    const paperTitle = paper.PaperName || '数学试卷';
    
    // 按题型分组
    const groups = {};
    const typeOrder = [];
    questions.forEach(q => {
        const type = q.QuestionType || '其他题型';
        if (!groups[type]) {
            groups[type] = [];
            typeOrder.push(type);
        }
        groups[type].push(q);
    });
    
    const chineseNums = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    
    let questionsHTML = '';
    let globalIndex = 1;
    
    typeOrder.forEach((type, typeIndex) => {
        questionsHTML += `<div class="section-header">${chineseNums[typeIndex] || (typeIndex + 1)}、${type}</div>`;
        
        groups[type].forEach(q => {
            questionsHTML += `
                <div class="question-item">
                    <div class="question-header">
                        <span>${globalIndex}.</span>
                    </div>
                    <div class="question-body">
                        ${transformText(q.QuestionText || '')}
                    </div>
                    ${q.QuestionImg ? `<div class="question-image">${transformText(q.QuestionImg)}</div>` : ''}
                </div>
            `;
            globalIndex++;
        });
    });
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>${paperTitle}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"><\/script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"><\/script>
    <style>
        :root {
            --page-width: 210mm;
            --page-height: 297mm;
            --page-margin-top: 20mm;
            --page-margin-bottom: 20mm;
            --page-margin-sides: 25mm;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: "Times New Roman", Times, serif, "SimSun", "STSong", serif;
            font-size: 12pt;
            line-height: 1.8;
            color: #333;
        }

        /* 打印样式 - 关键：控制分页 */
        @media print {
            body {
                background: white;
            }
            
            .page {
                margin: 0 !important;
                box-shadow: none !important;
                page-break-after: always;
                break-after: page;
            }
            
            .page:last-child {
                page-break-after: auto;
                break-after: auto;
            }
            
            @page {
                size: A4;
                margin: var(--page-margin-top) var(--page-margin-sides) var(--page-margin-bottom);
            }
            
            /* 防止题目被分页截断 */
            .question-item {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            
            /* 题型标题后不要分页 */
            .section-header {
                page-break-after: avoid;
                break-after: avoid;
            }
        }

        /* 预览样式 */
        .page {
            width: var(--page-width);
            min-height: var(--page-height);
            margin: 20px auto;
            padding: var(--page-margin-top) var(--page-margin-sides) var(--page-margin-bottom);
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        .paper-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #333;
        }

        .paper-title {
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .paper-info {
            font-size: 10pt;
            color: #666;
        }

        .section-header {
            font-size: 14pt;
            font-weight: bold;
            margin: 25px 0 15px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #333;
        }

        .question-item {
            margin-bottom: 20px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .question-header {
            font-weight: bold;
            margin-bottom: 8px;
        }

        .question-body {
            line-height: 1.8;
        }

        .question-body p {
            margin: 0.5em 0;
        }

        .question-image {
            margin: 10px 0;
        }

        .question-image img {
            max-width: 100%;
            height: auto;
        }

        /* KaTeX 样式 */
        .katex-display {
            margin: 1em 0;
            overflow-x: auto;
        }

        .katex {
            font-size: 1.1em;
        }

        /* 打印按钮 */
        .print-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #5DADE2;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            z-index: 1000;
        }

        .print-btn:hover {
            background: #3498db;
        }

        @media print {
            .print-btn {
                display: none;
            }
        }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">打印 / 导出 PDF</button>
    
    <div class="page">
        <div class="paper-header">
            <div class="paper-title">${paperTitle}</div>
            <div class="paper-info">题目数量：${questions.length} 道</div>
        </div>
        
        ${questionsHTML}
    </div>

    <script>
        // 渲染 KaTeX
        document.addEventListener('DOMContentLoaded', function() {
            if (typeof renderMathInElement !== 'undefined') {
                renderMathInElement(document.body, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\\\[', right: '\\\\]', display: true},
                        {left: '\\\\(', right: '\\\\)', display: false}
                    ],
                    throwOnError: false
                });
            }
        });
    <\/script>
</body>
</html>`;
}

/**
 * 转换文本（处理图片、公式等）
 */
function transformText(text) {
    if (!text) return '';
    
    let content = text.trim()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // 处理图片 URL
    content = content.replace(/(https?:\/\/[^\s<>"]+?\.(?:png|jpg|jpeg|gif|webp))(?:_[a-zA-Z0-9]+)?/gi, function(match, url) {
        return '<img src="' + url + '" style="max-width:100%;height:auto;display:block;margin:5px 0;" alt="题目图片" />';
    });
    
    // 处理 LaTeX 公式标记
    content = content.replace(/\\\[/g, '$$');
    content = content.replace(/\\\]/g, '$$');
    content = content.replace(/\\\(/g, '$');
    content = content.replace(/\\\)/g, '$');
    
    // 处理 Markdown 粗体和斜体
    content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // 处理换行
    content = content.replace(/\n/g, '<br>');
    
    return content;
}

module.exports = router;
