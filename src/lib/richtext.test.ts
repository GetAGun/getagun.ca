import { describe, expect, it } from 'vitest';
import { richtextHtml } from './richtext';

describe('richtextHtml', () => {
  it('escapes HTML', () => {
    expect(richtextHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
  it('renders http(s) and site-relative links', () => {
    expect(richtextHtml('see [the list](https://getagun.ca/x)')).toContain('<a href="https://getagun.ca/x"');
    expect(richtextHtml('see [the list](/sheets/x.html)')).toContain('<a href="/sheets/x.html"');
  });
  it('rejects javascript: and other schemes', () => {
    const out = richtextHtml('[x](javascript:alert(1))');
    expect(out).not.toContain('<a');
    expect(out).toContain('[x](javascript:alert(1))');
  });
  it('escapes quotes so hrefs cannot be broken out of', () => {
    expect(richtextHtml('[x](https://a.b/"onmouseover="alert(1))')).not.toContain('onmouseover="');
  });
  it('renders bold and italic', () => {
    expect(richtextHtml('**b** and *i*')).toBe('<strong>b</strong> and <em>i</em>');
  });
  it('does not mangle URLs containing asterisks or brackets in labels', () => {
    expect(richtextHtml('[a*b](https://x.y/p*q)')).toContain('href="https://x.y/p*q"');
  });
  it('leaves plain text alone', () => {
    expect(richtextHtml('plain text, nothing else')).toBe('plain text, nothing else');
  });
  it('leaves standalone numbers alone even next to links', () => {
    expect(richtextHtml('open 9 to 5, see [x](https://a.b)')).toContain('open 9 to 5,');
  });
  it('renders site-relative and https images', () => {
    const out = richtextHtml('chart:\n![CT by province](/sheets/ct.png)');
    expect(out).toContain('<img src="/sheets/ct.png" alt="CT by province"');
  });
  it('rejects unsafe image sources', () => {
    expect(richtextHtml('![x](javascript:alert(1))')).not.toContain('<img');
  });
  it('image and link can coexist with numbers intact', () => {
    const out = richtextHtml('5 stores: [list](/sheets/a) and ![img](/sheets/b.png) — 7 more');
    expect(out).toContain('<a href="/sheets/a"');
    expect(out).toContain('<img src="/sheets/b.png"');
    expect(out).toContain('5 stores:');
    expect(out).toContain('— 7 more');
  });
});
