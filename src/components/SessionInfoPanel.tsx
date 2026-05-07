import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Session } from '../App';
import { Activity, Upload, HardDrive, Cpu, Check, X, AlertCircle, Folder, File as FileIcon, Download, RefreshCw, ChevronRight, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

interface Props {
  session: Session;
}

interface RemoteFile {
  filename: string;
  longname: string;
  attrs: {
    size: number;
    uid: number;
    gid: number;
    mode: number;
    atime: number;
    mtime: number;
  }
}

export default function SessionInfoPanel({ session }: Props) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [statsStr, setStatsStr] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  
  const [targetPath, setTargetPath] = useState('~/');
  const [inputPath, setInputPath] = useState('~/');
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [fileError, setFileError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Horizontal resizing logic
  const [statsWidth, setStatsWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      // Boundaries
      if (newWidth > 200 && newWidth < containerRect.width - 300) {
        setStatsWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize]);

  useEffect(() => {
    if (!token || !session?.id) return;
    
    let isMounted = true;
    let timer: any;

    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/sessions/${session.id}/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
           const data = await res.json();
           if (isMounted) setStatsStr(data.output);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) timer = setTimeout(fetchStats, 10000);
      }
    };

    fetchStats();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [token, session]);

  const loadFiles = async (dirPath: string) => {
    if (!token || !session?.id) return;
    
    setIsLoadingFiles(true);
    setFileError('');
    try {
      const res = await fetch(`/api/sessions/${session.id}/files?path=${encodeURIComponent(dirPath)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let data: any;
      try {
         data = await res.json();
      } catch (e) {
         throw new Error(`Invalid response from server (${res.status})`);
      }
      if (res.ok) {
         setFiles(data.files || []);
         setTargetPath(data.currentPath || dirPath);
         setInputPath(data.currentPath || dirPath);
      } else {
         setFileError(data.error || 'Failed to load files');
      }
    } catch (err: any) {
      setFileError(err.message);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (session?.id && token) {
      loadFiles(targetPath);
    }
  }, [session?.id, token]);


  const handleFileUpload = async (file: File) => {
    if (!file || !token || !session?.id) return;
    
    setIsUploading(true);
    setUploadStatus('idle');
    const formData = new FormData();
    formData.append('file', file);
    
    // Ensure target path ends with / if it's a directory
    let finalPath = targetPath;
    if (!finalPath.endsWith('/')) {
        finalPath += '/';
    }
    finalPath += file.name;

    formData.append('path', finalPath);

    try {
      const res = await fetch(`/api/sessions/${session.id}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      let data: any;
      try {
         data = await res.json();
      } catch (e) {
         throw new Error(`Upload failed with server error (${res.status})`);
      }
      if (res.ok) {
        setUploadStatus('success');
        setUploadMessage(data.message);
        loadFiles(targetPath); // Reload folder
      } else {
        setUploadStatus('error');
        setUploadMessage(data.error || 'Upload failed');
      }
    } catch (err: any) {
       setUploadStatus('error');
       setUploadMessage(err.message);
    } finally {
       setIsUploading(false);
       setTimeout(() => setUploadStatus('idle'), 5000);
       if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = (filename: string) => {
    if (!token || !session?.id) return;
    let fullPath = targetPath;
    if (!fullPath.endsWith('/')) fullPath += '/';
    fullPath += filename;
    
    // Pass JWT via query parameter and let the browser's native download manager handle it.
    // This avoids large files crashing the browser via `.blob()` fetching.
    const downloadUrl = `/api/sessions/${session.id}/download?path=${encodeURIComponent(fullPath)}&token=${encodeURIComponent(token)}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async (filename: string, isDir: boolean) => {
    if (!token || !session?.id) return;
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;

    let fullPath = targetPath;
    if (!fullPath.endsWith('/')) fullPath += '/';
    fullPath += filename;

    setIsLoadingFiles(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/files?path=${encodeURIComponent(fullPath)}&isDir=${isDir}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        loadFiles(targetPath);
      } else {
        const errorData = await res.json();
        setFileError(errorData.error || 'Delete failed');
        setTimeout(() => setFileError(''), 3000);
        setIsLoadingFiles(false);
      }
    } catch (err: any) {
      setFileError(err.message);
      setTimeout(() => setFileError(''), 3000);
      setIsLoadingFiles(false);
    }
  };

  const isDirectory = (file: RemoteFile) => {
    // Mode check for directory (S_IFDIR is 0x4000 or 0040000)
    // Actually in SFTP longname usually starts with 'd'
    return file.longname.startsWith('d');
  };

  const formatSize = (bytes: number) => {
     if (bytes === 0) return '0 B';
     const k = 1024;
     const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
     const i = Math.floor(Math.log(bytes) / Math.log(k));
     return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Parse `statsStr` which has output from `top -b -n 1 | head -n 5 && free -m`
  let cpuUsage = 'N/A';
  let memUsage = 'N/A';

  if (statsStr) {
     const cpuMatch = statsStr.match(/%Cpu\(s\).*?(\d+\.\d+)\s*id/);
     if (cpuMatch) {
         const idle = parseFloat(cpuMatch[1]);
         if (!isNaN(idle)) {
             cpuUsage = (100 - idle).toFixed(1) + '%';
         }
     }
     
     const memMatch = statsStr.match(/Mem:\s+(\d+)\s+(\d+)/);
     if (memMatch) {
         const total = parseInt(memMatch[1]);
         const used = parseInt(memMatch[2]);
         if (total > 0) {
             memUsage = ((used / total) * 100).toFixed(1) + '%';
         }
     }
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex bg-zinc-50 dark:bg-[#09090b] text-xs h-full w-full overflow-hidden",
        isResizing && "cursor-col-resize select-none border-indigo-500/20"
      )}
    >
      {/* Stats Section */}
      <div 
        style={{ width: `${statsWidth}px` }} 
        className="shrink-0 p-4 flex flex-col justify-center"
      >
         <h3 className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-3 flex items-center gap-2">
            <Activity className="w-3 h-3 text-emerald-400" />
            Server Performance
         </h3>
         
         <div className="space-y-4">
             <div>
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400 mb-1 font-mono">
                    <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" /> CPU</span>
                    <span>{cpuUsage}</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5">
                    <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" style={{ width: cpuUsage === 'N/A' ? '0%' : cpuUsage }}></div>
                </div>
             </div>
             <div>
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400 mb-1 font-mono">
                    <span className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> Memory</span>
                    <span>{memUsage}</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: memUsage === 'N/A' ? '0%' : memUsage }}></div>
                </div>
             </div>
         </div>
      </div>

      {/* Internal Resizer */}
      <div 
        onMouseDown={startResizing}
        className={cn(
          "w-4 group relative cursor-col-resize flex items-center justify-center transition-all bg-transparent z-10",
          isResizing && "bg-indigo-500/5"
        )}
      >
        <div className={cn(
          "w-[1px] h-32 bg-zinc-800 transition-colors group-hover:bg-indigo-500/50 group-hover:h-full",
          isResizing && "bg-indigo-500 h-full"
        )} />
      </div>

      {/* File Explorer Section */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
         {/* Toolbar */}
         <div className="p-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 bg-zinc-100 dark:bg-black">
             <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
             <form 
               onSubmit={(e) => { e.preventDefault(); loadFiles(inputPath); }}
               className="flex-1 flex items-center"
             >
                 <input 
                    type="text" 
                    value={inputPath}
                    onChange={e => setInputPath(e.target.value)}
                    className="bg-transparent border-none outline-none text-zinc-700 dark:text-zinc-300 font-mono w-full px-2"
                    placeholder="/path/to/dir"
                 />
                 <button type="submit" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1">
                    <ChevronRight className="w-4 h-4" />
                 </button>
             </form>

             <button 
                onClick={() => loadFiles(targetPath)}
                className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-md hover:bg-black/5 dark:hover:bg-zinc-800"
                title="Refresh"
             >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin text-indigo-400' : ''}`} />
             </button>
             
             <div className="w-px h-4 bg-zinc-800 mx-1"></div>

             <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                    }
                }}
             />
             
             <button 
                 disabled={isUploading}
                 onClick={() => fileInputRef.current?.click()}
                 className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1.5"
             >
                 {isUploading ? (
                     <Activity className="w-3.5 h-3.5 animate-spin" />
                 ) : (
                     <Upload className="w-3.5 h-3.5" />
                 )}
                 Upload
             </button>
         </div>

         {/* File List */}
         <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
             {fileError ? (
                 <div className="flex flex-col items-center justify-center p-4 text-red-400 h-full">
                     <AlertCircle className="w-6 h-6 mb-2" />
                     <span>{fileError}</span>
                 </div>
             ) : (
                 <table className="w-full text-left border-collapse">
                     <thead>
                         <tr className="text-[10px] uppercase tracking-widest text-zinc-500 sticky top-0 bg-zinc-50 dark:bg-[#09090b] z-10">
                             <th className="font-normal py-1.5 px-2">Name</th>
                             <th className="font-normal py-1.5 px-2 w-24">Size</th>
                             <th className="font-normal py-1.5 px-2 w-16 text-right">Actions</th>
                         </tr>
                     </thead>
                     <tbody className="font-mono text-xs">
                         {files.sort((a, b) => {
                             const aDir = isDirectory(a);
                             const bDir = isDirectory(b);
                             if (aDir && !bDir) return -1;
                             if (!aDir && bDir) return 1;
                             return a.filename.localeCompare(b.filename);
                         }).map(f => {
                             const isDir = isDirectory(f);
                             return (
                                 <tr key={f.filename} className="border-b border-zinc-200/50 border-zinc-200/50 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/30 group">
                                     <td className="py-1.5 px-2">
                                         <div className="flex items-center gap-2">
                                             {isDir ? (
                                                 <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                             ) : (
                                                 <FileIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                             )}
                                             {isDir ? (
                                                 <button 
                                                     onClick={() => {
                                                         let newPath = targetPath;
                                                         if (!newPath.endsWith('/')) newPath += '/';
                                                         if (f.filename === '..') {
                                                             newPath = newPath.split('/').slice(0, -2).join('/') || '/';
                                                         } else if (f.filename !== '.') {
                                                             newPath += f.filename;
                                                         }
                                                         loadFiles(newPath);
                                                     }}
                                                     className="text-white hover:underline focus:outline-none text-left truncate max-w-[200px]"
                                                 >
                                                    {f.filename}
                                                 </button>
                                             ) : (
                                                 <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">{f.filename}</span>
                                             )}
                                         </div>
                                     </td>
                                     <td className="py-1.5 px-2 text-zinc-500">
                                         {!isDir && formatSize(f.attrs.size)}
                                     </td>
                                     <td className="py-1.5 px-2 text-right">
                                         <div className="flex justify-end items-center gap-1">
                                             {!isDir && (
                                                 <button 
                                                    onClick={() => handleDownload(f.filename)}
                                                    className="text-zinc-500 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                    title="Download"
                                                 >
                                                    <Download className="w-3.5 h-3.5" />
                                                 </button>
                                             )}
                                             {f.filename !== '.' && f.filename !== '..' && (
                                                 <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // prevent directory navigation if it's a dir
                                                        handleDelete(f.filename, isDir);
                                                    }}
                                                    className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                    title="Delete"
                                                 >
                                                    <Trash className="w-3.5 h-3.5" />
                                                 </button>
                                             )}
                                         </div>
                                     </td>
                                 </tr>
                             );
                         })}
                         {files.length === 0 && !isLoadingFiles && (
                             <tr>
                                 <td colSpan={3} className="py-4 text-center text-zinc-500 dark:text-zinc-400">
                                     Empty directory
                                 </td>
                             </tr>
                         )}
                     </tbody>
                 </table>
             )}
         </div>

         {uploadStatus === 'success' && (
             <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-white px-3 py-1.5 rounded shadow-lg text-xs flex items-center gap-1.5 backdrop-blur-sm z-20">
                 <Check className="w-3 h-3" />
                 <span>{uploadMessage}</span>
             </div>
         )}
      </div>
    </div>
  );
}
