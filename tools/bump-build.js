// Verhoogt het buildnummer: version.json + PRIME_BUILD en de ?v=-parameters
// van css/js in index.html, plus de cache-naam in sw.js. Draai dit vóór elke
// push die gebruikers moeten zien (node tools/bump-build.js). Een geopende/
// verouderde pagina vergelijkt PRIME_BUILD met version.json en herlaadt
// zichzelf dan met een verse URL. sw.js krijgt zo elke push een eigen,
// nieuwe cache-naam -- de service worker ruimt de vorige dan automatisch op
// (zie activate() in sw.js), dus geen kans dat een offline toestel voor
// altijd aan verouderde bestanden vastzit.
const fs = require('fs');
const d = new Date();
const p = n => String(n).padStart(2, '0');
const build = '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
fs.writeFileSync('version.json', JSON.stringify({ build }) + '\n');
let h = fs.readFileSync('index.html', 'utf8');
h = h.replace(/window\.PRIME_BUILD = '[^']*';/, "window.PRIME_BUILD = '" + build + "';");
h = h.replace(/(href="css\/styles\.css|src="js\/(?:cloud|translations|i18n|auth)\.js)(\?v=[^"]*)?"/g, '$1?v=' + build + '"');
fs.writeFileSync('index.html', h);
if (fs.existsSync('sw.js')) {
  let sw = fs.readFileSync('sw.js', 'utf8');
  sw = sw.replace(/const CACHE_NAME = 'prime-cache-[^']*';/, "const CACHE_NAME = 'prime-cache-" + build + "';");
  fs.writeFileSync('sw.js', sw);
}
console.log('build', build);
