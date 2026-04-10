import clsx from "clsx";

const badgeStyles = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

function MetricCard({ card }) {
  const Icon = card.icon;

  return (
    <article className={clsx("card-shell p-5", card.accentBorder)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={clsx("flex h-11 w-11 items-center justify-center rounded-xl", card.iconBg)}>
          <Icon className={clsx("h-5 w-5", card.iconColor)} />
        </div>
        {card.badge ? (
          <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", badgeStyles[card.badgeTone])}>
            {card.badge}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <p className={clsx(
          "font-black tracking-tight text-slate-900 dark:text-zinc-50 leading-none break-all",
          card.value.length > 12 ? "text-2xl" : card.value.length > 8 ? "text-3xl" : "text-4xl"
        )}>
          {card.value}
        </p>
        <p className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wide">{card.title}</p>
      </div>
      <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 leading-relaxed">{card.detail}</p>
    </article>
  );
}

export default MetricCard;
