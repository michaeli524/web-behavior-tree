# AGENTS.md — web-behavior-tree

UE 蓝图风格的行为树可视化编辑器，纯前端应用。基于 React Flow + Zustand 实现节点拖拽连线、变量系统和 Tick 驱动执行引擎。

## 项目愿景

这个工具的目标是做成一个 Web 端的 UE5 风格行为树编辑器，用来详细拆解《怪物猎人崛起》中“电龙”的 AI 行为。它既是一个怪物 AI 分析和设计工具，也是一个面向作品集/求职展示的项目，用来体现作者作为怪物设计方向战斗策划的能力。后续功能设计应优先服务于怪物行为拆解、技能释放逻辑、战斗状态切换、距离/部位/蓄电等条件表达，以及最终可部署到服务器上的展示体验。

Action 节点采用策划资源映射配表驱动：节点自身只保存 `actionId`，动作名称和 GIF 路径来自项目内配置表。策划维护 `public/config/Actions.xlsx`，行为树引用 ID，避免把资源路径散落在节点数据里；前端运行时读取 `public/config/Actions.json`，两者字段保持一致。

Action 配表不是技能参数表，不应包含距离、前摇/持续/后摇、冷却、威胁等级、设计意图等战斗设计字段。它只负责资源一一对应。当前字段为 `ActionId`, `ActionName`, `GifPath`, `Comment`。

Action 配表结构采用双表头：第 1 行是英文程序字段名，第 2 行是中文策划注释。表格需要保持冻结双表头、按内容设置列宽、通过颜色区分 ID/名称/资源/备注等字段，方便策划维护和对外展示。

正式导表流程是 `public/config/Actions.xlsx` → `public/config/Actions.json`。前端顶栏的“导表”按钮会调用 Vite 本地接口执行 Excel to JSON，并刷新 Action 配置；命令行也可运行 `npm run export:actions`。

策划资源命名采用“大写开头 + 下划线分割单词”的格式，不是全大写。例如技能动画 GIF 应命名为 `Khezu_Tail_Sweep.gif`，并且这类怪物技能动画资产需要带怪物名作为前缀。`BT` 是 BehaviorTree 的专有缩写，相关文件名或标识中可保持全大写，例如 `Khezu_BT.json`。

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 启动开发服务器 → http://localhost:5173
npm run build        # 生产构建（先 tsc 类型检查再 vite build）
npx tsc --noEmit     # 仅类型检查，不输出文件
```

## 技术栈

- Vite 8 + React 19 + TypeScript 6
- **@xyflow/react** (React Flow v12) — 节点编辑器画布
- **zustand** v5 — 全局状态管理
- 纯前端，无后端，无路由

## 架构

```
用户交互 → Zustand Store (单一数据源) → React Flow 画布渲染
                ↕
         BehaviorTreeEngine (执行引擎，只读 store 数据)
```

**核心原则：Zustand 是唯一数据源。** React Flow 不维护独立状态——`BTEditor` 从 store 派生 nodes/edges，所有修改直接走 store action。

### 数据流

```
NodePalette 拖拽 → dataTransfer.setData('application/node-type', ...)
    → BTEditor.onDrop → addNode() 写入 store
    → store.nodes 变化 → rfNodes useMemo 重新派生 → React Flow 重渲染

BTEditor.onConnect → addEdgeStore() 写入 store
    → store.edges 变化 → rfEdges useMemo 重新派生

BTEditor 节点拖拽结束 → onNodesChange (position,dragging=false)
    → updateNodePosition() 写入 store
```

## 目录结构

```
src/
├── engine/
│   ├── types.ts                # BTNodeType 枚举、BTNode/BTEdge/BTVariable 接口
│   └── BehaviorTreeEngine.ts   # Tick 驱动执行引擎（纯逻辑，无 React 依赖）
├── store/
│   └── useBTStore.ts           # Zustand store：nodes/edges/variables/functions CRUD
├── nodes/
│   └── BTNodeRenderer.tsx      # React Flow 自定义节点渲染组件（memo）
├── edges/
│   └── BTEdge.tsx              # React Flow 自定义边（smooth step 路径）
├── components/
│   ├── BTEditor.tsx            # 主画布：React Flow 实例，store→RF 派生，事件处理
│   ├── NodePalette.tsx         # 左侧节点模板面板（HTML5 drag）
│   ├── PropertiesPanel.tsx     # 右侧属性编辑器（根据选中节点动态显示字段）
│   ├── VariablePanel.tsx       # 变量 + 函数管理面板
│   └── Toolbar.tsx             # 顶栏：运行/重置/导出/导入/清空
└── utils/
    └── idGenerator.ts          # 简单自增 ID 生成
```

## 状态管理（Zustand Store）

`useBTStore` 导出所有状态和方法。组件通过 selector 精确订阅：

```typescript
const nodes = useBTStore((s) => s.nodes);        // 只订阅 nodes
const addNode = useBTStore((s) => s.addNode);     // action 引用稳定，不会触发重渲染
```

**关键 Store Actions：**

| Action | 触发场景 |
|---|---|
| `addNode(type, position)` | NodePalette 拖拽到画布 |
| `removeNode(id)` | 选中节点按 Delete / 双击 |
| `updateNodeData(id, partial)` | PropertiesPanel 编辑属性 |
| `updateNodePosition(id, pos)` | 拖拽节点结束（dragging=false） |
| `addEdge(src, tgt)` | 画布连线操作 |
| `addVariable/updateVariable/removeVariable` | VariablePanel 操作 |
| `setExecutionResult(id, status)` | 引擎 Tick 回调 |
| `exportTree()` → JSON string | 导出按钮 |
| `importTree(json)` | 导入按钮 |

## 执行引擎（BehaviorTreeEngine）

`src/engine/BehaviorTreeEngine.ts` — 纯 TypeScript 类，无 React 依赖。

**使用方式：**
```typescript
const engine = new BehaviorTreeEngine();
engine.load(nodes, edges, variables, functions);
engine.onTick((nodeId, status) => { /* 更新 UI */ });
const { rootStatus, results } = engine.tick();  // 同步执行整棵树
```

**节点执行逻辑：**

- **Root**: 执行第一个子节点，透传其状态
- **Selector**: 子节点依次执行，任一 SUCCESS 则返回 SUCCESS（或运算）
- **Sequence**: 子节点依次执行，任一 FAILURE 则返回 FAILURE（与运算）
- **Parallel**: 所有子节点执行，全部 SUCCESS 才 SUCCESS，任一 FAILURE 即 FAILURE
- **Condition**: `new Function(...vars, "return (condition)")` 执行 JS 表达式，通过则继续执行子节点
- **Inverter**: SUCCESS→FAILURE, FAILURE→SUCCESS
- **Repeater**: 重复执行子节点 N 次
- **Succeeder**: 执行子节点但始终返回 SUCCESS
- **Action**: `new Function(...vars, 'set', actionBody)` 执行，可调用 `set(name, value)` 修改变量
- **Wait**: 当前版本瞬时返回 SUCCESS（模拟中用 duration 仅作显示）

**⚠️ 安全注意：** 引擎使用 `new Function()` 执行用户输入的 JS 代码。这是设计选择（UE 蓝图也是图灵完备的），但需注意这是纯前端工具，代码在用户自己浏览器中执行。

## 节点类型系统

所有节点类型定义在 `BTNodeType` 枚举（`src/engine/types.ts`）。`BTNodeData` 根据 type 不同使用不同字段：

| type | 有效字段 |
|---|---|
| ROOT | label |
| SELECTOR / SEQUENCE / PARALLEL | label |
| CONDITION | label, condition |
| ACTION | label, action |
| WAIT | label, duration |
| INVERTER / SUCCEEDER | label |
| REPEATER | label, repeatCount |

React Flow 注册的 node type 统一为 `'bt-node'`，由 `BTNodeRenderer` 根据 `data.type` 分发渲染。

## React Flow 集成要点

1. **节点注册**: `nodeTypes = { 'bt-node': BTNodeRenderer }` — store 中所有节点的 `.type` 字段都是 `'bt-node'`
2. **状态派生**: `rfNodes` / `rfEdges` 通过 `useMemo` 从 store 派生，依赖数组包含 `[nodes, selectedNodeId]`
3. **位置持久化**: `onNodesChange` 只在 `change.dragging === false` 时写入 store，避免拖拽中频繁更新
4. **删除处理**: `onNodesDelete` 回调处理 Delete 键和 UI 删除操作，直接调用 `removeNode()`
5. **自定义边**: `BTEdge` 使用 `getSmoothStepPath` 生成平滑阶梯路径
6. **选中态**: 通过 `rfNodes` 派生时注入 `selected` 属性，不从 React Flow 内部 selection 状态读取

## 样式约定

- 全局变量在 `index.css` 的 `:root` 中定义（暗色主题 `#0f172a` 背景）
- 组件样式在 `App.css`，按区块分段注释
- React Flow 默认样式通过 `.react-flow__*` 类名覆盖
- 节点状态色：SUCCESS=#22c55e, FAILURE=#ef4444, RUNNING=#3b82f6, IDLE=#555
- 按钮样式类：`.btn .btn-primary .btn-secondary .btn-danger .btn-small`

## 已知限制 & 待改进

1. **Wait 节点**当前是瞬时完成，未实现真实异步等待
2. **Parallel 节点**实际是同步顺序执行，未实现真正的并发 Tick
3. 引擎 Tick 是**同步一次性**的，不支持分步调试或断点
4. 函数（BTFunction）已定义但引擎中 `functions` Map 始终为空，Action 节点不支持调用自定义函数
5. 导入/导出用的是 `prompt()` / `alert()`，体验简陋
6. 没有撤销/重做（undo/redo）
7. 没有自动布局（auto-layout）

## 添加新节点类型的步骤

1. `src/engine/types.ts` — `BTNodeType` 枚举添加新值
2. `src/store/useBTStore.ts` — `defaultLabels` 添加默认标签
3. `src/nodes/BTNodeRenderer.tsx` — `typeConfig` 添加颜色和图标；在 JSX 中按需添加渲染逻辑
4. `src/engine/BehaviorTreeEngine.ts` — `tickNode()` switch 添加执行逻辑
5. `src/components/NodePalette.tsx` — `nodeTemplates` 数组添加条目
6. `src/components/PropertiesPanel.tsx` — 按需添加属性编辑 UI
