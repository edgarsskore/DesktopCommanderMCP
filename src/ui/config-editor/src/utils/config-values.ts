/**
 * Normalization utilities for config values shown/edited in the UI. It handles stringify/parse edge cases so edits round-trip safely through tool calls.
 */
import type { ToolCallRequest } from '../types.js';

export function serializeConfigValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return '';
  }

  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  if (trimmed === 'null') {
    return null;
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }

  return raw;
}

export function buildSetConfigRequest(key: string, value: unknown): ToolCallRequest {
  return {
    name: 'set_config_value',
    arguments: {
      key,
      value
    }
  };
}

export function shouldAppendArrayValue(key: string, value: unknown): boolean {
  return (key === 'blockedCommands' || key === 'allowedDirectories') && typeof value === 'string' && value.trim().length > 0;
}

export function formatValueForEditor(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined) {
    return '';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function valueToComparableJson(raw: string): string {
  try {
    return JSON.stringify(serializeConfigValue(raw));
  } catch {
    return raw;
  }
}
