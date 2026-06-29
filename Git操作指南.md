# Git 操作指南

## 本地环境信息

- **Git 安装路径**: `D:\Downloads\Git`
- **项目路径**: `F:\Code\uniapp\demo`
- **GitHub 仓库**: `https://github.com/Sun-jin0/uniapp.git`

---

## 一、本地更新 GitHub（Windows）

### 1. 进入项目目录
```powershell
cd F:\Code\uniapp\demo
```

### 2. 查看当前状态
```powershell
D:\Downloads\Git\bin\git.exe status
```

### 3. 添加修改的文件到暂存区
```powershell
# 添加所有修改的文件
D:\Downloads\Git\bin\git.exe add .

# 或者添加指定文件
D:\Downloads\Git\bin\git.exe add backend/admin-panel/src/App.vue
D:\Downloads\Git\bin\git.exe add uni-preset-vue-vite/src/pages/index/index.vue
```

### 4. 提交更改
```powershell
D:\Downloads\Git\bin\git.exe commit -m '提交说明'
```

**常用提交说明格式**:
- `feat: 添加新功能`
- `fix: 修复bug`
- `docs: 更新文档`
- `style: 代码格式调整`
- `refactor: 代码重构`
- `chore: 其他修改`

### 5. 推送到 GitHub
```powershell
D:\Downloads\Git\bin\git.exe push origin main
```

### 6. 完整的更新流程（一键执行）
```powershell
cd F:\Code\uniapp\demo
D:\Downloads\Git\bin\git.exe add .
D:\Downloads\Git\bin\git.exe commit -m 'update: 更新内容'
D:\Downloads\Git\bin\git.exe push origin main
```

---

## 二、服务器拉取最新代码（Linux）

### 1. 进入项目目录
```bash
cd /www/wwwroot/uniapp
```

### 2. 拉取最新代码
```bash
git pull origin main
```

### 3. 如果本地有修改，先暂存再拉取
```bash
# 暂存本地修改
git stash

# 拉取最新代码
git pull origin main

# 恢复本地修改
git stash pop
```

### 4. 强制拉取（覆盖本地修改，慎用）
```bash
git fetch origin
git reset --hard origin/main
```

---

## 三、服务器更新后操作

### 1. 更新后端依赖（如有新增）
```bash
cd /www/wwwroot/uniapp/backend
npm install
```

### 2. 重启后端服务
```bash
# 如果使用 PM2
pm2 restart uniapp-backend

# 或者手动重启
pm2 stop uniapp-backend
pm2 start app.js --name "uniapp-backend"
```

### 3. 更新管理员后台（如修改了前端代码）
```bash
cd /www/wwwroot/uniapp/backend
npm run admin:build
```

### 4. 完整的更新流程（服务器端）
```bash
cd /www/wwwroot/uniapp
git pull origin main
cd backend
npm install
npm run admin:build
pm2 restart uniapp-backend
```

### 5. 前端小程序项目部署（H5 模式）
```bash
# 1. 进入前端项目目录
cd /www/wwwroot/uniapp/uni-preset-vue-vite-mp-weixin

# 2. 安装依赖（首次或 package.json 变更后需要）
npm install

# 3. 构建 H5 版本
npm run build:h5

# 4. 使用 serve 启动（需先安装：npm install -g serve）
cd dist/build/h5
serve -p 8080

# 或使用 nohup 后台运行
nohup serve -p 8080 > h5.log 2>&1 &
```

### 6. 完整的服务器部署流程（后端 + 前端）
```bash
# ===== 1. 更新代码 =====
cd /www/wwwroot/uniapp
git pull origin main

# ===== 2. 部署后端 =====
cd backend
npm install
npm run admin:build
pm2 restart uniapp-backend

# ===== 3. 部署前端 H5 =====
cd /www/wwwroot/uniapp/uni-preset-vue-vite-mp-weixin
npm install
npm run build:h5

# 启动 H5（如果已运行，先停止之前的进程）
pkill -f "serve -p 8080" 2>/dev/null
cd dist/build/h5
nohup serve -p 8080 > h5.log 2>&1 &

echo "部署完成！"
echo "后端 API: http://your-server-ip:3000"
echo "前端 H5: http://your-server-ip:8080"
```

### 7. 使用域名访问 H5（Nginx 配置）
```bash
# 1. 编辑 Nginx 配置文件
vim /www/server/panel/vhost/nginx/yizhancs.cn.conf

# 2. 添加以下配置（在 server 块中）
server {
    listen 80;
    server_name h5.yizhancs.cn;  # 你的 H5 域名
    
    # 或者使用子路径方式
    location /h5 {
        alias /www/wwwroot/uniapp/uni-preset-vue-vite-mp-weixin/dist/build/h5;
        index index.html;
        try_files $uri $uri/ /h5/index.html;
    }
    
    # 根路径方式（推荐）
    location / {
        root /www/wwwroot/uniapp/uni-preset-vue-vite-mp-weixin/dist/build/h5;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}

# 3. 测试配置
nginx -t

# 4. 重载 Nginx
nginx -s reload

# 5. 配置 HTTPS（使用宝塔面板或 certbot）
# 宝塔面板：网站 -> 设置 -> SSL -> Let's Encrypt
certbot --nginx -d h5.yizhancs.cn
```

### 8. 域名解析设置
```
# 在域名服务商处添加 A 记录
类型: A
主机记录: h5          # 子域名，如 h5.yizhancs.cn
记录值: 10.1.0.7      # 你的服务器IP
TTL: 600

# 或者使用主域名
类型: A
主机记录: @           # 主域名
记录值: 10.1.0.7
TTL: 600
```

### 9. 完整的域名部署流程
```bash
# 1. 构建 H5
cd /www/wwwroot/uniapp/uni-preset-vue-vite-mp-weixin
npm run build:h5

# 2. 复制到网站目录（可选，也可以直接用构建目录）
cp -r dist/build/h5/* /www/wwwroot/h5.yizhancs.cn/

# 3. 配置 Nginx（参考上面的配置）

# 4. 重启 Nginx
nginx -s reload

# 访问地址：
# https://h5.yizhancs.cn
# 或 https://yizhancs.cn/h5
```

---

## 四、常见问题

### 1. 推送失败 - 权限不足
```bash
# 检查远程仓库地址
git remote -v

# 如果使用的是 HTTPS，需要输入用户名和密码（或 Token）
# 建议使用 Personal Access Token 代替密码
```

### 2. 拉取失败 - 本地有冲突
```bash
# 查看冲突文件
git status

# 放弃本地修改，使用远程版本
git checkout -- <文件名>

# 然后重新拉取
git pull origin main
```

### 3. 提交前查看修改内容
```powershell
D:\Downloads\Git\bin\git.exe diff
```

### 4. 查看提交历史
```powershell
D:\Downloads\Git\bin\git.exe log --oneline -10
```

---

## 五、快捷命令（可添加到环境变量）

### Windows 添加 Git 到环境变量
1. 右键"此电脑" → 属性 → 高级系统设置
2. 环境变量 → Path → 编辑
3. 添加: `D:\Downloads\Git\bin`
4. 确定保存

### 添加后可直接使用
```powershell
git status
git add .
git commit -m 'update'
git push origin main
```

---

## 六、微信小程序项目启动（服务器预览）

### 1. 进入微信小程序项目目录
```bash
cd /www/wwwroot/uniapp/uni-preset-vue-vite-mp-weixin
```

### 2. 安装依赖
```bash
npm install
```

### 3. 启动 H5 预览模式（用于服务器访问）
```bash
# 进入项目目录
cd /www/wwwroot/uniapp/uni-preset-vue-vite-mp-weixin

# 方式一：启动开发服务器（H5模式）
npm run dev:h5

# 方式二：构建 H5 生产版本
npm run build:h5
```

### 4. 使用 serve 部署 H5 版本
```bash
# 全局安装 serve（如未安装）
npm install -g serve

# 构建 H5 版本
npm run build:h5

# 启动 H5 预览
cd /www/wwwroot/uniapp/uni-preset-vue-vite-mp-weixin/dist/build/h5
serve -p 8080

# 或使用 PM2 管理
pm2 serve /www/wwwroot/uniapp/uni-preset-vue-vite-mp-weixin/dist/build/h5 8080 --name "uniapp-h5"
```

### 5. 完整的 H5 部署流程（服务器端）
```bash
# 1. 拉取最新代码
cd /www/wwwroot/uniapp
git pull origin main

# 2. 进入小程序项目目录
cd /www/wwwroot/uniapp/uni-preset-vue-vite-mp-weixin

# 3. 安装依赖
npm install

# 4. 构建 H5 版本
npm run build:h5

# 5. 使用 serve 启动（如已安装）
cd dist/build/h5
serve -p 8080

# 或使用 nohup 后台运行
nohup serve -p 8080 > h5.log 2>&1 &
```

### 6. 使用 Nginx 部署 H5（推荐生产环境）
```bash
# 1. 构建 H5 版本
npm run build:h5

# 2. 复制到 Nginx 目录
cp -r dist/build/h5/* /www/wwwroot/h5/

# 3. Nginx 配置示例
server {
    listen 80;
    server_name your-domain.com;
    root /www/wwwroot/h5;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 5. 微信小程序项目完整部署流程
```bash
# 1. 拉取最新代码
cd /www/wwwroot/uniapp
git pull origin main

# 2. 进入微信小程序项目
cd uni-preset-vue-vite-mp-weixin

# 3. 安装依赖
npm install

# 4. 构建 H5 版本
npm run build:h5

# 5. 使用 PM2 启动服务
pm2 delete uniapp-h5 2>/dev/null
pm2 serve dist/build/h5 8080 --name "uniapp-h5"

# 6. 查看运行状态
pm2 status
```

### 6. Nginx 反向代理配置（可选）
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**注意**：微信小程序项目主要是为微信小程序开发的，服务器上只能以 H5 模式运行。如需在微信开发者工具中预览，需要在本地 Windows/Mac 环境下运行 `npm run dev:mp-weixin`。

---

## 七、WebHook 自动部署（进阶）

配置 WebHook 后，GitHub 推送代码时服务器自动更新：

### 1. 在 GitHub 仓库设置 WebHook
- URL: `http://你的服务器IP:3000/webhook`
- Content type: `application/json`
- Secret: 设置一个密钥

### 2. 服务器端配置 WebHook 服务
参考文档: `https://github.com/adnanh/webhook`

---

**最后更新**: 2026-02-27

math_questions，math_questiondetails，math_knowledgepoints请你写一个脚本来修改这三个表中的内容，将“<”改为“ <”，将“.$png”改为“.png”,将“$,$$”改为“$,$ $”，将“$.$$”改为“$.$ $”