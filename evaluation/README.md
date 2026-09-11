# 辞書評価

## まず10問

```sh
pnpm eval:serve
# ブラウザで http://127.0.0.1:4318/ を開く
```

「どっちが好き？」で左右どちらかをクリックすると次の問題へ。
← / → キーでも選択できる。差がなければ「同じくらい」（↓）、判断できなければ「判断を見送る」。
10問で終了画面になり、続けたいときだけ「もう10問」を押す。
「ひとつ戻る」で回答を訂正できる。

回答・訂正ごとに `evaluation/results/<辞書とシードのハッシュ>.json` に保存し、
成功を確認してから画面を進める。ファイルにはrevision、state、updatedAt、summaryを含む。
置換は一時ファイルからのrenameで行い、`evaluation/results/history/` に保存履歴を残す。
保存失敗時は回答を進めず、エラーを表示する。複数タブで更新が競合したら
古いデータで上書きせず、再読み込みを求める。
再開時はサーバーのファイルを優先し、ブラウザ内にも予備を保存する。
サーバーを止めると回答は保存できないが、ファイルは残る。再起動後にページを再読み込みする。

以前のHTML版で回答した10問は、旧画面の「回答のバックアップ」から一度だけ保存し、
新画面の「保存・評価について」→「以前の回答を取り込む」でそのJSONを選ぶ。
取り込み時にも辞書・シードを照合する。既存の回答がある場合は置換の確認を出す。
以後は手動の書き出し不要。ローカルHTMLとHTTPページは別の保存領域なので、
古いHTMLの回答をHTTPページから直接読むことはできない。

サーバーは127.0.0.1のみで待ち受ける。画面と保存APIだけを公開し、
プロジェクト内の任意のファイルを配信しない。ポート変更は `MOCHITAKO_EVAL_PORT`。
別シードは `pnpm eval:serve another-seed`。既定は `mochitako-v1`。

## 比較の作り方

最初の10問はsuffix比較5問・prefix比較5問。比較しない側を共通にする。
左右の配置はランダム化し、同じ名前同士や重複した対戦は出さない。

2セット目以降は10問中1問で両側が異なる名前を比較する。
一部は均等ランダム、残りは登場回数の少ない語と勝敗が拮抗する語に
重みを付ける。これは単純な探索ヒューリスティックで、統計的に最適な
実験設計や学習済み嗜好モデルではない。生成済みの問題は訂正時にも保持し、
後続セット生成時に最新の回答を使う。

## 結果の意味

終了画面は今回選んだ名前と、比較した名前・登場語の数を表示する。
「同じくらい」はtiesとして別集計し、勝敗へ加算しない。比較済みの名前・語数には含める。
「判断を見送る」はskipとして勝敗にも比較済み件数にも含めない。
answeredは左右を選んだ件数で、回答済み総数はanswered + ties + skipped。
語単体の選択回数は、片側を揃えた比較で変更した側だけに帰属させる。
共通側の語や、両側が違う比較から単語の勝敗を推定しない。
3比較以上の語のみ終了画面に記録を表示するが、これは信頼性の保証ではない。

名前の相対的な好みを集める仕組みなので、「使いたい名前の割合」、
全辞書の有効組み合わせ数、単語全体の優劣、組み合わせ相性の確定評価は未測定。
比較した名前の割合を品質の合格率と解釈しない。

## ファイルと集計

`evaluation/results/` は回答と履歴、`evaluation/output/` は生成物としてgitignore対象。
`pnpm eval:pairs` は従来のブラウザ内保存だけのHTMLと全件CSVを生成する。

- `review.html`: 自動保存付きの2択画面。
- `pairs.csv`: 全23,100ペアの構造情報。
- `baseline.json`: 辞書ハッシュ、語数、タグ分布、長さ分布、メタデータ一致群。

任意で画面下の「回答のバックアップ」からJSONを保存できる。
通常の再開にバックアップ操作は不要。バックアップは画面から取り込める。

```sh
pnpm eval:report ~/Downloads/mochitako-comparisons.json
```

`report.json` に比較記録と役割別の選択回数を出力する。
サーバーの保存ファイルもバックアップJSONもCLIで集計できる。
旧100件採点形式のJSONも引き続き集計可能。いずれも辞書ハッシュを照合する。
レポートファイルは実行のたびに上書きされる。

## 今後の方針

[人の好みを起点に辞書を育てる](ROADMAP.md) に、LLM評価器の検証と候補語による
辞書拡張の進め方を記載。人間回答での未提示比較を使って確かめてから、適用範囲を広げる。

## LLM比較の初回パイロット

2026-09-11に100回答を60例示／40検証へ固定し、OpenCodeの
`opencode-go/deepseek-flash` と Devin ACPの `swe-2-max` を実行した。
Devinは例なし21/40、例示あり24/40。DeepSeekは例なし16/40、例示ありは
サーバーエラーで欠測（同一セッションで1回再試行）。全件評価へは進めていない。

準備スクリプトは `evaluation/llm-pilot.py`、結果集計は `evaluation/score-pilot.py`。
生データ・固定分割・プロンプト・セッション証拠・詳しいレポートは
`evaluation/results/pilot-20260911T040042Z/` に保管している。

続いてユーザー指定の `opencode-go/deepseek-v4.1-flash` で両条件を再実行し、
例なし17/40、例示あり26/40（11問改善・2問悪化）。詳細は同じ証拠ディレクトリの
`V41-REPORT.md`。全件評価へはまだ展開していない。

新しい40問での再検証ではDeepSeek v4.1 Flashが例なし・例ありとも25/40、
Devinが両条件27/40。例示による正味改善は再現せず。
詳細：`evaluation/results/validation-v2/20260911T044255Z/REPORT.md`。

## 同点を含む5問の見直し

`MOCHITAKO_EVAL_PORT=4320 pnpm eval:serve mochitako-tie-review-v1` で開く。
今回の見直しは両モデルの例示あり予測が外れた比較の先頭5件を選んだ診断用セット。
`evaluation/results/tie-review/manifest.json` に元回答との対応を保存している。
過去の人間回答とベンチマークのスコアは変更しない。
失敗例を選んだ再評価から全体の精度を計算したり、同点を事後的な正解にして
過去の精度を上げたりしない。次の検証では最初から同点と明確な選好を分ける。

初期化は `node evaluation/prepare-tie-review.mjs`（既存データがあれば上書きせず失敗）。
旧version 2データはそのまま読み込める。同じ保存形式でtie回答と任意のreviewメタデータに対応。

## 響きと情景の指示

`evaluation/rubric.md` と `evaluation/prompts/scene-sound-v1.txt` に仮説を記載。
既存問題での開発試行では改善が一貫せず、評価器の精度向上とは扱わない。
記録は `evaluation/results/scene-sound-dev-20260911T053926Z/REPORT.md`。

具体例と理由を追加し、その比較を採点から除く開発試行でも改善は確認できず。
共通35問でDeepSeek26→24、Devin25→21。追加プロンプトは採用保留。
記録：`evaluation/results/anchor-dev-20260911T054408Z/REPORT.md`。

## LLM候補を人が比較する

LLMには未収録語を発案してもらい、候補の選好予測は依頼しない。
初回はDeepSeek v4.1 Flash / Devin SWE-2 Maxの各12案をまとめた22語から、
5語を人手で選定。各語を異なる前半語の2文脈で既存語と比較する10問。
同点・見送り・自動保存に対応し、候補はまだ本辞書に追加しない。

```bash
pnpm eval:candidates evaluation/results/candidate-generation-20260911T054957Z/review-bundle.json
```

`http://127.0.0.1:4322/` を開く。再起動しても既存回答を優先する。
bundleには候補込みの語彙と未回答の問題を保管し、回答は語彙ハッシュとseedで
分離した通常のresultsファイルに保存する。`selection.json` に出典・選定理由・
対照語・候補の左右対応を記録。2問の勝敗だけで辞書全体のyieldや採用を決めない。

第2回はユーザー指定の新候補50語・100問。10問ごとに区切って再開できる。

```bash
MOCHITAKO_EVAL_PORT=4323 pnpm eval:candidates evaluation/results/candidate-generation-v2-50/review-bundle.json
node evaluation/summarize-candidate-review.mjs evaluation/results/candidate-generation-v2-50
```

`selection.json` が候補と選定根拠、`comparisons.json` が全100問の対応表。
準備スクリプト `evaluation/prepare-candidate-review.mjs` は候補・対照・読みの重複を
検証して生成し、既存bundleは上書きしない。候補の選定自体は人手で行う。
固定レビューは最大1,000問まで保持でき、通常の自動10問出題とは分離している。
