// Wires the Win98 menubar: open/close menus, route menu-item clicks
// into the hidden legacy buttons that still carry the actual handlers.
//
// Why route through #legacyControls instead of refactoring the handlers?
// Each handler in boot() is a closure over locals (statusEl, designer,
// palette, …).  Calling button.click() preserves those bindings — we
// only synthesise the user-action signal.  The `hidden` attribute on the
// wrapper div doesn't block programmatic .click(), so the chain
// menu → btn.click() → original handler stays intact.

export function setupMenubar () {
    const menubar = document.getElementById('menubar');
    if (!menubar) return;

    const menus = menubar.querySelectorAll(':scope > li.menu');
    const state = { openLi: null };

    bindTopLevelMenus(menus, state);
    bindOutsideClicks(menubar, state);
    bindEscape(state);
    bindItemDispatch(menubar, state);
}

function bindTopLevelMenus (menus, state) {
    menus.forEach(li => {
        const title = li.querySelector(':scope > .menu-title');
        if (!title) return;
        title.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (li.classList.contains('open')) closeAll(state);
            else                                openMenu(li, state);
        });
        // Classic Win98: once any menu is open, hovering a sibling switches.
        title.addEventListener('mouseenter', () => {
            if (state.openLi && state.openLi !== li) openMenu(li, state);
        });
    });
}

function openMenu (li, state) {
    if (state.openLi && state.openLi !== li) state.openLi.classList.remove('open');
    state.openLi = li;
    li.classList.add('open');
}

function closeAll (state) {
    if (state.openLi) state.openLi.classList.remove('open');
    state.openLi = null;
}

function bindOutsideClicks (menubar, state) {
    document.addEventListener('click', (ev) => {
        if (!menubar.contains(ev.target)) closeAll(state);
    });
}

function bindEscape (state) {
    // Don't stopPropagation — Designer's Esc handler (clear selection /
    // disarm palette) still needs to run.
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && state.openLi) closeAll(state);
    });
}

function bindItemDispatch (menubar, state) {
    menubar.addEventListener('click', (ev) => {
        const item = ev.target.closest('.menu-item');
        if (!item || item.classList.contains('disabled')) return;
        const cmd = item.dataset.cmd;
        if (!cmd) return;
        ev.stopPropagation();
        dispatchCmd(cmd);
        closeAll(state);
    });
}

function dispatchCmd (cmd) {
    if (cmd === 'about') {
        alert(
            'DSPF·RAD — IronTerm\n\n' +
            'Browser-side IBM i (AS/400) display file designer.\n' +
            'Drag/drop UI builder for DSPF source.\n\n' +
            'Author: Alexandre Bencz\n' +
            'Build: v0.5 (Win98 chrome)');
        return;
    }
    // Everything else: the data-cmd value IS the id of a hidden button —
    // synthesise a click and let the closure-captured handler run.
    const btn = document.getElementById(cmd);
    if (btn) btn.click();
}
