# Landing-page assets

Drop the following files in this directory. The new landing page (`app/page.tsx`) references them directly:

| File | Used for | Notes |
| --- | --- | --- |
| `hero.png` | Family / tablet illustration on the right side of the hero | Rounded 4:3 frame in layout. PNG, JPG, or WebP all fine. Recommended ≥ 1200×900. |
| `avatar.png` | Small circular avatar next to the "AskPapa" wordmark in the header | Square crop. Recommended ≥ 160×160. |

If you'd prefer SVGs, just name them `hero.svg` / `avatar.svg` and update the two `<img>` tags in `app/page.tsx` to match.
