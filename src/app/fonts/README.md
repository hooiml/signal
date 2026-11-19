# Bundled application fonts

The root layout loads these normal-style variable fonts with `next/font/local`.
Inter uses weights 400–800 (`--font-inter`) for UI copy, scores, prices, metrics, and tabular tables;
Plus Jakarta Sans uses weights 500–800 (`--font-plus-jakarta`) for page headings, stock names, and section headings.
No Google Fonts request is needed at build time or in the browser. Next emits hashed, same-origin assets and preloads both families.

## Source and licenses

Both Latin variable WOFF2 files are from pinned Fontsource 5.2.5 releases (derived from the official Google Fonts upstream repositories):

- [Inter variable WOFF2](https://cdn.jsdelivr.net/npm/@fontsource-variable/inter@5.2.5/files/inter-latin-wght-normal.woff2) (`@fontsource-variable/inter@5.2.5`, weight axis 100–900).
- [Plus Jakarta Sans variable WOFF2](https://cdn.jsdelivr.net/npm/@fontsource-variable/plus-jakarta-sans@5.2.5/files/plus-jakarta-sans-latin-wght-normal.woff2) (`@fontsource-variable/plus-jakarta-sans@5.2.5`, weight axis 200–800).

The unmodified SIL Open Font License 1.1 texts are distributed here as `inter-OFL.txt` and `plus-jakarta-sans-OFL.txt`. Font files are distributed as part of Signal, not sold separately.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Inter-Variable.woff2` | 48,444 | `f052ee44c3728dfd23aba8a4567150bc314d23903026fbb6ad089422c2df56af` |
| `PlusJakartaSans-Variable.woff2` | 27,444 | `1262bff0591c36094d058ab102b84ce34eb1e547e8ff00557bf8d55449e58e40` |

For future updates, use an explicit upstream version, retain the license notices, regenerate these hashes, and compare loaded font metrics and responsive screenshots before publishing. Do not reintroduce a build-time external font fetch.
