/**
 * Pure rendering helpers for Config Editor body/layout sections. It converts structured config data into editable view fragments and keeps DOM generation isolated from app logic.
 */
import { escapeHtml } from '../../../shared/escape-html.js';
import type { ConfigStructuredContent } from '../types.js';
import { formatValueForEditor } from '../utils/config-values.js';
import { renderConfigEditorToolbar } from './toolbar.js';

function renderKeyPreview(value: unknown): string {
  const rendered = formatValueForEditor(value).replace(/\s+/g, ' ').trim();
  if (rendered.length <= 56) {
    return rendered || '(empty)';
  }
  return `${rendered.slice(0, 56)}...`;
}

export function getAllowedDirectoriesWarning(key: string): string {
  if (key !== 'allowedDirectories') {
    return '';
  }
  return 'Set allowedDirectories to [], to grant access to full filesystem.';
}

export function renderConfigEditorLayout(
  payload: ConfigStructuredContent,
  selectedKey: string,
  isExpanded: boolean,
  callToolAvailable: boolean
): string {
  const editableKeys = payload.editableKeys;
  const selectedValue = formatValueForEditor(payload.config[selectedKey]);

  return `
    <main id="tool-shell" class="shell tool-shell ${isExpanded ? 'expanded' : 'collapsed'}">
      ${renderConfigEditorToolbar(isExpanded, callToolAvailable)}
      <section id="tool-panel" class="panel">
        <div id="status" class="status hidden" role="status" aria-live="polite"></div>
        <div class="editor-grid">
          <aside class="key-pane">
            <p class="pane-title">KEYS</p>
            <div id="key-accordion" class="key-accordion">
              ${editableKeys.map((key) => `
                <button type="button" class="key-accordion-item ${key === selectedKey ? 'active' : ''}" data-key="${escapeHtml(key)}" aria-expanded="${key === selectedKey ? 'true' : 'false'}">
                  <span class="key-accordion-title">${escapeHtml(key)}</span>
                  <span class="key-accordion-preview">${escapeHtml(renderKeyPreview(payload.config[key]))}</span>
                </button>
              `).join('')}
            </div>
          </aside>
          <section class="value-pane">
            <p class="pane-title">VALUE</p>
            <textarea id="config-value" rows="7">${escapeHtml(selectedValue)}</textarea>
            <div id="allowed-directories-controls" class="warning-row hidden">
              <button id="browse-directory" type="button" class="ghost icon-only" title="Browse directories" aria-label="Browse directories">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 4l2 2h8v12H4V4z"></path></svg>
              </button>
              <div id="context-warning" class="warnings hidden"></div>
            </div>
            <section id="directory-browser" class="browser hidden">
              <div class="browser-actions browser-actions--compact">
                <button id="browser-up" type="button" class="ghost icon-only" title="Up" aria-label="Up one directory">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 14l5-5 5 5z"></path></svg>
                </button>
                <button id="browser-refresh" type="button" class="ghost icon-only" title="Refresh" aria-label="Refresh directory list">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 12.65-5.65z"></path></svg>
                </button>
                <button id="browser-select-current" type="button" class="icon-only" title="Add current directory" aria-label="Add current directory">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"></path></svg>
                </button>
                <button id="close-browser" type="button" class="ghost icon-only" title="Close picker" aria-label="Close picker">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4l-6.3 6.3-1.42-1.42 6.3-6.29-6.3-6.29L4.29 4.3l6.3 6.3 6.3-6.3z"></path></svg>
                </button>
              </div>
              <p id="browser-path" class="browser-path browser-path--compact"></p>
              <div id="browser-status" class="browser-status"></div>
              <div id="browser-list" class="browser-list"></div>
            </section>
          </section>
        </div>
      </section>
    </main>
  `;
}

export function renderEmptyState(): string {
  return `
    <main class="shell">
      <section class="panel">
        <h1>Config Editor</h1>
        <p>No structured configuration payload is available.</p>
      </section>
    </main>
  `;
}
