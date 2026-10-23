"""Check synthetic Shell captures for Technicolor."""
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / 'test-results'
RETRO = IMAGES / 'retro'
NAMES = ['technicolor']
REGION = (40, 55, 1240, 675)


def load(name, directory=RETRO):
    return Image.open(directory / f'{name}.png').convert('RGB')


def delta(first, second):
    return max(high for low, high in ImageChops.difference(first, second).getextrema())


original = load('original').crop(REGION)
baseline = load('desktop-original', IMAGES)
metrics = {}
for name in NAMES:
    for intensity in [0.55, 1]:
        rendered = load(f'{name}-{intensity}').crop(REGION)
        peak = delta(original, rendered)
        assert peak > 8, f'{name}: effect must be visible'
    assert delta(original, load(f'{name}-zero').crop(REGION)) == 0, f'{name}: zero intensity'
    phase0 = load(f'{name}-phase-0').crop(REGION)
    phase1 = load(f'{name}-phase-1').crop(REGION)
    frozen = load(f'{name}-frozen').crop(REGION)
    phase_delta = delta(phase0, phase1)
    assert delta(phase1, frozen) == 0, f'{name}: frozen frame must stay still'
    assert phase_delta > 5, f'{name}: clock response'
    selected = load(f'selected-{name}', IMAGES)
    for region in [(650, 80, 700, 500), (80, 540, 1180, 640)]:
        assert delta(baseline.crop(region), selected.crop(region)) == 0, f'{name}: unselected content'
    metrics[name] = {'phase_delta': phase_delta, 'zero_intensity': 'passed',
                     'frozen_frame': 'passed', 'unselected_content': 'passed'}

for intensity in [0.55, 1]:
    names = ['original', *(f'{name}-{intensity}' for name in NAMES)]
    canvas = Image.new('RGB', (1280, 250), '#181818')
    draw = ImageDraw.Draw(canvas)
    for index, name in enumerate(names):
        x, y = index % 3 * 426 + 13, index // 3 * 250
        canvas.paste(load(name).crop(REGION).resize((400, 207), Image.Resampling.LANCZOS), (x, y + 28))
        draw.text((x, y + 7), name, fill='white')
    canvas.save(RETRO / f'film-comparison-{intensity}.png')

report = {'presets': metrics}
(RETRO / 'film-validation.json').write_text(json.dumps(report, indent=2) + '\n')
print('Film, animation/freeze, zero intensity, and window selection checks passed.')
