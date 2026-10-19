"""Check alpha compositing and rain in isolated, synthetic Shell captures."""
from pathlib import Path

from PIL import Image, ImageChops

IMAGES = Path(__file__).resolve().parent.parent / 'test-results/rain'


def load(name):
    return Image.open(IMAGES / f'{name}.png').convert('RGB')


def delta(first, second):
    return max(high for low, high in ImageChops.difference(
        first.convert('RGB'), second.convert('RGB')).getextrema())


original = load('original')
for path in sorted(IMAGES.glob('*-full.png')):
    name = path.stem.removesuffix('-full')
    rendered = load(path.stem)
    for region in [(45, 65, 75, 650), (60, 610, 1220, 650), (400, 125, 900, 140)]:
        assert delta(original.crop(region), rendered.crop(region)) <= 1, f'{name}: transparent margins must not add a frame'
    assert delta(original.crop((40, 60, 1240, 660)), load(f'{name}-zero').crop((40, 60, 1240, 660))) <= 1, f'{name}: zero intensity must preserve alpha and color'
    # A 2% black shadow can add at most ~5/255 light, even for bright LCD ink.
    assert delta(original.crop((130, 85, 340, 110)), rendered.crop((130, 85, 340, 110))) <= 6, f'{name}: shadow must not become a bright rectangle'

region = (110, 160, 1170, 580)
rain = load('rain-full').crop(region)
next_frame = load('rain-next').crop(region)
assert delta(rain, original.crop(region)) > 40, 'Rain streaks must be visible'
assert delta(rain, next_frame) > 40, 'Rain must move over time'
assert delta(next_frame, load('rain-frozen').crop(region)) == 0, 'Frozen rain must remain still'
red, green, blue = load('rain-monochrome').crop(region).split()
assert delta(red, green) <= 1 and delta(red, blue) <= 1, 'Rain must support monochrome'
print('Transparent margins, soft shadows, zero intensity, rain visibility/motion/freeze, and monochrome checks passed.')
