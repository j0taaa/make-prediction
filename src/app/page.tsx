"use client";

import { FormEvent, useMemo, useState } from "react";

type ProofPackage = {
  version: "1.0";
  timestamp: string;
  hash: string;
  salt: string;
};

const encoder = new TextEncoder();

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const toBase64 = (text: string): string => {
  if (typeof window === "undefined") return "";
  const bytes = encoder.encode(text);
  const binary = String.fromCharCode(...bytes);
  return window.btoa(binary);
};

const fromBase64 = (encoded: string): string => {
  if (typeof window === "undefined") return "";
  const binary = window.atob(encoded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return bytesToHex(new Uint8Array(digest));
}

async function makeProof(prediction: string): Promise<ProofPackage> {
  const timestamp = new Date().toISOString();
  const salt = crypto.randomUUID();
  const hash = await sha256(`${prediction}::${timestamp}::${salt}`);
  return { version: "1.0", timestamp, hash, salt };
}

export default function Home() {
  const [prediction, setPrediction] = useState("");
  const [proof, setProof] = useState<ProofPackage | null>(null);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [verifyPrediction, setVerifyPrediction] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  const prettyProof = useMemo(() => (proof ? JSON.stringify(proof, null, 2) : ""), [proof]);

  async function createCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prediction.trim()) {
      setStatus("Write a prediction first.");
      return;
    }

    const newProof = await makeProof(prediction.trim());
    setProof(newProof);
    setToken(toBase64(JSON.stringify(newProof)));
    setStatus("Sealed.");
  }

  async function verifyCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const parsed = JSON.parse(fromBase64(verifyToken.trim())) as ProofPackage;
      if (!parsed.hash || !parsed.timestamp || !parsed.salt) {
        setVerifyResult("Invalid token.");
        return;
      }

      const recomputed = await sha256(
        `${verifyPrediction.trim()}::${parsed.timestamp}::${parsed.salt}`,
      );

      setVerifyResult(
        recomputed === parsed.hash
          ? `✅ Match • ${new Date(parsed.timestamp).toLocaleString()}`
          : "❌ No match",
      );
    } catch {
      setVerifyResult("Invalid token.");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.25),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(34,211,238,0.2),transparent_30%),radial-gradient(circle_at_50%_85%,rgba(16,185,129,0.15),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:38px_38px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-6 p-6 md:p-12">
        <header className="rounded-3xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">midnight archive</p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">Secret Prediction Vault</h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-fuchsia-300/30 bg-slate-900/60 p-6 shadow-[0_0_50px_rgba(217,70,239,0.25)] backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-widest text-fuchsia-200">
              <span>Seal</span>
              <span>◉</span>
            </div>

            <form onSubmit={createCommitment} className="space-y-4">
              <textarea
                value={prediction}
                onChange={(event) => setPrediction(event.target.value)}
                rows={6}
                placeholder="Your hidden prediction"
                className="w-full rounded-2xl border border-white/15 bg-black/40 p-4 text-sm outline-none ring-fuchsia-300 transition focus:ring-2"
              />
              <button
                type="submit"
                className="w-full rounded-2xl border border-fuchsia-300/60 bg-fuchsia-300/90 px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-fuchsia-200"
              >
                Generate token
              </button>
            </form>

            {status && <p className="mt-4 text-sm text-emerald-200">{status}</p>}

            {proof && (
              <div className="mt-5 space-y-3">
                <textarea
                  readOnly
                  value={token}
                  rows={5}
                  className="w-full rounded-2xl border border-cyan-300/30 bg-black/40 p-3 text-xs text-cyan-100"
                />
                <pre className="overflow-x-auto rounded-2xl border border-white/15 bg-black/40 p-3 text-xs text-slate-200">
                  {prettyProof}
                </pre>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-cyan-300/30 bg-slate-900/60 p-6 shadow-[0_0_50px_rgba(34,211,238,0.22)] backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-widest text-cyan-100">
              <span>Reveal</span>
              <span>◌</span>
            </div>

            <form onSubmit={verifyCommitment} className="space-y-4">
              <textarea
                value={verifyPrediction}
                onChange={(event) => setVerifyPrediction(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-white/15 bg-black/40 p-4 text-sm outline-none ring-cyan-300 transition focus:ring-2"
                placeholder="Original prediction"
              />
              <textarea
                value={verifyToken}
                onChange={(event) => setVerifyToken(event.target.value)}
                rows={6}
                className="w-full rounded-2xl border border-white/15 bg-black/40 p-4 text-sm outline-none ring-cyan-300 transition focus:ring-2"
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
              <p className="mt-5 rounded-2xl border border-white/15 bg-black/40 p-4 text-sm font-semibold text-cyan-100">
                {verifyResult}
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
