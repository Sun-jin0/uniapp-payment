# 数学题目处理工具

## 文件说明

| 序号 | 文件名 | 功能说明 |
|-----|-------|---------|
| 01 | `01_fix_math_content.js` | 修复数学题目内容格式（$$、HTML标签、LaTeX格式等） |
| 02 | `02_update_question_types.js` | 自动判断并更新题目题型（选择题/填空题/解答题） |
| - | `run_all.js` | 批量执行脚本，按顺序运行上述两个脚本 |

## 执行方法

### 方法1：批量执行（推荐）
```bash
cd f:\Code\uniapp\demo\backend\scripts\math_tools
node run_all.js
```

### 方法2：单独执行
```bash
cd f:\Code\uniapp\demo\backend\scripts\math_tools

# 先执行内容修复
node 01_fix_math_content.js

# 再执行题型更新
node 02_update_question_types.js
```

## 处理内容说明

### 01_fix_math_content.js - 内容格式修复
修复以下问题：
- `$$` → `$ $`
- `<` → `< `
- `.$png` → `.png`
- `$,$$` → `$,$ $`
- `$.$$` → `$.$ $`
- `< span` → `<span`
- `< /span>` → `</span>`
- `< br>` → `<br>`
- `< b>` → `<b>`
- `< /b>` → `</b>`

### 02_update_question_types.js - 题型判断规则
按优先级判断：

1. **选择题**：同时包含 A、B、C、D 四个选项
2. **填空题**：不是选择题，且包含以下任一特征
   - `\underline{...}` 下划线
   - `（ ）` 括号
   - `___` 下划线占位符
3. **解答题**：以上都不是

## 数据库配置

脚本使用以下数据库配置：
- Host: `139.199.9.132`
- Database: `quizmaster`
- 涉及表：`math_questions`, `math_questiondetails`, `math_knowledgepoints`

## 注意事项

1. 执行前请确保数据库连接正常
2. 建议先备份数据库再执行
3. 脚本执行顺序很重要，先修复内容再更新题型

按下面的格式处理题目内容：
《题型》……《/题型》（选择题、填空题、解答题三种）
《题目》……《/题目》
《答案》……《/答案》
《解析》……《/解析》
题目中的公式要进行修复，将$$包裹的公式替换为单个$包裹的公式(即不使用块级公式)。
“<”“>”小于大于号前后要加空格，替换为 ` < ` 和 ` > `。
**空格规范（重要）**：

大于号 `>` 和小于号 `<` 前后必须加空格，以提高可读性：

| 符号   | 正确写法         | 错误写法                |
| ---- | ------------ | ------------------- |
| 大于   | `$a > b$`    | `$a>b$`             |
| 小于   | `$x < y$`    | `$x<y$`             |
| 大于等于 | `$a \geq b$` | `$a\geq b$`（也建议加空格） |
| 小于等于 | `$x \leq y$` | `$x\leq y$`（也建议加空格） |
在公式中，以下符号使用 `\limits_` 可将上下标移到正上方/正下方：

| 符号      | 数据集示例                                                   |
| ------- | ------------------------------------------------------- |
| `\lim`  | `$\lim\limits_{x\to \infty}(\sqrt[3]{1-x^6}-ax^2-b)=0$` |
| `\sum`  | `$\sum\limits_{i=1}^n{X_i}$`                            |
| `\prod` | `$\prod\limits_{i=1}^n{f\left( x_i;\theta \right)}$`    |
| `\int`  | `$\int\limits_0^{+\infty}{\frac{x\ln x}{1 + x^4}\mathrm{d}x}$` |
| `\iint` | `$\iint\limits_D{f(x,y)\mathrm{d}x\mathrm{d}y}$`（二重积分） |
| `\iiint` | `$\iiint\limits_\Omega{f(x,y,z)\mathrm{d}x\mathrm{d}y\mathrm{d}z}$`（三重积分） |
| `\oint` | `$\oint\limits_L{P\mathrm{d}x+Q\mathrm{d}y}$`（封闭曲线积分） |
**数据集中的真实公式示例**：
