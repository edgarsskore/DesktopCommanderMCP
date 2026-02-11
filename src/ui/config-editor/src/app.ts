/**
 * Main orchestration layer for the Config Editor UI. It wires RPC calls, parses host payloads, coordinates state updates, and connects UI components to tool actions.
 */
import { createWindowRpcClient, isTrustedParentMessageSource } from '../../shared/rpc-client.js';
import { createToolShellController, type ToolShellController } from '../../shared/tool-shell.js';
import { createUiHostLifecycle } from '../../shared/host-lifecycle.js';
import { createUiThemeAdapter } from '../../shared/theme-adaptation.js';
import type { ConfigStructuredContent, HostCallTool, ToolCallRequest } from './types.js';
import { isObject } from './types.js';
import {
  parseConfigStructuredContent,
  extractStructuredContent,
  unwrapToolResult,
} from './utils/parsing.js';
import {
  serializeConfigValue,
  buildSetConfigRequest,
  shouldAppendArrayValue,
  formatValueForEditor,
  valueToComparableJson,
} from './utils/config-values.js';
import {
  createDirectoryBrowserController,
} from './utils/directory-browser.js';
import {
  getAllowedDirectoriesWarning,
  renderConfigEditorLayout,
  renderEmptyState,
} from './components/layout.js';

type RenderHook = (() => void) | null;
let onRender: RenderHook = null;
let rpcCallTool: HostCallTool | null = null;
let isExpanded = false;
let shellController: ToolShellController | null = null;

interface DomRefs {
  accordionItems: HTMLButtonElement[];
  valueArea: HTMLTextAreaElement;
  submitButton: HTMLButtonElement;
  status: HTMLElement;
  contextWarning: HTMLElement | null;
  browseControls: HTMLElement | null;
  browseButton: HTMLButtonElement | null;
  browserPanel: HTMLElement | null;
  browserCloseButton: HTMLButtonElement | null;
  browserPath: HTMLElement | null;
  browserUpButton: HTMLButtonElement | null;
  browserRefreshButton: HTMLButtonElement | null;
  browserSelectCurrentButton: HTMLButtonElement | null;
  browserStatus: HTMLElement | null;
  browserList: HTMLElement | null;
  shell: HTMLElement | null;
  toggleExpandButton: HTMLButtonElement | null;
}

function getWindowCandidates(): unknown[] {
  return [
    (window as any).__DC_CONFIG_EDITOR__,
    (window as any).__MCP_TOOL_RESULT__,
    (window as any).toolResult,
    (window as any).structuredContent,
  ];
}

function readInitialPayload(): ConfigStructuredContent | undefined {
  for (const candidate of getWindowCandidates()) {
    const parsed = parseConfigStructuredContent(candidate);
    if (parsed) {
      return parsed;
    }
  }
  return undefined;
}

function getDomRefs(container: HTMLElement): DomRefs | null {
  const valueArea = container.querySelector<HTMLTextAreaElement>('#config-value');
  const submitButton = container.querySelector<HTMLButtonElement>('#apply-config');
  const status = container.querySelector<HTMLElement>('#status');

  if (!valueArea || !submitButton || !status) {
    return null;
  }

  return {
    accordionItems: Array.from(container.querySelectorAll<HTMLButtonElement>('.key-accordion-item')),
    valueArea,
    submitButton,
    status,
    contextWarning: container.querySelector<HTMLElement>('#context-warning'),
    browseControls: container.querySelector<HTMLElement>('#allowed-directories-controls'),
    browseButton: container.querySelector<HTMLButtonElement>('#browse-directory'),
    browserPanel: container.querySelector<HTMLElement>('#directory-browser'),
    browserCloseButton: container.querySelector<HTMLButtonElement>('#close-browser'),
    browserPath: container.querySelector<HTMLElement>('#browser-path'),
    browserUpButton: container.querySelector<HTMLButtonElement>('#browser-up'),
    browserRefreshButton: container.querySelector<HTMLButtonElement>('#browser-refresh'),
    browserSelectCurrentButton: container.querySelector<HTMLButtonElement>('#browser-select-current'),
    browserStatus: container.querySelector<HTMLElement>('#browser-status'),
    browserList: container.querySelector<HTMLElement>('#browser-list'),
    shell: container.querySelector<HTMLElement>('#tool-shell'),
    toggleExpandButton: container.querySelector<HTMLButtonElement>('#toggle-expand'),
  };
}

function renderApp(container: HTMLElement, payload: ConfigStructuredContent): void {
  shellController?.dispose();
  shellController = null;

  const editableKeys = payload.editableKeys;
  const selectedKey = editableKeys[0] ?? '';
  const callTool = rpcCallTool;

  const trackUiEvent = (event: string, params: Record<string, unknown> = {}): void => {
    if (!callTool) {
      return;
    }
    void callTool({
      name: 'track_ui_event',
      arguments: {
        event,
        component: 'config_editor',
        params: {
          tool_name: 'get_config',
          ...params,
        },
      },
    }).catch(() => {
      // Analytics failures should not impact UX.
    });
  };

  container.innerHTML = renderConfigEditorLayout(payload, selectedKey, isExpanded, Boolean(callTool));
  onRender?.();

  const dom = getDomRefs(container);
  if (!dom) {
    return;
  }

  const {
    accordionItems,
    valueArea,
    submitButton,
    status,
    contextWarning,
    browseControls,
    browseButton,
    browserPanel,
    browserCloseButton,
    browserPath,
    browserUpButton,
    browserRefreshButton,
    browserSelectCurrentButton,
    browserStatus,
    browserList,
    shell,
    toggleExpandButton,
  } = dom;

  let activeKey = selectedKey;
  const initialValuesByKey = new Map<string, string>(
    editableKeys.map((key) => [key, formatValueForEditor(payload.config[key])]),
  );

  const setStatus = (message: string, tone: 'info' | 'success' | 'error' = 'info'): void => {
    if (!message.trim()) {
      status.textContent = '';
      status.classList.add('hidden');
      status.classList.remove('status--info', 'status--success', 'status--error');
      return;
    }
    status.textContent = message;
    status.classList.remove('hidden', 'status--info', 'status--success', 'status--error');
    status.classList.add(`status--${tone}`);
  };

  const syncApplyVisibility = (): void => {
    const initial = initialValuesByKey.get(activeKey) ?? '';
    const dirty = valueToComparableJson(valueArea.value) !== valueToComparableJson(initial);
    submitButton.classList.toggle('hidden', !dirty || !callTool);
  };

  const directoryBrowser = createDirectoryBrowserController({
    callTool,
    payload,
    elements: {
      browseControls,
      browseButton,
      browserPanel,
      browserPath,
      browserStatus,
      browserList,
    },
    onRender: onRender ?? undefined,
    setStatus,
    getEditorValue: () => valueArea.value,
    setEditorValue: (nextValue) => {
      valueArea.value = nextValue;
    },
    syncApplyVisibility,
  });

  const syncContextWarning = (): void => {
    if (!contextWarning) {
      return;
    }

    const warning = getAllowedDirectoriesWarning(activeKey);
    if (!warning) {
      contextWarning.textContent = '';
      contextWarning.classList.add('hidden');
      contextWarning.classList.remove('warnings--info');
      return;
    }

    contextWarning.textContent = warning;
    contextWarning.classList.add('warnings--info');
    contextWarning.classList.remove('hidden');
  };

  const setActiveKey = (key: string): void => {
    if (!editableKeys.includes(key)) {
      return;
    }

    activeKey = key;
    valueArea.value = formatValueForEditor(payload.config[key]);

    accordionItems.forEach((item) => {
      const isActive = item.dataset.key === key;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    });

    setStatus('', 'info');
    directoryBrowser.syncControls(activeKey);
    syncContextWarning();
    syncApplyVisibility();
  };

  shellController = createToolShellController({
    shell,
    toggleButton: toggleExpandButton,
    initialExpanded: isExpanded,
    onToggle: (expanded) => {
      isExpanded = expanded;
      trackUiEvent(expanded ? 'expand' : 'collapse');
    },
    onScrollAfterExpand: () => {
      trackUiEvent('scroll_after_expand', { key: activeKey });
    },
    onRender: onRender ?? undefined,
  });

  accordionItems.forEach((item) => {
    item.addEventListener('click', () => {
      const key = item.dataset.key;
      if (key) {
        setActiveKey(key);
      }
    });
  });

  valueArea.addEventListener('input', () => {
    setStatus('', 'info');
    syncApplyVisibility();
  });

  submitButton.addEventListener('click', async () => {
    const serializedValue = serializeConfigValue(valueArea.value);
    const selectedConfigKey = activeKey;
    let requestValue: unknown = serializedValue;

    if (shouldAppendArrayValue(selectedConfigKey, serializedValue)) {
      const existing = payload.config[selectedConfigKey];
      const base = Array.isArray(existing) ? [...existing] : [];
      base.push(serializedValue);
      requestValue = base;
    }

    trackUiEvent('apply_clicked', { key: selectedConfigKey });

    if (!callTool) {
      setStatus('MCP RPC unavailable. Cannot apply changes from widget.', 'error');
      return;
    }

    try {
      setStatus('Applying...', 'info');
      const result = unwrapToolResult(await callTool(buildSetConfigRequest(selectedConfigKey, requestValue)));
      const responseText = isObject(result) && Array.isArray(result.content) && typeof result.content[0]?.text === 'string'
        ? result.content[0].text
        : 'Config updated.';
      setStatus(`${responseText} Refreshing config...`, 'info');

      const refreshed = unwrapToolResult(await callTool({ name: 'get_config', arguments: {} }));
      const nextPayload = parseConfigStructuredContent(refreshed);
      if (nextPayload) {
        setStatus('Config updated.', 'success');
        renderApp(container, nextPayload);
        return;
      }

      setStatus('Applied, but refresh returned no structured content.', 'error');
    } catch (error) {
      setStatus(`Failed to apply config: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  });

  browseButton?.addEventListener('click', async () => directoryBrowser.toggle());

  browserCloseButton?.addEventListener('click', () => directoryBrowser.close());

  browserRefreshButton?.addEventListener('click', async () => directoryBrowser.refresh());

  browserUpButton?.addEventListener('click', async () => directoryBrowser.navigateUp());

  browserSelectCurrentButton?.addEventListener('click', () => directoryBrowser.selectCurrent());

  directoryBrowser.syncControls(activeKey);
  syncContextWarning();
  syncApplyVisibility();
  setActiveKey(selectedKey);
}

export function bootstrapConfigEditor(): void {
  const container = document.getElementById('app');
  if (!container) {
    return;
  }

  const rpcClient = createWindowRpcClient({
    targetWindow: window.parent,
    timeoutMs: 15000,
    isTrustedSource: (source) => isTrustedParentMessageSource(source, window.parent),
  });
  const hostLifecycle = createUiHostLifecycle(rpcClient, {
    appName: 'Desktop Commander Config Editor',
    appVersion: '1.0.0',
  });
  const themeAdapter = createUiThemeAdapter();

  rpcCallTool = (request: ToolCallRequest) => rpcClient.request('tools/call', {
    name: request.name,
    arguments: request.arguments,
  });

  onRender = () => {
    hostLifecycle.notifyRender();
  };

  themeAdapter.applyFromData((window as any).__MCP_HOST_CONTEXT__);
  const payload = readInitialPayload();
  container.innerHTML = payload ? '' : renderEmptyState();
  if (payload) {
    renderApp(container, payload);
  } else {
    onRender?.();
  }

  window.addEventListener('message', (event) => {
    if (rpcClient.handleMessageEvent(event)) {
      return;
    }
    if (!isTrustedParentMessageSource(event.source, window.parent)) {
      return;
    }
    themeAdapter.applyFromData(event.data);

    const nextPayload = extractStructuredContent(event.data);
    if (nextPayload) {
      renderApp(container, nextPayload);
    }
  });

  hostLifecycle.observeResize();

  window.addEventListener('beforeunload', () => {
    shellController?.dispose();
    rpcClient.dispose();
  }, { once: true });
  hostLifecycle.initialize();
}
