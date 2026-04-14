import { FiAlertCircle } from "react-icons/fi";
import clsx from "clsx";

/**
 * A standard component to display a summary of form validation errors.
 * Useful for long forms where inline errors might be scrolled out of view.
 */
const ValidationSummary = ({ errors, className }) => {
  const errorCount = Object.keys(errors || {}).length;
  
  if (errorCount === 0) return null;

  return (
    <div className={clsx(
      "mb-6 flex animate-in fade-in slide-in-from-top-2 duration-300 items-start gap-4 rounded-2xl border-2 border-rose-200 bg-rose-50/50 p-4 shadow-sm dark:border-rose-900/30 dark:bg-rose-900/20",
      className
    )}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-400">
        <FiAlertCircle className="h-6 w-6" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-rose-800 dark:text-rose-200">
          Please check {errorCount} {errorCount === 1 ? 'field' : 'fields'} before saving:
        </h4>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs font-medium text-rose-700/80 dark:text-rose-400/80">
          {Object.entries(errors).map(([key, error]) => (
            <li key={key}>
              <span className="capitalize">{key.replace(/_/g, " ")}</span>: {error.message || error}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ValidationSummary;
