import type { Viz } from "../../lib/analytics";

/** Miniaturas desenhadas à mão de cada tipo de gráfico (herdam a cor do texto). */
export function VizIcon({ viz, active }: { viz: Viz; active?: boolean }) {
  const a = active ? "#820AD1" : "currentColor";
  const b = active ? "#C68BF6" : "currentColor";
  const common = { width: 40, height: 28, viewBox: "0 0 40 28", fill: "none", "aria-hidden": true } as const;
  const soft = { opacity: active ? 1 : 0.35 };
  switch (viz) {
    case "kpi":
      return <svg {...common}><text x="20" y="18" textAnchor="middle" fontSize="13" fontWeight="800" fill={a}>R$</text><rect x="10" y="22" width="20" height="2.5" rx="1.25" fill={b} style={soft} /></svg>;
    case "donut":
      return <svg {...common}><circle cx="20" cy="14" r="9" stroke={b} strokeWidth="5" style={soft} /><path d="M20 5a9 9 0 0 1 8.6 11.7" stroke={a} strokeWidth="5" /></svg>;
    case "pie":
      return <svg {...common}><circle cx="20" cy="14" r="11" fill={b} style={soft} /><path d="M20 14V3a11 11 0 0 1 10.5 14.3Z" fill={a} /></svg>;
    case "bar":
      return <svg {...common}>{[6, 14, 22, 30].map((x, i) => <rect key={x} x={x} y={[14, 6, 10, 3][i]} width="5" height={[12, 20, 16, 23][i]} rx="1.5" fill={i % 2 ? a : b} style={i % 2 ? undefined : soft} />)}</svg>;
    case "barH":
      return <svg {...common}>{[4, 11, 18].map((y, i) => <rect key={y} x="5" y={y} width={[30, 21, 12][i]} height="5" rx="2.5" fill={i === 0 ? a : b} style={i === 0 ? undefined : soft} />)}</svg>;
    case "stacked":
      return <svg {...common}>{[6, 14, 22, 30].map((x, i) => (<g key={x}><rect x={x} y={[12, 6, 9, 4][i]} width="5" height={[14, 20, 17, 22][i]} rx="1.5" fill={b} style={soft} /><rect x={x} y={[18, 15, 17, 14][i]} width="5" height={[8, 11, 9, 12][i]} rx="1.5" fill={a} /></g>))}</svg>;
    case "line":
      return <svg {...common}><path d="M4 22 L12 15 L19 18 L27 8 L36 5" stroke={a} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 24 L12 21 L19 22 L27 17 L36 15" stroke={b} strokeWidth="2" strokeLinecap="round" style={soft} /></svg>;
    case "area":
      return <svg {...common}><path d="M4 22 L12 14 L20 17 L28 7 L36 9 V26 H4Z" fill={b} style={{ opacity: active ? 0.35 : 0.2 }} /><path d="M4 22 L12 14 L20 17 L28 7 L36 9" stroke={a} strokeWidth="2.5" strokeLinejoin="round" /></svg>;
    case "table":
      return <svg {...common}>{[4, 11, 18].map((y, i) => (<g key={y}><rect x="5" y={y} width="12" height="4" rx="2" fill={i === 0 ? a : b} style={i === 0 ? undefined : soft} /><rect x="21" y={y} width="14" height="4" rx="2" fill={b} style={soft} /></g>))}</svg>;
    case "progress":
      return <svg {...common}><rect x="4" y="11" width="32" height="6" rx="3" fill={b} style={soft} /><rect x="4" y="11" width="22" height="6" rx="3" fill={a} /></svg>;
    case "cards":
      return <svg {...common}><rect x="7" y="5" width="26" height="18" rx="3.5" fill={a} /><rect x="7" y="9" width="26" height="3" fill="#fff" opacity=".5" /><rect x="10" y="17" width="8" height="2.5" rx="1.25" fill="#fff" opacity=".8" /></svg>;
    case "upcoming":
      return <svg {...common}>{[5, 12, 19].map((y, i) => (<g key={y}><circle cx="9" cy={y + 2} r="2.5" stroke={i === 0 ? a : b} strokeWidth="1.5" style={i === 0 ? undefined : soft} /><rect x="14" y={y} width={[20, 16, 18][i]} height="4" rx="2" fill={i === 0 ? a : b} style={i === 0 ? undefined : soft} /></g>))}</svg>;
  }
}
