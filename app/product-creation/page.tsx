"use client";

import { Wand2 } from "lucide-react";
import { ProductCopySheet } from "@/components/modules/ProductCopySheet";

export default function ProductCreationPage() {
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

      <ProductCopySheet />
    </div>
  );
}
