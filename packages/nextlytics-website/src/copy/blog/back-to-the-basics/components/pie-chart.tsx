type Segment = {
  label: string;
  value: number;
  color: string;
};

type PieChartProps = {
  data: Segment[];
  size?: number;
  title?: string;
};

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  // Handle full circle case
  if (endAngle - startAngle >= 359.99) {
    const mid = (startAngle + endAngle) / 2;
    return describeArc(cx, cy, r, startAngle, mid) + " " + describeArc(cx, cy, r, mid, endAngle);
  }

  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

export function PieChart({ data, size = 120, title }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  let currentAngle = 0;
  const segments = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const angle = (d.value / total) * 360;
      const path = describeArc(cx, cy, r, currentAngle, currentAngle + angle);
      currentAngle += angle;
      return { ...d, path };
    });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((segment, i) => (
          <path key={i} d={segment.path} fill={segment.color} />
        ))}
      </svg>
      {title && <div className="text-sm font-medium text-center">{title}</div>}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {data
          .filter((d) => d.value > 0)
          .map((d, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span>
                {d.label} {d.value}%
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

type TrackingComparisonProps = {
  metric: "size" | "requests";
};

const siteData = {
  "NY Post": { content: 95.6, tracking: 1.1, ads: 2.2, other: 1.1 },
  "NY Times": { content: 93.1, tracking: 1.6, ads: 5.3, other: 0 },
  WSJ: { content: 50.9, tracking: 33.6, ads: 14.1, other: 1.4 },
};

const requestData = {
  "NY Post": { content: 16, tracking: 42, ads: 30, other: 12 },
  "NY Times": { content: 66, tracking: 6, ads: 22, other: 6 },
  WSJ: { content: 40, tracking: 13, ads: 28, other: 19 },
};

const colors = {
  content: "#8b5cf6", // violet
  tracking: "#ef4444", // red
  ads: "#f97316", // orange
  other: "#94a3b8", // slate
};

export function TrackingComparison({ metric }: TrackingComparisonProps) {
  const data = metric === "size" ? siteData : requestData;
  const title = metric === "size" ? "By Download Size" : "By Network Requests";

  return (
    <div className="not-prose my-8">
      <h4 className="text-center font-semibold mb-6">{title}</h4>
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(data).map(([site, values]) => (
          <PieChart
            key={site}
            title={site}
            data={[
              { label: "Content", value: values.content, color: colors.content },
              { label: "Tracking", value: values.tracking, color: colors.tracking },
              { label: "Ads", value: values.ads, color: colors.ads },
              { label: "Other", value: values.other, color: colors.other },
            ]}
          />
        ))}
      </div>
    </div>
  );
}
