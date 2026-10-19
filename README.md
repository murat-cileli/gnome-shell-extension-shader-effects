https://github.com/user-attachments/assets/defff696-ebf9-4612-be82-b0326225643b

# Shader Effects

Apply customizable GPU-powered shader effects to your GNOME desktop, including CRT scanlines, VHS distortion, RGB shifts, and more.

## Effects

| Preset | Appearance |
| --- | --- |
| VHS | Animated tape jitter, RGB separation, grain, a single intermittent tracking band, and scanlines |
| NTSC | Composite video color bleed, softer horizontal detail, cross-color artifacts, animated dot crawl, and scanlines |
| Scanlines | Static horizontal scanlines with adjustable spacing |
| CRT | RGB phosphor mask, scanlines, vignette, and subtle animated flicker |
| Curved CRT | Gently curved glass, rounded edges, RGB mask, glow, and scanlines |
| Phosphor Trails | Green phosphor with real, exponentially fading trails behind bright moving content |

The additional CRT and phosphor effects are original GLSL implementations inspired by
the display styles in [libretro/common-shaders](https://github.com/libretro/common-shaders),
particularly `crt-geom` and `phosphor-trails`. The extension does not load Cg presets.

## Install

Requires Python 3 and `glib-compile-schemas` to build. Run from this directory:

```sh
python3 tools/package.py
gnome-extensions install --force dist/shader-effects@muratc.com.shell-extension.zip
```

The ZIP in `dist/` can also be uploaded for review at
[GNOME Extensions](https://extensions.gnome.org/upload/). It includes the schema
XML; GNOME compiles it automatically during installation.

Log out and back in after the first installation so GNOME Shell discovers the extension, then run:

```sh
gnome-extensions enable shader-effects@muratc.com
```

After updating an already loaded extension, log out and back in to load the new JavaScript. On Wayland, restarting Shell with Alt+F2, `r` is unavailable.

## Use

Click the display icon in the top panel and switch on **Enable effects**. Choose an **Effect** and an **Apply to** mode:

- **Entire desktop** processes the desktop, windows, panel, menus, and overview together across the combined monitor area.
- **Selected windows** processes only windows checked in **Selected windows**. You can select multiple windows, including windows on other workspaces. An empty selection applies no effects.

Switch on **Monochrome** in the panel menu or Preferences to render the selected
effect in grayscale. It works with all six effects, preserves the effect's
animation and settings, and remains enabled when you switch effects. Conversion
is applied after intensity blending, so even low-intensity effects stay fully
grayscale. Switch it off to restore color. The choice is saved automatically.

| Default shortcut | Action |
| --- | --- |
| Super+Alt+V | Toggle effects |
| Super+Alt+W | Add or remove the focused window, switch to Selected windows, and enable effects |
| Super+Alt+C | Cycle through the six presets |

Open **Preferences** for intensity, scanline spacing, animation speed, frame rate, and editable shortcuts. **Scanline spacing** controls the distance between lines in texture pixels; larger values produce a coarser pattern. A shortcut may conflict with another desktop action; change or disable it in Preferences. Effect settings and shortcuts are saved through GSettings.

The default 55% intensity blends the retro appearance with the original image.
Use 100% for the full effect. Curved CRT gradually bends the
image as intensity increases; mouse hit targets retain their original positions,
so a light intensity or Selected windows mode is preferable for interactive use.

NTSC, CRT, and Curved CRT share the same scanline spacing and contrast. Curved
CRT places the lines on the output pixel grid to keep them as distinct as CRT.

VHS becomes progressively more pronounced above 55% intensity, with stronger tape jitter, tracking distortion, grain, and scanlines. At 100%, RGB separation reaches 5 texture pixels per channel offset. The default 55% appearance stays unchanged.

```sh
gnome-extensions prefs shader-effects@muratc.com
gnome-extensions disable shader-effects@muratc.com
```

## Performance

VHS, NTSC, both CRT presets, and Phosphor Trails animate at up to 30 updates per second by default, configurable from 10 to 60. Disable **Animate** to freeze them, including the stored phosphor history. GNOME's `enable-animations` and reduced motion settings also stop the animation timer. Scanlines does not schedule continuous redraws. Monochrome does not change animation scheduling. Hidden targets do not receive animation updates. NTSC samples thirteen neighboring positions per pixel and can be more demanding on large desktops.

Phosphor Trails maintains two additional GPU textures per target and updates
their luminance with exponential decay. It reads no pixels back to JavaScript
and writes no screen captures to disk. History is reset when the target is
resized, the preset changes, or the effect is removed. A 3840×2160 target uses
about 63 MiB of additional texture storage, excluding driver overhead.

Effects use offscreen textures. Large desktops and high resolution windows consume more GPU memory and bandwidth. While any effect is attached, the extension inhibits direct scanout so fullscreen applications also pass through the compositor. Disabling effects releases that inhibition. Other effects or extensions on the same actor can change the final result.

## Source layout

| File | Responsibility |
| --- | --- |
| `extension.js` | Panel menu, window list, and global shortcuts |
| `controller.js` | Selection, actor effects, animation, and cleanup |
| `effect.js` | Cogl pipeline and shader uniforms |
| `phosphorHistory.js` | GPU feedback buffers and phosphor decay |
| `shaderSource.js` | GLSL shader declarations and fragment body |
| `presets.js` | Shared effect and scope definitions |
| `prefs.js` | libadwaita settings and shortcut capture |
| `schemas/` | GSettings schema |
| `tools/` | Validation and ZIP packaging |
| `tests/` | Shell integration test |

## Validation

```sh
python3 tools/check.py
python3 tools/test-shell.py
python3 tests/check_renders.py
python3 tools/test-shell.py retro.js
python3 tests/check_retro_renders.py
python3 tools/test-shell.py lifecycle.js
```

The Shell tests use a separate headless compositor, temporary XDG directories,
and in-memory settings. They require GNOME Shell and a working GPU render node.
Captures contain synthetic test content and are saved in `test-results/`.

## License

Shader Effects is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 2 of the License, or (at your option) any later version
(`GPL-2.0-or-later`).

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full license text. The license
is included in the extension ZIP.
