/**
 * Charts: simple bar charts drawn with SVG (no chart library).
 *   <BarChart data={[{ label, value }]} />
 *   <StackedBars data={[{ label, rent, sale }]} />
 */
export function BarChart({ data, height = 220, label = 'Bar chart' }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 560; const pad = 28; const bw = (w - pad * 2) / data.length;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${height}`} role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}>
        {[0, 0.5, 1].map((t) => <line key={t} x1={pad} x2={w - pad} y1={height - 30 - t * (height - 60)} y2={height - 30 - t * (height - 60)} stroke="#e2e0d8" />)}
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 60);
          const x = pad + i * bw + bw * 0.2;
          return (
            <g key={d.label}>
              <rect className="bar" x={x} y={height - 30 - h} width={bw * 0.6} height={Math.max(h, 1)} rx="6"><title>{`${d.label}: ${d.value}`}</title></rect>
              <text className="val" x={x + bw * 0.3} y={height - 36 - h} textAnchor="middle">{d.value}</text>
              <text x={x + bw * 0.3} y={height - 10} textAnchor="middle">{d.label.split(' ')[0]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function StackedBars({ data, label = 'Stacked bar chart' }) {
  const max = Math.max(1, ...data.map((d) => d.rent + d.sale));
  const w = 460; const rowH = 38; const left = 92; const h = data.length * rowH + 10;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.rent} for rent, ${d.sale} for sale`).join('; ')}`}>
        {data.map((d, i) => {
          const scale = (w - left - 40) / max;
          const y = i * rowH + 8;
          return (
            <g key={d.label}>
              <text x={left - 10} y={y + 17} textAnchor="end">{d.label.charAt(0).toUpperCase() + d.label.slice(1)}</text>
              <rect className="bar" x={left} y={y} width={Math.max(d.rent * scale, 0)} height="24" rx="5"><title>{`${d.rent} for rent`}</title></rect>
              <rect className="bar-2" x={left + d.rent * scale} y={y} width={Math.max(d.sale * scale, 0)} height="24" rx="5"><title>{`${d.sale} for sale`}</title></rect>
              <text className="val" x={left + (d.rent + d.sale) * scale + 8} y={y + 17}>{d.rent + d.sale}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend"><span><i style={{ background: 'var(--emerald)' }} />For rent</span><span><i style={{ background: 'var(--amber)' }} />For sale</span></div>
    </div>
  );
}
