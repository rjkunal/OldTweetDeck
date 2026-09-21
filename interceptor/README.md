# Request interceptor source

Edit files here, then run `npm run build`. The extension still loads the generated `src/interception.js`; it does not load these source files individually. No npm dependencies or installation step are needed.

These are classic JavaScript source modules sharing one lexical scope, not ES modules. `sources.json` lists build order. This keeps the existing shared state and browser execution model intact. `registry.js` explicitly preserves route matching order, independently of how route definitions are grouped into files.

| File | Responsibility |
| --- | --- |
| `state.js` | Shared state, persistence, import/export, follow data |
| `tweet-parser.js` | Convert API tweets into legacy TweetDeck objects |
| `request-utils.js` | Request parameters, embedded JSON parsing, emulated responses |
| `routes/timelines.js` | Home, list, user, bookmarks, and likes feeds |
| `routes/notifications.js` | Activity notifications and mentions |
| `routes/accounts.js` | User profiles and account verification |
| `routes/search.js` | Tweet and user searches |
| `routes/tweet-actions.js` | Create, delete, favorite, retweet, and undo retweet |
| `routes/tweet-details.js` | Tweet details, replies, and translation |
| `routes/messages.js` | Conversation and inbox routes |
| `routes/collections.js` | Collection reads and writes |
| `routes/application.js` | TweetDeck state, settings, and compatibility endpoints |
| `registry.js` | First-match route ordering |
| `xhr.js` | XMLHttpRequest interception and response handling |

## Editing and checking

1. Edit the relevant source file. For a new route, add its name to `registry.js` in the appropriate matching position.
2. Run `npm run build` to regenerate the browser script. The build validates JavaScript syntax before writing.
3. Run `npm test`. It checks that the generated script is current and runs the regression tests.

`npm run check` detects unbuilt edits without rewriting anything. Commit/distribute the generated script alongside source changes. Package the existing extension files (`manifest.json`, `ruleset.json`, `src`, `files`, `images`, and `LICENSE`); the `interceptor` and `scripts` directories are only needed for development.

Automatic remote updates are unchanged. By default the loader prefers upstream interception code, so future functional edits here affect the bundled fallback/local-only mode until those edits are also incorporated upstream. This refactor itself preserves the existing route handlers and behavior. The loader's guarded set optimization still applies to either source.
