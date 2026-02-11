/**
 * Toolbar renderer and event wiring for Config Editor actions. It exposes top-level controls (refresh/save/open path flows) and keeps header interaction logic localized.
 */
import { renderToolHeader } from '../../../shared/tool-header.js';

export function renderConfigEditorToolbar(isExpanded: boolean, callToolAvailable: boolean): string {
  return renderToolHeader({
    pillLabel: 'CFG',
    pillClassName: 'file-pill--json',
    title: 'Config Editor',
    subtitle: 'Inspect and update runtime config safely.',
    badges: [],
    actionsHtml: `
      <button class="icon-button icon-button--primary hidden" id="apply-config" type="button" title="Apply changes" aria-label="Apply changes" ${callToolAvailable ? '' : 'disabled'}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"></path></svg>
      </button>
      <button class="icon-button" id="toggle-expand" type="button" title="${isExpanded ? 'Collapse' : 'Expand'}" aria-label="${isExpanded ? 'Collapse' : 'Expand'}">${isExpanded
        ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 14l5-5 5 5z"></path></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 10l5 5 5-5z"></path></svg>'
      }</button>
    `
  });
}
