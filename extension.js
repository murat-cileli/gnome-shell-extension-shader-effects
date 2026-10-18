import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Slider} from 'resource:///org/gnome/shell/ui/slider.js';

import {ShaderController} from './controller.js';
import {PRESETS, SCOPES} from './presets.js';

const ShaderIndicator = GObject.registerClass(
class ShaderEffectsIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Shader Effects');
        this._extension = extension;
        this._settings = extension.settings;
        this._icon = new St.Icon({icon_name: 'video-display-symbolic', style_class: 'system-status-icon'});
        this.add_child(this._icon);

        this._enabled = new PopupMenu.PopupSwitchMenuItem('Enable effects', false);
        this._enabled.connect('toggled', (_item, state) => this._settings.set_boolean('enabled', state));
        this.menu.addMenuItem(this._enabled);

        this._presetMenu = new PopupMenu.PopupSubMenuMenuItem('Effect');
        this._presetItems = new Map();
        for (const preset of PRESETS) {
            const item = new PopupMenu.PopupMenuItem(preset.name);
            item.connect('activate', () => this._settings.set_string('preset', preset.id));
            this._presetMenu.menu.addMenuItem(item);
            this._presetItems.set(preset.id, item);
        }
        this.menu.addMenuItem(this._presetMenu);

        this._scopeMenu = new PopupMenu.PopupSubMenuMenuItem('Apply to');
        this._scopeItems = new Map();
        for (const scope of SCOPES) {
            const item = new PopupMenu.PopupMenuItem(scope.name);
            item.connect('activate', () => this._settings.set_string('scope', scope.id));
            this._scopeMenu.menu.addMenuItem(item);
            this._scopeItems.set(scope.id, item);
        }
        this.menu.addMenuItem(this._scopeMenu);

        this._windowMenu = new PopupMenu.PopupSubMenuMenuItem('Selected windows');
        this.menu.addMenuItem(this._windowMenu);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const intensityItem = new PopupMenu.PopupBaseMenuItem({activate: false});
        this._intensityLabel = new St.Label({text: 'Intensity', y_align: Clutter.ActorAlign.CENTER});
        intensityItem.add_child(this._intensityLabel);
        this._slider = new Slider(this._settings.get_double('intensity'));
        this._slider.x_expand = true;
        this._slider.accessible_name = 'Effect intensity';
        intensityItem.add_child(this._slider);
        this._slider.connect('notify::value', () => {
            if (!this._updating)
                this._settings.set_double('intensity', this._slider.value);
        });
        this.menu.addMenuItem(intensityItem);

        this._animate = new PopupMenu.PopupSwitchMenuItem('Animate', true);
        this._animate.connect('toggled', (_item, state) => this._settings.set_boolean('animate', state));
        this.menu.addMenuItem(this._animate);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction('Preferences', () => extension.openPreferences());
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open) {
                this._rebuildWindows();
                this.sync();
            }
        });
        this.sync();
    }

    _rebuildWindows() {
        this._windowMenu.menu.removeAll();
        const controller = this._extension.controller;
        const actors = controller.getWindows();
        if (actors.length === 0) {
            const empty = new PopupMenu.PopupMenuItem('No windows available', {reactive: false});
            this._windowMenu.menu.addMenuItem(empty);
        }
        for (const actor of actors) {
            const window = actor.meta_window;
            const app = Shell.WindowTracker.get_default().get_window_app(window);
            const title = window.get_title() || app?.get_name() || 'Untitled window';
            const item = new PopupMenu.PopupSwitchMenuItem(title, controller.isSelected(actor));
            item.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            item.label.set_style('max-width: 320px;');
            item.connect('toggled', () => controller.toggleWindow(actor));
            this._windowMenu.menu.addMenuItem(item);
        }
        this._windowMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const clear = this._windowMenu.menu.addAction('Clear selection', () => {
            controller.clearSelection();
            this._rebuildWindows();
        });
        clear.setSensitive(controller.selectedCount > 0);
    }

    sync() {
        this._updating = true;
        const enabled = this._settings.get_boolean('enabled');
        const presetId = this._settings.get_string('preset');
        const scopeId = this._settings.get_string('scope');
        const preset = PRESETS.find(item => item.id === presetId);
        const scope = SCOPES.find(item => item.id === scopeId);
        this._enabled.setToggleState(enabled);
        this._animate.setToggleState(this._settings.get_boolean('animate'));
        this._animate.setSensitive(preset.animated);
        this._presetMenu.label.text = `Effect: ${preset.name}`;
        this._scopeMenu.label.text = `Apply to: ${scope.name}`;
        this._windowMenu.label.text = `Selected windows (${this._extension.controller?.selectedCount ?? 0})`;
        this._windowMenu.setSensitive(scopeId === 'windows');
        for (const [id, item] of this._presetItems)
            item.setOrnament(id === presetId ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
        for (const [id, item] of this._scopeItems)
            item.setOrnament(id === scopeId ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
        this._slider.value = this._settings.get_double('intensity');
        this._intensityLabel.text = `Intensity ${Math.round(this._slider.value * 100)}%`;
        this._icon.opacity = enabled ? 255 : 128;
        this.accessible_name = `Shader Effects: ${enabled ? preset.name : 'Off'}`;
        this._updating = false;
    }
});

export default class ShaderEffectsExtension extends Extension {
    enable() {
        this._bindings = [];
        try {
            this.settings = this.getSettings();
            this.controller = new ShaderController(this.settings, () => this._indicator?.sync());
            this._indicator = new ShaderIndicator(this);
            Main.panel.addToStatusArea(this.uuid, this._indicator);
            this._settingsId = this.settings.connect('changed', () => this._indicator.sync());
            this._addBinding('toggle-shortcut', () => {
                this.settings.set_boolean('enabled', !this.settings.get_boolean('enabled'));
            });
            this._addBinding('window-shortcut', () => {
                const actor = global.display.focus_window?.get_compositor_private();
                if (!actor || !this.controller.getWindows().includes(actor))
                    return;
                this.settings.set_string('scope', 'windows');
                this.controller.toggleWindow(actor);
                this.settings.set_boolean('enabled', true);
            });
            this._addBinding('cycle-shortcut', () => {
                const index = PRESETS.findIndex(item => item.id === this.settings.get_string('preset'));
                this.settings.set_string('preset', PRESETS[(index + 1) % PRESETS.length].id);
            });
        } catch (error) {
            this.disable();
            throw error;
        }
    }

    _addBinding(name, callback) {
        Main.wm.addKeybinding(name, this.settings, Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW, callback);
        this._bindings.push(name);
    }

    disable() {
        for (const name of this._bindings ?? [])
            Main.wm.removeKeybinding(name);
        this._bindings = [];
        if (this._settingsId) {
            this.settings.disconnect(this._settingsId);
            this._settingsId = 0;
        }
        this.controller?.destroy();
        this.controller = null;
        this._indicator?.destroy();
        this._indicator = null;
        this.settings = null;
    }
}
