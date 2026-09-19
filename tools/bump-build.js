// Verhoogt het buildnummer: version.json + PRIME_BUILD en de ?v=-parameters
// van css/js in index.html. Draai dit vóór elke push die gebruikers moeten
// zien (node tools/bump-build.js). Een geopende/verouderde pagina vergelijkt
// PRIME_BUILD met version.json en herlaadt zichzelf dan met een verse URL.
const fs = require('fs');
const d = new Date();
const p = n => String(n).padStart(2, '0');
const build = '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
fs.writeFileSync('version.json', JSON.stringify({ build }) + '\n');
let h = fs.readFileSync('index.html', 'utf8');
h = h.replace(/window\.PRIME_BUILD = '[^']*';/, "window.PRIME_BUILD = '" + build + "';");
h = h.replace(/(href="css\/styles\.css|src="js\/(?:cloud|translations|i18n|auth)\.js)(\?v=[^"]*)?"/g, '$1?v=' + build + '"');
fs.writeFileSync('index.html', h);
console.log('build', build);
