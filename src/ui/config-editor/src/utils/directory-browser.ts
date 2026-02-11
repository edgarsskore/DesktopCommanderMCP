/**
 * Directory browsing helpers used when config values reference filesystem paths. It encapsulates browse call orchestration and response validation for consistent UX.
 */
import { escapeHtml } from '../../../shared/escape-html.js';
import type { ConfigStructuredContent } from '../types.js';
import type { HostCallTool } from '../types.js';
import { isObject } from '../types.js';
import { extractToolText, unwrapToolResult } from './parsing.js';
import { serializeConfigValue } from './config-values.js';

type StatusTone = 'info' | 'success' | 'error';

export interface DirectoryBrowserElements {
  browseControls: HTMLElement | null;
  browseButton: HTMLButtonElement | null;
  browserPanel: HTMLElement | null;
  browserPath: HTMLElement | null;
  browserStatus: HTMLElement | null;
  browserList: HTMLElement | null;
}

interface DirectoryBrowserControllerOptions {
  callTool: HostCallTool | null;
  payload: ConfigStructuredContent;
  elements: DirectoryBrowserElements;
  onRender?: () => void;
  setStatus: (message: string, tone?: StatusTone) => void;
  getEditorValue: () => string;
  setEditorValue: (nextValue: string) => void;
  syncApplyVisibility: () => void;
}

export interface DirectoryBrowserController {
  syncControls: (activeKey: string) => void;
  toggle: () => Promise<void>;
  close: () => void;
  refresh: () => Promise<void>;
  navigateUp: () => Promise<void>;
  selectCurrent: () => void;
}

function getDefaultBrowsePath(payload: ConfigStructuredContent): string {
  const configured = payload.config.allowedDirectories;
  if (Array.isArray(configured) && configured.length > 0 && typeof configured[0] === 'string' && configured[0].trim().length > 0) {
    return configured[0];
  }

  const systemInfo = payload.config.systemInfo;
  if (isObject(systemInfo) && isObject(systemInfo.examplePaths) && typeof systemInfo.examplePaths.home === 'string') {
    return systemInfo.examplePaths.home;
  }

  return '/';
}

function splitDirectoryLine(line: string): string | null {
  const marker = '[DIR] ';
  if (!line.startsWith(marker)) {
    return null;
  }
  return line.slice(marker.length).trim();
}

function parseDirectoryEntries(listText: string): string[] {
  const lines = listText.split('\n');
  const entries: string[] = [];

  for (const line of lines) {
    const entry = splitDirectoryLine(line.trim());
    if (entry && !entry.includes('/') && !entry.includes('\\')) {
      entries.push(entry);
    }
  }

  return entries;
}

function joinPath(basePath: string, name: string): string {
  if (/^[A-Za-z]:\\?$/.test(basePath)) {
    return `${basePath.replace(/[\\/]+$/, '')}\\${name}`;
  }
  if (basePath.endsWith('/')) {
    return `${basePath}${name}`;
  }
  if (basePath.endsWith('\\')) {
    return `${basePath}${name}`;
  }
  return `${basePath}/${name}`;
}

function getParentPath(currentPath: string): string {
  if (!currentPath) {
    return '/';
  }

  if (/^[A-Za-z]:\\?$/.test(currentPath)) {
    return currentPath;
  }

  const normalized = currentPath.replace(/[\\/]+$/, '');
  if (normalized === '') {
    return '/';
  }

  const slashIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (slashIndex <= 0) {
    if (normalized.includes('\\')) {
      return normalized.slice(0, slashIndex + 1) || normalized;
    }
    return '/';
  }
  return normalized.slice(0, slashIndex);
}

function addDirectoryToEditorValue(currentRaw: string, selectedPath: string): string {
  const parsed = serializeConfigValue(currentRaw);
  const values = Array.isArray(parsed) ? [...parsed] : [];
  if (!values.includes(selectedPath)) {
    values.push(selectedPath);
  }
  return JSON.stringify(values, null, 2);
}

function renderDirectoryRows(directories: string[]): string {
  if (directories.length === 0) {
    return '<p class="browser-empty">No subdirectories found.</p>';
  }

  return directories.map((name) => `
    <div class="browser-item">
      <span class="browser-name"><span class="folder-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M10 4l2 2h8v12H4V4z"></path></svg></span>${escapeHtml(name)}</span>
      <div class="browser-row-actions">
        <button type="button" class="ghost browser-open icon-only" data-name="${escapeHtml(name)}" title="Open ${escapeHtml(name)}" aria-label="Open ${escapeHtml(name)}">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 17l5-5-5-5v10z"></path></svg>
        </button>
        <button type="button" class="browser-select icon-only" data-name="${escapeHtml(name)}" title="Add ${escapeHtml(name)}" aria-label="Add ${escapeHtml(name)} to allowed directories">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"></path></svg>
        </button>
      </div>
    </div>
  `).join('');
}

export function createDirectoryBrowserController(options: DirectoryBrowserControllerOptions): DirectoryBrowserController {
  const { callTool, payload, elements, onRender, setStatus, getEditorValue, setEditorValue, syncApplyVisibility } = options;
  const { browseControls, browseButton, browserPanel, browserPath, browserStatus, browserList } = elements;

  let browserCurrentPath = getDefaultBrowsePath(payload);
  let browserOpen = false;

  const selectCurrent = (): void => {
    const nextValue = addDirectoryToEditorValue(getEditorValue(), browserCurrentPath);
    setEditorValue(nextValue);
    setStatus(`Added ${browserCurrentPath} to allowedDirectories. Click Apply to save.`, 'info');
    syncApplyVisibility();
  };

  const bindDirectoryRowActions = (): void => {
    if (!browserList) {
      return;
    }

    const openButtons = Array.from(browserList.querySelectorAll<HTMLButtonElement>('.browser-open'));
    const selectButtons = Array.from(browserList.querySelectorAll<HTMLButtonElement>('.browser-select'));

    openButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const name = button.dataset.name;
        if (!name) {
          return;
        }
        browserCurrentPath = joinPath(browserCurrentPath, name);
        await refresh();
      });
    });

    selectButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const name = button.dataset.name;
        if (!name) {
          return;
        }
        browserCurrentPath = joinPath(browserCurrentPath, name);
        selectCurrent();
      });
    });
  };

  const refresh = async (): Promise<void> => {
    if (!callTool || !browserPath || !browserStatus || !browserList) {
      return;
    }

    browserPath.textContent = browserCurrentPath;
    browserStatus.textContent = `Loading ${browserCurrentPath}...`;
    browserList.innerHTML = '';

    try {
      const result = unwrapToolResult(await callTool({
        name: 'list_directory',
        arguments: { path: browserCurrentPath, depth: 1 },
      }));
      const directories = parseDirectoryEntries(extractToolText(result));
      browserStatus.textContent = '';
      browserList.innerHTML = renderDirectoryRows(directories);
      bindDirectoryRowActions();
      onRender?.();
    } catch (error) {
      browserStatus.textContent = `Failed to list ${browserCurrentPath}: ${error instanceof Error ? error.message : String(error)}`;
      onRender?.();
    }
  };

  const close = (): void => {
    browserOpen = false;
    browserPanel?.classList.add('hidden');
    browseButton?.classList.remove('active');
    onRender?.();
  };

  const syncControls = (activeKey: string): void => {
    const enabled = activeKey === 'allowedDirectories';
    browseControls?.classList.toggle('hidden', !enabled);
    browseButton?.classList.toggle('active', enabled && browserOpen);
    if (!enabled) {
      close();
    }
  };

  const toggle = async (): Promise<void> => {
    if (!callTool || !browserPanel) {
      setStatus('MCP RPC unavailable. Cannot browse directories from widget.', 'error');
      return;
    }

    browserOpen = !browserOpen;
    browserPanel.classList.toggle('hidden', !browserOpen);
    browseButton?.classList.toggle('active', browserOpen);

    if (browserOpen) {
      browserCurrentPath = getDefaultBrowsePath(payload);
      await refresh();
      return;
    }

    onRender?.();
  };

  const navigateUp = async (): Promise<void> => {
    const parent = getParentPath(browserCurrentPath);
    if (parent === browserCurrentPath) {
      return;
    }
    browserCurrentPath = parent;
    await refresh();
  };

  return {
    syncControls,
    toggle,
    close,
    refresh,
    navigateUp,
    selectCurrent,
  };
}
