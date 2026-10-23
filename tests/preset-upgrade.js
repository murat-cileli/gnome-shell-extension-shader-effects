import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';
import {PRESETS} from '../presets.js';

const UUID = 'shader-effects@muratc.com';
export const METRICS = {};

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

export function init() {
    // Seed a saved value using an older schema without the current choices.
    // Both schema versions share the test's isolated in-memory backend and path.
    const directory = GLib.dir_make_tmp('shader-effects-old-schema-XXXXXX');
    const xml = `${directory}/org.gnome.shell.extensions.shader-effects.gschema.xml`;
    const compiled = `${directory}/gschemas.compiled`;
    try {
        GLib.file_set_contents(xml, `<schemalist>
            <schema id="org.gnome.shell.extensions.shader-effects"
                path="/org/gnome/shell/extensions/shader-effects/">
                <key name="preset" type="s"><default>'vhs'</default></key>
            </schema>
        </schemalist>`);
        const compiler = Gio.Subprocess.new(['glib-compile-schemas', '--strict', directory],
            Gio.SubprocessFlags.NONE);
        assert(compiler.wait_check(null), 'Legacy test schema must compile');
        const source = Gio.SettingsSchemaSource.new_from_directory(directory, null, false);
        const settings = Gio.Settings.new_full(
            source.lookup('org.gnome.shell.extensions.shader-effects', false), null, null);
        settings.set_string('preset', 'phosphor-trails');
    } finally {
        GLib.unlink(xml);
        GLib.unlink(compiled);
        GLib.rmdir(directory);
    }
    global.settings.set_strv('enabled-extensions', [UUID]);
}

export async function run() {
    Main.overview.hide();
    await Scripting.sleep(1000);
    let extension = Main.extensionManager.lookup(UUID).stateObj;
    assert(extension?.controller, 'Extension must enable with a removed saved preset');
    assert(extension.settings.get_string('preset') === 'vhs',
        'Removed saved preset must fall back to the schema default');
    assert(extension._indicator._presetItems.size === 7, 'Panel must offer seven effects');
    assert(PRESETS.length === 7, 'Exactly seven presets must be available');

    await Main.extensionManager.disableExtension(UUID);
    await Scripting.sleep(200);
    const bindings = new Map();
    const originalAddKeybinding = Main.wm.addKeybinding;
    Main.wm.addKeybinding = function (name, settings, flags, modes, callback) {
        bindings.set(name, callback);
        return originalAddKeybinding.call(this, name, settings, flags, modes, callback);
    };
    try {
        await Main.extensionManager.enableExtension(UUID);
        await Scripting.sleep(200);
        extension = Main.extensionManager.lookup(UUID).stateObj;
        extension.settings.set_boolean('enabled', true);
        assert(extension.controller._effects.size === 1, 'Fallback effect must render');
        const first = extension.settings.get_string('preset');
        const visited = new Set();
        for (let index = 0; index < PRESETS.length; index++) {
            bindings.get('cycle-shortcut')();
            visited.add(extension.settings.get_string('preset'));
            assert(extension.controller._effects.size === 1, 'Cycling must retain the effect');
        }
        assert(visited.size === 7 && extension.settings.get_string('preset') === first,
            'Shortcut must cycle through all seven effects and return to the first');
    } finally {
        Main.wm.addKeybinding = originalAddKeybinding;
        await Main.extensionManager.disableExtension(UUID);
        await Scripting.sleep(200);
    }
    print('Preset upgrade checks passed: saved-value fallback, panel choices and shortcut cycle.');
}
