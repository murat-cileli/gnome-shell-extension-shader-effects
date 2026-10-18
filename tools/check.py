import json
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


metadata = json.loads((ROOT / 'metadata.json').read_text())
assert metadata['shell-version'][0] == '50'
assert metadata['settings-schema'] == 'org.gnome.shell.extensions.shader-effects'
for source in sorted([*ROOT.glob('*.js'), *(ROOT / 'tests').glob('*.js')]):
    run('node', '--check', str(source))

with tempfile.TemporaryDirectory(prefix='shader-effects-check-') as directory:
    target = Path(directory)
    run('glib-compile-schemas', '--strict', '--targetdir', str(target), str(ROOT / 'schemas'))
    if not shutil.which('glslangValidator'):
        raise SystemExit('Install glslangValidator to validate the fragment shader.')
    source = subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import {DECLARATIONS, FRAGMENT} from './shaderSource.js'; process.stdout.write(JSON.stringify({DECLARATIONS, FRAGMENT}));",
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
