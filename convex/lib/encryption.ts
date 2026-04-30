/**
 * Versioned AES-256-GCM encryption using the Web Crypto API.
 *
 * Works in both the Convex runtime (queries/mutations) and Node.js (actions)
 * — no Node-specific imports required.
 *
 * ── Environment variables (set in Convex dashboard → Settings → Env Vars) ──
 *
 *   MESSAGING_ENCRYPTION_KEYS
 *     A JSON object mapping version strings to 64-character hex keys (32 bytes).
 *     Multiple versions can coexist so old messages remain decryptable during
 *     and after a rotation.
 *     Example value:  {"1":"a3f8c2...64hexchars..."}
 *
 *   MESSAGING_ENCRYPTION_KEY_CURRENT
 *     The version string that new messages are encrypted with.
 *     Example value:  1
 *
 * ── First-time setup ────────────────────────────────────────────────────────
 *
 *   1. Generate a 32-byte key:
 *        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 *   2. Set env vars in the Convex dashboard:
 *        MESSAGING_ENCRYPTION_KEYS        {"1":"<output from step 1>"}
 *        MESSAGING_ENCRYPTION_KEY_CURRENT 1
 *
 *   3. Deploy:  npx convex deploy  (run from the project root, not mobile/)
 *
 *   New messages are now encrypted. Existing plaintext messages are still
 *   readable — decrypt() passes through anything without a v{n}: prefix.
 *   Run the rotateEncryption action (see below) to encrypt legacy messages.
 *
 * ── Key rotation procedure ───────────────────────────────────────────────────
 *
 *   Rotation re-encrypts all messages with a new key without downtime.
 *   The old key stays in MESSAGING_ENCRYPTION_KEYS until migration is complete
 *   so messages written during the transition can still be decrypted.
 *
 *   Step 1 — Generate a new key:
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 *   Step 2 — Add the new key alongside the old one in the dashboard:
 *     MESSAGING_ENCRYPTION_KEYS        {"1":"<old key>","2":"<new key>"}
 *     MESSAGING_ENCRYPTION_KEY_CURRENT 2
 *
 *   Step 3 — Deploy so new messages start using key 2 immediately:
 *     npx convex deploy
 *
 *   Step 4 — Re-encrypt all messages that are still on key 1 (or plaintext):
 *     Convex dashboard → Functions → messaging:rotateEncryption → Run Function
 *     Args: {}
 *     The function logs how many messages were rotated and the target version.
 *     It is idempotent — safe to run multiple times.
 *
 *   Step 5 — Once rotateEncryption reports 0 messages remaining on the old
 *     version, remove key 1 from MESSAGING_ENCRYPTION_KEYS and redeploy:
 *     MESSAGING_ENCRYPTION_KEYS        {"2":"<new key>"}
 *     MESSAGING_ENCRYPTION_KEY_CURRENT 2
 *
 * ── Ciphertext format ────────────────────────────────────────────────────────
 *
 *   v{version}:<base64(iv[12 bytes] + ciphertext + auth_tag[16 bytes])>
 *
 *   The 16-byte GCM authentication tag is appended to the ciphertext by the
 *   Web Crypto API automatically and verified on decryption, providing
 *   both confidentiality and integrity.
 *
 * ── What this protects ───────────────────────────────────────────────────────
 *
 *   - Database dumps / storage-layer access: message bodies are ciphertext.
 *   - Push notification previews remain plaintext (sent by the Expo push
 *     service but never stored in the DB).
 *   - This is NOT end-to-end encryption — the Convex server holds the key
 *     and decrypts on read. Protects against DB leaks, not server compromise.
 */

// ── Byte / base64 helpers ─────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) throw new Error("Hex string has odd length");
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

function toBase64(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ── Key management ────────────────────────────────────────────────────────────

function getKeyMaterial(version: string): Uint8Array<ArrayBuffer> {
  const raw = process.env.MESSAGING_ENCRYPTION_KEYS;
  if (!raw) throw new Error("MESSAGING_ENCRYPTION_KEYS env var is not set");
  const map = JSON.parse(raw) as Record<string, string>;
  const hex = map[version];
  if (!hex) throw new Error(`Key version "${version}" not found in MESSAGING_ENCRYPTION_KEYS`);
  if (hex.length !== 64) throw new Error(`Key version "${version}" must be 64 hex chars (32 bytes)`);
  return hexToBytes(hex);
}

async function importKey(version: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    getKeyMaterial(version),
    { name: "AES-GCM" },
    false,           // not extractable
    ["encrypt", "decrypt"]
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string.
 * Returns a versioned ciphertext: `v{version}:<base64>`.
 */
export async function encrypt(plaintext: string): Promise<string> {
  const version = process.env.MESSAGING_ENCRYPTION_KEY_CURRENT;
  if (!version) throw new Error("MESSAGING_ENCRYPTION_KEY_CURRENT env var is not set");

  const key = await importKey(version);
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const encoded = new TextEncoder().encode(plaintext);

  // Web Crypto AES-GCM output: ciphertext || 16-byte auth tag
  const cipherWithTag = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)
  );

  // Pack: iv (12 bytes) + ciphertext+tag
  const combined = new Uint8Array(new ArrayBuffer(12 + cipherWithTag.length));
  combined.set(iv, 0);
  combined.set(cipherWithTag, 12);

  return `v${version}:${toBase64(combined)}`;
}

/**
 * Decrypt a versioned ciphertext.
 * Returns the original plaintext.
 *
 * If `stored` does not look like an encrypted payload (no `v{n}:` prefix)
 * it is returned unchanged — this ensures legacy unencrypted messages are
 * still readable after encryption is first deployed.
 */
export async function decrypt(stored: string): Promise<string> {
  if (!/^v\d+:/.test(stored)) return stored; // unencrypted legacy message

  const colonIdx = stored.indexOf(":");
  const version = stored.slice(1, colonIdx);
  const payload = stored.slice(colonIdx + 1);

  const key = await importKey(version);
  const combined = fromBase64(payload);

  const iv = combined.slice(0, 12);
  const cipherWithTag = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherWithTag
  );

  return new TextDecoder().decode(plaintext);
}

/** True if the string is an encrypted payload produced by encrypt(). */
export function isEncrypted(value: string): boolean {
  return /^v\d+:/.test(value);
}

/** Returns the key version embedded in an encrypted payload, or null if unencrypted. */
export function getVersion(stored: string): string | null {
  const m = stored.match(/^v(\d+):/);
  return m ? m[1] : null;
}
