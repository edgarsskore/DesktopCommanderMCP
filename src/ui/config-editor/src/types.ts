/**
 * Shared type contracts for Config Editor data models and host/tool interaction payloads. These definitions prevent runtime shape drift between parser, UI state, and RPC calls.
 */
export interface ConfigStructuredContent {
  config: Record<string, unknown>;
  editableKeys: string[];
  warnings?: string[];
}

export interface ToolResultShape {
  structuredContent?: ConfigStructuredContent;
}

export interface ToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export type HostCallTool = (request: ToolCallRequest) => Promise<any>;

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
