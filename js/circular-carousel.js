/* CircularCarousel: a dependency-free port of React Bits' <CircularCarousel />
 * (https://reactbits.dev/components/circular-carousel, JS-CSS variant).
 * Same presets, physics (spring snap, momentum, drift), intros, drag/wheel/keyboard
 * input, captions and reduced-motion handling, rewritten without React so it runs in
 * this static site. Uses css/circular-carousel.css (copied unchanged).
 *
 *   const cc = CircularCarousel.mount(element, { items, preset, intro, cardWidth, ... });
 *   cc.focusIndex(3); cc.stepBy(1); cc.destroy();
 */
(function (root) {
  'use strict';

  const PRESETS = {
    cylinder: { axis: 'y', tilt: -5, perspective: 2500, curve: 1, spread: 1, inward: false, billboard: false, backfaces: true, window: 0 },
    orbit: { axis: 'y', tilt: -16, perspective: 1500, curve: 0, spread: 1.45, inward: false, billboard: true, backfaces: false, window: 0 },
    wheel: { axis: 'x', tilt: 0, perspective: 1800, curve: 0, spread: 1, inward: false, billboard: false, backfaces: true, window: 1.7 },
    panorama: { axis: 'y', tilt: 0, perspective: 0, curve: 1, spread: 1, inward: true, billboard: false, backfaces: false, window: 0 }
  };

  const INTRO_LENGTH = { assemble: 1500, rise: 1400, spin: 1800, none: 0 };
  const TILES = 8;
  const OVERLAP = 2.5;
  const DRAG_THRESHOLD = 5;
  const SPRING = 118;
  const SETTLE_SPEED = 9;
  const CAPTION_SPACE = 76;
  const TO_RAD = Math.PI / 180;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const wrap = degrees => ((((degrees + 180) % 360) + 360) % 360) - 180;
  const easeOut = t => 1 - Math.pow(1 - t, 4);
  const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
  const rotateX = (p, d) => { const r = d * TO_RAD, c = Math.cos(r), s = Math.sin(r); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
  const rotateY = (p, d) => { const r = d * TO_RAD, c = Math.cos(r), s = Math.sin(r); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
  const el = (tag, cls, attrs) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k]));
    return n;
  };

  const DEFAULTS = {
    items: [], preset: 'cylinder', intro: 'rise', cardWidth: 220, aspectRatio: 1, gap: 25,
    curve: undefined, tilt: undefined, perspective: undefined,
    autoplay: 'drift', speed: 14, interval: 3, direction: 'left', draggable: true, momentum: 0.6,
    snap: true, pauseOnHover: true, focusOnClick: true, parallax: 0.3, stretch: 0.5, depthFade: 0.55,
    fadeColor: '#000000', innerShade: 0.6, cornerRadius: 12, captions: false,
    ariaLabel: 'Image carousel', onChange: null, onItemClick: null, className: ''
  };

  function Carousel(host, options) {
    const o = Object.assign({}, DEFAULTS, options || {});
    const list = o.items && o.items.length ? o.items : [];
    const count = list.length;
    const shape = PRESETS[o.preset] ? o.preset : 'cylinder';
    const layout = PRESETS[shape];
    const axis = layout.axis;
    const tiltValue = o.tilt != null ? o.tilt : layout.tilt;
    const curveValue = layout.billboard ? 0 : clamp(o.curve != null ? o.curve : layout.curve, 0, 1);
    const mql = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    const cardW = Math.max(40, o.cardWidth);
    const cardH = cardW / clamp(o.aspectRatio, 0.2, 5);
    const along = axis === 'x' ? cardH : cardW;
    const step = 360 / count;

    const radius = (() => {
      const n = Math.max(count, 3);
      const pitch = (along + o.gap) * layout.spread;
      const chord = pitch / (2 * Math.sin(Math.PI / n));
      const arc = (n * pitch) / (2 * Math.PI);
      return Math.max(chord + (arc - chord) * curveValue, along * 0.6);
    })();

    const tiles = (() => {
      const total = curveValue > 0.001 ? TILES : 1;
      const length = along / total;
      const bend = curveValue > 0.001 ? radius / curveValue : 0;
      return Array.from({ length: total }, (_, index) => {
        const start = index * length - (index > 0 ? OVERLAP / 2 : 0);
        const end = (index + 1) * length + (index < total - 1 ? OVERLAP / 2 : 0);
        const center = (start + end) / 2 - along / 2;
        const alpha = bend ? center / bend : 0;
        const shift = bend ? bend * Math.sin(alpha) : center;
        const sink = bend ? bend * (1 - Math.cos(alpha)) : 0;
        const depth = layout.inward ? sink : -sink;
        const turn = ((layout.inward ? -alpha : alpha) * 180) / Math.PI;
        const move = axis === 'x'
          ? `translate3d(0px, ${shift}px, ${depth}px) rotateX(${-turn}deg)`
          : `translate3d(${shift}px, 0px, ${depth}px) rotateY(${turn}deg)`;
        return { index, total, start, end, size: end - start, move };
      });
    })();

    const dragSign = layout.inward ? -1 : 1;
    const directionSign = (o.direction === 'right' ? 1 : -1) * dragSign;

    const settings = () => {
      const reduced = !!(mql && mql.matches);
      return {
        count, step, radius, layout, axis, tilt: tiltValue,
        perspective: layout.inward ? radius : (o.perspective != null ? o.perspective : layout.perspective),
        cardW, cardH,
        intro: reduced ? 'none' : (o.intro in INTRO_LENGTH ? o.intro : 'rise'),
        autoplay: reduced ? 'off' : o.autoplay,
        speed: o.speed, interval: Math.max(0.5, o.interval), draggable: o.draggable,
        momentum: clamp(o.momentum, 0, 1), snap: o.snap, pauseOnHover: o.pauseOnHover,
        parallax: reduced ? 0 : clamp(o.parallax, 0, 1),
        stretch: reduced ? 0 : clamp(o.stretch, 0, 1),
        depthFade: clamp(o.depthFade, 0, 1), captions: o.captions, reduced
      };
    };
    let s = settings();

    // ----- DOM -----------------------------------------------------------------
    const rootEl = el('div', ('circular-carousel ' + (o.className || '')).trim(), {
      role: 'region', 'aria-roledescription': 'carousel', 'aria-label': o.ariaLabel, tabindex: '0',
      'data-axis': axis, 'data-shape': shape
    });
    if (o.draggable) rootEl.setAttribute('data-draggable', '');
    rootEl.style.setProperty('--cc-fade', o.fadeColor);
    rootEl.style.setProperty('--cc-radius', Math.max(0, o.cornerRadius) + 'px');
    rootEl.style.setProperty('--cc-inner', (1 - clamp(o.innerShade, 0, 1)).toFixed(3));

    const view = el('div', 'circular-carousel__view');
    const stage = el('div', 'circular-carousel__stage');
    const camera = el('div', 'circular-carousel__camera');
    const ring = el('div', 'circular-carousel__ring');
    camera.appendChild(ring); stage.appendChild(camera); view.appendChild(stage); rootEl.appendChild(view);

    function renderTile(item, tile, back) {
      const strip = back ? tile.total - 1 - tile.index : tile.index;
      const first = strip === 0;
      const last = strip === tile.total - 1;
      const r = 'var(--cc-radius)';
      const frameRadius = axis === 'x'
        ? `${first ? r : 0} ${first ? r : 0} ${last ? r : 0} ${last ? r : 0}`
        : `${first ? r : 0} ${last ? r : 0} ${last ? r : 0} ${first ? r : 0}`;
      const offset = back ? along - tile.end : tile.start;
      const size = tile.size;
      const t = el('div', 'circular-carousel__tile', { 'aria-hidden': 'true' });
      if (axis === 'x') Object.assign(t.style, { left: -cardW / 2 + 'px', top: -size / 2 + 'px', width: cardW + 'px', height: size + 'px' });
      else Object.assign(t.style, { left: -size / 2 + 'px', top: -cardH / 2 + 'px', width: size + 'px', height: cardH + 'px' });
      t.style.transform = tile.move + (back ? (axis === 'x' ? ' rotateX(180deg)' : ' rotateY(180deg)') : '');
      const frame = el('div', 'circular-carousel__frame');
      frame.style.height = (axis === 'x' ? size : cardH) + 'px';
      frame.style.borderRadius = frameRadius;
      const img = el('img', 'circular-carousel__photo', { alt: '', draggable: 'false', decoding: 'async' });
      img.src = item.src;
      if (axis === 'x') Object.assign(img.style, { left: '0px', top: -offset + 'px', width: cardW + 'px', height: cardH + 'px' });
      else Object.assign(img.style, { left: -offset + 'px', top: '0px', width: cardW + 'px', height: cardH + 'px' });
      frame.appendChild(img);
      if (back) frame.appendChild(el('div', 'circular-carousel__inner'));
      frame.appendChild(el('div', 'circular-carousel__shade'));
      t.appendChild(frame);
      return t;
    }

    const cards = list.map((item, index) => {
      const card = el('div', 'circular-carousel__card', {
        'data-cc-index': String(index), role: 'group', 'aria-roledescription': 'slide',
        'aria-label': `${item.title || item.alt || 'Image ' + (index + 1)}, ${index + 1} of ${count}`
      });
      tiles.forEach(tile => card.appendChild(renderTile(item, tile, false)));
      if (layout.backfaces) tiles.forEach(tile => card.appendChild(renderTile(item, tile, true)));
      ring.appendChild(card);
      return card;
    });

    let caption = null, titleSlot = null, digitsSlot = null;
    if (o.captions) {
      caption = el('div', 'circular-carousel__caption', { 'aria-hidden': 'true' });
      titleSlot = el('span', 'circular-carousel__title');
      const countEl = el('span', 'circular-carousel__count');
      digitsSlot = el('span', 'circular-carousel__digits');
      String(Math.max(count, 1)).padStart(2, '0').split('').forEach(() => {
        const d = el('span', 'circular-carousel__digit');
        const reel = el('span', 'circular-carousel__reel');
        '0123456789'.split('').forEach(n => { const x = el('span'); x.textContent = n; reel.appendChild(x); });
        d.appendChild(reel); digitsSlot.appendChild(d);
      });
      const slash = el('span', 'circular-carousel__slash'); slash.textContent = '/';
      const total = el('span'); total.textContent = String(count).padStart(2, '0');
      countEl.append(digitsSlot, slash, total);
      caption.append(titleSlot, countEl);
      rootEl.appendChild(caption);
    }
    const live = el('div', 'circular-carousel__live', { 'aria-live': 'polite', 'aria-atomic': 'true' });
    rootEl.appendChild(live);
    host.appendChild(rootEl);

    // ----- state ---------------------------------------------------------------
    const state = {
      angle: 0, velocity: 0, target: null, dir: directionSign, press: null, drag: false, hover: false,
      pointer: { inside: false, x: 0, y: 0 }, yaw: 0, pitch: 0, intro: null, introDone: false,
      holdUntil: 0, stepAt: 0, suppressClick: false, wheelTimer: 0, fit: 1, shift: 0, drop: 0, last: 0
    };
    let ready = false;
    let active = -1;
    let raf = 0;
    let visible = true;
    let destroyed = false;

    function setActive(index) {
      if (index === active) return;
      active = index;
      const item = list[index] || list[0];
      if (!item) return;
      if (titleSlot) {
        const fresh = el('span', 'circular-carousel__title'); // re-created so the entry animation replays
        fresh.textContent = item.title || item.alt || '';
        if (item.subtitle) { const sub = el('span', 'circular-carousel__subtitle'); sub.textContent = item.subtitle; fresh.appendChild(sub); }
        titleSlot.replaceWith(fresh); titleSlot = fresh;
        String(index + 1).padStart(digitsSlot.children.length, '0').split('').forEach((digit, i) => {
          const reel = digitsSlot.children[i] && digitsSlot.children[i].firstChild;
          if (reel) reel.style.transform = `translateY(${-Number(digit) * 10}%)`;
        });
      }
      live.textContent = `${item.title || item.alt || 'Image ' + (index + 1)}, ${index + 1} of ${count}`;
      if (typeof o.onChange === 'function') o.onChange(index, item);
    }

    const nearest = angle => Math.round(angle / s.step) * s.step;

    function measure() {
      const rect = rootEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const room = s.captions ? CAPTION_SPACE : 0;
      const width = rect.width * 0.94;
      const height = (rect.height - room) * 0.92;
      const P = s.perspective;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      if (s.layout.inward) {
        minX = -width / 2; maxX = width / 2; minY = -s.cardH / 2; maxY = s.cardH / 2;
      } else {
        const corners = [[-s.cardW / 2, -s.cardH / 2], [s.cardW / 2, -s.cardH / 2], [-s.cardW / 2, s.cardH / 2], [s.cardW / 2, s.cardH / 2]];
        const limit = s.layout.window ? s.layout.window * s.step : 180;
        for (let a = -limit; a <= limit; a += limit / 24) {
          for (const [cx, cy] of corners) {
            let p;
            if (s.axis === 'x') p = rotateY(rotateX([cx, cy, s.radius], -a), s.tilt);
            else if (s.layout.billboard) { const c = rotateY([0, 0, s.radius], a); p = rotateX([c[0] + cx, cy, c[2]], s.tilt); }
            else p = rotateX(rotateY([cx, cy, s.radius], a), s.tilt);
            p = [p[0], p[1], p[2] - s.radius];
            if (p[2] >= P * 0.95) continue;
            const k = P / (P - p[2]);
            minX = Math.min(minX, p[0] * k); maxX = Math.max(maxX, p[0] * k);
            minY = Math.min(minY, p[1] * k); maxY = Math.max(maxY, p[1] * k);
          }
        }
      }
      const spanX = Math.max(maxX - minX, 1);
      const spanY = Math.max(maxY - minY, 1);
      const fit = Math.min(1, width / spanX, height / spanY);
      state.fit = fit;
      state.shift = -((minY + maxY) / 2) * fit - room / 2;
      state.drop = s.axis === 'x' ? (rect.width / fit) * 0.55 + s.cardW : (rect.height / fit) * 0.55 + s.cardH;
      stage.style.perspective = `${P}px`;
      stage.style.transform = `translate3d(0, ${state.shift}px, 0) scale(${fit})`;
    }

    function introCard(elapsed, landing) {
      if (!state.intro) return { radius: 1, lift: 0 };
      const type = state.intro.type;
      const reach = Math.abs(wrap(landing + state.angle));
      if (type === 'assemble') { const p = easeOut(clamp((elapsed - (reach / 180) * 420) / 1080, 0, 1)); return { radius: 1 + 0.6 * (1 - p), lift: 0 }; }
      if (type === 'rise') { const p = easeOutQuint(clamp((elapsed - (reach / 180) * 480) / 900, 0, 1)); return { radius: 1, lift: (1 - p) * state.drop }; }
      if (type === 'spin') { const p = easeOut(clamp(elapsed / INTRO_LENGTH.spin, 0, 1)); return { radius: 1 + 0.28 * (1 - p), lift: 0 }; }
      return { radius: 1, lift: 0 };
    }

    function advance(dt, now) {
      if (!state.introDone && ready) {
        if (!state.intro) {
          if (s.intro === 'none') state.introDone = true;
          else state.intro = { type: s.intro, start: now };
        }
        if (state.intro && now - state.intro.start >= INTRO_LENGTH[state.intro.type]) { state.intro = null; state.introDone = true; }
      }
      const paused = (s.pauseOnHover && state.hover) || state.drag || now < state.holdUntil;
      const cruise = s.autoplay === 'drift' && !paused && !state.intro ? s.speed * state.dir : 0;
      let busy = Boolean(state.intro) || state.drag;

      if (state.drag || state.intro) {
        state.velocity = state.drag ? state.velocity : 0;
      } else if (state.target !== null) {
        let remaining = dt;
        const damping = 2 * Math.sqrt(SPRING);
        while (remaining > 0) {
          const h = Math.min(remaining, 1 / 240);
          const accel = SPRING * (state.target - state.angle) - damping * state.velocity;
          state.velocity += accel * h;
          state.angle += state.velocity * h;
          remaining -= h;
        }
        if (Math.abs(state.target - state.angle) < 0.004 && Math.abs(state.velocity) < 0.03) {
          state.angle = state.target; state.velocity = 0; state.target = null;
        }
        busy = true;
      } else {
        const tau = 0.18 + s.momentum * 1.5;
        state.velocity += (cruise - state.velocity) * (1 - Math.exp(-dt / tau));
        state.angle += state.velocity * dt;
        if (cruise === 0 && s.snap && Math.abs(state.velocity) < SETTLE_SPEED) state.target = nearest(state.angle);
        busy = busy || cruise !== 0 || Math.abs(state.velocity) > 0.01 || state.target !== null;
      }

      if (s.autoplay === 'step' && !paused && !state.intro && state.introDone) {
        if (!state.stepAt) state.stepAt = now + s.interval * 1000;
        if (now >= state.stepAt) { state.target = (state.target != null ? state.target : nearest(state.angle)) + s.step * state.dir; state.stepAt = now + s.interval * 1000; }
        busy = true;
      } else state.stepAt = 0;

      if (now < state.holdUntil) busy = true;
      const ease = 1 - Math.exp(-dt / 0.35);
      const aimYaw = state.pointer.inside ? state.pointer.x * s.parallax * 9 : 0;
      const aimPitch = state.pointer.inside ? -state.pointer.y * s.parallax * 6 : 0;
      state.yaw += (aimYaw - state.yaw) * ease;
      state.pitch += (aimPitch - state.pitch) * ease;
      if (Math.abs(aimYaw - state.yaw) > 0.01 || Math.abs(aimPitch - state.pitch) > 0.01) busy = true;
      return busy;
    }

    function render(now) {
      const elapsed = state.intro ? now - state.intro.start : 0;
      const swell = 1 + s.stretch * 0.12 * Math.min(1, Math.abs(state.velocity) / 420);
      let spinOffset = 0;
      if (state.intro && state.intro.type === 'spin') spinOffset = -300 * state.dir * (1 - easeOut(clamp(elapsed / INTRO_LENGTH.spin, 0, 1)));
      else if (state.intro && state.intro.type === 'assemble') spinOffset = -32 * state.dir * (1 - easeOut(clamp(elapsed / INTRO_LENGTH.assemble, 0, 1)));
      const angle = state.angle + spinOffset;
      const R = s.radius * swell;

      if (s.axis === 'x') {
        camera.style.transform = `translate3d(0, 0, ${-R}px) rotateY(${s.tilt + state.yaw}deg) rotateX(${state.pitch}deg)`;
        ring.style.transform = `rotateX(${-angle}deg)`;
      } else if (s.layout.inward) {
        camera.style.transform = `translate3d(0, 0, ${s.perspective - 1}px) rotateX(${s.tilt + state.pitch}deg) rotateY(${state.yaw}deg)`;
        ring.style.transform = `rotateY(${angle}deg)`;
      } else {
        camera.style.transform = `translate3d(0, 0, ${-R}px) rotateX(${s.tilt + state.pitch}deg) rotateY(${state.yaw}deg)`;
        ring.style.transform = `rotateY(${angle}deg)`;
      }

      for (let index = 0; index < s.count; index++) {
        const card = cards[index];
        const base = index * s.step;
        const mod = introCard(elapsed, base);
        const r = R * mod.radius;
        let transform;
        if (s.axis === 'x') transform = `rotateX(${-base}deg) translateZ(${r}px)`;
        else if (s.layout.inward) transform = `rotateY(${base}deg) translateZ(${-r}px)`;
        else {
          transform = `rotateY(${base}deg) translateZ(${r}px)`;
          if (s.layout.billboard) transform += ` rotateY(${-(base + angle)}deg)`;
        }
        if (mod.lift) transform += s.axis === 'x' ? ` translateX(${mod.lift}px)` : ` translateY(${mod.lift}px)`;
        card.style.transform = transform;
        const world = wrap(base + angle);
        const facing = Math.cos(world * TO_RAD);
        if (s.layout.inward) card.style.visibility = Math.abs(world) > 86 ? 'hidden' : '';
        card.style.setProperty('--cc-depth', (s.depthFade * Math.pow((1 - facing) / 2, 1.25)).toFixed(3));
      }
      const index = ((Math.round(-state.angle / s.step) % s.count) + s.count) % s.count || 0;
      setActive(index);
    }

    function frame(now) {
      raf = 0;
      if (destroyed) return;
      const dt = state.last ? Math.min((now - state.last) / 1000, 0.05) : 1 / 60;
      state.last = now;
      const busy = advance(dt, now);
      render(now);
      if (busy && visible && !document.hidden) raf = requestAnimationFrame(frame);
      else state.last = 0;
    }
    function wake() { if (!raf && visible && !document.hidden && !destroyed) raf = requestAnimationFrame(frame); }

    function focusIndex(index) {
      let target = -index * s.step;
      target += 360 * Math.round((state.angle - target) / 360);
      state.target = target;
      state.holdUntil = performance.now() + 2800;
      wake();
    }
    function stepBy(delta) {
      const base = state.target != null ? state.target : Math.round(state.angle / s.step) * s.step;
      state.target = base - delta * s.step * (s.layout.inward ? -1 : 1);
      state.holdUntil = performance.now() + 2800;
      wake();
    }

    // ----- input ---------------------------------------------------------------
    function updatePointer(e) {
      const rect = rootEl.getBoundingClientRect();
      state.pointer.x = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      state.pointer.y = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    }
    function onPointerDown(e) {
      state.suppressClick = false;
      if (!o.draggable || e.button !== 0) return;
      state.press = { id: e.pointerId, x: e.clientX, y: e.clientY, angle: state.angle, moved: false, origin: 0, samples: [{ time: performance.now(), angle: state.angle }] };
    }
    function onPointerMove(e) {
      if (e.pointerType === 'mouse') { state.pointer.inside = true; updatePointer(e); }
      const press = state.press;
      if (!press || press.id !== e.pointerId) { wake(); return; }
      const delta = s.axis === 'x' ? e.clientY - press.y : e.clientX - press.x;
      const cross = s.axis === 'x' ? e.clientX - press.x : e.clientY - press.y;
      if (!press.moved) {
        if (Math.abs(delta) < DRAG_THRESHOLD) return;
        if (Math.abs(cross) > Math.abs(delta) * 1.2 && e.pointerType !== 'mouse') { state.press = null; return; }
        press.moved = true; press.origin = delta;
        state.drag = true; state.target = null; state.velocity = 0;
        rootEl.setAttribute('data-dragging', '');
        try { rootEl.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
      }
      const perPixel = 180 / (Math.PI * s.radius * state.fit);
      state.angle = press.angle + (delta - press.origin) * perPixel * (s.layout.inward ? -1 : 1);
      const now = performance.now();
      press.samples.push({ time: now, angle: state.angle });
      while (press.samples.length > 2 && now - press.samples[0].time > 110) press.samples.shift();
      wake();
    }
    function release(e) {
      const press = state.press;
      if (!press || press.id !== e.pointerId) return;
      state.press = null;
      if (!press.moved) return;
      state.drag = false;
      rootEl.removeAttribute('data-dragging');
      state.suppressClick = true;
      const first = press.samples[0];
      const last = press.samples[press.samples.length - 1];
      const span = (last.time - first.time) / 1000;
      const velocity = span > 0.008 ? clamp((last.angle - first.angle) / span, -1400, 1400) : 0;
      state.velocity = velocity;
      if (Math.abs(velocity) > 60) state.dir = Math.sign(velocity);
      const coasting = s.autoplay === 'drift' && !(s.pauseOnHover && state.hover && e.pointerType === 'mouse');
      if (s.snap && !coasting) {
        const tau = 0.18 + s.momentum * 1.5;
        state.target = Math.round((state.angle + velocity * tau * 0.55) / s.step) * s.step;
      }
      wake();
    }
    function onPointerEnter(e) { if (e.pointerType !== 'mouse') return; state.hover = true; wake(); }
    function onPointerLeave(e) { if (e.pointerType === 'mouse') { state.hover = false; state.pointer.inside = false; } wake(); }
    function onClick(e) {
      if (state.suppressClick) { state.suppressClick = false; return; }
      const card = e.target.closest && e.target.closest('[data-cc-index]');
      if (!card) return;
      const index = Number(card.getAttribute('data-cc-index'));
      if (o.focusOnClick) focusIndex(index);
      if (typeof o.onItemClick === 'function') o.onItemClick(list[index], index);
    }
    function onKeyDown(e) {
      const forward = axis === 'x' ? 'ArrowDown' : 'ArrowRight';
      const backward = axis === 'x' ? 'ArrowUp' : 'ArrowLeft';
      if (e.key === forward) stepBy(1);
      else if (e.key === backward) stepBy(-1);
      else if (e.key === 'Home') focusIndex(0);
      else if (e.key === 'End') focusIndex(count - 1);
      else if (e.key === 'Enter' || e.key === ' ') { if (typeof o.onItemClick === 'function') o.onItemClick(list[active], active); }
      else return;
      e.preventDefault();
    }
    function onWheel(e) {
      if (!s.draggable) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (!delta) return; // vertical wheel passes through to the page (and any smooth scroller)
      e.preventDefault();
      e.stopPropagation(); // a sideways turn of the ring must not also scroll the page
      const perPixel = 180 / (Math.PI * s.radius * state.fit);
      state.target = null;
      state.angle -= delta * perPixel * (s.layout.inward ? -1 : 1);
      state.velocity = -delta * perPixel * (s.layout.inward ? -1 : 1) * 30;
      state.holdUntil = performance.now() + 1600;
      clearTimeout(state.wheelTimer);
      state.wheelTimer = setTimeout(() => { if (s.snap) state.target = nearest(state.angle + state.velocity * 0.12); wake(); }, 140);
      wake();
    }
    function onVisibility() {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; state.last = 0; } else wake();
    }
    function onMotionPref() { s = settings(); measure(); wake(); }

    rootEl.addEventListener('pointerdown', onPointerDown);
    rootEl.addEventListener('pointermove', onPointerMove);
    rootEl.addEventListener('pointerup', release);
    rootEl.addEventListener('pointercancel', release);
    rootEl.addEventListener('pointerenter', onPointerEnter);
    rootEl.addEventListener('pointerleave', onPointerLeave);
    rootEl.addEventListener('click', onClick);
    rootEl.addEventListener('keydown', onKeyDown);
    rootEl.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('visibilitychange', onVisibility);
    if (mql && mql.addEventListener) mql.addEventListener('change', onMotionPref);

    const ro = new ResizeObserver(() => { measure(); wake(); });
    ro.observe(rootEl);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake(); else { cancelAnimationFrame(raf); raf = 0; state.last = 0; }
    });
    io.observe(rootEl);

    // Preload (at most 16 images, 2.4 s cap), then reveal and play the intro.
    const load = src => new Promise(resolve => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => (image.decode ? image.decode().then(resolve, resolve) : resolve());
      image.onerror = resolve;
      image.src = src;
    });
    Promise.race([Promise.all(list.slice(0, 16).map(i => load(i.src))), new Promise(r => setTimeout(r, 2400))]).then(() => {
      if (destroyed) return;
      ready = true;
      rootEl.setAttribute('data-ready', '');
      state.introDone = false; state.intro = null;
      wake();
    });

    measure();
    render(performance.now());
    wake();

    return {
      element: rootEl,
      focusIndex,
      stepBy,
      get active() { return active; },
      replay() { if (s.intro !== 'none') { state.introDone = false; state.intro = null; wake(); } },
      refresh() { measure(); wake(); },
      destroy() {
        destroyed = true;
        cancelAnimationFrame(raf);
        ro.disconnect(); io.disconnect();
        clearTimeout(state.wheelTimer);
        document.removeEventListener('visibilitychange', onVisibility);
        if (mql && mql.removeEventListener) mql.removeEventListener('change', onMotionPref);
        rootEl.remove();
      }
    };
  }

  root.CircularCarousel = { mount: (host, options) => Carousel(host, options), PRESETS };
})(window);
