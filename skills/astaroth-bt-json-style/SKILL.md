---
name: astaroth-bt-json-style
description: Generate and revise Astaroth behavior-tree JSON in the web-behavior-tree project while matching the user's UE blueprint-like layout and connection style. Use when creating, editing, or re-layouting 电龙/Astaroth AI JSON files, translating observation notes into nodes, or directly manipulating public/*.json behavior trees.
---

# Astaroth BT JSON Style

## Inputs

- Treat `public/电龙AI.json` as the canonical style sample.
- Treat `public/config/Actions.json` as the only Action resource map. Do not invent `actionId`; leave a behavior as a comment, condition, or Combo page if no resource exists.
- Preserve existing variables and reuse their IDs:
  - `AllCharged`, `HeadCharged`, `WingCharged`, `TailCharged`
  - `SuperCharged`, `UltTimedUp`, `HasCharged？`

## JSON Rules

- Write valid exported tree JSON with top-level `nodes`, `edges`, `variables`, `functions`, `pages`, `mainPageName`.
- Every node must use `type: "bt-node"` and complete `data` fields compatible with `makeNodeData`.
- Keep Action node `data.label` as `Action`; express readable skill names through `actionId` and `Actions.json`.
- Use Chinese labels for Condition and Comment nodes so portfolio readers understand intent quickly.
- Use English page/Combo names, and keep every Combo node `label` equal to the referenced page `name`.
- For Combo nodes, set `data.type: "combo-show"`, `functionId` to the page id, `isCombo: true`, and a representative `actionId` when a preview MP4 exists.

## Layout Style

- Use a left-to-right blueprint read:
  - root/entry at far left
  - global state conditions next
  - distance selectors in the middle
  - random selectors and branch conditions to the right
  - Action/Combo leaves furthest right
- Keep generous spacing. Prefer x gaps of 180-260 between data node and condition, 420-700 between major logic stages, and y gaps of 130-220 between sibling branches.
- Use large comment boxes as background bands, not small labels. Put a comment behind each major lane: global override, uncharged, partially charged, all-charged, 350/600/1000+ distance, and Combo pages.
- Avoid dense crossing. If a branch would cross many wires, split it into a Combo page or move it into a separate vertical lane.
- Keep page-local combos simple and readable: root at x≈80-120, actions left-to-right with x gaps 260-360, condition/data checks below the action chain.

## Node Patterns

- Boolean condition:
  - `get-variable` at left/lower-left of the condition.
  - edge `Get:data-out -> Condition:data-in`.
  - edge execution through `Condition:exec-true` and `Condition:exec-false`.
- Distance bucket:
  - Use `dist-selector` with `distances` matching the observation (`[350,600,1000,2000]` or `[300,600,1200]`).
  - Connect handles as `dist-0`, `dist-1`, `dist-2`, `dist-last`.
- Random choice:
  - Use `random-selector` for observed frequency/probability pools.
  - Connect handles as `random-0`, `random-1`, etc.; set `randomWeights` to communicate relative frequency.
- Numeric/angle guard:
  - Put `distance-2d` or `angle-between-cw` below/left of a Condition.
  - Connect `data-out -> data-in`; use the Condition title to explain the result.
- Null or blocked branch:
  - Use `reset` for explicit "no follow-up / return to main tree" outcomes.
- Ordered action chain:
  - Connect `Action:exec-out -> next Action/Condition/Combo:exec-in`.

## Translation Heuristics

- Prioritize global overrides first: full charge, super charge, ult timer.
- Then split by charge state: uncharged vs any part charged vs all charged.
- Then split by distance: 350 close, 600 mid, 1000+ far.
- Convert repeated multi-hit observations into Combo pages:
  - small bite + tail sweep + tail thrust
  - backstep + breath / double breath + follow-up
  - adaptive wing press that inserts backstep when the target is too close
  - airborne approach + breath + landing tail option
  - airborne tail thrust + head slam chain, with possible side-flight approach into landing wing press
- Preserve uncertainty as comments or lower-weight Random branches instead of overclaiming.

## Validation

- Parse the generated JSON with Node before finishing.
- Check node IDs and edge IDs are unique.
- Check every edge source/target exists in the same tree or page.
- Check every Combo node references an existing page and its label matches page name.
- Check every non-empty `actionId` exists in `Actions.json`.
