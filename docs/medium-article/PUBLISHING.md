# Publishing this article to Medium

Everything you need is in this folder:

- `askpapa-article.md` — the article text with image markers.
- `images/` — one onboarding shot, a six-panel product collage (`collage-product.jpg`), the architecture diagram, hero art, and Papa.
- `images/diagram-architecture.png` — the current architecture diagram (exported image, "the quant decides, the LLM explains"). The older Mermaid source in `diagrams/architecture.mmd` and its `diagram-architecture.svg` / `@2x.png` renders are superseded; safe to delete.

## Steps

1. Go to medium.com → your avatar → **Write**.
2. Paste the article text section by section (Medium handles headings, bold, and lists when pasted from a rendered Markdown preview; from raw text you may need to re-apply `##` headings with Medium's `T` toolbar).
3. At every `![...](images/...)` marker, delete the marker line and insert the matching image with the `+` button → image. Order of appearance:

   | # | File | Where it goes |
   |---|------|----------------|
   | 1 | `images/hero.png` | Directly under the subtitle (also the cover) |
   | 2 | `images/papa-laugh.png` | End of "Why I built this" |
   | 3 | `images/onboarding.jpg` | Top of "The look and feel", after the opening line |
   | 4 | `images/collage-product.jpg` | After "not a single candlestick chart in sight", before the per-screen blurbs |
   | 5 | `images/diagram-architecture.png` | "How I built it", after the free tier list |

4. Add captions (Medium shows them small and grey), e.g. "Onboarding is an interview, not a form." and "Six screens, one personality." for the collage.
5. Title and subtitle are the first two lines of the article. Set the **cover image** to `hero.png` (or `collage-product.jpg` if you prefer a product shot in previews).

## Suggested metadata

- **Tags** (Medium allows 5): `Personal Finance`, `Artificial Intelligence`, `Side Project`, `Gen Z`, `India`
- **Publications worth submitting to**: Level Up Coding, ILLUMINATION, The Startup — any accepts increases reach substantially vs self publish.
- **SEO title** (Settings → SEO): "How I Built AskPapa, an AI Money Mentor for Gen Z India, on a Free Tier Stack"

## Before you hit publish

- Every screenshot in the article uses synthetic persona data (Aditi Nair) and current branding, freshly captured, so the whole set is consistent and safe to publish.
- Nothing in the article exposes scoring weights, prompts, secrets, server addresses, or key derivation details. Keep it that way if you edit.
- Read the article once out loud. Anything that does not sound like you, change.
