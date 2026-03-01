"use client";

import { useState, useTransition } from "react";
import {
  generateApiTokenAction,
  revokeApiTokenAction,
  type TokenStatusResult,
} from "./api-token-actions";

type Props = {
  initial: TokenStatusResult;
};

export default function ApiTokenSection({ initial }: Props) {
  const [status, setStatus] = useState<TokenStatusResult>(initial);
  const [visibleToken, setVisibleToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    startTransition(async () => {
      setVisibleToken(null);
      const result = await generateApiTokenAction();
      if (result.ok) {
        setVisibleToken(result.token);
        setStatus({ exists: true, createdAt: result.createdAt, lastUsedAt: null });
      }
    });
  };

  const handleRevoke = () => {
    startTransition(async () => {
      setVisibleToken(null);
      await revokeApiTokenAction();
      setStatus({ exists: false });
    });
  };

  const handleCopy = async () => {
    if (!visibleToken) return;
    await navigator.clipboard.writeText(visibleToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">API Token</h2>
      <p className="mt-1 text-sm text-slate-500">
        Use this token to add words from external tools like the Chrome extension.
      </p>

      {visibleToken ? (
        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="mb-2 text-xs font-medium text-indigo-700">
            Copy your token now — it will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-mono text-slate-800">
              {visibleToken}
            </code>
            <button
              className="shrink-0 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
              onClick={handleCopy}
              type="button"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {status.exists ? (
          <>
            <div className="text-xs text-slate-500">
              <span>
                Created {new Date(status.createdAt).toLocaleDateString()}.
              </span>
              {status.lastUsedAt ? (
                <span className="ml-2">
                  Last used {new Date(status.lastUsedAt).toLocaleDateString()}.
                </span>
              ) : null}
            </div>
            <div className="ml-auto flex gap-2">
              <button
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                disabled={isPending}
                onClick={handleGenerate}
                type="button"
              >
                Regenerate
              </button>
              <button
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                disabled={isPending}
                onClick={handleRevoke}
                type="button"
              >
                Revoke
              </button>
            </div>
          </>
        ) : (
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            disabled={isPending}
            onClick={handleGenerate}
            type="button"
          >
            Generate Token
          </button>
        )}
      </div>

      {status.exists && !visibleToken ? (
        <p className="mt-3 text-xs text-slate-400">
          Your token is stored securely. Generate a new one to get the raw value.
        </p>
      ) : null}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-xs font-medium text-slate-600">Usage</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{`POST /api/ext/words
Authorization: Bearer <your-token>
Content-Type: application/json

{ "word": "ephemeral", "meaning": "lasting a very short time" }`}</pre>
      </div>
    </section>
  );
}
