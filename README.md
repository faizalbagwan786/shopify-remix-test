# Inventory Dashboard

A warehouse inventory dashboard built with React Router v7 and Shopify Polaris. It demonstrates resilience patterns against an unreliable legacy backend API.

## The Challenge

The backend simulates real-world legacy system problems:
- 3-second latency fetching inventory
- Random 500 errors (20% of requests)
- 1-second delay on stock claims

## How I Built It

### Streaming

Instead of blocking the page for 3 seconds with `await getInventory()`, the loader returns the promise directly and lets React Router stream the data:

```typescript
export async function loader() {
  const inventoryPromise = getInventory();
  return { inventory: inventoryPromise }; // Not awaited!
}
```

The UI shows a skeleton loader while the data streams in. No blank screens.

### Optimistic UI

When you click "Claim One", the stock count drops instantly (no waiting for the server). I use `useFetcher` to track pending state:

```typescript
const isClaiming = fetcher.formData?.get("itemId") === item.id;
const displayedStock = isClaiming ? item.stock - 1 : item.stock;
```

If the claim fails (out of stock, etc.), the UI automatically rolls back to the real value. The button also disables during submission to prevent double-clicks.

### Error Handling

Since the API randomly fails, I implemented two levels of error boundaries:

1. **Streaming level** - `Await`'s `errorElement` catches inventory fetch failures and shows a retry banner without breaking the page layout
2. **Route level** - A proper `ErrorBoundary` export catches anything unexpected

Both use `useRevalidator()` to retry without a full page refresh.

## Tech Stack

- React Router v7
- Shopify Polaris for UI
- TypeScript
- Vite

## Running It

```bash
npm install
npm run dev
```

Open [http://localhost:5173/dashboard](http://localhost:5173/dashboard)

## Testing Error States

- Refresh a few times to see the random API failures (~20% chance)
- Try claiming "Mega Widget B" (starts at 0 stock) to see the error handling
- Hit retry on error banners - it re-fetches without refreshing the page
