import React, { useState } from 'react';
import { IQ_PILLARS } from '../curriculum/PillarsData';
import { IqPillarId, PlayerProfile } from '../types/hockey';

interface IqRadarDashboardProps {
  profile: PlayerProfile;
  tierLabel: string;
  redemptionPending: number;
  onTrainPillar: (pillar: IqPillarId | null) => void;
}

export const IqRadarDashboard: React.FC<IqRadarDashboardProps> = ({
  profile,
  tierLabel,
  redemptionPending,
  onTrainPillar,
}) => {
  const [selectedPillarId, setSelectedPillarId] = useState<IqPillarId>('BREAKOUT_PRESSURE');
  const selectedPillar =
    IQ_PILLARS.find((p) => p.id === selectedPillarId) ?? IQ_PILLARS[0];

  const cx = 175;
  const cy = 175;
  const maxR = 118;
  const count = IQ_PILLARS.length;

  const polygonPoints = IQ_PILLARS.map((p, idx) => {
    const angle = (Math.PI * 2 * idx) / count - Math.PI * 0.5;
    const val = (profile.pillarMastery[p.id] ?? 40) / 100;
    const r = Math.max(14, val * maxR);
    return `${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`;
  }).join(' ');

  const accuracy =
    profile.repsCompleted > 0
      ? Math.round(
          ((profile.goldCount + profile.silverCount * 0.7) / profile.repsCompleted) * 100
        )
      : 100;

  return (
    <div className="iq-dashboard-stage" data-testid="iq-radar-dashboard">
      <div className="iq-hero-row">
        <div className="iq-stat-card">
          <span className="stat-kicker">LIVE HOCKEY IQ</span>
          <strong className="stat-big">{profile.iqScore}</strong>
          <span className="stat-sub">{tierLabel}</span>
        </div>
        <div className="iq-stat-card">
          <span className="stat-kicker">READ ACCURACY</span>
          <strong className="stat-big">{accuracy}%</strong>
          <span className="stat-sub">
            🥇{profile.goldCount} · 🥈{profile.silverCount} · ⏪{profile.turnoverCount}
          </span>
        </div>
        <div className="iq-stat-card">
          <span className="stat-kicker">SHIFT STREAK</span>
          <strong className="stat-big">🔥 {profile.streak}</strong>
          <span className="stat-sub">
            Best {profile.bestStreak} · 🔁 {redemptionPending} Queued
          </span>
        </div>
        <button
          type="button"
          className="touch-btn primary-cta-btn start-shift-cta"
          onClick={() => onTrainPillar(null)}
          data-testid="dashboard-start-shift-btn"
        >
          ⚡ Drop Puck — Live Shift
        </button>
      </div>

      <div className="iq-main-grid">
        <div className="radar-card">
          <svg
            viewBox="0 0 350 350"
            className="radar-svg"
            aria-label="16-Pillar Hockey IQ Mastery Radar"
          >
            {[0.25, 0.5, 0.75, 1.0].map((ring) => (
              <circle
                key={ring}
                cx={cx}
                cy={cy}
                r={maxR * ring}
                fill="none"
                stroke="rgba(148, 163, 184, 0.2)"
                strokeWidth="1"
              />
            ))}

            {IQ_PILLARS.map((p, idx) => {
              const angle = (Math.PI * 2 * idx) / count - Math.PI * 0.5;
              const x2 = cx + Math.cos(angle) * maxR;
              const y2 = cy + Math.sin(angle) * maxR;
              const lx = cx + Math.cos(angle) * (maxR + 24);
              const ly = cy + Math.sin(angle) * (maxR + 24);
              const isSel = p.id === selectedPillarId;
              return (
                <g
                  key={p.id}
                  onClick={() => setSelectedPillarId(p.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <line
                    x1={cx}
                    y1={cy}
                    x2={x2}
                    y2={y2}
                    stroke={isSel ? '#38bdf8' : 'rgba(148, 163, 184, 0.22)'}
                    strokeWidth={isSel ? '2' : '1'}
                  />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isSel ? '#38bdf8' : '#cbd5e1'}
                    fontSize="10"
                    fontWeight="700"
                  >
                    {p.code}
                  </text>
                </g>
              );
            })}

            <polygon
              points={polygonPoints}
              fill="rgba(14, 165, 233, 0.34)"
              stroke="#38bdf8"
              strokeWidth="2.5"
            />
          </svg>
        </div>

        <div className="pillar-detail-column">
          <div className="saturday-habit-card">
            <div className="habit-header">
              <span className="pillar-quad-tag">{selectedPillar.quadrant}</span>
              <span className="pillar-pct-badge">
                {profile.pillarMastery[selectedPillar.id]}% Mastery
              </span>
            </div>
            <h3>
              {selectedPillar.code} · {selectedPillar.title}
            </h3>
            <p className="habit-cue">{selectedPillar.cueSummary}</p>
            <div className="habit-ice-box">
              <strong>🏒 Saturday Ice Transfer Habit:</strong>
              <p>{selectedPillar.saturdayHabit}</p>
            </div>
            <button
              type="button"
              className="touch-btn primary-cta-btn"
              onClick={() => onTrainPillar(selectedPillar.id)}
              data-testid="train-selected-pillar-btn"
            >
              ▶ Train {selectedPillar.shortTitle} Now
            </button>
          </div>

          <div className="pillars-pill-grid" role="list" aria-label="All 16 Tactical IQ Pillars">
            {IQ_PILLARS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`touch-btn pillar-chip ${selectedPillarId === p.id ? 'active-pill' : ''}`}
                onClick={() => setSelectedPillarId(p.id)}
                data-testid={`pillar-chip-${p.id}`}
              >
                <span>{p.code}</span>
                <span>{p.shortTitle}</span>
                <strong>{profile.pillarMastery[p.id]}%</strong>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
