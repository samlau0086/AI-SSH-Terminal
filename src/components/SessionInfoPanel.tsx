import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Session } from '../App';
import { Activity, Upload, HardDrive, Cpu, Check, X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  session: Session;
}

export default function SessionInfoPanel({ session }: Props) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [statsStr, setStatsStr] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [targetPath, setTargetPath] = useState('~/');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (file: File) => {
    if (!file || !token || !session?.id) return;
    
    setIsUploading(true);
    setUploadStatus('idle');
    const formData = new FormData();
    formData.append('file', file);
    
    // Ensure target path ends with / if it's a directory
    let finalPath = targetPath;
    if (finalPath.endsWith('/')) {
        finalPath += file.name;
    }

    formData.append('path', finalPath);

    try {
      const res = await fetch(`/api/sessions/${session.id}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus('success');
        setUploadMessage(data.message);
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

  // Parse `statsStr` which has output from `top -b -n 1 | head -n 5 && free -m`
  // %Cpu(s):  1.5 us,  0.5 sy,  ... idle
  // Mem: total used free ...
  
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
    <div className="flex border-t border-zinc-800 bg-[#09090b] text-xs h-40 shrink-0">
      {/* Stats Section */}
      <div className="w-1/3 border-r border-zinc-800 p-4 flex flex-col justify-center">
         <h3 className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-3 flex items-center gap-2">
            <Activity className="w-3 h-3 text-emerald-400" />
            Server Performance
         </h3>
         
         <div className="space-y-4">
             <div>
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                    <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" /> CPU</span>
                    <span>{cpuUsage}</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                    <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" style={{ width: cpuUsage === 'N/A' ? '0%' : cpuUsage }}></div>
                </div>
             </div>
             <div>
                <div className="flex justify-between text-zinc-400 mb-1 font-mono">
                    <span className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> Memory</span>
                    <span>{memUsage}</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: memUsage === 'N/A' ? '0%' : memUsage }}></div>
                </div>
             </div>
         </div>
      </div>

      {/* Upload Section */}
      <div className="w-2/3 p-4 flex flex-col justify-center relative">
         <h3 className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-3 flex items-center gap-2">
            <Upload className="w-3 h-3 text-indigo-400" />
            File Transfer (SFTP)
         </h3>

         <div className="flex items-center gap-3">
             <div className="flex-1 flex items-center bg-black border border-zinc-800 rounded-lg px-3 py-2">
                 <span className="text-zinc-600 mr-2 font-mono">Path:</span>
                 <input 
                    type="text" 
                    value={targetPath}
                    onChange={e => setTargetPath(e.target.value)}
                    className="bg-transparent border-none outline-none text-zinc-300 font-mono w-full"
                    placeholder="/root/ or ./filename"
                 />
             </div>
             
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
                 className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
             >
                 {isUploading ? (
                     <Activity className="w-4 h-4 animate-spin" />
                 ) : (
                     <Upload className="w-4 h-4" />
                 )}
                 Select File
             </button>
         </div>

         {uploadStatus === 'success' && (
             <div className="absolute bottom-4 left-4 right-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-2 rounded-md flex items-center gap-2 mt-2">
                 <Check className="w-3.5 h-3.5" />
                 <span>{uploadMessage}</span>
             </div>
         )}

         {uploadStatus === 'error' && (
             <div className="absolute bottom-4 left-4 right-4 bg-red-500/10 border border-red-500/30 text-red-400 p-2 rounded-md flex items-center gap-2 mt-2">
                 <AlertCircle className="w-3.5 h-3.5" />
                 <span>{uploadMessage}</span>
             </div>
         )}
      </div>
    </div>
  );
}
