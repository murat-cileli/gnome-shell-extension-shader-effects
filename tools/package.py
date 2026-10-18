import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
metadata = json.loads((ROOT / 'metadata.json').read_text())
destination = ROOT / 'dist' / f'{metadata["uuid"]}.shell-extension.zip'
destination.parent.mkdir(exist_ok=True)

with tempfile.TemporaryDirectory(prefix='shell-shaders-package-') as directory:
    compiled = Path(directory)
    subprocess.run([
        'glib-compile-schemas', '--strict', '--targetdir', str(compiled), str(ROOT / 'schemas'),
    ], check=True)
    files = [ROOT / 'metadata.json', ROOT / 'README.md']
    files.extend(sorted(ROOT.glob('*.js')))
    files.extend(sorted((ROOT / 'schemas').glob('*.xml')))
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for source in files:
            archive.write(source, source.relative_to(ROOT))
        archive.write(compiled / 'gschemas.compiled', 'schemas/gschemas.compiled')

print(destination)
