const assert = require('node:assert/strict');
const { test } = require('node:test');
const { installWholeColumns } = require('../src/whole-columns.js');

function fixture() {
    let width = 950, columnWidth = 310, nextFrame, mutations, resized, present = true;
    const props = new Map();
    const observations = new Map();
    let deliveries = 0;
    const style = {
        getPropertyValue: key => props.get(key) || '',
        setProperty: (key, value) => props.set(key, value),
        removeProperty: key => props.delete(key)
    };
    const element = () => {
        const attributes = new Set();
        return {
            isConnected: true, attributes, style,
            setAttribute: key => attributes.add(key),
            removeAttribute: key => attributes.delete(key),
            toggleAttribute: (key, value) => value ? attributes.add(key) : attributes.delete(key)
        };
    };
    const list = { ...element(), children: [] };
    const container = {
        ...element(), clientLeft: 0, scrollLeft: 200,
        get clientWidth() { return width; },
        getBoundingClientRect: () => ({ left: 60, right: 60 + width }),
        querySelector: () => list, contains: node => node === list
    };
    const root = element();
    container.parentElement = root;
    list.parentElement = container;
    for (let i = 0; i < 6; i++) {
        const column = {
            ...element(), scrollTop: i * 90,
            parentElement: list,
            classList: { contains: value => value === 'column' },
            contains: () => false,
            getBoundingClientRect() {
                const index = list.children.indexOf(this);
                const firstWidth = Math.min(columnWidth, parseFloat(props.get('--otd-first-column-width')) || 0);
                const left = 65 + (index ? firstWidth + 5 + (index - 1) * (columnWidth + 5) : 0);
                return { left, right: left + (index ? columnWidth : firstWidth) };
            }
        };
        list.children.push(column);
    }
    const env = {
        document: { documentElement: root, querySelector: () => present ? container : null },
        getComputedStyle: node => node === list ? { paddingLeft: '5px', paddingRight: '0px' } : { marginLeft: '0px', marginRight: '5px' },
        requestAnimationFrame: callback => { nextFrame = callback; return 1; },
        cancelAnimationFrame: () => { nextFrame = null; },
        ResizeObserver: class { constructor(cb) { resized = cb; } observe() {} unobserve() {} disconnect() {} },
        MutationObserver: class {
            constructor(cb) { mutations = cb; }
            observe(node, options) { observations.set(node, options); }
            disconnect() { observations.clear(); }
        }
    };
    const stop = installWholeColumns(env);
    const flush = () => { const callback = nextFrame; nextFrame = null; callback?.(); };
    const visible = () => list.children.filter(column => !column.attributes.has('data-otd-overflow-column'));
    return {
        list, container, root, stop, flush, visible, observations,
        resize(value) { width = value; resized(); flush(); },
        setColumnWidth(value) { columnWidth = value; resized(); flush(); },
        mutate(target = list, type = 'childList', attributeName = 'class') {
            let matched = false;
            for (let node = target; node; node = node.parentElement) {
                const options = observations.get(node);
                if (options && (node === target || options.subtree) &&
                    (type === 'childList' ? options.childList :
                        options.attributes && options.attributeFilter.includes(attributeName))) matched = true;
            }
            if (matched) { deliveries++; mutations([{ target, type, attributeName }]); }
            flush();
        },
        get deliveries() { return deliveries; },
        get pending() { return !!nextFrame; },
        setPresent(value) { present = value; }
    };
}

test('shows only complete columns at exact-fit boundaries', () => {
    const deck = fixture();
    deck.flush();
    assert.equal(deck.visible().length, 3);
    assert.equal(deck.container.scrollLeft, 0);
    deck.resize(945);
    assert.equal(deck.visible().length, 3);
    deck.resize(944);
    assert.equal(deck.visible().length, 2);
    deck.resize(944.5);
    assert.equal(deck.visible().length, 2);
    deck.resize(1259);
    assert.equal(deck.visible().length, 3);
    deck.resize(1260);
    assert.equal(deck.visible().length, 4);
});

test('shrinks the first column in tiny windows and restores all mounted columns', () => {
    const deck = fixture();
    const originalNodes = [...deck.list.children];
    const scrollPositions = originalNodes.map(node => node.scrollTop);
    deck.resize(180);
    assert.equal(deck.visible().length, 1);
    assert.equal(deck.list.children[0].getBoundingClientRect().right, 235);
    deck.resize(1900);
    assert.equal(deck.visible().length, 6);
    assert.deepEqual(deck.list.children, originalNodes);
    assert.deepEqual(deck.list.children.map(node => node.scrollTop), scrollPositions);
    assert.equal(deck.list.children[0].getBoundingClientRect().right, 375);
});

test('reordering, removals and width settings recalculate the visible prefix', () => {
    const deck = fixture();
    deck.flush();
    const last = deck.list.children.pop();
    deck.list.children.unshift(last);
    deck.mutate();
    assert.equal(deck.visible()[0], last);
    deck.setColumnWidth(350);
    assert.equal(deck.visible().length, 2);
    deck.setColumnWidth(270);
    assert.equal(deck.visible().length, 3);
    deck.list.children.splice(0, 4);
    deck.mutate();
    assert.equal(deck.visible().length, 2);
});

test('waits for deck creation, ignores tweet mutations, and cleans up', () => {
    const deck = fixture();
    deck.setPresent(false);
    deck.flush();
    deck.setPresent(true);
    deck.mutate();
    assert.equal(deck.visible().length, 3);
    deck.mutate({ contains: () => false });
    assert.equal(deck.pending, false);
    deck.stop();
    assert.equal(deck.container.attributes.has('data-otd-whole-columns'), false);
    assert.equal(deck.visible().length, 6);
    assert.equal(deck.observations.size, 0);
});

test('observes layout nodes directly without delivering tweet or animation mutations', () => {
    const deck = fixture();
    deck.flush();
    assert.ok([...deck.observations.values()].every(options => !options.subtree));
    const column = deck.list.children[0];
    const row = { parentElement: column };
    deck.mutate(row);
    deck.mutate(row, 'attributes');
    deck.mutate(column); // Inserting rows inside a column is not a layout mutation.
    deck.mutate(column, 'attributes', 'data-otd-overflow-column');
    assert.equal(deck.deliveries, 0);
    deck.mutate(column, 'attributes', 'style');
    deck.mutate(deck.root, 'attributes');
    deck.mutate(deck.list);
    assert.equal(deck.deliveries, 3);
});

test('returns to discovery after deck removal and narrows again on remount', () => {
    const deck = fixture();
    deck.flush();
    deck.setPresent(false);
    deck.mutate(deck.root);
    assert.equal(deck.observations.size, 1);
    assert.equal(deck.observations.get(deck.root).subtree, true);
    deck.setPresent(true);
    deck.mutate(deck.root);
    assert.ok([...deck.observations.values()].every(options => !options.subtree));
    assert.equal(deck.visible().length, 3);
});
