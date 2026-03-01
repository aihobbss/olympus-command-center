"use client";

import { motion } from "framer-motion";
import { Store, GraduationCap, ArrowRight } from "lucide-react";
import { mockUsers, useAuthStore, useStoreContext, type MockUser } from "@/lib/store";
import { mockStores } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const roleConfig = {
  owner: {
    icon: Store,
    subtitle: "Store Owner",
    description: "Manage your store, track profits, and run ads",
    accentClass: "accent-emerald",
  },
  coach: {
    icon: GraduationCap,
    subtitle: "Coach",
    description: "Oversee student stores and manage your own",
    accentClass: "accent-indigo",
  },
};

function UserCard({ user, index }: { user: MockUser; index: number }) {
  const login = useAuthStore((s) => s.login);
  const setSelectedStore = useStoreContext((s) => s.setSelectedStore);
  const config = roleConfig[user.role];
  const Icon = config.icon;
  const storeCount = user.storeIds.length;

  function handleLogin() {
    // Set the user's first store as the selected store
    const firstStore = mockStores.find((s) => s.id === user.storeIds[0]);
    if (firstStore) setSelectedStore(firstStore);
    login(user);
  }

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 + index * 0.15 }}
      onClick={handleLogin}
      className={cn(
        "group relative w-full max-w-[340px] rounded-2xl p-6",
        "bg-bg-card border border-subtle",
        "hover:border-[var(--border-hover)] hover:bg-bg-elevated",
        "transition-all duration-300 text-left cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-accent-indigo/40"
      )}
    >
      {/* Glow on hover */}
      <div
        className={cn(
          "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
          user.role === "coach"
            ? "shadow-[0_0_40px_-10px_var(--accent-indigo)]"
            : "shadow-[0_0_40px_-10px_var(--accent-emerald)]"
        )}
      />

      {/* Avatar + info */}
      <div className="flex items-center gap-4 mb-4">
        <div
          className={cn(
            "w-14 h-14 rounded-full bg-gradient-to-br flex items-center justify-center ring-2 shrink-0",
            user.avatarGradient,
            user.role === "coach" ? "ring-accent-indigo/30" : "ring-accent-emerald/30"
          )}
        >
          <span className="text-white text-lg font-bold">{user.initials}</span>
        </div>
        <div>
          <h3 className="text-lg font-syne font-bold text-text-primary">
            {user.name}
          </h3>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full mt-0.5",
              user.role === "coach"
                ? "bg-accent-indigo/15 text-accent-indigo"
                : "bg-accent-emerald/15 text-accent-emerald"
            )}
          >
            <Icon size={12} />
            {config.subtitle}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-text-secondary mb-4">{config.description}</p>

      {/* Store count */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-text-muted">
          <span className="font-mono-metric font-jetbrains text-text-secondary">
            {storeCount}
          </span>{" "}
          {storeCount === 1 ? "store" : "stores"}
        </div>
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium transition-colors duration-200",
            user.role === "coach"
              ? "text-accent-indigo/60 group-hover:text-accent-indigo"
              : "text-accent-emerald/60 group-hover:text-accent-emerald"
          )}
        >
          Enter
          <ArrowRight
            size={14}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </div>
      </div>
    </motion.button>
  );
}

export function LoginScreen() {
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
          Select your profile to continue
        </p>
      </motion.div>

      {/* User cards */}
      <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10">
        {mockUsers.map((user, i) => (
          <UserCard key={user.id} user={user} index={i} />
        ))}
      </div>

      {/* Footer */}
      <motion.p
        className="mt-12 text-[11px] text-text-muted relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        Demo Mode &middot; No real authentication
      </motion.p>
    </div>
  );
}
