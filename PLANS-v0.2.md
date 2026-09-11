# mochitako v0.2: 辞書を主役にする再構成 — 生成器はリファレンス実装へ

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

## Purpose / Big Picture

mochitakoの本質的な価値はslug生成ロジック(2語の結合)ではなく、キュレーション済み語彙そのものにある。この変更後、mochitakoは「かわいい日本語由来の名前を構成するための機械可読な語彙資源」となり、生成器とCLIはその辞書のリファレンス実装(利用例)として位置づけられる。

実装後、利用者は `import { words } from "mochitako"` で全語彙を取得でき、各語は `value`(ローマ字表記)、`reading`(日本語表記)、`kind`(語彙分類)、`vibes`、`weirdness`、`roles`(prefix/suffixどちらのスロットに立てられるか)を持つ。npmパッケージは `./words.json` サブパスexport経由で生のJSONにもアクセスでき、TypeScript以外の言語からもコーパスを利用できる。`mochitako` CLIと `generate()` は従来通り動作し、辞書の品質デモとして振る舞う。

## Progress

- [x] (2026-09-11 12:20:00Z) 本ExecPlanを作成
- [x] (2026-09-11 12:25:00Z) `data/words.json` コーパス作成(300語、reading/kind/roles付与)
- [x] (2026-09-11 12:26:00Z) `schema/words.schema.json` 作成
- [x] (2026-09-11 12:28:00Z) `src/` 更新(types.ts, kinds.ts, dictionary.ts新設、dictionary/ディレクトリ削除)
- [x] (2026-09-11 12:29:00Z) `test/dictionary.test.ts` 分離・拡充
- [x] (2026-09-11 12:30:00Z) package.json / biome.json / README.md 更新
- [x] (2026-09-11 12:31:00Z) 検証(test/typecheck/lint/build/CLIスモーク)とコミット

## Surprises & Discoveries

- Observation: roles派生でsuffixプールの配列順が変わった(統合4語が先頭側に移動)にもかかわらず、`--seed tako` の出力 `shigure-shiratama` がv0.1と完全に一致した。`shiratama` の旧index 144は「先頭への4語挿入(+4)」と「中盤の4語削除(-4)」が相殺する不動点だった。
  Evidence: `node dist/cli.mjs --seed tako` が2回連続で `shigure-shiratama` を出力。プール順はindex 4〜135の区間のみ変化しており、同一seed同一結果のテストは引き続き成立する。

- Observation: Biomeは `data/words.json` の1行オブジェクト記法を標準の複数行展開に自動整形した。手書きのコンパクト記法はlintで弾かれるため、データファイルもフォーマッタ任せにするのがこのリポジトリの流儀。
  Evidence: 初回 `pnpm lint` がwords.jsonのフォーマット差分を報告し、`pnpm fmt` 後に `Checked 16 files` でエラー0。

## Decision Log

- Decision: コーパスは単一ファイル `data/words.json` に集約し、語彙分類は `kind` フィールドで表現する。kind別の複数ファイル分割は行わない
  Rationale: 約300語の規模ではファイル分割より `kind` による正規化の方が整合性を保ちやすい。同一語の複数ファイル横断重複(purin等がprefix/suffix両方に存在)を `roles` で自然に表現できる
  Date/Author: 2026-09-11 12:20:00Z / Devin

- Decision: 語エントリのフィールドは `value` `reading` `kind` `vibes` `weirdness?` `roles` の6種に限定する
  Rationale: 設計会話で「description/etymology/rarity等を足し始めると図鑑化して危険」とされた。`reading` はローマ字化で失われた日本語表現を復元する必須メタデータ、`kind` は消費者がプールを絞るための分類、`roles` は生成時のスロット適性を表す最小限の構成
  Date/Author: 2026-09-11 12:20:00Z / Devin

- Decision: `kind` の分類は `texture / mood / motion / sound / nature / food / creature / object / concept / trait` の10種とする。天候・季節・植物・天体は `nature` に統合
  Rationale: `vibes` が雰囲気フィルタを担うため、`kind` は「その語が何を指すか」の語彙的カテゴリに留める。天候を独立kindにすると夕焼け/夜空等の境界判定が恣意的になるため粗く統合した
  Date/Author: 2026-09-11 12:20:00Z / Devin

- Decision: 新旧両辞書にまたがる語(purin/ramune/kasutera/mashumaro)は単一エントリに統合し `roles: ["prefix","suffix"]` とする。`weirdness` は両スロット値の大きい方を採用
  Rationale: 同一valueの重複エントリはcorpus一意性を壊す。スロット別weirdness(prefix時0.8/suffix時1.0等)の微差より、正規化を優先した。生成分布への影響はchaos使用時の重み付けのみで軽微
  Date/Author: 2026-09-11 12:20:00Z / Devin

- Decision: `data/words.json` は `{ "$schema", "version", "words": [...] }` のオブジェクトenvelope形式とする(裸の配列にしない)
  Rationale: `$schema` キーでエディタがschema/words.schema.jsonを自動関連付けでき、`version` で将来のフォーマット変更に備えられる
  Date/Author: 2026-09-11 12:20:00Z / Devin

- Decision: JSON Schemaによるバリデーション依存(ajv等)は追加しない。コーパスの不変条件はvitestのTypeScriptテストで検証し、schemaファイルは外部消費者向けの自己記述仕様として置く。テストがschemaのenum一覧とVIBES/KINDS定数の同期を検証する
  Rationale: 依存を増やさずに同等の保証を得られる。schemaと実装の乖離だけが残るリスクなので、それをテストで塞ぐ
  Date/Author: 2026-09-11 12:20:00Z / Devin

## Outcomes & Retrospective

v0.2の目標は達成した。コーパスは `data/words.json` の単一JSON(300語、全語にreading/kind/roles)となり、`schema/words.schema.json` が自己記述仕様を提供する。`import { words }` と `./words.json` exportの両経路で語彙にアクセスでき、generator/CLIはリファレンス実装として従来通り動く(seed tako→shigure-shiratamaを維持)。

振り返り: 「辞書が本体」への転換は、メタデータを value/vibes/weirdness から reading/kind/roles へ拡張しつつデータを `src/` の実装詳細から `data/` の資産へ移すだけで成立した。生成ロジックはimport変更のみで無改修。辞書CIは12本の不変条件テストに集約され、今後の語彙追加はJSONを編集するだけでよい。残課題は語彙の拡充(300→さらに)と、必要ならkind/vibeの見直し、英語gloss等の検討(ただし図鑑化は避ける)。

## Context and Orientation

リポジトリ `/Users/annenpolka/ghq/github.com/annenpolka/mochitako` はv0.1済みのTypeScriptパッケージ。現行構成:

    src/
      index.ts            公開API(prefixes, suffixes, generate系, 型)
      types.ts            Vibe型(10種), Word{value,vibes,weirdness?}, GenerateOptions
      vibes.ts            VIBES定数とisVibe
      random.ts           seed→決定的RNG(xmur3+mulberry32)
      generator.ts        pickWord/draw/generate/generateMany/createGenerator
      cli.ts              citty製CLI
      dictionary/
        index.ts          prefixes/suffixesのre-export
        prefixes.ts       150語(オノマトペ・状態・風景・食べ物)
        suffixes.ts       154語(動物・植物・食べ物・モノ)
    test/generator.test.ts  13テスト(生成系9 + 辞書系4)
    PLANS.md              v0.1初期化の完了済みExecPlan(参照可)

用語: slug=`<prefix>-<suffix>`形式の識別子。vibe=語に付く雰囲気タグ10種。chaos=vibeフィルタ無視確率。weirdness=語の異物感0〜1。prefix=slug前半スロット、suffix=後半スロット。roles=その語が立てるスロットの集合(本変更で新設)。

prefixesとsuffixesで重複する語は purin, ramune, kasutera, mashumaro の4語で、統合後のコーパスはちょうど300語になる。

## Plan of Work

1. `data/words.json` を新規作成。`{"$schema": "../schema/words.schema.json", "version": 1, "words": [...]}` のenvelopeに、現行prefixes.ts/suffixes.tsの全語を `reading`(日本語表記、和語はひらがな・外来語はカタカナ)、`kind`(10種)、`roles` 付きで移す。4語を統合して計300語。
2. `schema/words.schema.json` を新規作成。envelopeオブジェクトと語エントリ(value=`^[a-z]+$`、reading=非空、kind/vibes/rolesはenum、weirdness=0〜1)を記述するJSON Schema(draft 2020-12)。
3. `src/types.ts` に `Kind` 型と `WordRole`("prefix"|"suffix")を追加し、`Word` に `reading: string` `kind: Kind` `roles: WordRole[]` を追加。
4. `src/kinds.ts` を新設し `KINDS` 定数と `isKind` を実装(vibes.tsと同型)。
5. `src/dictionary.ts` を新設: `data/words.json` を `with { type: "json" }` でimportし、`words` 全量と `prefixes`/`suffixes`(rolesでfilterした派生view)をexport。`src/dictionary/` ディレクトリは削除。
6. `src/generator.ts` のimport先を `./dictionary.ts` に変更。`src/index.ts` から `words`, `Kind`, `KINDS`, `isKind` も公開。
7. `test/dictionary.test.ts` を新設し、generator.test.ts内の辞書describeを移管した上で不変条件を拡充: value一意・lowercase ASCII、reading非空かつ仮名/漢字系、kindがKINDS内、vibesが既知、weirdness範囲、roles妥当、reading→value一意(表記揺れ重複の検出)、全vibeが両スロットをカバー、schema enumとVIBES/KINDSの同期。
8. `package.json`: descriptionを語彙プロジェクト寄りに改訂、`exports` に `"./words.json": "./data/words.json"` 追加、`files` に data/schema 追加、keywords追加。`biome.json` のincludesに `data/**` `schema/**` 追加。`README.md` を語彙ファーストに書き換え。

## Concrete Steps

作業ディレクトリは `/Users/annenpolka/ghq/github.com/annenpolka/mochitako`。

    pnpm test          # 全テストpass(既存13 + 辞書不変条件の拡充分)
    pnpm typecheck     # tsc --noEmit、エラー0
    pnpm lint          # biome check .、エラー0
    pnpm build         # tsdown。dist/index.mjs, dist/cli.mjs を出力

    node dist/cli.mjs --seed tako
    # => shigure-shiratama (v0.1と同一の決定的出力であること)

    node -e 'const m = await import("./dist/index.mjs"); console.log(m.words.length, m.prefixes.length, m.suffixes.length)'
    # => 300 150 154

## Validation and Acceptance

1. `pnpm test` 全件pass。新しい辞書テスト群がデータの不変条件を検証している。
2. `node dist/cli.mjs --seed tako` が `shigure-shiratama` を出力(v0.1と同一seed同一結果=生成互換)。
3. `import { words }` で300語が取れ、各語にreading/kind/rolesがある。
4. `pnpm typecheck` `pnpm lint` `pnpm build` が全てクリーン。
5. package.jsonの `./words.json` exportが生JSONを返す。

## Idempotence and Recovery

全手順は冪等。`src/dictionary/` の削除はgit管理下のファイル移動であり、`git checkout` で戻せる。コーパスJSONの再生成も何度でも可能。壊れた場合は `git status` で差分を確認し、必要なら `git reset --hard HEAD`(コミット前の変更が消える点だけ注意)。

## Artifacts and Notes

検証結果の実測:

    $ pnpm test
     ✓ test/dictionary.test.ts (12 tests)
     ✓ test/generator.test.ts (10 tests)
     Tests  22 passed (22)

    $ pnpm typecheck && pnpm lint
    (エラーなし。biome: Checked 16 files)

    $ pnpm build
    ℹ dist/cli.mjs   46.04 kB (shebang付き・実行権限付与)
    ℹ dist/index.mjs 45.31 kB
    ℹ dist/index.d.mts

    $ node dist/cli.mjs --seed tako   (2回実行)
    shigure-shiratama
    shigure-shiratama

    $ node -e 'const m = await import("./dist/index.mjs"); ...'
    words: 300  prefixes: 150  suffixes: 154  kinds: 10
    purin → {"value":"purin","reading":"プリン","kind":"food","vibes":["sweet"],"weirdness":1,"roles":["prefix","suffix"]}
    data/words.json 直接import: 300語, version 1

## Interfaces and Dependencies

新規依存は追加しない。

    // src/types.ts (変更後の語エントリ)
    export type Kind =
      | "texture" | "mood" | "motion" | "sound" | "nature"
      | "food" | "creature" | "object" | "concept" | "trait";
    export type WordRole = "prefix" | "suffix";
    export interface Word {
      value: string;          // ^[a-z]+$
      reading: string;        // 日本語表記(ひらがな/カタカナ/漢字)
      kind: Kind;
      vibes: Vibe[];
      weirdness?: number;     // 0.0〜1.0
      roles: WordRole[];      // 立てるスロット
    }

    // src/dictionary.ts
    export const words: Word[];      // 全300語
    export const prefixes: Word[];   // roles に "prefix" を含む語(150)
    export const suffixes: Word[];   // roles に "suffix" を含む語(154)

    // src/index.ts 追加export
    export { words, prefixes, suffixes };
    export { KINDS, isKind };
    export type { Kind, WordRole };

    // package.json exports
    "./words.json": "./data/words.json"
