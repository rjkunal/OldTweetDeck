# Local Firefox fixes

The patched package includes:

- Firefox waits for DOM parsing before replacing the original page. This is a candidate fix for the reported preview-image problem, not a confirmed reproduction of it.
- Accounts-button setup stops its timer after installing one listener, preventing another listener from accumulating every second.
- Background URL records are deleted when tabs close.
- Startup requests updated assets first and reads bundled copies only when an update fails. Each asset falls back independently on network, HTTP, body-read, or short-response failures. The local-only preference still bypasses remote downloads.
- Known home-timeline and notification ID collections use bounded sets instead of arrays. This avoids linear membership scans and repeated copies of the same home-timeline ID. Each home account cache and the shared notification cache retains at most 50,000 unique IDs. On overflow it evicts the oldest 5,000 in one pass, avoiding repeated scans over deleted Set entries. Duplicate additions do not change insertion order. Pagination cursors and displayed tweet history are untouched. An evicted ID can be accepted again if the server resends it; this intentionally replaces session-long duplicate tracking with a generous recent window. Sets still have overhead; actual Firefox memory savings have not been measured.

The set optimization is applied by the local loader to either bundled or downloaded interception code. It checks the known references and operation counts first. If upstream changes those collections, the loader logs a warning and uses the unmodified source. Other upstream behavior and automatic code updates remain enabled.

These changes live in the installed loader/background code. Downloaded application updates do not replace those files, but installing a new official extension package will replace these local modifications.

## Verification

Run `node --test tests/*.test.cjs` from the extension directory. Tests cover startup ordering, listener cleanup, closed-tab cleanup, asset fallback, upstream-change detection, output equivalence for the real home deduplication loop, repeated cache eviction beyond 100,000 IDs, account isolation, and suppression of recent duplicate notifications.

The tests use simulated browser APIs. Live Firefox heap usage and feed performance have not been benchmarked. No feed-history caps or background refresh throttling have been introduced.

## Installation

For a temporary trial, open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose the ZIP in `artifacts`. Reload TweetDeck. Temporary installations end when Firefox restarts.

Permanent installation of an unsigned modified package requires a Firefox build/configuration that supports it, such as the project's documented Nightly setup. The packaged extension retains the original extension ID and version.

## Ember appearance

`files/ember.css` is a local stylesheet installed after the base styles, even when the application scripts and base stylesheet come from upstream. It applies to TweetDeck's existing Dark theme; selecting Light in Settings restores the original light appearance.

The theme uses warm charcoal surfaces, ivory text, amber links/navigation, and repeating amber/teal/lavender/coral column-header bars. Bars follow column position, including after reordering. Timeline avatars are 28px, row padding is tighter, and native medium/large timeline media previews are 110px tall. Tweet text is not truncated, column-width and font-size settings remain available, and detail/compose layouts are not deliberately compressed. Header height remains 50px to preserve the application's existing scroller and options-panel calculations. Large-image article cards now use TweetDeck's native horizontal small-card layout in Dark mode.

Open `artifacts/ember-preview.html` for a static preview with sample content and the actual base/theme stylesheets; rebuild it with `node scripts/build-ember-preview.cjs`. The preview uses illustrative media and does not connect to X. Automated checks cover local theme loading when remote updates are enabled. Text, metadata and link colors exceed 4.5:1 contrast against the panel background. Browser security policy blocked the agent's local-file preview, so this theme has not been visually validated in a live Firefox feed.

## Column typography

All columns use IBM Plex Sans in Dark mode. Sizes, weights and line spacing are unchanged. The local Latin WOFF2 variable font covers weights 400–700 (about 45 KB), with system fallback for other scripts and emoji. Its SIL Open Font License is bundled in `files/ember-plex-sans-LICENSE.txt`. The loader resolves the font URL to an extension resource, so no runtime font-service requests are needed. The unused Inter font and license have been removed.

## Compact article previews

The local loader narrowly patches the known `convertSummaryLargeImageCard` converter in either bundled or downloaded vendor code. In Dark mode it selects the built-in small layout and a square thumbnail, preserving the original title, description, image data and destination. Other converters (including video/player cards) are unchanged. Cards without images keep their original output. If upstream changes the converter format, the loader warns and uses the original source.

Layout is chosen when each card is converted. Reload TweetDeck after switching between Light and Dark to update already-rendered cards. This applies to summary-large-image article cards, including those in detail views; it does not reformat every possible external embed. Automated tests compare the actual converter output and validate that other vendor code is untouched. A live Firefox visual check is still needed.

## Whole columns on resize

`src/whole-columns.js` and `files/whole-columns.css` load locally after the application. The horizontal viewport is clipped (including programmatic horizontal scrolling), and incomplete/rightmost columns become invisible without removing their DOM or changing their vertical scroll offsets. Widening restores them. Column width settings remain in effect; only the first column's maximum width shrinks when the window cannot fit even one normal column. This behavior applies in both Light and Dark modes.

ResizeObserver tracks the viewport and column widths. MutationObserver watches the column list and its ancestors for direct child changes and layout-setting classes/styles, plus each column's own class/style attributes. It does not observe tweet descendants, so tweet arrivals and animation changes do not deliver callbacks. Broad subtree observation is used only while discovering an absent deck, and is narrowed once the deck mounts. Updates are coalesced to animation frames. Hidden columns remain configured and may keep refreshing in the background. Sidebar/keyboard navigation cannot horizontally reveal a hidden column: widen the window or reorder columns to bring it into view.

The local preview now has five columns and uses the actual resize controller. Tests cover exact and fractional fit boundaries, tiny windows, widening, preserving DOM/scroll state, reorder/removal, width changes, late mounting and cleanup. Browser-level visual verification is still pending.

## Incoming tweet effects

Timeline rows no longer change background color on mouseover. Explicit tweet selection retains its highlight; incoming-tweet animations remain enabled.

Ember adds a faint amber background glow that holds for 450ms, then fades over 1.35 seconds (1.8 seconds total) to newly inserted top-of-feed tweets and a 0.9-second brightness pulse on the column accent bar. Header pulses are limited to one per 1.5 seconds during bursts. A 420ms slide-and-fade moves the incoming row downward by 6px into place, using cubic-bezier(0.22, 0.61, 0.36, 1) to gently decelerate as it lands. Only transform and opacity are animated for the entrance; height and margins are not animated, and no permanent will-change layers are allocated. The independent amber glow continues after the slide completes.

The local `arrival-effects.js` wraps TweetDeck's existing `slideInChirps` method, preserving its call/return behavior. It uses `insertAtTop`, `insertAtBottom` and `containsNewChirps` flags to exclude initial population, older history and gap fills. Temporary columns, hidden tabs/columns, Light mode, and columns scrolled away from the top do not get effects. CSS and JavaScript both respect reduced-motion preferences. The header pulse starts when the queued tweet's CSS animation actually starts. Classes are removed on animation completion/cancellation; no polling or new tweet-ID cache is used. If the expected TweetDeck methods are unavailable, installation skips the effect.

Tests exercise eligibility, renderer forwarding, reduced motion, queued rows, pulse throttling and cleanup. Effects still need a visual check in the live Firefox feed.
