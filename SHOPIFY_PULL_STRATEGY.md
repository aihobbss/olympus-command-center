# Shopify Pull Strategy — How Vantage Gets Your Store Data

This explains exactly how Vantage pulls sales and refund data from your Shopify store, in plain terms.

---

## What We're Pulling

We pull **orders** from your Shopify store — the same data you see when you go to **Orders** in your Shopify admin. Every order includes:

- **Order date** — when the customer placed the order
- **Total price** — the full amount the customer paid (in your store's currency, e.g. AUD)
- **Refunds** — if you refunded any items on that order, we pick those up too

---

## How It Works, Step by Step

### 1. We Check Your Store's Timezone

Before anything else, we ask Shopify what timezone your store is set to (the one you chose in **Settings → General** in Shopify). This is important because a late-night order at 11pm Melbourne time is still "today" for you — but it's already "tomorrow" in some other timezones. We match your timezone exactly so that daily numbers line up with what Shopify shows you.

### 2. We Grab All Your Orders

We pull every order from your store for the time period being synced. On the very first sync, this goes back about 3 years to get your full history. After that, the daily sync just grabs the latest day.

We grab orders of **all statuses** — paid, pending, refunded, cancelled — because we need the full picture. This is the same data you'd see if you went to **Orders → All orders** in Shopify and didn't filter by anything.

### 3. We Add Up Revenue Per Day

For each order, we take the **total price** (the amount the customer paid) and add it to the day that order was placed. So if 5 orders came in on March 15th totalling $430 AUD, that day shows $430 revenue.

This matches what you see in Shopify under **Analytics → Total sales** — it's the gross order value.

### 4. We Track Refunds Separately

Here's where it gets important: **refunds are counted on the day you processed the refund, not the day the original order was placed.**

For example:
- A customer orders on **March 10th** for $80
- You refund them on **March 20th**

In this case:
- **March 10th** still shows the $80 revenue from that order
- **March 20th** shows the $80 refund

This is exactly how Shopify's own "Total sales" report works — refunds hit the day they're processed. We match that behaviour so our numbers always line up with yours.

### 5. What Gets Stored

For each day, we store:
- **Revenue** — the total of all order values placed that day (gross, before refunds)
- **Refunds** — the total refunded amount processed that day
- **Net Revenue** — Revenue minus Refunds (this is what feeds into profit calculations)
- **Orders** — how many orders came in that day
- **Ad Spend** — pulled separately from Meta/Facebook (not from Shopify)
- **COG** — cost of goods, either auto-estimated or manually entered by you
- **Profit** — Net Revenue minus Ad Spend minus COG minus transaction fees

---

## Where Does the Data Come From in Shopify?

| What we pull | Where it lives in Shopify |
|---|---|
| Orders + totals | **Orders → All orders** (every order with its `total_price`) |
| Refund amounts | **Orders → [specific order] → Refund history** (each refund's line item subtotals) |
| Store timezone | **Settings → General → Store timezone** |
| Store currency | Your store's default currency (AUD, GBP, USD, etc.) |

We **don't** pull from Shopify Analytics or Reports — we pull raw order data and compute everything ourselves. This gives us full control over how numbers are calculated and means we can break things down however we need to.

---

## How Often Does It Sync?

- **First sync**: Pulls ~3 years of order history (takes a minute or two)
- **Daily sync**: Runs automatically at midnight in your store's timezone, pulls just the latest day
- **Manual sync**: You can hit "Sync Now" in the Profit Tracker anytime to refresh

---

## Why Our Numbers Match Shopify's

Three things ensure our numbers match what Shopify shows:

1. **Same timezone** — we use your store's actual timezone, not UTC or some default
2. **Same refund logic** — refunds count on the processing date, not the order date
3. **Same revenue source** — we use `total_price` from each order, which is what Shopify's "Total sales" report uses

If you ever compare our daily revenue to Shopify's **Analytics → Total sales** filtered to the same day, they should match exactly.
