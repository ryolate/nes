from bs4 import BeautifulSoup
import bs4
import json
import pathlib
import sys

# opcodes.html is downloaded from "http://www.oxyron.de/html/opcodes02.html"
# on 2021-05-28

filename = 'opcodes02.html'
if not pathlib.Path(filename).exists():
    print('file not exists; run `wget "http://www.oxyron.de/html/opcodes02.html"`', file=sys.stderr)
    exit(1)

soup = BeautifulSoup(
    open('opcodes02.html', encoding='ISO-8859-1'), 'html.parser')

op_table: bs4.element.Tag = soup.select_one('table')
cells: bs4.element.ResultSet = op_table.select('tr > td')

data = []
for i in range(17):
    for j in range(17):
        if i == 0 or j == 0:
            continue
        cell: bs4.element.Tag = cells[i * 17 + j]
        op = (i - 1) * 16 + (j - 1)

        txt: str = cell.text.strip()

        opcode = txt[0:3]
        info = txt[3:].split(' ')

        add_on_branch = False
        cycle = 0
        mode = ""
        if len(info) > 0 and info[0]:
            last = info[-1]
            if last[-1] == '*':
                add_on_branch = True
                last = last[0:-1]
            cycle = int(last)
        if len(info) > 1:
            mode = info[0]

        # print(f"{op}:{opcode}:{mode}:{cycle}:{'*' if add_on_branch else ''}")
        data.append({
            'op': op,
            'opcode': opcode,
            'mode': mode,
            'cycle': cycle,
            'extra': add_on_branch,
        })

print(json.dumps(data, indent=2))
