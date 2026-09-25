# Photo brief — landing page bento tiles

The landing page holds six photo slots (`components/PhotoTile.tsx`). Until real
photography arrives each slot renders a flat tone, a hard-edged disc and a line
glyph. To fill a slot, add the image under `public/assets/photos/` and pass
`src` and `alt` to the matching entry in `app/page.tsx`; nothing else changes.

## Slots

| Slot (`data-photo`) | Mode | Tile | What the shot shows |
|---|---|---|---|
| `patient-sofa-phone` | Patient | tall, lime-wash | An adult at home on a sofa, unwell but calm, holding a phone. Soft daylight. |
| `patient-video-call` | Patient | short, stone | Over-the-shoulder: a phone or laptop showing a video call. The doctor on screen is out of focus or cropped out. |
| `patient-home` | Patient | short, sage | A detail of a calm home: a mug, a blanket, a window. No people needed. |
| `gp-home-laptop` | GP | tall, lime-wash | A GP working from home at a laptop, headset on, in a bright room. |
| `gp-video-consult` | GP | short, sage | Hands and a laptop mid-consultation; the patient on screen is not identifiable. |
| `gp-notes` | GP | short, stone | A desk detail: notebook, coffee, laptop edge. No people needed. |

Crop for the tile: the tall tiles are roughly 3:4 at desktop and square on a
phone; the short tiles are roughly 4:3. Keep the subject clear of the top-left
corner, where the placeholder glyph sits today.

## Rules the photographs must keep

- **Nothing may pass for a real Dr Quick GP or patient.** Use models under a
  licence that permits health-service advertising, and never caption a person
  with a name, a role at Dr Quick or a quote. There are no named GPs, no
  headcount and no testimonials (`PRODUCT.md`, "Absences").
- **No medicine on screen.** No packs, blister strips or labelled bottles:
  naming or showing prescription-only medicine in advertising is illegal.
- **No CQC, NHS or clinical branding** in shot: no lanyards, logos, NHS blue
  or green uniforms.
- **England only.** No recognisable Scottish, Welsh or Northern Irish settings.
- **No urgency.** No clocks, countdowns or queues. Calm, unhurried light.
- Colour grade warm and natural so the photos sit with the lime, stone and
  sage tiles. No filters that add gradients or glows.
