// ============================================================
// Olympus Command Center — Mock Data
// All dates are relative to today. All metrics use realistic
// ranges from Simo's actual store operations.
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
// 1a. Discovery Products (pool for "Run Research")
// ============================================================

export type DiscoveryProduct = {
  id: string;
  productName: string;
  adLink: string;
  storeLink: string;
  spend: number;
  activeAds: number;
  lastSeen: string;
  brandsRunning: number;
  placeholderGradient: string;
};

const gradients = [
  "from-indigo-600 to-purple-500",
  "from-emerald-600 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-600 to-pink-500",
  "from-cyan-500 to-blue-500",
  "from-violet-600 to-fuchsia-500",
  "from-lime-500 to-green-500",
  "from-sky-500 to-indigo-500",
  "from-red-500 to-amber-500",
  "from-teal-500 to-emerald-500",
  "from-fuchsia-500 to-rose-500",
  "from-blue-600 to-cyan-500",
  "from-orange-500 to-yellow-500",
  "from-pink-500 to-violet-500",
  "from-green-500 to-lime-500",
];

export const discoveryPool: DiscoveryProduct[] = [
  { id: "dp-001", productName: "Harrington Trainers", adLink: "https://facebook.com/ads/library/?id=100001", storeLink: "https://competitor-a.myshopify.com", spend: 12400, activeAds: 18, lastSeen: "1d ago", brandsRunning: 5, placeholderGradient: gradients[0] },
  { id: "dp-002", productName: "Durango Road Sneakers", adLink: "https://facebook.com/ads/library/?id=100002", storeLink: "https://competitor-b.myshopify.com", spend: 8200, activeAds: 11, lastSeen: "2d ago", brandsRunning: 4, placeholderGradient: gradients[1] },
  { id: "dp-003", productName: "Maven Bomber Jacket", adLink: "https://facebook.com/ads/library/?id=100003", storeLink: "https://competitor-c.myshopify.com", spend: 6800, activeAds: 9, lastSeen: "3d ago", brandsRunning: 3, placeholderGradient: gradients[2] },
  { id: "dp-004", productName: "Matteo Cotton Pants", adLink: "https://facebook.com/ads/library/?id=100004", storeLink: "https://competitor-d.myshopify.com", spend: 4500, activeAds: 7, lastSeen: "1d ago", brandsRunning: 3, placeholderGradient: gradients[3] },
  { id: "dp-005", productName: "Haldrin Layered Shirt", adLink: "https://facebook.com/ads/library/?id=100005", storeLink: "https://competitor-e.myshopify.com", spend: 19200, activeAds: 22, lastSeen: "4h ago", brandsRunning: 5, placeholderGradient: gradients[4] },
  { id: "dp-006", productName: "Enzo Suede Loafers", adLink: "https://facebook.com/ads/library/?id=100006", storeLink: "https://competitor-f.myshopify.com", spend: 11300, activeAds: 14, lastSeen: "6h ago", brandsRunning: 4, placeholderGradient: gradients[5] },
  { id: "dp-007", productName: "Avalon Puffer Vest", adLink: "https://facebook.com/ads/library/?id=100007", storeLink: "https://competitor-g.myshopify.com", spend: 24600, activeAds: 26, lastSeen: "12h ago", brandsRunning: 6, placeholderGradient: gradients[6] },
  { id: "dp-008", productName: "Kensington Wool Overcoat", adLink: "https://facebook.com/ads/library/?id=100008", storeLink: "https://competitor-h.myshopify.com", spend: 5100, activeAds: 8, lastSeen: "2d ago", brandsRunning: 3, placeholderGradient: gradients[7] },
  { id: "dp-009", productName: "Arden Cargo Joggers", adLink: "https://facebook.com/ads/library/?id=100009", storeLink: "https://competitor-i.myshopify.com", spend: 15700, activeAds: 20, lastSeen: "3h ago", brandsRunning: 7, placeholderGradient: gradients[8] },
  { id: "dp-010", productName: "Beckett Chelsea Boots", adLink: "https://facebook.com/ads/library/?id=100010", storeLink: "https://competitor-j.myshopify.com", spend: 9400, activeAds: 13, lastSeen: "1d ago", brandsRunning: 4, placeholderGradient: gradients[9] },
  { id: "dp-011", productName: "Weston Knit Polo", adLink: "https://facebook.com/ads/library/?id=100011", storeLink: "https://competitor-k.myshopify.com", spend: 7800, activeAds: 10, lastSeen: "5h ago", brandsRunning: 3, placeholderGradient: gradients[10] },
  { id: "dp-012", productName: "Langley Trench Coat", adLink: "https://facebook.com/ads/library/?id=100012", storeLink: "https://competitor-l.myshopify.com", spend: 21000, activeAds: 24, lastSeen: "8h ago", brandsRunning: 5, placeholderGradient: gradients[11] },
  { id: "dp-013", productName: "Rhodes Track Jacket", adLink: "https://facebook.com/ads/library/?id=100013", storeLink: "https://competitor-m.myshopify.com", spend: 3200, activeAds: 5, lastSeen: "3d ago", brandsRunning: 2, placeholderGradient: gradients[12] },
  { id: "dp-014", productName: "Carter Slim Chinos", adLink: "https://facebook.com/ads/library/?id=100014", storeLink: "https://competitor-n.myshopify.com", spend: 16500, activeAds: 19, lastSeen: "2h ago", brandsRunning: 6, placeholderGradient: gradients[13] },
  { id: "dp-015", productName: "Novak Quilted Gilet", adLink: "https://facebook.com/ads/library/?id=100015", storeLink: "https://competitor-o.myshopify.com", spend: 10800, activeAds: 15, lastSeen: "1d ago", brandsRunning: 4, placeholderGradient: gradients[14] },
];

// ============================================================
// 1b. Research Sheet Products (products that passed discovery)
// ============================================================

export type SheetProduct = {
  id: string;
  productName: string;
  adLink: string;
  storeLink: string;
  testingStatus: "" | "Queued" | "Imported" | "Scheduled" | "Live" | "Killed";
  creativeSaved: boolean;
  cog: number | null;
  pricing: number | null;
  notes: string;
};

export const initialSheetProducts: SheetProduct[] = [
  {
    id: "sp-001",
    productName: "Maven Bomber Jacket",
    adLink: "https://facebook.com/ads/library/?id=100003",
    storeLink: "https://olympus-london.myshopify.com/products/maven-bomber-jacket",
    testingStatus: "Live",
    creativeSaved: true,
    cog: 18,
    pricing: 59.99,
    notes: "GOOD",
  },
  {
    id: "sp-002",
    productName: "Haldrin Layered Shirt",
    adLink: "https://facebook.com/ads/library/?id=100005",
    storeLink: "https://olympus-london.myshopify.com/products/haldrin-layered-shirt",
    testingStatus: "Scheduled",
    creativeSaved: true,
    cog: 12,
    pricing: 44.99,
    notes: "good",
  },
  {
    id: "sp-003",
    productName: "Harrington Trainers",
    adLink: "https://facebook.com/ads/library/?id=100001",
    storeLink: "https://olympus-london.myshopify.com/products/harrington-trainers",
    testingStatus: "Imported",
    creativeSaved: false,
    cog: 22,
    pricing: 74.99,
    notes: "GOOD",
  },
  {
    id: "sp-004",
    productName: "Enzo Suede Loafers",
    adLink: "https://facebook.com/ads/library/?id=100006",
    storeLink: "",
    testingStatus: "",
    creativeSaved: false,
    cog: null,
    pricing: null,
    notes: "Not DS",
  },
  {
    id: "sp-005",
    productName: "Avalon Puffer Vest",
    adLink: "https://facebook.com/ads/library/?id=100007",
    storeLink: "https://olympus-london.myshopify.com/products/avalon-puffer-vest",
    testingStatus: "Killed",
    creativeSaved: true,
    cog: 24,
    pricing: 69.99,
    notes: "Creative is branded",
  },
  {
    id: "sp-006",
    productName: "Kensington Wool Overcoat",
    adLink: "https://facebook.com/ads/library/?id=100008",
    storeLink: "",
    testingStatus: "Queued",
    creativeSaved: false,
    cog: 16,
    pricing: null,
    notes: "avoid",
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

export type ProductCopy = {
  id: string;
  productUrl: string;
  productName: string;
  imageUrl: string;
  shopifyDescription: string;
  facebookCopy: string;
  status: "" | "Pending" | "Generating" | "Completed";
};

export const initialCopyProducts: ProductCopy[] = [
  {
    id: "pc-001",
    productName: "Aymbr Sweater",
    productUrl: "https://vantagemelbourne.com/products/aymbr",
    imageUrl: "http://vantagemelbourne.com/cdn/shop/files/britt_wit_1_1_720x.jpg",
    shopifyDescription: "Modern Edge Meets Everyday Comfort\n\nElevate your seasonal wardrobe with a statement knit designed to turn heads. The Aymbr Sweater features distinctive openwork detail and a relaxed silhouette that flatters while keeping things effortlessly stylish.\n\n\u2022 Knitted Design: Cozy construction combines warmth with everyday refinement\n\u2022 Openwork Details: Intricate patterns bring depth and modern flair\n\u2022 Relaxed Fit: Slightly oversized shape with dropped shoulders for easy layering\n\u2022 Round Neck: Classic crew neckline complements any outfit\n\nDesigned in Melbourne by Vantage for timeless versatility.",
    facebookCopy: "Slide Into Textured Sophistication with the Aymbr Sweater\n\nPlayful structure meets confident style in this relaxed must-have. The Aymbr Sweater\u2019s openwork detail and patchwork texture bring effortless elegance to your rotation.\n\nRelaxed. Intricate. Versatile.\n\nhttps://vantagemelbourne.com/products/aymbr\nAymbr Sweater\nFree Shipping in Australia\nShop now",
    status: "Completed",
  },
  {
    id: "pc-002",
    productName: "All-Terrain Canvas Sneaker",
    productUrl: "https://vantagemelbourne.com/products/all-terrain-canvas-sneaker",
    imageUrl: "http://vantagemelbourne.com/cdn/shop/files/S6dba56a87e254678.webp",
    shopifyDescription: "Warm-Weather Function Meets Everyday Utility\n\nCrafted for comfort and ease, the All-Terrain Canvas Sneaker is ready for anything from daily errands to weekend adventures. The breathable upper and flexible sole support natural movement.\n\n\u2022 Low-Top Construction: Relaxed silhouette with casual styling appeal\n\u2022 Lace-Up Front: Metal eyelets provide secure fit and utility edge\n\u2022 Slip-Resistant Tread: Durable outsole provides reliable traction\n\u2022 Textured Details: Visible stitching and panel design add structure\n\nDesigned in Melbourne by Vantage for modern versatility.",
    facebookCopy: "Slide Into Everyday Motion with the All-Terrain Canvas Sneaker\n\nBuilt to keep pace with your routine, the All-Terrain Canvas Sneaker delivers breathable comfort, structured support, and rugged traction in one easygoing package.\n\nPractical. Breathable. Grounded.\n\nhttps://vantagemelbourne.com/products/all-terrain-canvas-sneaker\nAll-Terrain Canvas Sneaker\nFree Shipping in Australia\nShop now",
    status: "Completed",
  },
  {
    id: "pc-003",
    productName: "Maven Bomber Jacket",
    productUrl: "https://olympus-london.myshopify.com/products/maven-bomber-jacket",
    imageUrl: "",
    shopifyDescription: "",
    facebookCopy: "",
    status: "Pending",
  },
  {
    id: "pc-004",
    productName: "Harrington Trainers",
    productUrl: "https://olympus-london.myshopify.com/products/harrington-trainers",
    imageUrl: "",
    shopifyDescription: "",
    facebookCopy: "",
    status: "Pending",
  },
  {
    id: "pc-005",
    productName: "Haldrin Layered Shirt",
    productUrl: "https://olympus-london.myshopify.com/products/haldrin-layered-shirt",
    imageUrl: "",
    shopifyDescription: "",
    facebookCopy: "",
    status: "",
  },
];

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

export type AdCampaign = {
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
    recommendation: "$22 spent, CPC > $1, 0 ATC — SOP: Kill",
    budgetHistory: [
      { budgetPerDay: 30, status: "current", spend: 22, revenue: 0, orders: 0, profit: -22, roas: 0, cpc: 1.34, atc: 0 },
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
// 4. Customer Service Cases (5 items)
// ============================================================

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
  fullMessage: string;
  suggestedResponse: string;
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
    fullMessage:
      "Hi,\n\nI bought the Maven Bomber Jacket and after wearing it twice the stitching on the left sleeve has started to come undone. I really like the jacket and was hoping for better quality. Could you help me resolve this?\n\nThanks,\nJames",
    suggestedResponse:
      "Hi James,\n\nThank you for reaching out and I'm sorry to hear about the stitching issue with your Maven Bomber Jacket. That's certainly not the quality we aim for.\n\nI'd like to offer you a 30% partial refund to account for the inconvenience, and you're welcome to keep the jacket. If you'd prefer a full replacement instead, just let me know and I'll arrange that right away.\n\nApologies again for the trouble.\n\nBest regards,\nOlympus London",
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
    previousRefunds: "1 prior refund — 30% issued 3 months ago",
    messagePreview: "Hello, I ordered the Harrington Trainers in black but I received a navy pair instead...",
    fullMessage:
      "Hello,\n\nI ordered the Harrington Trainers in black but I received a navy pair instead. This is quite disappointing as I specifically needed black for an event this weekend. Can you please send me the correct colour or issue a refund?\n\nSophie",
    suggestedResponse:
      "Hi Sophie,\n\nI sincerely apologise for the mix-up with your Harrington Trainers order. I can see you ordered black and completely understand the frustration of receiving the wrong colour.\n\nI've arranged for the correct black pair to be sent out to you as a priority. You should receive tracking details within 24 hours. Please keep the navy pair as well — consider it on us for the inconvenience.\n\nSorry again, and I hope you enjoy them at your event!\n\nBest,\nOlympus London",
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
    fullMessage:
      "Hi there,\n\nThe Haldrin Layered Shirt in size L is way too tight across the chest and shoulders. I normally wear L in most brands. Is it possible to exchange for an XL?\n\nCheers,\nDaniel",
    suggestedResponse:
      "Hi Daniel,\n\nThanks for letting us know — I'm sorry the sizing wasn't right on the Haldrin Layered Shirt. Some of our pieces do run slightly smaller than standard UK sizing.\n\nI'll send out an XL for you straight away, no need to return the L. You should receive your new tracking number within 24 hours.\n\nAppreciate your patience!\n\nBest,\nOlympus London",
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
    trackingStatus: "In Transit — last scan 5 days ago",
    lifetimeValue: 189,
    orderCount: 2,
    previousRefunds: "None",
    messagePreview: "Hi, I placed my order over two weeks ago and it still hasn't arrived. The tracking hasn't updated...",
    fullMessage:
      "Hi,\n\nI placed my order over two weeks ago and it still hasn't arrived. The tracking hasn't updated in 5 days and just says 'in transit'. I'm getting quite worried now. Can you look into this for me?\n\nThanks,\nEmma",
    suggestedResponse:
      "Hi Emma,\n\nI completely understand your concern — a 14-day wait with stalled tracking is not acceptable.\n\nI've escalated this with our shipping partner and will have an update for you within 24 hours. If the parcel can't be located, I'll send out a replacement immediately at no extra cost.\n\nThank you for your patience and I'll be in touch very shortly.\n\nBest regards,\nOlympus London",
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
    previousRefunds: "1 prior refund — 50% issued 6 months ago",
    messagePreview: "Hey, just received the Avalon Puffer Vest and the main zip is completely stuck...",
    fullMessage:
      "Hey,\n\nJust received the Avalon Puffer Vest and the main zip is completely stuck and won't budge. Tried working it gently but it's defective. Pretty gutted as I was looking forward to wearing it.\n\nCan I get a replacement or refund?\n\nRyan",
    suggestedResponse:
      "Hi Ryan,\n\nSorry to hear about the zip issue on your Avalon Puffer Vest — that's definitely a manufacturing defect and shouldn't have made it through our quality checks.\n\nAs a valued repeat customer, I'd like to offer you a full replacement shipped out today, plus a 15% discount code for your next order as an apology. You don't need to return the faulty one.\n\nLet me know if you'd prefer a refund instead.\n\nBest,\nOlympus London",
    receivedAt: hoursAgo(1),
    isRepeatClaimer: true,
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
