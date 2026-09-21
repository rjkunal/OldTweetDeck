/* Use TweetDeck's insertion flags instead of guessing from DOM mutations. */
function installArrivalEffects(env = window) {
    const doc = env.document;
    const prototype = env.TD?.ui?.Column?.prototype;
    if (typeof prototype?.slideInChirps !== 'function' ||
        typeof env.TD?.ui?.columns?.isScrolledToTop !== 'function') return;
    const original = prototype.slideInChirps;
    if (original.emberArrivalEffects) return;
    const reducedMotion = env.matchMedia('(prefers-reduced-motion: reduce)');
    const lastPulse = new WeakMap();
    const enabled = () => !doc.hidden && !reducedMotion.matches && doc.documentElement.classList.contains('dark');

    function wrapped(items, temporary, rate, tpm, flags) {
        // Initial population has insertAtBottom=true; gap/history insertions
        // are not new top-of-feed items. Rerenders bypass this path entirely.
        if (enabled() && !temporary && flags?.insertAtTop &&
            !flags.insertAtBottom && flags.containsNewChirps &&
            env.TD.ui.columns.isScrolledToTop(this.state.columnKey)) {
            for (const item of items || []) {
                const row = item.$node?.[0];
                const column = row?.closest('.column');
                if (column && !column.hasAttribute('data-otd-overflow-column') &&
                    row.matches('.stream-item') && row.querySelector('.tweet')) {
                    row.classList.add('ember-arriving');
                }
            }
        }
        return original.apply(this, arguments);
    }
    wrapped.emberArrivalEffects = true;
    prototype.slideInChirps = wrapped;

    // Queued rows may still be display:none. Pulse only when their CSS animation
    // actually starts, once the existing renderer makes the row visible.
    function start(event) {
        if (event.animationName !== 'ember-tweet-arrival') return;
        const row = event.target;
        const column = row.closest('.column');
        if (!enabled() || !column || column.hasAttribute('data-otd-overflow-column')) {
            row.classList.remove('ember-arriving');
            return;
        }
        const header = column.querySelector('.column-header');
        if (!header) return;
        const now = env.Date.now();
        if (now - (lastPulse.get(header) ?? -Infinity) < 1500) return;
        lastPulse.set(header, now);
        header.classList.add('ember-arrival-pulse');
    }
    function finish(event) {
        if (event.animationName === 'ember-tweet-arrival') event.target.classList.remove('ember-arriving');
        if (event.animationName === 'ember-header-arrival') event.target.classList.remove('ember-arrival-pulse');
    }
    doc.addEventListener('animationstart', start);
    doc.addEventListener('animationend', finish);
    doc.addEventListener('animationcancel', finish);
    return () => {
        if (prototype.slideInChirps === wrapped) prototype.slideInChirps = original;
        doc.removeEventListener('animationstart', start);
        doc.removeEventListener('animationend', finish);
        doc.removeEventListener('animationcancel', finish);
        doc.querySelectorAll('.ember-arriving').forEach(row => row.classList.remove('ember-arriving'));
        doc.querySelectorAll('.ember-arrival-pulse').forEach(header => header.classList.remove('ember-arrival-pulse'));
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { installArrivalEffects };
} else {
    installArrivalEffects();
}
