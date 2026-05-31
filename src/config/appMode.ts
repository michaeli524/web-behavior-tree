export type AppMode = 'edit' | 'showcase';

const rawMode = import.meta.env.VITE_APP_MODE;

export const appMode: AppMode = rawMode === 'showcase' ? 'showcase' : 'edit';
export const isShowcaseMode = appMode === 'showcase';
export const isEditMode = appMode === 'edit';

