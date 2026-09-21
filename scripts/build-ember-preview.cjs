const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const svg = markup => 'data:image/svg+xml,' + encodeURIComponent(markup);
const avatar = (initial, color) => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="20" fill="${color}"/><text x="20" y="26" font-family="sans-serif" font-size="17" text-anchor="middle" fill="#eee8df">${initial}</text></svg>`);
const picture = svg('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="600" height="200" fill="#687c76"/><path d="M0 160L180 60L300 140L430 40L600 160V200H0Z" fill="#334b43"/><path d="M0 190L270 120L400 200Z" fill="#b5aa87"/><circle cx="510" cy="40" r="23" fill="#e9b66f"/></svg>');
const posts = [
 ['Marin Cole','Good morning light in the city today. Small moments like this make dense places feel human.'],
 ['Jo Pereira','A good design removes ten decisions a day from your life.'],
 ['Devon Park','Ship the useful thing. Polish can wait. Execution compounds.'],
 ['Lena Sato','Urban trees are not a luxury. They are infrastructure. <a href="#">A closer look at the research</a>.'],
 ['Marco Ruiz','The quiet changes in our neighborhoods are often the most interesting.'],
 ['Tess Kim','A slower internet would be kinder, I think. More listening, fewer notifications.'],
 ['Noah Ellison','Weekend trip: more forests, fewer notifications.'],
 ['Priya Desai','Good coffee, good people, good work. A winning day.'],
 ['Owen Fletcher','Small, well-designed tools change the way we think.'],
 ['Maya Singh','A beautiful afternoon to go for a walk.']
];
function tweet(index, column) {
 const [name, text] = posts[(index + column) % posts.length];
 const media = index === 3 || index === 7 ? `<div class="media-item media-size-medium margin-t--5" style="background-image:url('${picture}');background-size:cover;background-position:center" role="img" aria-label="Landscape media preview"></div>` : '';
 return `<article class="stream-item js-stream-item"><div class="js-stream-item-content item-box"><div class="js-tweet tweet${index===2?' is-retweet':''}">
 ${index===2?'<div class="tweet-context txt-mute"><div class="obj-left item-img">↻</div><div class="nbfc">Alex retweeted</div></div>':''}
 <header class="tweet-header js-tweet-header flex flex-row flex-align--baseline"><a class="account-link link-complex block flex-auto" href="#"><div class="obj-left item-img tweet-img position-rel"><img class="tweet-avatar avatar pin-top-full-width" src="${avatar(name[0],['#67584b','#4b655e','#635b70','#705649'][column])}" alt=""></div><div class="nbfc"><span class="account-inline txt-ellipsis"><b class="fullname link-complex-target">${name}</b> <span class="username txt-mute">@${name.toLowerCase().replaceAll(' ','')}</span></span></div></a><time class="tweet-timestamp txt-mute flex-shrink--0"><a href="#" class="txt-size-variable--12">${index+1}h</a></time></header>
 <div class="tweet-body js-tweet-body"><p class="tweet-text">${text}</p>${media}</div>
 <footer class="tweet-footer"><ul class="tweet-actions full-width is-visible">${['↩','↻','♡','···'].map((icon,i)=>`<li class="tweet-action-item pull-left margin-r--10"><a class="tweet-action" href="#" aria-label="${['Reply','Retweet','Like','More'][i]}"><span class="${i===1?'icon-retweet-toggle':''}">${icon}</span> <span class="txt-size--12">${i===3?'':12+index*9+i*11}</span></a></li>`).join('')}</ul></footer></div></div></article>`;
}
const columns = ['Home','Reason','Smartypants','Bookmarks','Science'].map((title,c)=>`<section class="column"><div class="column-holder"><div class="column-panel flex flex-column height-p--100"><header class="column-header"><span class="column-number"></span><span class="column-title"><span class="column-heading">${title}</span><span class="attribution">@listowner</span></span><button class="column-settings-link" aria-label="${title} options">☷</button></header><div class="column-scroller">${posts.map((_,i)=>tweet(i,c % 4)).join('')}</div></div></div></section>`).join('');
fs.writeFileSync(path.join(root,'artifacts/ember-preview.html'),`<!doctype html><html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ember — local theme preview</title><link rel="stylesheet" href="../files/bundle.css"><link rel="stylesheet" href="../files/ember.css"><link rel="stylesheet" href="../files/whole-columns.css"><style>
/* Preview shell only; tweet markup uses the extension's existing classes. */
html,body{height:100%;margin:0}body{font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.app-header{position:fixed;left:0;top:0;bottom:0;width:54px;display:flex;align-items:center;flex-direction:column;gap:25px;padding-top:16px}.app-header a{font-size:24px}.app-content{left:54px}.app-columns{display:flex;padding:0 0 0 5px}.app-columns>.column{flex:none;min-width:0;width:310px;display:flex;flex-direction:column}.column-holder{height:100%;width:100%}.column-header{flex:none;padding:0 12px}.column-settings-link{float:right;background:none;border:0;line-height:50px}.column-scroller{flex:1;overflow:auto}.preview-switch{margin-top:auto;margin-bottom:15px;background:none;border:1px solid #706257;color:inherit;font-size:10px;padding:4px}.tweet-text{margin:0}a{text-decoration:none}
</style></head><body><nav class="app-header"><a class="app-nav-link" href="#" aria-label="Home">⌂</a><a class="app-nav-link" href="#" aria-label="Search">⌕</a><a class="app-nav-link" href="#" aria-label="Notifications">♧</a><a class="app-nav-link" href="#" aria-label="Messages">✉</a><button class="preview-switch" onclick="document.documentElement.classList.toggle('dark')">Light / dark</button></nav><main class="app-content"><div class="app-columns-container"><div class="app-columns">${columns}</div></div></main><script src="../src/whole-columns.js"></script></body></html>`);
console.log('Built artifacts/ember-preview.html');
