"use client";

type SignMessageAsync = (args: { message: string }) => Promise<string>;

const ADMIN_SIGNATURE_TTL_MS = 4 * 60_000;
const signedAdminQueries = new Map<string, { query: string; expiresAt: number }>();
const pendingAdminQueries = new Map<string, Promise<string>>();

export function buildAdminMessage(action: string, address: string) {
  return [
    "BasePlay admin action",
    `Action: ${action}`,
    `Address: ${address}`,
    `Timestamp: ${new Date().toISOString()}`
  ].join("\n");
}

export async function getSignedAdminQuery({
  action,
  address,
  signMessageAsync
}: {
  action: string;
  address: string;
  signMessageAsync: SignMessageAsync;
}) {
  const key = `${action}:${address.toLowerCase()}`;
  const cached = signedAdminQueries.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.query;

  const pending = pendingAdminQueries.get(key);
  if (pending) return pending;

  const request = (async () => {
    const message = buildAdminMessage(action, address);
    const signature = await signMessageAsync({ message });
    const query = new URLSearchParams({ admin: address, message, signature }).toString();
    signedAdminQueries.set(key, { query, expiresAt: Date.now() + ADMIN_SIGNATURE_TTL_MS });
    return query;
  })().finally(() => {
    pendingAdminQueries.delete(key);
  });

  pendingAdminQueries.set(key, request);
  return request;
}
