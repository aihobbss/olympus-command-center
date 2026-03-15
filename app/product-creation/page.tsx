"use client";

import { useEffect, useState } from "react";
import { Wand2 } from "lucide-react";
import { ProductCopySheet } from "@/components/modules/ProductCopySheet";
import { ServiceConnectionOverlay } from "@/components/modules/ServiceConnectionCard";
import { useConnectionsStore, useAuthStore, useStoreContext } from "@/lib/store";
import { SERVICE_REGISTRY } from "@/lib/services/connections";

export default function ProductCreationPage() {
  const user = useAuthStore((s) => s.user);
  const { loadConnections, isConnected } = useConnectionsStore();
  const { selectedStore } = useStoreContext();
  const [connectionsChecked, setConnectionsChecked] = useState(false);

  // Reset check when store changes so we re-gate until fresh connections load
  const storeId = selectedStore?.id;
  useEffect(() => {
    setConnectionsChecked(false);
    if (user) {
      loadConnections().then(() => setConnectionsChecked(true));
    }
  }, [user, storeId, loadConnections]);

  const shopifyConnected = isConnected("shopify");
  const anthropicConnected = isConnected("anthropic");
  const allConnected = shopifyConnected && anthropicConnected;

  const missingServices = [
    ...(!shopifyConnected
      ? [{ service: "shopify" as const, meta: SERVICE_REGISTRY.find((s) => s.id === "shopify")! }]
      : []),
    ...(!anthropicConnected
      ? [{ service: "anthropic" as const, meta: SERVICE_REGISTRY.find((s) => s.id === "anthropic")! }]
      : []),
  ];

  // Don't render content until connections are checked to avoid flash
  const showSheet = connectionsChecked && allConnected;
  const showOverlay = connectionsChecked && !allConnected;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent-indigo/10 flex items-center justify-center">
          <Wand2 className="text-accent-indigo" size={20} strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-2xl font-syne font-bold tracking-tight">
            Product Creation
          </h1>
          <p className="text-sm text-text-secondary">
            Generate Shopify descriptions &amp; ad copy for your products
          </p>
        </div>
      </div>

      {showSheet && <ProductCopySheet />}
      {showOverlay && (
        <ServiceConnectionOverlay
          moduleName="Product Creation"
          services={missingServices.map(({ service, meta }) => ({
            service,
            description: meta.description,
            onConnect: () => { window.location.href = `/settings?connect=${service}`; },
          }))}
        />
      )}
    </div>
  );
}
