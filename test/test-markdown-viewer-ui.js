/**
 * Tests for markdown/file preview UI behavior, especially markdown rendering paths. It validates resource payloads and preview output assumptions used by clients.
 */
import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { renderMarkdown } from '../dist/ui/file-preview/src/components/markdown-renderer.js';
import { formatJsonIfPossible, inferLanguageFromPath, renderCodeViewer } from '../dist/ui/file-preview/src/components/code-viewer.js';
import { renderHtmlPreview } from '../dist/ui/file-preview/src/components/html-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PREVIEW_HTML = path.join(__dirname, '..', 'dist', 'ui', 'file-preview', 'index.html');

async function testMarkdownRendering() {
  console.log('\n--- Test: markdown renderer smoke ---');
  const html = renderMarkdown('# Preview\n\n- item one\n- item two\n\n```js\nconst value = 1;\n```');

  assert.ok(html.includes('<h1>Preview</h1>'), 'Should render heading');
  assert.ok(html.includes('<ul>') && html.includes('<li>item one</li>'), 'Should render markdown lists');
  assert.ok(html.includes('class="hljs') || html.includes('hljs-keyword'), 'Should apply highlight.js classes');
  console.log('✓ markdown renderer smoke passed');
}

async function testTextFallbackRendering() {
  console.log('\n--- Test: text fallback smoke ---');
  const html = renderCodeViewer('plain text', 'text');
  assert.ok(html.includes('plain text'), 'Text fallback should contain content');
  assert.ok(html.includes('class="code-viewer"') || html.includes('class="hljs'), 'Text fallback should use code viewer container');
  console.log('✓ text fallback smoke passed');
}

async function testJsonFormattingAndHighlighting() {
  console.log('\n--- Test: json formatting + highlighting smoke ---');
  const jsonSource = '{"a":1,"b":true}';
  const formatted = formatJsonIfPossible(jsonSource, '/tmp/example.json');

  assert.ok(!formatted.notice, 'Valid JSON should format silently without notice');
  assert.ok(formatted.content.includes('\n  \"a\": 1'), 'JSON should be pretty formatted');
  assert.strictEqual(inferLanguageFromPath('/tmp/example.json'), 'json', 'Language inference should detect json');

  const html = renderCodeViewer(formatted.content, 'json');
  assert.ok(html.includes('class="hljs') || html.includes('hljs-attr'), 'JSON highlighting should be present');
  console.log('✓ json formatting + highlighting smoke passed');
}

async function testHtmlRenderedAndSourceModes() {
  console.log('\n--- Test: html rendered/source smoke ---');
  const htmlInput = '<h1>Hello</h1><script>alert(1)</script><a href="javascript:alert(2)">x</a>';
  const rendered = renderHtmlPreview(htmlInput, 'rendered');
  assert.ok(rendered.html.includes('iframe'), 'Rendered mode should use sandboxed iframe');
  assert.ok(!rendered.html.includes('<script>alert(1)</script>'), 'Rendered mode should sanitize scripts');

  const source = renderHtmlPreview(htmlInput, 'source');
  assert.ok(source.html.includes('code-viewer') || source.html.includes('hljs'), 'Source mode should render highlighted source');
  console.log('✓ html rendered/source smoke passed');
}

async function testBuildArtifact() {
  console.log('\n--- Test: build artifact exists ---');
  const html = await fs.readFile(DIST_PREVIEW_HTML, 'utf8');
  assert.ok(html.includes('preview-runtime.js'), 'Preview HTML should reference bundled runtime entrypoint');
  console.log('✓ preview build artifact exists');
}

export default async function runTests() {
  try {
    await testMarkdownRendering();
    await testTextFallbackRendering();
    await testJsonFormattingAndHighlighting();
    await testHtmlRenderedAndSourceModes();
    await testBuildArtifact();
    console.log('\n✅ Markdown viewer UI tests passed!');
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
