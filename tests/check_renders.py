import json
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / 'test-results'


def load(name):
    return Image.open(IMAGES / f'{name}.png').convert('RGB')


def delta(first, second):
    return max(high for _low, high in ImageChops.difference(first.convert('RGB'), second.convert('RGB')).getextrema())


original = load('ntsc-original')
phase_zero = load('ntsc-phase-0')
phase_one = load('ntsc-phase-1')
frozen = load('ntsc-phase-frozen')
for point in [(550, 300), (850, 300), (1040, 300),
              (150, 620), (350, 620), (550, 620), (750, 620), (950, 620), (1100, 620)]:
    expected = original.getpixel(point)
    for image in [phase_zero, phase_one]:
        actual = image.getpixel(point)
        assert max(abs(a - b) for a, b in zip(expected, actual)) <= 2, 'NTSC changes flat colors'

detail = (100, 100, 420, 480)
red, green, blue = original.crop(detail).split()
assert delta(red, green) == 0 and delta(red, blue) == 0, 'Fine detail fixture must be grayscale'
red, green, blue = phase_zero.crop(detail).split()
assert max(delta(red, green), delta(red, blue)) > 40, 'NTSC must produce cross-color artifacts'
assert delta(phase_zero.crop(detail), phase_one.crop(detail)) > 40, 'NTSC phase must affect dot crawl'
region = (80, 80, 1180, 640)
assert delta(phase_one.crop(region), frozen.crop(region)) == 0, 'Frozen NTSC must stay still'
edge = (713, 100, 727, 480)
assert delta(original.crop(edge), phase_zero.crop(edge)) > 20, 'NTSC must affect color transitions'

baseline = load('desktop-original')
selected = load('selected-ntsc-windows')
assert max(abs(a - b) for a, b in zip(baseline.getpixel((900, 350)), selected.getpixel((900, 350)))) <= 2, 'NTSC must preserve window transparency'
for region in [(650, 80, 700, 500), (80, 540, 1180, 640)]:
    assert delta(baseline.crop(region), selected.crop(region)) == 0, 'Unselected content must stay unchanged'

for name in ['desktop-vhs-bw', 'desktop-vhs-bw-low-intensity']:
    red, green, blue = load(name).split()
    assert delta(red, green) <= 1 and delta(red, blue) <= 1, 'Black and white VHS must remain grayscale'

report = {
    'ntsc_flat_colors': 'passed',
    'ntsc_cross_color': 'passed',
    'ntsc_animated_phase': 'passed',
    'ntsc_frozen_phase': 'passed',
    'ntsc_color_bleed': 'passed',
    'ntsc_window_transparency': 'passed',
    'unselected_content': 'passed',
    'vhs_grayscale_regression': 'passed',
}
(IMAGES / 'render-validation.json').write_text(json.dumps(report, indent=2) + '\n')
print('NTSC render checks and grayscale VHS regression checks passed.')
