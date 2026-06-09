# 故事星球 Story Planet

让每个孩子成为故事的主角，用专属绘本记录成长瞬间。

## ✨ 项目简介

「故事星球」是一个让家长为孩子创作专属绘本的在线平台。家长只需输入孩子的名字、喜欢的动物和最近经历的事，系统便会生成一本以孩子为主角的温暖绘本故事，配以可爱插画风格，支持中英双语，并可将绘本导出为PDF下载保存。

- **目标用户**：3-10岁孩子的家长
- **核心价值**：个性化故事创作、温暖插画风格、中英双语支持、PDF导出保存

## 🛠️ 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite 6
- **样式方案**：Tailwind CSS
- **路由管理**：React Router v7
- **状态管理**：Zustand
- **图标库**：Lucide React
- **PDF导出**：jsPDF + html2canvas
- **工具函数**：clsx + tailwind-merge

## 📁 项目结构

```
src/
├── hooks/          # 自定义 Hooks
│   └── useTheme.ts     # 主题管理 Hook
├── lib/            # 工具库
│   └── utils.ts        # 通用工具函数
├── pages/          # 页面组件
│   ├── Home.tsx        # 首页
│   ├── Create.tsx      # 引导输入页
│   ├── Generating.tsx  # 生成等待页
│   └── Book.tsx        # 绘本阅读页
├── store/          # 状态管理
│   └── useStore.ts     # Zustand 全局状态
├── utils/          # 业务工具
│   ├── imageGenerator.ts  # 图片生成
│   ├── pdfExport.ts       # PDF 导出
│   └── storyEngine.ts     # 故事生成引擎
├── App.tsx         # 应用入口组件
├── main.tsx        # 应用入口
└── index.css       # 全局样式
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

### 代码检查

```bash
npm run lint
```

### 类型检查

```bash
npm run check
```

## 🎯 核心功能

### 1. 首页
- 品牌展示与产品介绍
- 星球主题动画背景
- 开始创作入口

### 2. 引导输入页
- 分步骤收集孩子信息
- 步骤一：输入孩子名字
- 步骤二：选择喜欢的动物
- 步骤三：填写最近经历
- 步骤四：选择语言偏好

### 3. 生成等待页
- 沉浸式等待动画
- 星球旋转、星星飘散效果
- 生成进度阶段提示

### 4. 绘本阅读页
- 翻页式绘本浏览
- 页码导航与快速跳页
- 一键导出PDF下载

## 🎨 设计特色

- **主色调**：温暖奶油黄背景 + 珊瑚橙强调色
- **辅助色**：薄荷绿、天空蓝、薰衣草紫
- **设计风格**：圆润可爱、大圆角卡片、柔和阴影
- **主题元素**：星球、星星、宇宙星空贯穿全站

## 📄 功能说明

### PDF 导出
使用 `jsPDF` 和 `html2canvas` 实现高质量PDF导出，将生成的绘本页面转换为可下载保存的PDF文件。

### 故事生成
内置故事引擎，根据用户输入的信息自动生成连贯的绘本故事情节，支持中英文双语。

### 状态管理
使用 Zustand 进行轻量级全局状态管理，在各个页面间共享绘本数据和用户输入。

## 📦 相关文档

- [产品需求文档](.trae/documents/prd.md)
- [技术架构文档](.trae/documents/tech-architecture.md)

## 📝 开发说明

本项目采用 Vite + React + TypeScript 技术栈，配合 Tailwind CSS 实现快速开发。代码遵循 ESLint 规范，确保代码质量。

## 📄 License

MIT License
