export interface ProgressProps {
  /** 0–100 */
  value: number;
}

/** VERA Progress bar. */
export const Progress = ({ value }: ProgressProps) => {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className="vera-progress"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="vera-progress__fill" style={{ width: `${clamped}%` }} />
    </div>
  );
};
