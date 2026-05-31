# 怪物 AI 行为树可视化工具

一个用于拆解和展示怪物战斗 AI 的 Web 行为树编辑器。

项目当前以《怪物猎人崛起》电龙为案例，将怪物招式衔接、距离判断、角度判断、Combo 分支和动作资源整理成可视化节点图。这个仓库同时也是一个作品集项目，重点展示战斗策划对怪物行为结构的拆解能力，以及使用 Codex 等 AI 编程工具把设计需求快速落地为可交互工具的能力。

## 项目定位

- 面向怪物设计、战斗策划、AI 行为拆解的个人工具
- 用节点图表达怪物行为决策，而不是只写静态分析文档
- 通过 MP4 资源把行为树节点和具体招式表现关联起来
- 用 Excel/JSON 配表维护动作资源，贴近策划工作流

## 当前功能

- **行为树画布**：节点拖拽、连线、框选、多选移动、删除、撤销/重做
- **右键快速创建**：搜索节点、方向键选择、回车创建、键盘选择自动滚动
- **执行流与数据流**：执行端口和数据端口分离，支持端口拆线
- **多页面编辑**：每个页面可对应一个 Combo 节点，页面名和 Combo 标题双向同步
- **Combo 节点**：支持展示 MP4，也可切换为普通子树入口样式
- **Action 节点**：只保存 `actionId`，动作名和 MP4 路径来自 Action 配表
- **变量节点**：变量可拖入画布创建 Get/Set 节点
- **条件与数据节点**：支持 Compare、Condition、Dist Selector、Random Selector、2D Distance Between、Angle Between CW、Angle Between CW LRBoth 等节点
- **注释框**：选中节点后按 `C` 创建注释框，用于整理行为块
- **JSON 导入导出**：行为树数据可保存为 JSON，便于版本维护和展示

## 示例用途

以电龙为例，可以把以下内容整理到行为树中：

- 不同距离下的招式选择
- 头部、尾部、翅膀等攻击方向和角度判断
- 未充能、局部充能、完全充能等状态下的行为差异
- 小招衔接、Combo 页面和动作 MP4 展示
- 大招、派生招式和状态切换条件

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开：

```text
http://localhost:5173/
```

生产构建：

```bash
npm run build
```

## 常用操作

| 操作           | 方式                               |
| -------------- | ---------------------------------- |
| 创建节点       | 右键画布打开搜索菜单               |
| 搜索菜单选择   | 输入关键词后用方向键选择，回车创建 |
| 从端口创建节点 | 从端口拖线到空白处，松开后选择节点 |
| 断开端口连线   | 按住 Cmd/Ctrl 点击端口             |
| 创建注释框     | 选中节点后按 `C`                   |
| 撤销           | Cmd/Ctrl + Z                       |
| 重做           | Cmd/Ctrl + Shift + Z               |
| 保存           | Cmd/Ctrl + S                       |
| 删除节点       | Backspace / Delete                 |

## Action 配表与 MP4

Action 节点不直接保存动作名称或 MP4 路径，只保存 `actionId`：

```json
{
  "type": "action",
  "label": "原地放电",
  "actionId": "Khezu_Idle_Discharge"
}
```

前端通过 `public/config/Actions.json` 查找展示信息：

```json
{
  "actionId": "Khezu_Idle_Discharge",
  "actionName": "原地放电",
  "gifPath": "/ActionMP4/原地放电-1.mp4",
  "comment": "电龙原地放电动作 MP4"
}
```

维护流程：

```text
public/config/Actions.xlsx
        ↓ 导表
public/config/Actions.json
        ↓ 运行时读取
Action 节点展示动作名和 MP4
```

命令行导表：

```bash
npm run export:actions
```

从当前 JSON 重新生成带样式的 Excel：

```bash
npm run generate:actions-xlsx
```

## 数据文件

当前展示用行为树文件位于：

```text
public/电龙AI.json
```

Action 配表位于：

```text
public/config/Actions.xlsx
public/config/Actions.json
```

MP4 资源主要位于：

```text
public/ActionMP4/
```

## MP4 资源本地/CDN切换

Action 配表里的 `gifPath` 字段保留为兼容旧导表字段名。表格中可以只填写 MP4 文件名，导表时会自动补成 `/ActionMP4/文件名`；如果已经填写 `/ActionMP4/...` 或完整 URL，则保持原样。前端会读取：

```text
public/config/asset-host.json
```

本地开发时：

```bash
npm run assets:local
```

此时 `assetBaseUrl` 为空，MP4 从本地 `public/ActionMP4/` 读取。

上线前切到 CDN：

```bash
npm run assets:cdn
```

此时前端会把 `/ActionMP4/...` 拼成 `assetBaseUrl + /ActionMP4/...`。实际 CDN 域名维护在：

```text
public/config/asset-host.cdn.json
```

## 技术栈

- Vite 8
- React 19
- TypeScript 6
- React Flow v12
- Zustand v5
