export const PRESETS = Object.freeze([
    {id: 'vhs', name: 'VHS', shader: 0, animated: true},
    {id: 'vhs-bw', name: 'VHS (Black & White)', shader: 4, animated: true},
    {id: 'ntsc', name: 'NTSC', shader: 5, animated: true},
    {id: 'scanlines', name: 'Scanlines', shader: 1, animated: false},
    {id: 'crt', name: 'CRT', shader: 2, animated: true},
    {id: 'monochrome', name: 'Monochrome', shader: 3, animated: false},
]);

export const SCOPES = Object.freeze([
    {id: 'screen', name: 'Entire desktop'},
    {id: 'windows', name: 'Selected windows'},
]);
