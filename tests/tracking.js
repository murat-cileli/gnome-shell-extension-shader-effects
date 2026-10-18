import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

export const METRICS = {};

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

function measure(pixbuf, x, y, scale) {
    const pixels = pixbuf.get_pixels();
    const stride = pixbuf.get_rowstride();
    const channels = pixbuf.get_n_channels();
    const values = Array.from({length: 240 * scale}, (_item, row) =>
        pixels[(y + row) * stride + x * channels]);
    let bands = 0;
    let inside = false;
    for (const value of values) {
        if (value > 8 && !inside)
            bands++;
        inside = value > 8;
    }
    const peak = Math.max(...values);
    const width = values.filter(value => value > peak * 0.5 && value > 8).length / scale;
    const center = peak > 8 ? values.indexOf(peak) / scale : null;
    return {bands, peak, width, center};
}

export async function run() {
    Gio._promisify(Shell.Screenshot.prototype, 'screenshot');
    Main.overview.hide();
    await Scripting.sleep(1000);
    const extension = Main.extensionManager.lookup('shell-shaders@muratc.com').stateObj;
    const {DECLARATIONS} = await import(extension.dir.get_child('shaderSource.js').get_uri());
    const fragment = 'float mask = ss_tracking(cogl_tex_coord_in[0].y, ss_time); cogl_color_out = vec4(vec3(mask), 1.0);';
    const Base = Shell.GLSLEffect ?? Clutter.ShaderEffect;
    class TrackingProbe extends Base {
        setTime(time) {
            const uniform = Shell.GLSLEffect ? this.get_uniform_location('ss_time') : 'ss_time';
            this.set_uniform_float(uniform, 1, [time]);
            this.queue_repaint();
        }
    }
    if (Shell.GLSLEffect) {
        Object.defineProperty(TrackingProbe.prototype, 'vfunc_build_pipeline', {
            value() {
                this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, DECLARATIONS, fragment, true);
            },
        });
    } else {
        Object.defineProperty(TrackingProbe.prototype, 'vfunc_get_static_snippet', {
            value() {
                const snippet = Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, DECLARATIONS, null);
                snippet.set_replace(fragment);
                return snippet;
            },
        });
    }
    const ProbeEffect = GObject.registerClass(TrackingProbe);
    const probes = [1, 2].map((scale, index) => {
        const actor = new St.Widget({
            x: 80 + index * 180, y: 80, width: 64, height: 240,
            scale_x: scale, scale_y: scale, style: 'background-color: black;',
        });
        const effect = new ProbeEffect();
        actor.add_effect(effect);
        Main.uiGroup.add_child(actor);
        return {actor, effect, scale};
    });
    const directory = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent()
        .get_child('test-results').get_path();
    GLib.mkdir_with_parents(directory, 0o755);
    const report = [];
    try {
        for (let index = 0; index < 24; index++) {
            const time = index * 2.25;
            for (const {effect} of probes)
                effect.setTime(time);
            await Scripting.sleep(80);
            const path = `${directory}/tracking-mask.png`;
            const stream = Gio.File.new_for_path(path).replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            try {
                await new Shell.Screenshot().screenshot(false, stream);
            } finally {
                stream.close(null);
            }
            const pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
            const samples = probes.map(({actor, scale}) => measure(pixbuf, actor.x + 32 * scale, actor.y, scale));
            for (const sample of samples)
                assert(sample.bands <= 1, `Repeated tracking bands at time ${time}`);
            assert(samples[0].bands === samples[1].bands, `Scale changes band count at time ${time}`);
            if (samples[0].bands > 0) {
                assert(Math.abs(samples[0].center - samples[1].center) <= 2, `Scale changes band position at time ${time}`);
                assert(Math.abs(samples[0].width - samples[1].width) <= 2, `Scale changes band width at time ${time}`);
                if (time === 4.5)
                    GLib.file_set_contents(`${directory}/tracking-mask-visible.png`, GLib.file_get_contents(path)[1]);
            }
            report.push({time, samples});
        }
        const visible = report.filter(item => item.samples[0].bands > 0);
        assert(visible.length >= 6 && visible.length < report.length, 'Tracking must include passes and quiet gaps');
        assert(new Set(visible.map(item => item.samples[0].peak)).size >= 3, 'Tracking strength must vary');
        assert(new Set(visible.map(item => Math.round(item.samples[0].width))).size >= 3, 'Tracking width must vary');
        GLib.file_set_contents(`${directory}/tracking-validation.json`, JSON.stringify(report, null, 2));
        print('Tracking GLSL checks passed: single band, variable passes, quiet gaps, and matching 100%/200% actor scale.');
    } finally {
        for (const {actor} of probes)
            actor.destroy();
    }
}
