// ============================================================
// Vantage Command Center — Mock Data
// All dates are relative to today. All metrics use realistic
// ranges from Aidan's actual store operations.
// ============================================================

const today = new Date();

function daysAgo(n: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function hoursAgo(n: number): string {
  const d = new Date(today);
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

// ============================================================
// 1. Research Sheet Products
// ============================================================

export type ProductType =
  | ""
  | "Shoes"
  | "Regular Jacket"
  | "Light Jacket"
  | "Luxury Jacket"
  | "Light Sweater"
  | "Heavy Sweater"
  | "Light Top"
  | "Heavy Top"
  | "All Accessories"
  | "Sandals"
  | "Dress"
  | "Set"
  | "Light Pants"
  | "Heavy Pants";

// Aidan's pricing table — GBP and AUD prices per product type
export const pricingTable: Record<string, { gbp: number; aud: number }> = {
  "Shoes":            { gbp: 38, aud: 78 },
  "Regular Jacket":   { gbp: 38, aud: 78 },
  "Light Jacket":     { gbp: 32, aud: 68 },
  "Luxury Jacket":    { gbp: 48, aud: 92 },
  "Light Sweater":    { gbp: 28, aud: 62 },
  "Heavy Sweater":    { gbp: 32, aud: 68 },
  "Light Top":        { gbp: 26, aud: 48 },
  "Heavy Top":        { gbp: 28, aud: 62 },
  "All Accessories":  { gbp: 26, aud: 48 },
  "Sandals":          { gbp: 28, aud: 62 },
  "Dress":            { gbp: 28, aud: 62 },
  "Set":              { gbp: 38, aud: 78 },
  "Light Pants":      { gbp: 28, aud: 62 },
  "Heavy Pants":      { gbp: 32, aud: 68 },
};

// Discount rules: 53% for low-ticket (£26/A$48 and below), 42% otherwise
export function getDiscountForPrice(price: number, market: string): number {
  const lowTicketThreshold = market === "AU" ? 48 : 26;
  return price <= lowTicketThreshold ? 53 : 42;
}

// Helper to get the price for a product type in the right currency
export function getPriceForType(productType: ProductType, market: string): number | null {
  if (!productType) return null;
  const entry = pricingTable[productType];
  if (!entry) return null;
  return market === "AU" ? entry.aud : entry.gbp;
}

export type PipelineStatus = "research" | "imported" | "copy_created" | "pushed_to_shopify" | "ad_testing" | "live" | "killed";

export type SheetProduct = {
  id: string;
  productName: string;
  adLink: string;
  storeLink: string;
  creativeUrls: string[];
  testingStatus: "" | "Queued" | "Imported" | "Scheduled" | "Live" | "Killed";
  creativeSaved: boolean;
  cog: number | null;
  productType: ProductType;
  pricing: number | null;
  discountPercent: number;
  compareAtPrice: number | null;
  notes: string;
  pipelineStatus: PipelineStatus;
  shopifyProductId?: string;
};

export const initialSheetProducts: SheetProduct[] = [
  {
    id: "sp-001",
    productName: "Maven Bomber Jacket",
    adLink: "https://facebook.com/ads/library/?id=100003",
    storeLink: "https://vantagemelbourne.myshopify.com/products/maven-bomber-jacket",
    creativeUrls: [],
    testingStatus: "Live",
    creativeSaved: true,
    cog: 18,
    productType: "Regular Jacket",
    pricing: 38,
    discountPercent: 42,
    notes: "GOOD",
    compareAtPrice: null,
    pipelineStatus: "live",
  },
  {
    id: "sp-002",
    productName: "Haldrin Layered Shirt",
    adLink: "https://facebook.com/ads/library/?id=100005",
    storeLink: "https://vantagemelbourne.myshopify.com/products/haldrin-layered-shirt",
    creativeUrls: [],
    testingStatus: "Scheduled",
    creativeSaved: true,
    cog: 12,
    productType: "Heavy Top",
    pricing: 28,
    discountPercent: 42,
    notes: "good",
    compareAtPrice: null,
    pipelineStatus: "research",
  },
  {
    id: "sp-003",
    productName: "Harrington Trainers",
    adLink: "https://facebook.com/ads/library/?id=100001",
    storeLink: "https://vantagemelbourne.myshopify.com/products/harrington-trainers",
    creativeUrls: [],
    testingStatus: "Imported",
    creativeSaved: false,
    cog: 22,
    productType: "Shoes",
    pricing: 38,
    discountPercent: 42,
    notes: "GOOD",
    compareAtPrice: null,
    pipelineStatus: "live",
  },
  {
    id: "sp-004",
    productName: "Enzo Suede Loafers",
    adLink: "https://facebook.com/ads/library/?id=100006",
    storeLink: "",
    creativeUrls: [],
    testingStatus: "",
    creativeSaved: false,
    cog: null,
    productType: "Shoes",
    pricing: 38,
    discountPercent: 42,
    notes: "Not DS",
    compareAtPrice: null,
    pipelineStatus: "research",
  },
  {
    id: "sp-005",
    productName: "Avalon Puffer Vest",
    adLink: "https://facebook.com/ads/library/?id=100007",
    storeLink: "https://vantagemelbourne.myshopify.com/products/avalon-puffer-vest",
    creativeUrls: [],
    testingStatus: "Killed",
    creativeSaved: true,
    cog: 24,
    productType: "Light Jacket",
    pricing: 32,
    discountPercent: 42,
    notes: "Creative is branded",
    compareAtPrice: null,
    pipelineStatus: "killed",
  },
  {
    id: "sp-006",
    productName: "Kensington Wool Overcoat",
    adLink: "https://facebook.com/ads/library/?id=100008",
    storeLink: "https://cozycraft.com/products/kensington-wool-overcoat",
    creativeUrls: [],
    testingStatus: "Queued",
    creativeSaved: false,
    cog: 16,
    productType: "Luxury Jacket",
    pricing: 48,
    discountPercent: 42,
    notes: "avoid",
    compareAtPrice: null,
    pipelineStatus: "research",
  },
  {
    id: "sp-007",
    productName: "Durango Road Sneakers",
    adLink: "https://facebook.com/ads/library/?id=100009",
    storeLink: "https://urbanstep.co/products/durango-road-sneakers",
    creativeUrls: [],
    testingStatus: "Queued",
    creativeSaved: false,
    cog: 19,
    productType: "Shoes",
    pricing: 38,
    discountPercent: 42,
    notes: "",
    compareAtPrice: null,
    pipelineStatus: "research",
  },
  {
    id: "sp-008",
    productName: "Matteo Cotton Pants",
    adLink: "https://facebook.com/ads/library/?id=100010",
    storeLink: "https://threadhaus.com/products/matteo-cotton-pants",
    creativeUrls: [],
    testingStatus: "Queued",
    creativeSaved: true,
    cog: 11,
    productType: "Light Pants",
    pricing: 28,
    discountPercent: 42,
    notes: "Good margins",
    compareAtPrice: null,
    pipelineStatus: "research",
  },
  {
    id: "sp-009",
    productName: "Solara Linen Blazer",
    adLink: "https://facebook.com/ads/library/?id=100011",
    storeLink: "",
    creativeUrls: [],
    testingStatus: "Queued",
    creativeSaved: false,
    cog: 14,
    productType: "Light Jacket",
    pricing: 32,
    discountPercent: 42,
    notes: "",
    compareAtPrice: null,
    pipelineStatus: "research",
  },
];

// Keep legacy type for backwards compatibility with api-interfaces
export type ResearchProduct = {
  id: string;
  productName: string;
  competitorLink: string;
  adLink: string;
  storeLink: string;
  brandsRunning: number;
  daysActive: number;
  creativesCount: number;
  status: "Queued" | "Testing" | "Killed" | "Imported";
};

export const researchProducts: ResearchProduct[] = [];

// ============================================================
// 1c. Product Copy Creation
// ============================================================

export type AdStatus = "red" | "yellow" | "green";

export type PushStatus = "" | "pushing" | "pushed" | "error";

export type SizeChartStatus = "" | "generating" | "done" | "error";

export type ProductCopy = {
  id: string;
  productId?: string;
  adStatus: AdStatus;
  productUrl: string;
  productName: string;
  imageUrl: string;
  shopifyDescription: string;
  facebookCopy: string;
  status: "" | "Pending" | "Generating" | "Completed" | "Error";
  pushStatus: PushStatus;
  sizeChartImage: string;
  sizeChartTable: string;
  sizeChartStatus: SizeChartStatus;
  shopifyProductId?: string;
};

export const initialCopyProducts: ProductCopy[] = [
  {
    id: "pc-001",
    adStatus: "green",
    productName: "Aymbr Sweater",
    productUrl: "https://vantagemelbourne.myshopify.com/products/aymbr",
    imageUrl: "http://vantagemelbourne.myshopify.com/cdn/shop/files/britt_wit_1_1_720x.jpg",
    shopifyDescription: "Modern Edge Meets Everyday Comfort\n\nElevate your seasonal wardrobe with a statement knit designed to turn heads. The Aymbr Sweater features distinctive openwork detail and a relaxed silhouette that flatters while keeping things effortlessly stylish.\n\n\u2022 Knitted Design: Cozy construction combines warmth with everyday refinement\n\u2022 Openwork Details: Intricate patterns bring depth and modern flair\n\u2022 Relaxed Fit: Slightly oversized shape with dropped shoulders for easy layering\n\u2022 Round Neck: Classic crew neckline complements any outfit\n\nDesigned in London by Vantage for timeless versatility.",
    facebookCopy: "Slide Into Textured Sophistication with the Aymbr Sweater\n\nPlayful structure meets confident style in this relaxed must-have. The Aymbr Sweater\u2019s openwork detail and patchwork texture bring effortless elegance to your rotation.\n\nRelaxed. Intricate. Versatile.\n\nhttps://vantagemelbourne.myshopify.com/products/aymbr\nAymbr Sweater\nFree Shipping in the UK\nShop now",
    status: "Completed",
    pushStatus: "",
    sizeChartImage: "",
    sizeChartTable: "",
    sizeChartStatus: "",
  },
  {
    id: "pc-002",
    adStatus: "green",
    productName: "All-Terrain Canvas Sneaker",
    productUrl: "https://vantagemelbourne.myshopify.com/products/all-terrain-canvas-sneaker",
    imageUrl: "http://vantagemelbourne.myshopify.com/cdn/shop/files/S6dba56a87e254678.webp",
    shopifyDescription: "Warm-Weather Function Meets Everyday Utility\n\nCrafted for comfort and ease, the All-Terrain Canvas Sneaker is ready for anything from daily errands to weekend adventures. The breathable upper and flexible sole support natural movement.\n\n\u2022 Low-Top Construction: Relaxed silhouette with casual styling appeal\n\u2022 Lace-Up Front: Metal eyelets provide secure fit and utility edge\n\u2022 Slip-Resistant Tread: Durable outsole provides reliable traction\n\u2022 Textured Details: Visible stitching and panel design add structure\n\nDesigned in London by Vantage for modern versatility.",
    facebookCopy: "Slide Into Everyday Motion with the All-Terrain Canvas Sneaker\n\nBuilt to keep pace with your routine, the All-Terrain Canvas Sneaker delivers breathable comfort, structured support, and rugged traction in one easygoing package.\n\nPractical. Breathable. Grounded.\n\nhttps://vantagemelbourne.myshopify.com/products/all-terrain-canvas-sneaker\nAll-Terrain Canvas Sneaker\nFree Shipping in the UK\nShop now",
    status: "Completed",
    pushStatus: "",
    sizeChartImage: "",
    sizeChartTable: "",
    sizeChartStatus: "",
  },
  {
    id: "pc-003",
    adStatus: "yellow",
    productName: "Maven Bomber Jacket",
    productUrl: "https://vantagemelbourne.myshopify.com/products/maven-bomber-jacket",
    imageUrl: "",
    shopifyDescription: "",
    facebookCopy: "",
    status: "Pending",
    pushStatus: "",
    sizeChartImage: "",
    sizeChartTable: "",
    sizeChartStatus: "",
  },
  {
    id: "pc-004",
    adStatus: "red",
    productName: "Harrington Trainers",
    productUrl: "https://vantagemelbourne.myshopify.com/products/harrington-trainers",
    imageUrl: "",
    shopifyDescription: "",
    facebookCopy: "",
    status: "Pending",
    pushStatus: "",
    sizeChartImage: "",
    sizeChartTable: "",
    sizeChartStatus: "",
  },
  {
    id: "pc-005",
    adStatus: "yellow",
    productName: "Haldrin Layered Shirt",
    productUrl: "https://vantagemelbourne.myshopify.com/products/haldrin-layered-shirt",
    imageUrl: "",
    shopifyDescription: "",
    facebookCopy: "",
    status: "",
    pushStatus: "",
    sizeChartImage: "",
    sizeChartTable: "",
    sizeChartStatus: "",
  },
];

// ============================================================
// 1d. Ad Creator Campaigns (test campaigns for Meta)
// ============================================================

export type AdCreatorStatus = "Queued" | "Ready" | "Pushing" | "Live";

export type AdCreative = {
  id: string;
  concept: string;
  placeholderGradient: string;
};

export type AdGender = "Male" | "Female" | "All" | "";

export type AdCreatorCampaign = {
  id: string;
  productId?: string;
  productName: string;
  productUrl: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  country: string;
  budget: number;
  gender: AdGender;
  creatives: AdCreative[];
  status: AdCreatorStatus;
};

const creativeGradients = [
  "from-indigo-600 to-purple-500",
  "from-emerald-600 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-600 to-pink-500",
  "from-cyan-500 to-blue-500",
  "from-violet-600 to-fuchsia-500",
];

export const initialAdCreatorCampaigns: AdCreatorCampaign[] = [
  {
    id: "adc-001",
    productName: "Aymbr Sweater",
    productUrl: "https://vantagemelbourne.myshopify.com/products/aymbr",
    primaryText: "Slide Into Textured Sophistication with the Aymbr Sweater\n\nPlayful structure meets confident style in this relaxed must-have. The Aymbr Sweater\u2019s openwork detail and patchwork texture bring effortless elegance to your rotation.\n\nRelaxed. Intricate. Versatile.",
    headline: "Aymbr Sweater",
    description: "Free Shipping in the UK",
    cta: "Shop Now",
    country: "UK",
    budget: 30,
    gender: "Male",
    creatives: [
      { id: "cr-001-a", concept: "Winter \u2014 Text", placeholderGradient: creativeGradients[0] },
      { id: "cr-001-b", concept: "High-End \u2014 No Text", placeholderGradient: creativeGradients[1] },
      { id: "cr-001-c", concept: "Model Wearing It", placeholderGradient: creativeGradients[2] },
    ],
    status: "Ready",
  },
  {
    id: "adc-002",
    productName: "All-Terrain Canvas Sneaker",
    productUrl: "https://vantagemelbourne.myshopify.com/products/all-terrain-canvas-sneaker",
    primaryText: "Slide Into Everyday Motion with the All-Terrain Canvas Sneaker\n\nBuilt to keep pace with your routine, the All-Terrain Canvas Sneaker delivers breathable comfort, structured support, and rugged traction in one easygoing package.\n\nPractical. Breathable. Grounded.",
    headline: "All-Terrain Canvas Sneaker",
    description: "Free Shipping in the UK",
    cta: "Shop Now",
    country: "UK",
    budget: 30,
    gender: "All",
    creatives: [
      { id: "cr-002-a", concept: "UGC Style", placeholderGradient: creativeGradients[3] },
      { id: "cr-002-b", concept: "Flat Lay", placeholderGradient: creativeGradients[4] },
    ],
    status: "Ready",
  },
  {
    id: "adc-003",
    productName: "Maven Bomber Jacket",
    productUrl: "https://vantagemelbourne.myshopify.com/products/maven-bomber-jacket",
    primaryText: "",
    headline: "Maven Bomber Jacket",
    description: "Free Shipping in the UK",
    cta: "Shop Now",
    country: "UK",
    budget: 30,
    gender: "Male",
    creatives: [],
    status: "Queued",
  },
  {
    id: "adc-004",
    productName: "Harrington Trainers",
    productUrl: "https://vantagemelbourne.myshopify.com/products/harrington-trainers",
    primaryText: "",
    headline: "Harrington Trainers",
    description: "Free Shipping in the UK",
    cta: "Shop Now",
    country: "UK",
    budget: 30,
    gender: "Male",
    creatives: [
      { id: "cr-004-a", concept: "Price Shown", placeholderGradient: creativeGradients[5] },
    ],
    status: "Queued",
  },
];

// ============================================================
// 1e. Shared Prompt Templates (used by Creative Generator)
// ============================================================

export type PromptTemplate = {
  id: string;
  label: string;
  prompt: string;
};

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  { id: "t1", label: "Winter — Text", prompt: "Winter setting with product, text overlay with name and price" },
  { id: "t2", label: "Winter — No Text", prompt: "Winter setting with product, clean image no text" },
  { id: "t3", label: "High-End — No Text", prompt: "Luxury studio shot, minimal background, no text" },
  { id: "t4", label: "High-End — Text", prompt: "Luxury studio shot with elegant text overlay" },
  { id: "t5", label: "Price Shown", prompt: "Product with sale price and crossed-out original price" },
  { id: "t6", label: "Replicate Winner", prompt: "Replicate the style of the best-performing ad creative" },
  { id: "t7", label: "Model Wearing It", prompt: "Model wearing/using the product in lifestyle setting" },
  { id: "t8", label: "UGC Style", prompt: "User-generated content style, casual phone camera look" },
  { id: "t9", label: "Before & After", prompt: "Split comparison showing transformation or styling" },
  { id: "t10", label: "Flat Lay", prompt: "Top-down flat lay arrangement on neutral background" },
  { id: "t11", label: "Standard Test", prompt: "Clean product shot on white background, standard e-commerce format" },
];

// ============================================================
// 1f. Creative Generator Batch Queue Types
// ============================================================

export type BatchQueueProduct = {
  id: string;
  productId?: string;
  productCopyId: string;
  productName: string;
  productUrl: string;
  imageUrl: string;
  status: "queued" | "generating" | "completed";
};

export type ProductCreative = {
  id: string;
  productId?: string;
  productName: string;
  productCopyId: string;
  concept: string;
  placeholderGradient: string;
  status: "pending" | "generating" | "completed";
};

export type PromptAllocation = {
  templateId: string;
  label: string;
  count: number;
};

// ============================================================
// 2. Ad Campaigns (4 items)
// ============================================================

export type BudgetTierSnapshot = {
  budgetPerDay: number;
  status: "current" | "historical";
  spend: number;
  revenue: number;
  orders: number;
  profit: number;
  roas: number;
  cpc: number;
  atc: number;
};

export type CampaignStatus = "Active" | "Paused" | "Killed" | "Scaling";

export type AdCampaign = {
  id: string;
  productId?: string;
  campaignName: string;
  product: string;
  adAccountId?: string;
  spend: number;
  budget: number;
  cpc: number;
  atc: number;
  roas: number;
  revenue: number;
  orders: number;
  profit: number;
  status: "Scaling" | "Kill" | "Watch";
  campaignStatus: CampaignStatus;
  recommendation: string;
  budgetHistory?: BudgetTierSnapshot[];
};

export const adCampaigns: AdCampaign[] = [
  {
    id: "ac-001",
    campaignName: "Harrington Trainers",
    product: "Harrington Trainers",
    spend: 87,
    budget: 60,
    cpc: 0.72,
    atc: 14,
    roas: 2.41,
    revenue: 210,
    orders: 6,
    profit: 58,
    status: "Scaling",
    campaignStatus: "Active",
    recommendation: "ROAS above 2.0 with strong ATC — SOP: Scale +100%",
    budgetHistory: [
      { budgetPerDay: 30, status: "historical", spend: 145, revenue: 380, orders: 10, profit: 95, roas: 2.62, cpc: 0.68, atc: 12 },
      { budgetPerDay: 60, status: "current", spend: 87, revenue: 210, orders: 6, profit: 58, roas: 2.41, cpc: 0.72, atc: 14 },
    ],
  },
  {
    id: "ac-002",
    campaignName: "Durango Road Sneakers",
    product: "Durango Road Sneakers",
    spend: 34,
    budget: 30,
    cpc: 1.12,
    atc: 2,
    roas: 0.9,
    revenue: 31,
    orders: 1,
    profit: -18,
    status: "Kill",
    campaignStatus: "Active",
    recommendation: "$34 spent, CPC > $1, only 2 ATC — SOP: Kill",
    budgetHistory: [
      { budgetPerDay: 30, status: "current", spend: 34, revenue: 31, orders: 1, profit: -18, roas: 0.9, cpc: 1.12, atc: 2 },
    ],
  },
  {
    id: "ac-003",
    campaignName: "Maven Bomber Jacket",
    product: "Maven Bomber Jacket",
    spend: 61,
    budget: 30,
    cpc: 0.88,
    atc: 9,
    roas: 1.95,
    revenue: 119,
    orders: 3,
    profit: 12,
    status: "Watch",
    campaignStatus: "Active",
    recommendation: "$61 spent, ROAS under 2.0 but ATC promising — SOP: Watch",
    budgetHistory: [
      { budgetPerDay: 30, status: "current", spend: 61, revenue: 119, orders: 3, profit: 12, roas: 1.95, cpc: 0.88, atc: 9 },
    ],
  },
  {
    id: "ac-004",
    campaignName: "Matteo Cotton Pants",
    product: "Matteo Cotton Pants",
    spend: 22,
    budget: 30,
    cpc: 1.34,
    atc: 0,
    roas: 0,
    revenue: 0,
    orders: 0,
    profit: -22,
    status: "Kill",
    campaignStatus: "Killed",
    recommendation: "$22 spent, CPC > $1, 0 ATC — SOP: Kill",
    budgetHistory: [
      { budgetPerDay: 30, status: "current", spend: 22, revenue: 0, orders: 0, profit: -22, roas: 0, cpc: 1.34, atc: 0 },
    ],
  },
  {
    id: "ac-005",
    campaignName: "Haldrin Layered Shirt",
    product: "Haldrin Layered Shirt",
    spend: 174,
    budget: 120,
    cpc: 0.65,
    atc: 22,
    roas: 2.78,
    revenue: 484,
    orders: 14,
    profit: 148,
    status: "Scaling",
    campaignStatus: "Active",
    recommendation: "ROAS above 2.5 across all tiers — SOP: Continue scaling",
    budgetHistory: [
      { budgetPerDay: 30, status: "historical", spend: 128, revenue: 342, orders: 9, profit: 102, roas: 2.67, cpc: 0.71, atc: 10 },
      { budgetPerDay: 60, status: "historical", spend: 246, revenue: 658, orders: 18, profit: 196, roas: 2.67, cpc: 0.68, atc: 18 },
      { budgetPerDay: 120, status: "current", spend: 174, revenue: 484, orders: 14, profit: 148, roas: 2.78, cpc: 0.65, atc: 22 },
    ],
  },
];

// ============================================================
// 3. Profit Logs (~60 days, 2 months)
// ============================================================

export type ProfitLog = {
  date: string;
  revenue: number;
  cog: number;
  adSpend: number;
  transactionFee: number;
  profit: number;
  roas: number;
  profitPercent: number;
  orders?: number;
};

export const profitLogs: ProfitLog[] = [
  {
    date: daysAgo(0),
    revenue: 487,
    cog: 98,
    adSpend: 142,
    transactionFee: 24.35,
    profit: 222.65,
    roas: 3.43,
    profitPercent: 45.7,
  },
  {
    date: daysAgo(1),
    revenue: 312,
    cog: 64,
    adSpend: 118,
    transactionFee: 15.6,
    profit: 114.4,
    roas: 2.64,
    profitPercent: 36.7,
  },
  {
    date: daysAgo(2),
    revenue: 589,
    cog: 122,
    adSpend: 195,
    transactionFee: 29.45,
    profit: 242.55,
    roas: 3.02,
    profitPercent: 41.2,
  },
  {
    date: daysAgo(3),
    revenue: 143,
    cog: 32,
    adSpend: 97,
    transactionFee: 7.15,
    profit: 6.85,
    roas: 1.47,
    profitPercent: 4.8,
  },
  {
    date: daysAgo(4),
    revenue: 421,
    cog: 86,
    adSpend: 163,
    transactionFee: 21.05,
    profit: 150.95,
    roas: 2.58,
    profitPercent: 35.9,
  },
  {
    date: daysAgo(5),
    revenue: 98,
    cog: 22,
    adSpend: 88,
    transactionFee: 4.9,
    profit: -16.9,
    roas: 1.11,
    profitPercent: -17.2,
  },
  {
    date: daysAgo(6),
    revenue: 267,
    cog: 54,
    adSpend: 105,
    transactionFee: 13.35,
    profit: 94.65,
    roas: 2.54,
    profitPercent: 35.5,
  },
  {
    date: daysAgo(7),
    revenue: 534,
    cog: 108,
    adSpend: 178,
    transactionFee: 26.7,
    profit: 221.3,
    roas: 3.0,
    profitPercent: 41.4,
  },
  {
    date: daysAgo(8),
    revenue: 356,
    cog: 74,
    adSpend: 134,
    transactionFee: 17.8,
    profit: 130.2,
    roas: 2.66,
    profitPercent: 36.6,
  },
  {
    date: daysAgo(9),
    revenue: 82,
    cog: 18,
    adSpend: 76,
    transactionFee: 4.1,
    profit: -16.1,
    roas: 1.08,
    profitPercent: -19.6,
  },
  {
    date: daysAgo(10),
    revenue: 445,
    cog: 92,
    adSpend: 156,
    transactionFee: 22.25,
    profit: 174.75,
    roas: 2.85,
    profitPercent: 39.3,
  },
  {
    date: daysAgo(11),
    revenue: 198,
    cog: 42,
    adSpend: 110,
    transactionFee: 9.9,
    profit: 36.1,
    roas: 1.8,
    profitPercent: 18.2,
  },
  {
    date: daysAgo(12),
    revenue: 376,
    cog: 78,
    adSpend: 145,
    transactionFee: 18.8,
    profit: 134.2,
    roas: 2.59,
    profitPercent: 35.7,
  },
  {
    date: daysAgo(13),
    revenue: 612,
    cog: 128,
    adSpend: 200,
    transactionFee: 30.6,
    profit: 253.4,
    roas: 3.06,
    profitPercent: 41.4,
  },
  // ── Feb 2026 data (daysAgo 14–41) ──
  { date: daysAgo(14), revenue: 389, cog: 80, adSpend: 148, transactionFee: 19.45, profit: 141.55, roas: 2.63, profitPercent: 36.4 },
  { date: daysAgo(15), revenue: 275, cog: 56, adSpend: 120, transactionFee: 13.75, profit: 85.25, roas: 2.29, profitPercent: 31.0 },
  { date: daysAgo(16), revenue: 523, cog: 108, adSpend: 185, transactionFee: 26.15, profit: 203.85, roas: 2.83, profitPercent: 39.0 },
  { date: daysAgo(17), revenue: 105, cog: 24, adSpend: 82, transactionFee: 5.25, profit: -6.25, roas: 1.28, profitPercent: -6.0 },
  { date: daysAgo(18), revenue: 462, cog: 96, adSpend: 170, transactionFee: 23.1, profit: 172.9, roas: 2.72, profitPercent: 37.4 },
  { date: daysAgo(19), revenue: 334, cog: 68, adSpend: 132, transactionFee: 16.7, profit: 117.3, roas: 2.53, profitPercent: 35.1 },
  { date: daysAgo(20), revenue: 91, cog: 20, adSpend: 78, transactionFee: 4.55, profit: -11.55, roas: 1.17, profitPercent: -12.7 },
  { date: daysAgo(21), revenue: 548, cog: 114, adSpend: 190, transactionFee: 27.4, profit: 216.6, roas: 2.88, profitPercent: 39.5 },
  { date: daysAgo(22), revenue: 412, cog: 84, adSpend: 155, transactionFee: 20.6, profit: 152.4, roas: 2.66, profitPercent: 37.0 },
  { date: daysAgo(23), revenue: 178, cog: 38, adSpend: 98, transactionFee: 8.9, profit: 33.1, roas: 1.82, profitPercent: 18.6 },
  { date: daysAgo(24), revenue: 496, cog: 102, adSpend: 175, transactionFee: 24.8, profit: 194.2, roas: 2.83, profitPercent: 39.2 },
  { date: daysAgo(25), revenue: 230, cog: 48, adSpend: 115, transactionFee: 11.5, profit: 55.5, roas: 2.0, profitPercent: 24.1 },
  { date: daysAgo(26), revenue: 367, cog: 76, adSpend: 140, transactionFee: 18.35, profit: 132.65, roas: 2.62, profitPercent: 36.1 },
  { date: daysAgo(27), revenue: 582, cog: 120, adSpend: 195, transactionFee: 29.1, profit: 237.9, roas: 2.98, profitPercent: 40.9 },
  { date: daysAgo(28), revenue: 145, cog: 32, adSpend: 92, transactionFee: 7.25, profit: 13.75, roas: 1.58, profitPercent: 9.5 },
  { date: daysAgo(29), revenue: 438, cog: 90, adSpend: 162, transactionFee: 21.9, profit: 164.1, roas: 2.7, profitPercent: 37.5 },
  { date: daysAgo(30), revenue: 301, cog: 62, adSpend: 125, transactionFee: 15.05, profit: 98.95, roas: 2.41, profitPercent: 32.9 },
  { date: daysAgo(31), revenue: 76, cog: 18, adSpend: 72, transactionFee: 3.8, profit: -17.8, roas: 1.06, profitPercent: -23.4 },
  { date: daysAgo(32), revenue: 415, cog: 86, adSpend: 158, transactionFee: 20.75, profit: 150.25, roas: 2.63, profitPercent: 36.2 },
  { date: daysAgo(33), revenue: 289, cog: 60, adSpend: 118, transactionFee: 14.45, profit: 96.55, roas: 2.45, profitPercent: 33.4 },
  { date: daysAgo(34), revenue: 507, cog: 104, adSpend: 180, transactionFee: 25.35, profit: 197.65, roas: 2.82, profitPercent: 39.0 },
  { date: daysAgo(35), revenue: 168, cog: 36, adSpend: 95, transactionFee: 8.4, profit: 28.6, roas: 1.77, profitPercent: 17.0 },
  { date: daysAgo(36), revenue: 453, cog: 94, adSpend: 168, transactionFee: 22.65, profit: 168.35, roas: 2.7, profitPercent: 37.2 },
  { date: daysAgo(37), revenue: 124, cog: 28, adSpend: 86, transactionFee: 6.2, profit: 3.8, roas: 1.44, profitPercent: 3.1 },
  { date: daysAgo(38), revenue: 378, cog: 78, adSpend: 142, transactionFee: 18.9, profit: 139.1, roas: 2.66, profitPercent: 36.8 },
  { date: daysAgo(39), revenue: 541, cog: 112, adSpend: 188, transactionFee: 27.05, profit: 213.95, roas: 2.88, profitPercent: 39.5 },
  { date: daysAgo(40), revenue: 203, cog: 42, adSpend: 108, transactionFee: 10.15, profit: 42.85, roas: 1.88, profitPercent: 21.1 },
  { date: daysAgo(41), revenue: 467, cog: 96, adSpend: 172, transactionFee: 23.35, profit: 175.65, roas: 2.72, profitPercent: 37.6 },
  // ── Jan 2026 data (daysAgo 42–59) ──
  { date: daysAgo(42), revenue: 345, cog: 72, adSpend: 135, transactionFee: 17.25, profit: 120.75, roas: 2.56, profitPercent: 35.0 },
  { date: daysAgo(43), revenue: 88, cog: 20, adSpend: 74, transactionFee: 4.4, profit: -10.4, roas: 1.19, profitPercent: -11.8 },
  { date: daysAgo(44), revenue: 512, cog: 106, adSpend: 182, transactionFee: 25.6, profit: 198.4, roas: 2.81, profitPercent: 38.7 },
  { date: daysAgo(45), revenue: 256, cog: 54, adSpend: 112, transactionFee: 12.8, profit: 77.2, roas: 2.29, profitPercent: 30.2 },
  { date: daysAgo(46), revenue: 430, cog: 88, adSpend: 160, transactionFee: 21.5, profit: 160.5, roas: 2.69, profitPercent: 37.3 },
  { date: daysAgo(47), revenue: 158, cog: 34, adSpend: 94, transactionFee: 7.9, profit: 22.1, roas: 1.68, profitPercent: 14.0 },
  { date: daysAgo(48), revenue: 395, cog: 82, adSpend: 150, transactionFee: 19.75, profit: 143.25, roas: 2.63, profitPercent: 36.3 },
  { date: daysAgo(49), revenue: 573, cog: 118, adSpend: 192, transactionFee: 28.65, profit: 234.35, roas: 2.98, profitPercent: 40.9 },
  { date: daysAgo(50), revenue: 110, cog: 26, adSpend: 80, transactionFee: 5.5, profit: -1.5, roas: 1.38, profitPercent: -1.4 },
  { date: daysAgo(51), revenue: 482, cog: 100, adSpend: 176, transactionFee: 24.1, profit: 181.9, roas: 2.74, profitPercent: 37.7 },
  { date: daysAgo(52), revenue: 319, cog: 66, adSpend: 128, transactionFee: 15.95, profit: 109.05, roas: 2.49, profitPercent: 34.2 },
  { date: daysAgo(53), revenue: 68, cog: 16, adSpend: 68, transactionFee: 3.4, profit: -19.4, roas: 1.0, profitPercent: -28.5 },
  { date: daysAgo(54), revenue: 447, cog: 92, adSpend: 165, transactionFee: 22.35, profit: 167.65, roas: 2.71, profitPercent: 37.5 },
  { date: daysAgo(55), revenue: 195, cog: 42, adSpend: 102, transactionFee: 9.75, profit: 41.25, roas: 1.91, profitPercent: 21.2 },
  { date: daysAgo(56), revenue: 528, cog: 110, adSpend: 186, transactionFee: 26.4, profit: 205.6, roas: 2.84, profitPercent: 38.9 },
  { date: daysAgo(57), revenue: 282, cog: 58, adSpend: 122, transactionFee: 14.1, profit: 87.9, roas: 2.31, profitPercent: 31.2 },
  { date: daysAgo(58), revenue: 401, cog: 82, adSpend: 152, transactionFee: 20.05, profit: 146.95, roas: 2.64, profitPercent: 36.6 },
  { date: daysAgo(59), revenue: 136, cog: 30, adSpend: 90, transactionFee: 6.8, profit: 9.2, roas: 1.51, profitPercent: 6.8 },
];

// ============================================================
// 3b. Per-store data helpers
// ============================================================

export const VANTAGE_DEFAULT_COGS: Record<string, number> = {
  "ac-001": 16.0,
  "ac-002": 15.0,
  "ac-003": 20.0,
  "ac-004": 12.0,
  "ac-005": 12.0,
};

/** Get profit logs for a given store */
export function getProfitLogs(_storeId: string): ProfitLog[] {
  return profitLogs;
}

/** Get ad campaigns for a given store */
export function getAdCampaigns(_storeId: string): AdCampaign[] {
  return adCampaigns;
}

/** Get default COGs for a given store */
export function getDefaultCogs(_storeId: string): Record<string, number> {
  return VANTAGE_DEFAULT_COGS;
}

// ============================================================
// 4. Customer Service Cases (5 items)
// ============================================================

export type CaseMessage = {
  id: string;
  sender: "customer" | "agent";
  senderName: string;
  body: string;
  sentAt: string;
};

export type SOPTemplateCategory =
  | "Quality Issue"
  | "Sizing"
  | "Wrong Item"
  | "Delivery"
  | "Trustpilot";

export type SOPTemplate = {
  id: string;
  category: SOPTemplateCategory;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
};

export type CustomerCase = {
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
};

export const customerCases: CustomerCase[] = [
  {
    id: "cs-001",
    customerName: "James Mitchell",
    email: "j.mitchell@gmail.com",
    subject: "Stitching coming undone after 2 wears",
    classification: "Quality Issue",
    orderNumber: "OL-4821",
    product: "Maven Bomber Jacket",
    orderDate: daysAgo(18),
    trackingStatus: "Delivered",
    lifetimeValue: 142,
    orderCount: 2,
    previousRefunds: "None",
    messagePreview: "Hi, I bought the Maven Bomber Jacket and after wearing it twice the stitching on the left sleeve...",
    messages: [
      {
        id: "msg-001-1",
        sender: "customer",
        senderName: "James Mitchell",
        body: "Hi,\n\nI bought the Maven Bomber Jacket and after wearing it twice the stitching on the left sleeve has started to come undone. I really like the jacket and was hoping for better quality. Could you help me resolve this?\n\nThanks,\nJames",
        sentAt: hoursAgo(3),
      },
      {
        id: "msg-001-2",
        sender: "agent",
        senderName: "Claire from Vantage",
        body: "Hi James,\n\nThank you for reaching out. I'm really sorry to hear you're not fully satisfied with your order \u2014 I'll do everything I can to turn this around and ensure your experience with us ends on a much better note.\n\nWe'd love to help resolve this in a way that's as smooth and stress-free as possible.\n\nHere are a few options we can offer:\n\n\u2022 A 30% refund, processed immediately \u2014 no need to send the product back.\n\u2022 Return the product via Royal Mail Special Delivery Guaranteed. Once we receive and inspect it to ensure it's unused and in original condition, we'll issue a refund minus a 30% restocking fee. Return shipping is at your cost.\n\u2022 A full 100% store credit so you can pick a different item or size.\n\u2022 A free replacement \u2014 no need to return the original item.\n\nPlease let me know which option works best for you \u2014 I'll make sure to have it processed for you as smoothly as possible.\n\nWe're more than willing to help however we can, and our goal is always to ensure you feel fully supported and cared for throughout your experience with us.\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
        sentAt: hoursAgo(2.5),
      },
      {
        id: "msg-001-3",
        sender: "customer",
        senderName: "James Mitchell",
        body: "Hi Claire,\n\nThanks for getting back to me so quickly. I'll take the 30% refund option please \u2014 I'd like to keep the jacket as I do really like it otherwise.\n\nCheers,\nJames",
        sentAt: hoursAgo(1.5),
      },
      {
        id: "msg-001-4",
        sender: "agent",
        senderName: "Claire from Vantage",
        body: "Hi James,\n\nThank you for your response. I've now processed your 30% refund as agreed \u2014 it should appear in your account within a few business days depending on your card provider.\n\nWe'd really appreciate your feedback \u2014 how would you rate your experience with our customer support?\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
        sentAt: hoursAgo(1),
      },
    ],
    receivedAt: hoursAgo(3),
    isRepeatClaimer: false,
  },
  {
    id: "cs-002",
    customerName: "Sophie Turner",
    email: "sophie.t@outlook.com",
    subject: "Received wrong colour - ordered black, got navy",
    classification: "Wrong Item",
    orderNumber: "OL-4835",
    product: "Harrington Trainers",
    orderDate: daysAgo(12),
    trackingStatus: "Delivered",
    lifetimeValue: 234,
    orderCount: 3,
    previousRefunds: "1 prior refund \u2014 30% issued 3 months ago",
    messagePreview: "Hello, I ordered the Harrington Trainers in black but I received a navy pair instead...",
    messages: [
      {
        id: "msg-002-1",
        sender: "customer",
        senderName: "Sophie Turner",
        body: "Hello,\n\nI ordered the Harrington Trainers in black but I received a navy pair instead. This is quite disappointing as I specifically needed black for an event this weekend. Can you please send me the correct colour or issue a refund?\n\nSophie",
        sentAt: hoursAgo(7),
      },
      {
        id: "msg-002-2",
        sender: "agent",
        senderName: "Claire from Vantage",
        body: "Hi Sophie,\n\nI'm really sorry to hear that you received the wrong item.\n\nWe can offer two solutions:\n\n1. Resend the correct item to you free of charge.\n2. Offer a 50% refund if you prefer not to wait for the replacement.\n\nPlease let me know which option you'd prefer, and we'll take care of it right away.\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
        sentAt: hoursAgo(6),
      },
      {
        id: "msg-002-3",
        sender: "customer",
        senderName: "Sophie Turner",
        body: "Hi,\n\nPlease resend the correct black pair. I need them as soon as possible for this weekend.\n\nThanks,\nSophie",
        sentAt: hoursAgo(5),
      },
      {
        id: "msg-002-4",
        sender: "agent",
        senderName: "Claire from Vantage",
        body: "Hi Sophie,\n\nApologies again for the mix-up! I've now arranged for the correct item to be sent to you free of charge and you should receive it within the next 7 Business Days.\n\nWe'd really appreciate your feedback \u2014 how would you rate your experience with our customer support?\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
        sentAt: hoursAgo(4.5),
      },
    ],
    receivedAt: hoursAgo(7),
    isRepeatClaimer: true,
  },
  {
    id: "cs-003",
    customerName: "Daniel Okafor",
    email: "d.okafor@yahoo.com",
    subject: "Size L too small - need exchange",
    classification: "Sizing",
    orderNumber: "OL-4842",
    product: "Haldrin Layered Shirt",
    orderDate: daysAgo(9),
    trackingStatus: "Delivered",
    lifetimeValue: 76,
    orderCount: 1,
    previousRefunds: "None",
    messagePreview: "Hi there, the Haldrin Layered Shirt in size L is way too tight across the chest...",
    messages: [
      {
        id: "msg-003-1",
        sender: "customer",
        senderName: "Daniel Okafor",
        body: "Hi there,\n\nThe Haldrin Layered Shirt in size L is way too tight across the chest and shoulders. I normally wear L in most brands. Is it possible to exchange for an XL?\n\nCheers,\nDaniel",
        sentAt: hoursAgo(12),
      },
    ],
    receivedAt: hoursAgo(12),
    isRepeatClaimer: false,
  },
  {
    id: "cs-004",
    customerName: "Emma Walsh",
    email: "emma.walsh@icloud.com",
    subject: "Order still not arrived - been 14 days",
    classification: "Delivery",
    orderNumber: "OL-4798",
    product: "Durango Road Sneakers",
    orderDate: daysAgo(16),
    trackingStatus: "In Transit \u2014 last scan 5 days ago",
    lifetimeValue: 189,
    orderCount: 2,
    previousRefunds: "None",
    messagePreview: "Hi, I placed my order over two weeks ago and it still hasn't arrived. The tracking hasn't updated...",
    messages: [
      {
        id: "msg-004-1",
        sender: "customer",
        senderName: "Emma Walsh",
        body: "Hi,\n\nI placed my order over two weeks ago and it still hasn't arrived. The tracking hasn't updated in 5 days and just says 'in transit'. I'm getting quite worried now. Can you look into this for me?\n\nThanks,\nEmma",
        sentAt: hoursAgo(18),
      },
    ],
    receivedAt: hoursAgo(18),
    isRepeatClaimer: false,
  },
  {
    id: "cs-005",
    customerName: "Ryan Clarke",
    email: "ryan.c@gmail.com",
    subject: "Zip broken on arrival",
    classification: "Quality Issue",
    orderNumber: "OL-4856",
    product: "Avalon Puffer Vest",
    orderDate: daysAgo(7),
    trackingStatus: "Delivered",
    lifetimeValue: 312,
    orderCount: 4,
    previousRefunds: "1 prior refund \u2014 50% issued 6 months ago",
    messagePreview: "Hey, just received the Avalon Puffer Vest and the main zip is completely stuck...",
    messages: [
      {
        id: "msg-005-1",
        sender: "customer",
        senderName: "Ryan Clarke",
        body: "Hey,\n\nJust received the Avalon Puffer Vest and the main zip is completely stuck and won't budge. Tried working it gently but it's defective. Pretty gutted as I was looking forward to wearing it.\n\nCan I get a replacement or refund?\n\nRyan",
        sentAt: hoursAgo(1),
      },
    ],
    receivedAt: hoursAgo(1),
    isRepeatClaimer: true,
  },
];

// ============================================================
// 4b. SOP Email Templates (from Returns & Refunds SOP)
// ============================================================

export const DEFAULT_SOP_TEMPLATES: SOPTemplate[] = [
  // ── Quality Issue ──
  {
    id: "sop-001",
    category: "Quality Issue",
    name: "Initial Offer",
    subject: "Let's Fix This Together",
    body: "Hi [Customer's Name],\n\nThank you for reaching out. I'm really sorry to hear you're not fully satisfied with your order \u2014 I'll do everything I can to turn this around and ensure your experience with us ends on a much better note.\n\nWe'd love to help resolve this in a way that's as smooth and stress-free as possible.\n\nHere are a few options we can offer:\n\n\u2022 A 30% refund, processed immediately \u2014 no need to send the product back.\n\u2022 Return the product via Royal Mail Special Delivery Guaranteed. Once we receive and inspect it to ensure it's unused and in original condition, we'll issue a refund minus a 30% restocking fee. Return shipping is at your cost.\n\u2022 A full 100% store credit so you can pick a different item or size.\n\u2022 A free replacement \u2014 no need to return the original item.\n\nPlease let me know which option works best for you \u2014 I'll make sure to have it processed for you as smoothly as possible.\n\nWe're more than willing to help however we can, and our goal is always to ensure you feel fully supported and cared for throughout your experience with us.\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
    isDefault: true,
  },
  {
    id: "sop-002",
    category: "Quality Issue",
    name: "30% Refund Accepted",
    subject: "Refund Confirmation",
    body: "Hi [Customer's Name],\n\nThank you for your response. I've now processed your 30% refund as agreed \u2014 it should appear in your account within a few business days depending on your card provider.\n\nWe'd really appreciate your feedback \u2014 how would you rate your experience with our customer support?\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
    isDefault: true,
  },
  {
    id: "sop-003",
    category: "Quality Issue",
    name: "Escalation 50% Offer",
    subject: "Final Refund Offer",
    body: "Hi [Customer's Name],\n\nI completely understand your concerns and I've double-checked with our management team. As a final gesture, we can offer a 50% refund, which would be the maximum possible on our end.\n\nPlease let me know how you'd like to proceed \u2014 I'll make sure to have it processed for you as smoothly as possible.\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
    isDefault: true,
  },
  {
    id: "sop-004",
    category: "Quality Issue",
    name: "Return Instructions",
    subject: "Return Instructions",
    body: "Hi [Customer's Name],\n\nThank you for letting me know, I can process the return if none of the other options works for you. Please make sure to use Royal Mail Special Delivery Guaranteed only when sending it back \u2014 this is important for tracking and insurance purposes, we won't be able to process the return if a different shipping method is used.\n\nYou can send your return to:\n\nVantage London\n71 Shelton Street\nCovent Garden, London, WC2H 9JQ\nUnited Kingdom\n\nOnce we receive the package, we'll inspect the item to confirm it is unused and in original condition. If everything checks out, we'll process your refund minus the 30% restocking fee as per our policy. The inspection process may take a few days.\n\nCan you please share your proof of postage and tracking number in this email? That would be great!\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
    isDefault: true,
  },
  // ── Sizing ──
  {
    id: "sop-005",
    category: "Sizing",
    name: "Initial Offer",
    subject: "Let's Fix the Sizing Issue",
    body: "Hi [Customer's Name],\n\nThank you for your message. I'm sorry to hear that the size wasn't quite right \u2014 we always strive to make sure every customer feels confident and happy with their purchase.\n\nWe'd love to help make this right in a way that's as smooth and helpful as possible.\n\nHere are a few options:\n\n\u2022 A 50% discount on a new order in the correct size.\n\u2022 A full store credit for the amount you paid, so you can choose a different item or size.\n\u2022 A free size replacement \u2014 no need to return the original item.\n\nJust let me know which option works best for you \u2014 I'll make sure we get it sorted as smoothly as possible.\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
    isDefault: true,
  },
  {
    id: "sop-006",
    category: "Sizing",
    name: "50% Discount Accepted",
    subject: "Exclusive Discount for Size Exchange",
    body: "Hi [Customer's Name],\n\nThanks again! I've now created your 50% discount code: [CODE] \u2014 you can apply it at checkout for your new order.\n\nIf you need help selecting the right size, feel free to ask.\n\nWe'd really appreciate your feedback \u2014 how would you rate your experience with our customer support?\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
    isDefault: true,
  },
  {
    id: "sop-007",
    category: "Sizing",
    name: "Store Credit Accepted",
    subject: "Store Credit Issued",
    body: "Hi [Customer's Name],\n\nThanks for confirming! I've just issued a store credit for the full amount of your original order. You're welcome to use it anytime to pick something else you love.\n\nLet me know if you need help browsing or with sizing \u2014 I'm here for you!\n\nWe'd really appreciate your feedback \u2014 how would you rate your experience with our customer support?\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
    isDefault: true,
  },
  {
    id: "sop-008",
    category: "Sizing",
    name: "Free Replacement Accepted",
    subject: "Size Replacement Sent",
    body: "Hi [Customer's Name],\n\nI've just sent out a new size for your order \u2014 no need to return the original. You'll get a tracking number shortly so you can keep an eye on delivery.\n\nWe'd really appreciate your feedback \u2014 how would you rate your experience with our customer support?\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
    isDefault: true,
  },
  // ── Wrong Item ──
  {
    id: "sop-009",
    category: "Wrong Item",
    name: "Initial Offer",
    subject: "Let's Make It Right",
    body: "Hi [Customer's Name],\n\nI'm really sorry to hear that you received the wrong item.\n\nWe can offer two solutions:\n\n1. Resend the correct item to you free of charge.\n2. Offer a 50% refund if you prefer not to wait for the replacement.\n\nPlease let me know which option you'd prefer, and we'll take care of it right away.\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
    isDefault: true,
  },
  {
    id: "sop-010",
    category: "Wrong Item",
    name: "Reshipment Chosen",
    subject: "Replacement on the Way",
    body: "Hi [Customer's Name],\n\nApologies again for the mix-up! I've now arranged for the correct item to be sent to you free of charge and you should receive it within the next 7 Business Days.\n\nWe'd really appreciate your feedback \u2014 how would you rate your experience with our customer support?\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
    isDefault: true,
  },
  {
    id: "sop-011",
    category: "Wrong Item",
    name: "50% Refund Chosen",
    subject: "Refund Processed \u2013 Wrong Item",
    body: "Hi [Customer's Name],\n\nThank you for your understanding. I've just processed your 50% refund for the order \u2014 it should reflect on your account shortly.\n\nIf you don't mind me asking, how would you rate your experience with our support?\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
    isDefault: true,
  },
  // ── Delivery ──
  {
    id: "sop-012",
    category: "Delivery",
    name: "Initial Response",
    subject: "We're Looking Into It",
    body: "Hi [Customer's Name],\n\nThank you for reaching out. I completely understand how frustrating it must be to wait this long for your order \u2014 I'll look into this right away.\n\nI've escalated this with our shipping partner and will have an update for you within 24 hours. If the parcel can't be located, I'll arrange for a replacement to be sent to you immediately at no extra cost.\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
    isDefault: true,
  },
  // ── Trustpilot ──
  {
    id: "sop-013",
    category: "Trustpilot",
    name: "5-Star Follow-Up",
    subject: "Thanks Again \u2013 One Last Favour",
    body: "Hi [Customer's Name],\n\nThat's wonderful to hear \u2014 thank you so much for the 5-star feedback!\n\nIf you have a moment, we'd be incredibly grateful if you could share your experience in a short review on Trustpilot. It really helps a small business like ours grow and continue improving.\n\nYou can leave your review here:\nhttps://www.trustpilot.com/review/vantagelondon.com\n\nThanks again for your support \u2014 it means the world to us!\n\nPlease let me know if you have any other questions or concerns, I would be happy to help!\n\nLooking forward to hearing from you,\n\nBest Regards,\nClaire from Vantage",
    isDefault: true,
  },
];

// ============================================================
// 5. Student Stores (4 items)
// ============================================================

export type StudentStore = {
  id: string;
  rank: number;
  storeName: string;
  owner: string;
  revenue: number;
  adSpend: number;
  profit: number;
  roas: number;
  status: "Active" | "Struggling" | "At Risk";
};

export const studentStores: StudentStore[] = [
  {
    id: "ss-001",
    rank: 1,
    storeName: "Vantage Melbourne",
    owner: "Jake",
    revenue: 4210,
    adSpend: 1840,
    profit: 892,
    roas: 2.29,
    status: "Active",
  },
  {
    id: "ss-002",
    rank: 2,
    storeName: "Harlow & Co",
    owner: "Maya",
    revenue: 2890,
    adSpend: 1340,
    profit: 430,
    roas: 2.16,
    status: "Active",
  },
  {
    id: "ss-003",
    rank: 3,
    storeName: "Norcroft Studio",
    owner: "Tom",
    revenue: 980,
    adSpend: 640,
    profit: -120,
    roas: 1.53,
    status: "Struggling",
  },
  {
    id: "ss-004",
    rank: 4,
    storeName: "Elara Fashion",
    owner: "Priya",
    revenue: 210,
    adSpend: 340,
    profit: -280,
    roas: 0.62,
    status: "At Risk",
  },
];

// ============================================================
// 6. Collaborators (Requests + Access)
// ============================================================

// Incoming collaboration requests — someone requesting access to YOUR store
export type CollabRequest = {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterInitials: string;
  targetStoreId: string;
  sentAt: string; // ISO
  status: "pending" | "approved" | "denied";
};

// A store where YOU have been approved as a collaborator
export type CollabAccess = {
  id: string;
  storeId: string;
  storeName: string;
  ownerName: string;
  ownerInitials: string;
  market: string;
  currency: string;
  revenue: number;
  adSpend: number;
  profit: number;
  roas: number;
  status: "Active" | "Struggling" | "At Risk";
  addedAt: string; // ISO
};

// Sent collaboration requests — requests YOU have sent to access someone else's store
export type SentCollabRequest = {
  id: string;
  targetStoreName: string;
  targetOwnerName: string;
  sentAt: string; // ISO
  status: "pending" | "approved" | "denied";
};

// Incoming requests to Jake's store (Vantage Melbourne)
// Keyed by userId so each user sees the right set of requests
export const INCOMING_COLLAB_REQUESTS: Record<string, CollabRequest[]> = {
  jake: [
    {
      id: "req-001",
      requesterId: "aidan",
      requesterName: "Aidan",
      requesterInitials: "A",
      targetStoreId: "vantage-melbourne",
      sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: "pending",
    },
    {
      id: "req-002",
      requesterId: "aidan",
      requesterName: "Aidan",
      requesterInitials: "A",
      targetStoreId: "vantage-melbourne",
      sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      status: "pending",
    },
  ],
  aidan: [],
};

// Stores where the user has approved collaborator access
export const MY_COLLAB_ACCESS: Record<string, CollabAccess[]> = {
  aidan: [
    {
      id: "ca-001",
      storeId: "vantage-melbourne",
      storeName: "Vantage Melbourne",
      ownerName: "Jake",
      ownerInitials: "J",
      market: "AU",
      currency: "A$",
      revenue: 4210,
      adSpend: 1840,
      profit: 892,
      roas: 2.29,
      status: "Active",
      addedAt: "2025-10-15T09:00:00.000Z",
    },
    {
      id: "ca-002",
      storeId: "harlow-co",
      storeName: "Harlow & Co",
      ownerName: "Maya",
      ownerInitials: "M",
      market: "UK",
      currency: "£",
      revenue: 2890,
      adSpend: 1340,
      profit: 430,
      roas: 2.16,
      status: "Active",
      addedAt: "2025-11-01T09:00:00.000Z",
    },
    {
      id: "ca-003",
      storeId: "norcroft-studio",
      storeName: "Norcroft Studio",
      ownerName: "Tom",
      ownerInitials: "T",
      market: "UK",
      currency: "£",
      revenue: 980,
      adSpend: 640,
      profit: -120,
      roas: 1.53,
      status: "Struggling",
      addedAt: "2025-12-10T09:00:00.000Z",
    },
    {
      id: "ca-004",
      storeId: "elara-fashion",
      storeName: "Elara Fashion",
      ownerName: "Priya",
      ownerInitials: "P",
      market: "UK",
      currency: "£",
      revenue: 210,
      adSpend: 340,
      profit: -280,
      roas: 0.62,
      status: "At Risk",
      addedAt: "2026-01-20T09:00:00.000Z",
    },
  ],
  jake: [],
};

// Sent requests — what you've sent out (for the "Request Access" section)
export const SENT_COLLAB_REQUESTS: Record<string, SentCollabRequest[]> = {
  aidan: [
    {
      id: "sr-001",
      targetStoreName: "Vantage Melbourne",
      targetOwnerName: "Jake",
      sentAt: "2025-10-13T09:00:00.000Z",
      status: "approved",
    },
    {
      id: "sr-002",
      targetStoreName: "Harlow & Co",
      targetOwnerName: "Maya",
      sentAt: "2025-10-29T09:00:00.000Z",
      status: "approved",
    },
    {
      id: "sr-003",
      targetStoreName: "Norcroft Studio",
      targetOwnerName: "Tom",
      sentAt: "2025-12-08T09:00:00.000Z",
      status: "approved",
    },
    {
      id: "sr-004",
      targetStoreName: "Elara Fashion",
      targetOwnerName: "Priya",
      sentAt: "2026-01-18T09:00:00.000Z",
      status: "approved",
    },
  ],
  jake: [],
};

// Store IDs for the "share your store ID" helper text
export const USER_STORE_IDS: Record<string, string> = {
  jake: "VNT-VMB-001",
  aidan: "VNT-LDN-000",
};
