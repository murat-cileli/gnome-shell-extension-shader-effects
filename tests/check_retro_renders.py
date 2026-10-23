"""Check real Shell captures for CRT variants and window selection."""
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / 'test-results'
RETRO = IMAGES / 'retro'
NAMES = ['green-crt', 'amber-crt', 'curved-crt']


def load(name, directory=RETRO):
    return Image.open(directory / f'{name}.png').convert('RGB')


def delta(first, second):
    return max(high for _low, high in ImageChops.difference(first, second).getextrema())


original = load('original')
for name in NAMES:
    for intensity in [0.55, 1]:
        image = load(f'{name}-{intensity}')
        assert image.size == original.size
        assert delta(image.crop((40, 55, 1240, 675)), original.crop((40, 55, 1240, 675))) > 20, name

for name in ['green-crt', 'amber-crt']:
    image = load(f'{name}-1')
    for point in [(560, 390), (110, 300), (200, 300), (380, 300), (560, 300)]:
        red, green, blue = image.getpixel(point)
        if name == 'green-crt':
            assert green > red * 3 and green > blue * 2, 'Green CRT phosphor hue'
        else:
            assert red > green * 1.3 and green > blue * 3, 'Amber CRT phosphor hue'
    assert sum(image.getpixel((550, 390))) > sum(image.getpixel((100, 390))) * 4, f'{name}: preserve luminance detail'

baseline = load('desktop-original', IMAGES)
for name in NAMES:
    selected = load(f'selected-{name}', IMAGES)
    for region in [(650, 80, 700, 500), (80, 540, 1180, 640)]:
        assert delta(baseline.crop(region), selected.crop(region)) == 0, f'{name}: unselected content'

# A compact, synthetic-only contact sheet for visual review and delivery.
for intensity in [0.55, 1]:
    names = ['original', f'crt-{intensity}', *(f'{name}-{intensity}' for name in NAMES)]
    canvas = Image.new('RGB', (1280, ((len(names) + 2) // 3) * 250 + 10), '#181818')
    draw = ImageDraw.Draw(canvas)
    for index, name in enumerate(names):
        image = load(name).crop((40, 55, 1240, 675)).resize((400, 207), Image.Resampling.LANCZOS)
        x, y = index % 3 * 426 + 13, index // 3 * 250
        canvas.paste(image, (x, y + 28))
        draw.text((x, y + 7), name, fill='white')
    canvas.save(RETRO / f'comparison-{intensity}.png')

report = {
    'new_presets_rendered': len(NAMES),
    'phosphor_hues_and_luminance_detail': 'passed',
    'unselected_content': 'passed',
}
(RETRO / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
print('CRT variants, phosphor hues, luminance detail, and selection render checks passed.')
