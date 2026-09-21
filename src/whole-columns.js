/* Keep configured columns mounted so their contents and scroll positions survive
   resizing. Only the rightmost columns that do not fully fit become invisible. */
function installWholeColumns(env = window) {
    const doc = env.document;
    let container = null;
    let list = null;
    let frame = null;
    let observedColumns = new Set();
    const schedule = () => {
        if (frame === null) frame = env.requestAnimationFrame(update);
    };
    const resize = new env.ResizeObserver(schedule);

    function update() {
        frame = null;
        const nextContainer = doc.querySelector('.app-columns-container');
        const nextList = nextContainer?.querySelector('.app-columns');
        if (nextContainer !== container || nextList !== list) {
            resize.disconnect();
            observedColumns.clear();
            container = nextContainer;
            list = nextList;
            if (container && list) {
                container.setAttribute('data-otd-whole-columns', '');
                resize.observe(container);
                resize.observe(list);
            }
        }
        if (!container || !list) {
            observeLayout();
            return;
        }
        const columns = Array.from(list.children).filter(node => node.classList.contains('column'));
        const current = new Set(columns);
        for (const column of observedColumns) if (!current.has(column)) resize.unobserve(column);
        for (const column of columns) if (!observedColumns.has(column)) resize.observe(column);
        observedColumns = current;
        observeLayout();
        if (!columns.length) return;

        // Override only max-width on the first column. Its normal CSS width still
        // determines the size when enough room returns or the width setting changes.
        const number = value => parseFloat(value) || 0;
        const listStyle = env.getComputedStyle(list);
        const firstStyle = env.getComputedStyle(columns[0]);
        const available = Math.max(0, container.clientWidth -
            number(listStyle.paddingLeft) - number(listStyle.paddingRight) -
            number(firstStyle.marginLeft) - number(firstStyle.marginRight));
        const width = `${available}px`;
        if (list.style.getPropertyValue('--otd-first-column-width') !== width) {
            list.style.setProperty('--otd-first-column-width', width);
        }
        // overflow: clip prevents both user and programmatic horizontal scrolling.
        // Reset a pre-existing offset when attaching to an already-loaded deck.
        if (container.scrollLeft) container.scrollLeft = 0;
        const viewport = container.getBoundingClientRect();
        const left = viewport.left + container.clientLeft;
        const right = left + container.clientWidth;
        let overflow = false;
        for (const column of columns) {
            const bounds = column.getBoundingClientRect();
            overflow ||= bounds.left < left - 0.01 || bounds.right > right + 0.01;
            column.toggleAttribute('data-otd-overflow-column', overflow);
        }
    }

    const mutation = new env.MutationObserver(schedule);
    function observeLayout() {
        mutation.disconnect();
        const attributes = { attributes: true, attributeFilter: ['class', 'style'] };
        if (!container || !list) {
            // Discovery is broad only until the deck mounts (or mounts again).
            mutation.observe(doc.documentElement, { ...attributes, childList: true, subtree: true });
            return;
        }
        // Direct-child changes catch reorders and replacement of any deck ancestor.
        // No subtree observation: tweet/media/animation changes never reach us.
        for (let node = list; node; node = node.parentElement) {
            mutation.observe(node, { ...attributes, childList: true });
        }
        for (const column of observedColumns) mutation.observe(column, attributes);
    }
    observeLayout();
    schedule();
    return () => {
        mutation.disconnect();
        resize.disconnect();
        if (frame !== null) env.cancelAnimationFrame(frame);
        container?.removeAttribute('data-otd-whole-columns');
        list?.style.removeProperty('--otd-first-column-width');
        for (const column of observedColumns) column.removeAttribute('data-otd-overflow-column');
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { installWholeColumns };
} else {
    installWholeColumns();
}
