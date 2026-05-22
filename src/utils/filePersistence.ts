export type TreeFileHandle = FileSystemFileHandle;

type LocalTreeResponse =
  | {
      ok: true;
      fileName: string;
      path: string;
      json?: string;
    }
  | {
      ok: false;
      error: string;
    };

type JsonFilePickerOptions = {
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  excludeAcceptAllOption?: boolean;
};

type OpenTreeFilePickerOptions = JsonFilePickerOptions & {
  multiple?: false;
};

type SaveTreeFilePickerOptions = JsonFilePickerOptions & {
  suggestedName?: string;
};

type WindowWithFileSystemAccess = Window &
  typeof globalThis & {
    showOpenFilePicker?: (options?: OpenTreeFilePickerOptions) => Promise<TreeFileHandle[]>;
    showSaveFilePicker?: (options?: SaveTreeFilePickerOptions) => Promise<TreeFileHandle>;
  };

const JSON_FILE_OPTIONS = {
  types: [
    {
      description: 'Behavior Tree JSON',
      accept: { 'application/json': ['.json'] },
    },
  ],
  excludeAcceptAllOption: false,
} satisfies JsonFilePickerOptions;

const fileSystemWindow = window as WindowWithFileSystemAccess;

export function supportsFileSystemAccess(): boolean {
  return Boolean(fileSystemWindow.showOpenFilePicker && fileSystemWindow.showSaveFilePicker);
}

export async function openDefaultTreeFile(): Promise<{ name: string; path: string; json: string }> {
  const response = await fetch('/api/local-tree');
  const data = (await response.json()) as LocalTreeResponse;
  if (!response.ok || !data.ok || typeof data.json !== 'string') {
    throw new Error(data.ok ? 'Default tree file did not include JSON.' : data.error);
  }

  return {
    name: data.fileName,
    path: data.path,
    json: data.json,
  };
}

export async function saveDefaultTreeFile(json: string): Promise<{ name: string; path: string }> {
  const response = await fetch('/api/local-tree', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json }),
  });
  const data = (await response.json()) as LocalTreeResponse;
  if (!response.ok || !data.ok) {
    throw new Error(data.ok ? 'Failed to save default tree file.' : data.error);
  }

  return {
    name: data.fileName,
    path: data.path,
  };
}

export async function openTreeFile(): Promise<{ handle?: TreeFileHandle; name: string; json: string }> {
  if (fileSystemWindow.showOpenFilePicker) {
    try {
      const [handle] = await fileSystemWindow.showOpenFilePicker({
        ...JSON_FILE_OPTIONS,
        multiple: false,
      });
      const file = await handle.getFile();
      return {
        handle,
        name: file.name,
        json: await file.text(),
      };
    } catch (error) {
      if (isAbortError(error)) throw error;
      console.warn('File handle open failed, falling back to file input:', error);
    }
  }

  const file = await pickInputFile();
  return {
    name: file.name,
    json: await file.text(),
  };
}

export async function saveTreeFile(handle: TreeFileHandle, json: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(json);
  await writable.close();
}

export async function saveTreeFileAs(json: string, suggestedName: string): Promise<{ handle?: TreeFileHandle; name: string }> {
  if (fileSystemWindow.showSaveFilePicker) {
    try {
      const handle = await fileSystemWindow.showSaveFilePicker({
        ...JSON_FILE_OPTIONS,
        suggestedName,
      });
      await saveTreeFile(handle, json);
      return { handle, name: handle.name };
    } catch (error) {
      if (isAbortError(error)) throw error;
      console.warn('File handle save failed, falling back to download:', error);
    }
  }

  downloadTreeFile(json, suggestedName);
  return { name: suggestedName };
}

export function downloadTreeFile(json: string, fileName: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function pickInputFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new DOMException('No file selected', 'AbortError'));
      }
    };
    input.click();
  });
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}
