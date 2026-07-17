const fs = require('fs');

const CW = 1080, CH = 1920;
const PHONE_W = 470, PHONE_H = 1017;

const SCENES_FILE = process.env.SCENES_FILE || __dirname + '/scenes-mobile.json';
const raw = JSON.parse(fs.readFileSync(SCENES_FILE, 'utf8'));

const scenes = [];
let t = 0;
for (const s of raw) {
  const dur = s.duration || 4;
  scenes.push({ ...s, start: t, dur });
  t += dur;
}
const totalDuration = Math.ceil(t);

function phoneTarget(layout) {
  if (layout === 'text') return { x: CW / 2 - PHONE_W / 2, y: CH / 2 - PHONE_H / 2, s: 0.5, o: 0 };
  if (layout === 'both') return { x: 64, y: CH / 2 - PHONE_H / 2, s: 1.0, o: 1 };
  if (layout === 'element') return { x: CW / 2 - PHONE_W / 2 - 180, y: CH / 2 - PHONE_H / 2, s: 0.62, o: 0.35 };
  return { x: CW / 2 - PHONE_W / 2, y: CH / 2 - PHONE_H / 2 - 10, s: 1.24, o: 1 };
}

let textOverlays = '';
let phoneScenes = '';
let gsapTweens = '';
let elementContainers = '';

for (let i = 0; i < scenes.length; i++) {
  const s = scenes[i];
  const phone = phoneTarget(s.layout);
  const imgName = (s.kind === 'image') ? `captures-mobile-local/${s.name}.png` : null;
  const elemName = (s.kind === 'image' && s.layout === 'element') ? `captures-mobile-local/elements/${s.name}.png` : null;

  if (s.layout === 'text') {
    const escapedCaption = (s.caption || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const escapedSub = (s.sub || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    textOverlays += `
    <div class="clip text-overlay" data-start="${s.start}" data-duration="${s.dur}" data-track-index="1">
      <div class="textcard">
        <div class="chead">${s.caption || ''}</div>
        <div class="csub">${s.sub || ''}</div>
      </div>
    </div>`;
  }

  if (s.layout === 'phone' || s.layout === 'both' || s.layout === 'element') {
    if (s.interstitial) {
      const it = s.interstitial;
      const iStart = s.start;
      const iDur = 2.2;
      textOverlays += `
    <div class="clip text-overlay" data-start="${iStart}" data-duration="${iDur}" data-track-index="2">
      <div class="textcard">
        <div class="chead">${it.title || ''}</div>
        <div class="csub">${it.sub || ''}</div>
      </div>
    </div>`;
    }

    const captionStart = s.interstitial ? s.start + 2.2 : s.start;
    const captionDur = s.interstitial ? s.dur - 2.2 : s.dur;
    if (s.layout === 'both' || s.layout === 'element') {
      const escapedCaption = (s.caption || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
      const escapedSub = (s.sub || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
      textOverlays += `
    <div class="clip caption-overlay" data-start="${captionStart}" data-duration="${captionDur}" data-track-index="3">
      <div class="caption"><div class="bar"></div><div class="ctext">${s.caption || ''}</div><div class="csub">${s.sub || ''}</div></div>
    </div>`;
    } else {
      const escapedCaption = (s.caption || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
      textOverlays += `
    <div class="clip capbar-overlay" data-start="${captionStart}" data-duration="${captionDur}" data-track-index="3">
      <div class="capbar"><div class="ctext">${s.caption || ''}</div></div>
    </div>`;
    }
  }

  if (s.layout === 'element' && elemName) {
    elementContainers += `
    <div class="clip element-frame" id="ef-${s.name}" data-start="${s.start}" data-duration="${s.dur}" data-track-index="4">
      <img src="${elemName}" />
    </div>`;
  }
}

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${CW}, height=${CH}" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${CW}px; height:${CH}px; overflow:hidden; background:#062e14; font-family:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  #root { position:relative; width:${CW}px; height:${CH}px; }
  .bg {
    position:absolute; inset:0;
    background:
      radial-gradient(120% 80% at 50% -10%, #1c9743 0%, rgba(28,151,67,0) 55%),
      radial-gradient(120% 90% at 50% 110%, #0b5425 0%, rgba(11,84,37,0) 60%),
      linear-gradient(160deg, #062e14 0%, #0b5425 55%, #07140d 100%);
  }
  .watermark { position:absolute; right:-40px; bottom:-20px; width:520px; height:auto; opacity:0.11; pointer-events:none; }
  .brandpill {
    position:absolute; top:46px; left:50%; transform:translateX(-50%); z-index:30;
    background:rgba(23,163,74,0.92); color:#fff; font-weight:700; font-size:22px; letter-spacing:.3px;
    padding:12px 24px; border-radius:999px; box-shadow:0 8px 30px rgba(0,0,0,.35);
    display:flex; align-items:center; gap:10px;
  }
  .brandpill img { height:22px; width:auto; filter:brightness(0) invert(1); }

  .phone {
    position:absolute; left:0; top:0; width:${PHONE_W}px; height:${PHONE_H}px;
    transform-origin:center center; z-index:10; opacity:0;
  }
  .screen {
    position:absolute; inset:0; border-radius:28px; overflow:hidden; background:#0c0b0a;
    box-shadow: 0 24px 70px rgba(0,0,0,.45);
    border:1px solid rgba(255,255,255,.06);
  }
  .scene { position:absolute; inset:0; opacity:0; }
  .bgimg { position:absolute; left:0; top:0; width:${PHONE_W}px; height:${PHONE_H}px; object-fit:cover; transform-origin:0 0; }

  .textcard {
    position:absolute; left:80px; right:80px; top:50%; transform:translateY(-50%); z-index:25; text-align:center;
    opacity:0;
  }
  .textcard .chead { font-size:72px; line-height:1.08; font-weight:800; color:#fff; text-shadow:0 4px 24px rgba(0,0,0,.45); }
  .textcard .csub { margin-top:22px; font-size:34px; line-height:1.35; font-weight:600; color:#9fe3b6; white-space:pre-line; }

  .caption {
    position:absolute; right:46px; top:0; bottom:0; width:400px; z-index:25;
    display:flex; flex-direction:column; justify-content:center; gap:24px;
    opacity:0;
  }
  .caption .bar { width:8px; align-self:flex-start; height:100%; background:linear-gradient(#34d399,#17a34a); border-radius:8px; position:absolute; left:-22px; }
  .caption .ctext { font-size:44px; line-height:1.18; font-weight:800; color:#fff; text-shadow:0 3px 14px rgba(0,0,0,.4); }
  .caption .csub { font-size:24px; line-height:1.4; font-weight:500; color:#d7f4e2; }

  .capbar {
    position:absolute; left:110px; right:110px; bottom:80px; z-index:25;
    background:rgba(6,20,13,.88);
    border-left:6px solid #34d399; border-radius:24px; padding:28px 34px;
    box-shadow:0 18px 48px rgba(0,0,0,.35);
    backdrop-filter:blur(18px);
    opacity:0;
  }
  .capbar .ctext { font-size:32px; line-height:1.3; font-weight:700; color:#fff; }

  .element-frame {
    position:absolute; z-index:15;
    max-width:820px; max-height:1200px;
    display:flex; align-items:center; justify-content:center;
    filter: drop-shadow(0 18px 42px rgba(0,0,0,.42)) drop-shadow(0 0 54px rgba(52,211,153,.18));
    border-radius:22px; overflow:hidden;
    background:rgba(255,255,255,.02);
    width:auto; height:auto;
    pointer-events:none;
    opacity:0;
  }
  .element-frame img { width:100%; height:auto; display:block; }

  .sidebar-video {
    position:absolute; left:0; top:0; width:${PHONE_W}px; height:${PHONE_H}px;
    transform-origin:center center; z-index:12; opacity:0; pointer-events:none;
    border-radius:28px; overflow:hidden;
  }
  .sidebar-video video { width:100%; height:100%; object-fit:cover; }

  .logo-foot { position:absolute; bottom:40px; left:50%; transform:translateX(-50%); z-index:25; opacity:.9; }
  .logo-foot img { height:34px; width:auto; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${totalDuration}" data-width="${CW}" data-height="${CH}">
  <div class="bg"></div>
  <img class="watermark" src="assets/logo.png" alt="" />
  <div class="brandpill"><img src="assets/logo.png" alt="" />Voluntariados de Becarios · ProExcelencia</div>

  <div class="phone">
    <div class="screen">
${scenes.filter(s => s.kind === 'image').map(s => `      <div class="scene" id="scene-${s.name}"><img class="bgimg" src="captures-mobile-local/${s.name}.png" /></div>`).join('\n')}
    </div>
  </div>

  <div id="element-container">${elementContainers}
  </div>

  <div class="sidebar-video" id="sidebar-video">
    <video id="sidebar-collapse" src="captures-mobile-local/sidebar-collapse.mp4" muted playsinline data-start="0" data-duration="3.5"></video>
  </div>

  ${textOverlays}

  <div class="logo-foot"><img src="assets/logo.png" alt="PROEXCELENCIA" /></div>
</div>
<script>
  window.__scenes = ${JSON.stringify(scenes)};
  const tl = gsap.timeline({ paused:true });

  window.__scenes.forEach((s, i) => {
    const phone = ${JSON.stringify(Object.fromEntries(scenes.map(s => [s.name, phoneTarget(s.layout)])))}[s.name];

    if (s.name === 'sep_callout') {
      tl.to('#sidebar-video', { opacity:1, x:phone.x, y:phone.y, scale:phone.s, duration:0.5, ease:'power2.out' }, s.start);
      tl.to('#sidebar-video', { opacity:0, duration:0.4 }, s.start + s.dur - 0.5);
    }

    tl.to('.phone', { x:phone.x, y:phone.y, scale:phone.s, opacity:phone.o, duration:0.6, ease:'power2.inOut' }, s.start);

    if (s.kind === 'image' && s.layout !== 'element') {
      tl.to('#scene-' + s.name, { opacity:1, duration:0.5 }, s.start);
      if (i < window.__scenes.length - 1) tl.to('#scene-' + s.name, { opacity:0, duration:0.5 }, s.start + s.dur - 0.5);
    }

    if (s.layout === 'element') {
      tl.to('#ef-' + s.name, { opacity:1, duration:0.5 }, s.start + 0.2);
      if (i < window.__scenes.length - 1) tl.to('#ef-' + s.name, { opacity:0, duration:0.4 }, s.start + s.dur - 0.4);
      tl.to('.phone', { y: phone.y - 24, duration: s.dur - 0.9, ease:'none' }, s.start + 0.6);
    }

    if (s.layout === 'text') {
      tl.to('.textcard', { opacity:1, duration:0.4 }, s.start + 0.1);
      if (i < window.__scenes.length - 1) tl.to('.textcard', { opacity:0, duration:0.3 }, s.start + s.dur - 0.3);
    }
  });

  tl.set({}, {}, ${totalDuration});
  window.__timelines = window.__timelines || {};
  window.__timelines['main'] = tl;
</script>
</body>
</html>`;

const OUT_FILE = process.env.OUT_FILE || __dirname + '/index.html';
fs.writeFileSync(OUT_FILE, html);
console.log('wrote', OUT_FILE, '— scenes:', scenes.length, 'total', totalDuration, 's');
