import Cogl from 'gi://Cogl';

import {HISTORY_DECLARATIONS, HISTORY_FRAGMENT} from './shaderSource.js';

// Two render targets avoid reading and writing the same texture during feedback.
export class PhosphorHistory {
    constructor(context, width, height) {
        this.width = width;
        this.height = height;
        this._index = 0;
        this._time = null;
        this._textures = [];
        this._buffers = [];
        this._pipeline = Cogl.Pipeline.new(context);
        this._pipeline.set_blend('RGBA = ADD (SRC_COLOR, 0)');
        const snippet = Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, HISTORY_DECLARATIONS, null);
        snippet.set_replace(HISTORY_FRAGMENT);
        this._pipeline.add_snippet(snippet);
        this._decay = this._pipeline.get_uniform_location('ss_decay');
        for (let index = 0; index < 2; index++) {
            const texture = Cogl.Texture2D.new_with_size(context, width, height);
            texture.set_auto_mipmap(false);
            const buffer = Cogl.Offscreen.new_with_texture(texture);
            buffer.allocate();
            buffer.orthographic(0, 0, width, height, -1, 1);
            buffer.clear4f(Cogl.BufferBit.COLOR, 0, 0, 0, 0);
            this._textures.push(texture);
            this._buffers.push(buffer);
        }
        for (const layer of [0, 1]) {
            this._pipeline.set_layer_filters(layer, Cogl.PipelineFilter.LINEAR, Cogl.PipelineFilter.LINEAR);
            this._pipeline.set_layer_wrap_mode(layer, Cogl.PipelineWrapMode.CLAMP_TO_EDGE);
        }
    }

    update(source, time) {
        if (time === this._time)
            return this._textures[this._index];
        const elapsed = this._time === null ? 0 : Math.min((time - this._time + 3600) % 3600, 0.25);
        this._pipeline.set_layer_texture(0, source);
        this._pipeline.set_layer_texture(1, this._textures[this._index]);
        this._pipeline.set_uniform_1f(this._decay, this._time === null ? 0 : Math.exp(-elapsed * 7.5));
        this._index = 1 - this._index;
        this._buffers[this._index].draw_textured_rectangle(
            this._pipeline, 0, 0, this.width, this.height, 0, 0, 1, 1);
        this._time = time;
        return this._textures[this._index];
    }

    destroy() {
        this._pipeline.remove_layer(0);
        this._pipeline.remove_layer(1);
        this._pipeline = null;
        this._buffers = [];
        this._textures = [];
    }
}
