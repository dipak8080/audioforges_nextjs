export interface CamelotKey {
  code: string;
  number: number;
  letter: "A" | "B";
  key: string;
  openKey: string;
  aka?: string;
}

const NAMES: [string, string][] = [
  ["A♭ minor", "B major"],
  ["E♭ minor", "F♯ major"],
  ["B♭ minor", "D♭ major"],
  ["F minor", "A♭ major"],
  ["C minor", "E♭ major"],
  ["G minor", "B♭ major"],
  ["D minor", "F major"],
  ["A minor", "C major"],
  ["E minor", "G major"],
  ["B minor", "D major"],
  ["F♯ minor", "A major"],
  ["D♭ minor", "E major"],
];

const AKA: Record<string, string> = {
  "1A": "G♯ minor",
  "2A": "D♯ minor",
  "3A": "A♯ minor",
  "12A": "C♯ minor",
  "2B": "G♭ major",
  "3B": "C♯ major",
};

export const CAMELOT_KEYS: CamelotKey[] = NAMES.flatMap(([minor, major], i) => {
  const n = i + 1;
  const ok = ((n + 4) % 12) + 1;
  return [
    { code: `${n}A`, number: n, letter: "A" as const, key: minor, openKey: `${ok}m`, aka: AKA[`${n}A`] },
    { code: `${n}B`, number: n, letter: "B" as const, key: major, openKey: `${ok}d`, aka: AKA[`${n}B`] },
  ];
});

const wrap = (n: number) => ((n - 1 + 12) % 12) + 1;

function keyOf(code: string) {
  return CAMELOT_KEYS.find((k) => k.code === code)?.key ?? "";
}

export interface CamelotMove {
  label: string;
  note: string;
  code: string;
  key: string;
}

export function camelotMoves(code: string): CamelotMove[] {
  const n = parseInt(code, 10);
  const letter = code.slice(-1).toUpperCase();
  const other = letter === "A" ? "B" : "A";
  const moves: Omit<CamelotMove, "key">[] = [
    { label: "Swap the letter", note: "Same notes, the mood flips", code: `${n}${other}` },
    { label: "One step down", note: "Smooth, a touch calmer", code: `${wrap(n - 1)}${letter}` },
    { label: "One step up", note: "Smooth, a touch brighter", code: `${wrap(n + 1)}${letter}` },
    { label: "Two steps up", note: "Energy lift, check it by ear", code: `${wrap(n + 2)}${letter}` },
  ];
  return moves.map((m) => ({ ...m, key: keyOf(m.code) }));
}