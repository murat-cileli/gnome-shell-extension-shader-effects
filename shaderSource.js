export const DECLARATIONS = `
uniform vec2 ss_resolution;
uniform float ss_time;
uniform float ss_intensity;
uniform float ss_preset;
uniform float ss_spacing;
uniform float ss_monochrome;

float ss_random(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
}

float ss_luma(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Share the output-pixel grid so curved glass keeps the same line contrast as CRT.
float ss_scanline(float y) {
    float line = 0.5 + 0.5 * cos(y * ss_resolution.y * 6.2831853 / ss_spacing);
    return 0.72 + 0.28 * line;
}

float ss_tracking(float y, float time) {
    float cycle = floor(time / 9.0);
    float delay = 0.4 + 2.0 * ss_random(vec2(cycle, 17.0));
    float duration = 3.0 + 2.0 * ss_random(vec2(cycle, 29.0));
    float progress = clamp((time - cycle * 9.0 - delay) / duration, 0.0, 1.0);
    float width = 0.028 + 0.037 * ss_random(vec2(cycle, 43.0));
    float strength = 0.45 + 0.5 * ss_random(vec2(cycle, 61.0));
    float center = mix(-0.12, 1.12, progress);
    return (1.0 - smoothstep(width * 0.15, width, abs(y - center))) * strength;
}

vec4 ss_sample(vec2 point) {
    return texture2D(cogl_sampler0, clamp(point, vec2(0.0), vec2(1.0)));
}

vec3 ss_color(vec4 sampleColor) {
    return sampleColor.rgb / max(sampleColor.a, 0.0001);
}

// A small cross-shaped glow keeps terminal strokes clear at desktop resolution.
float ss_glow(vec2 uv, vec3 center) {
    vec2 stepSize = vec2(1.5) / ss_resolution;
    float surrounding = ss_luma(ss_color(ss_sample(uv + vec2(stepSize.x, 0.0))))
        + ss_luma(ss_color(ss_sample(uv - vec2(stepSize.x, 0.0))))
        + ss_luma(ss_color(ss_sample(uv + vec2(0.0, stepSize.y))))
        + ss_luma(ss_color(ss_sample(uv - vec2(0.0, stepSize.y))));
    return max(surrounding * 0.25 - ss_luma(center), 0.0);
}

vec3 ss_terminal(vec2 uv, vec3 center, vec3 phosphor) {
    float light = pow(max(ss_luma(center), 0.0), 0.88);
    float lines = 0.96 + 0.04 * cos(uv.y * ss_resolution.y * 6.2831853 / ss_spacing);
    return phosphor * (light * lines + 0.20 * ss_glow(uv, center));
}

vec2 ss_crt_uv(vec2 uv) {
    vec2 point = uv * 2.0 - 1.0;
    return point * (1.0 + 0.028 * ss_intensity * point.yx * point.yx) * 0.5 + 0.5;
}

vec3 ss_curved_crt(vec2 uv) {
    vec2 point = uv * 2.0 - 1.0;
    vec2 sourceUV = ss_crt_uv(uv);
    vec2 bent = sourceUV * 2.0 - 1.0;
    vec3 source = ss_color(ss_sample(sourceUV));
    float scan = ss_scanline(uv.y);
    float stripe = mod(floor(uv.x * ss_resolution.x), 3.0);
    vec3 mask = vec3(0.88);
    if (stripe < 0.5) mask.r = 1.0;
    else if (stripe < 1.5) mask.g = 1.0;
    else mask.b = 1.0;
    // Rounded glass edge with a one-pixel feather; never wrap the source texture.
    vec2 corner = max(abs(bent) - vec2(0.94), vec2(0.0));
    float distanceToEdge = length(corner) - 0.06;
    float glass = 1.0 - smoothstep(-2.0 / min(ss_resolution.x, ss_resolution.y), 0.0, distanceToEdge);
    float vignette = 1.0 - 0.12 * dot(point, point);
    return (pow(max(source, vec3(0.0)), vec3(0.91)) + ss_glow(sourceUV, source) * 0.08)
        * mask * scan * vignette * glass * (1.0 + 0.006 * sin(ss_time * 47.0));
}

vec3 ss_rgb_to_yiq(vec3 color) {
    return vec3(
        dot(color, vec3(0.299, 0.587, 0.114)),
        dot(color, vec3(0.596, -0.274, -0.322)),
        dot(color, vec3(0.211, -0.523, 0.312)));
}

vec3 ss_yiq_to_rgb(vec3 signal) {
    return vec3(
        dot(signal, vec3(1.0, 0.956, 0.621)),
        dot(signal, vec3(1.0, -0.272, -0.647)),
        dot(signal, vec3(1.0, -1.106, 1.703)));
}

vec3 ss_ntsc(vec2 uv, vec3 center, float alpha) {
    float row = floor(uv.y * ss_resolution.y);
    float frame = mod(floor(ss_time * 30.0), 3.0);
    float phase = 2.0943951 * (mod(row, 3.0) + frame) + uv.x * ss_resolution.x * 1.0471976;
    vec3 decoded = vec3(0.0);
    for (int tap = -6; tap <= 6; tap++) {
        float offset = float(tap);
        vec4 source = ss_sample(uv + vec2(offset / ss_resolution.x, 0.0));
        float coverage = min(source.a / max(alpha, 0.0001), 1.0);
        vec3 yiq = ss_rgb_to_yiq(mix(center, ss_color(source), coverage));
        float angle = phase + offset * 1.0471976;
        vec2 carrier = vec2(cos(angle), sin(angle));
        float composite = yiq.x + dot(yiq.yz, carrier);
        float chromaWeight = abs(offset) > 5.5 ? 1.0 / 24.0 : 1.0 / 12.0;
        float lumaWeight = 0.0;
        if (abs(offset) < 3.5)
            lumaWeight = abs(offset) > 2.5 ? 1.0 / 12.0 : 1.0 / 6.0;
        decoded.x += composite * lumaWeight;
        decoded.yz += composite * carrier * (2.0 * chromaWeight);
    }
    return ss_yiq_to_rgb(decoded);
}

// Ordered 4x4 Bayer thresholds without arrays, for desktop GLSL 120 and GLES 100.
float ss_bayer2(vec2 cell) {
    return 2.0 * cell.x + 3.0 * cell.y - 4.0 * cell.x * cell.y;
}

float ss_bayer4(vec2 cell) {
    vec2 point = mod(cell, 4.0);
    return (4.0 * ss_bayer2(mod(point, 2.0))
        + ss_bayer2(floor(point / 2.0)) + 0.5) / 16.0;
}

vec3 ss_lcd(vec2 uv, vec3 center, float alpha) {
    vec2 pixel = uv * ss_resolution;
    vec2 cell = floor(pixel / ss_spacing);
    vec2 sampleUV = (cell + 0.5) * ss_spacing / ss_resolution;
    vec4 source = ss_sample(sampleUV);
    float coverage = min(source.a / max(alpha, 0.0001), 1.0);
    float light = ss_luma(mix(center, ss_color(source), coverage));
    float level = floor(clamp(light, 0.0, 1.0) * 3.0 + 0.5);
    vec3 ink;
    if (level < 0.5) ink = vec3(15.0, 56.0, 15.0) / 255.0;
    else if (level < 1.5) ink = vec3(48.0, 98.0, 48.0) / 255.0;
    else if (level < 2.5) ink = vec3(139.0, 172.0, 15.0) / 255.0;
    else ink = vec3(155.0, 188.0, 15.0) / 255.0;
    vec2 position = fract(pixel / ss_spacing);
    vec2 grid = smoothstep(vec2(0.0), vec2(0.65 / ss_spacing), position);
    return ink * (0.78 + 0.22 * grid.x * grid.y);
}

float ss_rain(vec2 pixel) {
    float drops = 0.0;
    for (int layer = 0; layer < 3; layer++) {
        float depth = float(layer);
        vec2 size = vec2(64.0 + depth * 23.0, 105.0 + depth * 37.0);
        vec2 point = vec2(pixel.x + pixel.y * 0.18, pixel.y);
        point += vec2(depth * 137.0, -ss_time * (190.0 + depth * 85.0));
        vec2 cell = floor(point / size);
        vec2 local = fract(point / size);
        float seed = ss_random(cell + vec2(depth * 31.0, 19.0));
        float centerX = 0.15 + seed * 0.7;
        float head = 0.45 + 0.35 * ss_random(cell + vec2(7.0, depth));
        float length = 0.18 + 0.22 * seed;
        float streak = 1.0 - smoothstep(0.35, 1.15 + depth * 0.25,
            abs(local.x - centerX) * size.x);
        float tail = smoothstep(head - length, head, local.y)
            * (1.0 - smoothstep(head, head + 0.025, local.y));
        drops += streak * tail * (0.38 + depth * 0.14);
    }
    return clamp(drops, 0.0, 1.0);
}
`;

export const FRAGMENT = `
vec2 uv = cogl_tex_coord_in[0].xy;
vec2 pixel = uv * ss_resolution;
vec4 original = ss_sample(uv);
vec3 clean = ss_color(original);
vec3 color = clean;
float line = 0.5 + 0.5 * cos(pixel.y * 6.2831853 / ss_spacing);

if (ss_preset < 0.5) {
    // Preserve the default look; progressively strengthen the upper intensity range.
    float boost = smoothstep(0.55, 1.0, ss_intensity);
    float frame = floor(ss_time * 30.0);
    float band = floor(pixel.y / 12.0);
    float jitter = (ss_random(vec2(band, frame)) - 0.5) * mix(1.8, 4.5, boost);
    float tracking = ss_tracking(uv.y, ss_time);
    vec2 shifted = uv + vec2((jitter + tracking * mix(5.0, 12.0, boost)) / ss_resolution.x, 0.0) * ss_intensity;
    float separation = mix(2.5, 5.0, boost) / ss_resolution.x;
    vec3 center = ss_color(ss_sample(shifted));
    color = vec3(
        ss_color(ss_sample(shifted + vec2(separation, 0.0))).r,
        center.g,
        ss_color(ss_sample(shifted - vec2(separation, 0.0))).b);
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luma), color, 0.82);
    float grain = ss_random(floor(pixel) + vec2(frame, frame * 0.73)) - 0.5;
    color += grain * mix(0.12, 0.22, boost) + tracking * mix(0.045, 0.08, boost);
    color *= 1.0 - mix(0.09, 0.18, boost) * (1.0 - line);
    float headNoise = smoothstep(0.965, 1.0, uv.y);
    color += headNoise * grain * mix(0.35, 0.55, boost);
} else if (ss_preset < 1.5) {
    color *= 0.60 + 0.40 * line;
} else if (ss_preset < 2.5) {
    vec2 centered = uv * 2.0 - 1.0;
    float vignette = 1.0 - 0.22 * dot(centered, centered);
    float column = mod(floor(pixel.x), 3.0);
    vec3 mask = vec3(0.82);
    if (column < 1.0)
        mask.r = 1.0;
    else if (column < 2.0)
        mask.g = 1.0;
    else
        mask.b = 1.0;
    color = pow(max(color, vec3(0.0)), vec3(0.93));
    color *= mask * ss_scanline(uv.y) * max(vignette, 0.0);
    color *= 1.0 + 0.012 * sin(ss_time * 47.0);
} else if (ss_preset < 5.5) {
    color = ss_ntsc(uv, clean, original.a) * ss_scanline(uv.y);
} else if (ss_preset < 6.5) {
    // Blend appearance at the same warped coordinates to avoid double text at partial intensity.
    clean = ss_color(ss_sample(ss_crt_uv(uv)));
    color = ss_curved_crt(uv);
} else if (ss_preset < 7.5) {
    vec4 history = texture2D(cogl_sampler1, uv);
    float afterglow = max(history.r / max(history.a, 0.0001) - ss_luma(clean), 0.0);
    color = ss_terminal(uv, clean, vec3(0.35, 1.0, 0.50)) + vec3(0.20, 0.85, 0.36) * afterglow;
} else if (ss_preset < 8.5) {
    color = ss_lcd(uv, clean, original.a);
} else if (ss_preset < 9.5) {
    vec2 cell = floor(pixel / max(1.0, ss_spacing * 0.5));
    float threshold = ss_bayer4(cell);
    color = floor(clamp(clean, 0.0, 1.0) * 3.0 + threshold) / 3.0;
} else if (ss_preset < 10.5) {
    // Wave lengths and displacement use texture pixels so windows keep the same scale.
    vec2 displacement = vec2(
        sin(pixel.y / 38.0 + ss_time * 1.3) + 0.45 * sin((pixel.x + pixel.y) / 67.0 - ss_time),
        cos(pixel.x / 46.0 - ss_time * 1.1) + 0.45 * sin((pixel.y - pixel.x) / 73.0 + ss_time * 0.8));
    vec4 source = ss_sample(uv + displacement * (3.0 * ss_intensity) / ss_resolution);
    float coverage = min(source.a / max(original.a, 0.0001), 1.0);
    // Blend at displaced coordinates to avoid double text at partial intensity.
    clean = mix(clean, ss_color(source), coverage);
    color = clean;
} else {
    color = mix(clean, vec3(0.72, 0.85, 1.0), ss_rain(pixel));
}

vec3 result = clamp(mix(clean, color, ss_intensity), 0.0, 1.0);
if (ss_monochrome > 0.5)
    result = vec3(ss_luma(result));
// Both effect backends composite premultiplied colors. Without this, LCD ink
// and other added light leak from transparent pixels into a rectangular frame.
result *= original.a;
cogl_color_out = vec4(result, original.a) * cogl_color_in;
`;

// GPU feedback stores premultiplied luminance, with the current frame's coverage.
// No screen pixels are read back to JavaScript or persisted to disk.
export const HISTORY_DECLARATIONS = `uniform float ss_decay;`;
export const HISTORY_FRAGMENT = `
vec2 uv = cogl_tex_coord_in[0].xy;
vec4 source = texture2D(cogl_sampler0, uv);
vec4 previous = texture2D(cogl_sampler1, uv);
float light = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
float coverage = min(source.a / max(previous.a, 0.0001), 1.0);
float glow = max(light, previous.r * ss_decay * coverage);
cogl_color_out = vec4(vec3(glow), source.a);
`;
