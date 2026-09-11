# mochitako

A curated, machine-readable vocabulary of cute, slightly strange
Japanese-inspired words — plus a small slug generator as its reference
implementation.

```
$ mochitako
mochimochi-tako
```

## The vocabulary

`data/words.json` is the artifact. Every entry looks like:

```json
{
  "value": "purin",
  "reading": "プリン",
  "kind": "food",
  "vibes": ["sweet"],
  "weirdness": 1.0,
  "roles": ["prefix", "suffix"]
}
```

- `value` — lowercase ASCII romaji, safe for slugs and identifiers
- `reading` — Japanese orthography (hiragana / katakana)
- `kind` — lexical category: `texture`, `mood`, `motion`, `sound`,
  `nature`, `food`, `creature`, `object`, `concept`, `trait`
- `vibes` — mood tags: `sleepy`, `fluffy`, `happy`, `nature`, `weather`,
  `motion`, `sweet`, `mysterious`, `tiny`, `weird`
- `weirdness` (0–1) — how out-of-place the word feels
- `roles` — which slug slots the word can occupy (`prefix` / `suffix`)

The corpus holds 300 words (150 prefix-eligible, 154 suffix-eligible;
four foods like `purin` play both roles). Compose it however you like —
`mochimochi_tako`, `MochimochiTako`, `もちもちたこ` — the schema is at
`schema/words.schema.json`.

## Usage

Library:

```ts
import {
  words,          // all 300 entries
  prefixes,       // entries whose roles include "prefix"
  suffixes,       // entries whose roles include "suffix"
  generate,
  generateMany,
  createGenerator,
} from "mochitako";

generate();                           // "kosokoso-purin"
generate({ vibe: "sleepy" });         // "utouto-azarashi"
generate({ vibe: "weird", chaos: 1 });
generateMany(10, { seed: "tako" });   // deterministic

const gen = createGenerator({ seed: "octopus" });
gen(); gen();                         // a deterministic stream
```

Raw JSON (any language, via the npm tarball):

```ts
import corpus from "mochitako/words.json" with { type: "json" };
```

CLI:

```
mochitako                    # one random slug
mochitako -n 5               # five slugs
mochitako --vibe sleepy      # only sleepy-mood words
mochitako --chaos 0.5        # each word may ignore the vibe filter 50% of the time
mochitako --seed tako        # deterministic output
```

## How the generator works

A slug is `<prefix>-<suffix>` drawn from the two role-filtered pools.
`chaos` is the probability that each pick ignores the vibe filter and draws
from the whole pool instead, weighted toward weirder words. `chaos 0` gives
`utouto-azarashi`; `chaos 1` gives `mochimochi-tako` and `kosokoso-purin`.

## Curation policy

A word belongs here if it is: romanizable Japanese (or a loanword naturalized
into it), pronounces cleanly, carries a concrete image or feeling, and
combines amusingly with words from other categories. Abstract evaluations
(`beautiful`, `nice`) are out; textures, creatures, foods, and odd little
objects are in.

## Development

Requires Node.js >= 22 (runs TypeScript directly) and pnpm.

```
pnpm install
pnpm cli            # node src/cli.ts
pnpm test           # vitest — includes corpus invariant checks
pnpm typecheck      # tsc --noEmit
pnpm lint           # biome check
pnpm build          # tsdown → dist/
```
