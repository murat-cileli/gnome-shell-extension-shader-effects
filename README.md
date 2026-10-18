# Shader Effects

Apply customizable GPU-powered shader effects to your GNOME desktop, including CRT scanlines, VHS distortion, RGB shifts, and more.

Apply effects to the entire desktop or a selection of individual windows. Requires GNOME Shell 50 or 51. Earlier versions are deliberately unsupported.

## Effects

| Preset | Appearance |
| --- | --- |
| VHS | Animated tape jitter, RGB separation, grain, a single intermittent tracking band, and scanlines |
| VHS (Black & White) | The same animated VHS artifacts rendered in grayscale |
| NTSC | Composite video color bleed, softer horizontal detail, cross-color artifacts, and animated dot crawl |
| Scanlines | Static horizontal scanlines with adjustable spacing |
| CRT | RGB phosphor mask, scanlines, vignette, and subtle animated flicker |
| Monochrome | Luminance-based grayscale |

Intensity blends each effect with the original image. Zero intensity detaches all effects. The extension starts with effects switched off.

VHS (Black & White) stays grayscale while active; its intensity controls the strength of the tape artifacts.

The VHS tracking band travels from top to bottom, with a different delay, duration, width, and strength on each pass and quiet gaps between passes. It uses normalized image coordinates, so increasing display scale does not multiply the number of bands.

NTSC uses an original single-pass GLSL implementation informed by the YIQ signal modulation and demodulation approach in [libretro/common-shaders](https://github.com/libretro/common-shaders/tree/master/ntsc). A seven-tap luminance filter and a thirteen-tap chrominance filter separate a composite signal, allowing fine brightness detail and color edges to interfere. The carrier phase changes across scanlines and animation frames. The implementation preserves the source alpha and uses texture pixels for the sampling distance. It approximates composite video rather than loading or reproducing a multi-pass RetroArch preset. It does not add a CRT phosphor mask or VHS tracking bands.

## Install

Requires Python 3 and `glib-compile-schemas` to build. Run from this directory:

```sh
python3 tools/package.py
gnome-extensions install --force dist/shell-shaders@muratc.com.shell-extension.zip
```

Log out and back in after the first installation so GNOME Shell discovers the extension, then run:

```sh
gnome-extensions enable shell-shaders@muratc.com
```

After updating an already loaded extension, log out and back in to load the new JavaScript. GNOME Shell 50 and later use Wayland sessions; restarting Shell with Alt+F2, `r` is unavailable.

## Use

Click the display icon in the top panel and switch on **Enable effects**. Choose an **Effect** and an **Apply to** mode:

- **Entire desktop** processes the desktop, windows, panel, menus, and overview together across the combined monitor area.
- **Selected windows** processes only windows checked in **Selected windows**. You can select multiple windows, including windows on other workspaces. An empty selection applies no effects.

Window selections refer to the current window instances. They are cleared when those windows close, the extension is disabled, the screen locks and Shell disables user extensions, or the session ends. Switching between desktop and window scope preserves the selection while the extension remains enabled. New windows are never selected automatically. Separate popup surfaces and overview thumbnails are not guaranteed to inherit a window's effect.

The shader changes rendered pixels; input coordinates and window geometry stay unchanged. The hardware cursor is outside the processed scene. CRT uses a phosphor mask and vignette without geometric screen curvature.

| Default shortcut | Action |
| --- | --- |
| Super+Alt+V | Toggle effects |
| Super+Alt+W | Add or remove the focused window, switch to Selected windows, and enable effects |
| Super+Alt+C | Cycle through the six presets |

Open **Preferences** for intensity, scanline spacing, animation speed, frame rate, and editable shortcuts. A shortcut may conflict with another desktop action; change or disable it in Preferences. Effect settings and shortcuts are saved through GSettings.

```sh
gnome-extensions prefs shell-shaders@muratc.com
gnome-extensions disable shell-shaders@muratc.com
```

## Performance

Both VHS presets, NTSC, and CRT animate at up to 30 updates per second by default, configurable from 10 to 60. Disable **Animate** to freeze them. GNOME's `enable-animations` setting also stops the animation timer. Scanlines and Monochrome do not schedule continuous redraws. Hidden targets do not receive animation updates. NTSC samples thirteen neighboring positions per pixel and can be more demanding on large desktops.

Effects use offscreen textures. Large desktops and high resolution windows consume more GPU memory and bandwidth. While any effect is attached, the extension inhibits direct scanout so fullscreen applications also pass through the compositor. Disabling effects releases that inhibition. Other effects or extensions on the same actor can change the final result.

## Development

The extension uses ES modules, `Shell.GLSLEffect` on GNOME 50, `Clutter.ShaderEffect` on GNOME 51, and libadwaita preferences. Alpha output follows each API's blending convention. All source and interface text is English. Source files contain no comments. There are no npm dependencies.

```sh
python3 tools/check.py
python3 tools/package.py
```

The check command requires Node.js, `glib-compile-schemas`, and `glslangValidator`. It checks JavaScript syntax, extension metadata, strict GSettings compilation, and desktop GLSL/GLES shader compilation. These static checks do not replace testing inside GNOME Shell.

An integration test can run in an isolated headless Shell with the GNOME performance helper installed:

```sh
dbus-run-session -- gnome-shell-test-tool --headless --extra-filter gjs \
  --extension dist/shell-shaders@muratc.com.shell-extension.zip \
  "$PWD/tests/integration.js"
```

The test uses temporary XDG directories managed by `gnome-shell-test-tool`; it does not install into or alter the running desktop session. Render captures are saved to `test-results/` in this checkout.

After the integration test, validate the rendered NTSC color bars, cross-color artifacts, animated and frozen phases, window transparency, and grayscale VHS regression with Pillow installed:

```sh
python3 tests/check_renders.py
```

The tracking regression test renders the actual GLSL band mask at 100% and 200% actor scale, then checks band count, normalized position, variation between passes, and quiet gaps:

```sh
dbus-run-session -- gnome-shell-test-tool --headless \
  --extension dist/shell-shaders@muratc.com.shell-extension.zip \
  "$PWD/tests/tracking.js"
```

Validation on GNOME Shell 51.1 includes all six desktop shaders, grayscale VHS at multiple intensities, NTSC color bars and fine monochrome patterns, frozen and advancing NTSC phases, selected opaque and translucent windows, multiple selections, scope changes, fullscreen windows, reduced motion, zero intensity, window destruction, disable/re-enable cleanup, the panel selection menu, and preferences bindings. Rendered captures were visually inspected. GNOME 50 support was checked against its source API; a GNOME 50 runtime was not available for execution.

## Source layout

| File | Responsibility |
| --- | --- |
| `extension.js` | Panel menu, window list, and global shortcuts |
| `controller.js` | Selection, actor effects, animation, and cleanup |
| `effect.js` | Cogl pipeline and shader uniforms |
| `shaderSource.js` | GLSL shader declarations and fragment body |
| `presets.js` | Shared effect and scope definitions |
| `prefs.js` | libadwaita settings and shortcut capture |
| `schemas/` | GSettings schema |
| `tools/` | Validation and ZIP packaging |
| `tests/` | Shell integration test |

GNOME 50 compatibility follows the [GNOME 50 extension porting guide](https://gjs.guide/extensions/upgrading/gnome-shell-50.html) and the [GNOME 50 GLSL effect implementation](https://github.com/GNOME/gnome-shell/blob/gnome-50/src/shell-glsl-effect.c). Shader snippets are installed only during pipeline construction; uniforms are set on each effect instance afterwards.

GNOME 51 uses the replacement shader API described in the [GNOME 51 porting guide](https://gjs.guide/extensions/upgrading/gnome-shell-51.html).
