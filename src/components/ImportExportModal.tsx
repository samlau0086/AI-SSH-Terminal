import React, { useState, useRef } from 'react';
import { Download, Upload, X, KeySquare, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CryptoJS from 'crypto-js';

interface Session {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'privateKey';
  password?: string;
  privateKey?: string;
  passphrase?: string;
  tags: string[];
  notes: string;
}

interface ImportExportModalProps {
  sessions: Session[];
  onImport: (sessions: Session[]) => Promise<void>;
  onClose: () => void;
}

export default function ImportExportModal({ sessions, onImport, onClose }: ImportExportModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  
  // Export state
  const [exportPassword, setExportPassword] = useState('');
  
  // Import state
  const [importPassword, setImportPassword] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (!exportPassword) return;
    try {
      // Create a clean backup object
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        sessions: sessions
      };
      
      const payloadString = JSON.stringify(backupData);
      
      // Encrypt
      const encryptedMessage = CryptoJS.AES.encrypt(payloadString, exportPassword).toString();
      
      // Download file
      const blob = new Blob([encryptedMessage], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ai-ssh-sessions-${new Date().toISOString().split('T')[0]}.enc`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    setImportSuccess('');
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !importPassword) return;
    
    setIsImporting(true);
    setImportError('');
    setImportSuccess('');
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const encryptedContent = e.target?.result as string;
          
          // Decrypt
          const decryptedBytes = CryptoJS.AES.decrypt(encryptedContent, importPassword);
          const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);
          
          if (!decryptedString) {
            throw new Error('Invalid password or corrupted file');
          }
          
          const backupData = JSON.parse(decryptedString);
          
          if (!backupData || !backupData.sessions || !Array.isArray(backupData.sessions)) {
            throw new Error('Invalid backup format');
          }
          
          // Execute import callback to handle API calls
          await onImport(backupData.sessions);
          setImportSuccess(`Successfully imported ${backupData.sessions.length} sessions`);
          setIsImporting(false);
        } catch (err: any) {
          setImportError(err.message || 'Decryption failed. Please check your password.');
          setIsImporting(false);
        }
      };
      reader.onerror = () => {
        setImportError('Failed to read file');
        setIsImporting(false);
      };
      reader.readAsText(selectedFile);
    } catch (err: any) {
      setImportError(err.message);
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#18181b] border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-sm font-bold tracking-wider text-zinc-200">Import / Export Sessions</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-zinc-800">
          <button
            className={`flex-1 py-3 text-xs font-bold tracking-wider uppercase ${activeTab === 'export' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/10' : 'text-zinc-500 hover:bg-zinc-800/50'}`}
            onClick={() => setActiveTab('export')}
          >
            Export
          </button>
          <button
            className={`flex-1 py-3 text-xs font-bold tracking-wider uppercase ${activeTab === 'import' ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/10' : 'text-zinc-500 hover:bg-zinc-800/50'}`}
            onClick={() => setActiveTab('import')}
          >
            Import
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'export' ? (
            <div className="space-y-4">
              <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-md shrink-0">
                    <Download className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-zinc-300 mb-1">Export your configurations</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Download a strongly encrypted backup of all your saved sessions, including passwords and private keys. Keep this file safe.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                 <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                    <KeySquare className="w-3.5 h-3.5" />
                    Encryption Password
                 </label>
                 <input
                    type="password"
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="Enter a strong password"
                    className="w-full bg-[#09090b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                 />
                 <p className="text-[10px] text-zinc-500 mt-1.5 ml-1">You will need this password to import the file later.</p>
              </div>

              <button
                 onClick={handleExport}
                 disabled={!exportPassword || sessions.length === 0}
                 className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors mt-2 flex items-center justify-center gap-2"
              >
                 <Download className="w-4 h-4" />
                 Download Encrypted Backup
              </button>
            </div>
          ) : (
            <div className="space-y-4">
               <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-md shrink-0">
                    <Upload className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-zinc-300 mb-1">Restore from backup</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Import a previously exported encrypted backup file. Existing sessions with the same ID will be overwritten.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                 <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                    <FileJson className="w-3.5 h-3.5" />
                    Backup File
                 </label>
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".enc"
                    className="w-full bg-[#09090b] border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20"
                 />
              </div>

              <div>
                 <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-2">
                    <KeySquare className="w-3.5 h-3.5" />
                    Decryption Password
                 </label>
                 <input
                    type="password"
                    value={importPassword}
                    onChange={(e) => setImportPassword(e.target.value)}
                    placeholder="Enter the password used during export"
                    className="w-full bg-[#09090b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                 />
              </div>

              {importError && (
                 <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p>{importError}</p>
                 </div>
              )}

              {importSuccess && (
                 <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 text-xs">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <p>{importSuccess}</p>
                 </div>
              )}

              <button
                 onClick={handleImport}
                 disabled={!selectedFile || !importPassword || isImporting}
                 className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors mt-2 flex items-center justify-center gap-2"
              >
                 <Upload className="w-4 h-4" />
                 {isImporting ? 'Importing...' : 'Decrypt and Import'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
