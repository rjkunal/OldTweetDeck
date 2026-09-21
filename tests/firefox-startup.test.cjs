const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/injection.js'), 'utf8');

// Exercise the real loader up to its document replacement. Stop there so tests
// need neither a Twitter account nor downloaded application bundles.
function startup(userAgent, readyState, delayedFetch = false) {
    const events = new EventTarget();
    const replaced = new Error('document replaced');
    let html = 'original page';
    let finishFetch;
    const response = { text: async () => 'TweetDeck' };
    const document = {
        readyState,
        addEventListener: events.addEventListener.bind(events),
        documentElement: {
            set innerHTML(value) { html = value; throw replaced; }
        }
    };
    const window = { chrome: { runtime: {} }, addEventListener() {}, postMessage() {} };
    const context = vm.createContext({
        window, chrome: window.chrome, navigator: { userAgent }, document,
        fetch: () => delayedFetch ? new Promise(resolve => { finishFetch = () => resolve(response); }) : Promise.resolve(response),
        console
    });
    vm.runInContext(source, context);
    const done = context.main().catch(error => { assert.equal(error, replaced); });
    return {
        done,
        get html() { return html; },
        finishFetch() { finishFetch(); },
        finishParsing() {
            // Model the parser's last write before DOMContentLoaded.
            html += ' + late original markup';
            document.readyState = 'interactive';
            events.dispatchEvent(new Event('DOMContentLoaded'));
        }
    };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

test('Firefox waits for late parser writes before replacing the document', async () => {
    const page = startup('Firefox/150', 'loading');
    await tick();
    assert.equal(page.html, 'original page');
    page.finishParsing();
    await page.done;
    assert.equal(page.html, 'TweetDeck');
});

for (const state of ['interactive', 'complete']) {
    test(`Firefox proceeds immediately when the document is ${state}`, async () => {
        const page = startup('Firefox/150', state);
        await page.done;
        assert.equal(page.html, 'TweetDeck');
    });
}

test('Firefox does not miss DOMContentLoaded while HTML is being fetched', async () => {
    const page = startup('Firefox/150', 'loading', true);
    page.finishParsing();
    page.finishFetch();
    await page.done;
    assert.equal(page.html, 'TweetDeck');
});

test('Chrome startup timing is unchanged', async () => {
    const page = startup('Chrome/150', 'loading');
    await page.done;
    assert.equal(page.html, 'TweetDeck');
});
