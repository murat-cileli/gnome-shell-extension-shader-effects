"""Check real Shell captures for CRT and phosphor temporal behavior."""
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / 'test-results'
RETRO = IMAGES / 'retro'
NAMES = ['curved-crt', 'phosphor-trails']


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

old_position = (150, 290)
before, after, frozen, decay, end = [load(f'trails-{name}') for name in
                                   ['before', 'after', 'frozen', 'decay', 'decay-end']]
assert before.getpixel(old_position)[1] > 200, 'Motion fixture must start bright'
peak = after.getpixel(old_position)[1]
middle = decay.getpixel(old_position)[1]
last = end.getpixel(old_position)[1]
assert peak > 100 and 0 <= last < middle < peak, 'Real history must remain and then decay'
assert last < peak * 0.1, 'Phosphor history must fade toward black'
assert after.getpixel((270, 290))[1] > 200, 'Current bright content must remain visible'
assert delta(after.crop((100, 250, 600, 370)), frozen.crop((100, 250, 600, 370))) == 0, 'Frozen history must not advance'

baseline = load('desktop-original', IMAGES)
for name in NAMES:
    selected = load(f'selected-{name}', IMAGES)
    for region in [(650, 80, 700, 500), (80, 540, 1180, 640)]:
        assert delta(baseline.crop(region), selected.crop(region)) == 0, f'{name}: unselected content'

# A compact, synthetic-only contact sheet for visual review and delivery.
for intensity in [0.55, 1]:
    names = ['original', *(f'{name}-{intensity}' for name in NAMES)]
    canvas = Image.new('RGB', (1280, 260), '#181818')
    draw = ImageDraw.Draw(canvas)
    for index, name in enumerate(names):
        image = load(name).crop((40, 55, 1240, 675)).resize((400, 207), Image.Resampling.LANCZOS)
        x, y = index % 3 * 426 + 13, index // 3 * 250
        canvas.paste(image, (x, y + 28))
        draw.text((x, y + 7), name, fill='white')
    canvas.save(RETRO / f'comparison-{intensity}.png')

report = {
    'new_presets_rendered': len(NAMES),
    'phosphor_old_position_green': [peak, middle, last],
    'phosphor_decay_and_freeze': 'passed',
    'unselected_content': 'passed',
}
(RETRO / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
print('CRT, phosphor temporal decay/freeze, and selection render checks passed.')
