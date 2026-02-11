/**
 * Input parsing and guard functions for Config Editor payloads. It defensively converts unknown host data into validated internal structures with clear failure handling.
 */
import type { ConfigStructuredContent, ToolResultShape } from '../types.js';
import { isObject } from '../types.js';

function isConfigStructuredContent(value: unknown): value is ConfigStructuredContent {
  if (!isObject(value)) {
    return false;
  }
  return isObject(value.config) && Array.isArray(value.editableKeys);
}

export function parseConfigStructuredContent(value: unknown): ConfigStructuredContent | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const candidate = value as ToolResultShape;
  if (isConfigStructuredContent(candidate.structuredContent)) {
    return candidate.structuredContent;
  }

  if (isConfigStructuredContent(value)) {
    return value;
  }

  return undefined;
}

export function extractStructuredContent(value: unknown): ConfigStructuredContent | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  if (value.method === 'ui/notifications/tool-result') {
    const params = value.params;
    const candidate = isObject(params) && isObject(params.result) ? params.result : params;
    return parseConfigStructuredContent(candidate);
  }

  return parseConfigStructuredContent(value);
}

export function unwrapToolResult(value: unknown): unknown {
  if (!isObject(value)) {
    return value;
  }
  if (isObject(value.result)) {
    return value.result;
  }
  return value;
}

export function extractToolText(value: unknown): string {
  if (!isObject(value) || !Array.isArray(value.content)) {
    return '';
  }
  const first = value.content[0];
  if (!isObject(first) || typeof first.text !== 'string') {
    return '';
  }
  return first.text;
}
