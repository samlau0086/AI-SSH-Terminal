import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { createTransferPlan, executeTransfer } from '../sftp-transfer.js';

type Entry = { type: 'file' | 'directory' | 'symlink'; data?: Buffer; mode: number; atime: number; mtime: number };

class MemorySftp {
  entries = new Map<string, Entry>();

  constructor(entries: Record<string, Partial<Entry> & Pick<Entry, 'type'>>) {
    for (const [remotePath, entry] of Object.entries(entries)) {
      this.entries.set(remotePath, {
        mode: entry.mode ?? (entry.type === 'directory' ? 0o040755 : entry.type === 'symlink' ? 0o120777 : 0o100644),
        data: entry.data || Buffer.alloc(0),
        atime: entry.atime || 1,
        mtime: entry.mtime || 1,
        type: entry.type,
      });
    }
  }

  private attrs(entry: Entry) {
    return { mode: entry.mode, size: entry.data?.length || 0, uid: 0, gid: 0, atime: entry.atime, mtime: entry.mtime };
  }

  realpath(remotePath: string, callback: (error: any, value?: string) => void) {
    callback(null, remotePath === '.' ? '/home/test' : remotePath);
  }

  lstat(remotePath: string, callback: (error: any, value?: any) => void) {
    const entry = this.entries.get(remotePath);
    if (!entry) return callback(Object.assign(new Error('No such file'), { code: 2 }));
    callback(null, this.attrs(entry));
  }

  readdir(remotePath: string, callback: (error: any, value?: any[]) => void) {
    const prefix = remotePath === '/' ? '/' : `${remotePath}/`;
    const children = [...this.entries.entries()]
      .filter(([itemPath]) => itemPath.startsWith(prefix) && !itemPath.slice(prefix.length).includes('/'))
      .map(([itemPath, entry]) => ({ filename: itemPath.slice(prefix.length), longname: '', attrs: this.attrs(entry) }));
    callback(null, children);
  }

  mkdir(remotePath: string, _options: any, callback: (error?: any) => void) {
    this.entries.set(remotePath, { type: 'directory', mode: 0o040755, atime: 1, mtime: 1 });
    callback();
  }

  chmod(remotePath: string, mode: number, callback: (error?: any) => void) {
    const entry = this.entries.get(remotePath);
    if (entry) entry.mode = (entry.mode & 0o170000) | mode;
    callback();
  }

  utimes(remotePath: string, atime: number, mtime: number, callback: (error?: any) => void) {
    const entry = this.entries.get(remotePath);
    if (entry) Object.assign(entry, { atime, mtime });
    callback();
  }

  createReadStream(remotePath: string) {
    const entry = this.entries.get(remotePath);
    if (!entry) throw new Error('No such file');
    return Readable.from(entry.data || Buffer.alloc(0));
  }

  createWriteStream(remotePath: string, options: any) {
    const chunks: Buffer[] = [];
    return new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
      final: (callback) => {
        this.entries.set(remotePath, { type: 'file', data: Buffer.concat(chunks), mode: 0o100000 | (options.mode || 0o644), atime: 1, mtime: 1 });
        callback();
      },
    });
  }

  rename(source: string, target: string, callback: (error?: any) => void) {
    const entry = this.entries.get(source);
    if (!entry) return callback(new Error('No such file'));
    this.entries.delete(source);
    this.entries.set(target, entry);
    callback();
  }

  unlink(remotePath: string, callback: (error?: any) => void) {
    if (!this.entries.delete(remotePath)) return callback(new Error('No such file'));
    callback();
  }
}

test('plans nested directories and reports file conflicts', async () => {
  const source = new MemorySftp({
    '/src': { type: 'directory' },
    '/src/a.txt': { type: 'file', data: Buffer.from('abc') },
    '/src/empty': { type: 'directory' },
  });
  const target = new MemorySftp({
    '/dest': { type: 'directory' },
    '/dest/src': { type: 'directory' },
    '/dest/src/a.txt': { type: 'file', data: Buffer.from('old') },
  });

  const plan = await createTransferPlan(source as any, target as any, '/src', '/dest');
  assert.equal(plan.sourceType, 'directory');
  assert.equal(plan.totalFiles, 1);
  assert.equal(plan.totalBytes, 3);
  assert.equal(plan.conflictCount, 1);
  assert.deepEqual(plan.blockingConflicts, []);
  assert.equal(plan.entries.length, 3);
});

test('streams files, merges directories, replaces conflicts and reports progress', async () => {
  const source = new MemorySftp({
    '/src': { type: 'directory' },
    '/src/a.txt': { type: 'file', data: Buffer.from('new-content'), mode: 0o100744, mtime: 50 },
    '/src/nested': { type: 'directory' },
    '/src/nested/b.txt': { type: 'file', data: Buffer.from('b') },
  });
  const target = new MemorySftp({
    '/dest': { type: 'directory' },
    '/dest/src': { type: 'directory' },
    '/dest/src/a.txt': { type: 'file', data: Buffer.from('old') },
  });
  const plan = await createTransferPlan(source as any, target as any, '/src', '/dest');
  const events: any[] = [];
  const result = await executeTransfer(source as any, target as any, plan, true, new AbortController().signal, (event) => events.push(event));

  assert.equal(target.entries.get('/dest/src/a.txt')?.data?.toString(), 'new-content');
  assert.equal(target.entries.get('/dest/src/nested/b.txt')?.data?.toString(), 'b');
  assert.equal(target.entries.get('/dest/src/a.txt')!.mode & 0o777, 0o744);
  assert.equal(result.completedFiles, 2);
  assert.equal(result.transferredBytes, 12);
  assert.equal(events.at(-1).completedFiles, 2);
  assert.equal([...target.entries.keys()].some((item) => item.includes('.ai-ssh-transfer-')), false);
});

test('rejects symbolic links before creating a transfer plan', async () => {
  const source = new MemorySftp({ '/link': { type: 'symlink' } });
  const target = new MemorySftp({ '/dest': { type: 'directory' } });
  await assert.rejects(
    createTransferPlan(source as any, target as any, '/link', '/dest'),
    /Symbolic links and special files are not supported/,
  );
});

test('does not write when the transfer is already cancelled', async () => {
  const source = new MemorySftp({ '/a.txt': { type: 'file', data: Buffer.from('abc') } });
  const target = new MemorySftp({ '/dest': { type: 'directory' } });
  const plan = await createTransferPlan(source as any, target as any, '/a.txt', '/dest');
  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  await assert.rejects(executeTransfer(source as any, target as any, plan, false, controller.signal, () => undefined), /cancelled/);
  assert.equal(target.entries.has('/dest/a.txt'), false);
});
