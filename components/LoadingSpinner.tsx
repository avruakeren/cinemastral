export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="cinema-loader" role="status" aria-live="polite">
      <div className="cinema-loader-stage">
        <span className="cinema-loader-ring" />
        <span className="cinema-loader-ring cinema-loader-ring-2" />
        <span className="cinema-loader-ring cinema-loader-ring-3" />
        <span className="cinema-loader-play">
          <i className="fa-solid fa-play" aria-hidden />
        </span>
      </div>
      {label && <span className="cinema-loader-label">{label}</span>}
    </div>
  );
}
