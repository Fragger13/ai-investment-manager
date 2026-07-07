# Publishing this article to Medium

Everything you need is in this folder:

- `askpapa-article.md` — the article text with image markers.
- `images/` — 5 app screenshots, the single architecture diagram, hero art, and Papa.
- `diagrams/architecture.mmd` — editable Mermaid source for the diagram. Re-render with:
  `npx -y @mermaid-js/mermaid-cli -i diagrams/architecture.mmd -o images/diagram-architecture.png -b white -w 1700 --scale 2`

## Steps

1. Go to medium.com → your avatar → **Write**.
2. Paste the article text section by section (Medium handles headings, bold, and lists when pasted from a rendered Markdown preview; from raw text you may need to re-apply `##` headings with Medium's `T` toolbar).
3. At every `![...](images/...)` marker, delete the marker line and insert the matching image with the `+` button → image. Order of appearance:

   | # | File | Where it goes |
   |---|------|----------------|
   | 1 | `images/hero.png` | Directly under the subtitle (also the cover) |
   | 2 | `images/papa-laugh.png` | End of "Why I built this" |
   | 3 | `images/dashboard.jpg` | Top of "The look and feel" |
   | 4 | `images/goals.jpg` | After "Every goal gets a reality check" |
   | 5 | `images/plan.jpg` | After "Three actions a month" |
   | 6 | `images/discover.jpg` | After "Reasons on every card" |
   | 7 | `images/portfolio.jpg` | After "The whole picture in one place" |
   | 8 | `images/diagram-architecture.png` | "How I built it", after the free tier list |

4. Add captions to the screenshots (Medium shows them small and grey), e.g. "The dashboard: one screen, a verdict, and a plan."
5. Title and subtitle are the first two lines of the article. Set the **cover image** to `hero.png` (or `dashboard.jpg` if you prefer a product shot in previews).

## Suggested metadata

- **Tags** (Medium allows 5): `Personal Finance`, `Artificial Intelligence`, `Side Project`, `Gen Z`, `India`
- **Publications worth submitting to**: Level Up Coding, ILLUMINATION, The Startup — any accepts increases reach substantially vs self publish.
- **SEO title** (Settings → SEO): "How I Built AskPapa, an AI Money Mentor for Gen Z India, on a Free Tier Stack"

## Before you hit publish

- The screenshots use synthetic persona data (Priya Nair, Rohit Malhotra, etc.) — safe to publish. They show the older "Your money buddy" tagline in the sidebar; recapture later if you want current branding.
- Nothing in the article exposes scoring weights, prompts, secrets, server addresses, or key derivation details. Keep it that way if you edit.
- Read the article once out loud. Anything that does not sound like you, change.
