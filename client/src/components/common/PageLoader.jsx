export function PageLoader({
  title = 'Flowboard',
  message = 'Restoring your session…',
  action = null,
}) {
  return (
    <main
      className="page-loader"
      role={action ? 'alert' : 'status'}
      aria-live="polite"
      aria-busy={!action}
    >
      <div className="page-loader-card">
        <span className="page-loader-mark" aria-hidden="true">
          F
        </span>
        {!action && <span className="spinner spinner-lg" aria-hidden="true" />}
        <h1>{title}</h1>
        <p>{message}</p>
        {!action && (
          <div className="page-loader-bar" aria-hidden="true">
            <span />
          </div>
        )}
        {action}
      </div>
    </main>
  );
}
