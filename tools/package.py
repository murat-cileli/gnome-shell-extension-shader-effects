import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Keep the previous entry point while sharing the orchestrator-style build.
subprocess.run([str(ROOT / 'build.sh')], cwd=ROOT, check=True)
