// ============================================================
// Vantage Command Center — API Interfaces
// ============================================================
//
// This file documents the mock API interfaces that will be
// replaced with real Supabase / external API calls in
// production. Every function signature here represents a
// future service-layer call. The lightweight request/response
// types reference the same data shapes defined in the mock
// layer without importing from it directly.
//
// Usage:
//   import type { ApiResponse, ResearchApi } from "@/lib/api-interfaces";
//
// ============================================================

// ────────────────────────────────────────────────────────────
// 0. SHARED DATA SHAPES
// ────────────────────────────────────────────────────────────
// Re-declared here so that consumers can import from a single
// canonical location without coupling to the mock layer.

/** Product discovered during the research/scouting phase. */
export interface ResearchProduct {
  id: string;
  productName: string;
  competitorLink: string;
  adLink: string;
  storeLink: string;
  brandsRunning: number;
  daysActive: number;
  creativesCount: number;
  status: "Queued" | "Testing" | "Killed" | "Imported";
}

/** Performance snapshot at a specific daily budget level. */
export interface BudgetTierSnapshot {
  budgetPerDay: number;
  status: "current" | "historical";
  spend: number;
  revenue: number;
  orders: number;
  profit: number;
  roas: number;
  cpc: number;
  atc: number;
}

/** A single Facebook / TikTok ad campaign row. */
export interface AdCampaign {
  id: string;
  campaignName: string;
  product: string;
  spend: number;
  budget: number;
  cpc: number;
  atc: number;
  roas: number;
  revenue: number;
  orders: number;
  profit: number;
  status: "Scaling" | "Kill" | "Watch";
  recommendation: string;
  budgetHistory?: BudgetTierSnapshot[];
}

/** Daily profit-tracker row. */
export interface ProfitLog {
  date: string;
  revenue: number;
  cog: number;
  adSpend: number;
  transactionFee: number;
  profit: number;
  roas: number;
  profitPercent: number;
}

/** A single message in a customer service conversation thread. */
export interface CaseMessage {
  id: string;
  sender: "customer" | "agent";
  senderName: string;
  body: string;
  sentAt: string;
}

/** An SOP email template for customer service responses. */
export interface SOPTemplate {
  id: string;
  category: "Quality Issue" | "Sizing" | "Wrong Item" | "Delivery" | "Trustpilot";
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
}

/** A customer service ticket / case. */
export interface CustomerCase {
  id: string;
  customerName: string;
  email: string;
  subject: string;
  classification: "Quality Issue" | "Wrong Item" | "Sizing" | "Delivery";
  orderNumber: string;
  product: string;
  orderDate: string;
  trackingStatus: string;
  lifetimeValue: number;
  orderCount: number;
  previousRefunds: string;
  messagePreview: string;
  messages: CaseMessage[];
  receivedAt: string;
  isRepeatClaimer: boolean;
}

/** A coaching-programme student store. */
export interface StudentStore {
  id: string;
  rank: number;
  storeName: string;
  owner: string;
  revenue: number;
  adSpend: number;
  profit: number;
  roas: number;
  status: "Active" | "Struggling" | "At Risk";
}

/** Store selector entity used by the global store context. */
export interface Store {
  id: string;
  name: string;
  market: "UK" | "AU" | "USA";
  currency: string;
}

// ────────────────────────────────────────────────────────────
// 1. API RESPONSE WRAPPERS
// ────────────────────────────────────────────────────────────

/**
 * Generic wrapper returned by every API function.
 *
 * In the real implementation this would be produced by a
 * helper that wraps Supabase `.from().select()` calls or
 * `fetch()` responses, normalising success and error states
 * into a single discriminated shape.
 *
 * @template T - The payload type on success.
 */
export interface ApiResponse<T> {
  /** The returned payload. `null` when the request failed. */
  data: T | null;
  /** A user-facing error message, or `null` on success. */
  error: string | null;
  /** `true` while the request is in-flight (client-side only). */
  loading: boolean;
}

/**
 * Paginated variant of {@link ApiResponse} for list endpoints
 * that support cursor- or offset-based pagination.
 *
 * @template T - The item type contained in the `data` array.
 */
export interface PaginatedApiResponse<T> extends Omit<ApiResponse<T[]>, "data"> {
  /** The page of results. `null` on error. */
  data: T[] | null;
  /** Total number of records matching the query (before pagination). */
  totalCount: number;
  /** Current page index (0-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
}

/**
 * Mutation result for write operations (create / update / delete).
 * Carries the affected record back so the UI can optimistically
 * update without a refetch.
 *
 * @template T - The entity type that was mutated.
 */
export interface MutationResponse<T> {
  /** The updated or created record, or `null` on failure. */
  data: T | null;
  /** A user-facing error message, or `null` on success. */
  error: string | null;
  /** `true` when the operation completed without errors. */
  success: boolean;
}

// ────────────────────────────────────────────────────────────
// 2. RESEARCH MODULE API
// ────────────────────────────────────────────────────────────

/** Filters accepted by the research products listing. */
export interface FetchProductsParams {
  /** Filter by current pipeline status. */
  status?: ResearchProduct["status"];
  /** Free-text search against product name. */
  search?: string;
  /** Sort field. */
  sortBy?: keyof ResearchProduct;
  /** Sort direction. */
  sortOrder?: "asc" | "desc";
}

/** Request body for triggering a new product scan. */
export interface ScanProductsRequest {
  /** The data-source to scrape. */
  source: "afterlib" | "winning-hunter" | "manual";
  /** Optional keyword/niche filter sent to the scraper. */
  keyword?: string;
  /** Maximum number of products to return per scan. */
  limit?: number;
}

/** Result of a product scan operation. */
export interface ScanProductsResult {
  /** Newly discovered products added to the queue. */
  productsFound: number;
  /** Products that were already tracked and therefore skipped. */
  duplicatesSkipped: number;
  /** The new products that were added. */
  products: ResearchProduct[];
}

/**
 * Research Module API surface.
 *
 * In production every method maps to a Supabase RPC or
 * Edge Function call.
 */
export interface ResearchApi {
  /**
   * Fetch the list of scouted products.
   *
   * Real implementation: `supabase.from("research_products").select("*")`
   * with optional filters and RLS scoped to the active store.
   */
  fetchProducts: (
    params?: FetchProductsParams
  ) => Promise<ApiResponse<ResearchProduct[]>>;

  /**
   * Trigger a background product scan from an external source.
   *
   * Real implementation: Calls a Supabase Edge Function that
   * invokes the Afterlib or Winning Hunter scraper API, then
   * inserts newly found products into `research_products`.
   */
  scanProducts: (
    request: ScanProductsRequest
  ) => Promise<ApiResponse<ScanProductsResult>>;

  /**
   * Update the pipeline status of a single product
   * (e.g. Queued -> Testing -> Imported / Killed).
   *
   * Real implementation:
   * `supabase.from("research_products").update({ status }).eq("id", id)`
   */
  updateProductStatus: (
    id: string,
    status: ResearchProduct["status"]
  ) => Promise<MutationResponse<ResearchProduct>>;
}

// ────────────────────────────────────────────────────────────
// 3. AD MANAGER MODULE API
// ────────────────────────────────────────────────────────────

/** Filters accepted by the campaign listing endpoint. */
export interface FetchCampaignsParams {
  /** Filter by SOP recommendation status. */
  status?: AdCampaign["status"];
  /** Only show campaigns for a specific product. */
  product?: string;
  /** ISO date string; only return campaigns active on or after this date. */
  since?: string;
}

/** Parameters for the scale-campaign mutation. */
export interface ScaleCampaignRequest {
  /** The campaign to scale. */
  campaignId: string;
  /** Percentage increase to apply to the daily budget (e.g. 50 = +50%). */
  scalePercent: number;
}

/**
 * Ad Manager API surface.
 *
 * Every method will ultimately call Facebook Marketing API
 * (via a Supabase Edge Function proxy) or update local state
 * in Supabase tables.
 */
export interface AdManagerApi {
  /**
   * Fetch all campaigns for the active store.
   *
   * Real implementation: `supabase.from("ad_campaigns").select("*")`
   * joined with live Facebook Ads API metrics pulled by a
   * background sync cron.
   */
  fetchCampaigns: (
    params?: FetchCampaignsParams
  ) => Promise<ApiResponse<AdCampaign[]>>;

  /**
   * Scale a campaign by increasing its daily budget.
   *
   * Real implementation: Calls a Supabase Edge Function that
   * sends a PATCH to the Facebook Marketing API to update the
   * campaign's `daily_budget`, then writes the action to an
   * `ad_actions` audit log.
   */
  scaleCampaign: (
    request: ScaleCampaignRequest
  ) => Promise<MutationResponse<AdCampaign>>;

  /**
   * Kill (pause) a campaign immediately.
   *
   * Real implementation: Calls a Supabase Edge Function that
   * sets the campaign status to PAUSED via the Facebook
   * Marketing API and logs the kill action with the SOP
   * reasoning.
   */
  killCampaign: (
    campaignId: string
  ) => Promise<MutationResponse<AdCampaign>>;

  /**
   * Mark a campaign as "pass" — acknowledge the SOP
   * recommendation but take no scaling or killing action.
   * The campaign continues to run and will be re-evaluated
   * in the next review cycle.
   *
   * Real implementation:
   * `supabase.from("ad_campaigns").update({ reviewed_at: now() }).eq("id", id)`
   */
  passCampaign: (
    campaignId: string
  ) => Promise<MutationResponse<AdCampaign>>;
}

// ────────────────────────────────────────────────────────────
// 4. PROFIT TRACKER MODULE API
// ────────────────────────────────────────────────────────────

/** Date-range filter for profit log queries. */
export interface FetchProfitLogsParams {
  /** ISO date string for the start of the range (inclusive). */
  startDate?: string;
  /** ISO date string for the end of the range (inclusive). */
  endDate?: string;
  /** Number of most-recent days to fetch. Overrides startDate/endDate. */
  lastNDays?: number;
}

/** Request body for triggering a profit data sync. */
export interface SyncProfitDataRequest {
  /** The data source to pull revenue / order data from. */
  source: "shopify" | "stripe" | "manual";
  /** Only sync data from this date onward (ISO string). */
  since?: string;
}

/** Result payload from a profit sync operation. */
export interface SyncProfitDataResult {
  /** Number of daily rows created or updated. */
  daysUpdated: number;
  /** The date range that was synced (ISO strings). */
  syncedFrom: string;
  syncedTo: string;
}

/** Request body for updating Cost of Goods on a specific date. */
export interface UpdateCOGRequest {
  /** The date whose COG should be updated (ISO string). */
  date: string;
  /** New cost-of-goods value for that day. */
  cog: number;
}

/**
 * Profit Tracker API surface.
 *
 * In production the read side pulls from a materialised view
 * that aggregates Shopify orders, Stripe payouts, and manually
 * entered COG rows.
 */
export interface ProfitTrackerApi {
  /**
   * Fetch daily profit log entries for a date range.
   *
   * Real implementation:
   * `supabase.from("profit_logs").select("*").gte("date", start).lte("date", end)`
   * with RLS scoped to the active store.
   */
  fetchProfitLogs: (
    params?: FetchProfitLogsParams
  ) => Promise<ApiResponse<ProfitLog[]>>;

  /**
   * Trigger a sync that pulls revenue and order data from
   * Shopify / Stripe and recalculates daily profit rows.
   *
   * Real implementation: Calls a Supabase Edge Function that
   * fetches Shopify Admin API `/orders.json` and Stripe
   * `/balance_transactions`, then upserts into `profit_logs`.
   */
  syncProfitData: (
    request: SyncProfitDataRequest
  ) => Promise<ApiResponse<SyncProfitDataResult>>;

  /**
   * Manually update the Cost of Goods for a given day.
   * Used when COG cannot be automatically derived from the
   * supplier invoice feed.
   *
   * Real implementation:
   * `supabase.from("profit_logs").update({ cog }).eq("date", date)`
   * then recalculates `profit` and `profitPercent` server-side.
   */
  updateCOG: (
    request: UpdateCOGRequest
  ) => Promise<MutationResponse<ProfitLog>>;
}

// ────────────────────────────────────────────────────────────
// 5. CREATIVE GENERATOR MODULE API
// ────────────────────────────────────────────────────────────

/** The type of creative asset to generate. */
export type CreativeType = "image" | "video" | "carousel";

/** Status of a creative through its lifecycle. */
export type CreativeStatus = "generating" | "ready" | "saved" | "archived";

/** A single generated creative asset. */
export interface Creative {
  id: string;
  /** The product this creative was generated for. */
  productName: string;
  /** The type of creative asset. */
  type: CreativeType;
  /** Public URL to the generated asset (image / video / zip). */
  assetUrl: string;
  /** Thumbnail URL for gallery display. */
  thumbnailUrl: string;
  /** The prompt or template used to generate this creative. */
  prompt: string;
  /** Current lifecycle status. */
  status: CreativeStatus;
  /** ISO timestamp of when the creative was generated. */
  createdAt: string;
}

/** Request body for generating new creatives. */
export interface GenerateCreativesRequest {
  /** Product name to generate creatives for. */
  productName: string;
  /** Desired creative type. */
  type: CreativeType;
  /** Number of variations to generate. */
  variations?: number;
  /** Free-text prompt or style direction. */
  prompt?: string;
  /** Reference image URL for style matching. */
  referenceImageUrl?: string;
}

/** Result from a creative generation job. */
export interface GenerateCreativesResult {
  /** The batch of generated creatives. */
  creatives: Creative[];
  /** Number of creatives successfully generated. */
  generatedCount: number;
  /** Time in seconds the generation took. */
  durationSeconds: number;
}

/** Request body for saving a creative to the permanent library. */
export interface SaveToLibraryRequest {
  /** ID of the creative to persist. */
  creativeId: string;
  /** Optional human-readable label. */
  label?: string;
  /** Optional tags for organising the library. */
  tags?: string[];
}

/** Filters for browsing the saved creative library. */
export interface FetchLibraryParams {
  /** Filter by creative type. */
  type?: CreativeType;
  /** Filter by associated product. */
  productName?: string;
  /** Filter by tag. */
  tag?: string;
  /** Sort field. */
  sortBy?: "createdAt" | "productName" | "type";
  /** Sort direction. */
  sortOrder?: "asc" | "desc";
}

/**
 * Creative Generator API surface.
 *
 * In production the generation calls go to an AI image/video
 * pipeline (e.g. Replicate, RunwayML) via a Supabase Edge
 * Function, and the library is stored in Supabase Storage
 * with metadata in a `creatives` table.
 */
export interface CreativeGeneratorApi {
  /**
   * Generate one or more creative assets for a product.
   *
   * Real implementation: Calls a Supabase Edge Function that
   * submits a generation job to the AI pipeline (Replicate /
   * RunwayML), polls for completion, uploads the resulting
   * assets to Supabase Storage, and inserts metadata rows
   * into the `creatives` table.
   */
  generateCreatives: (
    request: GenerateCreativesRequest
  ) => Promise<ApiResponse<GenerateCreativesResult>>;

  /**
   * Persist a generated creative to the permanent library.
   *
   * Real implementation:
   * `supabase.from("creatives").update({ status: "saved", label, tags }).eq("id", id)`
   * The asset file is already in Supabase Storage from the
   * generation step; this only promotes the metadata status.
   */
  saveToLibrary: (
    request: SaveToLibraryRequest
  ) => Promise<MutationResponse<Creative>>;

  /**
   * Browse the saved creative library with optional filters.
   *
   * Real implementation:
   * `supabase.from("creatives").select("*").eq("status", "saved")`
   * with additional filter/sort clauses.
   */
  fetchLibrary: (
    params?: FetchLibraryParams
  ) => Promise<PaginatedApiResponse<Creative>>;
}

// ────────────────────────────────────────────────────────────
// 6. CUSTOMER SERVICE MODULE API
// ────────────────────────────────────────────────────────────

/** Filters for the customer case listing. */
export interface FetchCasesParams {
  /** Filter by issue classification. */
  classification?: CustomerCase["classification"];
  /** Only show unresolved / open cases. */
  openOnly?: boolean;
  /** Free-text search across customer name, email, subject. */
  search?: string;
  /** Sort field. */
  sortBy?: "receivedAt" | "lifetimeValue" | "customerName";
  /** Sort direction. */
  sortOrder?: "asc" | "desc";
}

/** Request body for sending a reply to a customer. */
export interface SendReplyRequest {
  /** The case being replied to. */
  caseId: string;
  /** The reply body (plain text or HTML). */
  message: string;
  /** If `true`, use the AI-suggested response verbatim. */
  useSuggestedResponse?: boolean;
}

/** Request body for issuing a refund on a case. */
export interface IssueRefundRequest {
  /** The case to issue the refund for. */
  caseId: string;
  /** Refund type. */
  refundType: "full" | "partial";
  /** Percentage of order value to refund (required when `refundType` is "partial"). */
  percentAmount?: number;
  /** Internal note explaining the refund reason. */
  reason?: string;
}

/** Result payload from a refund operation. */
export interface IssueRefundResult {
  /** The case that was refunded. */
  caseId: string;
  /** The amount refunded in the order's currency. */
  refundedAmount: number;
  /** Currency code of the refund. */
  currency: string;
  /** Unique refund transaction ID from the payment provider. */
  refundTransactionId: string;
}

/**
 * Customer Service API surface.
 *
 * In production, cases are ingested from a shared inbox
 * (e.g. Gorgias, Zendesk, or a custom Supabase-backed inbox)
 * and replies are sent via the same channel. Refunds go
 * through the Shopify Admin API or Stripe Refunds API.
 */
export interface CustomerServiceApi {
  /**
   * Fetch customer service cases for the active store.
   *
   * Real implementation:
   * `supabase.from("customer_cases").select("*")`
   * with classification and open-status filters, RLS scoped
   * to the active store.
   */
  fetchCases: (
    params?: FetchCasesParams
  ) => Promise<ApiResponse<CustomerCase[]>>;

  /**
   * Send a reply to the customer and record it on the case.
   *
   * Real implementation: Calls a Supabase Edge Function that
   * sends the email via the store's outbound SMTP / Gorgias
   * API, then appends the reply to the `case_messages` table.
   */
  sendReply: (
    request: SendReplyRequest
  ) => Promise<MutationResponse<CustomerCase>>;

  /**
   * Issue a full or partial refund for a case.
   *
   * Real implementation: Calls a Supabase Edge Function that
   * creates a refund via the Shopify Admin API
   * (`POST /orders/{id}/refunds.json`) or Stripe Refunds API,
   * records the refund in `case_refunds`, and updates the
   * case status.
   */
  issueRefund: (
    request: IssueRefundRequest
  ) => Promise<ApiResponse<IssueRefundResult>>;

  /**
   * Mark a case as resolved and close it.
   *
   * Real implementation:
   * `supabase.from("customer_cases").update({ resolved_at: now(), status: "resolved" }).eq("id", id)`
   */
  markResolved: (
    caseId: string
  ) => Promise<MutationResponse<CustomerCase>>;
}

// ────────────────────────────────────────────────────────────
// 7. COACH VIEW MODULE API
// ────────────────────────────────────────────────────────────

/** Filters for the student store listing. */
export interface FetchStudentStoresParams {
  /** Filter by performance status. */
  status?: StudentStore["status"];
  /** Sort field. */
  sortBy?: keyof StudentStore;
  /** Sort direction. */
  sortOrder?: "asc" | "desc";
}

/** A pending access request from a student. */
export interface AccessRequest {
  id: string;
  /** The student store requesting access. */
  storeId: string;
  storeName: string;
  owner: string;
  /** ISO timestamp of when the request was submitted. */
  requestedAt: string;
  /** Optional message from the student. */
  message?: string;
}

/**
 * Coach View API surface.
 *
 * In production the coach view reads from a `student_stores`
 * table that is populated by each student granting read-only
 * Shopify API access. Access requests are managed through a
 * `coaching_access_requests` table with RLS.
 */
export interface CoachViewApi {
  /**
   * Fetch the leaderboard of student stores.
   *
   * Real implementation:
   * `supabase.from("student_stores").select("*").order("rank")`
   * Metrics are synced nightly from each student's Shopify
   * store via their delegated API token.
   */
  fetchStudentStores: (
    params?: FetchStudentStoresParams
  ) => Promise<ApiResponse<StudentStore[]>>;

  /**
   * Approve a student's access request, granting them
   * visibility in the coach dashboard.
   *
   * Real implementation:
   * `supabase.from("coaching_access_requests").update({ status: "approved" }).eq("id", id)`
   * then triggers a webhook that provisions the student's
   * read-only Shopify API scope.
   */
  approveAccessRequest: (
    requestId: string
  ) => Promise<MutationResponse<AccessRequest>>;

  /**
   * Deny a student's access request.
   *
   * Real implementation:
   * `supabase.from("coaching_access_requests").update({ status: "denied" }).eq("id", id)`
   */
  denyAccessRequest: (
    requestId: string
  ) => Promise<MutationResponse<AccessRequest>>;
}

// ────────────────────────────────────────────────────────────
// 8. STORE CONTEXT API
// ────────────────────────────────────────────────────────────

/**
 * Store Context API surface.
 *
 * Manages the global "active store" selector. In production
 * this reads from a `stores` table where the authenticated
 * user has ownership or delegated access, and switching
 * stores updates all RLS policies to scope subsequent queries.
 */
export interface StoreContextApi {
  /**
   * Fetch the list of stores the authenticated user has
   * access to.
   *
   * Real implementation:
   * `supabase.from("stores").select("*").eq("user_id", userId)`
   * or a broader query for coach-level users who can see
   * student stores.
   */
  fetchStores: () => Promise<ApiResponse<Store[]>>;

  /**
   * Switch the active store context. All subsequent data
   * queries will be scoped to this store via Supabase RLS.
   *
   * Real implementation:
   * Updates the user's `active_store_id` in the `profiles`
   * table and refreshes the Supabase client's JWT claims so
   * that RLS picks up the new store scope:
   * `supabase.from("profiles").update({ active_store_id: storeId }).eq("id", userId)`
   */
  switchStore: (
    storeId: string
  ) => Promise<MutationResponse<Store>>;
}

// ────────────────────────────────────────────────────────────
// 9. AGGREGATE INTERFACE
// ────────────────────────────────────────────────────────────

/**
 * Complete API surface for the Vantage Command Center.
 *
 * A concrete implementation would satisfy this interface by
 * wiring each method to a Supabase client call, Edge Function,
 * or third-party API. During development, every method returns
 * data from the mock layer in `@/data/mock`.
 *
 * Example usage in a service factory:
 *
 * ```ts
 * const api: VantageApi = createSupabaseApi(supabase);
 * const { data, error } = await api.research.fetchProducts();
 * ```
 */
export interface VantageApi {
  research: ResearchApi;
  adManager: AdManagerApi;
  profitTracker: ProfitTrackerApi;
  creativeGenerator: CreativeGeneratorApi;
  customerService: CustomerServiceApi;
  coachView: CoachViewApi;
  storeContext: StoreContextApi;
}
