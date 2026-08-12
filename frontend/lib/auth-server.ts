const JWT_SECRET =
  process.env.JWT_SECRET || "pharmatch-dev-secret-change-in-production";

export type AuthPayload = {
  sub: string;
  email: string;
  role: string;
  name?: string;
  permissions?: string[];
  exp: number;
};

function hasSessionPermission(session: AuthPayload, permission: string): boolean {
  if (session.role === "admin") return true;
  return (session.permissions ?? []).includes(permission);
}

function decodeBase64Url(data: string): string {
  const padded = data + "=".repeat((4 - (data.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyAccessToken(token: string): Promise<AuthPayload | null> {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;

    const expected = await hmacSha256Hex(JWT_SECRET, data);
    if (sig !== expected) return null;

    const payload = JSON.parse(decodeBase64Url(data)) as AuthPayload;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getTokenMaxAgeSeconds(): number {
  const hours = Number(process.env.JWT_TTL_HOURS || "12");
  return hours * 3600;
}
