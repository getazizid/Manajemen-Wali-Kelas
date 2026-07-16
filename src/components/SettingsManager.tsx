import React, { useState } from 'react';
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Settings, Save, CheckCircle, Trash2 } from 'lucide-react';

interface SettingsManagerProps {
  appName: string;
  appDesc: string;
  onSettingsChange: (newAppName: string, newAppDesc: string) => void;
}

export default function SettingsManager({ appName, appDesc, onSettingsChange }: SettingsManagerProps) {
  const [currentAppName, setCurrentAppName] = useState<string>(appName);
  const [currentAppDesc, setCurrentAppDesc] = useState<string>(appDesc);
  const [loading, setLoading] = useState<boolean>(false);
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<'success' | 'error' | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAppName.trim() || !currentAppDesc.trim()) {
      alert('Nama aplikasi dan deskripsi tidak boleh kosong.');
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      await setDoc(doc(db, 'settings', 'app'), {
        appName: currentAppName.trim(),
        appDesc: currentAppDesc.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      onSettingsChange(currentAppName.trim(), currentAppDesc.trim());
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

  const handleResetDatabase = async () => {
    if (!confirm('PERINGATAN KERAS! Tindakan ini akan menghapus semua data (Siswa, Pelanggaran, Prestasi, Inventaris, Kelas, Kunjungan Rumah, dsb) di database Anda. Akun Admin Anda akan tetap dipertahankan. Apakah Anda yakin?')) return;
    if (!confirm('Apakah Anda benar-benar yakin? Tindakan ini tidak dapat dibatalkan.')) return;

    setResetLoading(true);
    try {
      const collections = ['classes', 'users', 'students', 'violations', 'achievements', 'inventories', 'class_officers', 'home_visits'];
      
      // Preserve current users with ADMIN role to prevent locking out the admin
      const usersSnap = await getDocs(collection(db, 'users'));
      const admins: any[] = [];
      usersSnap.forEach(userDoc => {
        const data = userDoc.data();
        if (data.role === 'admin' || data.email === 'abdulazizitn@gmail.com') {
          admins.push({ id: userDoc.id, ...data });
        }
      });

      // Delete all documents in all collections
      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        for (const document of snap.docs) {
          if (colName === 'users' && admins.some(a => a.id === document.id)) {
            continue;
          }
          await deleteDoc(doc(db, colName, document.id));
        }
      }

      // Re-create Admin fallback if somehow missing from the query
      if (admins.length === 0) {
        await setDoc(doc(db, 'users', 'admin_demo'), {
          name: 'Abdul Aziz (Admin)',
          email: 'abdulazizitn@gmail.com',
          role: 'admin',
          classId: '',
          createdAt: new Date().toISOString()
        });
      }

      // Recreate new classes and teachers as requested by the user
      const newClassesAndTeachers = [
        { classId: 'X-TSM', className: 'X TSM', teacherName: 'Bella Oktavia', teacherEmail: 'bella.oktavia@sekolah.sch.id' },
        { classId: 'X-TKR-TSM-2', className: 'X TKR dan TSM 2', teacherName: 'Arizal Iswara, S.Pd., Gr', teacherEmail: 'arizal.iswara@sekolah.sch.id' },
        { classId: 'X-RPL-DKV-AV-AK', className: 'X RPL DKV AV AK', teacherName: 'Mas’ullah Arjumuntik, S.Kep., Gr', teacherEmail: 'masullah.arjumuntik@sekolah.sch.id' },
        { classId: 'XI-TSM', className: 'XI TSM', teacherName: 'Fian A’yuna, S.S., Gr', teacherEmail: 'fian.ayuna@sekolah.sch.id' },
        { classId: 'XI-TKR', className: 'XI TKR', teacherName: 'Ayu Maulinda, S.Pd., Gr', teacherEmail: 'ayu.maulinda@sekolah.sch.id' },
        { classId: 'XI-RPL-DKV-AV', className: 'XI RPL DKV AV', teacherName: 'Aisna Rahma Dewi, S.Pd', teacherEmail: 'aisna.rahma@sekolah.sch.id' },
        { classId: 'XII-TSM', className: 'XII TSM', teacherName: 'Adelia Sherly Wahyudi, S.Pd', teacherEmail: 'adelia.sherly@sekolah.sch.id' },
        { classId: 'XII-TKR-AK', className: 'XII TKR AK', teacherName: 'Krisna Sulisetiyo Rini, S.Kep.,Ns.,Gr', teacherEmail: 'krisna.sulisetiyo@sekolah.sch.id' },
        { classId: 'XII-DKV-RPL', className: 'XII DKV RPL', teacherName: 'Firman Aulia Wahid', teacherEmail: 'firman.aulia@sekolah.sch.id' }
      ];

      for (const item of newClassesAndTeachers) {
        const teacherId = `wali_${item.classId.toLowerCase().replace(/-/g, '_')}`;
        
        // Create class document
        await setDoc(doc(db, 'classes', item.classId), {
          id: item.classId,
          name: item.className,
          homeroomTeacherId: teacherId,
          homeroomTeacherName: item.teacherName,
          createdAt: new Date().toISOString()
        });

        // Create teacher/user document
        await setDoc(doc(db, 'users', teacherId), {
          name: item.teacherName,
          email: item.teacherEmail,
          role: 'wali_kelas',
          classId: item.classId,
          createdAt: new Date().toISOString()
        });
      }

      alert('Database berhasil dibersihkan dan diisi dengan data kelas & wali kelas baru!');
      window.location.reload();
    } catch (err) {
      console.error('Error resetting database:', err);
      alert('Gagal membersihkan database: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setResetLoading(false);
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
      <form onSubmit={handleSave} className="p-6 space-y-5">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Nama Aplikasi (Judul Utama)
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
            Nama ini digunakan pada tab browser, logo sidebar, layar loading, dan judul halaman login.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Deskripsi Aplikasi (Sub-judul)
          </label>
          <input
            type="text"
            required
            maxLength={100}
            value={currentAppDesc}
            onChange={(e) => setCurrentAppDesc(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
            placeholder="Contoh: Manajemen Wali Kelas"
          />
          <p className="text-[9px] text-slate-400 mt-1.5 font-medium">
            Deskripsi ini digunakan di bawah logo sidebar dan sub-judul halaman login.
          </p>
        </div>

        {/* Action Button & Status */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
          <div>
            {status === 'success' && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 animate-fade-in">
                <CheckCircle className="h-4 w-4" />
                Pengaturan berhasil disimpan!
              </span>
            )}
            {status === 'error' && (
              <span className="text-xs text-red-600 font-semibold bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 animate-fade-in">
                Gagal menyimpan ke Firestore. Periksa Rules Anda.
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

      {/* Database Reset Section */}
      <div className="p-6 border-t border-slate-100 bg-red-50/10 space-y-3">
        <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
          <Trash2 className="h-4 w-4" />
          Zona Bahaya: Reset Database Baru
        </h4>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Gunakan tombol di bawah untuk menghapus seluruh data di database (Siswa, Log Pelanggaran, Log Kunjungan Rumah, dsb) dan mengisi ulang dengan data Kelas & Wali Kelas baru sesuai instruksi. Akun administrator Anda tetap aman.
        </p>
        <button
          type="button"
          onClick={handleResetDatabase}
          disabled={resetLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-red-100 disabled:opacity-50 cursor-pointer"
        >
          {resetLoading ? 'Memproses DB Clean & Seed...' : 'Bersihkan & Reset Database Baru'}
        </button>
      </div>
    </div>
  );
}
