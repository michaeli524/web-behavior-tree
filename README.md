# Web Behavior Tree

UE5 风格的行为树可视化编辑器。用于快速搭建、分析、拆解游戏 AI 行为树。

当前项目重点用于拆解《怪物猎人崛起》中电龙的 AI 行为，并作为怪物设计/战斗策划方向的作品集展示工具。Action 节点采用策划配表驱动，通过 Excel 表维护动作与 GIF 资源的一一对应关系。

## 功能

- **可视化编辑** — 拖拽节点、连线，水平布局从左到右
- **14 种节点** — Root / Selector / Sequence / Parallel / DistSelector / Condition / Compare / Inverter / Repeater / Succeeder / Action / Wait / Get / Set
- **变量系统** — 创建变量、拖入画布选 Get/Set，布尔/数字/字符串三种类型
- **函数系统** — 创建函数作为子行为树，双击打开编辑
- **距离选择器** — 多端口 DistSelector，自定义距离阈值
- **数据流** — 红色端口连接变量和数据比较节点（< > == <= >=）
- **条件分支** — Condition 节点 True/False 双输出
- **注释框** — 框选节点按 C 键创建注释框
- **拖线创建** — 从端口拖线到空白处弹出搜索面板快速创建节点
- **Command/Ctrl+点击端口拆线** — 断开连线
- **框选多选** — 左键拖拽框选多个节点，一起移动
- **撤销/重做** — Ctrl+Z / Ctrl+Shift+Z
- **本地 JSON 保存桥** — 开发环境下可直接保存到默认桌面 JSON
- **Action 导表** — 顶栏一键执行 `actions.xlsx` → `actions.json`
- **Action GIF 索引** — Action 节点通过 `actionId` 查表显示动作名和 GIF
- **自动保存** — localStorage 自动保存，刷新不丢
- **Figma 风格面板** — 可拖拽调整大小、一键收起面板

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173/`

开发环境默认行为树文件：

```text
/Users/miko/Desktop/电龙AI.json
```

顶栏 `打开默认` 会读取该 JSON，`保存` 会直接写回该 JSON。也可以通过环境变量切换默认文件：

```bash
BT_TREE_FILE=/path/to/tree.json npm run dev
```

## 使用方法

### 创建节点

- **左侧面板拖入** — 变量/函数列表中的项目可直接拖到画布
- **右键画布** — 弹出搜索面板，搜索创建任意节点
- **从端口拖线** — 拖到空白处弹出搜索面板，选择节点自动连线

### 连线规则

- **蓝色三角** — 执行流端口，蓝色只能连蓝色
- **红色圆点** — 数据流端口，红色只能连红色

### 常用操作

| 操作 | 快捷键 |
|------|--------|
| 创建注释框 | 选中节点后按 C |
| 断开连线 | 按住 Cmd/Ctrl + 点击端口 |
| 撤销 | Cmd/Ctrl + Z |
| 重做 | Cmd/Ctrl + Shift + Z |
| 保存 | Cmd/Ctrl + S |
| 删除节点 | Backspace / Delete |
| 右键拖动画布 | 右键按住拖拽 |

### 变量

1. 左侧底部"变量"标签页 → 搜索框 + 点 **+** 新建
2. 拖变量到画布：
   - 按住 Cmd/Alt → 直接创建 Get
   - 按住 Ctrl → 直接创建 Set
   - 不按 → 弹出选择面板

### 函数

1. 左侧底部"函数"标签页 → 搜索框 + 点 **+** 新建
2. 双击函数项 → 打开函数编辑页
3. 在 Main 画布右键搜索函数名 → 拖入作为调用节点

## Action 配表与 GIF 索引

Action 节点不直接保存动作名或 GIF 路径。节点数据只保存 `actionId`，前端通过 `actionId` 到 Action 配表中查找展示信息。

行为树中的 Action 节点示例：

```json
{
  "type": "action",
  "label": "原地放电",
  "actionId": "khezu_idle_discharge"
}
```

Action 资源映射表示例：

```json
{
  "actionId": "khezu_idle_discharge",
  "actionName": "原地放电",
  "gifPath": "/actions/khezu/idle_discharge.gif",
  "comment": "电龙原地放电动作 GIF"
}
```

对应关系：

```text
Action 节点 actionId
        ↓
public/config/actions.json 中同名 actionId
        ↓
actionName / gifPath / comment
        ↓
节点卡片和右侧属性面板显示动作名、GIF 预览和备注
```

### 配表文件

策划维护的源表：

```text
public/config/actions.xlsx
```

前端运行时读取的导表产物：

```text
public/config/actions.json
```

`actions.xlsx` 采用双表头结构：

| 行 | 内容 | 用途 |
|---|---|---|
| 第 1 行 | 英文字段名 | 程序读取字段 |
| 第 2 行 | 中文注释 | 给策划说明字段含义 |
| 第 3 行起 | 数据 | 动作与 GIF 资源映射 |

当前字段：

| 字段 | 中文说明 |
|---|---|
| `ActionId` | 动作唯一 ID，行为树节点只保存这个字段 |
| `ActionName` | 动作显示名 |
| `GifPath` | GIF 资源路径，部署时相对 `public` 目录 |
| `Comment` | 资源备注，仅用于说明素材来源或用途 |

这张表只负责资源一一对应，不放距离、前摇、后摇、冷却、威胁等级等战斗设计参数。

### 导表流程

正常使用流程：

1. 策划编辑 `public/config/actions.xlsx`
2. 回到 Web 应用，点击顶栏 **导表**
3. Vite 本地接口执行 Excel to JSON
4. 生成/覆盖 `public/config/actions.json`
5. 前端刷新 Action 配置，Action 节点按最新表格显示

也可以用命令行导表：

```bash
npm run export:actions
```

如需从当前 JSON 重新生成带样式的 Excel 表：

```bash
npm run generate:actions-xlsx
```

### GIF 资源路径

GIF 文件建议放在：

```text
public/actions/khezu/
```

例如：

```text
public/actions/khezu/idle_discharge.gif
```

配表中的路径写成：

```text
/actions/khezu/idle_discharge.gif
```

不要把 GIF 文件本体写进行为树 JSON。行为树只保存 `actionId`，资源路径由 Action 配表统一管理。

## 技术栈

- Vite + React 19 + TypeScript
- @xyflow/react (React Flow v12)
- Zustand v5

## 许可证

MIT
