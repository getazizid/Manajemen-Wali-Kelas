import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Violation, ViolationCategory, Student, User, UserRole } from '../types';
import { exportToCSV, printData } from '../utils/export';
import { sendRealtimeNotification } from '../utils/notifications';
import { NotificationType } from '../types';
import { ShieldAlert, Plus, Search, Edit2, Trash2, Printer, FileDown, ChevronLeft, ChevronRight, X, Filter, FileSpreadsheet } from 'lucide-react';
import TemplateImporter from './TemplateImporter';

interface ViolationManagerProps {
  currentUser: User;
  classesList: string[];
}

export default function ViolationManager({ currentUser, classesList }: ViolationManagerProps) {
  const [violations, setViolations] = useState<Violation[]>([]);
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
    violationName: '',
    points: 5,
    category: ViolationCategory.RINGAN,
    date: new Date().toISOString().split('T')[0],
    actionTaken: ''
  });

  const isReadOnly = currentUser.role === UserRole.KEPALA_SEKOLAH;

  // Fetch student roster
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

  const fetchViolations = async () => {
    setLoading(true);
    const path = 'violations';
    try {
      let q = query(collection(db, path));
      if (selectedClass) {
        q = query(collection(db, path), where('classId', '==', selectedClass));
      }
      const snapshot = await getDocs(q);
      const list: Violation[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          studentId: data.studentId || '',
          studentName: data.studentName || '',
          classId: data.classId || '',
          violationName: data.violationName || '',
          points: data.points || 0,
          category: data.category as ViolationCategory,
          date: data.date || '',
          actionTaken: data.actionTaken || '',
          createdAt: data.createdAt || ''
        });
      });
      list.sort((a, b) => b.date.localeCompare(a.date));
      setViolations(list);
      setPage(1);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchViolations();
  }, [selectedClass]);

  // Search filter
  const filteredViolations = violations.filter(vio =>
    vio.studentName.toLowerCase().includes(search.toLowerCase()) ||
    vio.violationName.toLowerCase().includes(search.toLowerCase())
  );

  // Pagination helper
  const totalPages = Math.ceil(filteredViolations.length / itemsPerPage) || 1;
  const paginatedViolations = filteredViolations.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleOpenCreate = () => {
    setFormType('create');
    setFormData({
      studentId: students[0]?.id || '',
      violationName: '',
      points: 5,
      category: ViolationCategory.RINGAN,
      date: new Date().toISOString().split('T')[0],
      actionTaken: ''
    });
    setEditingId(null);
    setShowModal(true);
  };

  const handleOpenUpdate = (vio: Violation) => {
    setFormType('update');
    setFormData({
      studentId: vio.studentId,
      violationName: vio.violationName,
      points: vio.points,
      category: vio.category,
      date: vio.date,
      actionTaken: vio.actionTaken
    });
    setEditingId(vio.id || null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.violationName || formData.points < 1) {
      alert('Nama siswa, jenis pelanggaran, dan poin wajib diisi.');
      return;
    }

    const selectedStudent = students.find(s => s.id === formData.studentId);
    if (!selectedStudent) return;

    const path = 'violations';
    try {
      const payload = {
        studentId: formData.studentId,
        studentName: selectedStudent.name,
        classId: selectedClass,
        violationName: formData.violationName,
        points: formData.points,
        category: formData.category,
        date: formData.date,
        actionTaken: formData.actionTaken
      };

      if (formType === 'create') {
        await addDoc(collection(db, path), {
          ...payload,
          createdAt: new Date().toISOString()
        });

        await sendRealtimeNotification(
          'Pelanggaran Siswa Terbaca',
          `Siswa ${selectedStudent.name} tercatat melakukan pelanggaran: "${formData.violationName}" (+${formData.points} Poin)`,
          NotificationType.PELANGGARAN,
          selectedClass
        );
      } else if (formType === 'update' && editingId) {
        const original = violations.find(v => v.id === editingId);
        await setDoc(doc(db, path, editingId), {
          ...payload,
          createdAt: original?.createdAt || new Date().toISOString()
        }, { merge: true });

        await sendRealtimeNotification(
          'Data Pelanggaran Diperbarui',
          `Catatan pelanggaran ${selectedStudent.name} telah disunting`,
          NotificationType.PELANGGARAN,
          selectedClass
        );
      }
      setShowModal(false);
      fetchViolations();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus catatan pelanggaran untuk siswa ${name}?`)) return;
    const path = 'violations';
    try {
      await deleteDoc(doc(db, path, id));

      await sendRealtimeNotification(
        'Catatan Pelanggaran Dihapus',
        `Catatan pelanggaran siswa ${name} telah dihapus`,
        NotificationType.PELANGGARAN,
        selectedClass
      );

      fetchViolations();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleExport = () => {
    const headers = ['Nama Siswa', 'Jenis Pelanggaran', 'Poin', 'Kategori', 'Tanggal', 'Tindakan Sekolah'];
    const rows = filteredViolations.map(v => [
      v.studentName,
      v.violationName,
      String(v.points),
      v.category,
      v.date,
      v.actionTaken
    ]);
    exportToCSV(`Pelanggaran_Siswa_Kelas_${selectedClass}`, headers, rows);
  };

  const handlePrint = () => {
    const headers = ['No', 'Nama Siswa', 'Bentuk Pelanggaran', 'Kategori', 'Poin', 'Tindakan'];
    const rows = filteredViolations.map((v, idx) => [
      String(idx + 1),
      v.studentName,
      v.violationName,
      v.category,
      `${v.points} Poin`,
      v.actionTaken
    ]);
    printData(
      `Daftar Pelanggaran Siswa Kelas ${selectedClass}`,
      headers,
      rows,
      [
        { label: 'Kelas', value: selectedClass },
        { label: 'Total Pelanggaran', value: `${filteredViolations.length} kasus` }
      ]
    );
  };

  const handleImportViolation = async (parsedRows: any[]) => {
    const path = 'violations';
    const promises = parsedRows.map(async (row) => {
      const studentVal = row['Nama atau NISN'] || row['nama atau nisn'] || '';
      const violationName = row['Jenis Pelanggaran'] || row['jenis pelanggaran'] || '';
      const pointsStr = row['Poin'] || row['poin'] || '5';
      const points = parseInt(pointsStr) || 5;
      const catStr = (row['Kategori'] || row['kategori'] || '').toLowerCase();
      const date = row['Tanggal'] || row['tanggal'] || new Date().toISOString().split('T')[0];
      const actionTaken = row['Tindakan'] || row['tindakan'] || '';

      if (!studentVal || !violationName) return;

      const student = students.find(s => s.name.toLowerCase() === studentVal.toLowerCase() || s.nisn === studentVal);
      if (!student) return;

      let category = ViolationCategory.RINGAN;
      if (catStr.includes('sedang')) {
        category = ViolationCategory.SEDANG;
      } else if (catStr.includes('berat')) {
        category = ViolationCategory.BERAT;
      }

      const payload = {
        studentId: student.id || '',
        studentName: student.name,
        classId: selectedClass,
        violationName,
        points,
        category,
        date,
        actionTaken,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, path), payload);
    });

    await Promise.all(promises);
    await sendRealtimeNotification(
      'Import Pelanggaran Massal',
      `Berhasil mengimpor ${parsedRows.length} catatan kedisiplinan siswa kelas ${selectedClass}`,
      NotificationType.PELANGGARAN,
      selectedClass
    );
    await fetchViolations();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Pelanggaran Murid</h3>
          <p className="text-xs text-slate-500 mt-1">Pencatatan poin ketertiban, kedisiplinan, dan sanksi siswa</p>
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
              Tambah Pelanggaran
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
            placeholder="Cari siswa atau pelanggaran..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
          />
        </div>
        <div className="text-xs text-slate-500">
          Kasus Tercatat: <strong className="text-slate-800">{filteredViolations.length}</strong> kasus
        </div>
      </div>

      {/* Grid List */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-xs">Loading data pelanggaran...</div>
        ) : paginatedViolations.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">Bersih dari pelanggaran.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-semibold uppercase tracking-wider bg-slate-50/30">
                <th className="py-3 px-6">Siswa</th>
                <th className="py-3 px-4">Jenis Pelanggaran</th>
                <th className="py-3 px-4">Kategori / Poin</th>
                <th className="py-3 px-4">Tindakan / Sanksi</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700 text-xs">
              {paginatedViolations.map((vio) => (
                <tr key={vio.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-4 px-6 font-semibold text-slate-800">
                    {vio.studentName}
                  </td>
                  <td className="py-4 px-4 font-medium text-slate-800">
                    <div className="flex items-center gap-1.5 text-slate-800">
                      <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />
                      {vio.violationName}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Tanggal: {new Date(vio.date).toLocaleDateString('id-ID')}</div>
                  </td>
                  <td className="py-4 px-4 space-y-1">
                    <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      vio.category === ViolationCategory.RINGAN ? 'bg-amber-50 text-amber-700' :
                      vio.category === ViolationCategory.SEDANG ? 'bg-orange-50 text-orange-700' :
                      'bg-rose-50 text-rose-700'
                    }`}>
                      {vio.category}
                    </span>
                    <span className="inline-block bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded ml-1.5">
                      +{vio.points} Poin
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-600 max-w-xs truncate">
                    {vio.actionTaken || '-'}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenUpdate(vio)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleDelete(vio.id!, vio.studentName)}
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
                {formType === 'create' ? 'Tambah Catatan Pelanggaran' : 'Edit Catatan Pelanggaran'}
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
                  disabled={formType === 'update'}
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
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bentuk / Nama Pelanggaran *</label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={formData.violationName}
                  onChange={(e) => setFormData({ ...formData, violationName: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                  placeholder="Contoh: Menggunakan HP di jam pelajaran"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bobot Poin *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 5 })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kategori Pelanggaran *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ViolationCategory })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 bg-white"
                  >
                    <option value={ViolationCategory.RINGAN}>Ringan (1-10 Poin)</option>
                    <option value={ViolationCategory.SEDANG}>Sedang (11-25 Poin)</option>
                    <option value={ViolationCategory.BERAT}>Berat (&gt; 25 Poin)</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tanggal Kejadian *</label>
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
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tindakan / Sanksi Sekolah</label>
                <textarea
                  maxLength={250}
                  value={formData.actionTaken}
                  onChange={(e) => setFormData({ ...formData, actionTaken: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 h-20 resize-none"
                  placeholder="Contoh: Pembinaan lisan dan penulisan surat pernyataan patuh aturan sekolah."
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
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImporter && (
        <TemplateImporter
          menuType="pelanggaran"
          classId={selectedClass}
          students={students}
          onImport={handleImportViolation}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  );
}
