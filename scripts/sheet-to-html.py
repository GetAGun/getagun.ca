# Renders an .xlsx worksheet as a standalone HTML page so visitors can view it
# in the browser. Usage: python scripts/sheet-to-html.py <in.xlsx> <out.html> <title>
import html
import sys

import openpyxl

src, out, title = sys.argv[1], sys.argv[2], sys.argv[3]
ws = openpyxl.load_workbook(src, read_only=True).worksheets[0]
ws.reset_dimensions()  # declared dimensions can span every formatted (empty) row
rows = [
    [('' if v is None else str(v)) for v in row]
    for row in ws.iter_rows(values_only=True)
    if any(v not in (None, '') for v in row)
]
header, body = rows[0], rows[1:]
# drop trailing columns that are empty throughout (stray formatting widens sheets)
while header and not header[-1] and all(len(r) < len(header) or not r[len(header) - 1] for r in body):
    header = header[:-1]
    body = [r[: len(header)] for r in body]

def cell(v: str) -> str:
    if v.startswith('http://') or v.startswith('https://'):
        return f'<a href="{html.escape(v, quote=True)}" target="_blank" rel="noopener noreferrer">link</a>'
    return html.escape(v)

# Colour-code rows by the firearms yes/no column when present.
fi = header.index('firearms') if 'firearms' in header else None

def row_class(r: list) -> str:
    v = r[fi].strip().lower() if fi is not None and fi < len(r) else ''
    return {'yes': ' class="y"', 'no': ' class="n"', 'unknown': ' class="u"'}.get(v, '')

xlsx_name = src.rsplit('/', 1)[-1]
parts = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    f'<title>{html.escape(title)}</title>',
    '<link rel="icon" href="/favicon.ico">',
    '<style>',
    'body{margin:0;font-family:system-ui,sans-serif;color:#1e293b}',
    'header{display:flex;align-items:baseline;gap:1rem;flex-wrap:wrap;padding:1rem 1.25rem;background:#0f172a;color:#fff}',
    'header h1{margin:0;font-size:1.1rem}',
    'header a{color:#93c5fd;font-size:.85rem;text-decoration:none}',
    'header a:hover{text-decoration:underline}',
    '.wrap{overflow-x:auto}',
    'table{border-collapse:collapse;font-size:.85rem;min-width:100%}',
    'th{position:sticky;top:0;background:#1b703c;color:#fff;text-align:left;padding:.45rem .6rem;white-space:nowrap}',
    'td{padding:.4rem .6rem;border-bottom:1px solid #e2e8f0;white-space:nowrap}',
    'tbody tr:nth-child(even){background:#f8fafc}',
    'tbody tr.y{background:#dcfce7}',
    'tbody tr.n{background:#fee2e2}',
    'tbody tr.u{background:#fef9c3}',
    '.chip{padding:.15rem .5rem;border-radius:9999px;color:#1e293b;font-size:.75rem}',
    'td a{color:#2563eb}',
    '</style></head><body>',
    f'<header><h1>{html.escape(title)}</h1>',
    '<a href="/">&larr; getagun.ca</a>',
    f'<a href="{html.escape(xlsx_name)}" download>Download (.xlsx)</a>',
    f'<span style="font-size:.8rem;color:#94a3b8">{len(body)} rows</span>',
    '<span class="chip" style="background:#dcfce7">stocks firearms</span>' if fi is not None else '',
    '<span class="chip" style="background:#fee2e2">does not</span>' if fi is not None else '',
    '<span class="chip" style="background:#fef9c3">unknown</span>' if fi is not None else '',
    '</header><div class="wrap"><table><thead><tr>',
    *[f'<th>{html.escape(h)}</th>' for h in header],
    '</tr></thead><tbody>',
    *[f'<tr{row_class(r)}>{"".join(f"<td>{cell(v)}</td>" for v in r)}</tr>' for r in body],
    '</tbody></table></div></body></html>',
]
with open(out, 'w') as f:
    f.write(''.join(parts))
print(f'{out}: {len(body)} rows')
