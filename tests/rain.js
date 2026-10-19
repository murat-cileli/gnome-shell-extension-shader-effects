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

async function capture(name) {
    const directory = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent()
        .get_child('test-results/rain').get_path();
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
    const extension = Main.extensionManager.lookup('shader-effects@muratc.com').stateObj;
    const {ShaderEffect} = await import(extension.dir.get_child('effect.js').get_uri());
    const {settings, controller} = extension;
    settings.set_boolean('enabled', false);
    settings.set_boolean('animate', false);
    settings.set_boolean('monochrome', false);

    const background = new St.Widget({x: 0, y: 40, width: 1280, height: 680,
        style: 'background-color: #24354b;'});
    Main.uiGroup.add_child(background);
    const fixture = new St.DrawingArea({x: 40, y: 60, width: 1200, height: 600});
    fixture.connect('repaint', area => {
        const cr = area.get_context();
        const rectangle = (x, y, width, height, alpha) => {
            cr.setSourceRGBA(0, 0, 0, alpha);
            cr.rectangle(x, y, width, height);
            cr.fill();
        };
        // Transparent margins and translucent black simulate window shadows.
        for (let i = 0; i < 4; i++)
            rectangle(80 + i * 260, 20, 240, 40, [0.02, 0.15, 0.5, 0.8][i]);
        rectangle(60, 90, 1080, 440, 1);
        cr.setSourceRGB(0.6, 0.7, 0.8);
        for (let x = 90; x < 1100; x += 40) {
            cr.rectangle(x, 130, 2, 340);
            cr.fill();
        }
        cr.$dispose();
    });
    Main.uiGroup.add_child(fixture);
    await Scripting.sleep(200);
    await capture('original');
    const effect = new ShaderEffect();
    fixture.add_effect_with_name('alpha-test', effect);
    // Phosphor history has a separate GPU lifecycle test.
    for (const {id} of PRESETS.filter(preset => preset.id !== 'phosphor-trails')) {
        settings.set_string('preset', id);
        settings.set_double('intensity', 1);
        effect.configure(settings);
        effect.setTime(0);
        await Scripting.sleep(120);
        await capture(`${id}-full`);
        settings.set_double('intensity', 0);
        effect.configure(settings);
        await Scripting.sleep(120);
        await capture(`${id}-zero`);
    }
    settings.set_string('preset', 'rain');
    settings.set_double('intensity', 1);
    effect.configure(settings);
    effect.setTime(1.7);
    await Scripting.sleep(120);
    await capture('rain-next');
    await Scripting.sleep(200);
    await capture('rain-frozen');
    settings.set_boolean('monochrome', true);
    effect.configure(settings);
    await Scripting.sleep(120);
    await capture('rain-monochrome');
    fixture.remove_effect(effect);
    fixture.destroy();
    background.destroy();

    settings.set_boolean('monochrome', false);
    settings.set_boolean('animate', true);
    settings.set_boolean('enabled', true);
    if (!controller._timer)
        throw new Error('Rain must schedule animation');
    settings.set_boolean('animate', false);
    if (controller._timer)
        throw new Error('Frozen rain must stop animation scheduling');
    settings.set_boolean('enabled', false);
    print('Transparency and rain capture/scheduling checks passed.');
}
