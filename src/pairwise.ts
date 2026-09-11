/** Pure evaluation logic, also embedded into the standalone review page. */
export interface PairWord {
  value: string;
  reading: string;
  roles: string[];
}
export interface Question {
  a: string;
  b: string;
  mode: "prefix" | "suffix" | "whole";
  answer: "a" | "b" | "tie" | "skip" | null;
}
export interface PairState {
  version: 2;
  corpusHash: string;
  seed: string;
  questions: Question[];
  cursor: number;
  review?: { title: string };
}
export function createPairwiseEngine(
  words: PairWord[],
  corpusHash: string,
  seed: string,
) {
  const prefixes = words.filter((w) => w.roles.includes("prefix"));
  const suffixes = words.filter((w) => w.roles.includes("suffix"));
  const validName = (id: string) => {
    const [p, s, extra] = id.split("-");
    return (
      extra === undefined &&
      prefixes.some((w) => w.value === p) &&
      suffixes.some((w) => w.value === s)
    );
  };
  const empty = (): PairState => ({
    version: 2,
    corpusHash,
    seed,
    questions: [],
    cursor: 0,
  });
  function validate(input: unknown): PairState {
    const state = input as PairState;
    if (
      state?.version !== 2 ||
      state.corpusHash !== corpusHash ||
      state.seed !== seed ||
      !Array.isArray(state.questions) ||
      !Number.isInteger(state.cursor) ||
      state.cursor < 0 ||
      state.cursor > state.questions.length
    )
      throw Error("保存データがこの辞書と一致しません。");
    if (
      state.review !== undefined &&
      (!state.review ||
        typeof state.review.title !== "string" ||
        !state.review.title.trim())
    )
      throw Error("見直しデータの形式が不正です。");
    if (
      state.review
        ? state.questions.length < 1 || state.questions.length > 1000
        : state.questions.length % 10 !== 0
    )
      throw Error("保存データの問題数が不正です。");
    const seen = new Set<string>();
    for (const q of state.questions) {
      if (
        !q ||
        typeof q.a !== "string" ||
        typeof q.b !== "string" ||
        !validName(q.a) ||
        !validName(q.b) ||
        q.a === q.b ||
        !["prefix", "suffix", "whole"].includes(q.mode) ||
        ![null, "a", "b", "tie", "skip"].includes(q.answer)
      )
        throw Error("保存データに不正な比較があります。");
      const [ap, as] = q.a.split("-");
      const [bp, bs] = q.b.split("-");
      if (
        (q.mode === "prefix" && (as !== bs || ap === bp)) ||
        (q.mode === "suffix" && (ap !== bp || as === bs)) ||
        (q.mode === "whole" && (ap === bp || as === bs))
      )
        throw Error("比較条件が一致しません。");
      const key = [q.a, q.b].sort().join("/");
      if (seen.has(key)) throw Error("比較が重複しています。");
      seen.add(key);
    }
    if (state.questions.slice(0, state.cursor).some((q) => q.answer === null))
      throw Error("未回答の位置が不正です。");
    return state;
  }
  function stats(state: PairState) {
    const names = new Set<string>();
    const compared = new Set<string>();
    const wordStats = new Map<
      string,
      { value: string; role: string; wins: number; total: number }
    >();
    for (const q of state.questions) {
      if (q.answer === null || q.answer === "skip") continue;
      names.add(q.a);
      names.add(q.b);
      for (const name of [q.a, q.b])
        for (const word of name.split("-")) compared.add(word);
      if (q.answer === "tie" || q.mode === "whole") continue;
      const slot = q.mode === "prefix" ? 0 : 1;
      for (const side of ["a", "b"] as const) {
        const value = q[side].split("-")[slot] ?? "";
        const key = `${q.mode}:${value}`;
        const s = wordStats.get(key) ?? {
          value,
          role: q.mode,
          wins: 0,
          total: 0,
        };
        s.total++;
        s.wins += q.answer === side ? 1 : 0;
        wordStats.set(key, s);
      }
    }
    return {
      answered: state.questions.filter(
        (q) => q.answer === "a" || q.answer === "b",
      ).length,
      ties: state.questions.filter((q) => q.answer === "tie").length,
      skipped: state.questions.filter((q) => q.answer === "skip").length,
      names: names.size,
      words: compared.size,
      totalNames: prefixes.length * suffixes.length,
      wordsTotal: words.length,
      wordStats: [...wordStats.values()],
    };
  }
  function addRound(state: PairState): PairState {
    if (state.review) throw Error("見直しはこの問題で終了です。");
    if (state.questions.some((q) => q.answer === null))
      throw Error("今の10問を終えてから次へ進んでください。");
    const next = structuredClone(state);
    let n = 2166136261;
    for (const char of `${seed}:${state.questions.length}`)
      n = Math.imul(n ^ char.charCodeAt(0), 16777619);
    const random = () => {
      n = (n + 0x6d2b79f5) | 0;
      let t = Math.imul(n ^ (n >>> 15), 1 | n);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const seen = new Set(
      state.questions.map((q) => [q.a, q.b].sort().join("/")),
    );
    const exposure = new Map<string, number>();
    for (const q of state.questions)
      for (const name of [q.a, q.b])
        for (const value of name.split("-"))
          exposure.set(value, (exposure.get(value) ?? 0) + 1);
    const prior = stats(state).wordStats;
    function pick(pool: PairWord[], adaptive: boolean, excluded?: string) {
      const candidates = pool.filter((w) => w.value !== excluded);
      const weighted = candidates.map((w) => {
        const records = prior.filter((s) => s.value === w.value);
        const total = records.reduce((a, s) => a + s.total, 0);
        const wins = records.reduce((a, s) => a + s.wins, 0);
        const uncertainty = total ? 1 - Math.abs((2 * wins) / total - 1) : 1;
        return {
          word: w,
          weight: adaptive
            ? (1 + uncertainty) / Math.sqrt(1 + (exposure.get(w.value) ?? 0))
            : 1,
        };
      });
      let roll = random() * weighted.reduce((sum, w) => sum + w.weight, 0);
      for (const item of weighted) {
        roll -= item.weight;
        if (roll <= 0) return item.word.value;
      }
      const last = candidates.at(-1);
      if (!last) throw Error("比較に必要な語数がありません。");
      return last.value;
    }
    for (let i = 0; i < 10; i++) {
      // First round: controlled comparisons only. Later rounds: one whole-name comparison.
      const mode =
        state.questions.length > 0 && i === 9
          ? "whole"
          : i % 2 === 0
            ? "suffix"
            : "prefix";
      let question: Question | undefined;
      for (let attempt = 0; attempt < 2000 && !question; attempt++) {
        const adaptive = state.questions.length > 0 && i % 3 !== 0;
        const ap = pick(prefixes, adaptive);
        const as = pick(suffixes, adaptive);
        const bp = mode === "suffix" ? ap : pick(prefixes, adaptive, ap);
        const bs = mode === "prefix" ? as : pick(suffixes, adaptive, as);
        let a = `${ap}-${as}`;
        let b = `${bp}-${bs}`;
        if (random() < 0.5) [a, b] = [b, a];
        const key = [a, b].sort().join("/");
        if (!seen.has(key)) {
          question = { a, b, mode, answer: null };
          seen.add(key);
        }
      }
      if (!question) throw Error("新しい比較を生成できませんでした。");
      next.questions.push(question);
      for (const name of [question.a, question.b])
        for (const word of name.split("-"))
          exposure.set(word, (exposure.get(word) ?? 0) + 1);
    }
    next.cursor = state.questions.length;
    return next;
  }
  function answer(state: PairState, choice: Question["answer"]): PairState {
    if (choice === null || !["a", "b", "tie", "skip"].includes(choice))
      throw Error("回答が不正です。");
    const next = structuredClone(state);
    const q = next.questions[next.cursor];
    if (!q) throw Error("回答する問題がありません。");
    q.answer = choice;
    next.cursor++;
    return next;
  }
  function back(state: PairState): PairState {
    return { ...structuredClone(state), cursor: Math.max(0, state.cursor - 1) };
  }
  return { empty, validate, stats, addRound, answer, back };
}
