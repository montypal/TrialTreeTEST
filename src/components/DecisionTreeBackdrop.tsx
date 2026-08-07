'use client';

// A calm, on-brand animated decision tree used to fill space behind the
// welcome screen. Branch lines draw themselves in, nodes gently breathe, and
// soft pulses travel down a few branches. Pure SVG — no dependencies.

type Node = { id: number; x: number; y: number; r: number; c: string };

const NODES: Node[] = [
  { id: 0, x: 110, y: 260, r: 11, c: '#3b82f6' },
  { id: 1, x: 360, y: 120, r: 8, c: '#8b5cf6' },
  { id: 2, x: 360, y: 260, r: 8, c: '#10b981' },
  { id: 3, x: 360, y: 400, r: 8, c: '#f59e0b' },
  { id: 4, x: 620, y: 70, r: 6.5, c: '#3b82f6' },
  { id: 5, x: 620, y: 165, r: 6.5, c: '#10b981' },
  { id: 6, x: 620, y: 260, r: 6.5, c: '#8b5cf6' },
  { id: 7, x: 620, y: 355, r: 6.5, c: '#f59e0b' },
  { id: 8, x: 620, y: 450, r: 6.5, c: '#10b981' },
  { id: 9, x: 840, y: 165, r: 5.5, c: '#3b82f6' },
  { id: 10, x: 840, y: 355, r: 5.5, c: '#8b5cf6' },
];

const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 4],
  [1, 5],
  [2, 6],
  [3, 7],
  [3, 8],
  [5, 9],
  [7, 10],
];

// Which edges carry a traveling pulse.
const PULSES = [0, 2, 4, 7];

const byId = (id: number) => NODES[id];

function edgePath([a, b]: [number, number]): string {
  const p = byId(a);
  const q = byId(b);
  const dx = q.x - p.x;
  return `M ${p.x} ${p.y} C ${p.x + dx * 0.5} ${p.y}, ${q.x - dx * 0.5} ${q.y}, ${q.x} ${q.y}`;
}

export function DecisionTreeBackdrop({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 900 520"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden
      fill="none"
    >
      {/* Branch lines */}
      {EDGES.map((e, i) => (
        <path
          key={`e${i}`}
          d={edgePath(e)}
          className="dt-line"
          stroke="#c3cfe2"
          strokeWidth={2}
          strokeLinecap="round"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}

      {/* Nodes: soft halo + core */}
      {NODES.map((n) => (
        <g key={`n${n.id}`}>
          <circle cx={n.x} cy={n.y} r={n.r * 2.4} fill={n.c} opacity={0.12} />
          <circle
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.c}
            className="dt-node"
            style={{ animationDelay: `${n.id * 0.32}s` }}
          />
        </g>
      ))}

      {/* Traveling pulses down a few branches */}
      {PULSES.map((edgeIdx, i) => {
        const d = edgePath(EDGES[edgeIdx]);
        const color = byId(EDGES[edgeIdx][1]).c;
        return (
          <circle key={`p${i}`} r={3.6} fill="#ffffff" stroke={color} strokeWidth={1.6} opacity={0}>
            <animateMotion
              dur="3.4s"
              begin={`${i * 0.8}s`}
              repeatCount="indefinite"
              path={d}
              rotate="0"
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.12;0.88;1"
              dur="3.4s"
              begin={`${i * 0.8}s`}
              repeatCount="indefinite"
            />
          </circle>
        );
      })}
    </svg>
  );
}
