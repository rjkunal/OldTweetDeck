# Ember Firefox fork

Based on upstream OldTweetDeck v4.4.0 (c0d3c67). Existing Firefox customizations were imported together as one commit, not reconstructed as separate historical changes.

- Edit interceptor/ and run npm run build to regenerate src/interception.js.
- Run npm test to check the generated source and run the test suite.
- Local appearance lives in files/ember.css; whole-column fitting and arrival effects each have their own JS/CSS files.
- src/injection.js loads upstream updates and applies guarded local compatibility patches. Installing this fork does not pin downloaded runtime assets; the existing local-only setting remains available.
- manifest.json is the Firefox manifest from the packaged extension. The inherited pack.js is upstream's Chrome-to-Firefox packer and should not be used on this Firefox-specific checkout.
- Runtime ZIP contents: manifest.json, ruleset.json, src/, files/, images/, LICENSE. Exclude .DS_Store files. Create a fresh archive rather than updating an old one.
- artifacts/ is deliberately ignored: ZIPs, previews, and profile analysis are local outputs.

See PERFORMANCE-FIXES.md for the customization details and verification limits. The upstream README and license are retained.

## Packaging and releases

Run npm run package with Node.js 22+ and zip/unzip available. It rebuilds the interceptor, runs tests, validates a fresh runtime-only ZIP and replaces artifacts/OldTweetDeckFirefox-Ember.zip only after success. No npm dependencies are needed by this command.

To release, bump manifest.json to a unique Firefox-compatible version, optionally add docs/releases/ember-vVERSION.md, commit, and push a matching ember-vVERSION tag. GitHub Actions builds and tests before publishing the ZIP as a release asset. Branch pushes and pull requests run the same build without publishing a release. The ZIP is unsigned.
