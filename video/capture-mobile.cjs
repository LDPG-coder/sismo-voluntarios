const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const OUT = '/work/captures-mobile';
const VIEW_W = 390, VIEW_H = 844, DSF = 3;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const CAP = {
  'intro':       { text: 'Voluntariados de Becarios', sub: 'del Programa ProExcelencia · SEP', kind: 'text', layout: 'text' },
  'value_publish': { text: '¿Vas a un voluntariado? Publícalo y permite que otros becarios se sumen a ayudar.', sub: 'Vas a ordenar insumos en una iglesia o ir al centro de acopio de tu universidad? Compártelo. Puede que algún otro becario cercano también pueda ir a colaborar.', kind: 'text', layout: 'text' },
  'value_share': { text: 'Comparte y limita los cupos según lo que necesites.', sub: 'Solo necesitas una persona más para que te colabore? Comparte la actividad y establece el máximo de participantes para que solo te acompañen la cantidad necesaria.', kind: 'text', layout: 'text' },
  'value_register': { text: '¿Ya llevas tiempo haciendo voluntariado por tu cuenta?', sub: 'Registra con la mayor cantidad de información posible tus voluntariados y labores. Todas estas actividades serán propuestas para validarte horas de voluntariado en ProExcelencia.', kind: 'text', layout: 'text' },
  'sep_callout': { text: 'Esta sección vivirá dentro del ecosistema del SEP: Voluntariados de Becarios ProExcelencia.', sub: '', kind: 'image', layout: 'phone', zoom: false },
  'home':        { text: 'Desde el inicio encuentras las actividades disponibles cerca de ti.', sub: '', kind: 'image', layout: 'phone', zoom: false },
  'nav_fab':     { text: 'Usa el menú flotante para navegar entre secciones rápidamente.', sub: '', kind: 'image', layout: 'phone', zoom: false },
  'filters':     { text: 'Filtra por zona para encontrar justo lo que necesitas.', sub: '', kind: 'image', layout: 'element', zoom: false },
  'calendar':    { text: 'Visualiza fácilmente las actividades para que puedas planificarte.', sub: '', kind: 'image', layout: 'element', zoom: false },
  'detail':      { text: 'Cada actividad reúne toda la info: descripción, lugar, fecha, cupos y asistentes.', sub: '', kind: 'image', layout: 'element', zoom: false },
  'join':        { text: '¿Quieres asistir? Pulsa Unirme y confirma.', sub: '', kind: 'image', layout: 'phone', zoom: false },
  'nav_fab_mis': { text: 'Usa el menú flotante para navegar entre secciones rápidamente.', sub: '', kind: 'image', layout: 'phone', zoom: false },
  'mis':         { text: 'Encuéntralas en Mis actividades, con todas tus inscripciones.', sub: '', kind: 'image', layout: 'phone', zoom: false },
  'nav_fab_crear': { text: 'Usa el menú flotante para navegar entre secciones rápidamente.', sub: '', kind: 'image', layout: 'phone', zoom: false },
  'crear_buttons': { text: 'Elige cómo crear tu actividad: proponer, oficial o registro previo.', sub: '', kind: 'image', layout: 'phone', zoom: false },
  'publish':     { text: '¿Organizas un voluntariado de becarios? Propón una actividad.', sub: '', kind: 'image', layout: 'phone', zoom: false },
  'ai':          { text: 'Describe tu idea libremente: la IA completa el formulario.', sub: '', kind: 'image', layout: 'both', zoom: false },
  'registrar':   { text: '¿Ya hiciste un voluntariado por tu cuenta? Regístralo aquí.', sub: '', kind: 'image', layout: 'phone', zoom: false },
  'evidence':    { text: 'Sube tus comprobantes (fotos) para validar tus horas.', sub: '', kind: 'image', layout: 'both', zoom: false },
  'official':    { text: 'Los voluntariados oficiales validan horas del Programa ProExcelencia. Registra la tuya!', sub: 'Por la situación actual, todas las actividades son candidatas a validar sus horas de voluntariado.', kind: 'image', layout: 'both', zoom: false },
  'close':       { text: 'Multipliquemos nuestro impacto.', sub: 'Comparte voluntariados a los que vayas o súmate a los demás. Coordinados ayudamos más.\n\nVoluntariados de Becarios · ProExcelencia', kind: 'text', layout: 'text' },
};

const scenes = [];

async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('  shot', name); }
async function shotElement(el, path) { await el.screenshot({ path }); console.log('  element shot', path); }
async function rectOf(page, sel) {
  try { return await page.$eval(sel, el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height }; }); } catch { return null; }
}
async function rectText(page, sel, txt) {
  try { return await page.$eval(sel, (el, t) => { if (!(el.textContent || '').includes(t)) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height }; }, txt); } catch { return null; }
}
async function clickTextRect(page, sel, txt) {
  return await page.evaluate((s, t) => {
    const els = [...document.querySelectorAll(s)];
    const el = els.find(e => (e.textContent || '').includes(t));
    if (!el) return null;
    const r = el.getBoundingClientRect(); el.click();
    return { left: r.left, top: r.top, w: r.width, h: r.height };
  }, sel, txt);
}
async function clickTextAny(page, txt) {
  return await page.evaluate((t) => {
    const els = [...document.querySelectorAll('button, a, [role="button"]')];
    const el = els.find(e => (e.textContent || '').trim().includes(t));
    if (!el) return null;
    const r = el.getBoundingClientRect(); el.click();
    return { left: r.left, top: r.top, w: r.width, h: r.height };
  }, txt);
}
async function clickAria(page, label) {
  return await page.evaluate((l) => {
    const el = document.querySelector(`[aria-label="${l}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect(); el.click();
    return { left: r.left, top: r.top, w: r.width, h: r.height };
  }, label);
}
function pushScene(name, target) {
  const c = CAP[name];
  scenes.push({ name, caption: c.text, sub: c.sub || '', kind: c.kind, layout: c.layout, zoom: !!c.zoom, target: target || null });
}
async function go(page, p, wait = 0) { await page.goto(BASE + p, { waitUntil: 'networkidle2' }); if (wait) await sleep(wait); }

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync('/work/samples', { recursive: true });
  fs.mkdirSync('/work/captures-mobile/elements', { recursive: true });
  const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', '--hide-scrollbars'] });
  const page = await browser.newPage();
  await page.setViewport({ width: VIEW_W, height: VIEW_H, deviceScaleFactor: DSF, isMobile: true, hasTouch: true });
  page.on('console', () => {});

  // login as external demo user
  await page.goto(BASE + '/auth/dev-login?cedula=99999999', { waitUntil: 'networkidle2' });
  await sleep(2000);

  // clear localStorage AFTER login to remove stale data (descriptions etc.)
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('privacy-notice-ack', '1');
  });
  await sleep(300);

  // dismiss privacy notice if it's still showing
  await clickTextAny(page, 'Continuar').catch(() => {});
  await sleep(1200);

  // generate sample photos for evidence using a separate browser page
  const photoPage = await browser.newPage();
  await photoPage.setViewport({ width: 600, height: 420, deviceScaleFactor: 1 });
  for (let i = 1; i <= 2; i++) {
    await photoPage.goto(`data:text/html,<body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="600" height="420"><rect width="600" height="420" fill="#138a3d"/><circle cx="300" cy="170" r="86" fill="#e9f6ee"/><text x="300" y="360" font-size="32" fill="#fff" text-anchor="middle" font-family="sans-serif">Comprobante ${i}</text></svg>`, { waitUntil: 'load' });
    await photoPage.screenshot({ path: `/work/samples/photo${i}.png` });
  }
  await photoPage.close();

  // re-login after photo generation (session may be lost due to data URLs)
  await page.goto(BASE + '/auth/dev-login?cedula=99999999', { waitUntil: 'networkidle2' });
  await sleep(1800);
  await page.evaluate(() => { localStorage.setItem('privacy-notice-ack', '1'); });
  await clickTextAny(page, 'Continuar').catch(() => {});
  await sleep(800);

  // intro + text scenes
  pushScene('intro', null);

  // --- Explanatory value-prop scenes ---
  pushScene('value_publish', null);
  pushScene('value_share', null);
  pushScene('value_register', null);

  // SEP callout
  await go(page, '/voluntarios', 1500);
  await clickAria(page, 'Vista previa de la integración con el SEP');
  await sleep(2000);
  await shot(page, 'sep_callout');
  pushScene('sep_callout', await rectOf(page, 'aside'));
  await clickAria(page, 'Cerrar menu');
  await sleep(900);

  // home
  await shot(page, 'home');
  pushScene('home', null);

  // nav_fab: show FAB menu open
  await clickAria(page, 'Abrir navegacion');
  await sleep(1200);
  await shot(page, 'nav_fab');
  pushScene('nav_fab', null);
  // close menu
  await clickAria(page, 'Cerrar navegacion');
  await sleep(700);

  // --- Actividades section: filters, calendar, detail ---

  // filters: extract zone filter element
  const zoneFilterEl = await page.$('.flex.flex-wrap.gap-2');
  if (zoneFilterEl) {
    await zoneFilterEl.screenshot({ path: '/work/captures-mobile/elements/filters.png' });
    console.log('  element shot filters');
  }
  pushScene('filters', null);

  // calendar: click Mes to get calendar view, extract view selector
  await clickTextAny(page, 'Mes');
  await sleep(1400);
  const viewSelEl = await page.$('.inline-flex.rounded-lg');
  if (viewSelEl) {
    await viewSelEl.screenshot({ path: '/work/captures-mobile/elements/calendar.png' });
    console.log('  element shot calendar');
  }
  pushScene('calendar', null);
  await clickTextAny(page, 'Lista');
  await sleep(900);

  // detail: extract a single activity card
  await page.waitForSelector('a[href^="/voluntarios/"]', { timeout: 6000 }).catch(() => {});
  const cardHrefs = await page.$$eval('a[href^="/voluntarios/"]', as => [...new Set(as.map(a => a.getAttribute('href')).filter(h => /^\/voluntarios\/[0-9a-f-]{36}$/.test(h)))]).catch(() => []);
  console.log('cards:', cardHrefs.length, cardHrefs.slice(0, 6));
  if (cardHrefs[0]) {
    const cardEl = await page.$('a[href^="/voluntarios/"]');
    if (cardEl) {
      await cardEl.screenshot({ path: '/work/captures-mobile/elements/detail.png' });
      console.log('  element shot detail');
    }
  }
  pushScene('detail', null);

  // join
  if (cardHrefs[0]) {
    await go(page, cardHrefs[0], 1200);
    await sleep(3500);
    const joinTarget = await rectText(page, 'button', 'Unirme');
    await shot(page, 'join');
    pushScene('join', joinTarget);
    await clickTextRect(page, 'button', 'Unirme');
    await sleep(1200);
    await clickTextRect(page, 'button', 'Inscribirme');
    await sleep(2200);
  }

  // --- Mis actividades ---
  await clickAria(page, 'Abrir navegacion');
  await sleep(700);
  await clickTextRect(page, 'a', 'Mis actividades');
  await sleep(2000);
  await shot(page, 'mis');
  pushScene('mis', null);

  // --- Crear section ---
  await go(page, '/voluntarios/crear', 2000);
  await shot(page, 'crear_buttons');
  pushScene('crear_buttons', null);

  // publish (Proponer)
  const proponerBtn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const btn = btns.find(b => b.textContent.includes('Proponer'));
    if (btn) { btn.click(); return true; }
    return false;
  });
  console.log('  clicked Proponer:', proponerBtn);
  await sleep(3000);
  await page.waitForSelector('textarea', { timeout: 6000 }).catch(() => {});
  const descSel = 'textarea';
  const hasTextarea = await page.$(descSel);
  if (hasTextarea) {
    await hasTextarea.click();
    await hasTextarea.type('Jornada de apoyo en el centro de acopio: recibir, ordenar y entregar insumos a las familias damnificadas.', { delay: 8 });
  }
  await sleep(700);
  await shot(page, 'publish');
  pushScene('publish', null);
  await sleep(3400);
  await shot(page, 'ai');
  pushScene('ai', null);
  await clickTextRect(page, 'button', 'Crear actividad').catch(() => {});
  await sleep(2000);

  // registrar (Registro previo)
  await clickAria(page, 'Abrir navegacion');
  await sleep(700);
  await clickTextRect(page, 'a', 'Crear');
  await sleep(1400);
  const registroBtn = await clickTextAny(page, 'Registro previo');
  console.log('  clicked Registro previo:', registroBtn);
  await sleep(2500);
  await page.waitForSelector('textarea', { timeout: 6000 }).catch(() => {});
  const regTA = await page.$(descSel);
  if (regTA) {
    await regTA.click();
    await regTA.type('El mes pasado ayudé en el centro de acopio ordenando ropa y alimentos para las familias afectadas.', { delay: 8 });
  }
  await sleep(800);
  await page.evaluate(() => {
    const setVal = (el, v) => { if (!el) return; const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(proto, 'value').set; setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    const byLabel = (kw) => { for (const l of document.querySelectorAll('label')) { if ((l.textContent || '').toLowerCase().includes(kw)) { const el = l.parentElement && l.parentElement.querySelector('input,textarea,select'); if (el) return el; } } return null; };
    setVal(byLabel('titulo'), 'Apoyo en centro de acopio (actividad realizada)');
    setVal(byLabel('direccion'), 'Centro de acopio Sector Norte, Valparaiso');
    const d = byLabel('fecha'); if (d) { setVal(d, '2025-05-10'); }
    const h = byLabel('hora inicio'); if (h) { setVal(h, '10:00'); }
  });
  await sleep(1000);
  await shot(page, 'registrar');
  pushScene('registrar', null);
  await clickTextRect(page, 'button', 'Registrar actividad realizada').catch(() => {});
  await sleep(2800);

  // evidence
  await page.evaluate(() => { const el = [...document.querySelectorAll('h2, p, div')].find(e => (e.textContent || '').includes('Comprobantes de la actividad')); if (el) el.scrollIntoView({ block: 'center' }); });
  await sleep(1200);
  const input = await page.$('input[type="file"]').catch(() => null);
  if (input) { await input.uploadFile('/work/samples/photo1.png', '/work/samples/photo2.png'); await sleep(1800); }
  await shot(page, 'evidence');
  pushScene('evidence', null);

  // official
  await go(page, '/voluntarios', 1400);
  await shot(page, 'official');
  pushScene('official', null);

  // close
  pushScene('close', null);

  await browser.close();

  fs.writeFileSync('/work/scenes-mobile.json', JSON.stringify(scenes, null, 2));
  console.log('wrote /work/scenes-mobile.json — scenes:', scenes.length);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
