"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function LoginScreen() {
  const signIn = useAuthStore((s) => s.signInWithEmail);
  const signUp = useAuthStore((s) => s.signUpWithEmail);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "login") {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
        setLoading(false);
      }
      // On success, onAuthStateChange in the store handles the rest
    } else {
      if (!fullName.trim()) {
        setError("Please enter your name");
        setLoading(false);
        return;
      }
      const result = await signUp(email, password, fullName.trim());
      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        setSignupSuccess(true);
        setLoading(false);
      }
    }
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
        <div className="w-10 h-10 rounded-xl bg-accent-indigo/15 flex items-center justify-center mx-auto mb-4">
          <div className="w-[8px] h-[8px] rounded-full bg-accent-indigo animate-[pulse-glow_3s_ease-in-out_infinite]" />
        </div>

        <h1 className="font-syne text-2xl sm:text-3xl font-bold tracking-[0.15em] text-text-primary uppercase mb-2">
          VANTAGE
        </h1>
        <p className="text-sm text-text-secondary">
          {mode === "login"
            ? "Sign in to your command center"
            : "Create your account"}
        </p>
      </motion.div>

      {/* Signup success message */}
      {signupSuccess ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-[380px] rounded-2xl p-8 bg-bg-card border border-subtle text-center"
        >
          <div className="w-12 h-12 rounded-full bg-accent-emerald/15 flex items-center justify-center mx-auto mb-4">
            <UserPlus size={20} className="text-accent-emerald" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Account Created</h2>
          <p className="text-sm text-text-secondary mb-6">
            Your account is pending approval. You&apos;ll be able to access the command center once an admin approves your account.
          </p>
          <button
            onClick={() => {
              setSignupSuccess(false);
              setMode("login");
              setPassword("");
            }}
            className={cn(
              "w-full px-4 py-3 rounded-xl text-sm font-medium",
              "bg-accent-indigo text-white",
              "hover:bg-accent-indigo/90 transition-all duration-200"
            )}
          >
            Back to Sign In
          </button>
        </motion.div>
      ) : (
        <>
          {/* Login / Signup form */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative z-10 w-full max-w-[380px] rounded-2xl p-8 bg-bg-card border border-subtle"
          >
            {/* Mode toggle tabs */}
            <div className="flex mb-6 rounded-lg bg-bg-primary p-1">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                className={cn(
                  "flex-1 py-2 text-xs font-medium rounded-md transition-all duration-200",
                  mode === "login"
                    ? "bg-bg-card text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(""); }}
                className={cn(
                  "flex-1 py-2 text-xs font-medium rounded-md transition-all duration-200",
                  mode === "signup"
                    ? "bg-bg-card text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                Sign Up
              </button>
            </div>

            {/* Full Name (signup only) */}
            {mode === "signup" && (
              <div className="mb-5">
                <label
                  htmlFor="fullName"
                  className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider"
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your name"
                  autoComplete="name"
                  className={cn(
                    "w-full px-4 py-3 rounded-xl text-sm text-text-primary placeholder:text-text-muted",
                    "bg-bg-primary border border-subtle",
                    "focus:outline-none focus:ring-2 focus:ring-accent-indigo/40 focus:border-accent-indigo/40",
                    "transition-all duration-200"
                  )}
                />
              </div>
            )}

            {/* Email */}
            <div className="mb-5">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
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
                  placeholder={mode === "signup" ? "Min 6 characters" : "Enter password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
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
              disabled={loading || !email || !password}
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
              ) : mode === "login" ? (
                <>
                  <LogIn size={16} />
                  Sign In
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Create Account
                </>
              )}
            </button>
          </motion.form>
        </>
      )}
    </div>
  );
}
