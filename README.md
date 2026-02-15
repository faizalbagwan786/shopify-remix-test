# Remix Resilience Developer Assessment

This project implements an inventory dashboard that handles an unreliable backend API using Remix/React Router v7 features like Streaming, Optimistic UI, and Error Boundaries.

## Implementation Choices

### Task 2: Instant Feedback (Optimistic UI)

To achieve instant feedback when claiming stock:
1.  **Unique Fetcher per Item**: Each `InventoryItem` component uses its own `useFetcher` hook. This isolates the state management for each item, preventing UI glitches where unrelated items might update.
2.  **Optimistic State Calculation**:
    ```typescript
    const isClaiming = fetcher.formData?.get("itemId") === id;
    const displayStock = isClaiming ? stock - 1 : stock;
    ```
    We check `fetcher.formData` immediately. If a submission is in flight for the current item, we calculate the `displayStock` by subtracting 1 from the prop `stock`. This provides 0ms feedback.
3.  **Automatic Rollback**:
    If the server action fails (e.g., "Out of Stock"), the fetcher returns an error. The `formData` is cleared, and `displayStock` reverts to the original `stock` prop (which hasn't changed on the server).
4.  **Race Condition Protection**:
    By disabling the button while `isClaiming` is true (`disabled={isClaiming || displayStock <= 0}`), we prevent double-submission while the request is pending.

### Task 3: Contain the Blast (Retry Logic)

To handle the 20% random API failure rate:
1.  **Route-Level Error Boundary**: We export an `ErrorBoundary` component from `dashboard.tsx`. This catches any errors thrown during the loader execution (including streaming failures if handled at the route level).
2.  **User Feedback**: We use a Polaris `Banner` component inside the Error Boundary to inform the user of the failure without crashing the entire application shell (Header/Nav would remain if they existed outside the route).
3.  **Retry Mechanism**:
    ```typescript
    const revalidator = useRevalidator();
    const handleRetry = () => {
        revalidator.revalidate();
    };
    ```
    We use `useRevalidator` to re-trigger the loader without a full page refresh. This provides a smoother experience than `window.location.reload()`, preserving client-side state where applicable.

## Tech Stack
-   **Framework**: React Router v7 (Remix)
-   **UI Library**: Shopify Polaris
-   **Styling**: Tailwind CSS (via Vite)
