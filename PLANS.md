# mochitako プロジェクト初期化: かわいいランダムslug生成ライブラリ + CLI

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

## Purpose / Big Picture

Dockerがコンテナに `adoring_keller` のようなランダムな名前を付けるように、このプロジェクトは「かわいい日本語語彙のランダムslug」を生成する。実装後、ユーザーは `mochitako` コマンドを実行するだけで `mochimochi-tako` や `kosokoso-purin` のような識別子を得られる。また `--vibe sleepy` で語彙の雰囲気(バイブ)を絞り、`--chaos 1` で意味的に不整合な組み合わせ(例: 食べ物×動物)を混ぜ、`--seed` で再現可能な出力を得られる。ライブラリとしても `generate({ vibe: "sleepy" })` のように利用できる。

## Progress

- [x] (2026-09-11 02:55:00Z) ExecPlan(本ファイル)を作成
- [x] (2026-09-11 03:05:00Z) package.json と設定ファイル群(tsconfig.json, biome.json, tsdown.config.ts, .gitignore)を作成
- [x] (2026-09-11 03:05:00Z) 依存関係をインストール(citty 0.2.2, tsdown 0.23.0, vitest 5.0.0, @biomejs/biome 2.5.12, typescript 7.0.2, @types/node 22.20.2)
- [x] (2026-09-11 03:08:00Z) コア実装: 型定義、辞書(prefixes 150語/suffixes 154語、計23,100組)、seed付き乱数生成器(xmur3+mulberry32)、generator
- [x] (2026-09-11 03:08:00Z) CLI実装(citty)とライブラリのエントリポイント
- [x] (2026-09-11 03:10:00Z) vitestによるテスト(13件)
- [x] (2026-09-11 03:12:00Z) 検証: テスト・型チェック・lint・ビルド・CLI動作確認 すべて通過
- [x] (2026-09-11 03:15:00Z) 初回コミット

## Surprises & Discoveries

- Observation: Biome 2.5 の `files.includes` はディレクトリ名(`"src"`)では配下のファイルを拾わず、`"src/**"` のようなglobが必要。初期設定では14ファイル中4ファイルしか検査されていなかった。
  Evidence: `biome check .` が "Checked 4 files" と報告し、`biome check src test` が "paths were provided but ignored" を返した。glob化後は14ファイルを検査し、import整列や `noAssignInExpressions` 等の実指摘が出た。

- Observation: typescript@7.0.2 がインストールされた(Go実装への移行世代)。`tsc --noEmit` は従来通り動作するが、tsdownの型定義生成時に "TypeScript 7.0 does not yet have a stable API and is experimental" の警告が出る。d.mts生成自体は成功している。
  Evidence: `pnpm build` 出力の WARN 行。dist/index.d.mts は正常に生成された。

- Observation: tsdownは `outputOptions.banner` で付与した `#!/usr/bin/env node` shebangを検出して `dist/cli.mjs` に自動で実行権限を付与する。
  Evidence: ビルドログ "Granting execute permission to dist/cli.mjs"。

- Observation: Node 26 は `.ts` 拡張子付きimportとimport attributes(`with { type: "json" }`)をそのまま実行でき、`node src/cli.ts --seed tako` がバンドル版 `node dist/cli.mjs --seed tako` と同一の決定的出力(`shigure-shiratama`)を返した。tsx等の開発用ランナーは不要。
  Evidence: スモークテストの実測出力。

- Observation: pnpm がサンドボックス環境下でプロジェクトローカルの `.pnpm-store/` を作成した。`.gitignore` に追加済み。またインストール時に supply-chain ポリシー検証("Verifying lockfile against supply-chain policies")が走る環境設定になっている。
  Evidence: `git status` に `.pnpm-store/` が出現。

## Decision Log

- Decision: プロジェクト名は `mochitako` とし、代表出力例は `mochimochi-tako` とする
  Rationale: `mochimochi-tako` は作品名として強いが、`mochitako` は短くCLI名・パッケージ名として扱いやすい道具名になる。`mochitako` コマンドが `mochimochi-tako` を出力しうる自己言及的な面白さもある。
  Date/Author: 2026-09-11 02:55:00Z / 設計会話(ChatGPT)より確定

- Decision: 技術スタックは TypeScript + Node.js 22+ / pnpm / citty(CLI) / tsdown(ビルド) / vitest / biome
  Rationale: このプロジェクトはコードより辞書の質が主役であり、辞書を人間が頻繁に編集する。編集障壁が最も低いTSエコシステムが適する。RustやGoは単一バイナリ配布に有利だが、ロジックが配列フィルタと文字列結合しかないため技術的必然性がない。
  Date/Author: 2026-09-11 02:55:00Z / 設計会話より確定

- Decision: `chaos` パラメータは「意味的不整合の許容度」として実装する。各単語選択時に確率chaosでvibeフィルタを無視して全辞書から選ぶ。さらに選択プール内では `weirdness` に比例した重み付けをchaos倍率で行う
  Rationale: `chaos 0` では同じvibe同士のみ(例: `utouto-azarashi`)、`chaos 1` では完全無法(例: `mochimochi-tako`)。weirdness重みにより、chaos上昇時に `purin` や `manbou` のような異物感のある語が出やすくなり、「かわいい」より「なんか好き」な出力になる
  Date/Author: 2026-09-11 02:55:00Z / 設計会話より確定

- Decision: 最初から monorepo にしない。単一パッケージで src/index.ts(ライブラリ)と src/cli.ts(CLI)を持つ
  Rationale: スコープが小さい(辞書+2語結合+CLI)ため分割する理由がない。Web UIやAPI server等はv0.1のスコープ外とする
  Date/Author: 2026-09-11 02:55:00Z / 設計会話より確定

## Outcomes & Retrospective

v0.1の目標はすべて達成した。`node dist/cli.mjs` で `kirakira-karugamo`、`--chaos 1` で `hoshizora-taiyaki` や `pokkari-minomushi` のような「なんか好き」系の出力が得られ、`--seed` の決定性・`--vibe` フィルタ・バリデーションエラーも仕様通り動作する。辞書は150×154=23,100通りで、全10vibeが両側にカバーされている。

振り返り: 設計どおり「コード10%、辞書90%」の構成になり、実装の大半は語彙のキュレーションだった。想定外の作業はBiome 2.5の設定形式変更(glob必須、recommended→preset)への対応のみ。残課題は辞書の拡充(目標300×300)と、必要になれば `--list-vibes` や複数vibe指定などの機能追加。

## Context and Orientation

これは新規プロジェクトであり、作業開始時点のリポジトリ `/Users/annenpolka/ghq/github.com/annenpolka/mochitako` には .git ディレクトリ以外何も存在しない(コミットも未作成)。環境は macOS、Node.js v26、pnpm 11.5 が利用可能。

用語定義:

- slug: URLや識別子に使える短い文字列。ここでは `prefix-suffix` 形式のローマ字2語結合を指す(例: `nemunemu-kurage`)。
- vibe: 語彙に付与する雰囲気タグ。`sleepy / fluffy / happy / nature / weather / motion / sweet / mysterious / tiny / weird` の10種類。各単語は複数vibeを持てる。
- chaos: 0.0〜1.0の生成パラメータ。vibeフィルタをどれくらいの確率で無視するかを表す。
- weirdness: 各単語に付ける0.0〜1.0の「異物感」スコア。`koguma` は0.1程度、`purin`(食べ物が生き物扱い)は1.0に近い。chaos上昇時にweirdな語が選ばれやすくする重み付けに使う。
- prefix: slug前半の単語(オノマトペ・状態・風景・食べ物系)。suffix: slug後半の単語(動物・小さなもの系が主役)。

最終的なファイル構成は次の通り:

    mochitako/
    ├── PLANS.md            (本ファイル)
    ├── package.json
    ├── tsconfig.json
    ├── biome.json
    ├── tsdown.config.ts
    ├── .gitignore
    ├── README.md
    ├── src/
    │   ├── index.ts        (ライブラリ公開API)
    │   ├── types.ts        (Vibe, Word, GenerateOptions)
    │   ├── vibes.ts        (VIBE一覧)
    │   ├── random.ts       (seed文字列から決定的乱数を作る)
    │   ├── generator.ts    (slug生成ロジック)
    │   ├── cli.ts          (citty製CLI、binエントリ)
    │   └── dictionary/
    │       ├── index.ts
    │       ├── prefixes.ts
    │       └── suffixes.ts
    └── test/
        └── generator.test.ts

## Plan of Work

まずパッケージ基盤を作る。package.json は `"type": "module"`、`bin` に `./dist/cli.mjs`、`exports` に `./dist/index.mjs` + 型定義を設定する。tsconfig は strict、相対importに `.ts` 拡張子を許可(`allowImportingTsExtensions` + `noEmit`)し、Node 26 のネイティブTypeScript実行(型注釈の除去)で `node src/cli.ts` が直接動く構成にする。enum等の型除去不可能な構文は使わない。

次に辞書を実装する。`src/types.ts` に `Vibe` 型と `Word` インターフェース(`{ value: string; vibes: Vibe[]; weirdness?: number }`)を定義し、`src/dictionary/prefixes.ts` に約110語、`src/dictionary/suffixes.ts` に約130語をvibe付きで収録する。語彙は日本語オノマトペ・自然語彙・小動物・食べ物をローマ字化したもので、全vibeがprefix/suffix双方に最低1語を持つようにする。

生成器は `src/random.ts` に seed文字列→32bitハッシュ(xmur3)→決定的乱数(mulberry32)の変換を実装し、`src/generator.ts` に `generate(options)` を実装する。各スロット(prefix/suffix)の選択時、`vibe` 指定ありかつ `rng() >= chaos` ならvibeフィルタ済みプールから、そうでなければ全辞書から選ぶ。プール内では `1 + (weirdness ?? 0) * chaos * 3` の重みで重み付き抽選する。prefixとsuffixが同一語になった場合は1回だけ引き直す。

CLIは `src/cli.ts` に citty で実装する。引数は `--vibe`(10種の文字列)、`--chaos`(0〜1の小数)、`--seed`(任意文字列)、`-n/--count`(正の整数、デフォルト1)。バリデーションエラーはstderrに出して終了コード1。ライブラリAPIは `src/index.ts` から `generate`, `generateMany`, `createGenerator`, 型群を公開する。

テストは `test/generator.test.ts` に vitest で書く。slug形式、vibeフィルタ(chaos 0で全出力がvibeを含む)、seed決定性、chaos 1 でvibe無視、count、不正パラメータで例外、全vibeの辞書カバレッジを検証する。

最後に `pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm build`、`node dist/cli.mjs` のスモークテストを行い、初回コミットを作成する。

## Concrete Steps

作業ディレクトリは常に `/Users/annenpolka/ghq/github.com/annenpolka/mochitako`。

    # 依存インストール
    pnpm add citty
    pnpm add -D typescript @types/node vitest tsdown @biomejs/biome

    # 検証コマンド
    pnpm test          # vitest run。全テストpassを期待
    pnpm typecheck     # tsc --noEmit。エラー0を期待
    pnpm lint          # biome check .。エラー0を期待
    pnpm build         # tsdown。dist/index.mjs, dist/cli.mjs, dist/*.d.mts を期待

    # スモークテスト(期待出力例)
    node dist/cli.mjs
    # => 例: mochimochi-tako (辞書内のprefix-suffix形式1行)

    node dist/cli.mjs --seed tako
    # => 例: utouto-kurage (同seedなら何度実行しても同一)

    node dist/cli.mjs --vibe sleepy -n 5
    # => 5行。各行のprefix/suffixがsleepy vibeを持つ語

    node dist/cli.mjs --vibe invalid
    # => stderrにエラーメッセージ、終了コード1

## Validation and Acceptance

受け入れ条件:

1. `pnpm test` が全件passする。具体的には `test/generator.test.ts` において、(a)生成文字列が `^[a-z]+-[a-z]+$` にマッチし両パーツが辞書由来であること、(b)`vibe`指定かつ `chaos: 0` で100回生成した全結果の両語がそのvibeを持つこと、(c)同一seedで同一結果・異seedで異なる結果であること、(d)`chaos` が範囲外や `count` が0以下で例外になること、(e)全10 vibeがprefix/suffix辞書それぞれに最低1語を持つことを確認するテストが通る。
2. `pnpm build` 後に `node dist/cli.mjs` を実行すると1行のslugが出力される。
3. `node dist/cli.mjs --seed tako` を2回実行して同一出力になる。
4. `node dist/cli.mjs --vibe sleepy -n 5` が5行出力し、各行が辞書上sleepy vibeを持つ語のみで構成される。
5. `pnpm typecheck` と `pnpm lint` がエラー0で終了する。

## Idempotence and Recovery

すべての手順は繰り返し実行しても安全。`pnpm install`・ビルド・テストは冪等。問題が起きた場合は `node_modules` と `dist` を削除して `pnpm install` からやり直せる(git管理外の生成物のみ消える)。コミット前なら `git status` で変更を確認し、やり直したいファイルは `git checkout` 相当で戻せるが、初期化フェーズでは全ファイル新規のため破壊的リスクはない。

## Artifacts and Notes

検証結果の実測:

    $ pnpm test
     ✓ test/generator.test.ts (13 tests)
     Tests  13 passed (13)

    $ pnpm typecheck && pnpm lint
    (エラーなし。biome: Checked 14 files)

    $ pnpm build
    ℹ dist/cli.mjs   23.10 kB   (shebang付き・実行権限付与済み)
    ℹ dist/index.mjs 22.12 kB
    ℹ dist/index.d.mts

    $ node dist/cli.mjs
    kirakira-karugamo

    $ node dist/cli.mjs --seed tako   (2回実行)
    shigure-shiratama
    shigure-shiratama

    $ node dist/cli.mjs --vibe sleepy -n 5
    suyasuya-fukurou
    munyamunya-kurage
    oyasumi-neko
    yukkuri-mimizuku
    yurayura-neko

    $ node dist/cli.mjs --chaos 1 -n 8 --seed octopus
    totototo-kame
    gizagiza-kani
    hoshizora-taiyaki
    toomawari-kapibara
    mahoro-kuroba
    yozora-kamereon
    pokkari-minomushi
    kosokoso-kapibara

    $ node dist/cli.mjs --vibe bogus
    mochitako: unknown vibe "bogus" (choose from: sleepy, fluffy, happy, ...)  → exit 1

## Interfaces and Dependencies

依存関係:

- `citty`: CLI定義・引数パース・help生成に使用(unjs製の軽量CLIフレームワーク)。
- `tsdown`: rolldownベースのライブラリバンドラ。`src/index.ts`→`dist/index.mjs`(+dts)、`src/cli.ts`→`dist/cli.mjs` を出力。
- `vitest`: テストランナー。
- `@biomejs/biome`: lint+フォーマット。
- `typescript`, `@types/node`: 型チェック。

公開インターフェース(実装終了時に存在すべきもの):

    // src/types.ts
    export type Vibe =
      | "sleepy" | "fluffy" | "happy" | "nature" | "weather"
      | "motion" | "sweet" | "mysterious" | "tiny" | "weird";

    export interface Word {
      value: string;
      vibes: Vibe[];
      weirdness?: number; // 0.0〜1.0、省略時0
    }

    export interface GenerateOptions {
      vibe?: Vibe;
      chaos?: number;          // 0.0〜1.0、デフォルト0
      seed?: string;           // 指定時は決定的出力
      random?: () => number;   // 乱数注入用。指定時はseedより優先
    }

    // src/generator.ts
    export function generate(options?: GenerateOptions): string;
    export function generateMany(count: number, options?: GenerateOptions): string[];
    export function createGenerator(defaults?: GenerateOptions): (options?: GenerateOptions) => string;

    // src/index.ts から全て再export
