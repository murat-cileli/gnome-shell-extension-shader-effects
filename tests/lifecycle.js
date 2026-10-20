import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

const UUID = 'shader-effects@muratc.com';
export const METRICS = {};

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

export function init() {
    global.settings.set_strv('enabled-extensions', [UUID]);
}

export async function run() {
    Main.overview.hide();
    await Scripting.sleep(1000);

    for (let cycle = 0; cycle < 3; cycle++) {
        await Main.extensionManager.enableExtension(UUID);
        await Scripting.sleep(200);
        const extension = Main.extensionManager.lookup(UUID)?.stateObj;
        assert(extension?.controller, `Cycle ${cycle}: extension did not enable`);
        const indicator = extension._indicator;
        const controller = extension.controller;
        const menu = indicator.menu;
        const fields = ['_enabled', '_animate', '_monochrome', '_presetMenu', '_scopeMenu',
            '_windowMenu', '_intensityLabel', '_slider', '_icon'];
        const destroyed = new Map(fields.map(field => [field, 0]));
        for (const field of fields) {
            indicator[field].connect('destroy', () => {
                destroyed.set(field, destroyed.get(field) + 1);
            });
        }
        let menuDestroyed = false;
        menu.connect('destroy', () => {
            menuDestroyed = true;
        });

        extension.settings.set_string('scope', 'screen');
        extension.settings.set_string('preset', ['vhs', 'ntsc', 'curved-crt'][cycle]);
        extension.settings.set_boolean('animate', true);
        extension.settings.set_boolean('enabled', true);
        await Scripting.sleep(100);
        assert(controller._effects.size === 1, 'Desktop effect must be active');
        assert(controller._timer !== 0, 'Animation must be active');
        const effects = [...controller._effects.values()].map(entry => entry.effect);
        menu.open();
        indicator._presetMenu.menu.open();
        await Scripting.sleep(100);
        assert(menu.isOpen, 'Disable must be tested with the menu open');

        await Main.extensionManager.disableExtension(UUID);
        await Scripting.sleep(100);
        for (const field of fields) {
            assert(destroyed.get(field) === 1, `${field} must be destroyed exactly once`);
            assert(indicator[field] === null, `${field} reference must be cleared`);
        }
        assert(menuDestroyed, 'Parent menu must be destroyed');
        assert(indicator._menuOpenId === 0, 'Menu signal must be disconnected');
        assert(indicator._presetItems.size === 0 && indicator._scopeItems.size === 0,
            'Menu item maps must be cleared');
        assert(indicator._extension === null && indicator._settings === null,
            'Indicator must release the extension and settings');
        assert(extension._indicator === null && extension.controller === null && extension.settings === null,
            'Extension must release its resources');
        assert(controller._effects.size === 0 && controller._timer === 0 && !controller._unredirectDisabled,
            'Controller must release effects, animation and scanout inhibition');
        assert(effects.every(effect => effect._history === null), 'Disable must release GPU history');
    }
    print('Lifecycle checks passed: 3 enable/disable cycles, open menu, active effects, single destruction and cleared references.');
}
