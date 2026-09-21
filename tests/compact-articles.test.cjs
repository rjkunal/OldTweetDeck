const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const chrome = { runtime: {} };
const loader = vm.createContext({
    window: { chrome, addEventListener() {}, postMessage() {} }, chrome,
    navigator: { userAgent: 'Firefox' }, console: { warn() {} }
});
vm.runInContext(read('src/injection.js'), loader);
const original = read('files/vendor.js');
const updated = loader.compactArticleCards(original);

function convert(source, dark, image = true) {
    const start = source.indexOf('e.convertSummaryLargeImageCard = function');
    const end = source.indexOf('\n\t}, function(t, e, n) {', start);
    const values = {
        card_url: 'https://example.com/article', vanity_url: 'example.com',
        title: 'A long article headline that must remain intact', description: 'Article description'
    };
    const constants = {
        ComponentStates: { DEFAULT: 'default' },
        ComponentKeys: { MEDIA: 'media', DETAILS: 'details', IMAGE_ENTITY: 'image', DESTINATION: 'link' },
        ComponentTypes: { MEDIA: 'media', DETAILS: 'details' },
        DestinationTypes: { BROWSER: 'browser' }
    };
    const context = vm.createContext({
        document: { documentElement: { classList: { contains: name => dark && name === 'dark' } } },
        e: {}, i: constants,
        r: {
            getImageValue: () => image ? { url: 'https://example.com/photo.jpg', width: 1200, height: 630 } : null,
            getStringValue: (_, type, key) => values[Array.isArray(key) ? key[0] : key],
            createImageEntity: value => ({ type: 'photo', ...value })
        }
    });
    vm.runInContext(source.slice(start, end), context);
    return JSON.parse(JSON.stringify(context.e.convertSummaryLargeImageCard('id', 'summary_large_image', {})));
}

test('only the article converter is changed; the resulting vendor script parses', () => {
    assert.notEqual(updated, original);
    new vm.Script(updated);
    const marker = 'e.convertSummaryLargeImageCard = function';
    assert.equal(updated.slice(0, updated.indexOf(marker)), original.slice(0, original.indexOf(marker)));
    const nextModule = '\n\t}, function(t, e, n) {';
    assert.equal(updated.slice(updated.indexOf(nextModule, updated.indexOf(marker))),
        original.slice(original.indexOf(nextModule, original.indexOf(marker))));
});

test('dark article cards use square thumbnails without losing links or text', () => {
    const before = convert(original, true), after = convert(updated, true);
    assert.equal(after.layout.default.size, 'small');
    assert.equal(after.card.components_data.media.data.aspect_ratio, 1);
    before.layout.default.size = 'small';
    before.card.components_data.media.data.aspect_ratio = 1;
    assert.deepEqual(after, before);
});

test('light mode and imageless cards keep the original output', () => {
    for (const [dark, image] of [[false, true], [false, false], [true, false]]) {
        assert.deepEqual(convert(updated, dark, image), convert(original, dark, image));
    }
});

test('unrecognized upstream code and already patched code are left intact', () => {
    const changed = original.replace('size: l ? "large" : "small"', 'size: otherLayout');
    assert.equal(loader.compactArticleCards(changed), changed);
    assert.equal(loader.compactArticleCards('new upstream format'), 'new upstream format');
    assert.equal(loader.compactArticleCards(updated), updated);
});
