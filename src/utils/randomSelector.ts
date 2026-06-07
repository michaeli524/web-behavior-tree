import type { BTNodeData, BTNumericValue } from '../engine/types';

export const DEFAULT_RANDOM_WEIGHTS: BTNumericValue[] = [50, 30, 20];

const RANDOM_HANDLE_PREFIX = 'random-';

export function getRandomHandleId(weightId: string): string {
  return `${RANDOM_HANDLE_PREFIX}${weightId}`;
}

export function getRandomWeightIdFromHandle(handleId?: string | null): string | null {
  if (!handleId?.startsWith(RANDOM_HANDLE_PREFIX)) return null;
  return handleId.slice(RANDOM_HANDLE_PREFIX.length);
}

export function getRandomWeights(data: Pick<BTNodeData, 'randomWeights'>): BTNumericValue[] {
  return data.randomWeights ?? DEFAULT_RANDOM_WEIGHTS;
}

export function getRandomWeightIds(
  data: Pick<BTNodeData, 'randomWeights' | 'randomWeightIds'>
): string[] {
  const weights = getRandomWeights(data);
  const rawIds = data.randomWeightIds ?? [];
  const usedIds = new Set<string>();

  return weights.map((_, index) => {
    const rawId = rawIds[index]?.trim() || String(index);
    let id = rawId;
    let suffix = 2;

    while (usedIds.has(id)) {
      id = `${rawId}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(id);
    return id;
  });
}

export function createRandomWeightId(existingIds: string[]): string {
  const usedIds = new Set(existingIds);
  let id = `rw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  while (usedIds.has(id)) {
    id = `rw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  return id;
}

export function getRandomWeightByHandle(
  data: Pick<BTNodeData, 'randomWeights' | 'randomWeightIds'>,
  handleId?: string | null
): BTNumericValue {
  const weightId = getRandomWeightIdFromHandle(handleId);
  if (weightId === null) return 0;

  const weights = getRandomWeights(data);
  const ids = getRandomWeightIds(data);
  let index = ids.indexOf(weightId);

  if (index < 0 && !data.randomWeightIds?.length) {
    const legacyIndex = Number(weightId);
    if (Number.isInteger(legacyIndex) && legacyIndex >= 0) {
      index = legacyIndex;
    }
  }

  return index >= 0 ? weights[index] ?? 0 : 0;
}
