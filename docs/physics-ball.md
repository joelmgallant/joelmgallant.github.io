# Physics Ball System

An interactive physics ball that lives inside the `.wrap` glassmorphism card on the homepage. It bounces off DOM element bounding boxes in zero-gravity DVD-screensaver style, with click-to-nudge interaction and a docking socket.

All code is inline in `layouts/index.html` — no external libraries. Vanilla JS + Canvas 2D API.

---

## Architecture

A `<canvas id="physics-canvas">` overlays the `.wrap` card with `position: absolute` and `pointer-events: none`. A single `requestAnimationFrame` loop handles movement, collision detection, and rendering. Click/touch events are captured on `.wrap` (not the canvas) so interactive elements beneath remain clickable.

### Ball State

```
ball.x, ball.y         — position (logical CSS pixels)
ball.vx, ball.vy       — velocity
ball.radius            — collision radius (8px)
ball.drawRadius        — visual radius (14px, larger than collision)
ball.squash            — elastic deformation amount (0-1)
ball.squashAngle       — angle of collision normal for squash alignment
ball.color             — base color (#e73c7e, pink)
ball.phasing           — whether ball is passing through obstacles
ball.debug             — toggle debug bounding box rendering
```

### Lifecycle States

1. **Idle** — Ball sits in upper-right socket, stationary. Canvas shows static ball + socket graphic. No animation loop running.
2. **Active** — Animation loop running. Ball moves, collides, renders each frame.
3. **Homing** — Ball steers back toward socket with blended velocity/lerp. Triggered by entering the corner zone (90px).
4. **Docked** — Ball has reached socket. Celebration particles render. Loop continues until particles fade, then returns to Idle.

Transitions: Idle -> Active (nudge) -> Homing (corner zone) -> Docked (arrival) -> Idle (particles done). Nudge at any point resets to Active.

---

## Collision Detection

### Obstacle Caching

`cacheObstacleRects()` recursively walks the DOM inside `.wrap`, building two arrays:

- `obstacleRects[]` — AABB rectangles for text, borders, pseudo-elements
- `obstacleCircles[]` — circles for the portrait `.spinner` element

Rects are cached in canvas-relative coordinates (offset from `.wrap`'s bounding rect). Recaching happens:
- Every 500ms for the first 3 seconds (to catch page load animations)
- Every 5 seconds thereafter (for rotating quote changes)
- On window resize

### Tight Bounding Boxes

Text elements use the **Range API** (`range.getBoundingClientRect()`) for horizontal tightness around actual text content, combined with the element's own `getBoundingClientRect()` for vertical positioning. This avoids the full-width block-level boxes that `getBoundingClientRect()` alone returns.

### Border and Pseudo-Element Detection

- `getComputedStyle()` parses border widths; borders > 0 generate thin collision rects (min 3px thickness)
- `::before` and `::after` pseudo-elements are detected including `content: ""` (common for decorative lines)
- Elements inside `.portrait` skip border/pseudo detection (the circle collision handles it)

### Collision Types

**Wall collision** — Ball bounces off canvas edges (card boundaries). Simple axis reflection.

**AABB collision** — Closest-point-on-rect to ball center. Reflects on whichever axis has less overlap. Pushes ball out of the rect.

**Circle collision** — Distance between centers vs sum of radii. Reflects velocity along the collision normal. Used for the portrait image.

### Phase-Through

At high velocity (> 3.125x default speed), the ball phases through obstacles. A `ball.phasing` flag stays true until the ball is confirmed clear of all obstacles (no intersections), preventing the ball from "popping" when re-engaging collisions mid-element.

---

## Rendering

### Ball Appearance

Two-layer radial gradient drawn with canvas transform for elastic deformation:

1. **Base layer** — Solid color gradient (activeColor from center to 95%, then fade to transparent at edge)
2. **Specular highlight** — Offset upper-left radial gradient (white, 50% -> 15% -> 0% opacity) for 3D sheen

Shadow glow: `shadowBlur: 10` with `shadowColor` matching the active color.

### Color Interpolation

Ball color transitions from pink (`#e73c7e`) to yellow (`#FFD700`) based on speed, using a smoothstep curve (`3t^2 - 2t^3`) for smooth ease-in/ease-out. The `lerpColor()` function interpolates between hex colors in RGB space.

### Elastic Squash/Stretch

On collision, `ball.squash` is set proportional to velocity (higher speed = more deformation, max 30%). The squash aligns to the collision normal using a rotation matrix (`R(-a) * Scale * R(a)`) that deforms along the impact axis without rotating the ball's visual content (specular highlight stays in place).

Decay: `ball.squash *= 0.85` per frame (~15 frames to settle).

---

## Particle System

A shared `particles[]` array with three spawn triggers:

### Nudge Particles
Spawned at ball position on click/tap. Half use the ball's current interpolated color, half are magenta (`#FF00FF`). Count scales with nudge force (8 + floor(force)).

### Impact Particles
Spawned at the collision contact point. Emitted along the surface tangent (perpendicular to collision normal) with spread. Small (1-2.5px), fast decay. 3-5 per impact.

### Celebration Particles
48 particles (24 pink + 24 magenta) burst from the socket position when the ball docks. The animation loop continues until all particles fade out before fully deactivating.

### Particle Properties
```
x, y       — position
vx, vy     — velocity (friction: 0.98/frame)
life       — 1.0 -> 0.0 (dies at 0)
decay      — life reduction per frame (0.015-0.035)
radius     — visual size, scales with life
color      — fill and shadow color
```

---

## Socket System

### Socket Graphic
A subtle ring (1.5px stroke, 15% opacity) and inner radial gradient dimple drawn at the rest position. Always visible when the canvas is rendering.

### Rest Position
Upper-right corner: `(wrap.offsetWidth - drawRadius - 20, drawRadius + 20)`. Updates on window resize. If the ball is idle during resize, it snaps to the new position.

### Homing Behavior
When the ball enters the 90px corner zone (with a 500ms grace period after nudges):
1. Velocity steers toward socket with gentle acceleration (0.15/frame)
2. Friction dampens velocity (0.96/frame)
3. A lerp blend strengthens as the ball approaches (0 far -> 20% close)
4. At < 2px from rest position, ball snaps to exact position and docks

---

## Interaction

### Click/Tap Nudge
Listener on `.wrap` (not canvas). If click is within 5x ball radius: repels ball away from click point. Force scales with proximity (closer = stronger, range 3-7).

### Debug Keys
- `d` — Toggle debug bounding box/circle rendering
- `h` — Force homing (ball returns to socket immediately)

---

## DOM Structure Reference

The `.wrap` div (in `layouts/_default/baseof.html`) is the glassmorphism card container. Child elements serving as collision obstacles:

- `section.profile` > `.portrait` > `.spinner` (circular collision), `h1.name`, `h2.title`, `span.bio`
- `div.stats-section` > `.stats-container` > `.stat-item` (x4)
- Tagline `div` > `p` label + `p.tagline`
- `section.contacts` (social icons)
- `section.actions` (CV/Blog links) — includes `::after` pseudo-element underlines

---

## CSS

```css
.wrap { position: relative; }

#physics-canvas {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 10;
  border-radius: 20px;
}
```
