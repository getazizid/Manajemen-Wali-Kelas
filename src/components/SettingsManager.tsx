import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Settings, Save, CheckCircle } from 'lucide-react';

interface SettingsManagerProps {
  appName: string;
  onAppNameChange: (newAppName: string) => void;
}

export default function SettingsManager({ appName, onAppNameChange }: SettingsManagerProps) {
  const [currentAppName, setCurrentAppName] = useState<string>(appName);
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<'success' | 'error' | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAppName.trim()) {
      alert('Nama aplikasi tidak boleh kosong.');
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      await setDoc(doc(db, 'settings', 'app'), {
        appName: currentAppName.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      onAppNameChange(currentAppName.trim());
      setStatus('success');
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setStatus('error');
      setTimeout(() => setStatus(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden max-w-xl mx-auto">
      {/* Header */}
      <div className="p-6 border-b border-slate-50 flex items-center gap-3 bg-slate-50/20">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">Pengaturan Aplikasi</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">Konfigurasi global identitas aplikasi Anda</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="p-6 space-y-6">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Nama Aplikasi (Akan merubah semua header dan logo)
          </label>
          <input
            type="text"
            required
            maxLength={30}
            value={currentAppName}
            onChange={(e) => setCurrentAppName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
            placeholder="Contoh: SIWALI"
          />
          <p className="text-[9px] text-slate-400 mt-1.5 font-medium">
            Nama ini akan digunakan pada tab browser, logo sidebar, layar loading, dan halaman autentikasi masuk.
          </p>
        </div>

        {/* Action Button & Status */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
          <div>
            {status === 'success' && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                <CheckCircle className="h-4 w-4" />
                Pengaturan berhasil disimpan!
              </span>
            )}
            {status === 'error' && (
              <span className="text-xs text-red-600 font-semibold bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                Gagal menyimpan data ke Firestore.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>
    </div>
  );
}
