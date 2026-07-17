const fs = require('fs');

const CW = 1080, CH = 1920;
const PHONE_W = 470, PHONE_H = 1017;
const DSF = 3, VIEW_W = 390, VIEW_H = 844;
const BASE = PHONE_W / (VIEW_W * DSF);

const DUR = {
  intro: 3.5, sep_callout: 5, home: 4, nav_fab: 3, filters: 4, calendar: 4, detail: 4,
  join: 4, nav_fab_mis: 3, mis: 4, nav_fab_crear: 3, crear_buttons: 4,
  publish: 4, ai: 5, registrar: 4, evidence: 5, official: 6, close: 5,
};

function phoneTarget(layout) {
  if (layout === 'text') return { x: CW / 2 - PHONE_W / 2, y: CH / 2 - PHONE_H / 2, s: 0.5, o: 0 };
  if (layout === 'both') return { x: 64, y: CH / 2 - PHONE_H / 2, s: 1.0, o: 1 };
  if (layout === 'element') return { x: CW / 2 - PHONE_W / 2, y: CH / 2 - PHONE_H / 2, s: 0.5, o: 0.15 };
  return { x: CW / 2 - PHONE_W / 2, y: CH / 2 - PHONE_H / 2 - 10, s: 1.16, o: 1 };
}

const raw = JSON.parse(fs.readFileSync('/work/scenes-mobile.json', 'utf8'));
const scenes = raw.map((s) => {
  const phone = phoneTarget(s.layout);
  const imgName = (s.kind === 'image') ? `captures-mobile/${s.name}.png` : null;
  const elemName = (s.kind === 'image' && s.layout === 'element') ? `captures-mobile/elements/${s.name}.png` : null;
  return { ...s, phone, dur: DUR[s.name] || 4, imgName, elemName };
});

const sceneDivs = scenes.filter((s) => s.imgName).map((s) =>
  `<div class="scene" id="scene-${s.name}"><img class="bgimg" src="${s.imgName}" /><div class="hl" id="hl-${s.name}"></div></div>`
).join('\n');

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
  .watermark {
    position:absolute; right:-40px; bottom:-20px; width:520px; height:auto; opacity:0.07; pointer-events:none;
  }
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
    position:absolute; inset:0; border-radius:38px; overflow:hidden; background:#0c0b0a;
    box-shadow:0 30px 80px rgba(0,0,0,.55);
  }
  .scene { position:absolute; inset:0; opacity:0; }
  .bgimg { position:absolute; left:0; top:0; width:${PHONE_W}px; height:${PHONE_H}px; object-fit:cover; transform-origin:0 0; }
  .hl {
    position:absolute; border:3px solid #34d399; border-radius:14px;
    box-shadow:0 0 0 4px rgba(52,211,153,.25), 0 0 40px 10px rgba(52,211,153,.5);
    opacity:0; transform-origin:center; pointer-events:none;
  }
  .bezel {
    position:absolute; left:-14px; top:-14px; right:-14px; bottom:-14px;
    border:14px solid #0a0a0a; border-radius:52px; pointer-events:none;
    box-shadow:inset 0 0 0 2px rgba(255,255,255,.06);
  }
  .notch {
    position:absolute; top:10px; left:50%; transform:translateX(-50%);
    width:150px; height:26px; background:#0a0a0a; border-radius:0 0 18px 18px; z-index:20;
  }
  .caption {
    position:absolute; right:46px; top:0; bottom:0; width:430px; z-index:25;
    display:flex; flex-direction:column; justify-content:center; gap:18px; opacity:0;
  }
  .caption .bar { width:8px; align-self:flex-start; height:100%; background:linear-gradient(#34d399,#17a34a); border-radius:8px; position:absolute; left:-22px; }
  .caption .ctext { font-size:40px; line-height:1.18; font-weight:800; color:#fff; text-shadow:0 3px 14px rgba(0,0,0,.4); }
  .caption .csub { font-size:26px; line-height:1.4; font-weight:500; color:#bfe9cd; }
  .capbar {
    position:absolute; left:60px; right:60px; bottom:96px; z-index:25; opacity:0;
    background:linear-gradient(to top, rgba(6,20,13,.95), rgba(6,20,13,.7));
    border-left:6px solid #34d399; border-radius:18px; padding:26px 30px;
  }
  .capbar .ctext { font-size:32px; line-height:1.3; font-weight:700; color:#fff; }
  .textcard {
    position:absolute; left:80px; right:80px; top:50%; transform:translateY(-50%); z-index:25; opacity:0; text-align:center;
  }
  .textcard .chead { font-size:72px; line-height:1.08; font-weight:800; color:#fff; text-shadow:0 4px 24px rgba(0,0,0,.45); }
  .textcard .csub { margin-top:22px; font-size:34px; line-height:1.35; font-weight:600; color:#9fe3b6; white-space:pre-line; }
  .logo-foot { position:absolute; bottom:40px; left:50%; transform:translateX(-50%); z-index:25; opacity:.9; }
  .logo-foot img { height:34px; width:auto; }
  .element-frame {
    position:absolute; z-index:15; opacity:0; transform-origin:center center;
    filter: drop-shadow(0 8px 30px rgba(0,0,0,.5)) drop-shadow(0 0 40px rgba(52,211,153,.3));
    border-radius:16px; overflow:hidden;
  }
  .element-frame img { width:100%; height:auto; display:block; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-width="${CW}" data-height="${CH}">
  <div class="bg"></div>
  <img class="watermark" src="assets/logo.png" alt="" />
  <div class="brandpill"><img src="assets/logo.png" alt="" />Voluntariados de Becarios · ProExcelencia</div>

  <div class="phone">
    <div class="screen">
      ${sceneDivs}
    </div>
    <div class="notch"></div>
    <div class="bezel"></div>
  </div>

  <div id="element-container"></div>

  <div class="caption"><div class="bar"></div><div class="ctext"></div><div class="csub"></div></div>
  <div class="capbar"><div class="ctext"></div></div>
  <div class="textcard"><div class="chead"></div><div class="csub"></div></div>
  <div class="logo-foot"><img src="assets/logo.png" alt="PROEXCELENCIA" /></div>
</div>
<script>
  window.__scenes = ${JSON.stringify(scenes)};
  const tl = gsap.timeline({ paused:true });
  const CW = ${CW}, CH = ${CH};

  const setText = (s) => {
    document.querySelector('.caption .ctext').textContent = s.caption || '';
    document.querySelector('.caption .csub').textContent = s.sub || '';
    document.querySelector('.capbar .ctext').textContent = s.caption || '';
    document.querySelector('.textcard .chead').textContent = s.caption || '';
    document.querySelector('.textcard .csub').textContent = s.sub || '';
  };

  let t = 0;
  window.__scenes.forEach((s, i) => {
    const name = s.name, d = s.dur;

    tl.to('.phone', { x:s.phone.x, y:s.phone.y, scale:s.phone.s, opacity:s.phone.o, duration:0.6, ease:'power2.inOut' }, t);

    if (s.layout === 'element' && s.elemName) {
      const ec = document.getElementById('element-container');
      const ef = document.createElement('div');
      ef.id = 'ef-' + name;
      ef.className = 'element-frame';
      ef.innerHTML = '<img src="' + s.elemName + '" />';
      ec.appendChild(ef);

      tl.set('#ef-' + name, { opacity:0, x:CW/2, y:CH/2, scale:0.7 }, t);
      tl.to('#ef-' + name, { opacity:1, x:CW/2, y:CH/2, scale:1, duration:0.6, ease:'back.out(1.4)' }, t + 0.2);
      tl.to('#ef-' + name, { opacity:1, duration:0.3 }, t + d - 0.3);
      if (i < window.__scenes.length - 1) tl.to('#ef-' + name, { opacity:0, scale:0.9, duration:0.35 }, t + d - 0.35);
    }

    if (s.imgName && s.layout !== 'element') {
      tl.to('#scene-' + name, { opacity:1, duration:0.5 }, t);
      if (i < window.__scenes.length - 1) tl.to('#scene-' + name, { opacity:0, duration:0.5 }, t + d - 0.5);
    }

    tl.call(setText, [s], t);

    if (s.layout === 'text') {
      tl.to('.textcard', { opacity:1, duration:0.5 }, t + 0.2);
      tl.to('.caption', { opacity:0, duration:0.3 }, t);
      tl.to('.capbar', { opacity:0, duration:0.3 }, t);
    } else if (s.layout === 'both' || s.layout === 'element') {
      tl.to('.caption', { opacity:1, duration:0.5 }, t + 0.2);
      tl.to('.capbar', { opacity:0, duration:0.3 }, t);
      tl.to('.textcard', { opacity:0, duration:0.3 }, t);
    } else {
      tl.to('.capbar', { opacity:1, duration:0.5 }, t + 0.2);
      tl.to('.caption', { opacity:0, duration:0.3 }, t);
      tl.to('.textcard', { opacity:0, duration:0.3 }, t);
    }
    t += d;
  });
  window.__timelines = window.__timelines || {};
  window.__timelines['main'] = tl;
</script>
</body>
</html>`;

fs.writeFileSync('/work/index-mobile.html', html);
const total = scenes.reduce((a, s) => a + s.dur, 0);
console.log('wrote /work/index-mobile.html — scenes:', scenes.length, 'total', total.toFixed(1), 's');
