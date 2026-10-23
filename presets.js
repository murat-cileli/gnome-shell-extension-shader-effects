export const PRESETS = Object.freeze([
    {id: 'vhs', name: 'VHS', shader: 0, animated: true},
    {id: 'ntsc', name: 'NTSC', shader: 5, animated: true},
    {id: 'scanlines', name: 'Scanlines', shader: 1, animated: false},
    {id: 'crt', name: 'CRT', shader: 2, animated: true},
    {id: 'curved-crt', name: 'CRT (Curved)', shader: 6, animated: true},
    {id: 'green-crt', name: 'CRT (Green)', shader: 7, animated: true},
    {id: 'amber-crt', name: 'CRT (Amber)', shader: 8, animated: true},
    {id: 'technicolor', name: 'Technicolor', shader: 10, animated: true},
]);

export const SCOPES = Object.freeze([
    {id: 'screen', name: 'Entire desktop'},
    {id: 'windows', name: 'Selected windows'},
]);
