import { randomUUID } from 'crypto';
import { posix as path } from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import type { Attributes, Client, FileEntry, SFTPWrapper, Stats } from 'ssh2';

const TYPE_MASK = 0o170000;
const REGULAR_FILE = 0o100000;
const DIRECTORY = 0o040000;

export interface TransferManifestEntry {
  sourcePath: string;
  destinationPath: string;
  relativePath: string;
  type: 'file' | 'directory';
  attrs: Attributes;
}

export interface TransferPlan {
  sourceType: 'file' | 'directory';
  sourcePath: string;
  targetPath: string;
  totalFiles: number;
  totalBytes: number;
  conflictCount: number;
  conflicts: string[];
  blockingConflicts: string[];
  entries: TransferManifestEntry[];
}

export interface TransferProgress {
  transferredBytes: number;
  totalBytes: number;
  completedFiles: number;
  totalFiles: number;
  currentPath: string;
}

const call = <T>(invoke: (callback: (error: any, value: T) => void) => void) =>
  new Promise<T>((resolve, reject) => invoke((error, value) => error ? reject(error) : resolve(value)));

const action = (invoke: (callback: (error?: any) => void) => void) =>
  new Promise<void>((resolve, reject) => invoke((error) => error ? reject(error) : resolve()));

const remoteType = (attrs: Attributes): 'file' | 'directory' | 'unsupported' => {
  const type = attrs.mode & TYPE_MASK;
  if (type === REGULAR_FILE) return 'file';
  if (type === DIRECTORY) return 'directory';
  return 'unsupported';
};

const isMissing = (error: any) => error?.code === 2 || error?.code === 'ENOENT' || error?.message?.includes('No such file');

export const openSftp = (client: Client) =>
  call<SFTPWrapper>((callback) => client.sftp(callback));

export const resolveRemotePath = async (sftp: SFTPWrapper, remotePath: string) => {
  if (remotePath === '~' || remotePath.startsWith('~/')) {
    const home = await call<string>((callback) => sftp.realpath('.', callback));
    return remotePath === '~' ? home : path.join(home, remotePath.slice(2));
  }
  return path.normalize(remotePath);
};

const lstat = (sftp: SFTPWrapper, remotePath: string) =>
  call<Stats>((callback) => sftp.lstat(remotePath, callback));

const tryLstat = async (sftp: SFTPWrapper, remotePath: string) => {
  try {
    return await lstat(sftp, remotePath);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
};

const readDirectory = (sftp: SFTPWrapper, remotePath: string) =>
  call<FileEntry[]>((callback) => sftp.readdir(remotePath, callback));

const assertSupported = (attrs: Attributes, remotePath: string) => {
  const type = remoteType(attrs);
  if (type === 'unsupported') {
    throw new Error(`Symbolic links and special files are not supported: ${remotePath}`);
  }
  return type;
};

export async function createTransferPlan(
  sourceSftp: SFTPWrapper,
  targetSftp: SFTPWrapper,
  sourceInput: string,
  targetDirectoryInput: string,
): Promise<TransferPlan> {
  const sourcePath = await resolveRemotePath(sourceSftp, sourceInput);
  const targetDirectory = await resolveRemotePath(targetSftp, targetDirectoryInput);
  const sourceAttrs = await lstat(sourceSftp, sourcePath);
  const sourceType = assertSupported(sourceAttrs, sourcePath);
  const targetDirectoryAttrs = await lstat(targetSftp, targetDirectory);
  if (remoteType(targetDirectoryAttrs) !== 'directory') {
    throw new Error(`Target path is not a directory: ${targetDirectory}`);
  }

  const sourceName = path.basename(sourcePath.replace(/\/+$/, ''));
  if (!sourceName) throw new Error('The filesystem root cannot be transferred.');
  const targetPath = path.join(targetDirectory, sourceName);
  const entries: TransferManifestEntry[] = [];

  const scan = async (currentSource: string, currentTarget: string, relativePath: string, attrs: Attributes) => {
    const type = assertSupported(attrs, currentSource);
    entries.push({ sourcePath: currentSource, destinationPath: currentTarget, relativePath, type, attrs });
    if (type !== 'directory') return;

    const children = await readDirectory(sourceSftp, currentSource);
    for (const child of children) {
      if (child.filename === '.' || child.filename === '..') continue;
      const childSource = path.join(currentSource, child.filename);
      const childTarget = path.join(currentTarget, child.filename);
      await scan(childSource, childTarget, path.join(relativePath, child.filename), child.attrs);
    }
  };

  await scan(sourcePath, targetPath, sourceName, sourceAttrs);

  const conflicts: string[] = [];
  const blockingConflicts: string[] = [];
  for (const entry of entries) {
    const existing = await tryLstat(targetSftp, entry.destinationPath);
    if (!existing) continue;
    const existingType = remoteType(existing);
    if (existingType !== entry.type) {
      blockingConflicts.push(entry.destinationPath);
    } else if (entry.type === 'file') {
      conflicts.push(entry.destinationPath);
    }
  }

  const files = entries.filter((entry) => entry.type === 'file');
  return {
    sourceType,
    sourcePath,
    targetPath,
    totalFiles: files.length,
    totalBytes: files.reduce((total, entry) => total + entry.attrs.size, 0),
    conflictCount: conflicts.length,
    conflicts: conflicts.slice(0, 100),
    blockingConflicts: blockingConflicts.slice(0, 100),
    entries,
  };
}

const bestEffortMetadata = async (sftp: SFTPWrapper, remotePath: string, attrs: Attributes) => {
  await action((callback) => sftp.chmod(remotePath, attrs.mode & 0o7777, callback)).catch(() => undefined);
  await action((callback) => sftp.utimes(remotePath, attrs.atime, attrs.mtime, callback)).catch(() => undefined);
};

const ensureNotAborted = (signal: AbortSignal) => {
  if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('Transfer cancelled');
};

export async function executeTransfer(
  sourceSftp: SFTPWrapper,
  targetSftp: SFTPWrapper,
  plan: TransferPlan,
  overwrite: boolean,
  signal: AbortSignal,
  onProgress: (progress: TransferProgress) => void,
) {
  if (plan.blockingConflicts.length) throw new Error('File and directory types conflict at the target.');
  if (plan.conflictCount && !overwrite) throw new Error('Target files already exist.');

  const directories = plan.entries.filter((entry) => entry.type === 'directory');
  for (const directory of directories) {
    ensureNotAborted(signal);
    const existing = await tryLstat(targetSftp, directory.destinationPath);
    if (!existing) {
      await action((callback) => targetSftp.mkdir(directory.destinationPath, { mode: directory.attrs.mode & 0o7777 }, callback));
    } else if (remoteType(existing) !== 'directory') {
      throw new Error(`Target type changed during transfer: ${directory.destinationPath}`);
    }
  }

  let transferredBytes = 0;
  let completedFiles = 0;
  const files = plan.entries.filter((entry) => entry.type === 'file');

  for (const file of files) {
    ensureNotAborted(signal);
    const existing = await tryLstat(targetSftp, file.destinationPath);
    if (existing && remoteType(existing) !== 'file') {
      throw new Error(`Target type changed during transfer: ${file.destinationPath}`);
    }
    if (existing && !overwrite) throw new Error(`Target file appeared during transfer: ${file.destinationPath}`);

    const temporaryPath = `${file.destinationPath}.ai-ssh-transfer-${randomUUID()}.part`;
    const readStream = sourceSftp.createReadStream(file.sourcePath);
    const writeStream = targetSftp.createWriteStream(temporaryPath, { mode: file.attrs.mode & 0o7777 });
    const counter = new Transform({
      transform(chunk, _encoding, callback) {
        transferredBytes += chunk.length;
        onProgress({ transferredBytes, totalBytes: plan.totalBytes, completedFiles, totalFiles: plan.totalFiles, currentPath: file.relativePath });
        callback(null, chunk);
      },
    });

    try {
      await pipeline(readStream, counter, writeStream, { signal });
      ensureNotAborted(signal);
      if (existing) {
        const backupPath = `${file.destinationPath}.ai-ssh-transfer-${randomUUID()}.backup`;
        await action((callback) => targetSftp.rename(file.destinationPath, backupPath, callback));
        try {
          await action((callback) => targetSftp.rename(temporaryPath, file.destinationPath, callback));
        } catch (error) {
          await action((callback) => targetSftp.rename(backupPath, file.destinationPath, callback)).catch(() => undefined);
          throw error;
        }
        await action((callback) => targetSftp.unlink(backupPath, callback)).catch(() => undefined);
      } else {
        await action((callback) => targetSftp.rename(temporaryPath, file.destinationPath, callback));
      }
      await bestEffortMetadata(targetSftp, file.destinationPath, file.attrs);
      completedFiles += 1;
      onProgress({ transferredBytes, totalBytes: plan.totalBytes, completedFiles, totalFiles: plan.totalFiles, currentPath: file.relativePath });
    } catch (error) {
      readStream.destroy();
      writeStream.destroy();
      await action((callback) => targetSftp.unlink(temporaryPath, callback)).catch(() => undefined);
      throw error;
    }
  }

  for (const directory of [...directories].reverse()) {
    await bestEffortMetadata(targetSftp, directory.destinationPath, directory.attrs);
  }

  return { transferredBytes, totalBytes: plan.totalBytes, completedFiles, totalFiles: plan.totalFiles, targetPath: plan.targetPath };
}
