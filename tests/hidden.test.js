// Issue #5: elements with the `hidden` attribute were still displayed, because
// author CSS such as `.empty-state { display: flex }` (css/style.css:715) and
// `.btn { display: inline-flex }` (css/style.css:316) beats the browser's
// built-in `[hidden] { display: none }` rule.
//
// Note: jsdom always treats [hidden] as display:none, whatever the CSS says,
// so it cannot reproduce this bug by rendering. Instead we check the
// stylesheet itself for the guard rule. The behaviour is proved in a real
// browser with before/after screenshots.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const css = readFileSync(resolve(root, 'css/style.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ''); // ignore comments
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

describe('hidden attribute is respected (#5)', () => {
  it('the stylesheet has a global [hidden] rule that forces display: none', () => {
    const rule = /(^|[\s,}])\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/;
    // Report a short message instead of dumping the whole stylesheet.
    expect(rule.test(css), 'css/style.css has no [hidden] { display: none !important } rule').toBe(true);
  });

  it('the elements that rely on it still use the hidden attribute in index.html', () => {
    expect(html).toMatch(/id="emptyState"[^>]*\shidden/);
    expect(html).toMatch(/id="cancelEditBtn"[^>]*\shidden/);
  });
});
