import { ConvexHttpClient } from "convex/browser";

export const getConvexClient = (token?: string) => {
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    if (token) {
        client.setAuth(token);
    }
    return client;
};