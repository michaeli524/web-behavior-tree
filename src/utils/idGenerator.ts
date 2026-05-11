let counter = 0;

export function generateId(prefix: string = 'node'): string {
  counter++;
  return `${prefix}_${Date.now()}_${counter}`;
}

export function resetIdCounter(): void {
  counter = 0;
}
