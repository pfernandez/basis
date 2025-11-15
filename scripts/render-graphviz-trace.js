#!/usr/bin/env node
import { readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename, extname, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const options = {
    dir: null,
    outDir: null,
    format: 'svg',
    makeHtml: false,
    interval: 800,
    htmlName: 'trace.html',
  };
  argv.forEach((arg) => {
    if (arg === '--html') {
      options.makeHtml = true;
      return;
    }
    if (arg.startsWith('--format=')) {
      options.format = arg.slice('--format='.length);
      return;
    }
    if (arg.startsWith('--out=')) {
      options.outDir = arg.slice('--out='.length);
      return;
    }
    if (arg.startsWith('--interval=')) {
      options.interval = Number(arg.slice('--interval='.length));
      return;
    }
    if (arg.startsWith('--html-name=')) {
      options.htmlName = arg.slice('--html-name='.length);
      return;
    }
    if (!options.dir) {
      options.dir = arg;
      return;
    }
  });
  if (!options.dir) options.dir = '.';
  if (!options.outDir) options.outDir = options.dir;
  options.interval = Number.isFinite(options.interval) && options.interval > 0 ? options.interval : 800;
  return options;
}

function ensureDir(path) {
  const resolved = resolve(path);
  const stats = (() => {
    try { return statSync(resolved); } catch { return null; }
  })();
  if (!stats) {
    mkdirSync(resolved, { recursive: true });
    return resolved;
  }
  if (!stats.isDirectory()) {
    throw new Error(`${resolved} exists and is not a directory`);
  }
  return resolved;
}

function runDot(inputPath, outputPath, format) {
  const result = spawnSync('dot', [`-T${format}`, inputPath, '-o', outputPath], { stdio: 'inherit' });
  if (result.error && result.error.code === 'ENOENT') {
    throw new Error('Graphviz "dot" command not found. Install graphviz first.');
  }
  if (result.status !== 0) {
    throw new Error(`dot exited with status ${result.status}`);
  }
}

function buildHtml(outDir, outputs, interval, htmlName) {
  if (!outputs.length) return;
  const relPaths = outputs.map(path => relative(outDir, path));
  const safePaths = JSON.stringify(relPaths);
  const safeInterval = Math.max(50, Math.floor(interval));
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Graphviz Trace</title>
  <style>
    body { font-family: sans-serif; background: #111; color: #eee; margin: 0; padding: 0; }
    .controls { padding: 0.5rem; background: #222; position: sticky; top: 0; display: flex; gap: 0.5rem; align-items: center; }
    button { padding: 0.25rem 0.75rem; }
    #frame { display: block; margin: 0 auto; max-width: 98vw; max-height: 90vh; background: #fff; }
  </style>
</head>
<body>
  <div class="controls">
    <button id="prev">◀︎ Prev</button>
    <button id="play">▶︎ Play</button>
    <button id="pause">⏸︎ Pause</button>
    <button id="next">Next ▶︎</button>
    <span id="status"></span>
  </div>
  <img id="frame" alt="trace frame" />
  <script>
    const frames = ${safePaths};
    const interval = ${safeInterval};
    let index = 0;
    let timer = null;
    const img = document.getElementById('frame');
    const status = document.getElementById('status');
    function show(i) {
      if (!frames.length) return;
      index = (i + frames.length) % frames.length;
      img.src = frames[index];
      status.textContent = 'Frame ' + (index + 1) + ' / ' + frames.length + ': ' + frames[index];
    }
    function play() {
      if (!frames.length) return;
      stop();
      timer = setInterval(() => show(index + 1), interval);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }
    document.getElementById('prev').onclick = () => { show(index - 1); };
    document.getElementById('next').onclick = () => { show(index + 1); };
    document.getElementById('play').onclick = play;
    document.getElementById('pause').onclick = stop;
    show(0);
  </script>
</body>
</html>`;
  const htmlPath = join(outDir, htmlName);
  writeFileSync(htmlPath, html, 'utf8');
  return htmlPath;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceDir = resolve(options.dir);
  const targetDir = ensureDir(options.outDir);
  const files = readdirSync(sourceDir)
    .filter(name => name.endsWith('.dot'))
    .sort();
  if (!files.length) {
    console.error(`No .dot files found in ${sourceDir}`);
    process.exit(1);
  }
  const outputs = [];
  files.forEach((file) => {
    const inputPath = join(sourceDir, file);
    const base = basename(file, extname(file));
    const outputPath = join(targetDir, `${base}.${options.format}`);
    runDot(inputPath, outputPath, options.format);
    outputs.push(outputPath);
    console.log(`Rendered ${file} -> ${outputPath}`);
  });
  if (options.makeHtml) {
    const htmlPath = buildHtml(targetDir, outputs, options.interval, options.htmlName);
    if (htmlPath) {
      console.log(`HTML viewer written to ${htmlPath}`);
    }
  }
}

main();
