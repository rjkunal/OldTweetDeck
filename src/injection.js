let extId;
let isFirefox = navigator.userAgent.indexOf('Firefox') > -1;
let cookie = null;
let otdtoken = null;

if(!window.chrome) window.chrome = {};
if(!window.chrome.runtime) window.chrome.runtime = {};
window.chrome.runtime.getURL = url => {
    if(!url.startsWith('/')) url = `/${url}`;
    return `${isFirefox ? 'moz-extension://' : 'chrome-extension://'}${extId}${url}`;   
}
window.addEventListener('message', e => {
    if(e.data.extensionId) {
        console.log("got extensionId", e.data.extensionId);
        extId = e.data.extensionId;
        main();
    } else if(e.data.cookie) {
        cookie = e.data.cookie;
    } else if(e.data.token) {
        console.log("got otdtoken");
        otdtoken = e.data.token;
    }
});
window.postMessage('extensionId', '*');
window.postMessage('cookie', '*');
window.postMessage('getotdtoken', '*');

async function main() {
    let html = await fetch(chrome.runtime.getURL('/files/index.html')).then(r => r.text());

    // At document_start Firefox may still be parsing X's original HTML. Wait
    // before replacing it so late parser writes cannot interfere with TweetDeck's
    // document or the dynamically generated stylesheet used by preview cards.
    // Check after the fetch: DOMContentLoaded may already have fired by then.
    if (isFirefox && document.readyState === "loading") {
        await new Promise(resolve => {
            document.addEventListener("DOMContentLoaded", resolve, { once: true });
        });
    }

    document.documentElement.innerHTML = html;

    const useLocalFiles = !!localStorage.getItem("OTDalwaysUseLocalFiles");
    // Fetch in parallel, then install in dependency order.
    const assets = [
        { path: "/src/challenge.js", tag: "script", transform: source =>
            source.replaceAll('SOLVER_URL', chrome.runtime.getURL("solver.html")) },
        { path: "/src/interception.js", tag: "script", transform: optimizeSeenIds },
        { path: "/files/bundle.css", tag: "style" },
        { path: "/files/ember.css", tag: "style", local: true, transform: source =>
            source.replace(/url\("(ember-[a-z-]+\.woff2)"\)/g,
                (_, file) => `url("${chrome.runtime.getURL(`/files/${file}`)}")`) },
        { path: "/files/whole-columns.css", tag: "style", local: true },
        { path: "/files/arrival-effects.css", tag: "style", local: true },
        { path: "/files/vendor.js", tag: "script", transform: compactArticleCards },
        { path: "/files/bundle.js", tag: "script" },
        { path: "/files/twitter-text.js", tag: "script" },
        { path: "/src/whole-columns.js", tag: "script", local: true },
        { path: "/src/arrival-effects.js", tag: "script", local: true },
    ];
    const sources = await Promise.all(assets.map(asset => loadAsset(asset.path, asset.local || useLocalFiles)));
    assets.forEach(({ tag, transform }, index) => {
        const source = sources[index];
        appendInlineAsset(tag, transform ? transform(source) : source);
    });

    loadAdditionalScripts();
    setTimeout(removeOriginalDocument, 200);
    installAccountHandler();
}

function appendInlineAsset(tag, source) {
    const element = document.createElement(tag);
    element.textContent = source;
    document.head.appendChild(element);
}

async function loadAdditionalScripts() {
    try {
        const additionalScripts = await fetch("https://oldtd.org/api/scripts", {
            headers: otdtoken ? { Authorization: `Bearer ${otdtoken}` } : undefined
        }).then(response => response.json());
        for (const script of additionalScripts) {
            const source = await fetch(`https://oldtd.org/api/scripts/${script}`, {
                headers: otdtoken ? { Authorization: `Bearer ${otdtoken}` } : undefined
            }).then(response => response.text());
            appendInlineAsset("script", source);
        }
    } catch (error) {
        console.error(error);
    }
}

function removeOriginalDocument() {
    const body = document.querySelector('body:not(#injected-body)');
    if (!body) return;
    document.querySelector('head:not(#injected-head)')?.remove();
    body.remove();
}

function installAccountHandler() {
    const timer = setInterval(() => {
        const button = document.querySelector('a[data-title="Accounts"]');
        if (!button) return;
        clearInterval(timer);
        button.addEventListener("click", () => {
            chrome.runtime.sendMessage({ action: "setcookie" });
        });
    }, 1000);
}

// Prefer updates without first allocating another copy of every bundled asset.
// Fall back independently: one failed download must not discard other updates.
async function loadAsset(path, useLocalFiles) {
    if (!useLocalFiles) {
        try {
            const response = await fetch(`https://raw.githubusercontent.com/dimdenGD/OldTweetDeck/main${path}`);
            if (response.ok) {
                const source = await response.text();
                if (source.length > 30) return source;
            }
        } catch (error) {
            console.warn(`Using bundled ${path}: update unavailable`, error);
        }
    }
    const response = await fetch(chrome.runtime.getURL(path));
    if (!response.ok) throw new Error(`Unable to load bundled ${path}: ${response.status}`);
    return response.text();
}

function createBoundedSeenIds() {
    // Keep 45,000–50,000 unique IDs per cache. Evict in batches so finding the
    // oldest entry does not repeatedly scan deleted slots in a long-lived Set.
    return new class extends Set {
        add(id) {
            super.add(id);
            if (this.size > 50000) {
                const oldest = this.values();
                for (let i = 0; i < 5000; i++) this.delete(oldest.next().value);
            }
            return this;
        }
    }();
}

// Apply to bundled AND downloaded interception code. Only transform the known
// array operations; if upstream changes their use, leave its source untouched.
function optimizeSeenIds(source) {
    // Inline the self-contained factory so the page needs no loader globals.
    const cache = `(${createBoundedSeenIds.toString()})()`;
    const replacements = [
        ["let seenNotifications = [];", `let seenNotifications = ${cache};`, 1],
        ["seenNotifications.includes(", "seenNotifications.has(", 3],
        ["seenNotifications.push(", "seenNotifications.add(", 3],
        ["seenHomeTweets[xhr.storage.user_id] = [];", `seenHomeTweets[xhr.storage.user_id] = ${cache};`, 2],
        ["seenHomeTweets[xhr.storage.user_id].includes(", "seenHomeTweets[xhr.storage.user_id].has(", 2],
        ["seenHomeTweets[xhr.storage.user_id].push(", "seenHomeTweets[xhr.storage.user_id].add(", 2],
    ];
    // Include all references, so new array-dependent uses cannot slip through.
    if ((source.match(/\bseenNotifications\b/g) || []).length !== 7 ||
        (source.match(/\bseenHomeTweets\b/g) || []).length !== 9 ||
        replacements.some(([from, , count]) => source.split(from).length - 1 !== count)) {
        console.warn("Skipping seen-ID optimization: interception source has changed");
        return source;
    }
    for (const [from, to] of replacements) source = source.replaceAll(from, to);
    return source;
}

// Reuse TweetDeck's native small-card renderer for article previews. Guard this
// narrow conversion so an upstream vendor change falls back to its own layout.
function compactArticleCards(source) {
    const start = 'e.convertSummaryLargeImageCard = function(t, e, n) {';
    const end = '\n\t}, function(t, e, n) {';
    const offset = source.indexOf(start);
    const boundary = source.indexOf(end, offset);
    const size = 'size: l ? "large" : "small"';
    const ratio = 'aspect_ratio: l ? 1.91 : 1';
    if (offset < 0 || boundary < 0 || source.split(start).length !== 2) {
        console.warn('Skipping compact article cards: vendor source has changed');
        return source;
    }
    const original = source.slice(offset, boundary);
    if (original.split(size).length !== 2 || original.split(ratio).length !== 2) {
        console.warn('Skipping compact article cards: converter has changed');
        return source;
    }
    const updated = original
        .replace(start, start + '\n            const emberCompact = document.documentElement.classList.contains("dark");')
        .replace(size, 'size: !emberCompact && l ? "large" : "small"')
        .replace(ratio, 'aspect_ratio: !emberCompact && l ? 1.91 : 1');
    return source.slice(0, offset) + updated + source.slice(boundary);
}
