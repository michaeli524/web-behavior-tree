# Astaroth BT Layout Reference

This note distills the user's manual cleanup in `public/电龙AI2026年6月4日.json`.

## What Changed From The Draft

The hand-tuned file keeps the same behavior structure as `public/电龙AI-CodeX-2.0.json`:

- main nodes: 83
- main edges: 75
- pages: 10
- functions: 0

The improvement is almost entirely layout and readability. Treat this as a lesson: first drafts can preserve logic but still fail as a readable blueprint.

Approximate main-tree crossing count improved from 24 to 19; execution-flow crossings improved from 17 to 12. The important correction is not just shorter lines, but keeping lines inside their behavior pool.

## Main Canvas Banding

Use separate horizontal bands for different behavior meanings:

| Band | Comment box | Internal columns |
|---|---|---|
| Global override | x -1060, y -610, w 1640, h 660 | root x -900, sequence x -665, global conditions x -390 to 355 |
| All-charged ordinary pool | x 915, y -995, w 2403, h about 925 | data/condition x 1150-1330, selectors x 1575-1610, leaves x 2035-2080 |
| Already charged by part | x 760, y 170, w 4253, h 1260 | distance x 1627, random selectors x 2708, guards/leaves x 3813, second leaves x 4776 |
| Uncharged ordinary pool | x 975, y 1700, w 4131, h 1180 | distance x 1840, random selectors x 2925, leaves x 4030 |
| Far/exit correction | x 760, y 2920, w 3861, h 700 | approach x 2790/3813, action/combo cleanup x 3120-4045 |

The user's manual change pulled the all-charged leaves left from x around 3600 to x around 2075. This is the clearest anti-ramen rule: do not leave selector outputs far outside their comment band.

## Leaf Pool Rules

- A selector should sit near the vertical center of the leaves it owns.
- Leaves owned by one selector should form a local stack in the same band.
- Keep second-stage condition guards near their resulting leaves.
- Do not reuse a far-right leaf column for multiple unrelated pools.
- If a branch conceptually belongs to another pool, either move it into that pool or extract it into a Combo page.

Bad pattern from draft: all-charged outputs start near the top but jump to a far-right leaf stack shared with other pools.

Good pattern from hand-tuned sample: all-charged `Dist Selector` and `Random Selector` stay within the upper comment band, and their leaves are nearby at x about 2075.

## Comment Boxes

Comment boxes are not decoration. They are semantic containers:

- Expand comment width/height to contain the actual leaves, not just the first few nodes.
- If a pool moves, move its comment with it.
- Keep observation notes separate on the left; do not let notes occupy the same lane as executable logic.
- In Combo pages, make the comment wide enough to cover the last action/branch endpoint.

Observed manual fixes:

- `Head_Tail_TriCombo` comment width increased from 1260 to about 1619.
- `BackStep_DoubleBreath_Press` comment width increased from 1500 to about 1940.
- All-charged main comment height increased to cover the newly pulled-up leaves.

## Data And Condition Placement

Boolean or numeric data nodes should stay local:

- `get-variable` belongs left or lower-left of its Condition.
- `distance-2d` and `angle-between-cw` can sit below-left when they would otherwise block exec flow.
- Data edges should be short and should not cross major execution branches.
- If a data edge crosses many exec lines, move both the data node and its Condition together.

Combo page examples:

- `Head_Tail_TriCombo`: `Angle Between CW` is below-left of the tail-angle Condition; the true branch goes to the tail thrust, false goes down to Reset.
- `BackStep_DoubleBreath_Press`: the close-distance check is placed after the double breath, with true and false leaves split into upper/lower local branches.

## Layout Audit Checklist

Before finishing a generated tree:

1. Compare against `public/电龙AI2026年6月4日.json`, not against the raw draft.
2. List main-tree edges longer than about 1600 canvas units.
3. For every long edge, ask whether it is high-level routing between bands. If not, move the target closer or extract a Combo page.
4. Check random-selector outputs. A random selector should not spray lines across unrelated comment boxes.
5. Check comment coverage. Every executable node in a semantic pool should visually sit inside the corresponding comment box.
6. Check page-local chains. Root-to-action-to-condition sequences should read left to right with x gaps around 280-360.
7. Load the JSON in the editor and visually inspect the full canvas before claiming the generation is done.

