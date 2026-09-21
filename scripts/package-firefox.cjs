const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function run(command, args) {
    execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}
run(process.execPath, ['scripts/build-interceptor.cjs']);
run(process.execPath, ['scripts/build-interceptor.cjs', '--check']);
const tests = fs.readdirSync(path.join(root, 'tests')).filter(file => file.endsWith('.test.cjs')).sort();
run(process.execPath, ['--test', ...tests.map(file => 'tests/' + file)]);

// Explicit runtime allowlist: never package source history, profiles or old ZIPs.
const files = [];
function collect(relative) {
    const absolute = path.join(root, relative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error('Refusing to package symlink: ' + relative);
    if (stat.isDirectory()) {
        for (const name of fs.readdirSync(absolute).sort()) {
            if (!name.startsWith('.')) collect(relative + '/' + name);
        }
    } else if (stat.isFile()) files.push(relative);
}
for (const item of ['manifest.json', 'ruleset.json', 'src', 'files', 'images', 'LICENSE']) collect(item);
const artifacts = path.join(root, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const temporary = fs.mkdtempSync(path.join(artifacts, '.package-'));
try {
    const archive = path.join(temporary, 'OldTweetDeckFirefox-Ember.zip');
    run('zip', ['-q', '-X', archive, ...files]);
    run('unzip', ['-tq', archive]);
    const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n').sort();
    if (JSON.stringify(entries) !== JSON.stringify([...files].sort())) throw new Error('ZIP contents do not match runtime allowlist');
    fs.renameSync(archive, path.join(artifacts, 'OldTweetDeckFirefox-Ember.zip'));
    console.log('Built artifacts/OldTweetDeckFirefox-Ember.zip');
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
