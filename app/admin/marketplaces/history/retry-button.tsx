'use client';

import { useState } from 'react';

export default function RetryImportButton({ logId }: { logId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const retry = async () => {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/marketplaces/history/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Retry failed.');
      setMessage(json.failed ? 'Retry failed' : 'Retried');
      if (!json.failed) window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Retry failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex items-center gap-2">
      <button onClick={retry} disabled={busy} className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-black disabled:opacity-40">
        {busy ? 'Retrying…' : 'Retry'}
      </button>
      {message && <span className="max-w-[180px] text-[10px] text-slate-500">{message}</span>}
    </span>
  );
}
