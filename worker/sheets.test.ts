import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildXlsx, ctChartSvg, percapitaWideSvg, sheetHtml } from './sheets';

describe('sheetHtml', () => {
  it('includes the sort script, as-of stamp, and archive link', () => {
    const html = sheetHtml('T', 'en', ['a', 'b'], [{ cells: ['x', 'y'] }], '/alt', '/x.xlsx', false, '2026-08-08 21:00:00');
    expect(html).toContain('data-sort-hint');
    expect(html).toContain('replaceChildren');
    expect(html).toContain('Data current as of');
    expect(html).toContain('UTC');
    expect(html).toContain('/sheets/archive');
  });

  it('formats the French stamp with a French date', () => {
    const html = sheetHtml('T', 'fr', ['a'], [{ cells: ['x'] }], '/alt', '/x.xlsx', false, '2026-08-08 21:00:00');
    expect(html).toContain('Données à jour au');
    expect(html).toContain('août');
  });
});

describe('buildXlsx', () => {
  it('produces a valid zip with cells, styles, and both sheets', () => {
    const data = buildXlsx([
      { name: 'One', rows: [{ cells: ['a', 'b'], style: 1 }, { cells: ['x', 42] }] },
      { name: 'Two', rows: [{ cells: ['only'] }] },
    ]);
    const files = unzipSync(data);
    expect(Object.keys(files)).toContain('xl/worksheets/sheet1.xml');
    expect(Object.keys(files)).toContain('xl/worksheets/sheet2.xml');
    const s1 = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(s1).toContain('<t xml:space="preserve">a</t>');
    expect(s1).toContain('<c r="B2"><v>42</v></c>');
    expect(s1).toContain('s="1"');
    expect(strFromU8(files['xl/workbook.xml'])).toContain('name="Two"');
  });

  it('escapes xml in cell values', () => {
    const files = unzipSync(buildXlsx([{ name: 'S', rows: [{ cells: ['a<b>&"c"'] }] }]));
    expect(strFromU8(files['xl/worksheets/sheet1.xml'])).toContain('a&lt;b&gt;&amp;&quot;c&quot;');
  });
});

describe('charts', () => {
  it('ct chart ranks by yes-rate and totals correctly', () => {
    const svg = ctChartSvg([
      { prov: 'ON', yes: 10, no: 30 },
      { prov: 'SK', yes: 9, no: 1 },
    ], false);
    expect(svg).toContain('width="1218" height="994"');
    expect(svg.indexOf('>SK<')).toBeLessThan(svg.indexOf('>ON<'));
    expect(svg).toContain('>Canada<');
    expect(svg).toContain('>19<'); // total yes
    expect(svg).toContain('90%');
  });

  it('per-capita chart formats French numbers and asterisks territories', () => {
    const svg = percapitaWideSvg({ QC: 175, NU: 18 }, true);
    expect(svg).toContain('viewBox="0 0 2400 994"');
    expect(svg).toContain('>NU*<');
    expect(svg).toContain('9 016 222'); // QC population, thin-space separators
    expect(svg).toContain('42,6'); // NU rate, decimal comma
  });
});
