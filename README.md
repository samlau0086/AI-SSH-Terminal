# AI SSH Terminal

AI-powered modern Web SSH Terminal with Gemini integration, session management, quick commands, file management, and system monitoring.

## 🌟 功能特性 (Features)

- **AI 赋能终端**: 集成 Google Gemini AI，你可以直接通过自然语言让 AI 分析系统日志、提供排障建议或生成相应的 Shell 命令直接在当前 SSH 连接中运行。
- **现代化 UI设计**: 美观、轻量的界面，全端自适应响应，优秀的暗色模式支持。
- **完善的会话管理**: 提供 SSH 连接会话的新增、编辑、删除以及按标签分类，支持 Password / Private Key 登录，且拥有会话导入/导出（可强加密）功能，方便在多设备间同步或备份。
- **多终端并发 & 批量命令**: 可以在多个终端间快速切换；可在选中的多个服务器上**批量执行相同的命令**，在部署运维集联环境时效率加倍。
- **SFTP 文件管理面板**: 内置文件浏览器支持，直接进行文件的查看、删除、上传文件及下载文件。
- **系统状态监控面板**: 实时展示所在系统的 CPU利用率、内存分布情况、网络上下行负载状态。
- **快捷指令库 (Quick Commands)**: 自定义常用指令可一键执行。

---

## 🚀 部署指南 (Deployment)

本应用支持使用 Docker 进行本地 / 服务器独立私有化部署。推荐在群晖 (Synology NAS) 或标准 Linux 发行版本上使用 Docker Compose 进行一键部署。

### 0. 准备工作

如果在中国大陆网络环境下无法直接访问 Gemini API 时，建议事先准备好可用的 Gemini 代理地址 (`baseUrl`)，并在前端设置中或通过 Nginx 等代理环境配置。

你需要去 Google AI Studio 申请一个免费的 `GEMINI_API_KEY`（如果不填也能启动服务，但是无法使用内置的 AI 对话分析功能，也可以启动后在设置菜单里用 localStorage 的方式覆盖并补充 Key）。

### 1. 将项目下载到服务器 / NAS 下

首先在宿主机（如 NAS 或 Linux）上克隆或进入你的应用所在目录：

```bash
mkdir -p /volume1/docker/ai-ssh-terminal
cd /volume1/docker/ai-ssh-terminal
# 将你的项目文件拷贝到该目录下，包含 docker-compose.yml 和 Dockerfile
```

### 2. 手动创建数据挂载目录 (非常重要)

特别是在 **群晖 NAS (Synology DSM)** 平台上，Docker 引擎在发现外部绑定路径不存在时，不会自动创建一个目录（或者可能会遇到权限问题报错：`Bind mount failed: '/volume1/docker/ai-ssh-terminal/data' does not exist`）。因此你需要**手动建好存放数据库的持久化文件夹**：

```bash
# 在应用同级目录下创建 data 文件夹
mkdir data
# 修改 data 文件夹权限，以确保容器内部的 node 用户或 sqlite 可以正常写入（安全起见最宽松可以临时赋 777）
chmod 777 data
```

### 3. 配置 docker-compose.yml 文件

检查并修改您的 `docker-compose.yml` 中的环境变量（也可以建立 `.env` 文件配合）：

```yaml
version: '3.8'

services:
  ai-ssh-terminal:
    build: .
    container_name: ai-ssh-terminal
    restart: unless-stopped
    ports:
      - "3020:3000"   # 左侧为宿主机暴露端口，可自行修改；右侧 3000 勿动
    environment:
      - NODE_ENV=production
      - APP_PORT=3000
      - DB_PATH=/app/data/database.sqlite
      # 在这里填入你申请好的 Gemini API Key (必须填入真实的，或者使用界面配置)
      - GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
    volumes:
      - ./data:/app/data   # 将刚才手动创建的 data 目录挂载到容器中
```

### 4. 启动与编译容器

```bash
# 在含有 docker-compose.yml 的目录执行
sudo docker compose up -d --build
```
> 如果系统只有 `docker-compose` 指令，也可以执行 `sudo docker-compose up -d --build`

等待进度条走完（取决于网速和 CPU 配置，一般需要 1~5 分钟）。启动成功后，即可通过浏览器访问：`http://<宿主机IP>:3020`

---

## 💡 快速使用说明 (Usage Guide)

### 首次登录
应用没有集成强制的集中式第三方 Auth 登录。你可以直接输入任何想要的用户名与密码即为初始注册。登录后，该账户产生的配置、SSH 记录等全部存放在宿主机的 SQLite 数据库 `data/database.sqlite` 中。

> **注意：** 生产环境如果对外暴露，建议在前面套一层反向代理 (Nginx / Caddy 或群晖自带的 "反向代理服务器" 功能)，并绑定可信任的 HTTPS 域名与 WAF 防护策略。

### 创建与管理 SSH 连接
1. 登录后在左侧侧边栏点击 **"+"** 或 **"Saved Sessions"** 的加号按钮。
2. 填写服务器信息：地址(Host)、端口(Port)、用户名(Username)以及验证方式(支持密码 Password 或私钥 PrivateKey，私钥需包含完整的头部和脚部标识)。
3. 你也可以针对应用场景赋予不同的 `Tags`（如 Production, Dev, Linux）方便筛选。

### AI 调试助手 (AI Assistant)
在终端运行某条引发异常报错的命令后：
1. 点击终端上方右上角的 **"Ask AI"（或机器人图标）** 打开右侧 AI 面板。
2. 你可以直接描述你想做的目的，或粘贴错误日志报错代码给 AI，应用会自动携带上你的操作上下文向大模型提问。
3. AI 如果给出了一段修补 Bug 的 Shell 代码，点击代码块上的 **运行图标**，可以一键发送至当前打开并活跃的 SSH 窗口。

### 工具栏功能区
* **SFTP 管理**: 连接上具体的会话在终端选项卡时，可以点击终端右上角的「云彩文件夹/Server」图标打开。
* **快捷执行与全局群发**: 展开「Quick Commands」面板。你在此处添加指令后。如果在左侧会话列表前勾选了多个会话服务器，再在此处点击命令运行，即实现**同时批量发令操作**并收集回显。
* **导入/导出 (备份配置文件)**: 在左侧 Saved Sessions 区域工具栏有一个"抽屉/归档"(Archive) 图标。支持导出并带有 AES 强密码加密能力，换机器和浏览器时非常方便一键复原会话配置及服务器密钥密码。

---

## 🔄 如何更新 (How to Update)

由于当前项目是通过直接获取源码并在 NAS 本地动态构建 Docker 镜像运行的，因此更新的核心逻辑就是：**替换最新的源码，并重新构建镜像启动**。具体步骤如下：

### 1. 备份数据（可选但建议）
虽然我们的数据挂载在外部的 `data` 目录，更新容器理论上不会丢失数据，但大版本更新前仍然建议做一下备份：
使用应用内置的【导出会话】功能，或者直接在 NAS 上将 `data/database.sqlite` 文件复制一份。

### 2. 获取最新源码并替换
如果后续有新功能的修改：
- 将获取到的最新代码文件夹，覆盖原先群晖 NAS 中的 `/volume1/docker/ai-ssh-terminal` 目录内容。
- **注意：不要覆盖或删除你之前创建的 `data` 目录！**

### 3. 重启并重新构建容器
进入 NAS 的终端（SSH 到群晖并切换到对应目录）执行以下命令：
```bash
cd /volume1/docker/ai-ssh-terminal

# 停止旧的容器（可选）
sudo docker compose down

# 强制重新构建并启动 (核心步骤)
sudo docker compose up -d --build
```
等待编译完成后，就可以访问到最新版的应用了。数据会自动从挂载的 `data/database.sqlite` 中读取。

> **关于自动检查更新：**
> 目前本系统主要是通过 AI Studio 以源码形式交付您的个性化构建版本，并不像标准开源软件那样有一个中心化的服务端提供打包好的镜像或版本号接口，因此**暂时无法实现内置的“一键检查更新”功能**。后续如果由您将其发布到 GitHub 并开源，可以通过在前端调用 GitHub API 实现新 Release 的探测提醒。
