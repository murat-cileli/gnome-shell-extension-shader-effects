import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {ShaderEffect} from './effect.js';
import {PRESETS} from './presets.js';

export class ShaderController {
    constructor(settings, onSelectionChanged) {
        this._settings = settings;
        this._onSelectionChanged = onSelectionChanged;
        this._selected = new Map();
        this._effects = new Map();
        this._timer = 0;
        this._time = 0;
        this._unredirectDisabled = false;
        this._interface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        this._stSettings = St.Settings.get();
        this._settingsId = settings.connect('changed', () => this.sync());
        this._animationsId = this._interface.connect('changed::enable-animations', () => this.sync());
        this._sessionId = Main.sessionMode.connect('updated', () => this.sync());
        this._motionId = St.ReducedMotion
            ? this._stSettings.connect('notify::reduced-motion', () => this._syncAnimation()) : 0;
        this.sync();
    }

    get selectedCount() {
        return this._selected.size;
    }

    isSelected(actor) {
        return this._selected.has(actor);
    }

    getWindows() {
        const types = [Meta.WindowType.NORMAL, Meta.WindowType.DIALOG,
            Meta.WindowType.MODAL_DIALOG, Meta.WindowType.UTILITY];
        return global.get_window_actors().filter(actor => {
            const window = actor.meta_window;
            return !actor.is_destroyed() && window && !window.is_override_redirect() &&
                types.includes(window.get_window_type());
        }).sort((a, b) => a.meta_window.get_stable_sequence() - b.meta_window.get_stable_sequence());
    }

    toggleWindow(actor) {
        if (!this.getWindows().includes(actor))
            return;
        if (this._selected.has(actor)) {
            actor.disconnect(this._selected.get(actor));
            this._selected.delete(actor);
        } else {
            const id = actor.connect('destroy', () => {
                this._selected.delete(actor);
                this._removeEffect(actor);
                this.sync();
                this._onSelectionChanged();
            });
            this._selected.set(actor, id);
        }
        this.sync();
        this._onSelectionChanged();
    }

    clearSelection() {
        for (const [actor, id] of this._selected)
            actor.disconnect(id);
        this._selected.clear();
        this.sync();
        this._onSelectionChanged();
    }

    sync() {
        const active = this._settings.get_boolean('enabled') &&
            this._settings.get_double('intensity') > 0 &&
            !Main.sessionMode.isLocked && !Main.sessionMode.isGreeter;
        const targets = new Set();
        if (active) {
            if (this._settings.get_string('scope') === 'screen')
                targets.add(Main.uiGroup);
            else
                for (const actor of this._selected.keys())
                    targets.add(actor);
        }
        for (const actor of this._effects.keys()) {
            if (!targets.has(actor))
                this._removeEffect(actor);
        }
        for (const actor of targets) {
            let entry = this._effects.get(actor);
            if (!entry) {
                const effect = new ShaderEffect();
                effect.configure(this._settings);
                effect.setTime(this._time);
                actor.add_effect_with_name('shader-effects-effect', effect);
                const mappedId = actor.connect('notify::mapped', () => this._syncAnimation());
                entry = {effect, mappedId};
                this._effects.set(actor, entry);
            } else {
                entry.effect.configure(this._settings);
            }
        }
        const needsCompositing = this._effects.size > 0;
        if (needsCompositing !== this._unredirectDisabled) {
            if (needsCompositing)
                global.compositor.disable_unredirect();
            else
                global.compositor.enable_unredirect();
            this._unredirectDisabled = needsCompositing;
        }
        this._syncAnimation();
    }

    _removeEffect(actor) {
        const entry = this._effects.get(actor);
        if (!entry)
            return;
        actor.disconnect(entry.mappedId);
        actor.remove_effect(entry.effect);
        this._effects.delete(actor);
    }

    _syncAnimation() {
        if (this._timer) {
            GLib.Source.remove(this._timer);
            this._timer = 0;
        }
        const preset = PRESETS.find(item => item.id === this._settings.get_string('preset'));
        if (!preset.animated || !this._settings.get_boolean('animate') ||
            !this._interface.get_boolean('enable-animations') ||
            (St.ReducedMotion && this._stSettings.reduced_motion === St.ReducedMotion.REDUCE) ||
            ![...this._effects.keys()].some(actor => actor.mapped))
            return;
        this._lastTick = GLib.get_monotonic_time();
        const interval = Math.ceil(1000 / this._settings.get_int('frame-rate'));
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            const now = GLib.get_monotonic_time();
            const elapsed = Math.min((now - this._lastTick) / 1_000_000, 0.25);
            this._lastTick = now;
            this._time = (this._time + elapsed * this._settings.get_double('speed')) % 3600;
            for (const [actor, {effect}] of this._effects) {
                if (actor.mapped)
                    effect.setTime(this._time);
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    destroy() {
        if (this._timer)
            GLib.Source.remove(this._timer);
        this._timer = 0;
        this._settings.disconnect(this._settingsId);
        this._interface.disconnect(this._animationsId);
        Main.sessionMode.disconnect(this._sessionId);
        if (this._motionId)
            this._stSettings.disconnect(this._motionId);
        for (const actor of this._effects.keys())
            this._removeEffect(actor);
        for (const [actor, id] of this._selected)
            actor.disconnect(id);
        this._selected.clear();
        if (this._unredirectDisabled)
            global.compositor.enable_unredirect();
        this._unredirectDisabled = false;
        this._onSelectionChanged = null;
        this._settings = null;
        this._interface = null;
        this._stSettings = null;
    }
}
