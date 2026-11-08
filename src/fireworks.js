const PALETTES = [
  ['#76ffe0', '#ef72ff', '#8a9fff', '#ffe58b'],
  ['#fff6d8', '#ffd390', '#ffb45e'],
  ['#ffd9d1', '#f4a8b9', '#eac4ff'],
];

export function createBurst(x, y, radius, style, random = Math.random) {
  const palette = PALETTES[style];
  return Array.from({ length: style === 2 ? 140 : 110 }, (_, index) => {
    const angle = index / (style === 2 ? 140 : 110) * Math.PI * 2 + random() * .035;
    const speed = radius * (.65 + random() * .55);
    return {
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 2.3 + random() * 1.2, age: 0,
      color: palette[index % palette.length],
      gravity: style === 2 ? 46 : 25,
      drag: style === 2 ? .65 : .85,
      size: .8 + random() * 1.1,
      shimmer: random() * Math.PI * 2,
      trail: [{ x, y }],
    };
  });
}

export function advanceParticle(particle, dt) {
  particle.age += dt;
  const damping = Math.exp(-particle.drag * dt);
  particle.vx *= damping;
  particle.vy = particle.vy * damping + particle.gravity * dt;
  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
  particle.trail.push({ x: particle.x, y: particle.y });
  if (particle.trail.length > 28) particle.trail.shift();
  return particle.age < particle.life;
}

export function playFireworks(canvas, barrels, onComplete = () => {}, { onLaunch = () => {}, onBurst = () => {} } = {}) {
  const context = canvas.getContext('2d');
  if (!context) {
    onComplete();
    return () => {};
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width;
  let height;
  let origins;
  let particles = [];
  let frame;
  let previous;
  let elapsed = 0;
  const fired = new Set();
  const launched = new Set();

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    origins = [...barrels].map((barrel) => {
      const rect = barrel.getBoundingClientRect();
      return { x: rect.left + rect.width / 2 - bounds.left, y: rect.top - bounds.top + 8 };
    });
    // Existing trails belong to the old viewport. Restart their positions, not the show.
    particles = [];
  }

  function destination(index) {
    return { x: width * [.24, .52, .76][index], y: height * [.37, .28, .4][index] };
  }

  function drawParticle(particle) {
    const fade = Math.pow(Math.max(0, 1 - particle.age / particle.life), .65);
    const twinkle = .65 + .35 * Math.sin(particle.age * 23 + particle.shimmer) ** 2;
    context.strokeStyle = particle.color;
    context.lineWidth = particle.size * .7;
    const trail = particle.trail;
    // Short fading segments leave separate glittering embers behind each bright tip.
    for (let index = 1; index < trail.length; index += 3) {
      const end = trail[Math.min(index + 2, trail.length - 1)];
      context.globalAlpha = fade * index / trail.length * .65;
      context.beginPath();
      context.moveTo(trail[index - 1].x, trail[index - 1].y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }
    context.globalAlpha = fade * twinkle;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = fade * .15;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2);
    context.fill();
  }

  function flash(x, y, age) {
    if (age < 0 || age > .3) return;
    const glow = context.createRadialGradient(x, y, 0, x, y, 45);
    glow.addColorStop(0, '#fffdf0');
    glow.addColorStop(.12, '#ffe9b3');
    glow.addColorStop(1, 'transparent');
    context.globalAlpha = (1 - age / .3) * .85;
    context.fillStyle = glow;
    context.fillRect(x - 45, y - 45, 90, 90);
  }

  function drawRocket(origin, target, progress) {
    const position = (t) => ({
      x: origin.x + (target.x - origin.x) * t,
      y: origin.y + (target.y - origin.y) * (1 - (1 - t) ** 1.6),
    });
    const tip = position(progress);
    const tail = position(Math.max(0, progress - .14));
    const gradient = context.createLinearGradient(tail.x, tail.y, tip.x, tip.y);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(.7, '#ffae53');
    gradient.addColorStop(1, '#fffbea');
    context.globalAlpha = 1;
    context.strokeStyle = gradient;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(tail.x, tail.y);
    context.lineTo(tip.x, tip.y);
    context.stroke();
    flash(tip.x, tip.y, .25);
  }

  function drawStatic() {
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
    for (let index = 0; index < 3; index += 1) {
      const target = destination(index);
      const burst = createBurst(target.x, target.y, Math.min(width * .3, height * .25, 220), index);
      burst.forEach((particle) => {
        for (let step = 0; step < 42; step += 1) advanceParticle(particle, 1 / 60);
        drawParticle(particle);
      });
    }
    context.globalAlpha = 1;
  }

  function cleanup() {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pagehide', stop);
  }

  function stop() {
    window.cancelAnimationFrame(frame);
    cleanup();
    context.clearRect(0, 0, width, height);
  }

  function onResize() {
    resize();
    if (reducedMotion) drawStatic();
  }

  function animate(now) {
    const dt = previous === undefined ? 0 : Math.min((now - previous) / 1000, .05);
    previous = now;
    elapsed += dt;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';

    for (let index = 0; index < 3; index += 1) {
      const flight = elapsed - index * .95;
      const target = destination(index);
      if (flight >= 0 && !launched.has(index)) {
        launched.add(index);
        onLaunch(index);
      }
      if (flight >= 0 && flight < 1.15) drawRocket(origins[index], target, flight / 1.15);
      if (flight >= 1.15 && !fired.has(index)) {
        fired.add(index);
        onBurst(index);
        particles.push(...createBurst(target.x, target.y, Math.min(width * .3, height * .25, 220), index));
      }
      flash(target.x, target.y, flight - 1.15);
    }

    particles = particles.filter((particle) => advanceParticle(particle, dt));
    particles.forEach(drawParticle);
    context.globalAlpha = 1;
    if (elapsed < 3.1 || particles.length) frame = window.requestAnimationFrame(animate);
    else {
      cleanup();
      onComplete();
    }
  }

  resize();
  window.addEventListener('resize', onResize);
  window.addEventListener('pagehide', stop);
  if (reducedMotion) {
    drawStatic();
    onBurst(0); // One gentle burst for the static display, never replayed by resize.
    onComplete();
  } else frame = window.requestAnimationFrame(animate);
  return stop;
}
