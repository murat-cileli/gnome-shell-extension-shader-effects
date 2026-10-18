https://github.com/user-attachments/assets/defff696-ebf9-4612-be82-b0326225643b

# Shader Effects

Apply customizable GPU-powered shader effects to your GNOME desktop, including CRT scanlines, VHS distortion, RGB shifts, and more.

## Effects

| Preset | Appearance |
| --- | --- |
| VHS | Animated tape jitter, RGB separation, grain, a single intermittent tracking band, and scanlines |
| VHS (Black & White) | The same animated VHS artifacts rendered in grayscale |
| NTSC | Composite video color bleed, softer horizontal detail, cross-color artifacts, and animated dot crawl |
| Scanlines | Static horizontal scanlines with adjustable spacing |
| CRT | RGB phosphor mask, scanlines, vignette, and subtle animated flicker |
| Monochrome | Luminance-based grayscale |

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

| Default shortcut | Action |
| --- | --- |
| Super+Alt+V | Toggle effects |
| Super+Alt+W | Add or remove the focused window, switch to Selected windows, and enable effects |
| Super+Alt+C | Cycle through the six presets |

Open **Preferences** for intensity, scanline spacing, animation speed, frame rate, and editable shortcuts. A shortcut may conflict with another desktop action; change or disable it in Preferences. Effect settings and shortcuts are saved through GSettings.

Both VHS presets become progressively more pronounced above 55% intensity, with stronger tape jitter, tracking distortion, grain, and scanlines. At 100%, RGB separation reaches 5 texture pixels per channel offset. The default 55% appearance stays unchanged.

```sh
gnome-extensions prefs shader-effects@muratc.com
gnome-extensions disable shader-effects@muratc.com
```

## Performance

Both VHS presets, NTSC, and CRT animate at up to 30 updates per second by default, configurable from 10 to 60. Disable **Animate** to freeze them. GNOME's `enable-animations` setting also stops the animation timer. Scanlines and Monochrome do not schedule continuous redraws. Hidden targets do not receive animation updates. NTSC samples thirteen neighboring positions per pixel and can be more demanding on large desktops.

Effects use offscreen textures. Large desktops and high resolution windows consume more GPU memory and bandwidth. While any effect is attached, the extension inhibits direct scanout so fullscreen applications also pass through the compositor. Disabling effects releases that inhibition. Other effects or extensions on the same actor can change the final result.

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
