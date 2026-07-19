import { Link, useRouteError } from "react-router-dom";

/** #51: catch-all for unknown URLs — renders inside the Layout chrome. */
export function NotFoundPage() {
  return (
    <div className="route-fallback">
      <h2>Page not found</h2>
      <p>There's nothing at this address.</p>
      <Link to="/log">Go to today's log</Link>
    </div>
  );
}

/** #51: root errorElement — a thrown render error lands here instead of a
 * white screen. Shows the error's message only (never a stack) and offers
 * the two recoveries that always work: reload, or start over at the log. */
export function RouteErrorPage() {
  const error = useRouteError();
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";
  return (
    <div className="route-fallback" role="alert">
      <h1>Somnus</h1>
      <h2>Something went wrong</h2>
      <p>{message}</p>
      <div className="route-fallback-actions">
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
        <a href="/log">Go to today's log</a>
      </div>
    </div>
  );
}
