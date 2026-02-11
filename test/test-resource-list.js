/**
 * Tests that assert UI/resource list registration and discoverability behavior. This protects tool resource catalogs from accidental omissions or ordering regressions.
 */
import assert from 'assert';

import { server } from '../dist/server.js';
import { getConfig } from '../dist/tools/config.js';
import { CONFIG_EDITOR_RESOURCE_URI, FILE_PREVIEW_RESOURCE_URI } from '../dist/ui/contracts.js';

function getRequestHandler(method) {
  const handlers = server._requestHandlers;
  assert.ok(handlers, 'Server request handlers should be initialized');
  const handler = handlers.get(method);
  assert.ok(handler, `Expected request handler for ${method}`);
  return handler;
}

async function testResourcesListIncludesPreview() {
  console.log('\n--- Test: resources/list includes preview resource ---');
  const resourcesListHandler = getRequestHandler('resources/list');
  const response = await resourcesListHandler({ method: 'resources/list' }, {});

  assert.ok(Array.isArray(response.resources), 'resources/list should return a resources array');

  const previewResource = response.resources.find((resource) => resource.uri === FILE_PREVIEW_RESOURCE_URI);
  assert.ok(previewResource, `Expected preview resource URI ${FILE_PREVIEW_RESOURCE_URI}`);
  assert.strictEqual(previewResource.mimeType, 'text/html;profile=mcp-app', 'Preview resource should use MCP Apps HTML profile');
  console.log('✓ resources/list exposes preview resource');
}

async function testResourcesListIncludesConfigEditor() {
  console.log('\n--- Test: resources/list includes config editor resource ---');
  const resourcesListHandler = getRequestHandler('resources/list');
  const response = await resourcesListHandler({ method: 'resources/list' }, {});

  assert.ok(Array.isArray(response.resources), 'resources/list should return a resources array');

  const configEditorResource = response.resources.find((resource) => resource.uri === CONFIG_EDITOR_RESOURCE_URI);
  assert.ok(configEditorResource, `Expected config editor resource URI ${CONFIG_EDITOR_RESOURCE_URI}`);
  assert.strictEqual(configEditorResource.mimeType, 'text/html;profile=mcp-app', 'Config editor resource should use MCP Apps HTML profile');
  console.log('✓ resources/list exposes config editor resource');
}

async function testResourceReadReturnsPreviewHtml() {
  console.log('\n--- Test: resources/read returns preview html ---');
  const resourcesReadHandler = getRequestHandler('resources/read');
  const response = await resourcesReadHandler({
    method: 'resources/read',
    params: { uri: FILE_PREVIEW_RESOURCE_URI }
  }, {});

  assert.ok(Array.isArray(response.contents), 'resources/read should return a contents array');
  assert.ok(response.contents.length > 0, 'resources/read should return at least one content item');
  assert.strictEqual(response.contents[0].uri, FILE_PREVIEW_RESOURCE_URI, 'resources/read should return requested URI');
  assert.strictEqual(response.contents[0].mimeType, 'text/html;profile=mcp-app', 'resources/read should return MCP Apps html mime type');
  assert.ok(response.contents[0].text.includes('<!doctype html>'), 'resources/read should return HTML content');
  assert.ok(response.contents[0].text.includes('<script>') && response.contents[0].text.includes('ui/initialize'), 'resources/read should inline preview runtime payload');
  console.log('✓ resources/read returns preview html');
}

async function testResourceReadReturnsConfigEditorHtml() {
  console.log('\n--- Test: resources/read returns config editor html ---');
  const resourcesReadHandler = getRequestHandler('resources/read');
  const response = await resourcesReadHandler({
    method: 'resources/read',
    params: { uri: CONFIG_EDITOR_RESOURCE_URI }
  }, {});

  assert.ok(Array.isArray(response.contents), 'resources/read should return a contents array');
  assert.ok(response.contents.length > 0, 'resources/read should return at least one content item');
  assert.strictEqual(response.contents[0].uri, CONFIG_EDITOR_RESOURCE_URI, 'resources/read should return requested URI');
  assert.strictEqual(response.contents[0].mimeType, 'text/html;profile=mcp-app', 'resources/read should return MCP Apps html mime type');
  assert.ok(response.contents[0].text.includes('<!doctype html>'), 'resources/read should return HTML content');
  console.log('✓ resources/read returns config editor html');
}

async function testReadFileToolMetadata() {
  console.log('\n--- Test: tools/list read_file app metadata ---');
  const toolsListHandler = getRequestHandler('tools/list');
  const response = await toolsListHandler({ method: 'tools/list' }, {});
  const readFileTool = response.tools.find((tool) => tool.name === 'read_file');
  assert.ok(readFileTool, 'read_file tool should be listed');
  assert.ok(readFileTool._meta, 'read_file tool should include _meta');
  assert.strictEqual(readFileTool._meta['ui/resourceUri'], FILE_PREVIEW_RESOURCE_URI, 'read_file should include ui/resourceUri metadata');
  assert.strictEqual(readFileTool._meta['openai/outputTemplate'], FILE_PREVIEW_RESOURCE_URI, 'read_file should include openai/outputTemplate metadata');
  assert.strictEqual(readFileTool._meta['openai/widgetAccessible'], true, 'read_file should enable widget tool access');
  console.log('✓ read_file tool app metadata exposed');
}

async function testGetConfigToolMetadata() {
  console.log('\n--- Test: tools/list get_config app metadata ---');
  const toolsListHandler = getRequestHandler('tools/list');
  const response = await toolsListHandler({ method: 'tools/list' }, {});
  const getConfigTool = response.tools.find((tool) => tool.name === 'get_config');
  assert.ok(getConfigTool, 'get_config tool should be listed');
  assert.ok(getConfigTool._meta, 'get_config tool should include _meta');
  assert.strictEqual(getConfigTool._meta['ui/resourceUri'], CONFIG_EDITOR_RESOURCE_URI, 'get_config should include ui/resourceUri metadata');
  assert.strictEqual(getConfigTool._meta['openai/outputTemplate'], CONFIG_EDITOR_RESOURCE_URI, 'get_config should include openai/outputTemplate metadata');
  assert.strictEqual(getConfigTool._meta['openai/widgetAccessible'], true, 'get_config should enable widget tool access');
  console.log('✓ get_config tool app metadata exposed');
}

async function testGetConfigStructuredContent() {
  console.log('\n--- Test: getConfig structured content ---');
  const response = await getConfig();

  assert.ok(Array.isArray(response.content), 'get_config should return text content');
  assert.ok(typeof response.structuredContent === 'object' && response.structuredContent !== null, 'get_config should return structuredContent object');
  assert.ok(typeof response.structuredContent.config === 'object' && response.structuredContent.config !== null, 'structuredContent should include config object');
  assert.ok(Array.isArray(response.structuredContent.editableKeys), 'structuredContent should include editableKeys array');
  console.log('✓ get_config structured content exposed');
}

async function testTrackUiEventToolAvailability() {
  console.log('\n--- Test: track_ui_event tool hidden from list ---');
  const toolsListHandler = getRequestHandler('tools/list');
  const response = await toolsListHandler({ method: 'tools/list' }, {});
  const trackUiEventTool = response.tools.find((tool) => tool.name === 'track_ui_event');
  assert.strictEqual(trackUiEventTool, undefined, 'track_ui_event tool should not be listed');
  console.log('✓ track_ui_event tool is hidden from tools/list');
}

export default async function runTests() {
  try {
    await testResourcesListIncludesPreview();
    await testResourcesListIncludesConfigEditor();
    await testResourceReadReturnsPreviewHtml();
    await testResourceReadReturnsConfigEditorHtml();
    await testReadFileToolMetadata();
    await testGetConfigToolMetadata();
    await testGetConfigStructuredContent();
    await testTrackUiEventToolAvailability();
    console.log('\n✅ Resource list tests passed!');
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Test failed:', message);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}
