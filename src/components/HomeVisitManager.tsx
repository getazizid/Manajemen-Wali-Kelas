import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { HomeVisit, Student, User, UserRole } from '../types';
import { exportToCSV, printData } from '../utils/export';
import { sendRealtimeNotification } from '../utils/notifications';
import { NotificationType } from '../types';
import { Home, Plus, Search, Edit2, Trash2, Printer, FileDown, ChevronLeft, ChevronRight, X, Filter, Camera, FileSpreadsheet } from 'lucide-react';
import TemplateImporter from './TemplateImporter';

interface HomeVisitManagerProps {
  currentUser: User;
  classesList: string[];
}

export default function HomeVisitManager({ currentUser, classesList }: HomeVisitManagerProps) {
  const [visits, setVisits] = useState<HomeVisit[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>(
    currentUser.role === UserRole.WALI_KELAS ? currentUser.classId || '' : (classesList[0] || 'XI-RPL-1')
  );

  // Pagination
  const [page, setPage] = useState<number>(1);
  const itemsPerPage = 5;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form states
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showImporter, setShowImporter] = useState<boolean>(false);
  const [formType, setFormType] = useState<'create' | 'update'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    studentId: '',
    date: new Date().toISOString().split('T')[0],
    purpose: '',
    result: '',
    documentationUrl: ''
  });

  const isReadOnly = currentUser.role === UserRole.KEPALA_SEKOLAH;

  // Fetch students of the class
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

  const fetchVisits = async () => {
    setLoading(true);
    const path = 'home_visits';
    try {
      let q = query(collection(db, path));
      if (selectedClass) {
        q = query(collection(db, path), where('classId', '==', selectedClass));
      }
      const snapshot = await getDocs(q);
      const list: HomeVisit[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          studentId: data.studentId || '',
          studentName: data.studentName || '',
          classId: data.classId || '',
          date: data.date || '',
          purpose: data.purpose || '',
          result: data.result || '',
          documentationUrl: data.documentationUrl || '',
          createdAt: data.createdAt || ''
        });
      });
      list.sort((a, b) => b.date.localeCompare(a.date));
      setVisits(list);
      setPage(1);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchVisits();
  }, [selectedClass]);

  useEffect(() => {
    setSelectedIds([]);
  }, [selectedClass, search]);

  // Search filter
  const filteredVisits = visits.filter(vis =>
    vis.studentName.toLowerCase().includes(search.toLowerCase()) ||
    vis.purpose.toLowerCase().includes(search.toLowerCase())
  );

  // Pagination helper
  const totalPages = Math.ceil(filteredVisits.length / itemsPerPage) || 1;
  const paginatedVisits = filteredVisits.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleOpenCreate = () => {
    setFormType('create');
    setFormData({
      studentId: students[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      purpose: '',
      result: '',
      documentationUrl: ''
    });
    setEditingId(null);
    setShowModal(true);
  };

  const handleOpenUpdate = (vis: HomeVisit) => {
    setFormType('update');
    setFormData({
      studentId: vis.studentId,
      date: vis.date,
      purpose: vis.purpose,
      result: vis.result,
      documentationUrl: vis.documentationUrl || ''
    });
    setEditingId(vis.id || null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.purpose || !formData.result) {
      alert('Nama siswa, maksud tujuan, dan hasil kunjungan wajib diisi.');
      return;
    }

    const selectedStudent = students.find(s => s.id === formData.studentId);
    if (!selectedStudent) return;

    const path = 'home_visits';
    try {
      const payload = {
        studentId: formData.studentId,
        studentName: selectedStudent.name,
        classId: selectedClass,
        date: formData.date,
        purpose: formData.purpose,
        result: formData.result,
        documentationUrl: formData.documentationUrl
      };

      if (formType === 'create') {
        await addDoc(collection(db, path), {
          ...payload,
          createdAt: new Date().toISOString()
        });

        await sendRealtimeNotification(
          'Kunjungan Rumah (Home Visit)',
          `Wali Kelas melakukan kunjungan rumah ke kediaman siswa ${selectedStudent.name}`,
          NotificationType.VISIT,
          selectedClass
        );
      } else if (formType === 'update' && editingId) {
        const original = visits.find(v => v.id === editingId);
        await setDoc(doc(db, path, editingId), {
          ...payload,
          createdAt: original?.createdAt || new Date().toISOString()
        }, { merge: true });

        await sendRealtimeNotification(
          'Log Kunjungan Diperbarui',
          `Log kunjungan rumah siswa ${selectedStudent.name} telah diupdate`,
          NotificationType.VISIT,
          selectedClass
        );
      }
      setShowModal(false);
      fetchVisits();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus catatan kunjungan rumah siswa ${name}?`)) return;
    const path = 'home_visits';
    try {
      await deleteDoc(doc(db, path, id));

      await sendRealtimeNotification(
        'Log Kunjungan Dihapus',
        `Log kunjungan rumah untuk ${name} telah dihapus`,
        NotificationType.VISIT,
        selectedClass
      );

      fetchVisits();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} catatan kunjungan rumah yang terpilih?`)) return;
    const path = 'home_visits';
    try {
      setLoading(true);
      const promises = selectedIds.map(id => deleteDoc(doc(db, path, id)));
      await Promise.all(promises);

      await sendRealtimeNotification(
        'Log Kunjungan Dihapus Massal',
        `${selectedIds.length} catatan kunjungan rumah telah dihapus`,
        NotificationType.VISIT,
        selectedClass
      );

      setSelectedIds([]);
      fetchVisits();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ['Nama Siswa', 'Tanggal Kunjungan', 'Tujuan', 'Hasil Pembahasan', 'Link Foto'];
    const rows = filteredVisits.map(v => [
      v.studentName,
      v.date,
      v.purpose,
      v.result,
      v.documentationUrl || '-'
    ]);
    exportToCSV(`Kunjungan_Rumah_Kelas_${selectedClass}`, headers, rows);
  };

  const handlePrint = () => {
    const headers = ['No', 'Nama Siswa', 'Tanggal', 'Tujuan Kunjungan', 'Hasil Kunjungan & Kesepakatan'];
    const rows = filteredVisits.map((v, idx) => [
      String(idx + 1),
      v.studentName,
      v.date,
      v.purpose,
      v.result
    ]);
    printData(
      `Daftar Kunjungan Rumah (Home Visit) Kelas ${selectedClass}`,
      headers,
      rows,
      [
        { label: 'Kelas', value: selectedClass },
        { label: 'Total Kunjungan', value: `${filteredVisits.length} kali` }
      ]
    );
  };

  const handleImportVisit = async (parsedRows: any[]) => {
    const path = 'home_visits';
    const promises = parsedRows.map(async (row) => {
      const studentVal = row['Nama atau NISN'] || row['nama atau nisn'] || '';
      const date = row['Tanggal'] || row['tanggal'] || new Date().toISOString().split('T')[0];
      const purpose = row['Tujuan'] || row['tujuan'] || '';
      const result = row['Hasil'] || row['hasil'] || '';
      const documentationUrl = row['Link Foto'] || row['link foto'] || '';

      if (!studentVal || !purpose) return;

      const student = students.find(s => s.name.toLowerCase() === studentVal.toLowerCase() || s.nisn === studentVal);
      if (!student) return;

      const payload = {
        studentId: student.id || '',
        studentName: student.name,
        classId: selectedClass,
        date,
        purpose,
        result,
        documentationUrl,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, path), payload);
    });

    await Promise.all(promises);
    await sendRealtimeNotification(
      'Import Home Visit Massal',
      `Berhasil mengimpor ${parsedRows.length} catatan home visit kelas ${selectedClass}`,
      NotificationType.VISIT,
      selectedClass
    );
    await fetchVisits();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Home Visit (Kunjungan Rumah)</h3>
          <p className="text-xs text-slate-500 mt-1">Laporan monitoring dan kunjungan wali kelas ke rumah siswa</p>
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
              Tambah Kunjungan
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
            placeholder="Cari siswa atau tujuan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
          />
        </div>
        <div className="flex items-center gap-3">
          {!isReadOnly && paginatedVisits.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs text-slate-600">
              <input
                type="checkbox"
                id="select-all-visits"
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                checked={paginatedVisits.length > 0 && paginatedVisits.every(vis => selectedIds.includes(vis.id!))}
                onChange={(e) => {
                  if (e.target.checked) {
                    const toAdd = paginatedVisits.map(vis => vis.id!).filter(id => !selectedIds.includes(id));
                    setSelectedIds([...selectedIds, ...toAdd]);
                  } else {
                    const toRemove = paginatedVisits.map(vis => vis.id!);
                    setSelectedIds(selectedIds.filter(id => !toRemove.includes(id)));
                  }
                }}
              />
              <label htmlFor="select-all-visits" className="cursor-pointer select-none text-[11px] font-semibold text-slate-600">Pilih Semua</label>
            </div>
          )}
          {selectedIds.length > 0 && !isReadOnly && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus Terpilih ({selectedIds.length})
            </button>
          )}
          <div className="text-xs text-slate-500">
            Kunjungan Dilakukan: <strong className="text-slate-800">{filteredVisits.length}</strong> kali
          </div>
        </div>
      </div>

      {/* Grid List layout - cards are much better for Home Visits since they contain long texts and images! */}
      <div className="p-6">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-xs">Loading data kunjungan rumah...</div>
        ) : paginatedVisits.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">Belum ada kunjungan rumah tercatat.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paginatedVisits.map((vis) => (
              <div key={vis.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition">
                <div className="p-5 space-y-4">
                  {/* Photo / Documentation Placeholder */}
                  {vis.documentationUrl ? (
                    <div className="h-40 w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-50">
                      <img src={vis.documentationUrl} alt="Dokumentasi" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div className="h-10 w-full rounded-xl bg-slate-50 flex items-center justify-center gap-2 text-slate-400 border border-dashed border-slate-200">
                      <Camera className="h-4 w-4" />
                      <span className="text-[10px] font-medium">Tidak ada foto dokumentasi</span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {!isReadOnly && (
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                            checked={selectedIds.includes(vis.id!)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds([...selectedIds, vis.id!]);
                              } else {
                                setSelectedIds(selectedIds.filter(id => id !== vis.id));
                              }
                            }}
                          />
                        )}
                        <h4 className="text-xs font-bold text-slate-800">{vis.studentName}</h4>
                      </div>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-mono">
                        {new Date(vis.date).toLocaleDateString('id-ID')}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Kunjungan Rumah (Home Visit)</p>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Maksud & Tujuan:</span>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">{vis.purpose}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Hasil Kunjungan & Kesepakatan:</span>
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">{vis.result}</p>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    onClick={() => handleOpenUpdate(vis)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </button>
                  {!isReadOnly && (
                    <button
                      onClick={() => handleDelete(vis.id!, vis.studentName)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-100 rounded-xl text-[11px] font-semibold text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
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
                {formType === 'create' ? 'Tambah Log Kunjungan' : 'Edit Log Kunjungan'}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tanggal Kunjungan *</label>
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
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Maksud & Tujuan Kunjungan *</label>
                <input
                  type="text"
                  required
                  maxLength={250}
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                  placeholder="Contoh: Konseling penurunan motivasi belajar siswa"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hasil Kunjungan & Tindak Lanjut *</label>
                <textarea
                  required
                  maxLength={1000}
                  value={formData.result}
                  onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 h-24 resize-none"
                  placeholder="Ceritakan respon orang tua, kesepakatan pembinaan, dsb..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">URL Foto Dokumentasi (Opsional)</label>
                <input
                  type="text"
                  maxLength={500}
                  value={formData.documentationUrl}
                  onChange={(e) => setFormData({ ...formData, documentationUrl: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                  placeholder="Link gambar Unsplash / dokumentasi eksternal"
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
                  Simpan Log Kunjungan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImporter && (
        <TemplateImporter
          menuType="visit"
          classId={selectedClass}
          students={students}
          onImport={handleImportVisit}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  );
}
