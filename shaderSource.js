export const DECLARATIONS = `
uniform vec2 ss_resolution;
uniform float ss_time;
uniform float ss_intensity;
uniform float ss_preset;
uniform float ss_spacing;
uniform float ss_premultiplied;

float ss_random(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
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
`;

export const FRAGMENT = `
vec2 uv = cogl_tex_coord_in[0].xy;
vec2 pixel = uv * ss_resolution;
vec4 original = ss_sample(uv);
vec3 clean = ss_color(original);
vec3 color = clean;
float line = 0.5 + 0.5 * cos(pixel.y * 6.2831853 / ss_spacing);

if (ss_preset < 0.5 || (ss_preset > 3.5 && ss_preset < 4.5)) {
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
    color *= mask * (0.72 + 0.28 * line) * max(vignette, 0.0);
    color *= 1.0 + 0.012 * sin(ss_time * 47.0);
} else if (ss_preset < 3.5) {
    float luma = dot(clean, vec3(0.2126, 0.7152, 0.0722));
    color = vec3(luma);
} else {
    color = ss_ntsc(uv, clean, original.a);
}

vec3 result = clamp(mix(clean, color, ss_intensity), 0.0, 1.0);
if (ss_preset > 3.5 && ss_preset < 4.5)
    result = vec3(dot(result, vec3(0.2126, 0.7152, 0.0722)));
result *= mix(1.0, original.a, ss_premultiplied);
cogl_color_out = vec4(result, original.a) * cogl_color_in;
`;
