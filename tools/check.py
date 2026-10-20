import json
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


metadata = json.loads((ROOT / 'metadata.json').read_text())
project_url = urlsplit(metadata.get('url', ''))
assert project_url.scheme in ('https', 'http') and project_url.hostname, 'metadata.json requires a valid project URL for GNOME Extensions uploads'
assert metadata['shell-version'] == ['48', '49', '50', '51']
assert metadata['settings-schema'] == 'org.gnome.shell.extensions.shader-effects'
presets = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    "import {PRESETS} from './presets.js'; console.log(JSON.stringify(PRESETS));",
], cwd=ROOT, text=True))
choices = ET.parse(ROOT / 'schemas' / f'{metadata["settings-schema"]}.gschema.xml').findall(
    './schema/key[@name="preset"]/choices/choice')
assert {item['id'] for item in presets} == {choice.attrib['value'] for choice in choices}
assert len({item['shader'] for item in presets}) == len(presets), 'Shader IDs must be unique'
for source in sorted([*ROOT.glob('*.js'), *(ROOT / 'tests').glob('*.js')]):
    run('node', '--check', str(source))

with tempfile.TemporaryDirectory(prefix='shader-effects-check-') as directory:
    target = Path(directory)
    run('glib-compile-schemas', '--strict', '--targetdir', str(target), str(ROOT / 'schemas'))
    if not shutil.which('glslangValidator'):
        raise SystemExit('Install glslangValidator to validate the fragment shader.')
    source = subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import * as shader from './shaderSource.js'; process.stdout.write(JSON.stringify(shader));",
    ], cwd=ROOT, text=True)
    shader = json.loads(source)
    for version in ['120', '100']:
        fragment = target / f'shader-{version}.frag'
        fragment.write_text(
            f'#version {version}\n'
            + ('precision highp float;\n' if version == '100' else '')
            + 'uniform sampler2D cogl_sampler0;\n'
            + 'varying vec4 cogl_tex_coord_in[1];\n'
            + 'varying vec4 cogl_color_in;\n'
            + '#define cogl_color_out gl_FragColor\n'
            + shader['DECLARATIONS']
            + '\nvoid main() {\n'
            + shader['FRAGMENT']
            + '\n}\n'
        )
        run('glslangValidator', '-S', 'frag', str(fragment))

print('JavaScript syntax, metadata, GSettings schema, desktop GLSL, and GLES GLSL checks passed.')
