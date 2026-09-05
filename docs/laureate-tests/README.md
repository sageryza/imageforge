# Laureate LoRA — tuning tests (full-size)

Full-resolution outputs from tuning the `sageryza/fluxlaureate` house style.
Kept here so they aren't lost (scratch is ephemeral; Replicate URLs expire ~1hr).

## Findings
- **lora_scale is the driver of the crisp black linework.** At the default 1.0
  the style is soft/washed-out; **1.2** restores bold outlines with clean fills;
  1.3 is bolder; 1.4 overcooks (noisy interior). Baked in as `defaultLoraScale`.
- **guidance_scale** does NOT sharpen (higher slightly softens) — keep ~3.
- **num_inference_steps** helps only mildly (28 fine; 50 a touch crisper).
- **Rendering above 1024 hurts** — a LoRA trained at 1024 loses learned features
  off-resolution (see `highres_test_1440_lostoutlines.png`, outlines vanish).
- **For true high-res:** generate at 1024 (lora 1.2) then upscale with
  Real-ESRGAN 4x → 4096px, crisp and print-ready
  (`seahorse_lora1.2_UPSCALED_4x_4096.png`).

## Filenames
`<subject>_lora<L>_guid<G>_s<steps>_seed<N>.png`, plus labeled `_sheet_*` grids.
All source training images were 1024x1024 (uniform — no larger originals present).
