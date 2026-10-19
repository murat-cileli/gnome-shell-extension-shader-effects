import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {PRESETS, SCOPES} from './presets.js';

export default class ShaderEffectsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const signals = [];
        window.set_default_size(620, 760);
        window.search_enabled = true;

        const page = new Adw.PreferencesPage({title: 'Shaders', icon_name: 'video-display-symbolic'});
        window.add(page);

        const effects = new Adw.PreferencesGroup({title: 'Effects'});
        page.add(effects);
        this._switch(effects, settings, 'enabled', 'Enable effects', 'Turn the selected shader on or off.');
        this._combo(effects, settings, signals, 'preset', 'Effect', PRESETS);
        this._switch(effects, settings, 'monochrome', 'Monochrome', 'Apply the selected effect in grayscale.');
        this._combo(effects, settings, signals, 'scope', 'Apply to', SCOPES);
        this._spin(effects, settings, 'intensity', 'Intensity', '0 leaves the image unchanged; 1 applies the full effect.', 0, 1, 0.05, 2);
        this._spin(effects, settings, 'scanline-spacing', 'Line / pixel spacing', 'Scanline spacing or LCD pixel size in texture pixels. Dithering uses half this size.', 2, 12, 0.5, 1);

        const animation = new Adw.PreferencesGroup({
            title: 'Animation',
            description: 'VHS, NTSC, both CRT presets, Phosphor Trails, Water Ripples, and Rain respect the desktop’s reduced motion setting. Other effects are static.',
        });
        page.add(animation);
        this._switch(animation, settings, 'animate', 'Animate effects', 'Disable to freeze the effect and stop continuous redraws.');
        this._spin(animation, settings, 'speed', 'Animation speed', 'Playback speed multiplier.', 0.1, 3, 0.1, 1);
        this._spin(animation, settings, 'frame-rate', 'Animation frame rate', 'Lower values reduce GPU activity.', 10, 60, 1, 0);

        const shortcuts = new Adw.PreferencesGroup({title: 'Keyboard shortcuts'});
        page.add(shortcuts);
        for (const [key, title, subtitle] of [
            ['toggle-shortcut', 'Toggle effects', 'Enable or disable the current effect.'],
            ['window-shortcut', 'Toggle focused window', 'Switch to Selected windows and add or remove the focused window.'],
            ['cycle-shortcut', 'Next effect', 'Cycle through all shader presets.'],
        ]) {
            const row = new Adw.ActionRow({title, subtitle});
            const label = new Gtk.ShortcutLabel({valign: Gtk.Align.CENTER, disabled_text: 'Disabled'});
            const update = () => {
                label.accelerator = settings.get_strv(key)[0] ?? '';
            };
            update();
            signals.push(settings.connect(`changed::${key}`, update));
            row.add_suffix(label);
            const edit = new Gtk.Button({
                icon_name: 'document-edit-symbolic',
                tooltip_text: 'Change shortcut',
                valign: Gtk.Align.CENTER,
            });
            edit.add_css_class('flat');
            edit.connect('clicked', () => this._captureShortcut(window, settings, key, title));
            row.add_suffix(edit);
            row.activatable_widget = edit;
            shortcuts.add(row);
        }

        const selection = new Adw.PreferencesGroup({
            title: 'Window selection',
            description: 'Open the Shader Effects panel menu, choose Selected windows, then check the windows to affect. '
                + 'Selections last until a window closes, the extension is disabled, or you log out. '
                + 'Effect settings are saved automatically.',
        });
        page.add(selection);
        window.connect('close-request', () => {
            for (const id of signals)
                settings.disconnect(id);
            signals.length = 0;
            return false;
        });
    }

    _switch(group, settings, key, title, subtitle) {
        const row = new Adw.SwitchRow({title, subtitle});
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
    }

    _combo(group, settings, signals, key, title, choices) {
        const row = new Adw.ComboRow({
            title,
            model: Gtk.StringList.new(choices.map(choice => choice.name)),
            selected: choices.findIndex(choice => choice.id === settings.get_string(key)),
        });
        row.connect('notify::selected', () => {
            if (choices[row.selected])
                settings.set_string(key, choices[row.selected].id);
        });
        signals.push(settings.connect(`changed::${key}`, () => {
            row.selected = choices.findIndex(choice => choice.id === settings.get_string(key));
        }));
        group.add(row);
    }

    _spin(group, settings, key, title, subtitle, lower, upper, step, digits) {
        const row = new Adw.SpinRow({
            title,
            subtitle,
            digits,
            adjustment: new Gtk.Adjustment({lower, upper, step_increment: step, page_increment: step * 5}),
        });
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
    }

    _captureShortcut(window, settings, key, title) {
        const dialog = new Adw.AlertDialog({
            heading: title,
            body: 'Press a combination with Super, Ctrl, or Alt. Press Escape to cancel.',
            close_response: 'cancel',
        });
        dialog.add_response('cancel', 'Cancel');
        dialog.add_response('clear', 'Disable');
        dialog.connect('response', (_dialog, response) => {
            if (response === 'clear')
                settings.set_strv(key, []);
        });
        const controller = new Gtk.EventControllerKey({propagation_phase: Gtk.PropagationPhase.CAPTURE});
        controller.connect('key-pressed', (_controller, keyval, _keycode, state) => {
            if (keyval === Gdk.KEY_Escape) {
                dialog.close();
                return true;
            }
            const modifiers = state & Gtk.accelerator_get_default_mod_mask();
            const required = Gdk.ModifierType.SUPER_MASK | Gdk.ModifierType.CONTROL_MASK | Gdk.ModifierType.ALT_MASK;
            if (!(modifiers & required) || !Gtk.accelerator_valid(keyval, modifiers))
                return true;
            const accelerator = Gtk.accelerator_name(Gdk.keyval_to_lower(keyval), modifiers);
            const duplicate = ['toggle-shortcut', 'window-shortcut', 'cycle-shortcut']
                .some(other => other !== key && settings.get_strv(other).includes(accelerator));
            if (duplicate) {
                dialog.body = 'That shortcut is already assigned to another Shader Effects action.';
                return true;
            }
            settings.set_strv(key, [accelerator]);
            dialog.close();
            return true;
        });
        dialog.add_controller(controller);
        dialog.present(window);
    }
}
