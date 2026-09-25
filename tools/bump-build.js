// Verhoogt het buildnummer: version.json + PRIME_BUILD en de ?v=-parameters
// van css/js in index.html. Draai dit vóór elke push die gebruikers moeten
// zien (node tools/bump-build.js). Een geopende/verouderde pagina vergelijkt
// PRIME_BUILD met version.json en herlaadt zichzelf dan met een verse URL.
//
// Raakt bewust sw.js NIET aan. Eerdere opzet liet dit ook de cache-naam in
// sw.js meebumpen, zodat elke push een eigen opslagvak kreeg -- maar dat
// betekende dat de browser na ELKE push (ook eentje die niets met offline te
// maken had) de hele service-worker-levenscyclus (installeren, activeren,
// de pagina zelf opnieuw cachen) opnieuw moest doorlopen. Werd er vlak na
// zo'n push getest zonder internet, dan was die cyclus soms nog niet klaar
// -- vandaar de wisselende offline-resultaten. Het opslagvak in sw.js is nu
// een vaste naam (zie CACHE_NAME daar); alleen een bewuste aanpassing aan
// sw.js zelf triggert nog een nieuwe service-worker-activatie.
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
