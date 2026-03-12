"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Store, ArrowRight, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const MARKETS = [
  { value: "UK", label: "United Kingdom", currency: "GBP", symbol: "£", rate: 1.27 },
  { value: "AU", label: "Australia", currency: "AUD", symbol: "A$", rate: 0.65 },
  { value: "USA", label: "United States", currency: "USD", symbol: "$", rate: 1.0 },
  { value: "EU", label: "Europe", currency: "EUR", symbol: "€", rate: 1.09 },
  { value: "CA", label: "Canada", currency: "CAD", symbol: "C$", rate: 0.73 },
] as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function StoreSetup() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const initialize = useAuthStore((s) => s.initialize);

  const [storeName, setStoreName] = useState("");
  const [market, setMarket] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedMarket = MARKETS.find((m) => m.value === market);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!storeName.trim()) {
      setError("Please enter a store name");
      return;
    }
    if (!market) {
      setError("Please select a market");
      return;
    }
    if (!selectedMarket || !user) return;

    setLoading(true);

    const storeId = slugify(storeName.trim());
    if (!storeId) {
      setError("Store name must contain at least one letter or number");
      setLoading(false);
      return;
    }

    // Create the store
    const { error: storeError } = await supabase.from("stores").insert({
      id: storeId,
      name: storeName.trim(),
      market: selectedMarket.value,
      currency: selectedMarket.currency,
      owner_id: user.id,
      exchange_rate_to_usd: selectedMarket.rate,
    });

    if (storeError) {
      if (storeError.code === "23505") {
        setError("A store with that name already exists. Try a different name.");
      } else {
        setError(storeError.message);
      }
      setLoading(false);
      return;
    }

    // Link user to store
    const { error: linkError } = await supabase.from("user_stores").insert({
      user_id: user.id,
      store_id: storeId,
      role: "owner",
    });

    if (linkError) {
      setError(linkError.message);
      setLoading(false);
      return;
    }

    // Update profile with active store
    await supabase
      .from("profiles")
      .update({ active_store_id: storeId })
      .eq("id", user.id);

    // Re-initialize auth to pick up the new store
    // Reset initialized flag so it refetches
    useAuthStore.setState({ initialized: false, loading: true });
    await initialize();
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--accent-indigo)_0%,_transparent_70%)] opacity-[0.03] pointer-events-none" />

      {/* Header */}
      <motion.div
        className="text-center mb-10 relative z-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-12 h-12 rounded-xl bg-accent-indigo/15 flex items-center justify-center mx-auto mb-4">
          <Store size={22} className="text-accent-indigo" />
        </div>
        <h1 className="font-syne text-xl sm:text-2xl font-bold text-text-primary mb-2">
          Set Up Your Store
        </h1>
        <p className="text-sm text-text-secondary max-w-[340px]">
          Welcome {user?.name}! Create your first store to get started. You can add more stores later.
        </p>
      </motion.div>

      {/* Form */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative z-10 w-full max-w-[420px] rounded-2xl p-8 bg-bg-card border border-subtle"
      >
        {/* Store Name */}
        <div className="mb-5">
          <label
            htmlFor="storeName"
            className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider"
          >
            Store Name
          </label>
          <input
            id="storeName"
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="e.g. Vantage Melbourne"
            className={cn(
              "w-full px-4 py-3 rounded-xl text-sm text-text-primary placeholder:text-text-muted",
              "bg-bg-primary border border-subtle",
              "focus:outline-none focus:ring-2 focus:ring-accent-indigo/40 focus:border-accent-indigo/40",
              "transition-all duration-200"
            )}
          />
          {storeName.trim() && (
            <p className="mt-1.5 text-[11px] text-text-muted">
              Store ID: <span className="font-mono-metric text-text-secondary">{slugify(storeName.trim()) || "—"}</span>
            </p>
          )}
        </div>

        {/* Market */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">
            Market
          </label>
          <div className="grid grid-cols-2 gap-2">
            {MARKETS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMarket(m.value)}
                className={cn(
                  "px-3 py-2.5 rounded-xl text-sm text-left border transition-all duration-200",
                  market === m.value
                    ? "border-accent-indigo/50 bg-accent-indigo/[0.08] text-text-primary"
                    : "border-subtle bg-bg-primary text-text-secondary hover:border-border-hover hover:bg-white/[0.02]"
                )}
              >
                <span className="font-medium">{m.value}</span>
                <span className="text-text-muted text-xs ml-1.5">{m.symbol}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Currency display */}
        {selectedMarket && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-6 px-4 py-3 rounded-xl bg-bg-primary border border-subtle"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted uppercase tracking-wider">Currency</span>
              <span className="text-sm font-medium text-text-primary font-mono-metric">
                {selectedMarket.currency} ({selectedMarket.symbol})
              </span>
            </div>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-accent-red mb-4"
          >
            {error}
          </motion.p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !storeName.trim() || !market}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium",
            "bg-accent-indigo text-white",
            "hover:bg-accent-indigo/90 transition-all duration-200",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "focus:outline-none focus:ring-2 focus:ring-accent-indigo/40"
          )}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Create Store
              <ArrowRight size={16} />
            </>
          )}
        </button>

        {/* Sign out link */}
        <button
          type="button"
          onClick={() => logout()}
          className="w-full mt-3 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          <LogOut size={12} />
          Sign out
        </button>
      </motion.form>
    </div>
  );
}
