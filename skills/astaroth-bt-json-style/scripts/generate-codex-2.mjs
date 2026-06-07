import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const baseTreePath = path.join(repoRoot, 'public/电龙AI.json');
const actionCatalogPath = path.join(repoRoot, 'public/config/Actions.json');
const outputPath = path.join(repoRoot, 'public/电龙AI-CodeX-2.0.json');

const T = {
  ROOT: 'root',
  SEQUENCE: 'sequence',
  CONDITION: 'condition',
  ACTION: 'action',
  DIST_SELECTOR: 'dist-selector',
  RANDOM_SELECTOR: 'random-selector',
  GET_VARIABLE: 'get-variable',
  RESET: 'reset',
  APPROACH: 'approach',
  DISTANCE_2D: 'distance-2d',
  ANGLE_BETWEEN_CW: 'angle-between-cw',
  COMBO: 'combo-show',
  COMMENT: 'comment',
};

const defaultLabels = {
  [T.ROOT]: 'Root',
  [T.SEQUENCE]: 'Sequence',
  [T.CONDITION]: 'Condition',
  [T.ACTION]: 'Action',
  [T.DIST_SELECTOR]: 'Dist Selector',
  [T.RANDOM_SELECTOR]: 'Random Selector',
  [T.GET_VARIABLE]: 'Get',
  [T.RESET]: 'Reset',
  [T.APPROACH]: 'Approach',
  [T.DISTANCE_2D]: '2D Dist Between',
  [T.ANGLE_BETWEEN_CW]: 'Angle Between CW',
  [T.COMBO]: 'Combo',
  [T.COMMENT]: 'Comment',
};

const variables = JSON.parse(fs.readFileSync(baseTreePath, 'utf8')).variables;
const actions = JSON.parse(fs.readFileSync(actionCatalogPath, 'utf8'));
const actionIds = new Set(actions.map((action) => action.actionId).filter(Boolean));

const vars = Object.fromEntries(variables.map((variable) => [variable.name, variable.id]));

class TreeBuilder {
  constructor(prefix) {
    this.prefix = prefix;
    this.counters = new Map();
    this.nodes = [];
    this.edges = [];
    this.pages = [];
    this.currentNodes = this.nodes;
    this.currentEdges = this.edges;
  }

  next(kind) {
    const nextValue = (this.counters.get(kind) ?? 0) + 1;
    this.counters.set(kind, nextValue);
    return `${this.prefix}_${kind}_${String(nextValue).padStart(3, '0')}`;
  }

  data(type, overrides = {}) {
    return {
      label: overrides.label ?? defaultLabels[type],
      type,
      condition: overrides.condition ?? '',
      action: overrides.action ?? '',
      duration: overrides.duration ?? 1000,
      repeatCount: overrides.repeatCount ?? 1,
      status: 'idle',
      distances: overrides.distances ?? [300, 650, 2000],
      randomWeights: overrides.randomWeights ?? [50, 30, 20],
      operator: overrides.operator ?? '<',
      compareLeftValue: overrides.compareLeftValue ?? '0',
      compareValue: overrides.compareValue ?? '0',
      approachDistance: overrides.approachDistance ?? 500,
      startValue: overrides.startValue ?? '0',
      endValue: overrides.endValue ?? '0',
      ...(overrides.actionId ? { actionId: overrides.actionId } : {}),
      ...(overrides.variableId ? { variableId: overrides.variableId } : {}),
      ...(overrides.functionId ? { functionId: overrides.functionId } : {}),
      ...(typeof overrides.isCombo === 'boolean' ? { isCombo: overrides.isCombo } : {}),
      ...(overrides.commentWidth ? { commentWidth: overrides.commentWidth } : {}),
      ...(overrides.commentHeight ? { commentHeight: overrides.commentHeight } : {}),
    };
  }

  node(kind, type, x, y, overrides = {}) {
    const node = {
      id: this.next(kind),
      type: 'bt-node',
      position: { x, y },
      data: this.data(type, overrides),
    };
    this.currentNodes.push(node);
    return node.id;
  }

  edge(source, target, sourceHandle, targetHandle) {
    this.currentEdges.push({
      id: this.next('edge'),
      source,
      target,
      ...(sourceHandle ? { sourceHandle } : {}),
      ...(targetHandle ? { targetHandle } : {}),
    });
  }

  page(name, build) {
    const previousNodes = this.currentNodes;
    const previousEdges = this.currentEdges;
    const page = {
      id: this.next(`page_${slug(name)}`),
      name,
      nodes: [],
      edges: [],
    };
    this.currentNodes = page.nodes;
    this.currentEdges = page.edges;
    build(page);
    this.pages.push(page);
    this.currentNodes = previousNodes;
    this.currentEdges = previousEdges;
    return page.id;
  }
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'combo';
}

function comment(builder, x, y, label, width, height) {
  return builder.node('comment', T.COMMENT, x, y, {
    label,
    commentWidth: width,
    commentHeight: height,
  });
}

function getVar(builder, x, y, variableName) {
  const variableId = vars[variableName];
  if (!variableId) throw new Error(`Missing variable: ${variableName}`);
  return builder.node('get', T.GET_VARIABLE, x, y, { variableId });
}

function conditionWithVar(builder, label, x, y, variableName) {
  const get = getVar(builder, x - 185, y + 75, variableName);
  const condition = builder.node('condition', T.CONDITION, x, y, { label });
  builder.edge(get, condition, 'data-out', 'data-in');
  return condition;
}

function distanceCondition(builder, label, x, y, startValue, endValue) {
  const distance = builder.node('distance', T.DISTANCE_2D, x - 215, y + 70, {
    startValue,
    endValue,
  });
  const condition = builder.node('condition', T.CONDITION, x, y, { label });
  builder.edge(distance, condition, 'data-out', 'data-in');
  return condition;
}

function angleCondition(builder, label, x, y, startValue, endValue) {
  const angle = builder.node('angle', T.ANGLE_BETWEEN_CW, x - 235, y + 70, {
    startValue,
    endValue,
  });
  const condition = builder.node('condition', T.CONDITION, x, y, { label });
  builder.edge(angle, condition, 'data-out', 'data-in');
  return condition;
}

function action(builder, actionId, x, y) {
  return builder.node('action', T.ACTION, x, y, { actionId });
}

function combo(builder, pageId, label, actionId, x, y) {
  return builder.node('combo', T.COMBO, x, y, {
    label,
    functionId: pageId,
    isCombo: true,
    actionId,
  });
}

function reset(builder, x, y) {
  return builder.node('reset', T.RESET, x, y);
}

function approach(builder, x, y, distance = 500) {
  return builder.node('approach', T.APPROACH, x, y, { approachDistance: distance });
}

function makePages(builder) {
  const pages = {};

  pages.headTail = builder.page('Head_Tail_TriCombo', () => {
    comment(builder, 20, 30, '牵制咬高频派生：小咬后高概率接甩尾，尾刺末段需要尾部角度/身后窗口。', 1260, 430);
    const root = builder.node('root', T.ROOT, 90, 190, { label: 'Head_Tail_TriCombo' });
    const bite = action(builder, 'Astaroth_Check_Bite', 300, 190);
    const sweep = action(builder, 'Astaroth_Tail_Sweep', 610, 190);
    const tailWindow = angleCondition(builder, '是否处于尾刺角度窗口', 980, 185, '150', '260');
    const thrust = action(builder, 'Astaroth_Tail_Thrust', 1280, 145);
    const noThrust = reset(builder, 1280, 290);
    builder.edge(root, bite, 'exec-out', 'exec-in');
    builder.edge(bite, sweep, 'exec-out', 'exec-in');
    builder.edge(sweep, tailWindow, 'exec-out', 'exec-in');
    builder.edge(tailWindow, thrust, 'exec-true', 'exec-in');
    builder.edge(tailWindow, noThrust, 'exec-false', 'exec-in');
  });

  pages.biteHead = builder.page('CheckBite_HeadSlam_Combo', () => {
    comment(builder, 20, 30, '600 距离常见连携：牵制咬起手；头部充能时派生头顶二连。', 1240, 410);
    const root = builder.node('root', T.ROOT, 90, 190, { label: 'CheckBite_HeadSlam_Combo' });
    const bite = action(builder, 'Astaroth_Check_Bite', 310, 190);
    const head = conditionWithVar(builder, '头部是否充能', 660, 180, 'HeadCharged');
    const charged = action(builder, 'Astaroth_Head_Slam_Charged', 1000, 130);
    const uncharged = action(builder, 'Astaroth_Head_Slam_Uncharged', 1000, 285);
    builder.edge(root, bite, 'exec-out', 'exec-in');
    builder.edge(bite, head, 'exec-out', 'exec-in');
    builder.edge(head, charged, 'exec-true', 'exec-in');
    builder.edge(head, uncharged, 'exec-false', 'exec-in');
  });

  pages.backBreath = builder.page('BackStep_Breath_Uncharged', () => {
    comment(builder, 20, 30, '未强化吐息：常以前撤/后撤拉开距离后释放；远距可接冲刺咬重新贴近。', 1350, 430);
    const root = builder.node('root', T.ROOT, 90, 190, { label: 'BackStep_Breath_Uncharged' });
    const back = action(builder, 'Astaroth_Back_Step', 310, 190);
    const breath = action(builder, 'Astaroth_Breath_Uncharged', 610, 190);
    const farEnough = distanceCondition(builder, '吐息后是否仍在远距', 960, 185, '600', '1200');
    const dash = action(builder, 'Astaroth_Dash_Bite', 1300, 145);
    const end = reset(builder, 1300, 290);
    builder.edge(root, back, 'exec-out', 'exec-in');
    builder.edge(back, breath, 'exec-out', 'exec-in');
    builder.edge(breath, farEnough, 'exec-out', 'exec-in');
    builder.edge(farEnough, dash, 'exec-true', 'exec-in');
    builder.edge(farEnough, end, 'exec-false', 'exec-in');
  });

  pages.doubleBreath = builder.page('BackStep_DoubleBreath_Press', () => {
    comment(builder, 20, 30, '头强化远程压制：后撤步二连吐息；若目标贴近，插入后撤再接冲刺翅膀下拍。', 1500, 455);
    const root = builder.node('root', T.ROOT, 90, 190, { label: 'BackStep_DoubleBreath_Press' });
    const back = action(builder, 'Astaroth_Back_Step', 310, 190);
    const breath = action(builder, 'Astaroth_Double_Breath_Charged', 610, 190);
    const close = distanceCondition(builder, '目标是否贴近', 970, 185, '0', '350');
    const backAgain = action(builder, 'Astaroth_Back_Step', 1290, 120);
    const pressAfterBack = action(builder, 'Astaroth_Dash_Wing_Press_Charged', 1600, 120);
    const press = action(builder, 'Astaroth_Dash_Wing_Press_Charged', 1290, 295);
    builder.edge(root, back, 'exec-out', 'exec-in');
    builder.edge(back, breath, 'exec-out', 'exec-in');
    builder.edge(breath, close, 'exec-out', 'exec-in');
    builder.edge(close, backAgain, 'exec-true', 'exec-in');
    builder.edge(backAgain, pressAfterBack, 'exec-out', 'exec-in');
    builder.edge(close, press, 'exec-false', 'exec-in');
  });

  pages.wingAdaptive = builder.page('Wing_Double_Press_Adaptive', () => {
    comment(builder, 20, 30, '翅膀充能下拍二连：近距时二连之间会先后撤调整身位。', 1300, 420);
    const root = builder.node('root', T.ROOT, 90, 190, { label: 'Wing_Double_Press_Adaptive' });
    const close = distanceCondition(builder, '起手目标是否贴近', 410, 185, '0', '350');
    const back = action(builder, 'Astaroth_Back_Step', 760, 120);
    const doubleAfterBack = action(builder, 'Astaroth_Wing_Double_Press_Charged', 1080, 120);
    const double = action(builder, 'Astaroth_Wing_Double_Press_Charged', 760, 300);
    builder.edge(root, close, 'exec-out', 'exec-in');
    builder.edge(close, back, 'exec-true', 'exec-in');
    builder.edge(back, doubleAfterBack, 'exec-out', 'exec-in');
    builder.edge(close, double, 'exec-false', 'exec-in');
  });

  pages.backWing = builder.page('BackStep_WingPress_ByCharge', () => {
    comment(builder, 20, 30, '近距后撤步翅膀下拍：翅膀充能则二连，未充能则单次。', 1250, 420);
    const root = builder.node('root', T.ROOT, 90, 190, { label: 'BackStep_WingPress_ByCharge' });
    const back = action(builder, 'Astaroth_Back_Step', 310, 190);
    const wing = conditionWithVar(builder, '翅膀是否充能', 660, 180, 'WingCharged');
    const charged = action(builder, 'Astaroth_Wing_Double_Press_Charged', 1000, 130);
    const uncharged = action(builder, 'Astaroth_Wing_Press_Uncharged', 1000, 285);
    builder.edge(root, back, 'exec-out', 'exec-in');
    builder.edge(back, wing, 'exec-out', 'exec-in');
    builder.edge(wing, charged, 'exec-true', 'exec-in');
    builder.edge(wing, uncharged, 'exec-false', 'exec-in');
  });

  pages.tailGround = builder.page('Tail_Ground_Spike_Check', () => {
    comment(builder, 20, 30, '尾巴插地低频技能：通常在 350 近距出现，作为近身惩罚/节奏变化。', 1180, 400);
    const root = builder.node('root', T.ROOT, 90, 190, { label: 'Tail_Ground_Spike_Check' });
    const close = distanceCondition(builder, '距离是否足够近', 420, 185, '0', '350');
    const spike = action(builder, 'Astaroth_Tail_Ground_Spike_Uncharged', 770, 145);
    const end = reset(builder, 770, 290);
    builder.edge(root, close, 'exec-out', 'exec-in');
    builder.edge(close, spike, 'exec-true', 'exec-in');
    builder.edge(close, end, 'exec-false', 'exec-in');
  });

  pages.backOverhead = builder.page('BackStep_Overhead_Slam', () => {
    comment(builder, 20, 30, '头部充能近中距压制：后撤到安全距离后释放斩舰刀。', 940, 360);
    const root = builder.node('root', T.ROOT, 90, 190, { label: 'BackStep_Overhead_Slam' });
    const back = action(builder, 'Astaroth_Back_Step', 310, 190);
    const overhead = action(builder, 'Astaroth_Overhead_Slam_Charged', 620, 190);
    builder.edge(root, back, 'exec-out', 'exec-in');
    builder.edge(back, overhead, 'exec-out', 'exec-in');
  });

  pages.airLanding = builder.page('Air_Approach_Breath_TailLanding', () => {
    comment(builder, 20, 30, '远距飞行靠近派生：靠近后空中吐息；尾巴强化时落地改为甩尾。', 1370, 430);
    const root = builder.node('root', T.ROOT, 90, 190, { label: 'Air_Approach_Breath_TailLanding' });
    const fly = approach(builder, 310, 190, 600);
    const breath = action(builder, 'Astaroth_Breath_Uncharged', 610, 190);
    const tail = conditionWithVar(builder, '尾巴是否充能', 960, 180, 'TailCharged');
    const sweep = action(builder, 'Astaroth_Tail_Sweep', 1300, 130);
    const land = reset(builder, 1300, 285);
    builder.edge(root, fly, 'exec-out', 'exec-in');
    builder.edge(fly, breath, 'exec-out', 'exec-in');
    builder.edge(breath, tail, 'exec-out', 'exec-in');
    builder.edge(tail, sweep, 'exec-true', 'exec-in');
    builder.edge(tail, land, 'exec-false', 'exec-in');
  });

  pages.airTailHeadWing = builder.page('Air_Tail_HeadSlam_WingLanding', () => {
    comment(builder, 20, 30, '新增观察：飞天尾刺、头砸二连之后，电龙还可能侧飞靠近，并以落地翅膀拍收尾。', 1540, 430);
    const root = builder.node('root', T.ROOT, 90, 190, { label: 'Air_Tail_HeadSlam_WingLanding' });
    const tail = action(builder, 'Astaroth_Tail_Thrust', 310, 190);
    const head = action(builder, 'Astaroth_Head_Slam_Charged', 620, 190);
    const sideFly = approach(builder, 970, 190, 600);
    const wing = conditionWithVar(builder, '翅膀是否充能', 1320, 180, 'WingCharged');
    const chargedPress = action(builder, 'Astaroth_Wing_Double_Press_Charged', 1680, 130);
    const unchargedPress = action(builder, 'Astaroth_Wing_Press_Uncharged', 1680, 285);
    builder.edge(root, tail, 'exec-out', 'exec-in');
    builder.edge(tail, head, 'exec-out', 'exec-in');
    builder.edge(head, sideFly, 'exec-out', 'exec-in');
    builder.edge(sideFly, wing, 'exec-out', 'exec-in');
    builder.edge(wing, chargedPress, 'exec-true', 'exec-in');
    builder.edge(wing, unchargedPress, 'exec-false', 'exec-in');
  });

  return pages;
}

function buildMainTree(builder, pages) {
  comment(builder, -1060, -880, 'CodeX 2.0：严格按原始电龙AI.json的蓝图式排版重排。读法：全局强化优先，然后按是否已有部位充能分流，最后按 350 / 600 / 1000+ 距离进入权重池。', 1370, 150);
  comment(builder, -1060, -610, '全局 Override：全身带电、超带电与大招倒计时优先，不进入普通距离权重。', 1640, 660);
  comment(builder, 780, -610, '全身充能普通池：进入强化展示、二连吐息压制、翅膀二连与核心三连。', 1780, 640);
  comment(builder, 780, 170, '已有部位充能：先按距离，再根据头/翅膀/尾巴强化状态决定派生。', 3150, 1260);
  comment(builder, 780, 1580, '未完全充能：以牵制咬、翅膀下拍、后撤步吐息、头顶二连构成基础循环。', 3060, 1180);
  comment(builder, 780, 2920, '远距/离场修正：过远时主动靠近或用冲刺咬、飞行靠近把战斗拉回 350-600 主循环。', 2860, 700);
  comment(builder, -1060, 1060, '观察备注：文本中“牵制咬甩尾尾刺三连”“后撤步吐息”“二连吐息接冲刺翅膀拍”等反复出现，因此被抽成 Combo 页面；不确定或缺资源行为用低权重或注释保留。', 1260, 650);

  const root = builder.node('root', T.ROOT, -900, -255, { label: 'Combat_Main_CodeX_2.0' });
  const entry = builder.node('sequence', T.SEQUENCE, -665, -255, { label: 'Sequence' });
  const entryReset = reset(builder, -665, -120);
  const allCharged = conditionWithVar(builder, '是否全身充能', -390, -255, 'AllCharged');
  const hasCharged = conditionWithVar(builder, '是否已有部位充能', 70, -40, 'HasCharged？');
  const superCharged = conditionWithVar(builder, '是否进入超带电状态', 70, -520, 'SuperCharged');
  const ultTimed = conditionWithVar(builder, '大招倒计时结束?', 510, -650, 'UltTimedUp');
  const ult = action(builder, 'Astaroth_Ult_Lightning_Dive', 930, -690);

  builder.edge(root, entry, 'exec-out', 'exec-in');
  builder.edge(entry, allCharged, 'exec-out', 'exec-in');
  builder.edge(entry, entryReset, 'exec-next', 'exec-in');
  builder.edge(allCharged, superCharged, 'exec-true', 'exec-in');
  builder.edge(allCharged, hasCharged, 'exec-false', 'exec-in');
  builder.edge(superCharged, ultTimed, 'exec-true', 'exec-in');
  builder.edge(ultTimed, ult, 'exec-true', 'exec-in');

  const superDist = builder.node('dist', T.DIST_SELECTOR, 930, -500, {
    distances: [350, 600, 1000, 2000],
  });
  const allRandom = builder.node('random', T.RANDOM_SELECTOR, 930, -225, {
    randomWeights: [20, 35, 30, 15],
  });
  builder.edge(ultTimed, superDist, 'exec-false', 'exec-in');
  builder.edge(superCharged, allRandom, 'exec-false', 'exec-in');

  const superClose = combo(builder, pages.backOverhead, 'BackStep_Overhead_Slam', 'Astaroth_Overhead_Slam_Charged', 1360, -565);
  const superMid = combo(builder, pages.doubleBreath, 'BackStep_DoubleBreath_Press', 'Astaroth_Double_Breath_Combo', 1360, -405);
  const superFar = combo(builder, pages.airLanding, 'Air_Approach_Breath_TailLanding', 'Astaroth_Breath_Uncharged', 1360, -245);
  const superFallback = action(builder, 'Astaroth_Dash_Wing_Press_Charged', 1360, -85);
  builder.edge(superDist, superClose, 'dist-0', 'exec-in');
  builder.edge(superDist, superMid, 'dist-1', 'exec-in');
  builder.edge(superDist, superFar, 'dist-2', 'exec-in');
  builder.edge(superDist, superFallback, 'dist-last', 'exec-in');

  const roar = action(builder, 'Astaroth_AllCharged_Roar', 1360, -170);
  const allBreath = combo(builder, pages.doubleBreath, 'BackStep_DoubleBreath_Press', 'Astaroth_Double_Breath_Combo', 1660, -315);
  const allWing = combo(builder, pages.wingAdaptive, 'Wing_Double_Press_Adaptive', 'Astaroth_Wing_Double_Press_Charged', 1660, -145);
  const allTri = combo(builder, pages.headTail, 'Head_Tail_TriCombo', 'Astaroth_Head_Tail_Combo', 1660, 25);
  builder.edge(allRandom, roar, 'random-0', 'exec-in');
  builder.edge(allRandom, allBreath, 'random-1', 'exec-in');
  builder.edge(allRandom, allWing, 'random-2', 'exec-in');
  builder.edge(allRandom, allTri, 'random-3', 'exec-in');

  const chargedDist = builder.node('dist', T.DIST_SELECTOR, 520, 585, {
    distances: [350, 600, 1000, 2000],
  });
  const unchargedDist = builder.node('dist', T.DIST_SELECTOR, 520, 1820, {
    distances: [350, 600, 1000, 2000],
  });
  builder.edge(hasCharged, chargedDist, 'exec-true', 'exec-in');
  builder.edge(hasCharged, unchargedDist, 'exec-false', 'exec-in');

  const partClose = builder.node('random', T.RANDOM_SELECTOR, 980, 315, { randomWeights: [55, 30, 15, 20, 10, 8] });
  const partMid = builder.node('random', T.RANDOM_SELECTOR, 980, 760, { randomWeights: [35, 35, 25, 15, 10] });
  const partFar = builder.node('random', T.RANDOM_SELECTOR, 980, 1185, { randomWeights: [40, 30, 25, 15] });
  const partTooFar = approach(builder, 980, 1450, 600);
  builder.edge(chargedDist, partClose, 'dist-0', 'exec-in');
  builder.edge(chargedDist, partMid, 'dist-1', 'exec-in');
  builder.edge(chargedDist, partFar, 'dist-2', 'exec-in');
  builder.edge(chargedDist, partTooFar, 'dist-last', 'exec-in');

  const closeTri = combo(builder, pages.headTail, 'Head_Tail_TriCombo', 'Astaroth_Head_Tail_Combo', 1450, 245);
  const closeWing = conditionWithVar(builder, '翅膀是否充能', 1450, 405, 'WingCharged');
  const closeTail = combo(builder, pages.tailGround, 'Tail_Ground_Spike_Check', 'Astaroth_Tail_Ground_Spike_Uncharged', 1450, 640);
  const closeOverhead = combo(builder, pages.backOverhead, 'BackStep_Overhead_Slam', 'Astaroth_Overhead_Slam_Charged', 1450, 820);
  const closeAir = combo(builder, pages.airLanding, 'Air_Approach_Breath_TailLanding', 'Astaroth_Breath_Uncharged', 1450, 995);
  const closeAirTailHead = combo(builder, pages.airTailHeadWing, 'Air_Tail_HeadSlam_WingLanding', 'Astaroth_Tail_Thrust', 1450, 1175);
  const closeWingCharged = combo(builder, pages.wingAdaptive, 'Wing_Double_Press_Adaptive', 'Astaroth_Wing_Double_Press_Charged', 1860, 360);
  const closeWingUncharged = combo(builder, pages.backWing, 'BackStep_WingPress_ByCharge', 'Astaroth_Wing_Press_Uncharged', 1860, 520);
  builder.edge(partClose, closeTri, 'random-0', 'exec-in');
  builder.edge(partClose, closeWing, 'random-1', 'exec-in');
  builder.edge(partClose, closeTail, 'random-2', 'exec-in');
  builder.edge(partClose, closeOverhead, 'random-3', 'exec-in');
  builder.edge(partClose, closeAir, 'random-4', 'exec-in');
  builder.edge(partClose, closeAirTailHead, 'random-5', 'exec-in');
  builder.edge(closeWing, closeWingCharged, 'exec-true', 'exec-in');
  builder.edge(closeWing, closeWingUncharged, 'exec-false', 'exec-in');

  const midHead = conditionWithVar(builder, '头部是否充能', 1450, 720, 'HeadCharged');
  const midWing = conditionWithVar(builder, '翅膀是否充能', 1450, 910, 'WingCharged');
  const midBreath = combo(builder, pages.doubleBreath, 'BackStep_DoubleBreath_Press', 'Astaroth_Double_Breath_Combo', 1450, 1110);
  const midTri = combo(builder, pages.headTail, 'Head_Tail_TriCombo', 'Astaroth_Head_Tail_Combo', 1450, 1280);
  const midOverhead = combo(builder, pages.backOverhead, 'BackStep_Overhead_Slam', 'Astaroth_Overhead_Slam_Charged', 1450, 1450);
  const midBiteHead = combo(builder, pages.biteHead, 'CheckBite_HeadSlam_Combo', 'Astaroth_Check_Bite', 1860, 660);
  const midHeadPlain = action(builder, 'Astaroth_Head_Slam_Uncharged', 1860, 820);
  const midWingCharged = combo(builder, pages.wingAdaptive, 'Wing_Double_Press_Adaptive', 'Astaroth_Wing_Double_Press_Charged', 1860, 915);
  const midWingPlain = action(builder, 'Astaroth_Wing_Press_Uncharged', 1860, 1075);
  builder.edge(partMid, midHead, 'random-0', 'exec-in');
  builder.edge(partMid, midWing, 'random-1', 'exec-in');
  builder.edge(partMid, midBreath, 'random-2', 'exec-in');
  builder.edge(partMid, midTri, 'random-3', 'exec-in');
  builder.edge(partMid, midOverhead, 'random-4', 'exec-in');
  builder.edge(midHead, midBiteHead, 'exec-true', 'exec-in');
  builder.edge(midHead, midHeadPlain, 'exec-false', 'exec-in');
  builder.edge(midWing, midWingCharged, 'exec-true', 'exec-in');
  builder.edge(midWing, midWingPlain, 'exec-false', 'exec-in');

  const farHead = conditionWithVar(builder, '头部是否充能', 1450, 1165, 'HeadCharged');
  const farWing = conditionWithVar(builder, '翅膀是否充能', 1450, 1360, 'WingCharged');
  const farAir = combo(builder, pages.airLanding, 'Air_Approach_Breath_TailLanding', 'Astaroth_Breath_Uncharged', 1450, 1550);
  const farDash = action(builder, 'Astaroth_Dash_Bite', 1450, 1720);
  const farDouble = combo(builder, pages.doubleBreath, 'BackStep_DoubleBreath_Press', 'Astaroth_Double_Breath_Combo', 1860, 1165);
  const farBreath = combo(builder, pages.backBreath, 'BackStep_Breath_Uncharged', 'Astaroth_Breath_Uncharged', 1860, 1310);
  const farWingDash = action(builder, 'Astaroth_Dash_Wing_Press_Charged', 1860, 1445);
  const farApproach = approach(builder, 1860, 1585, 600);
  builder.edge(partFar, farHead, 'random-0', 'exec-in');
  builder.edge(partFar, farWing, 'random-1', 'exec-in');
  builder.edge(partFar, farAir, 'random-2', 'exec-in');
  builder.edge(partFar, farDash, 'random-3', 'exec-in');
  builder.edge(farHead, farDouble, 'exec-true', 'exec-in');
  builder.edge(farHead, farBreath, 'exec-false', 'exec-in');
  builder.edge(farWing, farWingDash, 'exec-true', 'exec-in');
  builder.edge(farWing, farApproach, 'exec-false', 'exec-in');

  const tooFarDash = action(builder, 'Astaroth_Dash_Bite', 1280, 1450);
  builder.edge(partTooFar, tooFarDash, 'exec-out', 'exec-in');

  const unClose = builder.node('random', T.RANDOM_SELECTOR, 980, 1745, { randomWeights: [55, 18, 18, 9] });
  const unMid = builder.node('random', T.RANDOM_SELECTOR, 980, 2145, { randomWeights: [35, 30, 20, 15] });
  const unFar = builder.node('random', T.RANDOM_SELECTOR, 980, 2545, { randomWeights: [50, 30, 20] });
  const unTooFar = approach(builder, 980, 3080, 600);
  builder.edge(unchargedDist, unClose, 'dist-0', 'exec-in');
  builder.edge(unchargedDist, unMid, 'dist-1', 'exec-in');
  builder.edge(unchargedDist, unFar, 'dist-2', 'exec-in');
  builder.edge(unchargedDist, unTooFar, 'dist-last', 'exec-in');

  const unCloseTri = combo(builder, pages.headTail, 'Head_Tail_TriCombo', 'Astaroth_Head_Tail_Combo', 1450, 1700);
  const unCloseTail = combo(builder, pages.tailGround, 'Tail_Ground_Spike_Check', 'Astaroth_Tail_Ground_Spike_Uncharged', 1450, 1880);
  const unCloseWing = combo(builder, pages.backWing, 'BackStep_WingPress_ByCharge', 'Astaroth_Wing_Press_Uncharged', 1450, 2060);
  const unCloseHead = action(builder, 'Astaroth_Head_Slam_Uncharged', 1450, 2240);
  builder.edge(unClose, unCloseTri, 'random-0', 'exec-in');
  builder.edge(unClose, unCloseTail, 'random-1', 'exec-in');
  builder.edge(unClose, unCloseWing, 'random-2', 'exec-in');
  builder.edge(unClose, unCloseHead, 'random-3', 'exec-in');

  const unMidWing = action(builder, 'Astaroth_Wing_Press_Uncharged', 1450, 2310);
  const unMidBreath = combo(builder, pages.backBreath, 'BackStep_Breath_Uncharged', 'Astaroth_Breath_Uncharged', 1450, 2480);
  const unMidHead = action(builder, 'Astaroth_Head_Slam_Uncharged', 1450, 2650);
  const unMidTri = combo(builder, pages.headTail, 'Head_Tail_TriCombo', 'Astaroth_Head_Tail_Combo', 1450, 2820);
  builder.edge(unMid, unMidWing, 'random-0', 'exec-in');
  builder.edge(unMid, unMidBreath, 'random-1', 'exec-in');
  builder.edge(unMid, unMidHead, 'random-2', 'exec-in');
  builder.edge(unMid, unMidTri, 'random-3', 'exec-in');

  const unFarDash = action(builder, 'Astaroth_Dash_Bite', 1450, 3020);
  const unFarApproach = approach(builder, 1450, 3185, 600);
  const unFarBreath = combo(builder, pages.backBreath, 'BackStep_Breath_Uncharged', 'Astaroth_Breath_Uncharged', 1450, 3350);
  const unFarHead = action(builder, 'Astaroth_Head_Slam_Uncharged', 1730, 3185);
  const unTooFarDash = action(builder, 'Astaroth_Dash_Bite', 1280, 3080);
  builder.edge(unFar, unFarDash, 'random-0', 'exec-in');
  builder.edge(unFar, unFarApproach, 'random-1', 'exec-in');
  builder.edge(unFar, unFarBreath, 'random-2', 'exec-in');
  builder.edge(unFarApproach, unFarHead, 'exec-out', 'exec-in');
  builder.edge(unTooFar, unTooFarDash, 'exec-out', 'exec-in');
}

function validateTree(tree) {
  const errors = [];
  const allActions = new Set(actions.map((action) => action.actionId).filter(Boolean));
  const allNodeIds = new Set();
  const allEdgeIds = new Set();
  const pageById = new Map(tree.pages.map((page) => [page.id, page]));

  const validateScope = (label, nodes, edges) => {
    const nodeIds = new Set(nodes.map((node) => node.id));
    for (const node of nodes) {
      if (allNodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
      allNodeIds.add(node.id);
      if (node.data.actionId && !allActions.has(node.data.actionId)) {
        errors.push(`${label}: missing actionId ${node.data.actionId} on ${node.id}`);
      }
      if (node.data.type === T.COMBO) {
        const page = node.data.functionId ? pageById.get(node.data.functionId) : undefined;
        if (!page) errors.push(`${label}: combo ${node.id} references missing page ${node.data.functionId}`);
        if (page && page.name !== node.data.label) {
          errors.push(`${label}: combo ${node.id} label ${node.data.label} does not match page ${page.name}`);
        }
      }
    }
    for (const edge of edges) {
      if (allEdgeIds.has(edge.id)) errors.push(`Duplicate edge id: ${edge.id}`);
      allEdgeIds.add(edge.id);
      if (!nodeIds.has(edge.source)) errors.push(`${label}: edge ${edge.id} missing source ${edge.source}`);
      if (!nodeIds.has(edge.target)) errors.push(`${label}: edge ${edge.id} missing target ${edge.target}`);
    }
  };

  validateScope(tree.mainPageName, tree.nodes, tree.edges);
  for (const page of tree.pages) validateScope(page.name, page.nodes, page.edges);

  if (errors.length) throw new Error(errors.join('\n'));
}

function spreadMainLayout(nodes) {
  for (const node of nodes) {
    if (node.data.type === T.COMMENT) {
      if (node.position.x >= 700) {
        node.position.x = 760;
        node.data.commentWidth = Math.round((node.data.commentWidth ?? 1200) * 1.35);
      }
      continue;
    }

    if (node.position.x >= -300) {
      node.position.x = Math.round(-300 + (node.position.x + 300) * 2.35);
    }
  }
}

const builder = new TreeBuilder('codex2');
const pages = makePages(builder);
buildMainTree(builder, pages);
spreadMainLayout(builder.nodes);

const tree = {
  nodes: builder.nodes,
  edges: builder.edges,
  variables,
  functions: [],
  mainPageName: 'Combat_Main_CodeX_2.0',
  pages: builder.pages,
};

validateTree(tree);
fs.writeFileSync(outputPath, `${JSON.stringify(tree, null, 2)}\n`);

console.log(`Generated ${path.relative(repoRoot, outputPath)}`);
console.log(`Main: ${tree.nodes.length} nodes, ${tree.edges.length} edges`);
for (const page of tree.pages) {
  console.log(`Page ${page.name}: ${page.nodes.length} nodes, ${page.edges.length} edges`);
}
