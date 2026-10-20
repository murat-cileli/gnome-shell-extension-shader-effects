import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';
import {AVAILABLE_PRESETS} from '../presets.js';

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
        .get_child('test-results').get_path();
    GLib.mkdir_with_parents(directory, 0o755);
    const stream = Gio.File.new_for_path(`${directory}/${name}.png`)
        .replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    const shooter = new Shell.Screenshot();
    try {
        await shooter.screenshot(false, stream);
    } finally {
        stream.close(null);
    }
}

export async function run() {
    Gio._promisify(Shell.Screenshot.prototype, 'screenshot');
    Main.overview.hide();
    await Scripting.sleep(1500);
    const record = Main.extensionManager.lookup('shader-effects@muratc.com');
    assert(record?.stateObj?.controller, `Extension did not enable: ${record?.errors}`);
    const extension = record.stateObj;
    const {settings, controller} = extension;
    assert(controller._effects.size === 0, 'Effects must start disabled');
    await Scripting.createTestWindow({width: 540, height: 400});
    await Scripting.createTestWindow({width: 440, height: 320, alpha: true});
    await Scripting.waitTestWindows();
    await Scripting.sleep(500);
    const windows = controller.getWindows();
    assert(windows.length >= 2, 'Two real window actors are required');
    windows[0].meta_window.move_frame(true, 80, 100);
    windows[1].meta_window.move_frame(true, 720, 200);

    const chart = new St.BoxLayout({
        x: 80, y: 540, width: 1100, height: 100,
        style: 'background-color: #202020;',
    });
    for (const color of ['#ffffff', '#f04444', '#49c779', '#538bf2', '#f4cf5e', '#777777']) {
        chart.add_child(new St.Label({
            text: 'Shader Effects', x_expand: true,
            style: `background-color: ${color}; color: #101010; padding: 20px;`,
        }));
    }
    Main.uiGroup.add_child(chart);
    await Scripting.sleep(300);
    await capture('desktop-original');

    settings.set_boolean('animate', false);
    settings.set_boolean('monochrome', false);
    settings.set_double('intensity', 0.8);
    settings.set_boolean('enabled', true);
    for (const {id: preset} of AVAILABLE_PRESETS) {
        settings.set_string('preset', preset);
        if (preset.startsWith('vhs'))
            for (const {effect} of controller._effects.values())
                effect.setTime(4.5);
        await Scripting.sleep(250);
        assert(controller._effects.size === 1 && controller._effects.has(Main.uiGroup), 'Desktop effect target');
        assert(controller._timer === 0, 'Frozen effects must not schedule redraws');
        await capture(`desktop-${preset}`);
        const effect = [...controller._effects.values()][0].effect;
        const history = effect._history;
        settings.set_boolean('monochrome', true);
        assert(settings.get_string('preset') === preset, 'Monochrome must preserve the selected effect');
        assert(effect._history === history, 'Monochrome must preserve phosphor history');
        await Scripting.sleep(150);
        await capture(`desktop-${preset}-monochrome`);
        settings.set_double('intensity', 0.2);
        await Scripting.sleep(150);
        await capture(`desktop-${preset}-monochrome-low-intensity`);
        settings.set_boolean('monochrome', false);
        settings.set_double('intensity', 0.8);
        await Scripting.sleep(150);
        await capture(`desktop-${preset}-color-restored`);
    }

    const pattern = new St.Widget({
        x: 80, y: 80, width: 1100, height: 420, style: 'background-color: #808080;',
    });
    pattern.add_child(new St.Widget({width: 360, height: 420, style: 'background-color: black;'}));
    for (let x = 0; x < 360; x += 6)
        pattern.add_child(new St.Widget({x, width: 3, height: 420, style: 'background-color: white;'}));
    pattern.add_child(new St.Widget({x: 400, width: 240, height: 420, style: 'background-color: #ee3333;'}));
    pattern.add_child(new St.Widget({x: 640, width: 240, height: 420, style: 'background-color: #3333ee;'}));
    Main.uiGroup.add_child(pattern);
    settings.set_boolean('enabled', false);
    await Scripting.sleep(250);
    await capture('ntsc-original');
    settings.set_string('preset', 'ntsc');
    settings.set_double('intensity', 1);
    settings.set_boolean('enabled', true);
    for (const [phase, time] of [['0', 0], ['1', 1 / 30], ['frozen', 1 / 30]]) {
        for (const {effect} of controller._effects.values())
            effect.setTime(time);
        await Scripting.sleep(250);
        await capture(`ntsc-phase-${phase}`);
    }
    for (const preset of ['crt', 'curved-crt']) {
        settings.set_string('preset', preset);
        await Scripting.sleep(200);
        await capture(`scanline-${preset}`);
    }
    pattern.destroy();

    settings.set_string('preset', 'vhs');
    settings.set_boolean('monochrome', true);
    settings.set_double('intensity', 0.8);
    settings.set_string('scope', 'windows');
    assert(controller._effects.size === 0, 'Empty window selection must have no effects');
    controller.toggleWindow(windows[0]);
    assert(controller._effects.size === 1 && controller._effects.has(windows[0]), 'Selected window target');
    assert(!controller._effects.has(windows[1]) && !controller._effects.has(Main.uiGroup), 'Unselected targets must stay clean');
    await Scripting.sleep(250);
    await capture('selected-window');

    controller.toggleWindow(windows[1]);
    assert(controller._effects.size === 2, 'Multiple windows can be selected');
    await Scripting.sleep(250);
    await capture('selected-transparent-window');
    settings.set_string('preset', 'ntsc');
    settings.set_boolean('monochrome', false);
    await Scripting.sleep(250);
    await capture('selected-ntsc-windows');
    for (const {id: preset} of AVAILABLE_PRESETS.filter(item => item.shader >= 6)) {
        settings.set_string('preset', preset);
        await Scripting.sleep(150);
        await capture(`selected-${preset}`);
    }
    settings.set_string('preset', 'vhs');
    settings.set_string('scope', 'screen');
    assert(controller._effects.size === 1 && controller.selectedCount === 2, 'Scope switching preserves selection without stacking');
    settings.set_string('scope', 'windows');
    assert(controller._effects.size === 2, 'Window selection is restored');

    settings.set_string('preset', 'vhs');
    settings.set_boolean('animate', true);
    await Scripting.sleep(200);
    assert(controller._timer !== 0, 'VHS must animate');
    const time = controller._time;
    await Scripting.sleep(200);
    assert(controller._time > time, 'Animation time must advance');
    settings.set_boolean('monochrome', true);
    assert(controller._timer !== 0, 'Monochrome must preserve VHS animation');
    settings.set_boolean('monochrome', false);
    settings.set_string('preset', 'ntsc');
    assert(controller._timer !== 0, 'NTSC must animate');
    settings.set_string('preset', 'scanlines');
    assert(controller._timer === 0, 'Scanlines must be static');
    for (const preset of AVAILABLE_PRESETS.filter(item => item.shader >= 6)) {
        settings.set_string('preset', preset.id);
        assert(Boolean(controller._timer) === preset.animated, `${preset.id}: animation scheduling`);
        await Scripting.sleep(100);
    }
    settings.set_string('preset', 'vhs');
    controller._interface.set_boolean('enable-animations', false);
    assert(controller._timer === 0, 'Reduced motion must stop animation');
    controller._interface.set_boolean('enable-animations', true);
    settings.set_double('intensity', 0);
    assert(controller._effects.size === 0 && controller._timer === 0 && !controller._unredirectDisabled, 'Zero intensity must release resources');
    settings.set_double('intensity', 0.55);

    extension._indicator.menu.open();
    const presetBeforeToggle = settings.get_string('preset');
    extension._indicator._monochrome.toggle();
    assert(settings.get_boolean('monochrome'), 'Panel Monochrome switch must update settings');
    assert(settings.get_string('preset') === presetBeforeToggle, 'Panel toggle must preserve the effect');
    await Scripting.sleep(250);
    extension._indicator._windowMenu.menu.open();
    await Scripting.sleep(300);
    assert(extension._indicator._windowMenu.menu.isOpen, 'Window selection submenu must open');
    const windowItems = extension._indicator._windowMenu.menu._getMenuItems().filter(item => typeof item.toggle === 'function');
    windowItems[0].toggle();
    assert(controller.selectedCount === 1, 'Window menu must remove a selection');
    windowItems[0].toggle();
    assert(controller.selectedCount === 2, 'Window menu must add a selection');
    await capture('panel-menu');
    settings.set_boolean('monochrome', false);
    assert(!extension._indicator._monochrome.state, 'Panel Monochrome switch must reflect external settings');
    extension._indicator.menu.close();

    windows[0].meta_window.make_fullscreen();
    await Scripting.sleep(300);
    assert(controller._effects.has(windows[0]), 'Fullscreen window retains effect');
    await Scripting.destroyTestWindows();
    await Scripting.sleep(700);
    assert(controller.selectedCount === 0 && controller._effects.size === 0, 'Closed windows must be forgotten');
    assert(controller._timer === 0 && !controller._unredirectDisabled, 'Last closed window releases redraw and scanout resources');
    chart.destroy();

    settings.set_string('scope', 'screen');
    const oldController = controller;
    await Main.extensionManager.disableExtension(extension.uuid);
    await Scripting.sleep(100);
    assert(oldController._effects.size === 0 && oldController._timer === 0, 'Disable must clean up effects and timers');
    assert(!Main.uiGroup.get_effect('shader-effects-effect'), 'Disable must remove the desktop effect');
    await Main.extensionManager.enableExtension('shader-effects@muratc.com');
    await Scripting.sleep(300);
    const next = Main.extensionManager.lookup('shader-effects@muratc.com').stateObj;
    assert(next.controller, 'Extension must re-enable');
    next.settings.set_boolean('enabled', false);
    assert(next.controller._effects.size === 0, 'Effects can be disabled after re-enable');

    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE});
    launcher.setenv('GSETTINGS_BACKEND', 'memory', true);
    launcher.setenv('WAYLAND_DISPLAY', GLib.getenv('WAYLAND_DISPLAY'), true);
    const script = Gio.File.new_for_uri(import.meta.url).get_parent().get_child('preferences.js').get_path();
    const preferences = launcher.spawnv(['gjs', '-m', script, next.path]);
    Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');
    const completion = preferences.communicate_utf8_async(null, null);
    await Scripting.sleep(1200);
    await capture('preferences');
    await Scripting.sleep(1400);
    await capture('preferences-shortcuts');
    const [output, errors] = await completion;
    assert(preferences.get_successful(), `Preferences failed: ${errors}`);
    assert(output.includes('preferences checks passed'), `Preferences incomplete: ${output}`);
    print('Shader Effects integration checks passed.');
}
