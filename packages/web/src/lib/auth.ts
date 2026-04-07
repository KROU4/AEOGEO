let accessTokenProvider: (() => Promise<string | null>) | null = null;

let cachedToken: string | null = null;
let cachedAt = 0;
const TOKEN_TTL = 50_000; // 50s (Clerk tokens last ~60s)

export function setAccessTokenProvider(
  provider: (() => Promise<string | null>) | null,
): void {
  accessTokenProvider = provider;
}

export function clearTokenCache(): void {
  cachedToken = null;
  cachedAt = 0;
}

export async function getAccessToken(): Promise<string | null> {
  if (!accessTokenProvider) {
    return null;
  }

  if (cachedToken && Date.now() - cachedAt < TOKEN_TTL) {
    return cachedToken;
  }

  try {
    cachedToken = await accessTokenProvider();
    cachedAt = Date.now();
    return cachedToken;
  } catch {
    return null;
  }
}
