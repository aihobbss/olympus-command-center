import { Package } from "lucide-react";

export default function ImportPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-accent-indigo/10 flex items-center justify-center">
          <Package className="text-accent-indigo" size={20} strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-2xl font-syne font-bold tracking-tight">
            Import
          </h1>
          <p className="text-sm text-text-secondary">
            Bridge products into your store via Kopy
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-[var(--border-hover)] p-12 flex items-center justify-center min-h-[420px]">
        <p className="text-text-muted text-sm font-mono-metric">
          Module content &mdash; building next
        </p>
      </div>
    </div>
  );
}
