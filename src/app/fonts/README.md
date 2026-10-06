# Bundled application fonts

The root layout loads these normal-style variable fonts with `next/font/local`.
The existing CSS variables, families, display-swap behavior and weights are preserved:
Source Sans 3 uses 400/500/600/700/800; Roboto Mono uses 400/500/600/700.
The complete upstream glyph coverage is retained. No Google Fonts request is needed
at build time or in the browser. Next emits hashed, same-origin assets and preloads
both families.

## Source and licenses

Both originals were downloaded from the official Google Fonts repository at commit
`7085eb89a950e85db5b166b7a58d414544b4140c` on 6 October 2026:

- [Source Sans 3 variable TTF](https://github.com/google/fonts/blob/7085eb89a950e85db5b166b7a58d414544b4140c/ofl/sourcesans3/SourceSans3%5Bwght%5D.ttf), version 3.052, weight axis 200–900.
- [Roboto Mono variable TTF](https://github.com/google/fonts/blob/7085eb89a950e85db5b166b7a58d414544b4140c/ofl/robotomono/RobotoMono%5Bwght%5D.ttf), version 3.001, weight axis 100–700.

The corresponding unmodified SIL Open Font License 1.1 texts are distributed here
as `sourcesans3-OFL.txt` and `robotomono-OFL.txt`. They include the upstream copyright
and reserved-name notices. Font files are distributed as part of Signal, not sold
separately.

The TTF originals were converted to WOFF2 with FontTools 4.60.2 and Brotli 1.2.0 in a temporary
Python environment outside the repository. This changes the container format only;
no subsetting, axis instancing, glyph editing or application dependency was added.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `SourceSans3-Variable.woff2` | 169,456 | `b45b0125a71014dd92265b719b977c9396451197f9676a39e8b2f5b9350173aa` |
| `RobotoMono-Variable.woff2` | 105,132 | `2ac331ff7d1c8e83f4bc23bf8fdbc0158685cb59b38ccad08457d32c099362a8` |

For future updates, use an explicit upstream revision, retain the license notices,
regenerate these hashes, and compare loaded font metrics and responsive screenshots
before publishing. Do not reintroduce a build-time Google Fonts fetch.
