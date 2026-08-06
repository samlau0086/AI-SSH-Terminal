import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, ChevronRight, Folder, LoaderCircle, Server, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Session } from '../App';

interface Props {
  sourceSession: Session;
  sourcePath: string;
  sessions: Session[];
  token: string;
  onClose: () => void;
}

interface RemoteDirectory {
  filename: string;
  longname: string;
}

interface PreflightResult {
  sourceType: 'file' | 'directory';
  sourcePath: string;
  targetPath: string;
  totalFiles: number;
  totalBytes: number;
  conflictCount: number;
  conflicts: string[];
  blockingConflicts: string[];
}

interface TransferProgress {
  totalFiles: number;
  totalBytes: number;
  completedFiles: number;
  transferredBytes: number;
  currentPath: string;
}

const joinRemotePath = (directory: string, name: string) => `${directory.replace(/\/$/, '')}/${name}`;

const parentRemotePath = (remotePath: string) => {
  const normalized = remotePath.replace(/\/+$/, '');
  const index = normalized.lastIndexOf('/');
  return index <= 0 ? '/' : normalized.slice(0, index);
};

const formatSize = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, unit)).toFixed(unit ? 1 : 0)} ${units[unit]}`;
};

export default function FileTransferModal({ sourceSession, sourcePath, sessions, token, onClose }: Props) {
  const { t } = useTranslation();
  const targets = useMemo(() => sessions.filter((item) => item.id !== sourceSession.id), [sessions, sourceSession.id]);
  const [targetSessionId, setTargetSessionId] = useState(targets[0]?.id || '');
  const [targetPath, setTargetPath] = useState('~/');
  const [pathInput, setPathInput] = useState('~/');
  const [directories, setDirectories] = useState<RemoteDirectory[]>([]);
  const [loadingDirectories, setLoadingDirectories] = useState(false);
  const [stage, setStage] = useState<'ready' | 'scanning' | 'conflict' | 'transferring' | 'complete' | 'cancelled'>('ready');
  const [error, setError] = useState('');
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [progress, setProgress] = useState<TransferProgress>({ totalFiles: 0, totalBytes: 0, completedFiles: 0, transferredBytes: 0, currentPath: '' });
  const abortRef = useRef<AbortController | null>(null);

  const loadDirectories = async (directory: string) => {
    if (!targetSessionId) return;
    setLoadingDirectories(true);
    setError('');
    try {
      const response = await fetch(`/api/sessions/${targetSessionId}/files?path=${encodeURIComponent(directory)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('fileTransfer.loadTargetFailed', 'Failed to load target directory'));
      setTargetPath(data.currentPath || directory);
      setPathInput(data.currentPath || directory);
      setDirectories((data.files || []).filter((item: RemoteDirectory) => item.longname?.startsWith('d')));
    } catch (loadError: any) {
      setError(loadError.message);
    } finally {
      setLoadingDirectories(false);
    }
  };

  useEffect(() => {
    setTargetPath('~/');
    setPathInput('~/');
    setPreflight(null);
    setStage('ready');
    if (targetSessionId) loadDirectories('~/');
  }, [targetSessionId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const requestBody = { targetSessionId, sourcePath, targetDirectory: targetPath };

  const runTransfer = async (overwrite: boolean) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStage('transferring');
    setError('');
    setProgress({
      totalFiles: preflight?.totalFiles || 0,
      totalBytes: preflight?.totalBytes || 0,
      completedFiles: 0,
      transferredBytes: 0,
      currentPath: '',
    });

    try {
      const response = await fetch(`/api/sessions/${sourceSession.id}/transfers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestBody, overwrite }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Transfer failed (${response.status})`);
      }
      if (!response.body) throw new Error('Streaming response is unavailable');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      const consumeLine = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === 'start') {
          setProgress((current) => ({ ...current, totalFiles: event.totalFiles, totalBytes: event.totalBytes }));
        } else if (event.type === 'progress') {
          setProgress(event);
        } else if (event.type === 'error') {
          throw new Error(event.error || 'Transfer failed');
        } else if (event.type === 'complete') {
          setProgress((current) => ({ ...current, ...event }));
          setStage('complete');
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        const lines = pending.split('\n');
        pending = lines.pop() || '';
        for (const line of lines) consumeLine(line);
        if (done) break;
      }
      if (pending.trim()) consumeLine(pending);
    } catch (transferError: any) {
      if (controller.signal.aborted) {
        setStage('cancelled');
      } else {
        setStage('ready');
        setError(transferError.message);
      }
    } finally {
      abortRef.current = null;
    }
  };

  const preflightTransfer = async () => {
    if (!targetSessionId) return;
    setStage('scanning');
    setError('');
    setPreflight(null);
    try {
      const response = await fetch(`/api/sessions/${sourceSession.id}/transfers/preflight`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Preflight failed (${response.status})`);
      setPreflight(data);
      if (data.blockingConflicts?.length) {
        setStage('ready');
        setError(t('fileTransfer.typeConflict', 'A file and directory have the same target path. Resolve the conflict first.'));
      } else if (data.conflictCount > 0) {
        setStage('conflict');
      } else {
        await runTransfer(false);
      }
    } catch (scanError: any) {
      setStage('ready');
      setError(scanError.message);
    }
  };

  const submitPath = (event: FormEvent) => {
    event.preventDefault();
    loadDirectories(pathInput);
  };

  const percent = progress.totalBytes > 0
    ? Math.min(100, Math.round(progress.transferredBytes / progress.totalBytes * 100))
    : progress.completedFiles === progress.totalFiles && stage === 'complete' ? 100 : 0;
  const busy = stage === 'scanning' || stage === 'transferring';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-[#18181b]">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 shrink-0 text-indigo-500" />
            <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('fileTransfer.title', 'Transfer to another session')}</h2>
          </div>
          <button type="button" disabled={busy} onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-900 disabled:opacity-40 dark:hover:text-white" title={t('common.close', 'Close')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-[11px] font-semibold uppercase text-zinc-500">
              {t('fileTransfer.source', 'Source')}
              <div className="mt-1 truncate rounded border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs normal-case text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300" title={sourcePath}>
                {sourceSession.name || sourceSession.host}: {sourcePath}
              </div>
            </label>
            <label className="text-[11px] font-semibold uppercase text-zinc-500">
              {t('fileTransfer.targetSession', 'Target session')}
              <select
                value={targetSessionId}
                disabled={busy || stage === 'complete'}
                onChange={(event) => setTargetSessionId(event.target.value)}
                className="mt-1 w-full rounded border border-zinc-200 bg-white px-3 py-2 text-xs normal-case text-zinc-800 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {targets.map((item) => <option key={item.id} value={item.id}>{item.name || item.host}</option>)}
              </select>
            </label>
          </div>

          {targets.length === 0 ? (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              {t('fileTransfer.noTargetSession', 'Save another SSH session before transferring files.')}
            </div>
          ) : (
            <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
              <form onSubmit={submitPath} className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
                <Server className="h-4 w-4 shrink-0 text-zinc-500" />
                <input value={pathInput} disabled={busy || stage === 'complete'} onChange={(event) => setPathInput(event.target.value)} className="min-w-0 flex-1 bg-transparent px-1 font-mono text-xs text-zinc-800 outline-none dark:text-zinc-200" aria-label={t('fileTransfer.targetDirectory', 'Target directory')} />
                <button type="submit" disabled={busy || stage === 'complete'} className="p-1 text-zinc-500 hover:text-indigo-500 disabled:opacity-40" title={t('fileTransfer.openDirectory', 'Open directory')}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </form>
              <div className="h-44 overflow-y-auto p-1">
                {loadingDirectories ? (
                  <div className="flex h-full items-center justify-center text-zinc-500"><LoaderCircle className="h-5 w-5 animate-spin" /></div>
                ) : (
                  <>
                    <button type="button" disabled={busy || stage === 'complete'} onClick={() => loadDirectories(parentRemotePath(targetPath))} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800">
                      <Folder className="h-4 w-4 text-blue-500" /> ..
                    </button>
                    {directories.filter((item) => item.filename !== '.' && item.filename !== '..').map((item) => (
                      <button key={item.filename} type="button" disabled={busy || stage === 'complete'} onClick={() => loadDirectories(joinRemotePath(targetPath, item.filename))} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800">
                        <Folder className="h-4 w-4 text-blue-500" /> <span className="truncate">{item.filename}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
              <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
                {t('fileTransfer.destination', 'Destination')}: <span className="font-mono text-zinc-700 dark:text-zinc-300">{targetPath}</span>
              </div>
            </div>
          )}

          {stage === 'conflict' && preflight && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex gap-2 text-sm font-medium"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t('fileTransfer.conflictsFound', '{{count}} existing files will be overwritten.', { count: preflight.conflictCount })}</div>
              <div className="mt-2 max-h-24 overflow-y-auto pl-6 font-mono text-[11px] opacity-80">{preflight.conflicts.map((item) => <div key={item} className="truncate" title={item}>{item}</div>)}</div>
            </div>
          )}

          {(stage === 'transferring' || stage === 'complete' || stage === 'cancelled') && (
            <div className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
                <span className="truncate pr-3">{stage === 'complete' ? t('fileTransfer.complete', 'Transfer complete') : stage === 'cancelled' ? t('fileTransfer.cancelled', 'Transfer cancelled') : progress.currentPath || t('fileTransfer.starting', 'Starting transfer...')}</span>
                <span className="shrink-0 font-mono">{percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"><div className="h-full bg-indigo-500 transition-[width]" style={{ width: `${percent}%` }} /></div>
              <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
                <span>{progress.completedFiles}/{progress.totalFiles} {t('fileTransfer.files', 'files')}</span>
                <span>{formatSize(progress.transferredBytes)} / {formatSize(progress.totalBytes)}</span>
              </div>
            </div>
          )}

          {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          {stage === 'transferring' ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="rounded bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500">{t('fileTransfer.cancelTransfer', 'Cancel transfer')}</button>
          ) : stage === 'complete' ? (
            <button type="button" onClick={onClose} className="flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"><CheckCircle2 className="h-4 w-4" />{t('common.close', 'Close')}</button>
          ) : stage === 'conflict' ? (
            <>
              <button type="button" onClick={() => { setStage('ready'); setPreflight(null); }} className="px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">{t('common.cancel', 'Cancel')}</button>
              <button type="button" onClick={() => runTransfer(true)} className="rounded bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500">{t('fileTransfer.overwrite', 'Overwrite and transfer')}</button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">{t('common.cancel', 'Cancel')}</button>
              <button type="button" disabled={!targetSessionId || loadingDirectories || stage === 'scanning'} onClick={preflightTransfer} className="flex min-w-28 items-center justify-center gap-2 rounded bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                {stage === 'scanning' && <LoaderCircle className="h-4 w-4 animate-spin" />}{stage === 'cancelled' ? t('fileTransfer.retry', 'Retry') : t('fileTransfer.transfer', 'Transfer')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
