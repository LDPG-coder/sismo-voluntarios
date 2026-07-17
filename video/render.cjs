const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HTML = '/video/index-mobile.html';
const ASSETS = '/video';
const OUT_FRAMES = '/video/tmp-render/frames';
const OUTPUT = '/video/sep-voluntariados-movil.mp4';
const W = 1080, H = 1920, FPS = 30;

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT_FRAMES, { recursive: true });

  // Start a simple HTTP server to serve assets
  const { createServer } = require('http');
  const server = createServer((req, res) => {
    let fp = path.join(ASSETS, decodeURIComponent(req.url.split('?')[0]));
    if (!fs.existsSync(fp)) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(fp);
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.json': 'application/json' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  });
  await new Promise(r => server.listen(9876, r));
  console.log('Server on :9876');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  await page.goto('http://localhost:9876/index-mobile.html', { waitUntil: 'networkidle2' });
  await sleep(1000);

  // Get total duration from the GSAP timeline
  const totalDuration = await page.evaluate(() => {
    const tl = window.__timelines && window.__timelines['main'];
    return tl ? tl.duration() : 105;
  });
  console.log('Timeline duration:', totalDuration, 's');

  const totalFrames = Math.ceil(totalDuration * FPS);
  const step = 1 / FPS;

  // Capture frames by seeking the GSAP timeline
  for (let f = 0; f < totalFrames; f++) {
    const t = f * step;
    await page.evaluate((seekTime) => {
      const tl = window.__timelines && window.__timelines['main'];
      if (tl) {
        tl.seek(seekTime);
        tl.pause();
      }
      // Also play/pause any video elements
      document.querySelectorAll('video').forEach(v => {
        v.currentTime = seekTime;
        v.pause();
      });
    }, t);

    // Small wait for render
    await sleep(16);

    await page.screenshot({ path: path.join(OUT_FRAMES, `f_${String(f).padStart(5, '0')}.png`) });

    if (f % (FPS * 5) === 0) {
      console.log(`  frame ${f}/${totalFrames} (${(t).toFixed(1)}s)`);
    }
  }

  await browser.close();
  server.close();

  console.log(`Captured ${totalFrames} frames, encoding MP4...`);

  // Encode with FFmpeg
  execSync(`ffmpeg -y -framerate ${FPS} -i "${OUT_FRAMES}/f_%05d.png" -c:v libx264 -pix_fmt yuv420p -preset medium -crf 20 -movflags +faststart "${OUTPUT}"`, { stdio: 'inherit' });

  console.log('Done:', OUTPUT);
  const stat = fs.statSync(OUTPUT);
  console.log('Size:', (stat.size / 1024 / 1024).toFixed(1), 'MB');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
