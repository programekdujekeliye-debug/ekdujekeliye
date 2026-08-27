# Frontend Hosting Review: Vercel Hobby vs Cloudflare Pages

## 1. Executive Summary & Context

The **Ek Duje Ke Liye** public website is an event discovery, couple registration, and pass issuance portal with active ticket sales.

### Core Question
Is **Vercel Hobby** suitable for commercial ticket sales, and what is the transition plan to **Cloudflare Pages** (Zero-Cost, unlimited commercial bandwidth)?

---

## 2. Comparison Matrix

| Factor | Vercel Hobby | Cloudflare Pages (Free) |
| :--- | :--- | :--- |
| **Commercial Use Terms** | Strictly Non-Commercial / Personal only in TOS | **Full Commercial Use Allowed on Free Tier** |
| **Outbound Bandwidth** | 100 GB / month (Hard throttling / risk of account flag) | **Unlimited Bandwidth (Zero egress fees)** |
| **Static Asset CDN** | Global Edge CDN | Global Anycast Edge (330+ Cities) |
| **Next.js Support** | Native (Turbopack / App Router SSR) | Native via `@cloudflare/next-on-pages` or Static Export |
| **Custom Domains & SSL** | 1 Included Free | Unlimited Custom Domains & Free Universal SSL |
| **Build Minutes** | 6,000 mins / month | 500 builds / month (Unlimited requests) |
| **Cold Start / Sleep** | Instant for Static / Edge | Instant (Zero server cold start) |

---

## 3. Architecture Alignment for Cloudflare Pages Readiness

The Ek Duje Ke Liye Next.js 16 frontend is architected with **Static Pages + Client-Side Dynamic Hydration**:
* Homepage (`/`): Pre-rendered static landing page fetching live event cards from `/api/public/home`.
* Legal & Policy Pages (`/privacy-policy`, `/terms`): 100% Pre-rendered static HTML.
* Dynamic Event Pages (`/event/[slug]`): Static layout with client-side form submission.
* Pass & Payment Pages (`/pass/[id]`, `/payment/[id]`): Client-side Canvas rendering & Razorpay modal checkout.

### Cloudflare Pages Deployment Options:
1. **Static Export (`output: 'export'`)**:
   * Generates static HTML/JS/CSS bundle into `out/`.
   * Directly deployable to Cloudflare Pages with zero server overhead and infinite free scaling.
2. **Next on Pages (`@cloudflare/next-on-pages`)**:
   * Compiles App Router dynamic routes to Cloudflare Edge Workers if server-side rendering is required in the future.

---

## 4. Recommendation & Rollback Strategy

* **Current Recommendation**: Maintain current deployment on Vercel during development, and prepare `next.config.ts` for Cloudflare Pages Static Export when going to public multi-city production.
* **Zero Cost Invariant**: Cloudflare Pages Free Tier requires **₹0 / month** with no bandwidth overage fees.
