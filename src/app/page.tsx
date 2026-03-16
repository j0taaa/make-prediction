"use client";

import { FormEvent, useMemo, useState } from "react";

type ProofPackage = {
  version: "1.2";
  timestamp: string;
  hash: string;
  salt: string;
  keySalt: string;
  iv: string;
  encryptedPrediction: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array): string => {
  if (typeof window === "undefined") return "";
  const binary = String.fromCharCode(...bytes);
  return window.btoa(binary);
};

const toBase64Url = (bytes: Uint8Array): string =>
  toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const fromBase64UrlToBytes = (encoded: string): Uint8Array => {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return fromBase64ToBytes(padded);
};

const fromBase64ToBytes = (encoded: string): Uint8Array => {
  if (typeof window === "undefined") return new Uint8Array();
  const binary = window.atob(encoded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const fromBase64Text = (encoded: string): string => decoder.decode(fromBase64ToBytes(encoded));

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return toBase64Url(new Uint8Array(digest));
}

const toSafeBytes = (bytes: Uint8Array): Uint8Array => Uint8Array.from(bytes);

async function deriveEncryptionKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toSafeBytes(salt) as BufferSource,
      iterations: 120000,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

async function makeProof(prediction: string, authKey: string): Promise<ProofPackage> {
  const timestamp = new Date().toISOString();
  const salt = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const keySalt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptionKey = await deriveEncryptionKey(authKey, keySalt);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toSafeBytes(iv) as BufferSource,
    },
    encryptionKey,
    encoder.encode(prediction),
  );

  const hash = await sha256(`${prediction}::${timestamp}::${salt}`);

  return {
    version: "1.2",
    timestamp,
    hash,
    salt,
    keySalt: toBase64Url(keySalt),
    iv: toBase64Url(iv),
    encryptedPrediction: toBase64Url(new Uint8Array(encrypted)),
  };
}

async function decryptPrediction(token: ProofPackage, authKey: string): Promise<string> {
  const decryptionKey = await deriveEncryptionKey(authKey, fromBase64UrlToBytes(token.keySalt));
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toSafeBytes(fromBase64UrlToBytes(token.iv)) as BufferSource,
    },
    decryptionKey,
    toSafeBytes(fromBase64UrlToBytes(token.encryptedPrediction)) as BufferSource,
  );

  return decoder.decode(decrypted);
}

export default function Home() {
  const [prediction, setPrediction] = useState("");
  const [authKey, setAuthKey] = useState("");
  const [proof, setProof] = useState<ProofPackage | null>(null);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");

  const [verifyToken, setVerifyToken] = useState("");
  const [verifyKey, setVerifyKey] = useState("");
  const [recoveredPrediction, setRecoveredPrediction] = useState("");
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  const prettyProof = useMemo(() => (proof ? JSON.stringify(proof, null, 2) : ""), [proof]);

  async function createCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prediction.trim()) {
      setStatus("Write a prediction first.");
      return;
    }
    if (!authKey.trim()) {
      setStatus("Choose an authentication key.");
      return;
    }

    const newProof = await makeProof(prediction.trim(), authKey.trim());
    setProof(newProof);
    setToken(JSON.stringify(newProof));
    setStatus("Sealed. Keep your token and key.");
  }

  function parseToken(rawToken: string): ProofPackage {
    const cleaned = rawToken.trim();
    try {
      return JSON.parse(cleaned) as ProofPackage;
    } catch {
      return JSON.parse(fromBase64Text(cleaned)) as ProofPackage;
    }
  }

  async function verifyCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecoveredPrediction("");

    if (!verifyKey.trim()) {
      setVerifyResult("Enter your authentication key.");
      return;
    }

    try {
      const parsed = parseToken(verifyToken);
      if (!parsed.hash || !parsed.timestamp || !parsed.salt || !parsed.keySalt || !parsed.iv) {
        setVerifyResult("Invalid token.");
        return;
      }

      const decryptedPrediction = await decryptPrediction(parsed, verifyKey.trim());
      const recomputed = await sha256(`${decryptedPrediction}::${parsed.timestamp}::${parsed.salt}`);

      if (recomputed !== parsed.hash) {
        setVerifyResult("❌ No match");
        return;
      }

      setRecoveredPrediction(decryptedPrediction);
      setVerifyResult(`✅ Match • ${new Date(parsed.timestamp).toLocaleString()}`);
    } catch {
      setVerifyResult("Invalid token or key.");
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.25),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(34,211,238,0.2),transparent_30%),radial-gradient(circle_at_50%_85%,rgba(16,185,129,0.15),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:38px_38px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-4 p-4 sm:gap-6 sm:p-6 md:p-12">
        <header className="rounded-3xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl sm:p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/80 sm:tracking-[0.35em]">midnight archive</p>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl md:text-5xl">Secret Prediction Vault</h1>
        </header>

        <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-2">
          <section className="min-w-0 rounded-3xl border border-fuchsia-300/30 bg-slate-900/60 p-5 shadow-[0_0_50px_rgba(217,70,239,0.25)] backdrop-blur-xl sm:p-6">
            <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-widest text-fuchsia-200">
              <span>Seal</span>
              <span>◉</span>
            </div>

            <form onSubmit={createCommitment} className="space-y-4 min-w-0">
              <textarea
                value={prediction}
                onChange={(event) => setPrediction(event.target.value)}
                rows={6}
                placeholder="Your hidden prediction"
                className="w-full min-w-0 rounded-2xl border border-white/15 bg-black/40 p-4 text-sm outline-none ring-fuchsia-300 transition focus:ring-2"
              />
              <input
                type="text"
                value={authKey}
                onChange={(event) => setAuthKey(event.target.value)}
                placeholder="Choose an authentication key"
                className="w-full min-w-0 rounded-2xl border border-white/15 bg-black/40 p-4 text-sm outline-none ring-fuchsia-300 transition focus:ring-2"
              />
              <button
                type="submit"
                className="w-full rounded-2xl border border-fuchsia-300/60 bg-fuchsia-300/90 px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-fuchsia-200"
              >
                Generate token
              </button>
            </form>

            {status && <p className="mt-4 text-sm text-emerald-200 break-words">{status}</p>}

            {proof && (
              <div className="mt-5 space-y-3 min-w-0">
                <textarea
                  readOnly
                  value={token}
                  rows={5}
                  className="w-full min-w-0 rounded-2xl border border-cyan-300/30 bg-black/40 p-3 text-xs text-cyan-100"
                />
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-white/15 bg-black/40 p-3 text-xs text-slate-200">
                  {prettyProof}
                </pre>
              </div>
            )}
          </section>

          <section className="min-w-0 rounded-3xl border border-cyan-300/30 bg-slate-900/60 p-5 shadow-[0_0_50px_rgba(34,211,238,0.22)] backdrop-blur-xl sm:p-6">
            <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-widest text-cyan-100">
              <span>Reveal</span>
              <span>◌</span>
            </div>

            <form onSubmit={verifyCommitment} className="space-y-4 min-w-0">
              <input
                type="text"
                value={verifyKey}
                onChange={(event) => setVerifyKey(event.target.value)}
                className="w-full min-w-0 rounded-2xl border border-white/15 bg-black/40 p-4 text-sm outline-none ring-cyan-300 transition focus:ring-2"
                placeholder="Authentication key"
              />
              <textarea
                value={verifyToken}
                onChange={(event) => setVerifyToken(event.target.value)}
                rows={6}
                className="w-full min-w-0 rounded-2xl border border-white/15 bg-black/40 p-4 text-sm outline-none ring-cyan-300 transition focus:ring-2"
                placeholder="Token"
              />
              <button
                type="submit"
                className="w-full rounded-2xl border border-cyan-300/60 bg-cyan-300/90 px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-cyan-200"
              >
                Verify
              </button>
            </form>

            {verifyResult && (
              <p className="mt-5 rounded-2xl border border-white/15 bg-black/40 p-4 text-sm font-semibold text-cyan-100 break-words">
                {verifyResult}
              </p>
            )}
            {recoveredPrediction && (
              <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 p-4 text-xs text-slate-200">
                <p className="mb-2 text-cyan-100 font-semibold">Recovered prediction</p>
                <p className="whitespace-pre-wrap break-words">{recoveredPrediction}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
