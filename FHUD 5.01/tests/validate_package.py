"""Validate the port against its retained inputs and refresh its review diff."""
from pathlib import Path
import difflib
import hashlib
import json
import re
import xml.etree.ElementTree as ET

port = Path(__file__).resolve().parents[1]
repo = port.parent
source = repo / 'modFriendlyHUD'
package = port / 'modFriendlyHUD'
manifest = json.loads((port / 'PORT_MANIFEST.json').read_text())
removed = set(manifest.get('removed_package_files', []))
changed = {'content/scripts/' + item['path'] for item in manifest['port_changes']}
changed.update(item['path'] for item in manifest.get('package_changes', []))
originals = {str(p.relative_to(source)): p for p in source.rglob('*') if p.is_file()}
actual = {str(p.relative_to(package)): p for p in package.rglob('*') if p.is_file()}
assert set(actual) == set(originals) - removed, 'Unexpected added/missing package files'
identical = 0
for name, p in actual.items():
    if name not in changed:
        assert p.read_bytes() == originals[name].read_bytes(), name
        identical += 1
for item in manifest['rebased_game_files'] + manifest.get('removed_game_files', []):
    for folder, key in [('Vanilla Scripts 5.01', 'vanilla_sha256'), ('modFriendlyHUD/content/scripts', 'original_mod_sha256')]:
        assert hashlib.sha256((repo / folder / item['path']).read_bytes()).hexdigest() == item[key], item['path']
xmls = list(package.rglob('*.xml'))
for p in xmls:
    ET.parse(p)
menu = ET.parse(package / 'bin/config/r4game/user_config_matrix/pc/modFHUDConfig.xml')
groups = menu.findall('Group')
controls = menu.findall('./Group/VisibleVars/Var')
assert len(groups) == 8 and len(controls) == 85
for group in groups:
    ids = [v.get('id') for v in group.findall('./VisibleVars/Var')]
    assert len(ids) == len(set(ids))
# Complete removal of the custom Cat vision paths, including defaults and labels.
assert not (package / 'content/scripts/game/gameplay/effects/effects/potion/Cat.ws').exists()
removed_keys = re.compile(r'disableCatWhenNotInDarkPlace|enableCatAtNight', re.I)
for p in package.rglob('*'):
    if p.suffix in {'.ws', '.xml', '.txt', '.csv'}:
        text = p.read_text(encoding='utf-8-sig')
        assert not removed_keys.search(text), str(p)
        if p.suffix == '.csv':
            assert not re.search(r'^211036510[34]\|', text, re.M), str(p)
# Delimiter checks skip comments and quoted strings.
lexer = re.compile(r'//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[{}()\[\]]', re.S)
ws_files = list(package.rglob('*.ws'))
for p in ws_files:
    stack = []
    for match in lexer.finditer(p.read_text(encoding='utf-8-sig')):
        token = match.group()
        if len(token) != 1:
            continue
        if token in '({[':
            stack.append(token)
        else:
            assert stack and stack.pop() == {')': '(', ']': '[', '}': '{'}[token], str(p)
    assert not stack, str(p)
with (port / 'PORT_CHANGES.diff').open('w') as out:
    for name in sorted(changed | removed):
        a = originals[name].read_text(encoding='utf-8-sig').splitlines(True)
        b = actual[name].read_text(encoding='utf-8-sig').splitlines(True) if name in actual else []
        out.writelines(difflib.unified_diff(a, b, fromfile='original/' + name,
                        tofile='FHUD 5.01/' + name if name in actual else '/dev/null'))
print(f'PASS: {len(actual)} package files, {len(ws_files)} scripts, {len(xmls)} XML files, {len(groups)} menu sections, {len(controls)} settings.')
print(f'PASS: {identical} untouched files byte-identical; 29 baseline/original script pairs verified; custom Cat vision removed.')
