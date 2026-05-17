# Web Behavior Tree

UE5 风格的行为树可视化编辑器。用于快速搭建、分析、拆解游戏 AI 行为树。

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
- **JSON 导入/导出** — 文件保存/加载
- **自动保存** — localStorage 自动保存，刷新不丢
- **Figma 风格面板** — 可拖拽调整大小、一键收起面板

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173/`

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

## 技术栈

- Vite + React 19 + TypeScript
- @xyflow/react (React Flow v12)
- Zustand v5

## 许可证

MIT
