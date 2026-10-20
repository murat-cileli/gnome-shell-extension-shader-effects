import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';

import {DECLARATIONS, FRAGMENT} from './shaderSource.js';
import {PRESETS} from './presets.js';
import {PhosphorHistory} from './phosphorHistory.js';

const EffectBase = Shell.GLSLEffect ?? Clutter.ShaderEffect;

class ShaderEffectsEffect extends EffectBase {
    _init() {
        super._init();
        this._history = null;
        this._preset = null;
        this._uniforms = new Map();
        for (const name of ['resolution', 'time', 'intensity', 'preset', 'spacing', 'premultiplied', 'monochrome'])
            this._uniforms.set(name, Shell.GLSLEffect ? this.get_uniform_location(`ss_${name}`) : `ss_${name}`);
        this._set('premultiplied', [Shell.GLSLEffect ? 0 : 1]);
        this.setTime(0);
    }

    configure(settings) {
        const preset = settings.get_string('preset');
        const definition = PRESETS.find(item => item.id === preset);
        // Defense in depth: never initialize the quarantined feedback renderer.
        if (definition.unavailableMessage) {
            this.set_enabled(false);
            this.releaseResources();
            this._preset = null;
            return;
        }
        this.set_enabled(true);
        if (preset !== this._preset)
            this.releaseResources();
        this._preset = preset;
        this._set('intensity', [settings.get_double('intensity')]);
        this._set('preset', [definition.shader]);
        this._set('spacing', [settings.get_double('scanline-spacing')]);
        this._set('monochrome', [settings.get_boolean('monochrome') ? 1 : 0]);
        this.queue_repaint();
    }

    setTime(time) {
        this._time = time;
        this._set('time', [time]);
        this.queue_repaint();
    }

    _set(name, values) {
        this.set_uniform_float(this._uniforms.get(name), values.length, values);
    }

    vfunc_paint_target(node, paintContext) {
        const texture = this.get_texture();
        if (texture) {
            this._set('resolution', [texture.get_width(), texture.get_height()]);
            const pipeline = this.get_pipeline();
            let history = texture;
            if (this._preset === 'phosphor-trails') {
                const width = texture.get_width();
                const height = texture.get_height();
                if (!this._history || this._history.width !== width || this._history.height !== height) {
                    this.releaseResources();
                    this._history = new PhosphorHistory(pipeline.get_context(), width, height);
                }
                history = this._history.update(texture, this._time);
            }
            pipeline.set_layer_texture(1, history);
            pipeline.set_layer_filters(1, Cogl.PipelineFilter.LINEAR, Cogl.PipelineFilter.LINEAR);
            pipeline.set_layer_wrap_mode(1, Cogl.PipelineWrapMode.CLAMP_TO_EDGE);
        }
        super.vfunc_paint_target(node, paintContext);
    }

    releaseResources() {
        if (this._history) {
            this.get_pipeline().remove_layer(1);
            this._history.destroy();
            this._history = null;
        }
    }
}

if (Shell.GLSLEffect) {
    Object.defineProperty(ShaderEffectsEffect.prototype, 'vfunc_build_pipeline', {
        value() {
            this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, DECLARATIONS, FRAGMENT, true);
        },
    });
} else {
    Object.defineProperty(ShaderEffectsEffect.prototype, 'vfunc_get_static_snippet', {
        value() {
            const snippet = Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, DECLARATIONS, null);
            snippet.set_replace(FRAGMENT);
            return snippet;
        },
    });
}

export const ShaderEffect = GObject.registerClass(ShaderEffectsEffect);
