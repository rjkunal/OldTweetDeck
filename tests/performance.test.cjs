const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('startup preserves asset order and Accounts setup attaches only one handler', async () => {
    const intervals = new Map();
    const handlers = [];
    const sent = [];
    const installed = [];
    const requested = [];
    let buttonVisible = false;
    let queries = 0;
    const button = { addEventListener: (type, callback) => handlers.push(callback) };
    const chrome = { runtime: { sendMessage: message => sent.push(message) } };
    const context = vm.createContext({
        navigator: { userAgent: 'Firefox' },
        window: { chrome, addEventListener() {}, postMessage() {} },
        chrome,
        document: {
            readyState: 'complete', documentElement: {},
            head: { appendChild: element => installed.push(element) },
            createElement: tag => ({ tag }),
            querySelector: selector => {
                assert.equal(selector, 'a[data-title="Accounts"]');
                queries++;
                return buttonVisible ? button : null;
            }
        },
        localStorage: { getItem: () => null },
        fetch: async url => {
            requested.push(url);
            return { ok: true, text: async () => `// fixture ${url}` +
                (url.endsWith('/files/ember.css') ? '\n' + read('files/ember.css') : ''), json: async () => [] };
        },
        setTimeout() {},
        setInterval: callback => { intervals.set(1, callback); return 1; },
        clearInterval: id => intervals.delete(id),
        console: { log() {}, warn() {}, error(error) { throw error; } }
    });
    vm.runInContext(read('src/injection.js'), context);
    await context.main();
    assert.deepEqual(installed.map(element => [element.tag, element.textContent.split('\n')[0].split("/").pop()]), [
        ["script", "challenge.js"], ["script", "interception.js"],
        ["style", "bundle.css"], ["style", "ember.css"], ["style", "whole-columns.css"], ["style", "arrival-effects.css"], ["script", "vendor.js"],
        ["script", "bundle.js"], ["script", "twitter-text.js"], ["script", "whole-columns.js"], ["script", "arrival-effects.js"]
    ]);
    assert.equal(requested.filter(url => url.endsWith("/files/ember.css")).length, 1);
    assert.match(requested.find(url => url.endsWith("/files/ember.css")), /^moz-extension:/);
    const theme = installed.find(element => element.textContent.includes('@font-face')).textContent;
    const fonts = [...theme.matchAll(/url\("(moz-extension:\/\/[^\"]+\.woff2)"\)/g)];
    assert.equal(fonts.length, 1);
    for (const [, url] of fonts) {
        const font = fs.readFileSync(path.join(__dirname, '..', new URL(url).pathname));
        assert.equal(font.toString('ascii', 0, 4), 'wOF2');
    }
    assert.equal(requested.filter(url => url.startsWith("https://raw.githubusercontent.com/")).length, 6);
    const tick = () => { for (const callback of [...intervals.values()]) callback(); };
    tick();
    assert.equal(handlers.length, 0);
    assert.equal(intervals.size, 1, 'keep waiting until Accounts exists');
    buttonVisible = true;
    tick();
    assert.equal(intervals.size, 0, 'stop after attaching the listener');
    for (let second = 0; second < 3600; second++) tick();
    assert.equal(queries, 2);
    assert.equal(handlers.length, 1);
    handlers[0]();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].action, 'setcookie');
});

test('closing a tab releases its URL record and preserves other tabs', () => {
    const event = () => ({ addListener() {} });
    let onCommitted, onRemoved;
    const context = vm.createContext({
        browser: {},
        chrome: {
            webRequest: {
                OnHeadersReceivedOptions: {},
                onHeadersReceived: event(), onBeforeSendHeaders: event(),
                onBeforeRequest: event()
            },
            webNavigation: { onCommitted: { addListener: cb => { onCommitted = cb; } } },
            tabs: { onRemoved: { addListener: cb => { onRemoved = cb; } } },
            runtime: { onMessage: event() }
        }
    });
    vm.runInContext(read('src/background.js'), context);
    for (const tabId of [10, 20]) {
        onCommitted({ tabId, frameId: 0, url: 'https://x.com/i/tweetdeck' });
    }
    assert.equal(vm.runInContext('Object.keys(urls).length', context), 2);
    onRemoved(10);
    onRemoved(999); // Closing an untracked tab is harmless.
    assert.equal(vm.runInContext('urls[10]', context), undefined);
    assert.equal(vm.runInContext('urls[20][0]', context), 'https://x.com/i/tweetdeck');
});
