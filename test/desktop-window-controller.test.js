import test from 'node:test';
import assert from 'node:assert/strict';

import { DesktopWindowController } from '../src/platform/tauri/DesktopWindowController.js';

class ClassListFake {
    constructor () { this.values = new Set(); }
    add (value) { this.values.add(value); }
    remove (value) { this.values.delete(value); }
    contains (value) { return this.values.has(value); }
}

class ElementFake extends EventTarget {
    constructor (id) {
        super();
        this.id = id;
        this.hidden = true;
    }

    closest (selector) {
        return selector === `#${this.id}` ? this : null;
    }
}

class DocumentFake {
    constructor () {
        this.documentElement = { classList: new ClassListFake() };
        this.elements = new Map([
            'appTitlebar',
            'desktopWindowControls',
            'windowMinimize',
            'windowMaximize',
            'windowClose',
        ].map(id => [id, new ElementFake(id)]));
    }

    getElementById (id) {
        return this.elements.get(id) ?? null;
    }
}

function mouseDown (detail) {
    const event = new Event('mousedown');
    Object.defineProperties(event, {
        button: { value: 0 },
        detail: { value: detail },
    });
    return event;
}

test('desktop window controller is inert outside Tauri', () => {
    const documentRef = new DocumentFake();
    const controller = new DesktopWindowController({
        documentRef,
        runtimeCheck: () => false,
        windowFactory: () => { throw new Error('must not create a native window'); },
    });

    assert.equal(controller.start(), false);
    assert.equal(documentRef.getElementById('desktopWindowControls').hidden, true);
    assert.equal(documentRef.documentElement.classList.contains('tauri-desktop'), false);
});

test('desktop window controller delegates chrome gestures to Tauri', async () => {
    const documentRef = new DocumentFake();
    const operations = [];
    const appWindow = {
        minimize: () => operations.push('minimize'),
        toggleMaximize: () => operations.push('toggleMaximize'),
        close: () => operations.push('close'),
        startDragging: () => operations.push('startDragging'),
    };
    const controller = new DesktopWindowController({
        documentRef,
        runtimeCheck: () => true,
        windowFactory: () => appWindow,
    });

    assert.equal(controller.start(), true);
    documentRef.getElementById('windowMinimize').dispatchEvent(new Event('click'));
    documentRef.getElementById('windowMaximize').dispatchEvent(new Event('click'));
    documentRef.getElementById('windowClose').dispatchEvent(new Event('click'));
    documentRef.getElementById('appTitlebar').dispatchEvent(mouseDown(1));
    documentRef.getElementById('appTitlebar').dispatchEvent(mouseDown(2));
    await Promise.resolve();

    assert.deepEqual(operations, [
        'minimize', 'toggleMaximize', 'close', 'startDragging', 'toggleMaximize',
    ]);
    assert.equal(documentRef.getElementById('desktopWindowControls').hidden, false);
    assert.equal(documentRef.documentElement.classList.contains('tauri-desktop'), true);

    controller.stop();
    assert.equal(documentRef.getElementById('desktopWindowControls').hidden, true);
});
