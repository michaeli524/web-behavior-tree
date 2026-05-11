# Web Behavior Tree

UE 蓝图风格的行为树可视化编辑器。基于 React Flow 实现节点拖拽、连线、变量系统和 Tick 驱动执行引擎。

## 功能

| 功能 | 说明 |
|---|---|
| 可视化编辑 | 拖拽创建节点，连线定义执行流 |
| 10 种节点 | Root / Selector / Sequence / Parallel / Condition / Inverter / Repeater / Succeeder / Action / Wait |
| 变量系统 | Boolean / Number / String 类型，条件表达式和动作代码可引用 |
| 执行引擎 | Tick 驱动，节点状态实时高亮（绿=成功 / 红=失败 / 蓝=运行中） |
| 导入导出 | JSON 格式，支持保存/加载行为树 |

## 技术栈

- **Vite** + **React 18** + **TypeScript**
- **React Flow** (@xyflow/react) — 节点编辑器
- **Zustand** — 状态管理

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173/`，从左侧面板拖拽节点到画布即可开始编辑。

## 节点类型

| 类别 | 节点 | 说明 |
|---|---|---|
| Core | Root | 行为树入口 |
| Composite | Selector | 优先级选择，子节点依次执行直到成功 |
| Composite | Sequence | 顺序执行，子节点依次执行直到失败 |
| Composite | Parallel | 并行执行所有子节点 |
| Decorator | Condition | 条件判断（支持 JS 表达式如 `hp > 50`） |
| Decorator | Inverter | 翻转子节点结果 |
| Decorator | Repeater | 重复执行 N 次 |
| Decorator | Succeeder | 始终返回成功 |
| Leaf | Action | 执行动作（支持 JS 代码） |
| Leaf | Wait | 等待指定毫秒 |

## 许可证

MIT
