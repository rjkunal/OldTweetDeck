const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function loader(fetch) {
    const chrome = { runtime: {} };
    const context = vm.createContext({
        window: { chrome, addEventListener() {}, postMessage() {} }, chrome,
        navigator: { userAgent: 'Firefox' }, fetch,
        console: { warn() {}, log() {} }
    });
    vm.runInContext(read('src/injection.js'), context);
    return context;
}
const remoteSource = '// remote code '.repeat(10);
const response = text => ({ ok: true, text: async () => text });

test('successful updates do not read the bundled duplicate', async () => {
    const calls = [];
    const context = loader(async url => { calls.push(url); return response(remoteSource); });
    assert.equal(await context.loadAsset('/files/vendor.js', false), remoteSource);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /^https:\/\/raw.githubusercontent.com\//);
});

for (const failure of ['network', 'http', 'body', 'short']) {
    test(`falls back to bundled code after ${failure} failure`, async () => {
        const calls = [];
        const context = loader(async url => {
            calls.push(url);
            if (url.startsWith('moz-extension:')) return response('local code');
            if (failure === 'network') throw new Error('offline');
            if (failure === 'http') return { ok: false };
            if (failure === 'body') return { ok: true, text: async () => { throw new Error('read failed'); } };
            return response('short');
        });
        assert.equal(await context.loadAsset('/files/vendor.js', false), 'local code');
        assert.equal(calls.length, 2);
    });
}

test('local-only preference makes no remote requests', async () => {
    const context = loader(async url => {
        assert.match(url, /^moz-extension:/);
        return response('local');
    });
    assert.equal(await context.loadAsset('/files/vendor.js', true), 'local');
});

test('mixed update success keeps successful remote assets', async () => {
    const context = loader(async url => {
        if (url.startsWith('moz-extension:')) return response('local fallback');
        if (url.endsWith('vendor.js')) return response(remoteSource);
        throw new Error('offline');
    });
    assert.deepEqual(await Promise.all([
        context.loadAsset('/files/vendor.js', false), context.loadAsset('/files/bundle.js', false)
    ]), [remoteSource, 'local fallback']);
});

test('unavailable bundled fallback reports a useful failure', async () => {
    const context = loader(async () => ({ ok: false, status: 404 }));
    await assert.rejects(context.loadAsset('/files/vendor.js', true), /bundled.*vendor.js: 404/);
});

test('known interception source becomes sets; changed upstream source is untouched', () => {
    const context = loader();
    const source = read('src/interception.js');
    const optimized = context.optimizeSeenIds(source);
    assert.notEqual(optimized, source);
    new vm.Script(optimized);
    const changed = source + '\nseenHomeTweets.length;';
    assert.equal(context.optimizeSeenIds(changed), changed);
    assert.equal(context.optimizeSeenIds(optimized), optimized);
});

test('real home deduplication loop preserves results without accumulating repeat IDs', () => {
    const context = loader();
    const original = read('src/interception.js');
    const optimized = context.optimizeSeenIds(original);
    function run(source) {
        const start = source.indexOf('if(!seenHomeTweets[xhr.storage.user_id])');
        const end = source.indexOf('\n                }', start);
        const loop = source.slice(start, end);
        const state = vm.createContext({ seenHomeTweets: {}, xhr: { storage: { user_id: 'a' } } });
        const outputs = [];
        for (const since of [false, false, true]) {
            state.xhr.storage.since_id = since;
            state.pushTweets = [{id_str:'1'}, {id_str:'2'}, {id_str: since ? '3' : '2'}];
            state.tweets = [];
            vm.runInContext(loop, state);
            outputs.push(state.tweets.map(t => t.id_str));
        }
        return { outputs, size: vm.runInContext('seenHomeTweets.a.size ?? seenHomeTweets.a.length', state) };
    }
    const before = run(original), after = run(optimized);
    assert.deepEqual(after.outputs, before.outputs);
    assert.equal(after.size, 3);
    assert.ok(before.size > after.size);
});

test('bounded caches retain recent IDs across repeated evictions and isolate accounts', () => {
    const source = loader().optimizeSeenIds(read('src/interception.js'));
    const start = source.indexOf('if(!seenHomeTweets[xhr.storage.user_id])');
    const end = source.indexOf('\n                }', start);
    const loop = new vm.Script(source.slice(start, end));
    const state = vm.createContext({ seenHomeTweets: {}, xhr: { storage: { user_id: 'a', since_id: true } } });
    function refresh(ids) {
        state.pushTweets = ids.map(id_str => ({ id_str }));
        state.tweets = [];
        loop.runInContext(state);
        return state.tweets.map(tweet => tweet.id_str);
    }
    for (let batch = 0; batch < 24; batch++) {
        const ids = Array.from({ length: 5000 }, (_, i) => String(batch * 5000 + i));
        assert.equal(refresh(ids).length, 5000);
        assert.equal(refresh(ids).length, 0);
        assert.ok(state.seenHomeTweets.a.size <= 50000);
    }
    assert.equal(state.seenHomeTweets.a.has('0'), false);
    assert.equal(refresh(Array.from({ length: 45000 }, (_, i) => String(75000 + i))).length, 0);
    state.xhr.storage.user_id = 'b';
    assert.deepEqual(refresh(['119999']), ['119999']);
    assert.equal(state.seenHomeTweets.b.size, 1);
    assert.ok(state.seenHomeTweets.a.has('119999'));
});

test('notification cache is bounded and suppresses repeated recent notifications', () => {
    const source = loader().optimizeSeenIds(read('src/interception.js'));
    const start = source.indexOf('let seenNotifications =');
    const end = source.indexOf('let seenHomeTweets', start);
    const state = vm.createContext({});
    vm.runInContext(source.slice(start, end) + '\nglobalThis.cache = seenNotifications;', state);
    for (let i = 0; i < 100001; i++) state.cache.add(`tweet-${i}-user-favorite`);
    assert.ok(state.cache.size <= 50000);
    const size = state.cache.size;
    const id = 'tweet-100000-user-favorite';
    const operation = source.match(/if\(seenNotifications\.has\(id\)\) continue;\s*seenNotifications\.add\(id\);/)[0];
    state.ids = [id, id, 'new-notification', 'new-notification'];
    assert.equal(vm.runInContext(`let accepted = 0; for (const id of ids) { ${operation} accepted++; } accepted;`, state), 1);
    assert.equal(state.cache.size, size + 1);
    assert.equal(state.cache.has('tweet-0-user-favorite'), false);
});
