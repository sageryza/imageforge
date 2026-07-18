# Gold orrery — the ORIGINAL astrology loading animation (saved on request)

Sophie liked the black wheel-of-fortune version but wanted to keep this gold
full-circle orrery around in case we come back to it. This is the exact code
that lived in `public/witch.html` before the "rising black wheel" replacement.

## CSS (was in the `<style>` block)

```css
/* Orrery — the astrology loading wheel (planet glyphs turning on a ring) */
.orrery { width: 124px; height: 124px; margin: 10px auto 16px; position: relative; }
.orrery .ring { position: absolute; inset: 0; border-radius: 50%; border: 1px solid var(--border); animation: wheel-spin 14s linear infinite; }
.orrery .ring.inner { inset: 22px; border-style: dashed; border-color: var(--border-soft); animation: wheel-spin 20s linear infinite reverse; }
.orrery .planet { position: absolute; top: 50%; left: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; line-height: 22px; text-align: center; font-size: 15px; color: var(--gold); transform: rotate(var(--a)) translateY(-56px) rotate(calc(-1 * var(--a))); }
.orrery .core { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 16px; color: var(--gold-dim); }
@keyframes wheel-spin { to { transform: rotate(360deg); } }
```

## HTML (was injected by `setAstroLoading()`)

```html
<div class="orrery" role="img" aria-label="Consulting the sky">
  <div class="ring">
    <span class="planet" style="--a:0deg">☉</span>
    <span class="planet" style="--a:51deg">☽</span>
    <span class="planet" style="--a:103deg">☿</span>
    <span class="planet" style="--a:154deg">♀</span>
    <span class="planet" style="--a:206deg">♂</span>
    <span class="planet" style="--a:257deg">♃</span>
    <span class="planet" style="--a:309deg">♄</span>
  </div>
  <div class="ring inner"></div>
  <div class="core">✦</div>
</div>
<div style="text-align:center; font-size:13px; color:var(--text-dim); font-style:italic;">Reading the sky for you…</div>
```
