# Shader sources and attribution

The Technicolor adaptation in `shaderSource.js` was prepared from
[libretro/slang-shaders](https://github.com/libretro/slang-shaders), revision
`2b0530bac0e8083d9d643c194929dc0a6b69bd35`.
It replaces Slang/RetroArch interfaces with Cogl GLSL, preserves window alpha,
and integrates the extension's intensity, animation, and monochrome controls.
This is a desktop adaptation, rather than a general Slang preset loader.

## Technicolor

[film/shaders/film_noise.slang](https://github.com/libretro/slang-shaders/blob/2b0530bac0e8083d9d643c194929dc0a6b69bd35/film/shaders/film_noise.slang)

Film noise by hunterk. The upstream shader declares: `license: public domain`.
It credits aybe's Technicolor effect. This adaptation uses its two-strip
red/cyan color construction, deconvergence, vignette, hotspot, and gate weave.
Grain and scratches are procedural. The external film-noise image and the
separate CMYK LUT pass from `film/technicolor.slangp` are not included.
