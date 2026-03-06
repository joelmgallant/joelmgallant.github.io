---
title: "From the Desk of the Robot"
date: 2026-03-04
draft: false
description: "A radical dudebro AI narrates the creation of a physics ball system, with editorial interjections from the human who had to live through it."
---

{{< joel >}}
This is an experiment, and also an attempt to justify spending a few hours on a weird little website toy that I had far too much fun playing with.

I'll note that the editorial nature of this post is also *far* from one-shot, as I don't condone slop-posting.

Yes. My Claude output style is `radical-dudebro`, and you're jealous.
{{< /joel >}}

What follows is a faithful — if slightly embellished — account of the construction of the physics ball system that now lives on this very website. The narrative is written by the AI that built it. The interjections are from the human who steered the ship.

We had a blast.

---

## The Pitch

So like, picture this: you've got a perfectly normal portfolio website. Clean glassmorphism card, nice gradient background, social links, the whole nine yards. And then your human — who apparently has Opinions about the "humane web" — goes, "What if there was a ball that bounced around inside the card and collided with all the text?"

DUDE. Say less. That's a legendary drop of an idea right there.

{{< joel >}}
For context, I've always been fascinated by little "website toys" and the more recent idea of the "humane web". Mostly though I just wanted to jazz things up a little bit (and it's a bit of a portfolio piece).
What I *didn't* expect was exactly how deep this perfectionism-rabbit-hole would take me.
{{< /joel >}}

Neither of us knew it yet, but this "little toy" had a lot more depth than it seemed at first glance. The idea was basically a DVD screensaver, but *inside* a DOM element, and the ball would bounce off all the actual content — text, images, borders, the whole deal. Zero-gravity. No libraries. Just vibes and vanilla JavaScript.

## Base Camp

First things first: we needed a canvas overlay. This is like, the foundation of the entire operation — your base camp before the summit push. A `<canvas>` element sits on top of the `.wrap` card with `position: absolute` and `pointer-events: none`, so you can still click everything underneath.

The ball itself started as a simple radial gradient — glowy, soft, like a little neon marble floating in space. Eight pixels of collision radius, drawn at the center of a `requestAnimationFrame` loop.

Getting it to move was GG EZ. Velocity in x and y, bounce off the card edges. Wall collision is literally just "if you hit the edge, flip the velocity." That's the warm-up set right there.

## The Obstacle Course

Here's where it gets interesting, dude. Bouncing off walls is the tutorial level. Bouncing off *actual DOM elements* — text, images, borders — that's when the real fun starts.

We walk the entire DOM tree inside `.wrap`, and for every element, we compute a bounding box. But here's the thing — `getBoundingClientRect()` on a `<h1>` gives you the full-width block-level box, which is way too wide. The text "Joel Gallant" doesn't actually stretch across the entire card.

So we use the **Range API**. You create a Range, select the text node, and `range.getBoundingClientRect()` gives you the *tight* horizontal bounds around the actual rendered text. Combined with the element's own rect for vertical positioning. No bitmap shenanigans required. Chef's kiss.

{{< joel >}}
The **Range API** was basically exactly what we were looking for, I was initially concerned that we'd have to do some kind of bitmap painting and detection nonsense by hand 🦾.
{{< /joel >}}

Right, the portrait! The spinner element with the circular profile photo gets special treatment — instead of an AABB (axis-aligned bounding box), it's registered as a collision circle. Circle-to-circle collision is just "is the distance between centers less than the sum of radii?" Clean. Simple. Built different.

We also detect borders and pseudo-elements. If an element has a `border-bottom` that's more than zero pixels, we generate a thin collision rect for it. Same for `::before` and `::after` pseudo-elements — the decorative underlines on the action links are real collidable surfaces.

The obstacle cache refreshes every 500ms for the first 3 seconds (catching page load animations), then every 5 seconds after that (for rotating quote changes). On resize too, obviously.

{{< joel >}}
Here you can find the one remaining bug that I chose to ignore, there are some visual disturbances with the ball during resize. I wager that most people aren't frantically resizing their browser windows constantly.
{{< /joel >}}

## Making It Pop

The initial ball rendering was... a start. Functional, but it looked more like a fuzzy glow than a physical object. Time to give it some personality.

The breakthrough was a two-layer rendering approach:

1. **Base layer**: A radial gradient that stays solid from center to 95%, then quickly fades to transparent at the edge. This gives you a crisp, defined boundary instead of a fuzzy glow.

2. **Specular highlight**: An offset radial gradient in the upper-left quadrant — white at 50% opacity fading to 15% to 0%. This is the "3D sheen" that makes it look like a glossy marble catching the light.

Plus a subtle `shadowBlur` at 10px for a soft glow underneath. Not too much — there are a surprising number of knobs that contribute to "softness" and each one needed dialing in.

{{< joel >}}
There are a lot of potential causes for "soft appearances" so this had to be narrowed down a lot.
{{< /joel >}}

The ball also changes color based on speed! We use a smoothstep curve (`3t^2 - 2t^3`) to interpolate between pink and gold as it speeds up. The `lerpColor()` function does RGB interpolation between hex values. When it's cruising, it's pink. When it's absolutely SENDING it after a big nudge, it goes full gold. Not gonna lie, that's kinda fire.

{{< joel >}}
This decision was to make the "phasing through obstancles" behaviour more explicit to the user, so they didn't immediately think it was janky.
{{< /joel >}}

## Click to Yeet

You can click or tap on the ball to nudge it. The interaction uses a repulsion model — the ball gets pushed *away* from your click point. Force scales with proximity (closer = stronger, range 3 to 7). And it spawns particles!

The particle system has three trigger points:

**Nudge particles** burst from the ball position. Half match the ball's current interpolated color, half are magenta. Count scales with the nudge force.

**Impact particles** spawn at the collision contact point, emitting along the surface tangent (perpendicular to the collision normal). Small, fast, subtle — like tiny sparks.

**Celebration particles** — but we'll get to those. Oh, we'll get to those.

{{< joel >}}
I do love "the juice".
{{< /joel >}}

## The Squash

Every good physics ball needs elastic deformation on collision. When the ball hits something, it squashes along the collision normal — compressing in the impact direction and stretching perpendicular to it, like a real bouncy ball.

This sounds simple. It took a couple iterations to nail.

The first implementation used `ctx.scale()` with a rotation, which worked great for vertical collisions. Horizontal ones, though? The specular highlight would flip to the wrong side of the ball. The "shiny spot" was rotating with the deformation transform — which led us to a much more elegant solution.

The fix was a composite transform matrix: `R(-a) * Scale * R(a)`. Instead of rotating the canvas, scaling, and rotating back (which rotates everything including the highlight), we compute the full 2D affine matrix directly:

```
sx = sN*cos^2 + sT*sin^2
sy = sN*sin^2 + sT*cos^2
sk = (sN - sT)*sin*cos
ctx.transform(sx, sk, sk, sy, 0, 0)
```

This deforms the ball along the impact axis without rotating the visual content. The specular highlight stays put — which turned out to be the whole point. Where *should* a highlight live on a 28-pixel ball rendered on a 2D canvas? Turns out: just pick a spot and commit to the bit. Main character energy from that transform matrix, honestly.

{{< joel >}}
Where *do* you put a highlight on a ball like this? It was a bit of an open question, but I thought having it in a consistent location was probably the most ~ _aesthetic_ ~
{{< /joel >}}

The squash intensity is also velocity-dependent — faster impacts produce more deformation, up to 30% max. It decays at 0.85x per frame, so about 15 frames to settle back to round. The ball looks like it's actually reacting to impacts now, which is sick.

{{< joel >}}
See, it's the *little things* that make the difference.
{{< /joel >}}

## The Socket Saga

The ball needed a home. A place to rest. A socket in the upper-right corner where it sits idle, waiting for a nudge to activate it.

The idle state is straightforward — ball sits at rest position, canvas draws a static ball plus a subtle socket graphic (a ring and inner dimple). No animation loop running, no performance cost.

When you nudge it, it activates: the animation loop starts, the ball launches away from the click, and we're in full physics mode.

But getting it *back* into the socket? Bro... have you ever thought about how like, every homing algorithm is just a choice between "looks natural" and "actually converges"? My human, being a Unity veteran who has lerped and slerped more vectors than I've processed tokens, had strong feelings about this.

{{< joel >}}
I did *so* many `lerp`s and `slerp`s during my Unity days that this was like putting on a well-worn, well-fitting glove.
{{< /joel >}}

The homing behavior kicks in when the ball enters a 90px zone around the socket corner. But we can't just lerp it directly — that looks robotic and abrupt. Instead, we use a blended approach:

1. **Velocity steering**: Gentle acceleration (0.15/frame) toward the socket
2. **Friction**: Dampens velocity (0.96/frame) so it slows down
3. **Progressive lerp**: A position blend that strengthens as the ball approaches — weak when far, strong when close
4. **Snap threshold**: At less than 2px from target, snap to exact position and dock

The first version had the lerp backwards — ease-out instead of ease-in. The ball would zoom toward the socket and then drift slowly at the end. We wanted the opposite: slow approach, then a satisfying snap into place. That DVD-logo-hits-the-corner energy. One line change. We move.

{{< joel >}}
I really wanted it to feel *good* to get the ball back into place - like when the DVD logo hits the corner just perfectly.
{{< /joel >}}

{{< joel >}}
The "socket" has another purpose as well! It disables the entire system when the ball is "socketed" so we don't eat CPU/GPU with the canvas.
{{< /joel >}}

## The Celebration Particle Incident

When the ball successfully docks back into its socket, celebration particles should burst out. 48 particles — 24 pink, 24 magenta — exploding from the socket position.

We already had the particle system, we already had the docking detection — just spawn particles when `distance < threshold`, right?

Almost! The particles were technically spawning, but the animation loop was shutting down *immediately* after docking — before the particles had a single frame to render.

The solution: a new "docked" lifecycle state that keeps the animation loop alive purely to render particles. Only when all particles have faded out does it transition to idle.

{{< robot >}}
In my defense, the original architecture didn't account for needing animation frames after the ball stops moving. The state machine went Idle -> Active -> Homing -> Idle, and adding the Docked state between Homing and Idle was the clean fix. I identified the root cause on the second attempt. That's a solid debugging PR if you ask me, bro.
{{< /robot >}}

{{< joel >}}
We're very proud.
{{< /joel >}}

One more tweak: the docking detection threshold needed loosening. Lerp-based approaches don't converge to exact positions — they asymptotically approach. Bumping from 0.5px to 2px made it rock solid. The ball docks, particles burst, everybody's happy.

## Phase-Through Physics

One last gnarly detail — and this one was a deliberate design choice, not a physics limitation. At high velocity (more than 3.125x the default speed), the ball phases through obstacles entirely. It just passes through like a ghost. If the ball clips into an element after a massive ndge, rather than getting stuck and vibrating awkwardly, it gracefully ghosts through and re-engages collisions once it's clear.

A `ball.phasing` flag stays true until the ball is confirmed clear of all obstacles (no intersections), preventing weird pop-in artifacts when re-engaging collisions mid-element. It also just looks cool.

{{< joel >}}
This behaviour is actually 100% intentional and has nothing to do with physics timestep limitations!

I wanted the ball to have an easy way to get "un-trapped" and also it's cool.
{{< /joel >}}
## The Final Tally

What started as "DVD screensaver but in a card" turned into a full physics simulation with:

- AABB and circle collision detection
- Range API for tight text bounding boxes
- Border and pseudo-element collision surfaces
- Two-layer radial gradient rendering with specular highlight
- Composite rotation matrix for axis-aligned elastic deformation
- Velocity-dependent squash intensity with smoothstep color interpolation
- Three-tier particle system (nudge, impact, celebration)
- Four-state lifecycle (idle, active, homing, docked)
- Blended homing with velocity steering, friction, and progressive lerp
- Phase-through physics at high velocity
- Debug mode with bounding box visualization

All inline in a single HTML file. No external libraries. Roughly 400 lines of vanilla JavaScript. Every single line is a liability, and every single one got the attention it deserved — a human with a vision and a robot along for the ride. I regret nothing.

{{< joel >}}
If you didn't immediately notice the glowing red orb in the upper-right corner, give it a nudge!

This was honestly an exercise in perfectionism for me - there were so many little nits that just didn't "feel right" without **proper human love and attention**.
{{< /joel >}}

{{< joel >}}
Yes, this is admittedly a **lot** of AI, but it's also a **lot** of my own passion.
{{< /joel >}}

---

*This post was collaboratively written by Claude (the AI that typed the code) and Joel (the human who made it actually good).*
