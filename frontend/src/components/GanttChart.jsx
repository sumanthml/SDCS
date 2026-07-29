import { useState, useCallback, useRef } from 'react';

/* ─── Job color palette (CSS vars) ─── */
const JOB_COLORS = [
  'hsl(243,75%,65%)', 'hsl(188,85%,52%)', 'hsl(152,65%,48%)',
  'hsl(38,90%,58%)', 'hsl(355,75%,62%)', 'hsl(270,68%,64%)',
  'hsl(320,70%,60%)', 'hsl(60,80%,54%)', 'hsl(24,85%,58%)', 'hsl(170,72%,48%)',
];

function getJobColor(jobId, jobIndex) {
  return JOB_COLORS[jobIndex % JOB_COLORS.length];
}

function buildColorMap(schedule) {
  const map = {};
  let idx = 0;
  schedule.forEach(task => {
    if (!(task.job_id in map)) {
      map[task.job_id] = { color: getJobColor(task.job_id, idx), name: task.job_name };
      idx++;
    }
  });
  return map;
}

export default function GanttChart({ schedule, makespan, algorithmName }) {
  const [tooltip, setTooltip] = useState(null);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef(null);

  if (!schedule || schedule.length === 0) {
    return (
      <div style={{ padding: 'var(--sp-xl)', textAlign: 'center', color: 'var(--clr-text-muted)' }}>
        No schedule data to display. Run a simulation first.
      </div>
    );
  }

  // Build machine list (ordered by first appearance)
  const machineOrder = [];
  const machineSet = new Set();
  schedule.forEach(t => {
    if (!machineSet.has(t.machine_id)) {
      machineSet.add(t.machine_id);
      machineOrder.push({ id: t.machine_id, name: t.machine_name });
    }
  });

  const colorMap = buildColorMap(schedule);

  // Chart dimensions
  const ROW_HEIGHT = 48;
  const LABEL_W = 140;
  const PADDING = 16;
  const TICK_COUNT = 10;
  const chartW = Math.max(600, 800 * zoom);
  const chartH = machineOrder.length * ROW_HEIGHT + PADDING * 2 + 30; // +30 for time axis

  const scaleX = (time) => LABEL_W + (time / makespan) * (chartW - LABEL_W - PADDING);

  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
    Math.round((makespan / TICK_COUNT) * i)
  );

  const handleMouseEnter = (e, task) => {
    setTooltip({
      x: e.clientX + 14,
      y: e.clientY - 10,
      task,
      color: colorMap[task.job_id]?.color,
    });
  };
  const handleMouseLeave = () => setTooltip(null);
  const handleMouseMove = (e) => {
    if (tooltip) setTooltip(prev => prev ? { ...prev, x: e.clientX + 14, y: e.clientY - 10 } : null);
  };

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* Zoom controls */}
      <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--sp-sm)', justifyContent: 'flex-end' }}>
        <span className="text-xs text-muted">Zoom:</span>
        {[0.7, 1, 1.5, 2, 3].map(z => (
          <button
            key={z}
            id={`gantt-zoom-${z}`}
            className={`btn btn-sm ${zoom === z ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setZoom(z)}
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
          >
            {z === 1 ? 'Fit' : `${z}×`}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-sm" style={{ flexWrap: 'wrap', marginBottom: 'var(--sp-sm)' }}>
        {Object.entries(colorMap).map(([jobId, { color, name }]) => (
          <div key={jobId} className="flex items-center gap-xs" style={{ fontSize: '0.75rem', color: 'var(--clr-text-secondary)' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
            <span>{name}</span>
          </div>
        ))}
      </div>

      {/* SVG Gantt */}
      <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <svg
          ref={svgRef}
          width={chartW}
          height={chartH}
          onMouseMove={handleMouseMove}
          aria-label={`Gantt chart for ${algorithmName} algorithm`}
          role="img"
          style={{ display: 'block' }}
        >
          {/* Background grid */}
          {ticks.map((tick, i) => {
            const x = scaleX(tick);
            return (
              <g key={i}>
                <line x1={x} y1={PADDING} x2={x} y2={chartH - 30}
                  stroke="hsla(228,20%,30%,0.4)" strokeWidth={1} strokeDasharray="4 4" />
                <text x={x} y={chartH - 10} textAnchor="middle"
                  fill="hsl(220,10%,42%)" fontSize="11" fontFamily="JetBrains Mono, monospace">
                  {tick}m
                </text>
              </g>
            );
          })}

          {/* Machine rows */}
          {machineOrder.map((machine, mIdx) => {
            const y = PADDING + mIdx * ROW_HEIGHT;
            const tasks = schedule.filter(t => t.machine_id === machine.id);

            return (
              <g key={machine.id}>
                {/* Row background alternating */}
                <rect
                  x={LABEL_W}
                  y={y}
                  width={chartW - LABEL_W - PADDING}
                  height={ROW_HEIGHT - 4}
                  rx={0}
                  fill={mIdx % 2 === 0 ? 'hsla(228,20%,10%,0.4)' : 'hsla(228,20%,7%,0.4)'}
                />

                {/* Machine label */}
                <text
                  x={LABEL_W - 10}
                  y={y + ROW_HEIGHT / 2 + 1}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="hsl(220,12%,65%)"
                  fontSize="12"
                  fontFamily="Inter, sans-serif"
                  fontWeight="600"
                >
                  {machine.name.length > 14 ? machine.name.slice(0, 13) + '…' : machine.name}
                </text>

                {/* Task bars */}
                {tasks.map((task) => {
                  const x1 = scaleX(task.start_time);
                  const x2 = scaleX(task.end_time);
                  const barW = Math.max(x2 - x1, 2);
                  const color = colorMap[task.job_id]?.color || '#7c6aff';
                  const barH = ROW_HEIGHT - 10;
                  const barY = y + 5;

                  return (
                    <g
                      key={`${task.job_id}-${task.step_number}`}
                      onMouseEnter={(e) => handleMouseEnter(e, task)}
                      onMouseLeave={handleMouseLeave}
                      style={{ cursor: 'pointer' }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${task.job_name} Step ${task.step_number}: ${task.start_time}–${task.end_time} min`}
                    >
                      {/* Bar shadow */}
                      <rect x={x1 + 1} y={barY + 2} width={barW} height={barH} rx={4}
                        fill="hsla(0,0%,0%,0.3)" />
                      {/* Main bar */}
                      <rect x={x1} y={barY} width={barW} height={barH} rx={4}
                        fill={color} fillOpacity={task.is_emergency ? 0.65 : 0.85} />
                      {/* Glossy highlight */}
                      <rect x={x1 + 1} y={barY + 1} width={Math.max(barW - 2, 1)} height={barH / 3} rx={3}
                        fill="hsla(0,0%,100%,0.18)" />
                      {/* Emergency indicator */}
                      {task.is_emergency && (
                        <rect x={x1} y={barY} width={4} height={barH} rx={4}
                          fill="hsl(355,80%,60%)" />
                      )}
                      {/* Step label if bar wide enough */}
                      {barW > 32 && (
                        <text
                          x={x1 + barW / 2}
                          y={barY + barH / 2 + 1}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#fff"
                          fontSize="10"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="700"
                        >
                          {task.job_name.length > 8 ? `S${task.step_number}` : `${task.job_name.slice(0, 5)} S${task.step_number}`}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Makespan vertical line */}
          {makespan > 0 && (
            <g>
              <line
                x1={scaleX(makespan)} y1={PADDING}
                x2={scaleX(makespan)} y2={chartH - 30}
                stroke="hsl(355,80%,60%)" strokeWidth={2} strokeDasharray="6 3"
              />
              <text x={scaleX(makespan) - 6} y={PADDING - 4}
                textAnchor="end" fill="hsl(355,80%,60%)" fontSize="10" fontFamily="JetBrains Mono, monospace">
                Makespan: {makespan}m
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="gantt-tooltip"
          style={{ left: tooltip.x, top: tooltip.y, borderColor: tooltip.color }}
          aria-live="polite"
        >
          <div className="flex items-center gap-xs" style={{ marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: tooltip.color, flexShrink: 0 }} />
            <h6>{tooltip.task.job_name}</h6>
            {tooltip.task.is_emergency && (
              <span className="badge badge-danger" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>RUSH</span>
            )}
          </div>
          <div className="tt-row"><span>Step</span><span className="tt-val">#{tooltip.task.step_number}</span></div>
          <div className="tt-row"><span>Machine</span><span className="tt-val">{tooltip.task.machine_name}</span></div>
          <div className="tt-row"><span>Start</span><span className="tt-val">{tooltip.task.start_time} min</span></div>
          <div className="tt-row"><span>End</span><span className="tt-val">{tooltip.task.end_time} min</span></div>
          <div className="tt-row"><span>Duration</span><span className="tt-val">{tooltip.task.duration} min</span></div>
        </div>
      )}
    </div>
  );
}
