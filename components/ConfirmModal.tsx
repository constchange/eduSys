import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

const ConfirmModal: React.FC<Props> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "Confirm", 
  cancelText = "Cancel", 
  isDanger = false 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100 border border-slate-100">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-full flex-shrink-0 ${isDanger ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
              {isDanger ? <AlertTriangle size={24} /> : <Info size={24} />}
            </div>
            <h3 className="text-xl font-bold text-slate-800 leading-tight">{title}</h3>
          </div>
          
          <div className="text-slate-600 mb-8 leading-relaxed ml-1">
            {message}
          </div>
          
          <div className="flex justify-end gap-3">
            <button 
              onClick={onCancel} 
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {cancelText}
            </button>
            <button 
              onClick={onConfirm} 
              className={`px-5 py-2.5 text-white rounded-lg font-bold shadow-md transition-all transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isDanger 
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 shadow-red-200' 
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 shadow-blue-200'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;