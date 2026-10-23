import Cairo from 'cairo';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';
import {PRESETS} from '../presets.js';

export const METRICS = {};
export function init() {
    global.settings.set_strv('enabled-extensions', ['shader-effects@muratc.com']);
}

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

async function capture(name) {
    const directory = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent()
        .get_child('test-results/retro').get_path();
    GLib.mkdir_with_parents(directory, 0o755);
    const stream = Gio.File.new_for_path(`${directory}/${name}.png`)
        .replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    try {
        await new Shell.Screenshot().screenshot(false, stream);
    } finally {
        stream.close(null);
    }
}

export async function run() {
    Gio._promisify(Shell.Screenshot.prototype, 'screenshot');
    Main.overview.hide();
    await Scripting.sleep(1200);
    const {settings, controller} = Main.extensionManager.lookup('shader-effects@muratc.com').stateObj;
    const fixture = new St.DrawingArea({x: 40, y: 55, width: 1200, height: 620});
    fixture.connect('repaint', area => {
        const cr = area.get_context();
        const rectangle = (x, y, w, h, r, g, b) => {
            cr.setSourceRGB(r, g, b);
            cr.rectangle(x, y, w, h);
            cr.fill();
        };
        const text = (value, x, y, size, r = 0.86, g = 0.92, b = 1) => {
            cr.selectFontFace('monospace', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
            cr.setFontSize(size);
            cr.setSourceRGB(r, g, b);
            cr.moveTo(x, y);
            cr.showText(value);
        };
        rectangle(0, 0, 1200, 620, 0.035, 0.045, 0.075);
        rectangle(0, 0, 1200, 64, 0.10, 0.13, 0.20);
        text('RETRO / DISPLAY LAB', 28, 42, 26);
        text('SIGNAL 01   /   1989', 850, 40, 18, 0.35, 0.9, 0.72);
        text('> SYSTEM READY', 32, 112, 24, 0.3, 1, 0.65);
        text('The quick brown fox jumps over the lazy dog.', 32, 154, 18);
        text('0123456789  [] {} <> / * + - =', 32, 186, 16);
        for (let i = 0; i < 6; i++) {
            const colors = [[1, 0.24, 0.32], [1, 0.65, 0.19], [1, 0.90, 0.40],
                [0.25, 0.9, 0.64], [0.25, 0.65, 1], [0.72, 0.42, 1]];
            rectangle(32 + i * 90, 220, 82, 65, ...colors[i]);
        }
        for (let i = 0; i < 512; i++) {
            const t = i / 511;
            rectangle(32 + i, 310, 1, 55, t, t, t);
            rectangle(32 + i, 385, 1, 55, t, 0.25, 1 - t);
        }
        text('GRAYSCALE / CHROMA / FINE DETAIL', 32, 480, 16);
        for (let i = 0; i < 128; i++)
            rectangle(32 + i * 4, 500, 2, 60, 0.8, 0.85, 0.9);
        // A synthetic sunset with deliberately sharp pixel-art silhouettes.
        for (let y = 0; y < 400; y++)
            rectangle(620, 100 + y, 548, 1, 0.35 + y / 900, 0.12 + y / 2200, 0.52 - y / 1800);
        cr.setSourceRGB(1, 0.71, 0.35);
        cr.arc(900, 275, 104, 0, 2 * Math.PI);
        cr.fill();
        for (let i = 0; i < 15; i++) {
            const height = 45 + (i * 47) % 110;
            rectangle(620 + i * 38, 500 - height, 34, height, 0.035, 0.05, 0.1);
            for (let y = 0; y < height - 12; y += 20)
                rectangle(630 + i * 38, 500 - height + 8 + y, 5, 7, 0.3, 0.65, 0.75);
        }
        rectangle(620, 500, 548, 65, 0.06, 0.08, 0.14);
        text('PIXEL CITY / NIGHT SHIFT', 645, 542, 20);
        cr.$dispose();
    });
    Main.uiGroup.add_child(fixture);
    settings.set_boolean('animate', false);
    settings.set_boolean('enabled', false);
    settings.set_string('scope', 'screen');
    await Scripting.sleep(200);
    await capture('original');
    settings.set_boolean('enabled', true);
    for (const {id} of PRESETS.filter(item => item.id === 'crt' || item.shader >= 6)) {
        settings.set_string('preset', id);
        for (const intensity of [0.55, 1]) {
            settings.set_double('intensity', intensity);
            await Scripting.sleep(120);
            await capture(`${id}-${intensity}`);
        }
        if (id === 'technicolor') {
            // Drive the shader clock directly so captures do not depend on timing.
            for (const [phase, time] of [['phase-0', 0], ['phase-1', 1 / 24], ['frozen', 1 / 24]]) {
                for (const {effect} of controller._effects.values())
                    effect.setTime(time);
                await Scripting.sleep(120);
                await capture(`${id}-${phase}`);
            }
            settings.set_double('intensity', 0);
            assert(controller._effects.size === 0 && controller._timer === 0,
                `${id}: zero intensity must release resources`);
            await Scripting.sleep(120);
            await capture(`${id}-zero`);
            settings.set_double('intensity', 1);
            for (const {effect} of controller._effects.values())
                effect.setTime(0);
        }
    }

    settings.set_boolean('enabled', false);
    assert(controller._effects.size === 0, 'Disabling must release effects');
    fixture.destroy();
    print('CRT variants render and resource cleanup checks passed.');
}
