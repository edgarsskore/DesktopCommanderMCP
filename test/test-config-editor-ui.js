/**
 * Coverage for Config Editor UI resource wiring and rendering behavior. These tests verify expected HTML/resource output and guard against regressions in config app setup.
 */
import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { isTrustedParentMessageSource } from '../dist/ui/shared/rpc-client.js';
import { parseConfigStructuredContent } from '../dist/ui/config-editor/src/utils/parsing.js';
import { serializeConfigValue, buildSetConfigRequest } from '../dist/ui/config-editor/src/utils/config-values.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_CONFIG_HTML = path.join(__dirname, '..', 'dist', 'ui', 'config-editor', 'index.html');

async function testStructuredContentParsing() {
  console.log('\n--- Test: config structured content parse ---');
  const payload = parseConfigStructuredContent({
    structuredContent: {
      config: { telemetryEnabled: true, fileReadLineLimit: 1000 },
      editableKeys: ['telemetryEnabled', 'fileReadLineLimit'],
      warnings: []
    }
  });

  assert.ok(payload, 'Should parse valid structured content');
  assert.strictEqual(payload.config.telemetryEnabled, true, 'Should preserve config values');
  assert.strictEqual(payload.editableKeys.length, 2, 'Should parse editable keys');
  console.log('✓ config structured content parse passed');
}

async function testValueSerialization() {
  console.log('\n--- Test: config value serialization ---');
  assert.strictEqual(serializeConfigValue('true'), true, 'boolean true string should parse to boolean');
  assert.strictEqual(serializeConfigValue('42'), 42, 'numeric string should parse to number');
  assert.deepStrictEqual(serializeConfigValue('["/tmp"]'), ['/tmp'], 'json array should parse to array');
  assert.strictEqual(serializeConfigValue('plain-string'), 'plain-string', 'plain string should remain string');
  console.log('✓ config value serialization passed');
}

async function testSetConfigRequestBuilder() {
  console.log('\n--- Test: set_config request builder ---');
  const request = buildSetConfigRequest('telemetryEnabled', false);
  assert.strictEqual(request.name, 'set_config_value', 'Tool name should match set_config_value');
  assert.deepStrictEqual(request.arguments, { key: 'telemetryEnabled', value: false }, 'Arguments should include key/value');
  console.log('✓ set_config request builder passed');
}

async function testMessageSourceTrustCheck() {
  console.log('\n--- Test: message source trust check ---');
  const parentWindow = { name: 'parent' };
  const otherWindow = { name: 'other' };

  assert.strictEqual(isTrustedParentMessageSource(parentWindow, parentWindow), true, 'Parent source should be trusted');
  assert.strictEqual(isTrustedParentMessageSource(otherWindow, parentWindow), false, 'Non-parent source should be rejected');
  assert.strictEqual(isTrustedParentMessageSource(null, parentWindow), false, 'Null source should be rejected');
  console.log('✓ message source trust check passed');
}

async function testBuildArtifact() {
  console.log('\n--- Test: config editor build artifact exists ---');
  const html = await fs.readFile(DIST_CONFIG_HTML, 'utf8');
  assert.ok(html.includes('config-editor-runtime.js'), 'Config editor HTML should reference bundled runtime entrypoint');
  console.log('✓ config editor build artifact exists');
}

export default async function runTests() {
  try {
    await testStructuredContentParsing();
    await testValueSerialization();
    await testSetConfigRequestBuilder();
    await testMessageSourceTrustCheck();
    await testBuildArtifact();
    console.log('\n✅ Config editor UI tests passed!');
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
