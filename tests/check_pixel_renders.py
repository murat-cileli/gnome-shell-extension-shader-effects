"""Validate LCD, dithering, and water captures from the Shell integration test."""
from pathlib import Path

from PIL import Image, ImageChops

IMAGES = Path(__file__).resolve().parent.parent / 'test-results'


def load(name):
    return Image.open(IMAGES / f'{name}.png').convert('RGB')


def delta(first, second):
    return max(high for low, high in ImageChops.difference(
        first.convert('RGB'), second.convert('RGB')).getextrema())


baseline = load('desktop-original')
for preset in ['lcd', 'dithering', 'water']:
    region = (80, 80, 1180, 640)
    assert delta(baseline.crop(region), load(f'desktop-{preset}-zero').crop(region)) <= 1, f'{preset}: zero intensity must preserve the source'
    for region in [(650, 80, 700, 500), (80, 540, 1180, 640)]:
        assert delta(baseline.crop(region), load(f'selected-{preset}').crop(region)) == 0, f'{preset}: unselected content'
    for suffix in ['monochrome', 'monochrome-low-intensity']:
        red, green, blue = load(f'desktop-{preset}-{suffix}').split()
        assert delta(red, green) <= 1 and delta(red, blue) <= 1, f'{preset}: monochrome'
    region = (80, 540, 1180, 640)
    assert delta(load(f'desktop-{preset}').crop(region), load(f'desktop-{preset}-color-restored').crop(region)) <= 1, f'{preset}: restore color'

region = (80, 540, 1180, 640)
lcd = list(load('desktop-lcd-full').crop(region).get_flattened_data())
assert all(g >= r and b <= 48 for r, g, b in lcd), 'LCD must use a green handheld palette'
assert len(set(lcd)) > 4, 'LCD must include a visible pixel grid'
for pixel in load('desktop-dithering-full').crop(region).get_flattened_data():
    assert all(min(abs(channel - level) for level in [0, 85, 170, 255]) <= 1 for channel in pixel), 'Dithering must quantize to four levels per channel'
region = (80, 80, 1180, 640)
assert delta(load('desktop-water-full').crop(region), load('desktop-water-next').crop(region)) > 10, 'Water must move with time'
assert delta(load('desktop-water-next').crop(region), load('desktop-water-frozen').crop(region)) == 0, 'Frozen water must remain still'
print('LCD palette/grid, dithering quantization, water motion/freeze, zero intensity, selection, and monochrome checks passed.')
