import { Component } from "react";
import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";

/**
 * ErrorBoundary — wraps dashboard cards and page sections.
 * If a child component throws, only that section shows the fallback;
 * the rest of the page stays intact.
 *
 * Usage:
 *   <ErrorBoundary label="Sales Forecast">
 *     <AiSalesForecastCard />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const label = this.props.label || "This section";

    return (
      <section className="card-shell flex min-h-[200px] flex-col items-center justify-center gap-4 p-8 text-center border-dashed border-2 border-rose-100 dark:border-rose-900/30 bg-rose-50/30 dark:bg-rose-900/10">
        <div className="rounded-full bg-rose-100 dark:bg-rose-900/40 p-3">
          <FiAlertTriangle className="h-6 w-6 text-rose-500" />
        </div>
        <div>
          <p className="text-sm font-black text-slate-700 dark:text-zinc-200 uppercase tracking-widest">
            {label} Unavailable
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
            An unexpected error occurred in this panel.
          </p>
        </div>
        <button
          onClick={() => this.handleReset()}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-zinc-100 px-4 py-2 text-xs font-bold text-white dark:text-zinc-950 hover:scale-105 transition-transform"
        >
          <FiRefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </section>
    );
  }
}

export default ErrorBoundary;
