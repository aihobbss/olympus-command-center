"use client";

import { ExternalLink, CheckCircle2, AlertCircle, Unplug, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceId } from "@/lib/services/connections";

// ── Service brand colors + icons ─────────────────────────

const SERVICE_STYLES: Record<
  ServiceId,
  { gradient: string; accent: string; accentBg: string; label: string }
> = {
  shopify: {
    gradient: "from-[#95BF47]/20 to-[#95BF47]/5",
    accent: "text-[#95BF47]",
    accentBg: "bg-[#95BF47]",
    label: "Shopify",
  },
  facebook: {
    gradient: "from-[#1877F2]/20 to-[#1877F2]/5",
    accent: "text-[#1877F2]",
    accentBg: "bg-[#1877F2]",
    label: "Meta Ads",
  },
  nanobanana: {
    gradient: "from-accent-amber/20 to-accent-amber/5",
    accent: "text-accent-amber",
    accentBg: "bg-accent-amber",
    label: "Nanobanana Pro",
  },
  anthropic: {
    gradient: "from-[#D97706]/20 to-[#D97706]/5",
    accent: "text-[#D97706]",
    accentBg: "bg-[#D97706]",
    label: "Claude AI",
  },
};

// Simple SVG logos
function ServiceIcon({ service, size = 24 }: { service: ServiceId; size?: number }) {
  if (service === "shopify") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M15.34 3.8c-.07-.04-.13-.04-.2-.01-.06.03-1.42.42-1.42.42s-.94-2.6-1.04-2.88c-.1-.28-.3-.42-.52-.44h-.02c-.06 0-.14.02-.22.04L10.2 1.3C10.06.72 9.74.24 9.16.24c-.06 0-.12 0-.18.02C8.82.08 8.62 0 8.42 0 7.06 0 5.94 1.74 5.56 3.12L4.12 3.56c-.44.14-.46.16-.52.58-.04.32-1.2 9.24-1.2 9.24L11.68 15l5.62-1.2S15.42 3.84 15.34 3.8z"
          fill="currentColor"
          className={SERVICE_STYLES[service].accent}
          transform="translate(2, 4) scale(0.85)"
        />
      </svg>
    );
  }
  if (service === "facebook") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z"
          fill="currentColor"
          className={SERVICE_STYLES[service].accent}
        />
      </svg>
    );
  }
  if (service === "anthropic") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0H10.172L16.74 20.48H13.14L11.07 15.04H5.654l-1.33 3.49L.72 20.48 6.569 3.52zM6.673 12.18h3.382L8.389 7.2l-1.716 4.98z"
          fill="currentColor"
          className={SERVICE_STYLES[service].accent}
        />
      </svg>
    );
  }
  // nanobanana — sparkle icon
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={SERVICE_STYLES[service].accent}>
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  );
}

// ── Inline card (shown inside module pages) ──────────────

interface ServiceConnectionInlineProps {
  service: ServiceId;
  connected: boolean;
  description: string;
  onConnect: () => void;
  onDisconnect?: () => void;
}

export function ServiceConnectionInline({
  service,
  connected,
  description,
  onConnect,
  onDisconnect,
}: ServiceConnectionInlineProps) {
  const style = SERVICE_STYLES[service];

  if (connected) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent-emerald/[0.06] border border-accent-emerald/20">
        <CheckCircle2 size={16} className="text-accent-emerald shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-primary">
            {style.label} connected
          </p>
          <p className="text-[10px] text-text-muted truncate">{description}</p>
        </div>
        {onDisconnect && (
          <button
            onClick={onDisconnect}
            className="text-text-muted hover:text-accent-red transition-colors"
            title="Disconnect"
          >
            <Unplug size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-subtle overflow-hidden",
        "bg-gradient-to-r",
        style.gradient
      )}
    >
      <div className="flex items-center gap-4 px-4 py-4">
        <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
          <ServiceIcon service={service} size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <AlertCircle size={13} className="text-accent-amber shrink-0" />
            <p className="text-xs font-medium text-text-primary">
              Connect {style.label}
            </p>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {description}
          </p>
        </div>
        <button
          onClick={onConnect}
          className={cn(
            "shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg",
            "text-xs font-semibold text-white transition-all duration-200",
            "hover:shadow-lg",
            style.accentBg,
            service === "nanobanana" && "text-black"
          )}
        >
          Connect
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Full card (shown on Settings page) ───────────────────

interface ServiceConnectionFullProps {
  service: ServiceId;
  connected: boolean;
  description: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ServiceConnectionFull({
  service,
  connected,
  description,
  onConnect,
  onDisconnect,
}: ServiceConnectionFullProps) {
  const style = SERVICE_STYLES[service];

  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
            "bg-gradient-to-br",
            style.gradient
          )}
        >
          <ServiceIcon service={service} size={26} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-text-primary">
              {style.label}
            </h3>
            {connected ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-emerald/10 text-accent-emerald text-[10px] font-medium">
                <CheckCircle2 size={10} />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] text-text-muted text-[10px] font-medium">
                Not connected
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary leading-relaxed mb-3">
            {description}
          </p>

          {connected ? (
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent-red bg-accent-red/10 hover:bg-accent-red/20 transition-colors"
            >
              <Unplug size={12} />
              Disconnect
            </button>
          ) : (
            <button
              onClick={onConnect}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg",
                "text-xs font-semibold text-white transition-all duration-200",
                "hover:shadow-lg",
                style.accentBg,
                (service === "nanobanana" || service === "anthropic") && "text-black"
              )}
            >
              Connect {style.label}
              <ExternalLink size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Full-page connection overlay (blocks module until connected) ──

interface ServiceConnectionOverlayProps {
  services: {
    service: ServiceId;
    description: string;
    onConnect: () => void;
  }[];
  moduleName: string;
}

export function ServiceConnectionOverlay({
  services,
  moduleName,
}: ServiceConnectionOverlayProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-subtle flex items-center justify-center mb-6">
        <Lock size={28} strokeWidth={1.4} className="text-text-muted" />
      </div>

      <h2 className="text-lg font-syne font-bold text-text-primary mb-2">
        Connect to unlock {moduleName}
      </h2>
      <p className="text-sm text-text-secondary max-w-md mb-8 leading-relaxed">
        This module requires an active connection to work with live data.
        Connect the services below to get started.
      </p>

      <div className="w-full max-w-md space-y-3">
        {services.map(({ service, description, onConnect }) => {
          const style = SERVICE_STYLES[service];
          return (
            <div
              key={service}
              className={cn(
                "rounded-xl border border-subtle overflow-hidden",
                "bg-gradient-to-r",
                style.gradient
              )}
            >
              <div className="flex items-center gap-4 px-5 py-5">
                <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
                  <ServiceIcon service={service} size={26} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-text-primary mb-0.5">
                    {style.label}
                  </p>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    {description}
                  </p>
                </div>
                <button
                  onClick={onConnect}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 px-5 py-2.5 rounded-lg",
                    "text-xs font-semibold text-white transition-all duration-200",
                    "hover:shadow-lg",
                    style.accentBg,
                    (service === "nanobanana" || service === "anthropic") && "text-black"
                  )}
                >
                  Connect
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-text-muted mt-6">
        You can manage all connections from{" "}
        <a href="/settings" className="text-accent-indigo hover:underline">
          Settings
        </a>
      </p>
    </div>
  );
}
