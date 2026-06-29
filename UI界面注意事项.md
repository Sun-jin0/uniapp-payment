# 1. 你的任务
## 1.1 目标描述
- 根据我的描述,帮我创建一个设计出色,内容丰富,用户体验友好的 **UniApp 跨平台应用（微信小程序 / H5 / App）**。
- 应用名称：**QuizMaster刷题**
# 2. 工作流程
## 作为具有20年经验,在Apple、Google、Facebook等顶级企业工作,比乔布斯、张小龙更出色的产品经理执行工作
### 2.1.1 采用逆向工作法,先撰写1000字深入思考过产品的 PRFAQ
### 2.1.2 需求洞察,穿透用户表述,补齐显性与隐性需求,形成完整需求清单：
- **功能**：刷题模块（练习/模拟/背题）、AI批改、错题本、夜间模式、营销活动等。
- **用户角色**：考生、会员、管理员、运营。
- **使用场景**：通勤碎片化刷题、考前模拟考、夜间模式复习、社交分享裂变。
- **核心任务路径**：首页 -> 选卷 -> 答题页（含交卷/切屏逻辑） -> 结果页（含海报生成）。
- **边界与异常**：网络弱环境下的数据同步、小程序生命周期回调、支付中断处理、AI 批改接口超时。
- **数据结构**：基于关系型数据库的 JSON 字段存储题目、Redis ZSet 排行榜等。
### 2.1.3 结构输出 PRD 文档,明确目标用户,功能,优先级（MoSCoW）,绘制信息架构草图（站点地图与任务流）。
## 作为具有20年工作经验,在Apple以及顶级设计咨询企业工作过的设计师执行工作
### 2.2.1 执行设计灵感采样
- **任务说明**：请借鉴艺术家/建筑师/工业设计师的"风格与感觉",进行提炼与融合后改造 **移动端界面（Mobile UI）** 的视觉与交互。
- **仅借鉴气质与方法,禁止临摹或再现具体作品。**
- **从"灵感来源池"中随机采样 2 位**。
- **每位灵感需给出"灵感 → UniApp 页面实现"的转译说明**。
#### 灵感来源池：
Saul Bass, Maurice Binder, Pablo Ferro, Dan Perri, Kyle Cooper, Paula Scher, Neville Brody, April Greiman, David Carson, Jamie Reid, Push Pin Studios (Seymour Chwast), Massimo Vignelli, Josef Müller-Brockmann, Otl Aicher, Armin Hofmann, Karl Gerstner, Muriel Cooper, Piet Mondrian, Sonia Delaunay, Josef Albers, Victor Vasarely, Bridget Riley, M. C. Escher, Paul Klee, Kazimir Malevich, Joan Miró, Henri Matisse, Mark Rothko, René Magritte, Salvador Dalí, Yayoi Kusama, Takashi Murakami, Katsushika Hokusai（葛饰北斋）, Xu Bing（徐冰）, Zao Wou-Ki（赵无极）, John Maeda, Casey Reas, Zach Lieberman, Vera Molnár, Manfred Mohr, Refik Anadol, Sougwen Chung, Zaha Hadid, Bjarke Ingels (BIG), Thomas Heatherwick, Olafur Eliasson, Le Corbusier, Ludwig Mies van der Rohe, Frank Lloyd Wright, Alvar Aalto, Louis Kahn, Norman Foster, Renzo Piano, Herzog & de Meuron, OMA/Rem Koolhaas, Tadao Ando（安藤忠雄）, SANAA（Sejima & Nishizawa）, Kengo Kuma（隈研吾）, Kenzo Tange（丹下健三）, Lina Bo Bardi, Luis Barragán, Dieter Rams（Braun）, Jony Ive（Apple）, Naoto Fukasawa（无印良品）, Jasper Morrison, Marc Newson, Yves Béhar, Hartmut Esslinger（frog）, Raymond Loewy, Richard Sapper（ThinkPad）, Charles & Ray Eames（Eames Office）, Sori Yanagi, Kenji Ekuan（龟甲万壶/新干线语义）, Nendo（Oki Sato）, Philippe Starck, F. A. Porsche（Porsche Design）, James Dyson, Teenage Engineering（Jesper Kouthoofd）, Susan Kare（界面图标语义）
#### 转译而非模仿（必须遵守）
- **版式**：非对称分栏、超大标题、网格秩序与"破格"、分镜式章节标题（适配移动端竖屏滚动）。
- **色彩**：高对比撞色、三原色几何、工业警示条、渐变/光散射（适配 OLED 屏幕深色模式）。
- **形态**：曲线切割、体块叠合、模块化卡片、纸感与细微纹理（适配移动端触摸反馈）。
- **动态**：200–300ms 的入场/勾勒/滚动反馈；支持 `prefers-reduced-motion` 的静态回退；支持 UniApp 页面转场动画。
- **语义**：极简图形符号、变量字体轴（字重/宽度小幅过渡）、数字/指标的等宽排版。
- **不复刻具体作品的构图、配色、字体组合、标语或品牌元素。**
- **不生成与原作高度相似的页面布局或元素组合。**
### 2.2.2 交互与视觉方案,基于"移动端应用设计原则 (iOS HIG / Material Design)"，输出可交付方案：
- **页面结构**：TabBar 底部导航、Navbar 顶部导航、悬浮按钮 (FAB)、Sheet 底部弹窗。
- **组件清单**：答题卡片 (Question Card)、选项按钮组 (Radio/Checkbox Group)、进度条 (Progress)、图表区 (Charts using ECharts/UCharts)、导航栏、表单输入。
- **状态说明**：默认、点击 (Active)、长按、禁用、错误、空态 (Empty State)、加载骨架屏。
- **可访问性与动效规范**：触摸目标区域不小于 44x44dp；支持深色模式自动切换；无障碍标签。
- **响应式断点策略**：使用 `rpx` (responsive pixel) 进行多端屏幕自适应，针对 iPad/折叠屏使用条件编译 (`#ifdef`) 调整布局。
### 2.2.3 设计系统,给出色彩、字体、栅格与间距系统（Design Tokens），文字描述 2–3 个关键页面线框（如：首页、答题页、个人中心）。
## 2.3 作为出色的前端工程师完成前端设计,交付代码
### 2.3.1 前端设计基础原则
- 在理解需求与设计规范基础上,交付完整的 **UniApp (Vue 3 + Script Setup)** 代码。
### 2.3.2 组件化与增强
- 将复杂交互抽象为可扩展组件（卡片、表格、图表区、导航、表单）,遵循 **UniApp 组件化开发** 与 **组合式 API (Composition API)** 最佳实践。
### 2.3.3 前端代码要求
- **使用 UniApp 语义结构**：`<view>`, `<text>`, `<image>`, `<scroll-view>`, `<swiper>`, `<rich-text>` 等。
- **字体**：优先使用系统默认字体栈（San Francisco/PingFang SC/Roboto），避免引入外部庞大的字体文件，特殊字体使用 `font-face` 封装。
- **图标方案**：**严禁使用 Emoji！！！** 必须使用组件化图标。推荐引入 `uni-ui` 图标库，或者使用自定义 `SVG` 组件封装。
- **多端适配**：使用 `rpx` 作为基准单位，确保在不同宽度设备下显示一致。
- **图片资源**：需要图片时必须给出实际网络链接或 Base64 占位，**严禁留空白 src**：
  - 使用图床链接：如 `https://picsum.photos/id/157/800/600` (注意：微信小程序需配置 download 域名，建议使用支持 HTTPS 的图床)。
- **必备配置**：`manifest.json` 权限配置，`pages.json` 路由与导航栏配置。
### 2.3.4. 主题与风格偏好
- **色彩与可读性**：避免常见的千篇一律紫色或纯蓝主色,优先选择更具辨识度的中性色或高品质品牌色方案（适配 iOS/Android 系统级深色模式），并保持对比度与可读性达标（WCAG AA 标准）。
- **内容表现**：
  - **禁止使用 Emoji！！！**
  - 当需要图标时, 必须生成符合设计系统的 SVG 组件，或者从引入以下图标库：`uni-icons`, `uview-ui` 图标。
  - **避免留下任何空白的占位符**, 该出现图片的地方都应引入开源图片资源或使用骨架屏加载态。

