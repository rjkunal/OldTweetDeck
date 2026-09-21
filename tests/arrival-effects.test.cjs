const assert = require('node:assert/strict');
const { test } = require('node:test');
const { installArrivalEffects } = require('../src/arrival-effects.js');
function fixture() {
    const classes = () => { const values = new Set(); return { add: name => values.add(name), remove: name => values.delete(name), contains: name => values.has(name) }; };
    const listeners = {};
    const header = { classList: classes() };
    let overflow = false, atTop = true, now = 0;
    const column = { hasAttribute: () => overflow, querySelector: () => header };
    const row = { classList: classes(), closest: () => column, matches: () => true, querySelector: () => ({}) };
    const media = { matches: false };
    const calls = [];
    function Column() { this.state = { columnKey: 'home' }; }
    const original = Column.prototype.slideInChirps = function(...args) { calls.push({ self: this, args }); return 42; };
    const doc = {
        hidden: false, documentElement: { classList: { contains: () => true } },
        addEventListener: (name, cb) => { listeners[name] = cb; },
        removeEventListener: name => { delete listeners[name]; },
        querySelectorAll: selector => selector === '.ember-arriving' ? [row] : [header]
    };
    const env = { document: doc, TD: { ui: { Column, columns: { isScrolledToTop: () => atTop } } }, matchMedia: () => media, Date: { now: () => now } };
    const stop = installArrivalEffects(env);
    const instance = new Column();
    const flags = { insertAtTop: true, insertAtBottom: false, containsNewChirps: true };
    return { env, doc, row, header, media, calls, original, stop, instance, flags,
        insert: (options = flags, temporary = false) => instance.slideInChirps([{ $node: [row] }], temporary, 1, 1, options),
        event: (type, name, target = row) => listeners[type]({ animationName: name, target }),
        overflow: value => { overflow = value; }, atTop: value => { atTop = value; }, time: value => { now = value; }
    };
}

test('new top-of-feed tweets glow and preserve the renderer call and return value', () => {
    const f = fixture();
    assert.equal(f.insert(), 42);
    assert.equal(f.row.classList.contains('ember-arriving'), true);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].self, f.instance);
    assert.equal(f.calls[0].args[4], f.flags);
    f.event('animationend', 'ember-tweet-arrival');
    assert.equal(f.row.classList.contains('ember-arriving'), false);
});

for (const kind of ['initial', 'history', 'gap', 'temporary', 'reduced motion', 'hidden tab', 'hidden column', 'scrolled away']) {
    test(`does not animate ${kind}`, () => {
        const f = fixture();
        let flags = { ...f.flags };
        if (kind === 'initial' || kind === 'history') flags.insertAtBottom = true;
        if (kind === 'gap') flags.containsNewChirps = false;
        if (kind === 'reduced motion') f.media.matches = true;
        if (kind === 'hidden tab') f.doc.hidden = true;
        if (kind === 'hidden column') f.overflow(true);
        if (kind === 'scrolled away') f.atTop(false);
        f.insert(flags, kind === 'temporary');
        assert.equal(f.row.classList.contains('ember-arriving'), false);
        assert.equal(f.calls.length, 1);
    });
}

test('header pulses start with the visible row and are limited during bursts', () => {
    const f = fixture();
    f.insert();
    assert.equal(f.header.classList.contains('ember-arrival-pulse'), false);
    f.event('animationstart', 'ember-tweet-arrival');
    assert.equal(f.header.classList.contains('ember-arrival-pulse'), true);
    f.event('animationend', 'ember-header-arrival', f.header);
    f.time(1000);
    f.event('animationstart', 'ember-tweet-arrival');
    assert.equal(f.header.classList.contains('ember-arrival-pulse'), false);
    f.time(1600);
    f.event('animationstart', 'ember-tweet-arrival');
    assert.equal(f.header.classList.contains('ember-arrival-pulse'), true);
});

test('queued animation is suppressed if reduced motion changes; installation cleans up', () => {
    const f = fixture();
    f.insert();
    f.media.matches = true;
    f.event('animationstart', 'ember-tweet-arrival');
    assert.equal(f.row.classList.contains('ember-arriving'), false);
    const wrapped = f.env.TD.ui.Column.prototype.slideInChirps;
    installArrivalEffects(f.env);
    assert.equal(f.env.TD.ui.Column.prototype.slideInChirps, wrapped);
    f.stop();
    assert.equal(f.env.TD.ui.Column.prototype.slideInChirps, f.original);
});
