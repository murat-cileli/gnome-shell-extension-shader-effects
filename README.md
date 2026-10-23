https://github.com/user-attachments/assets/defff696-ebf9-4612-be82-b0326225643b

# Shader Effects

Give your GNOME desktop a retro look with VHS distortion, CRT displays, and scanlines. Apply effects to your entire desktop or just the windows you choose.

[Install from GNOME Extensions](https://extensions.gnome.org/extension/11353/shader-effects/)

## Effects

| Effect | Look |
| --- | --- |
| VHS | Tape jitter, color separation, grain, and tracking distortion |
| NTSC | Soft colors, color bleed, and composite video artifacts |
| Scanlines | Classic horizontal scanlines |
| CRT | RGB phosphor pattern, scanlines, and subtle flicker |
| CRT (Curved) | Curved glass, rounded edges, glow, and scanlines |
| CRT (Green) | Green phosphor tones with CRT scanlines, vignette, and flicker |
| CRT (Amber) | Amber phosphor tones with CRT scanlines, vignette, and flicker |
| Technicolor | Vintage two-strip color, film grain, gate weave, vignette, and scratches |

Add **Monochrome** to any effect for a black-and-white look. Adjust intensity and animation from the panel menu, or open **Preferences** for more options and custom shortcuts.

## Installation

Open [Shader Effects on GNOME Extensions](https://extensions.gnome.org/extension/11353/shader-effects/) and click **Install**.

<details>
<summary>Install from source</summary>

Requires Python 3 and `glib-compile-schemas`. From the project directory, run:

```sh
python3 tools/package.py
gnome-extensions install --force dist/shader-effects@muratc.com.shell-extension.zip
```

Log out and back in, then enable the extension:

```sh
gnome-extensions enable shader-effects@muratc.com
```

After updating an already loaded extension from source, log out and back in to load the update.

</details>

## Usage

1. Click the display icon in the top panel and turn on **Enable effects**.
2. Choose an **Effect**.
3. Under **Apply to**, choose **Entire desktop** or **Selected windows**. For selected windows, check the windows you want in the **Selected windows** list.
4. Adjust **Intensity**, toggle **Monochrome**, or turn off **Animate** for a still effect.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Super+Alt+V | Toggle effects |
| Super+Alt+W | Add or remove the focused window, switch to Selected windows, and enable effects |
| Super+Alt+C | Cycle through available effects |

Change or disable shortcuts in **Preferences** if they conflict with other desktop actions.

### Tips

- Start with the default 55% intensity and increase it for a stronger retro look.
- CRT (Curved) bends the image while click targets stay in place. Use a lower intensity for easier interaction.
- For lower GPU usage on large or high-resolution desktops, reduce the animation frame rate in **Preferences** or turn off **Animate**.

Technicolor adapts [libretro/slang-shaders](https://github.com/libretro/slang-shaders) to GNOME's single-pass desktop rendering, using procedural grain and scratches in place of the upstream image textures and color LUT.

## License

Licensed under [GPL-2.0-or-later](LICENSE).

CRT effects are inspired by the display styles in [libretro/common-shaders](https://github.com/libretro/common-shaders).

Adapted shaders retain their original licenses and attribution; see [third-party notices](THIRD_PARTY_NOTICES.md).
