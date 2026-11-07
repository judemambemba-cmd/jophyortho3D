/* Assemble src/*.js -> app.js, version monopage et ZIP.  Usage : node build.js */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const dir = __dirname, src = path.join(dir, 'src');
const files = fs.readdirSync(src).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
const banner = '/* JophyOrtho 3D — application assemblée depuis src/*.js (node build.js). */\n';
const js = banner + files.map(f => `\n/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
fs.writeFileSync(path.join(dir, 'app.js'), js);
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const svg = fs.readFileSync(path.join(dir, 'assets/icon.svg'), 'utf8');
html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', '').replace('<link rel="icon" href="assets/icon.svg" type="image/svg+xml">\n', '')
  .replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + css + '\n</style>')
  
  .replace('<script src="app.js"></script>', () => '<script>\n' + js.replace(/<\/script>/g, '<\\/script>') + '\n</script>');
fs.writeFileSync(path.join(dir, 'JophyOrtho3D-monopage.html'), html);
console.log('app.js', js.length, 'octets ;', files.length, 'modules ; monopage', html.length, 'octets');
