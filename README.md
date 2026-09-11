# mochitako

Cute random slug generator — Docker-style names, but mochi.

```
$ mochitako
mochimochi-tako
```

## Usage

```
mochitako                    # one random slug
mochitako -n 5               # five slugs
mochitako --vibe sleepy      # only sleepy-mood words
mochitako --chaos 0.5        # each word may ignore the vibe filter 50% of the time
mochitako --seed tako        # deterministic output
```

Vibes: `sleepy`, `fluffy`, `happy`, `nature`, `weather`, `motion`, `sweet`, `mysterious`, `tiny`, `weird`.

## API

```ts
import { createGenerator, generate, generateMany } from "mochitako";

generate();                           // "kosokoso-purin"
generate({ vibe: "sleepy" });         // "utouto-azarashi"
generate({ vibe: "weird", chaos: 1 });
generateMany(10, { seed: "tako" });   // deterministic

const gen = createGenerator({ seed: "octopus" });
gen(); gen();                         // a deterministic stream
```

## How it works

A slug is `<prefix>-<suffix>` drawn from two curated dictionaries of romaji
vocabulary (onomatopoeia, nature words, small animals, suspicious foods).

Every word carries:

- `vibes` — mood tags used by `--vibe` filtering
- `weirdness` (0–1) — how out-of-place the word feels

`chaos` is the probability that each pick ignores the vibe filter and draws
from the whole dictionary, weighted toward weirder words. `chaos 0` gives
`utouto-azarashi`; `chaos 1` gives `mochimochi-tako` and `kosokoso-purin`.

## Development

Requires Node.js >= 22 (runs TypeScript directly) and pnpm.

```
pnpm install
pnpm cli            # node src/cli.ts
pnpm test           # vitest
pnpm typecheck      # tsc --noEmit
pnpm lint           # biome check
pnpm build          # tsdown → dist/
```
