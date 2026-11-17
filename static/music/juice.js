const SWELL = 1.35;
const PULSE_MS = 600;

export function stepSpring(spring, target, dt, stiffness = 170, damping = 14) {
  const force = -stiffness * (spring.value - target) - damping * spring.velocity;
  const velocity = spring.velocity + force * dt;
  return { value: spring.value + velocity * dt, velocity };
}

export function isSettled(spring, target, epsilon = 0.01) {
  return Math.abs(spring.value - target) < epsilon && Math.abs(spring.velocity) < epsilon;
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function lerpCamera(from, to, t) {
  if (t >= 1) return { ...to };
  const eased = easeInOutCubic(t);
  return {
    ...from,
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    scale: from.scale * (to.scale / from.scale) ** eased,
  };
}

export function createJuice({ reducedMotion = false } = {}) {
  const offsets = new Map();
  const swells = new Map();
  const pulses = [];
  let hoveredId = null;
  const swellTarget = (id) => (id === hoveredId ? SWELL : 1);

  return {
    reducedMotion,
    hover(id) {
      if (id === hoveredId) return;
      hoveredId = id;
      if (id && !swells.has(id)) swells.set(id, { value: 1, velocity: 0 });
    },
    poke(node, neighbours) {
      if (reducedMotion) return;
      for (const { node: other, weight } of neighbours) {
        const dx = other.x - node.x;
        const dy = other.y - node.y;
        const distance = Math.hypot(dx, dy) || 1;
        const kick = 260 * (0.3 + weight);
        const offset = offsets.get(other.id) || { x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 } };
        offset.x.velocity += (dx / distance) * kick;
        offset.y.velocity += (dy / distance) * kick;
        offsets.set(other.id, offset);
      }
    },
    pulse(x, y, now) {
      if (!reducedMotion) pulses.push({ x, y, start: now });
    },
    offset(id) {
      const offset = offsets.get(id);
      return offset ? [offset.x.value, offset.y.value] : [0, 0];
    },
    scale(id) {
      if (reducedMotion) return swellTarget(id);
      return swells.get(id)?.value ?? 1;
    },
    activePulses(now) {
      return pulses.filter((pulse) => now - pulse.start < PULSE_MS).map((pulse) => ({ x: pulse.x, y: pulse.y, progress: (now - pulse.start) / PULSE_MS }));
    },
    step(dt, now) {
      if (reducedMotion) return false;
      let moving = false;
      for (const [id, offset] of offsets) {
        offset.x = stepSpring(offset.x, 0, dt);
        offset.y = stepSpring(offset.y, 0, dt);
        if (isSettled(offset.x, 0) && isSettled(offset.y, 0)) offsets.delete(id);
        else moving = true;
      }
      for (const [id, spring] of swells) {
        const target = swellTarget(id);
        const next = stepSpring(spring, target, dt, 300, 18);
        if (!isSettled(next, target)) {
          swells.set(id, next);
          moving = true;
        } else if (target === 1) swells.delete(id);
        else swells.set(id, { value: target, velocity: 0 });
      }
      while (pulses.length && now - pulses[0].start >= PULSE_MS) pulses.shift();
      return moving || pulses.length > 0;
    },
  };
}
