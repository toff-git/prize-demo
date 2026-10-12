/* Prize Capital Markets demo v1: kortstokk med fjærfysikk, årganger, faner, barriere, test, rådgivere, skjema. */
(() => {
  'use strict';
  const DATA = window.PLASSERINGER || [];
  const rolig = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const minus = (s) => String(s).replace(/^-(?=\d)/, '−');

  /* ---------- Tellere ---------- */
  const antall = { alle: DATA.length, positiv: 0, tap: 0, aktiv: 0 };
  DATA.forEach((p) => { antall[p.s]++; });
  $$('[data-teller]').forEach((el) => { el.textContent = antall[el.dataset.teller]; });

  /* ---------- Meny ---------- */
  const menyknapp = $('.menyknapp');
  const meny = $('#meny');
  const lukkMeny = () => { menyknapp.setAttribute('aria-expanded', 'false'); meny.classList.remove('apen'); document.body.style.overflow = ''; };
  menyknapp.addEventListener('click', () => {
    const apen = menyknapp.getAttribute('aria-expanded') === 'true';
    if (apen) { lukkMeny(); return; }
    menyknapp.setAttribute('aria-expanded', 'true'); meny.classList.add('apen'); document.body.style.overflow = 'hidden';
    $('a', meny).focus();
  });
  meny.addEventListener('click', (e) => { if (e.target.closest('a')) lukkMeny(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && meny.classList.contains('apen')) { lukkMeny(); menyknapp.focus(); } });

  /* ---------- Fjær (dempingsforhold + respons, som Apple) ---------- */
  function fjaer({ fra, til, fart = 0, demping = 1, respons = 0.4, ved, ferdig }) {
    const k = Math.pow((2 * Math.PI) / respons, 2);
    const c = 2 * demping * Math.sqrt(k);
    let x = fra, v = fart, sist = performance.now(), id = 0, stoppet = false;
    const steg = (n) => {
      if (stoppet) return;
      let dt = Math.min(0.032, (n - sist) / 1000); sist = n;
      while (dt > 0) { const h = Math.min(dt, 1 / 240); const a = -k * (x - til) - c * v; v += a * h; x += v * h; dt -= h; }
      if (Math.abs(v) < 2 && Math.abs(x - til) < 0.3) { x = til; v = 0; ved(x); ferdig && ferdig(); return; }
      ved(x); id = requestAnimationFrame(steg);
    };
    id = requestAnimationFrame(steg);
    return { stopp() { stoppet = true; cancelAnimationFrame(id); return { x, v }; } };
  }
  const prosjekter = (fart, d = 0.998) => (fart / 1000) * d / (1 - d);
  const gummi = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));

  /* ---------- Kortstokken ---------- */
  const bane = $('[data-bane]');
  const vindu = $('.kortstokk__vindu');
  // «Alle»: nyeste ferdige plasseringer først (gevinst og tap i naturlig rekkefølge), de som pågår sist
  const ALLE = DATA.filter((p) => p.s !== 'aktiv').concat(DATA.filter((p) => p.s === 'aktiv'));
  let utvalg = ALLE.slice();
  let x = 0, anim = null, aktiv = 0;

  const status = (p) => p.s === 'positiv' ? `<span>Ga</span><b>${esc(p.t)}</b>` : p.s === 'tap' ? `<span>Tap</span><b>${esc(minus(p.t))}</b>` : `<span>Pågår</span><b>${p.k && p.k !== '-' ? 'kupong ' + esc(p.k) : ''}</b>`;
  const statusTekst = (p) => p.s === 'positiv' ? `ga ${p.t} total avkastning` : p.s === 'tap' ? `gikk med ${minus(p.t)} total avkastning` : 'pågår fortsatt';

  function tegnKort() {
    bane.innerHTML = utvalg.map((p, i) => {
      const nr = p.n.split(' ')[0];
      const navn = p.n.slice(nr.length + 1);
      const vri = ((i * 37) % 7 - 3) * 0.6; // fast, ujevn vri som kort lagt på et bord
      return `<li class="kort kort--${p.s}" style="--vri:${vri.toFixed(1)}deg;--i:${i}">
        <button type="button" class="kort__snu" tabindex="${i === 0 ? 0 : -1}" aria-pressed="false"
          aria-label="Plassering ${esc(nr)}, ${esc(navn)}, ${esc(p.m)}, ${esc(statusTekst(p))}. Trykk for detaljer.">
          <span class="kort__side kort__forside" aria-hidden="true">
            <span class="kort__mnd">${esc(p.m)}</span>
            <span class="kort__nr">${esc(nr)}</span>
            <span class="kort__navn">${esc(navn)}</span>
            <span class="kort__under">${esc(p.u)}</span>
            <span class="kort__stempel">${status(p)}</span>
          </span>
          <span class="kort__side kort__bakside" aria-hidden="true">
            <h3>${esc(nr)} ${esc(p.u)}</h3>
            <dl>
              <div><dt>Varighet</dt><dd>${p.v && p.v !== '-' ? esc(p.v) + ' år' : 'pågår'}</dd></div>
              <div><dt>Utbetalte kuponger</dt><dd>${esc(p.k)}</dd></div>
              <div><dt>Årlig avkastning</dt><dd>${esc(minus(p.a))}</dd></div>
              <div><dt>Total avkastning</dt><dd>${esc(minus(p.t))}</dd></div>
            </dl>
            <span class="kort__merk">Etter faktisk tegningskostnad. Historisk avkastning er ingen garanti.</span>
          </span>
        </button></li>`;
    }).join('');
    aktiv = 0; settX(0);
  }

  const grenser = () => {
    const min = Math.min(0, vindu.clientWidth - bane.scrollWidth);
    return { min, max: 0 };
  };
  const steg = () => { const k = bane.children[0]; if (!k) return 240; return k.offsetWidth + parseFloat(getComputedStyle(bane).columnGap || 20); };
  function settX(v) { x = v; bane.style.transform = `translate3d(${v}px,0,0)`; }
  function tilX(mal, fart = 0, demping = 1) {
    const g = grenser(); mal = Math.max(g.min, Math.min(g.max, mal));
    if (anim) anim.stopp();
    if (rolig.matches) { settX(mal); return; }
    anim = fjaer({ fra: x, til: mal, fart, demping, respons: 0.45, ved: settX, ferdig: () => { anim = null; } });
  }
  function visKort(i, fokus = true) {
    const kort = bane.children; if (!kort.length) return;
    i = Math.max(0, Math.min(kort.length - 1, i));
    const knapp = $('.kort__snu', kort[aktiv]); if (knapp) knapp.tabIndex = -1;
    aktiv = i;
    const ny = $('.kort__snu', kort[i]); ny.tabIndex = 0;
    if (fokus) ny.focus({ preventScroll: true });
    const s = steg();
    const midt = (vindu.clientWidth - kort[i].offsetWidth) / 2;
    tilX(-(i * s) + midt - parseFloat(getComputedStyle(bane).paddingLeft) + 0);
  }

  // Dra med pekeren: 1:1, gummi i endene, fart overføres til fjæren ved slipp
  let drag = null;
  vindu.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const pagaende = anim ? anim.stopp() : null; anim = null;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: pagaende ? pagaende.x : x, aktivt: false, spor: [{ x: e.clientX, t: e.timeStamp }] };
  });
  vindu.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.aktivt) {
      if (Math.abs(dx) < 8) { if (Math.abs(dy) > 10) drag = null; return; }
      drag.aktivt = true; vindu.setPointerCapture(e.pointerId); vindu.classList.add('drar');
    }
    const g = grenser(); let nx = drag.x0 + dx;
    if (nx > g.max) nx = g.max + gummi(nx - g.max, vindu.clientWidth);
    if (nx < g.min) nx = g.min - gummi(g.min - nx, vindu.clientWidth);
    settX(nx);
    drag.spor.push({ x: e.clientX, t: e.timeStamp }); if (drag.spor.length > 6) drag.spor.shift();
  });
  const slipp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; vindu.classList.remove('drar');
    if (!d.aktivt) return;
    vindu.dataset.dratt = '1'; setTimeout(() => { delete vindu.dataset.dratt; }, 0);
    const a = d.spor[0], b = d.spor[d.spor.length - 1];
    const fart = b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
    const s = steg();
    const mal = Math.round((x + prosjekter(fart)) / s) * s; // nærmeste kort etter projisert stopp
    const i = Math.round(-mal / s);
    const g = grenser();
    tilX(Math.max(g.min, Math.min(g.max, mal)), fart, 0.85);
    const knapp = $('.kort__snu', bane.children[aktiv]); if (knapp) knapp.tabIndex = -1;
    aktiv = Math.max(0, Math.min(bane.children.length - 1, i));
    $('.kort__snu', bane.children[aktiv]).tabIndex = 0;
  };
  vindu.addEventListener('pointerup', slipp);
  vindu.addEventListener('pointercancel', slipp);
  vindu.addEventListener('click', (e) => {
    if (vindu.dataset.dratt) { e.preventDefault(); e.stopPropagation(); return; }
    const knapp = e.target.closest('.kort__snu'); if (!knapp) return;
    const li = knapp.parentElement;
    const snudd = li.classList.toggle('snudd');
    knapp.setAttribute('aria-pressed', String(snudd));
    const i = [...bane.children].indexOf(li);
    if (i !== aktiv) { $('.kort__snu', bane.children[aktiv]).tabIndex = -1; aktiv = i; knapp.tabIndex = 0; }
    oppdaterDetalj(li, snudd);
  }, true);
  // Skjermlesere får baksiden som tekst i etiketten når kortet er snudd
  function oppdaterDetalj(li, snudd) {
    const knapp = $('.kort__snu', li);
    const p = utvalg[[...bane.children].indexOf(li)];
    if (!p) return;
    const nr = p.n.split(' ')[0];
    knapp.setAttribute('aria-label', snudd
      ? `Plassering ${nr}, ${p.u}. Startet ${p.m}. ${p.v && p.v !== '-' ? 'Varighet ' + p.v + ' år.' : 'Pågår.'} Utbetalte kuponger ${p.k}. Årlig avkastning ${minus(p.a)}. Total avkastning ${minus(p.t)}.`
      : `Plassering ${nr}, ${p.n.slice(nr.length + 1)}, ${p.m}, ${statusTekst(p)}. Trykk for detaljer.`);
  }
  // Hjul: bare sidelengs bevegelse (eller shift) tas, loddrett rulling slipper gjennom
  vindu.addEventListener('wheel', (e) => {
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!dx) return;
    e.preventDefault();
    if (anim) { anim.stopp(); anim = null; }
    const g = grenser(); settX(Math.max(g.min, Math.min(g.max, x - dx)));
  }, { passive: false });
  bane.addEventListener('keydown', (e) => {
    const map = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity };
    if (!(e.key in map)) return;
    e.preventDefault();
    const n = map[e.key];
    visKort(Number.isFinite(n) ? aktiv + n : (n < 0 ? 0 : bane.children.length - 1));
  });
  $$('[data-pil]').forEach((b) => b.addEventListener('click', () => {
    const per = Math.max(1, Math.floor(vindu.clientWidth / steg()) - 1);
    visKort(aktiv + Number(b.dataset.pil) * per, false);
  }));
  $$('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-filter]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    const f = b.dataset.filter;
    utvalg = f === 'alle' ? ALLE.slice() : DATA.filter((p) => p.s === f);
    if (anim) { anim.stopp(); anim = null; }
    tegnKort();
  }));
  addEventListener('resize', () => { const g = grenser(); settX(Math.max(g.min, Math.min(g.max, x))); });
  tegnKort();
  // Kortene deles ut på bordet når siden åpnes (bare én gang, ikke ved redusert bevegelse)
  if (!rolig.matches) {
    bane.classList.add('stokket');
    requestAnimationFrame(() => requestAnimationFrame(() => bane.classList.remove('stokket')));
    setTimeout(() => { $$('.kort', bane).forEach((k) => { k.style.transitionDelay = '0ms'; }); }, 1800);
  }

  /* ---------- Årgangene ---------- */
  const liste = $('[data-argangsliste]');
  const ar = {};
  DATA.forEach((p, i) => { const a = p.m.slice(-4); (ar[a] = ar[a] || []).push({ ...p, i }); });
  const maks = 90;
  liste.style.setProperty('--n', Math.max(...Object.values(ar).map((r) => r.length)));
  liste.innerHTML = Object.keys(ar).sort().map((a) => {
    const rad = ar[a].slice().reverse(); // eldste først innen året
    const pos = rad.filter((p) => p.s === 'positiv').length, tap = rad.filter((p) => p.s === 'tap').length, akt = rad.filter((p) => p.s === 'aktiv').length;
    const sum = [`${rad.length} plasseringer`, pos && `${pos} ga avkastning`, tap && `${tap} med tap`, akt && `${akt} pågår`].filter(Boolean).join(', ');
    return `<li class="argang"><p class="argang__ar">${a}<span class="argang__sum">${sum}</span></p>
      <div class="argang__streker" aria-hidden="true">${rad.map((p) => {
        const t = parseFloat(String(p.t).replace(',', '.'));
        const h = isNaN(t) ? 0 : Math.min(50, (Math.abs(t) / maks) * 50);
        return `<button type="button" tabindex="-1" class="strek strek--${p.s}" data-i="${p.i}" style="--h:${Math.max(2, h).toFixed(1)}%"><i></i></button>`;
      }).join('')}</div></li>`;
  }).join('');
  const boble = document.createElement('div'); boble.className = 'boble'; boble.setAttribute('aria-hidden', 'true'); document.body.append(boble);
  liste.addEventListener('pointerover', (e) => {
    const s = e.target.closest('.strek'); if (!s) return;
    const p = DATA[s.dataset.i]; const r = s.getBoundingClientRect();
    boble.innerHTML = `<b>${esc(p.n)}</b><br>${esc(p.m)}, ${esc(p.u)}<br>${p.s === 'aktiv' ? 'Pågår' : 'Total ' + esc(minus(p.t))}`;
    boble.style.left = Math.min(innerWidth - 270, Math.max(8, r.left - 20)) + 'px';
    boble.style.top = Math.max(8, r.top - 96) + 'px';
    boble.classList.add('vis');
  });
  liste.addEventListener('pointerout', (e) => { if (e.target.closest('.strek')) boble.classList.remove('vis'); });
  liste.addEventListener('click', (e) => {
    const s = e.target.closest('.strek'); if (!s) return;
    boble.classList.remove('vis');
    const i = ALLE.indexOf(DATA[Number(s.dataset.i)]);
    const alle = $('[data-filter="alle"]');
    if (alle.getAttribute('aria-pressed') !== 'true') alle.click();
    $('.kortstokk').scrollIntoView({ behavior: rolig.matches ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => {
      visKort(i);
      const li = bane.children[i];
      if (!li.classList.contains('snudd')) { li.classList.add('snudd'); $('.kort__snu', li).setAttribute('aria-pressed', 'true'); oppdaterDetalj(li, true); }
    }, rolig.matches ? 0 : 450);
  });
  const arganger = $('[data-arganger]');
  new IntersectionObserver((inn, o) => { if (inn[0].isIntersecting) { arganger.classList.add('tegnet'); o.disconnect(); } }, { threshold: 0.15 }).observe(arganger);

  /* ---------- Faner ---------- */
  const faner = $$('[role="tab"]');
  const velgFane = (f) => {
    faner.forEach((o) => { const v = o === f; o.setAttribute('aria-selected', String(v)); o.tabIndex = v ? 0 : -1; $('#' + o.getAttribute('aria-controls')).hidden = !v; });
    f.focus();
  };
  faner.forEach((f, i) => {
    f.addEventListener('click', () => velgFane(f));
    f.addEventListener('keydown', (e) => {
      const n = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!n) return;
      e.preventDefault(); velgFane(faner[(i + n + faner.length) % faner.length]);
    });
  });

  /* ---------- Barrieren ---------- */
  const fall = $('[data-fall]'), indeks = $('[data-indeks]'), indeksTall = $('[data-indeks-tall]'), fallTekst = $('[data-fall-tekst]'), utfall = $('[data-utfall]');
  const oppdaterFall = () => {
    const f = Number(fall.value), niva = 100 - f;
    indeks.style.setProperty('--niva', niva); indeksTall.textContent = niva + ' %';
    fallTekst.textContent = f === 0 ? 'uendret' : `falt ${f} %`;
    let t, tap = false;
    if (niva >= 90) t = 'Over alle barrierene: kupongen utbetales, og på en observasjonsdag avsluttes plasseringen med beløpet ditt tilbake.';
    else if (niva >= 60) t = 'Under kupongbarrieren: ingen kupong denne gangen, men den spares opp og etterbetales hvis indeksen kommer tilbake over 90 %. Ligger indeksen over risikobarrieren ved forfall, får du beløpet tilbake.';
    else { t = `Under risikobarrieren ved forfall: du får ikke igjen hele beløpet. Tapet følger indeksen, her om lag ${f} % av beløpet.`; tap = true; }
    utfall.textContent = t; utfall.classList.toggle('tap', tap);
  };
  fall.addEventListener('input', oppdaterFall); oppdaterFall();

  /* ---------- Test: passer vi for deg? ---------- */
  const SPM = [
    { t: 'Kan du la pengene stå i ett til fem år?', h: 'Et kupongsertifikat varer fra ett til fem år. Du kan selge underveis, men til markedskurs.', nei: 'Du trenger kanskje pengene før plasseringen er ferdig.' },
    { t: 'Tåler du å tape hele eller deler av beløpet?', h: 'Faller indeksen under risikobarrieren ved forfall, taper du penger. Det har skjedd med ' + antall.tap + ' av plasseringene våre.', nei: 'Du ønsker ikke å risikere tap av beløpet.' },
    { t: 'Har du en buffer ved siden av disse pengene?', h: 'Pengene du plasserer, bør ikke være pengene du trenger hvis noe uventet skjer.', nei: 'Du har ikke en egen buffer ved siden av.' },
    { t: 'Er det greit at rådgiveren din også selger produktene?', h: 'Rådgivningen vår er ikke-uavhengig: PCM er selv distributør av produktene vi anbefaler.', nei: 'Du ønsker uavhengig rådgivning.' },
  ];
  const bunke = $('[data-test-bunke]'), svarRad = $('[data-test-svar]'), resultat = $('[data-test-resultat]');
  let svar = [];
  function tegnTest() {
    svar = []; resultat.hidden = true; svarRad.hidden = false; bunke.hidden = false;
    bunke.innerHTML = SPM.map((s, i) => `<li class="spm" style="--y:${i * -12}px; --s:${1 - i * 0.04}; z-index:${10 - i}" ${i ? 'aria-hidden="true"' : ''}>
      <p class="spm__nr">Spørsmål ${i + 1} av ${SPM.length}</p><p class="spm__tekst">${esc(s.t)}</p><p class="spm__hjelp">${esc(s.h)}</p></li>`).join('');
  }
  function svarPa(ja, fart) {
    const n = svar.length; if (n >= SPM.length) return;
    const kort = bunke.children[n];
    svar.push(ja);
    kort.style.setProperty('--x', (ja ? 1 : -1) * (fart ? Math.max(500, Math.abs(fart) * 0.4) : 520) + 'px');
    kort.style.setProperty('--r', (ja ? 14 : -14) + 'deg');
    kort.classList.add('ut'); kort.setAttribute('aria-hidden', 'true');
    [...bunke.children].slice(n + 1).forEach((k, j) => { k.style.setProperty("--y", j * -12 + "px"); k.style.setProperty('--s', 1 - j * 0.04); });
    const neste = bunke.children[n + 1]; if (neste) neste.removeAttribute('aria-hidden');
    if (svar.length === SPM.length) setTimeout(visResultat, rolig.matches ? 0 : 350);
  }
  function visResultat() {
    bunke.hidden = true; svarRad.hidden = true; resultat.hidden = false;
    const nei = SPM.filter((s, i) => !svar[i]);
    resultat.innerHTML = nei.length === 0
      ? `<h3>Da kan en samtale være verdt det.</h3><p>Før vi anbefaler noe, kartlegger vi målene dine, erfaringen din og evnen din til å bære tap. Samtalen er uforpliktende.</p>
         <div class="knapper"><a class="knapp knapp--mork" href="#bestill">Bestill en samtale</a><button type="button" class="knapp knapp--strek" data-igjen>Ta testen på nytt</button></div>`
      : `<h3>Kupongsertifikater passer trolig ikke for deg nå.</h3><ul>${nei.map((s) => `<li>${esc(s.nei)}</li>`).join('')}</ul>
         <p>Vi sier det heller nå enn etter at du har investert. Du kan likevel ringe oss om tradisjonell formuesforvaltning på <a href="tel:+4722900600">22 900 600</a>.</p>
         <div class="knapper"><button type="button" class="knapp knapp--strek" data-igjen>Ta testen på nytt</button></div>`;
    resultat.focus();
    $('[data-igjen]', resultat).addEventListener('click', () => { tegnTest(); $('[data-svar="ja"]').focus(); });
  }
  $$('[data-svar]').forEach((b) => b.addEventListener('click', () => svarPa(b.dataset.svar === 'ja')));
  // Sveip øverste kort til høyre (ja) eller venstre (nei)
  let sveip = null;
  bunke.addEventListener('pointerdown', (e) => {
    const kort = bunke.children[svar.length]; if (!kort || !kort.contains(e.target)) return;
    sveip = { kort, sx: e.clientX, id: e.pointerId, spor: [{ x: e.clientX, t: e.timeStamp }], aktivt: false };
  });
  bunke.addEventListener('pointermove', (e) => {
    if (!sveip || e.pointerId !== sveip.id) return;
    const dx = e.clientX - sveip.sx;
    if (!sveip.aktivt) { if (Math.abs(dx) < 8) return; sveip.aktivt = true; bunke.setPointerCapture(e.pointerId); sveip.kort.classList.add('drar'); }
    sveip.kort.style.setProperty('--x', dx + 'px'); sveip.kort.style.setProperty('--r', dx / 25 + 'deg');
    sveip.spor.push({ x: e.clientX, t: e.timeStamp }); if (sveip.spor.length > 6) sveip.spor.shift();
  });
  const sveipSlutt = (e) => {
    if (!sveip || e.pointerId !== sveip.id) return;
    const s = sveip; sveip = null; s.kort.classList.remove('drar'); if (!s.aktivt) return;
    const a = s.spor[0], b = s.spor[s.spor.length - 1];
    const fart = b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
    const slutt = (b.x - s.sx) + prosjekter(fart, 0.99);
    if (Math.abs(slutt) > 140) svarPa(slutt > 0, fart);
    else { s.kort.style.setProperty('--x', '0px'); s.kort.style.setProperty('--r', '0deg'); }
  };
  bunke.addEventListener('pointerup', sveipSlutt); bunke.addEventListener('pointercancel', sveipSlutt);
  tegnTest();

  /* ---------- Rådgivere ---------- */
  const FOLK = [
    ['Fredrik Kvale', 'Daglig leder, partner', 'fk@prizecm.no', '456 87 274', 'fredrik-kvale'],
    ['Alexander Wiesmann', 'Meglersjef, partner', 'aw@prizecm.no', '465 27 808', 'alexander-wiesmann'],
    ['Mari Mata', 'Investeringsrådgiver, partner', 'mari@prizecm.no', '457 20 273', 'mari-mata'],
    ['Matilde Holen', 'Compliance-ansvarlig', 'mh@prizecm.no', '229 00 605', 'matilde-holen'],
    ['Daniel Jørgensen', 'Investeringsrådgiver', 'dj@prizecm.no', '940 27 289', 'daniel-jorgensen'],
    ['Shara Karimi', 'Investeringsrådgiver', 'sk@prizecm.no', '474 88 832', 'shara-karimi'],
    ['Ira Topalli', 'Investeringsrådgiver', 'irat@prizecm.no', '969 43 184', 'ira-topalli'],
    ['Fredrik Waaler', 'Investeringsrådgiver', 'fw@prizecm.no', '488 62 614', 'fredrik-waaler'],
    ['Alexander Wille', 'Investeringsrådgiver', 'alw@prizecm.no', '488 98 612', 'alexander-wille'],
    ['Julian Grødum', 'Investeringsrådgiver', 'jg@prizecm.no', '459 66 372', 'julian-grodum'],
    ['Markus Relbo', 'Investeringsrådgiver', 'mer@prizecm.no', '474 92 576', 'markus-relbo'],
    ['Leander Helgesen', 'Investeringsrådgiver', 'lh@prizecm.no', '474 92 656', 'leander-helgesen'],
  ];
  $('[data-kontaktark]').innerHTML = FOLK.map(([navn, rolle, epost, tlf, fil]) => `<li class="trykk glid">
    <figure class="trykk__bilde"><img src="bilder/${fil}.jpg" alt="Portrett av ${esc(navn)}" width="640" height="711" loading="lazy" decoding="async">
      <figcaption><p class="trykk__navn">${esc(navn)}</p><p class="trykk__rolle">${esc(rolle)}</p></figcaption></figure>
    <p class="trykk__kontakt"><a href="tel:+47${tlf.replace(/\s/g, '')}">${tlf}</a><a href="mailto:${epost}">${epost}</a></p></li>`).join('');
  $('[data-hvem]').insertAdjacentHTML('beforeend', FOLK.filter((f) => f[1] !== 'Compliance-ansvarlig').map(([n]) => `<option>${esc(n)}</option>`).join(''));

  /* ---------- Skjema (demo: sender ingenting) ---------- */
  const skjema = $('[data-skjema]');
  const regler = {
    navn: (v) => v.trim().length > 1,
    tlf: (v) => v.replace(/[^\d]/g, '').length >= 8,
    epost: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  };
  const sjekk = (felt) => {
    const ok = regler[felt.name](felt.value);
    felt.setAttribute('aria-invalid', String(!ok)); $('#' + felt.id + '-feil').hidden = ok; return ok;
  };
  Object.keys(regler).forEach((n) => { const f = skjema.elements[n]; f.addEventListener('blur', () => { if (f.value) sjekk(f); }); f.addEventListener('input', () => { if (f.getAttribute('aria-invalid') === 'true') sjekk(f); }); });
  skjema.addEventListener('submit', (e) => {
    e.preventDefault();
    const feil = Object.keys(regler).map((n) => skjema.elements[n]).filter((f) => !sjekk(f));
    const st = $('[data-status]');
    if (feil.length) { st.textContent = ''; feil[0].focus(); return; }
    st.textContent = 'Takk. Dette er en demo, så ingenting er sendt. På den ferdige siden går forespørselen rett til rådgiveren du valgte.';
  });

  /* ---------- Flytende knapp skjules når skjemaet er i bildet ---------- */
  const flyt = $('[data-flytende]');
  const iBildet = new Set();
  const flytIo = new IntersectionObserver((inn) => {
    inn.forEach((i) => (i.isIntersecting ? iBildet.add(i.target) : iBildet.delete(i.target)));
    flyt.classList.toggle('skjult', iBildet.size > 0);
  }, { threshold: 0 });
  [$('.bord__knapper'), $('#bestill'), $('[data-test-svar]'), $('[data-test-resultat]'), $('.bunn')].forEach((el) => flytIo.observe(el));

  /* ---------- Innglidning ---------- */
  $$('.seksjonstittel, .bunken__tittel, .bunken__tall, .ark, .billett, .skjema, .karriere__tittel').forEach((el) => el.classList.add('glid'));
  if (rolig.matches || !('IntersectionObserver' in window)) { $$('.glid').forEach((el) => el.classList.add('inne')); }
  else {
    const io = new IntersectionObserver((inn) => inn.forEach((i) => { if (i.isIntersecting) { i.target.classList.add('inne'); io.unobserve(i.target); } }), { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    $$('.glid').forEach((el) => io.observe(el));
  }
})();
