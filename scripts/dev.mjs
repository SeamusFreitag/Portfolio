import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

function build() {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [join(HERE, 'build.mjs')], { stdio: 'inherit' });
    p.on('close', resolve);
  });
}

let rebuilding = false, pending = false;
async function rebuild() {
  if (rebuilding) { pending = true; return; }
  rebuilding = true;
  await build();
  rebuilding = false;
  if (pending) { pending = false; rebuild(); }
}

await build();

// serve
spawn(process.execPath, [join(HERE, 'serve.mjs')], { stdio: 'inherit' });

// watch source dirs (not dist)
let timer;
const onChange = () => { clearTimeout(timer); timer = setTimeout(rebuild, 120); };
for (const dir of ['content', 'static', 'scripts']) {
  try { watch(join(ROOT, dir), { recursive: true }, onChange); }
  catch { watch(join(ROOT, dir), onChange); }
}
console.log('Watching content/, static/, scripts/ — edits trigger a rebuild.');
