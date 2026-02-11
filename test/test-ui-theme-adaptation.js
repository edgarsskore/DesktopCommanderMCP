/**
 * Tests for light/dark theme adaptation logic in shared UI helpers. It validates class/token switching behavior to prevent visual regressions across host themes.
 */
import assert from 'assert';

import {
  resolveThemeMode,
  createUiThemeAdapter,
} from '../dist/ui/shared/theme-adaptation.js';

function testResolveThemeMode() {
  console.log('\n--- Test: theme mode resolution ---');
  assert.strictEqual(resolveThemeMode('dark'), 'dark', 'Direct dark mode should resolve');
  assert.strictEqual(resolveThemeMode('LIGHT'), 'light', 'Case-insensitive mode should resolve');
  assert.strictEqual(
    resolveThemeMode({ params: { context: { theme: 'dark' } } }),
    'dark',
    'Nested mode should resolve from RPC payload shape',
  );
  assert.strictEqual(resolveThemeMode({ theme: 'unknown' }), undefined, 'Unknown mode should be ignored');
  console.log('✓ theme mode resolution passed');
}

function testThemeAdapterAppliesThemeAndVariables() {
  console.log('\n--- Test: theme adapter applies mode + css variables ---');
  const styleValues = new Map();
  const fakeRoot = {
    dataset: {},
    style: {
      colorScheme: '',
      setProperty(name, value) {
        styleValues.set(name, value);
      },
    },
  };

  const adapter = createUiThemeAdapter(fakeRoot);
  const changed = adapter.applyFromData({
    method: 'ui/notifications/host-context-changed',
    params: {
      context: {
        theme: 'dark',
        cssVariables: {
          '--color-background-primary': '#111827',
          color_text_primary: '#e5e7eb',
          '$bad': '#fff',
        },
      },
    },
  });

  assert.strictEqual(changed, true, 'Theme adapter should report changes');
  assert.strictEqual(fakeRoot.dataset.theme, 'dark', 'Theme mode should be applied to dataset');
  assert.strictEqual(fakeRoot.style.colorScheme, 'dark', 'colorScheme should match resolved mode');
  assert.strictEqual(
    styleValues.get('--color-background-primary'),
    '#111827',
    'Valid css variables should be forwarded',
  );
  assert.strictEqual(
    styleValues.get('--color_text_primary'),
    '#e5e7eb',
    'Variable names without leading -- should be normalized',
  );
  assert.strictEqual(styleValues.has('--$bad'), false, 'Unsafe variable names should be ignored');
  console.log('✓ theme adapter applies mode + css variables passed');
}

export default async function runTests() {
  try {
    testResolveThemeMode();
    testThemeAdapterAppliesThemeAndVariables();
    console.log('\n✅ UI theme adaptation tests passed!');
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
