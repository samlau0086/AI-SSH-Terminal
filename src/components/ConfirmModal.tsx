import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, message, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#18181b] w-full max-w-sm rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-medium">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            {title}
          </div>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 text-sm text-zinc-600 dark:text-zinc-300">
          {message}
        </div>
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            {t('common.delete', 'Delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
