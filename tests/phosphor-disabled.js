import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

const UUID = 'shader-effects@muratc.com';
export const METRICS = {};

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

function assertBlocked(extension) {
    const {settings, controller} = extension;
    assert(!settings.get_boolean('enabled'), 'Unavailable effect must switch effects off');
    assert(controller._effects.size === 0, 'Unavailable effect must create no GPU effects');
    assert(controller._timer === 0, 'Unavailable effect must not animate');
    assert(!controller._unredirectDisabled, 'Unavailable effect must release scanout inhibition');
    assert(!Main.uiGroup.get_effect('shader-effects-effect'), 'Desktop must remain unaffected');
}

export function init() {
    global.settings.set_strv('enabled-extensions', [UUID]);
}

export async function run() {
    Main.overview.hide();
    await Scripting.sleep(1000);
    let extension = Main.extensionManager.lookup(UUID).stateObj;
    const {PRESETS} = await import(`${extension.dir.get_uri()}/presets.js`);
    const blocked = PRESETS.find(preset => preset.id === 'phosphor-trails');
    const warningCount = () => Main.messageTray.getSources()
        .flatMap(source => source.notifications)
        .filter(notification => notification.body === blocked.unavailableMessage).length;

    extension.settings.set_string('preset', 'crt');
    extension.settings.set_boolean('enabled', true);
    assert(extension.controller._effects.size === 1, 'Other effects must still work');
    extension._indicator._presetItems.get(blocked.id).emit('activate', null);
    assert(extension.settings.get_string('preset') === 'crt', 'Panel selection must preserve current preset');
    assert(extension.controller._effects.size === 1, 'Panel warning must preserve the existing effect');
    assert(warningCount() > 0, 'Panel selection must show the unavailable warning');

    // Exercise external settings while a valid effect is active, then repeated enable attempts.
    extension.settings.set_string('preset', blocked.id);
    assertBlocked(extension);
    for (const scope of ['screen', 'windows']) {
        extension.settings.set_string('scope', scope);
        extension.settings.set_boolean('enabled', true);
        assertBlocked(extension);
    }

    // Loading an update with an already-saved enabled Phosphor setting must be safe.
    const savedSettings = extension.settings;
    await Main.extensionManager.disableExtension(UUID);
    await Scripting.sleep(200);
    savedSettings.set_string('scope', 'screen');
    savedSettings.set_boolean('enabled', true);
    await Main.extensionManager.enableExtension(UUID);
    await Scripting.sleep(200);
    extension = Main.extensionManager.lookup(UUID).stateObj;
    assertBlocked(extension);

    // Capture the real shortcut callbacks while re-enabling with blocked settings.
    await Main.extensionManager.disableExtension(UUID);
    await Scripting.sleep(200);
    const bindings = new Map();
    const originalAddKeybinding = Main.wm.addKeybinding;
    Main.wm.addKeybinding = function (name, settings, flags, modes, callback) {
        bindings.set(name, callback);
        return originalAddKeybinding.call(this, name, settings, flags, modes, callback);
    };
    await Main.extensionManager.enableExtension(UUID);
    await Scripting.sleep(200);
    extension = Main.extensionManager.lookup(UUID).stateObj;
    assertBlocked(extension);
    bindings.get('toggle-shortcut')();
    assertBlocked(extension);
    for (let index = 0; index < 12; index++) {
        bindings.get('cycle-shortcut')();
        assert(extension.settings.get_string('preset') !== blocked.id, 'Cycle shortcut must skip Phosphor');
    }
    Main.wm.addKeybinding = originalAddKeybinding;

    const {ShaderEffect} = await import(`${extension.dir.get_uri()}/effect.js`);
    extension.settings.set_string('preset', blocked.id);
    const directEffect = new ShaderEffect();
    directEffect.configure(extension.settings);
    assert(!directEffect.get_enabled() && directEffect._history === null,
        'Direct configuration must disable Phosphor without allocating history');
    extension.settings.set_string('preset', 'crt');
    directEffect.configure(extension.settings);
    assert(directEffect.get_enabled(), 'Direct configuration must still allow available effects');
    directEffect.releaseResources();

    extension._indicator._presetItems.get(blocked.id).emit('activate', null);
    await Scripting.sleep(500);
    Gio._promisify(Shell.Screenshot.prototype, 'screenshot');
    const directory = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent()
        .get_child('test-results').get_path();
    GLib.mkdir_with_parents(directory, 0o755);
    const stream = Gio.File.new_for_path(`${directory}/phosphor-unavailable.png`)
        .replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    try {
        await new Shell.Screenshot().screenshot(false, stream);
    } finally {
        stream.close(null);
    }
    await Main.extensionManager.disableExtension(UUID);
    await Scripting.sleep(200);
    print('Phosphor quarantine checks passed: panel warning, external settings, startup, shortcuts and GPU guard.');
}
