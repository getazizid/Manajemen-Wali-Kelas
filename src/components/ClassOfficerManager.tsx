import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ClassOfficer, Student, User, UserRole } from '../types';
import { sendRealtimeNotification } from '../utils/notifications';
import { NotificationType } from '../types';
import { UserCheck, ShieldCheck, FileCheck, Save, Award, FileSpreadsheet } from 'lucide-react';
import TemplateImporter from './TemplateImporter';

interface ClassOfficerManagerProps {
  currentUser: User;
  classesList: string[];
}

export default function ClassOfficerManager({ currentUser, classesList }: ClassOfficerManagerProps) {
  const [officers, setOfficers] = useState<ClassOfficer | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showImporter, setShowImporter] = useState<boolean>(false);
  const [selectedClass, setSelectedClass] = useState<string>(
    currentUser.role === UserRole.WALI_KELAS ? currentUser.classId || '' : (classesList[0] || 'XI-RPL-1')
  );

  const [formData, setFormData] = useState({
    ketua: '',
    wakil: '',
    sekretaris: '',
    bendahara: ''
  });

  const isReadOnly = currentUser.role === UserRole.KEPALA_SEKOLAH;

  // Fetch students of the selected class
  const fetchStudents = async () => {
    const path = 'students';
    try {
      const q = query(collection(db, path), where('classId', '==', selectedClass));
      const snapshot = await getDocs(q);
      const list: Student[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Student);
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  };

  // Fetch class officer details
  const fetchOfficers = async () => {
    setLoading(true);
    const path = 'class_officers';
    try {
      const docRef = doc(db, path, selectedClass);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as ClassOfficer;
        setOfficers(data);
        setFormData({
          ketua: data.ketua || '',
          wakil: data.wakil || '',
          sekretaris: data.sekretaris || '',
          bendahara: data.bendahara || ''
        });
      } else {
        setOfficers(null);
        setFormData({ ketua: '', wakil: '', sekretaris: '', bendahara: '' });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${path}/${selectedClass}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchOfficers();
  }, [selectedClass]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    const path = 'class_officers';
    try {
      const payload: ClassOfficer = {
        classId: selectedClass,
        ketua: formData.ketua,
        wakil: formData.wakil,
        sekretaris: formData.sekretaris,
        bendahara: formData.bendahara,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, path, selectedClass), payload);
      
      await sendRealtimeNotification(
        'Pengurus Kelas Diperbarui',
        `Struktur pengurus kelas ${selectedClass} telah diperbarui`,
        NotificationType.SISWA,
        selectedClass
      );

      setOfficers(payload);
      alert('Pengurus kelas berhasil disimpan.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleImportOfficers = async (parsedRows: any[]) => {
    const newFormData = { ...formData };
    parsedRows.forEach(row => {
      const roleStr = (row['Jabatan'] || row['jabatan'] || '').toLowerCase();
      const val = row['Nama atau NISN'] || row['nama atau nisn'] || '';
      
      let matchedStudentName = val;
      const found = students.find(s => s.name.toLowerCase() === val.toLowerCase() || s.nisn === val);
      if (found) {
        matchedStudentName = found.name;
      }

      if (roleStr.includes('ketua') && !roleStr.includes('wakil')) {
        newFormData.ketua = matchedStudentName;
      } else if (roleStr.includes('wakil')) {
        newFormData.wakil = matchedStudentName;
      } else if (roleStr.includes('sekretaris')) {
        newFormData.sekretaris = matchedStudentName;
      } else if (roleStr.includes('bendahara')) {
        newFormData.bendahara = matchedStudentName;
      }
    });

    const path = 'class_officers';
    const payload: ClassOfficer = {
      classId: selectedClass,
      ketua: newFormData.ketua,
      wakil: newFormData.wakil,
      sekretaris: newFormData.sekretaris,
      bendahara: newFormData.bendahara,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, path, selectedClass), payload);
    
    await sendRealtimeNotification(
      'Pengurus Kelas Diimpor',
      `Struktur pengurus kelas ${selectedClass} berhasil diimpor melalui template`,
      NotificationType.SISWA,
      selectedClass
    );
    
    setOfficers(payload);
    setFormData(newFormData);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Manajemen Pengurus Kelas</h3>
          <p className="text-xs text-slate-500 mt-1">Struktur organisasi kepengurusan kelas</p>
        </div>

        {/* Class Filter (Admin/Kepsek only) */}
        <div className="flex flex-wrap items-center gap-2">
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setShowImporter(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
            >
              <FileSpreadsheet className="h-4 w-4 text-sky-600" />
              Import Template
            </button>
          )}

          {currentUser.role !== UserRole.WALI_KELAS && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="text-xs text-slate-500">Kelas:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="text-xs bg-transparent focus:outline-none font-medium text-slate-700"
              >
                {classesList.map(c => (
                  <option key={c} value={c}>Kelas {c}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 text-xs">Loading data pengurus kelas...</div>
      ) : (
        <form onSubmit={handleSave} className="p-6 max-w-2xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Ketua Kelas */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <Award className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Ketua Kelas</span>
              </div>
              <select
                disabled={isReadOnly}
                value={formData.ketua}
                onChange={(e) => setFormData({ ...formData, ketua: e.target.value })}
                className="w-full mt-1.5 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="">-- Pilih Ketua Kelas --</option>
                {students.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Wakil Ketua */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-teal-600">
                <UserCheck className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Wakil Ketua Kelas</span>
              </div>
              <select
                disabled={isReadOnly}
                value={formData.wakil}
                onChange={(e) => setFormData({ ...formData, wakil: e.target.value })}
                className="w-full mt-1.5 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="">-- Pilih Wakil Ketua --</option>
                {students.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Sekretaris */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <FileCheck className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Sekretaris</span>
              </div>
              <select
                disabled={isReadOnly}
                value={formData.sekretaris}
                onChange={(e) => setFormData({ ...formData, sekretaris: e.target.value })}
                className="w-full mt-1.5 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="">-- Pilih Sekretaris --</option>
                {students.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Bendahara */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-purple-600">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bendahara</span>
              </div>
              <select
                disabled={isReadOnly}
                value={formData.bendahara}
                onChange={(e) => setFormData({ ...formData, bendahara: e.target.value })}
                className="w-full mt-1.5 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="">-- Pilih Bendahara --</option>
                {students.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

          </div>

          {!isReadOnly && (
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-sm shadow-indigo-100"
              >
                <Save className="h-4 w-4" />
                Simpan Struktur Pengurus
              </button>
            </div>
          )}
        </form>
      )}

      {showImporter && (
        <TemplateImporter
          menuType="pengurus"
          classId={selectedClass}
          students={students}
          onImport={handleImportOfficers}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  );
}
