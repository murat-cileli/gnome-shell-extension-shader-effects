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
        scale = sum(actual) / max(sum(expected), 1)
        assert 0.7 <= scale <= 1.01, 'NTSC scanlines must only dim flat colors'
        assert max(abs(a - b * scale) for a, b in zip(actual, expected)) <= 2, 'NTSC scanlines must preserve flat-color hue'

# Compare line contrast on a flat red field, away from texture transitions.
contrasts = {}
for name, image in [('ntsc', phase_zero), ('crt', load('scanline-crt')),
                    ('curved-crt', load('scanline-curved-crt'))]:
    rows = [image.getpixel((550, y))[0] for y in range(280, 296)]
    contrast = (max(rows) - min(rows)) / max(rows)
    assert 0.18 <= contrast <= 0.27, f'{name}: scanlines must be clearly visible'
    assert max(abs(rows[index] - rows[index + 4]) for index in range(12)) <= 2, f'{name}: scanline spacing'
    contrasts[name] = contrast
assert abs(contrasts['curved-crt'] - contrasts['crt']) < 0.02, 'Curved CRT must match CRT scanline contrast'

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
darkening = [a - b for a, b in zip(baseline.getpixel((900, 350)), selected.getpixel((900, 350)))]
assert min(darkening) >= 0 and max(darkening) <= 60, 'NTSC must retain translucent window blending'
assert max(darkening) - min(darkening) <= 2, 'Scanlines over translucent white must dim each channel equally'
for region in [(650, 80, 700, 500), (80, 540, 1180, 640)]:
    assert delta(baseline.crop(region), selected.crop(region)) == 0, 'Unselected content must stay unchanged'

presets = ['vhs', 'ntsc', 'scanlines', 'crt', 'curved-crt', 'phosphor-trails', 'lcd', 'dithering', 'water', 'rain']
for preset in presets:
    for suffix in ['monochrome', 'monochrome-low-intensity']:
        red, green, blue = load(f'desktop-{preset}-{suffix}').split()
        assert delta(red, green) <= 1 and delta(red, blue) <= 1, f'{preset}: Monochrome must be grayscale at every intensity'
    # Toggling back to color must restore the same frozen effect and its geometry.
    region = (80, 540, 1180, 640)
    assert delta(load(f'desktop-{preset}').crop(region), load(f'desktop-{preset}-color-restored').crop(region)) <= 1, f'{preset}: toggle must restore colors'

report = {
    'ntsc_flat_colors': 'passed',
    'scanline_contrast': contrasts,
    'ntsc_cross_color': 'passed',
    'ntsc_animated_phase': 'passed',
    'ntsc_frozen_phase': 'passed',
    'ntsc_color_bleed': 'passed',
    'ntsc_window_transparency': 'passed',
    'unselected_content': 'passed',
    'monochrome_all_presets_and_low_intensity': 'passed',
    'monochrome_restores_colors': 'passed',
}
(IMAGES / 'render-validation.json').write_text(json.dumps(report, indent=2) + '\n')
print('NTSC, scanline contrast, and all-preset Monochrome render checks passed.')
