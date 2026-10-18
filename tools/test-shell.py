"""Run a real headless Shell with isolated extension settings and test windows."""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
script = ROOT / 'tests' / (sys.argv[1] if len(sys.argv) > 1 else 'integration.js')
destination = ROOT / 'test-results'
destination.mkdir(exist_ok=True)

with tempfile.TemporaryDirectory(prefix='shader-effects-shell-') as directory:
    temporary = Path(directory)
    environment = os.environ.copy()
    for name in ['DATA', 'CONFIG', 'CACHE', 'STATE']:
        path = temporary / name.lower()
        path.mkdir()
        environment[f'XDG_{name}_HOME'] = str(path)
    environment['XDG_DATA_DIRS'] = '/usr/local/share:/usr/share'
    runtime = temporary / 'runtime'
    runtime.mkdir(mode=0o700)
    environment['XDG_RUNTIME_DIR'] = str(runtime)
    environment['GSETTINGS_BACKEND'] = 'memory'
    environment.pop('WAYLAND_DISPLAY', None)
    environment.pop('DISPLAY', None)
    extension = temporary / 'data/gnome-shell/extensions/shader-effects@muratc.com'
    extension.mkdir(parents=True)
    for source in [*ROOT.glob('*.js'), ROOT / 'metadata.json']:
        shutil.copy2(source, extension)
    shutil.copytree(ROOT / 'schemas', extension / 'schemas')
    subprocess.run(['glib-compile-schemas', '--strict', str(extension / 'schemas')], check=True)
    log = destination / f'{script.stem}.log'
    with log.open('w') as output:
        result = subprocess.run([
            'dbus-run-session', '--', 'gnome-shell', '--headless', '--no-x11',
            '--virtual-monitor=1280x720', f'--wayland-display=shader-test-{os.getpid()}',
            f'--automation-script={script}',
        ], env=environment, stdout=output, stderr=subprocess.STDOUT, timeout=180)
    print(log)
    if result.returncode:
        print(log.read_text()[-12000:])
        raise SystemExit(result.returncode)
    print(f'{script.name}: passed')
