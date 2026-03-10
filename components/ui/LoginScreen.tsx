"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { mockUsers, useAuthStore, useStoreContext } from "@/lib/store";
import { mockStores } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const setSelectedStore = useStoreContext((s) => s.setSelectedStore);

  const [username, setUsername] = useState("simo");
  const [password, setPassword] = useState("olympus");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Demo validation — accepts "simo" / "olympus" (case-insensitive)
    const user = mockUsers.find(
      (u) => u.name.toLowerCase() === username.trim().toLowerCase()
    );

    if (!user || password !== "olympus") {
      setError("Invalid username or password");
      return;
    }

    setLoading(true);
    // Brief delay for feel
    setTimeout(() => {
      const firstStore = mockStores.find((s) => s.id === user.storeIds[0]);
      if (firstStore) setSelectedStore(firstStore);
      login(user);
    }, 400);
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-6">
      {/* Background subtle gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--accent-indigo)_0%,_transparent_70%)] opacity-[0.03] pointer-events-none" />

      {/* Logo + heading */}
      <motion.div
        className="text-center mb-10 relative z-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Indigo dot */}
        <div className="w-10 h-10 rounded-xl bg-accent-indigo/15 flex items-center justify-center mx-auto mb-4">
          <div className="w-[8px] h-[8px] rounded-full bg-accent-indigo animate-[pulse-glow_3s_ease-in-out_infinite]" />
        </div>

        <h1 className="font-syne text-2xl sm:text-3xl font-bold tracking-[0.15em] text-text-primary uppercase mb-2">
          OLYMPUS
        </h1>
        <p className="text-sm text-text-secondary">
          Sign in to your command center
        </p>
      </motion.div>

      {/* Login form */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative z-10 w-full max-w-[380px] rounded-2xl p-8 bg-bg-card border border-subtle"
      >
        {/* Username */}
        <div className="mb-5">
          <label
            htmlFor="username"
            className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            autoComplete="username"
            className={cn(
              "w-full px-4 py-3 rounded-xl text-sm text-text-primary placeholder:text-text-muted",
              "bg-bg-primary border border-subtle",
              "focus:outline-none focus:ring-2 focus:ring-accent-indigo/40 focus:border-accent-indigo/40",
              "transition-all duration-200"
            )}
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label
            htmlFor="password"
            className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              className={cn(
                "w-full px-4 py-3 pr-11 rounded-xl text-sm text-text-primary placeholder:text-text-muted",
                "bg-bg-primary border border-subtle",
                "focus:outline-none focus:ring-2 focus:ring-accent-indigo/40 focus:border-accent-indigo/40",
                "transition-all duration-200"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-accent-red mb-4"
          >
            {error}
          </motion.p>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading || !username || !password}
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
              <LogIn size={16} />
              Sign In
            </>
          )}
        </button>
      </motion.form>

      {/* Hint */}
      <motion.p
        className="mt-6 text-[11px] text-text-muted relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        Demo: username <span className="text-text-secondary font-medium">simo</span> &middot; password <span className="text-text-secondary font-medium">olympus</span>
      </motion.p>
    </div>
  );
}
