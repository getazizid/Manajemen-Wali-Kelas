import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Achievement, AchievementCategory, AchievementLevel, Student, User, UserRole } from '../types';
import { exportToCSV, printData } from '../utils/export';
import { sendRealtimeNotification } from '../utils/notifications';
import { NotificationType } from '../types';
import { Trophy, Plus, Search, Edit2, Trash2, Printer, FileDown, ChevronLeft, ChevronRight, X, Filter, FileSpreadsheet } from 'lucide-react';
import TemplateImporter from './TemplateImporter';

interface AchievementManagerProps {
  currentUser: User;
  classesList: string[];
}

export default function AchievementManager({ currentUser, classesList }: AchievementManagerProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>(
    currentUser.role === UserRole.WALI_KELAS ? currentUser.classId || '' : (classesList[0] || 'XI-RPL-1')
  );

  // Pagination
  const [page, setPage] = useState<number>(1);
  const itemsPerPage = 6;

  // Form states
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showImporter, setShowImporter] = useState<boolean>(false);
  const [formType, setFormType] = useState<'create' | 'update'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    studentId: '',
    achievementName: '',
    category: AchievementCategory.AKADEMIK,
    level: AchievementLevel.SEKOLAH,
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const isReadOnly = currentUser.role === UserRole.KEPALA_SEKOLAH;

  // Fetch student profiles for the class
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

  const fetchAchievements = async () => {
    setLoading(true);
    const path = 'achievements';
    try {
      let q = query(collection(db, path));
      if (selectedClass) {
        q = query(collection(db, path), where('classId', '==', selectedClass));
      }
      const snapshot = await getDocs(q);
      const list: Achievement[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          studentId: data.studentId || '',
          studentName: data.studentName || '',
          classId: data.classId || '',
          achievementName: data.achievementName || '',
          category: data.category as AchievementCategory,
          level: data.level as AchievementLevel,
          date: data.date || '',
          description: data.description || '',
          createdAt: data.createdAt || ''
        });
      });
      list.sort((a, b) => b.date.localeCompare(a.date));
      setAchievements(list);
      setPage(1);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchAchievements();
  }, [selectedClass]);

  // Search filter
  const filteredAchievements = achievements.filter(ach =>
    ach.studentName.toLowerCase().includes(search.toLowerCase()) ||
    ach.achievementName.toLowerCase().includes(search.toLowerCase())
  );

  // Pagination calculation
  const totalPages = Math.ceil(filteredAchievements.length / itemsPerPage) || 1;
  const paginatedAchievements = filteredAchievements.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleOpenCreate = () => {
    setFormType('create');
    setFormData({
      studentId: students[0]?.id || '',
      achievementName: '',
      category: AchievementCategory.AKADEMIK,
      level: AchievementLevel.SEKOLAH,
      date: new Date().toISOString().split('T')[0],
      description: ''
    });
    setEditingId(null);
    setShowModal(true);
  };

  const handleOpenUpdate = (ach: Achievement) => {
    setFormType('update');
    setFormData({
      studentId: ach.studentId,
      achievementName: ach.achievementName,
      category: ach.category,
      level: ach.level,
      date: ach.date,
      description: ach.description
    });
    setEditingId(ach.id || null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.achievementName) {
      alert('Nama siswa dan penghargaan wajib dipilih/diisi.');
      return;
    }

    const selectedStudent = students.find(s => s.id === formData.studentId);
    if (!selectedStudent) return;

    const path = 'achievements';
    try {
      const payload = {
        studentId: formData.studentId,
        studentName: selectedStudent.name,
        classId: selectedClass,
        achievementName: formData.achievementName,
        category: formData.category,
        level: formData.level,
        date: formData.date,
        description: formData.description
      };

      if (formType === 'create') {
        await addDoc(collection(db, path), {
          ...payload,
          createdAt: new Date().toISOString()
        });

        await sendRealtimeNotification(
          'Prestasi Murid Ditambahkan',
          `${selectedStudent.name} meraih prestasi: "${formData.achievementName}" tingkat ${formData.level}!`,
          NotificationType.PRESTASI,
          selectedClass
        );
      } else if (formType === 'update' && editingId) {
        const original = achievements.find(a => a.id === editingId);
        await setDoc(doc(db, path, editingId), {
          ...payload,
          createdAt: original?.createdAt || new Date().toISOString()
        }, { merge: true });

        await sendRealtimeNotification(
          'Prestasi Murid Diperbarui',
          `Data prestasi untuk ${selectedStudent.name} telah diperbarui`,
          NotificationType.PRESTASI,
          selectedClass
        );
      }
      setShowModal(false);
      fetchAchievements();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus prestasi untuk siswa ${name}?`)) return;
    const path = 'achievements';
    try {
      await deleteDoc(doc(db, path, id));
      
      await sendRealtimeNotification(
        'Prestasi Murid Dihapus',
        `Log prestasi siswa ${name} telah dihapus dari sistem`,
        NotificationType.PRESTASI,
        selectedClass
      );

      fetchAchievements();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleExport = () => {
    const headers = ['Nama Siswa', 'Nama Penghargaan', 'Kategori', 'Tingkat', 'Tanggal', 'Keterangan'];
    const rows = filteredAchievements.map(a => [
      a.studentName,
      a.achievementName,
      a.category,
      a.level,
      a.date,
      a.description
    ]);
    exportToCSV(`Prestasi_Siswa_Kelas_${selectedClass}`, headers, rows);
  };

  const handlePrint = () => {
    const headers = ['No', 'Nama Siswa', 'Nama Prestasi / Penghargaan', 'Kategori', 'Tingkat', 'Tanggal'];
    const rows = filteredAchievements.map((a, idx) => [
      String(idx + 1),
      a.studentName,
      a.achievementName,
      a.category,
      a.level,
      a.date
    ]);
    printData(
      `Daftar Prestasi Siswa Kelas ${selectedClass}`,
      headers,
      rows,
      [
        { label: 'Kelas', value: selectedClass },
        { label: 'Total Prestasi', value: `${filteredAchievements.length} penghargaan` }
      ]
    );
  };

  const handleImportAchievement = async (parsedRows: any[]) => {
    const path = 'achievements';
    const promises = parsedRows.map(async (row) => {
      const studentVal = row['Nama atau NISN'] || row['nama atau nisn'] || '';
      const achievementName = row['Nama Prestasi'] || row['nama prestasi'] || '';
      const catStr = (row['Kategori'] || row['kategori'] || '').toLowerCase();
      const levelStr = (row['Tingkat'] || row['tingkat'] || '').toLowerCase();
      const date = row['Tanggal'] || row['tanggal'] || new Date().toISOString().split('T')[0];
      const description = row['Keterangan'] || row['keterangan'] || '';

      if (!studentVal || !achievementName) return;

      const student = students.find(s => s.name.toLowerCase() === studentVal.toLowerCase() || s.nisn === studentVal);
      if (!student) return;

      let category = AchievementCategory.AKADEMIK;
      if (catStr.includes('non')) {
        category = AchievementCategory.NON_AKADEMIK;
      }

      let level = AchievementLevel.SEKOLAH;
      if (levelStr.includes('kecamatan')) level = AchievementLevel.KECAMATAN;
      else if (levelStr.includes('kabupaten')) level = AchievementLevel.KABUPATEN;
      else if (levelStr.includes('provinsi')) level = AchievementLevel.PROVINSI;
      else if (levelStr.includes('nasional')) level = AchievementLevel.NASIONAL;
      else if (levelStr.includes('internasional')) level = AchievementLevel.INTERNASIONAL;

      const payload = {
        studentId: student.id || '',
        studentName: student.name,
        classId: selectedClass,
        achievementName,
        category,
        level,
        date,
        description,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, path), payload);
    });

    await Promise.all(promises);
    await sendRealtimeNotification(
      'Import Prestasi Massal',
      `Berhasil mengimpor ${parsedRows.length} log prestasi siswa kelas ${selectedClass}`,
      NotificationType.PRESTASI,
      selectedClass
    );
    await fetchAchievements();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Prestasi Murid</h3>
          <p className="text-xs text-slate-500 mt-1">Dokumentasi pencapaian, lomba, dan penghargaan siswa</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {currentUser.role !== UserRole.WALI_KELAS && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <Filter className="h-4 w-4 text-slate-500" />
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

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
          >
            <Printer className="h-4 w-4" />
            Cetak PDF
          </button>
          
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
          >
            <FileDown className="h-4 w-4" />
            Export Excel
          </button>

          {!isReadOnly && (
            <button
              onClick={() => setShowImporter(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
            >
              <FileSpreadsheet className="h-4 w-4 text-sky-600" />
              Import Template
            </button>
          )}

          {!isReadOnly && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-sm shadow-indigo-100"
            >
              <Plus className="h-4 w-4" />
              Tambah Prestasi
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari siswa atau penghargaan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
          />
        </div>
        <div className="text-xs text-slate-500">
          Total Prestasi: <strong className="text-slate-800">{filteredAchievements.length}</strong> penghargaan
        </div>
      </div>

      {/* List Grid */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-xs">Loading prestasi...</div>
        ) : paginatedAchievements.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">Belum ada prestasi tercatat.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-semibold uppercase tracking-wider bg-slate-50/30">
                <th className="py-3 px-6">Siswa</th>
                <th className="py-3 px-4">Nama Prestasi</th>
                <th className="py-3 px-4">Tingkat / Kategori</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700 text-xs">
              {paginatedAchievements.map((ach) => (
                <tr key={ach.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-4 px-6 font-semibold text-slate-800">
                    {ach.studentName}
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                      {ach.achievementName}
                    </div>
                    {ach.description && (
                      <div className="text-[10px] text-slate-500 mt-1 max-w-md line-clamp-1">
                        {ach.description}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 space-y-1">
                    <span className="inline-block bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {ach.level}
                    </span>
                    <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-full ml-1">
                      {ach.category}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-500">
                    {new Date(ach.date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenUpdate(ach)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleDelete(ach.id!, ach.studentName)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination controls */}
      <div className="p-4 border-t border-slate-50 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Halaman <strong className="text-slate-800">{page}</strong> dari <strong className="text-slate-800">{totalPages}</strong>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl disabled:opacity-40 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl disabled:opacity-40 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="text-sm font-bold text-slate-800">
                {formType === 'create' ? 'Tambah Prestasi Baru' : 'Edit Prestasi Murid'}
              </h4>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Pilih Siswa *</label>
                <select
                  required
                  disabled={formType === 'update'} // Cannot change student on update
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.nisn})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nama Prestasi / Lomba *</label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={formData.achievementName}
                  onChange={(e) => setFormData({ ...formData, achievementName: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                  placeholder="Contoh: Juara 1 Lomba Cerdas Cermat Matematika"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kategori *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as AchievementCategory })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 bg-white"
                  >
                    <option value={AchievementCategory.AKADEMIK}>Akademik</option>
                    <option value={AchievementCategory.NON_AKADEMIK}>Non-Akademik</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tingkat *</label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value as AchievementLevel })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 bg-white"
                  >
                    <option value={AchievementLevel.SEKOLAH}>Sekolah</option>
                    <option value={AchievementLevel.KECAMATAN}>Kecamatan</option>
                    <option value={AchievementLevel.KABUPATEN}>Kabupaten</option>
                    <option value={AchievementLevel.PROVINSI}>Provinsi</option>
                    <option value={AchievementLevel.NASIONAL}>Nasional</option>
                    <option value={AchievementLevel.INTERNASIONAL}>Internasional</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tanggal Perolehan *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Keterangan / Keterangan Tambahan</label>
                <textarea
                  maxLength={500}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 h-20 resize-none"
                  placeholder="Detail penghargaan, partner, sponsor dsb..."
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isReadOnly}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
                >
                  Simpan Prestasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImporter && (
        <TemplateImporter
          menuType="prestasi"
          classId={selectedClass}
          students={students}
          onImport={handleImportAchievement}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  );
}
