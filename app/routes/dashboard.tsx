import { Suspense } from "react";
import {
    Await,
    isRouteErrorResponse,
    useFetcher,
    useLoaderData,
    useRevalidator,
    useRouteError,
    type MetaFunction,
} from "react-router";
import {
    Page,
    Layout,
    Card,
    Button,
    Text,
    BlockStack,
    InlineStack,
    Banner,
    SkeletonBodyText,
    SkeletonDisplayText,
    Box,
} from "@shopify/polaris";
import { getInventory, claimStock, type Item } from "~/models/inventory.server";
import type { Route } from "./+types/dashboard";

export const meta: MetaFunction = () => {
    return [{ title: "Unreliable Inventory Dashboard" }];
};

export async function loader() {
    // Requirement 1 & 2: Streaming
    // We return the promise directly (not awaited) so the page shell renders immediately.
    // React Router v7 automatically handles streaming - no defer() needed.
    const inventoryPromise = getInventory();
    return { inventory: inventoryPromise };
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const itemId = formData.get("itemId");

    if (typeof itemId !== "string") {
        throw new Error("Invalid Item ID");
    }

    // Artificial delay is handled in the model, but we await it here.
    // The UI will be optimistic, so this delay won't be felt by the user.
    try {
        const updatedItem = await claimStock(itemId);
        return { success: true, updatedItem };
    } catch (error) {
        // If it fails (e.g. out of stock), we return the error so the UI can rollback.
        return { success: false, error: (error as Error).message };
    }
}

export default function Dashboard() {
    const { inventory } = useLoaderData<typeof loader>();

    return (
        <Page title="Inventory Dashboard" fullWidth>
            <Layout>
                <Layout.Section>
                    <Card>
                        <BlockStack gap="500">
                            <Text as="h2" variant="headingMd">
                                Warehouse Stock
                            </Text>

                            <Suspense fallback={<InventorySkeleton />}>
                                <Await
                                    resolve={inventory}
                                    errorElement={<InventoryError />}
                                >
                                    {(items) => <InventoryList items={items} />}
                                </Await>
                            </Suspense>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

function InventorySkeleton() {
    return (
        <BlockStack gap="400">
            {[1, 2, 3, 4].map((i) => (
                <Box key={i} paddingBlock="200" borderColor="border">
                    <InlineStack align="space-between" blockAlign="center">
                        <div style={{ width: '200px' }}>
                            <SkeletonDisplayText size="small" />
                        </div>
                        <div style={{ width: '100px' }}>
                            <SkeletonBodyText lines={1} />
                        </div>
                        <div style={{ width: '80px', height: '32px', background: '#e1e1e1', borderRadius: '4px' }}></div>
                    </InlineStack>
                </Box>
            ))}
        </BlockStack>
    );
}

function InventoryList({ items }: { items: Item[] }) {
    return (
        <BlockStack gap="0">
            {items.map((item) => (
                <InventoryItem key={item.id} item={item} />
            ))}
        </BlockStack>
    );
}

function InventoryItem({ item }: { item: Item }) {
    const fetcher = useFetcher();

    // Task 2: Instant Feedback (Optimistic UI)
    // We determine the optimistic stock value.
    const isClaiming = fetcher.formData?.get("itemId") === item.id;
    const isOptimistic = isClaiming && fetcher.state !== "idle";

    // If we are claiming, subtract 1 immediately.
    // If the action fails, fetcher.data will contain the error, and we should revert (which happens automatically when idle).
    // Ideally, if it fails, we want to show a toast or error, but for this simple list, re-rendering with original data is the rollback.

    // Actually, standard Remix optimistic UI:
    // Displayed Stock = (isClaiming) ? (Real Stock - 1) : (Real Stock)

    const displayedStock = isOptimistic ? item.stock - 1 : item.stock;

    // Requirement 3: Protection (Prevent double submission)
    // We disable the button if we are already claiming this item.
    const isDisabled = isOptimistic || item.stock <= 0;

    return (
        <Box paddingBlock="300" borderColor="border">
            <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {item.name}
                </Text>

                <Text as="span" variant="bodyMd" tone={displayedStock < 5 ? "critical" : "success"}>
                    {displayedStock} in stock
                </Text>

                <fetcher.Form method="post">
                    <input type="hidden" name="itemId" value={item.id} />
                    <Button submit disabled={isDisabled} variant="primary">
                        Claim One
                    </Button>
                </fetcher.Form>
            </InlineStack>
            {fetcher.data?.error && (
                <Box paddingBlockStart="200">
                    <Banner tone="critical" title="Failed to claim stock">
                        <p>{fetcher.data.error}</p>
                    </Banner>
                </Box>
            )}
        </Box>
    );
}

// Task 3: Contain the Blast (Error Boundaries)
// This component renders inside the Await's errorElement
function InventoryError() {
    // We can use useAsyncError here if we want, but Await passes the error to errorElement?
    // Actually Await's errorElement renders when the promise rejects.
    // To make it fully robust and allow "Reset", we might need a way to retry.
    // A simple button that reloads the page is the easiest retry for a loader.
    // Or we use useRevalidator.

    // BUT, the requirements say "The 'Retry Button' must re-run the loader... without forcing a full browser page refresh."
    // So we should use `useRevalidator` if available or `useFetcher` to reload. 
    // Wait, `useRevalidator` is the standard way to revalidate loaders.

    // Check if we are inside a route error boundary or Await error boundary.
    // If getInventory throws, Await catches it and renders `errorElement`.

    // We can wrap this in a component to use hooks.
    return <InventoryErrorBanner />;
}

function InventoryErrorBanner() {
    const revalidator = useRevalidator();

    return (
        <Banner
            title="Failed to load inventory"
            tone="critical"
            action={{
                content: "Retry",
                onAction: () => revalidator.revalidate(),
            }}
        >
            <p>The backend legacy API failed to respond. Please try again.</p>
        </Banner>
    );
}

// Route Level Error Boundary (for critical failures outside of streaming)
export function ErrorBoundary() {
    const error = useRouteError();
    const revalidator = useRevalidator();

    let message = "Unknown Error";
    if (isRouteErrorResponse(error)) {
        message = `${error.status} ${error.statusText}`;
    } else if (error instanceof Error) {
        message = error.message;
    }

    return (
        <Page title="Inventory Dashboard">
            <Layout>
                <Layout.Section>
                    <Banner
                        title="Critical System Error"
                        tone="critical"
                        action={{
                            content: "Retry",
                            onAction: () => revalidator.revalidate(),
                        }}
                    >
                        <p>{message}</p>
                    </Banner>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
