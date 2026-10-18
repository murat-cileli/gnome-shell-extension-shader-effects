import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';

import {DECLARATIONS, FRAGMENT} from './shaderSource.js';
import {PRESETS} from './presets.js';

const EffectBase = Shell.GLSLEffect ?? Clutter.ShaderEffect;

class ShellShadersEffect extends EffectBase {
    _init() {
        super._init();
        this._uniforms = new Map();
        for (const name of ['resolution', 'time', 'intensity', 'preset', 'spacing', 'premultiplied'])
            this._uniforms.set(name, Shell.GLSLEffect ? this.get_uniform_location(`ss_${name}`) : `ss_${name}`);
        this._set('premultiplied', [Shell.GLSLEffect ? 0 : 1]);
        this.setTime(0);
    }

    configure(settings) {
        this._set('intensity', [settings.get_double('intensity')]);
        this._set('preset', [PRESETS.find(preset => preset.id === settings.get_string('preset')).shader]);
        this._set('spacing', [settings.get_double('scanline-spacing')]);
        this.queue_repaint();
    }

    setTime(time) {
        this._set('time', [time]);
        this.queue_repaint();
    }

    _set(name, values) {
        this.set_uniform_float(this._uniforms.get(name), values.length, values);
    }

    vfunc_paint_target(node, paintContext) {
        const texture = this.get_texture();
        if (texture)
            this._set('resolution', [texture.get_width(), texture.get_height()]);
        super.vfunc_paint_target(node, paintContext);
    }
}

if (Shell.GLSLEffect) {
    Object.defineProperty(ShellShadersEffect.prototype, 'vfunc_build_pipeline', {
        value() {
            this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, DECLARATIONS, FRAGMENT, true);
        },
    });
} else {
    Object.defineProperty(ShellShadersEffect.prototype, 'vfunc_get_static_snippet', {
        value() {
            const snippet = Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, DECLARATIONS, null);
            snippet.set_replace(FRAGMENT);
            return snippet;
        },
    });
}

export const ShaderEffect = GObject.registerClass(ShellShadersEffect);
