import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import System from 'system';

imports.package.init({name: 'gnome-shell', prefix: '/usr', libdir: '/usr/lib'});
Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource')._register();

const directory = Gio.File.new_for_path(ARGV[0]);
const metadata = JSON.parse(new TextDecoder().decode(directory.get_child('metadata.json').load_contents(null)[1]));
metadata.dir = directory;
metadata.path = directory.get_path();
const {default: Preferences} = await import(directory.get_child('prefs.js').get_uri());
const {PRESETS} = await import(directory.get_child('presets.js').get_uri());
const preferences = new Preferences(metadata);
const settings = preferences.getSettings();
const app = new Adw.Application({application_id: 'com.muratc.ShaderEffects.PreferencesTest', flags: Gio.ApplicationFlags.NON_UNIQUE});

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

function descendants(widget) {
    const children = [];
    for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
        children.push(child, ...descendants(child));
    return children;
}

app.connect('activate', () => {
    try {
        const window = new Adw.PreferencesWindow({application: app, title: 'Shader Effects Preferences Test'});
        preferences.fillPreferencesWindow(window);
        window.present();
        const widgets = descendants(window);
        const combo = widgets.find(widget => widget instanceof Adw.ComboRow && widget.title === 'Effect');
        combo.selected = PRESETS.findIndex(preset => preset.id === 'crt');
        assert(settings.get_string('preset') === 'crt', 'Preset row must save settings');
        assert(combo.model.get_string(combo.selected + 1) === 'Curved CRT', 'Curved CRT must follow CRT');
        settings.set_string('preset', 'scanlines');
        assert(combo.selected === PRESETS.findIndex(preset => preset.id === 'scanlines'), 'Preset row must reflect external settings');
        const monochrome = widgets.find(widget => widget instanceof Adw.SwitchRow && widget.title === 'Monochrome');
        monochrome.active = true;
        assert(settings.get_boolean('monochrome'), 'Monochrome switch must save settings');
        assert(settings.get_string('preset') === 'scanlines', 'Monochrome must preserve the selected effect');
        settings.set_boolean('monochrome', false);
        assert(!monochrome.active, 'Monochrome switch must reflect external settings');
        combo.selected = PRESETS.findIndex(preset => preset.id === 'ntsc');
        assert(settings.get_string('preset') === 'ntsc', 'NTSC must be selectable');
        for (const preset of PRESETS.filter(item => item.shader >= 6)) {
            combo.selected = PRESETS.findIndex(item => item.id === preset.id);
            assert(settings.get_string('preset') === preset.id, `${preset.name} must be selectable`);
        }
        const spin = widgets.find(widget => widget instanceof Adw.SpinRow && widget.title === 'Intensity');
        spin.value = 0.7;
        assert(Math.abs(settings.get_double('intensity') - 0.7) < 0.001, 'Intensity must save settings');
        const enabled = widgets.find(widget => widget instanceof Adw.SwitchRow && widget.title === 'Enable effects');
        enabled.active = true;
        assert(settings.get_boolean('enabled'), 'Switch must save settings');
        preferences._captureShortcut(window, settings, 'toggle-shortcut', 'Toggle effects');
        const dialog = window.get_visible_dialog();
        assert(dialog instanceof Adw.AlertDialog, 'Shortcut capture must open');
        dialog.emit('response', 'clear');
        dialog.close();
        assert(settings.get_strv('toggle-shortcut').length === 0, 'Shortcut can be disabled');
        settings.reset('toggle-shortcut');
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2200, () => {
            const edit = widgets.find(widget => widget instanceof Gtk.Button && widget.tooltip_text === 'Change shortcut');
            edit.grab_focus();
            return GLib.SOURCE_REMOVE;
        });
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 4200, () => {
            print('Shader Effects preferences checks passed.');
            window.close();
            app.quit();
            return GLib.SOURCE_REMOVE;
        });
    } catch (error) {
        printerr(`${error.message}\n${error.stack}`);
        app.quit();
        System.exit(1);
    }
});

app.run([]);
