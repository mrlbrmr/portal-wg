"use client"

export type BigFiveScores = {
  O: number | null
  C: number | null
  E: number | null
  A: number | null
  N: number | null
}

export const BIG_FIVE_DIMS = [
  { key: 'O' as const, label: 'Abertura', desc: 'criatividade e curiosidade intelectual', color: '#8b5cf6' },
  { key: 'C' as const, label: 'Conscienciosidade', desc: 'organização, disciplina e responsabilidade', color: '#3b82f6' },
  { key: 'E' as const, label: 'Extroversão', desc: 'sociabilidade, energia e assertividade', color: '#f59e0b' },
  { key: 'A' as const, label: 'Amabilidade', desc: 'cooperação, empatia e confiança', color: '#10b981' },
  { key: 'N' as const, label: 'Neuroticismo', desc: 'reatividade emocional e instabilidade', color: '#ef4444' },
]

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function ringPoints(cx: number, cy: number, R: number, angles: number[], f: number) {
  return angles.map((deg) => {
    const p = polar(cx, cy, R * f, deg)
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`
  }).join(' ')
}

interface RadarProps {
  scores: BigFiveScores
  size?: number
}

export function BigFiveRadar({ scores, size = 280 }: RadarProps) {
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.31
  const labelR = size * 0.415

  // 5 vertices clockwise from top (-90°)
  const angles = BIG_FIVE_DIMS.map((_, i) => -90 + i * 72)

  const dataPoints = BIG_FIVE_DIMS.map((d, i) => {
    const val = (scores[d.key] ?? 0) / 100
    const p = polar(cx, cy, R * val, angles[i])
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`
  }).join(' ')

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="Gráfico radar Big Five"
    >
      {/* Grid rings at 25/50/75/100% */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={ringPoints(cx, cy, R, angles, f)}
          fill={f === 1 ? 'none' : f === 0.75 ? '#f5f3ff' : f === 0.5 ? '#ede9fe' : '#ddd6fe'}
          stroke={f === 1 ? '#c4b5fd' : '#e9d5ff'}
          strokeWidth={f === 1 ? 1.5 : 0.75}
        />
      ))}

      {/* Axis lines center → vertex */}
      {angles.map((deg, i) => {
        const end = polar(cx, cy, R, deg)
        return <line key={i} x1={cx} y1={cy} x2={end.x.toFixed(2)} y2={end.y.toFixed(2)} stroke="#e9d5ff" strokeWidth={1} />
      })}

      {/* Grid % labels on C axis (i=1, -18°) */}
      {[25, 50, 75].map((pct) => {
        const p = polar(cx, cy, R * (pct / 100), -18)
        return (
          <text key={pct} x={(p.x + 4).toFixed(2)} y={(p.y + 3).toFixed(2)} fontSize={7} fill="#a78bfa" fontWeight="500">
            {pct}%
          </text>
        )
      })}

      {/* Data polygon */}
      <polygon points={dataPoints} fill="#7c3aed22" stroke="#7c3aed" strokeWidth={2} strokeLinejoin="round" />

      {/* Data dots */}
      {BIG_FIVE_DIMS.map((d, i) => {
        const val = (scores[d.key] ?? 0) / 100
        const p = polar(cx, cy, R * val, angles[i])
        return <circle key={d.key} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r={4} fill="#7c3aed" stroke="white" strokeWidth={1.5} />
      })}

      {/* Vertex labels */}
      {BIG_FIVE_DIMS.map((d, i) => {
        const deg = angles[i]
        const lp = polar(cx, cy, labelR, deg)
        const cosA = Math.cos((deg * Math.PI) / 180)
        const sinA = Math.sin((deg * Math.PI) / 180)
        const anchor = cosA > 0.25 ? 'start' : cosA < -0.25 ? 'end' : 'middle'
        const extraY = sinA > 0.3 ? 8 : sinA < -0.3 ? -4 : 0

        return (
          <g key={d.key}>
            <text x={lp.x.toFixed(2)} y={(lp.y + extraY - 5).toFixed(2)} textAnchor={anchor} fontSize={9} fontWeight="600" fill="#6b7280">
              {d.key}
            </text>
            <text x={lp.x.toFixed(2)} y={(lp.y + extraY + 6).toFixed(2)} textAnchor={anchor} fontSize={11} fontWeight="700" fill="#5b21b6">
              {scores[d.key] !== null && scores[d.key] !== undefined ? `${scores[d.key]}%` : '—'}
            </text>
          </g>
        )
      })}

      <circle cx={cx} cy={cy} r={2.5} fill="#c4b5fd" />
    </svg>
  )
}

export function BigFiveBars({ scores }: { scores: BigFiveScores }) {
  return (
    <div className="flex flex-col gap-3">
      {BIG_FIVE_DIMS.map((d) => {
        const val = scores[d.key]
        return (
          <div key={d.key}>
            <div className="flex items-center justify-between mb-1">
              <div>
                <span className="text-xs font-semibold text-gray-800">{d.label}</span>
                <span className="text-[10px] text-gray-400 ml-1">({d.key})</span>
              </div>
              <span className="text-xs font-bold" style={{ color: d.color }}>
                {val !== null && val !== undefined ? `${val}%` : '—'}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${val ?? 0}%`, backgroundColor: d.color }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">{d.desc}</p>
          </div>
        )
      })}
    </div>
  )
}

/** Mini preview: 5 pills coloridas com letra + % — para usar em tabelas */
export function BigFiveMini({ scores }: { scores: BigFiveScores }) {
  return (
    <div className="flex flex-wrap gap-1">
      {BIG_FIVE_DIMS.map((d) => {
        const val = scores[d.key]
        return (
          <span
            key={d.key}
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: d.color }}
          >
            {d.key}:{val !== null && val !== undefined ? val : '—'}
          </span>
        )
      })}
    </div>
  )
}
