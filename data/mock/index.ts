// ============================================================
// Vantage Command Center — Type Definitions & Constants
// Mock data arrays have been removed. App is production-only.
// ============================================================

const today = new Date();

export function daysAgo(n: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ============================================================
// 1. Research Sheet / Product Entity
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

// Legacy type for backwards compatibility with api-interfaces
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

// ============================================================
// 1d. Ad Creator Campaigns
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

// ============================================================
// 1e. Prompt Templates
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
// 2. Ad Campaigns
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

// ============================================================
// 3. Profit Tracker
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

// ============================================================
// 4. Customer Service Types
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

// Deferred module — customer service still uses demo data
export const customerCases: CustomerCase[] = [
  {
    id: "cs-001",
    customerName: "Emma Sinclair",
    email: "emma.sinclair@gmail.com",
    subject: "Defective zipper on Maven Bomber Jacket",
    classification: "Quality Issue",
    orderNumber: "VM-4821",
    product: "Maven Bomber Jacket",
    orderDate: daysAgo(12),
    trackingStatus: "Delivered",
    lifetimeValue: 274,
    orderCount: 3,
    previousRefunds: "1x partial refund (£12)",
    messagePreview: "The zipper broke on the second day. Very disappointed with the quality...",
    messages: [
      { id: "m1-1", sender: "customer", senderName: "Emma Sinclair", body: "Hi, I received my Maven Bomber Jacket last week and the zipper broke on the second day. The teeth are coming apart at the bottom. Very disappointed with the quality — this is my third order and the first two were great. I'd like a replacement or refund please.", sentAt: daysAgo(2) },
      { id: "m1-2", sender: "agent", senderName: "Claire", body: "Hi Emma, thank you for reaching out. I'm really sorry to hear about the zipper issue — that's definitely not the quality we want you to experience, especially as a loyal customer. I'd be happy to help resolve this right away. Would you prefer a full replacement or a partial refund? We can also offer store credit if you'd like to try a different style.", sentAt: daysAgo(2) },
      { id: "m1-3", sender: "customer", senderName: "Emma Sinclair", body: "I'd prefer a replacement if possible. Same size (M) please. Can you also check that the zipper is okay before shipping?", sentAt: daysAgo(1) },
    ],
    receivedAt: daysAgo(2),
    isRepeatClaimer: false,
  },
  {
    id: "cs-002",
    customerName: "Liam O'Brien",
    email: "liam.obrien@outlook.com",
    subject: "Matteo Cotton Pants too small",
    classification: "Sizing",
    orderNumber: "VM-4756",
    product: "Matteo Cotton Pants",
    orderDate: daysAgo(8),
    trackingStatus: "Delivered",
    lifetimeValue: 96,
    orderCount: 1,
    previousRefunds: "None",
    messagePreview: "Ordered an L but these fit like a medium. The size chart must be wrong...",
    messages: [
      { id: "m2-1", sender: "customer", senderName: "Liam O'Brien", body: "Hi, I ordered the Matteo Cotton Pants in Large but they fit more like a medium. The waist is too tight and the length is shorter than expected. I followed your size chart but I think it might be inaccurate. Can I exchange for an XL?", sentAt: daysAgo(3) },
    ],
    receivedAt: daysAgo(3),
    isRepeatClaimer: false,
  },
  {
    id: "cs-003",
    customerName: "Sophie Williams",
    email: "sophie.w@icloud.com",
    subject: "Received Haldrin Shirt instead of Enzo Loafers",
    classification: "Wrong Item",
    orderNumber: "VM-4803",
    product: "Enzo Suede Loafers",
    orderDate: daysAgo(6),
    trackingStatus: "Delivered",
    lifetimeValue: 182,
    orderCount: 2,
    previousRefunds: "None",
    messagePreview: "I ordered the Enzo Suede Loafers but received a Haldrin Layered Shirt instead...",
    messages: [
      { id: "m3-1", sender: "customer", senderName: "Sophie Williams", body: "Hello, I ordered the Enzo Suede Loafers (order VM-4803) but received a Haldrin Layered Shirt instead. This is clearly the wrong item. I need the correct product shipped to me as soon as possible please.", sentAt: daysAgo(1) },
      { id: "m3-2", sender: "agent", senderName: "Claire", body: "Hi Sophie, I'm so sorry about this mix-up! That's completely our fault. I've already arranged for the correct Enzo Suede Loafers to be shipped to you today via express delivery — you should receive them within 2–3 business days. You can keep the Haldrin Shirt as our apology. Is there anything else I can help with?", sentAt: daysAgo(1) },
    ],
    receivedAt: daysAgo(1),
    isRepeatClaimer: false,
  },
  {
    id: "cs-004",
    customerName: "Daniel Park",
    email: "daniel.park.shop@gmail.com",
    subject: "Order hasn't arrived after 2 weeks",
    classification: "Delivery",
    orderNumber: "VM-4689",
    product: "Durango Road Sneakers",
    orderDate: daysAgo(16),
    trackingStatus: "In Transit (delayed)",
    lifetimeValue: 78,
    orderCount: 1,
    previousRefunds: "None",
    messagePreview: "It's been over 2 weeks and my order still hasn't arrived. The tracking...",
    messages: [
      { id: "m4-1", sender: "customer", senderName: "Daniel Park", body: "It's been over 2 weeks since I placed my order for the Durango Road Sneakers and they still haven't arrived. The tracking shows 'In Transit' but hasn't updated in 5 days. What's going on? I need these for an event this weekend.", sentAt: daysAgo(1) },
      { id: "m4-2", sender: "agent", senderName: "Claire", body: "Hi Daniel, I'm really sorry about the delay. I've just checked with our shipping partner and it seems the package got stuck at a sorting facility. I've escalated this to priority handling. If we don't see movement in the next 24 hours, I'll send you a replacement via express at no cost. Would that work for you?", sentAt: daysAgo(0) },
    ],
    receivedAt: daysAgo(1),
    isRepeatClaimer: false,
  },
  {
    id: "cs-005",
    customerName: "Jake Thompson",
    email: "jake.thompson99@gmail.com",
    subject: "Color different from website photos",
    classification: "Quality Issue",
    orderNumber: "VM-4834",
    product: "Kensington Wool Overcoat",
    orderDate: daysAgo(5),
    trackingStatus: "Delivered",
    lifetimeValue: 448,
    orderCount: 4,
    previousRefunds: "2x partial refund (£24, £12)",
    messagePreview: "The overcoat color is completely different from what's shown on your website...",
    messages: [
      { id: "m5-1", sender: "customer", senderName: "Jake Thompson", body: "The Kensington Wool Overcoat I received looks nothing like the photos on your website. The website shows a deep charcoal but what I got is more of a washed-out grey. I've attached photos for comparison. This is the third time I've had issues with your products not matching the photos. I want a full refund this time.", sentAt: daysAgo(1) },
      { id: "m5-2", sender: "agent", senderName: "Claire", body: "Hi Jake, thanks for the feedback and the photos. I can definitely see the color difference and I understand your frustration, especially as a returning customer. Let me look into this with our product team and get back to you within 24 hours with the best resolution we can offer. I appreciate your patience.", sentAt: daysAgo(0) },
    ],
    receivedAt: daysAgo(1),
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
// 5. Student Stores (type only — no mock data)
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

// Deferred module — collaborators still uses demo data
export const INCOMING_COLLAB_REQUESTS: Record<string, CollabRequest[]> = {
  jake: [
    { id: "req-001", requesterId: "aidan", requesterName: "Aidan", requesterInitials: "A", targetStoreId: "vantage-melbourne", sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), status: "pending" },
    { id: "req-002", requesterId: "aidan", requesterName: "Aidan", requesterInitials: "A", targetStoreId: "vantage-melbourne", sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), status: "pending" },
  ],
  aidan: [],
};

export const MY_COLLAB_ACCESS: Record<string, CollabAccess[]> = {
  aidan: [
    { id: "ca-001", storeId: "vantage-melbourne", storeName: "Vantage Melbourne", ownerName: "Jake", ownerInitials: "J", market: "AU", currency: "A$", revenue: 4210, adSpend: 1840, profit: 892, roas: 2.29, status: "Active", addedAt: "2025-10-15T09:00:00.000Z" },
    { id: "ca-002", storeId: "harlow-co", storeName: "Harlow & Co", ownerName: "Maya", ownerInitials: "M", market: "UK", currency: "\u00a3", revenue: 2890, adSpend: 1340, profit: 430, roas: 2.16, status: "Active", addedAt: "2025-11-01T09:00:00.000Z" },
    { id: "ca-003", storeId: "norcroft-studio", storeName: "Norcroft Studio", ownerName: "Tom", ownerInitials: "T", market: "UK", currency: "\u00a3", revenue: 980, adSpend: 640, profit: -120, roas: 1.53, status: "Struggling", addedAt: "2025-12-10T09:00:00.000Z" },
    { id: "ca-004", storeId: "elara-fashion", storeName: "Elara Fashion", ownerName: "Priya", ownerInitials: "P", market: "UK", currency: "\u00a3", revenue: 210, adSpend: 340, profit: -280, roas: 0.62, status: "At Risk", addedAt: "2026-01-20T09:00:00.000Z" },
  ],
  jake: [],
};

export const SENT_COLLAB_REQUESTS: Record<string, SentCollabRequest[]> = {
  aidan: [
    { id: "sr-001", targetStoreName: "Vantage Melbourne", targetOwnerName: "Jake", sentAt: "2025-10-13T09:00:00.000Z", status: "approved" },
    { id: "sr-002", targetStoreName: "Harlow & Co", targetOwnerName: "Maya", sentAt: "2025-10-29T09:00:00.000Z", status: "approved" },
    { id: "sr-003", targetStoreName: "Norcroft Studio", targetOwnerName: "Tom", sentAt: "2025-12-08T09:00:00.000Z", status: "approved" },
    { id: "sr-004", targetStoreName: "Elara Fashion", targetOwnerName: "Priya", sentAt: "2026-01-18T09:00:00.000Z", status: "approved" },
  ],
  jake: [],
};

export const USER_STORE_IDS: Record<string, string> = {
  jake: "VNT-VMB-001",
  aidan: "VNT-LDN-000",
};
