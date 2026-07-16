import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student, StudentGender, User, UserRole } from '../types';
import { exportToCSV, printData } from '../utils/export';
import { sendRealtimeNotification } from '../utils/notifications';
import { NotificationType } from '../types';
import { Plus, Search, Edit2, Trash2, Printer, FileDown, ChevronLeft, ChevronRight, UserPlus, X, Filter, FileSpreadsheet } from 'lucide-react';
import TemplateImporter from './TemplateImporter';

interface StudentManagerProps {
  currentUser: User;
  classesList: string[];
}

export default function StudentManager({ currentUser, classesList }: StudentManagerProps) {
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
    name: '',
    nisn: '',
    gender: StudentGender.LAKI_LAKI,
    phone: '',
    email: '',
    parentName: '',
    parentPhone: '',
    classId: ''
  });

  const isReadOnly = currentUser.role === UserRole.KEPALA_SEKOLAH;

  const fetchStudents = async () => {
    setLoading(true);
    const path = 'students';
    try {
      let q = query(collection(db, path));
      if (selectedClass) {
        q = query(collection(db, path), where('classId', '==', selectedClass));
      }
      const snapshot = await getDocs(q);
      const list: Student[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || '',
          nisn: data.nisn || '',
          classId: data.classId || '',
          gender: data.gender as StudentGender,
          phone: data.phone || '',
          email: data.email || '',
          parentName: data.parentName || '',
          parentPhone: data.parentPhone || '',
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt || ''
        });
      });
      // Sort alphabetically by name
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);
      setPage(1);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedClass]);

  // Handle Search & Filter
  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(search.toLowerCase()) ||
    student.nisn.includes(search)
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
  const paginatedStudents = filteredStudents.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Form Handlers
  const handleOpenCreate = () => {
    setFormType('create');
    setFormData({
      name: '',
      nisn: '',
      gender: StudentGender.LAKI_LAKI,
      phone: '',
      email: '',
      parentName: '',
      parentPhone: '',
      classId: selectedClass || classesList[0] || ''
    });
    setEditingId(null);
    setShowModal(true);
  };

  const handleOpenUpdate = (std: Student) => {
    setFormType('update');
    setFormData({
      name: std.name,
      nisn: std.nisn,
      gender: std.gender,
      phone: std.phone,
      email: std.email,
      parentName: std.parentName,
      parentPhone: std.parentPhone,
      classId: std.classId || selectedClass || ''
    });
    setEditingId(std.id || null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.nisn || !formData.classId) {
      alert('Nama, NISN, dan Kelas wajib diisi.');
      return;
    }

    const path = 'students';
    try {
      if (formType === 'create') {
        const payload = {
          name: formData.name,
          nisn: formData.nisn,
          gender: formData.gender,
          phone: formData.phone,
          email: formData.email,
          parentName: formData.parentName,
          parentPhone: formData.parentPhone,
          classId: formData.classId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const docRef = await addDoc(collection(db, path), payload);
        
        await sendRealtimeNotification(
          'Siswa Baru Ditambahkan',
          `${formData.name} (${formData.nisn}) telah ditambahkan ke kelas ${formData.classId}`,
          NotificationType.SISWA,
          formData.classId
        );
      } else if (formType === 'update' && editingId) {
        const docRef = doc(db, path, editingId);
        const original = students.find(s => s.id === editingId);
        
        await setDoc(docRef, {
          name: formData.name,
          nisn: formData.nisn,
          gender: formData.gender,
          phone: formData.phone,
          email: formData.email,
          parentName: formData.parentName,
          parentPhone: formData.parentPhone,
          classId: formData.classId,
          createdAt: original?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        await sendRealtimeNotification(
          'Data Siswa Diperbarui',
          `Informasi untuk siswa ${formData.name} telah diperbarui`,
          NotificationType.SISWA,
          formData.classId
        );
      }
      setShowModal(false);
      fetchStudents();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus data siswa ${name}?`)) return;
    const path = 'students';
    try {
      await deleteDoc(doc(db, path, id));
      
      await sendRealtimeNotification(
        'Siswa Dihapus',
        `Siswa bernama ${name} telah dihapus dari kelas ${selectedClass}`,
        NotificationType.SISWA,
        selectedClass
      );
      
      fetchStudents();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // Export to Excel / CSV
  const handleExport = () => {
    const headers = ['Nama', 'NISN', 'Kelas', 'Jenis Kelamin', 'HP', 'Email', 'Nama Orang Tua', 'HP Orang Tua'];
    const rows = filteredStudents.map(s => [
      s.name,
      s.nisn,
      s.classId,
      s.gender,
      s.phone,
      s.email,
      s.parentName,
      s.parentPhone
    ]);
    exportToCSV(`Siswa_Kelas_${selectedClass}`, headers, rows);
  };

  // Print PDF
  const handlePrint = () => {
    const headers = ['No', 'Nama Siswa', 'NISN', 'Jenis Kelamin', 'HP Wali Murid', 'Orang Tua'];
    const rows = filteredStudents.map((s, idx) => [
      String(idx + 1),
      s.name,
      s.nisn,
      s.gender,
      s.parentPhone,
      s.parentName
    ]);
    printData(
      `Daftar Siswa Kelas ${selectedClass}`,
      headers,
      rows,
      [
        { label: 'Kelas', value: selectedClass },
        { label: 'Jumlah Siswa', value: `${filteredStudents.length} siswa` }
      ]
    );
  };

  const handleImportStudents = async (parsedRows: any[]) => {
    const path = 'students';
    const promises = parsedRows.map(async (row) => {
      const name = row['Nama'] || row['nama'] || '';
      const nisn = row['NISN'] || row['nisn'] || '';
      const genderStr = row['Jenis Kelamin'] || row['jenis kelamin'] || '';
      const gender = (genderStr.toLowerCase().includes('perempuan') || genderStr.toLowerCase() === 'p') 
        ? StudentGender.PEREMPUAN 
        : StudentGender.LAKI_LAKI;
      const phone = row['No HP'] || row['no hp'] || row['HP'] || row['hp'] || '';
      const email = row['Email'] || row['email'] || '';
      const parentName = row['Nama Orang Tua'] || row['nama orang tua'] || '';
      const parentPhone = row['No HP Orang Tua'] || row['no hp orang tua'] || '';

      if (!name || !nisn) return;

      const payload = {
        name,
        nisn,
        gender,
        phone,
        email,
        parentName,
        parentPhone,
        classId: selectedClass,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, path), payload);
    });

    await Promise.all(promises);
    await sendRealtimeNotification(
      'Import Siswa Massal',
      `Berhasil mengimpor ${parsedRows.length} siswa baru ke kelas ${selectedClass}`,
      NotificationType.SISWA,
      selectedClass
    );
    await fetchStudents();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Manajemen Data Siswa</h3>
          <p className="text-xs text-slate-500 mt-1">Kelola biodata, kontak, dan wali siswa</p>
        </div>
        
        {/* Actions bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class selection for admin or principal */}
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
              <UserPlus className="h-4 w-4" />
              Tambah Siswa
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
            placeholder="Cari nama siswa atau NISN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
          />
        </div>
        <div className="text-xs text-slate-500">
          Total: <strong className="text-slate-800">{filteredStudents.length}</strong> siswa
        </div>
      </div>

      {/* Grid List */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-xs">Loading data siswa...</div>
        ) : paginatedStudents.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">Tidak ada data siswa ditemukan.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-semibold uppercase tracking-wider bg-slate-50/30">
                <th className="py-3 px-6">Nama / NISN</th>
                <th className="py-3 px-4">Gender</th>
                <th className="py-3 px-4">Kontak</th>
                <th className="py-3 px-4">Wali Murid</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700 text-xs">
              {paginatedStudents.map((std) => (
                <tr key={std.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-4 px-6">
                    <div className="font-semibold text-slate-800">{std.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">NISN: {std.nisn}</div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      std.gender === StudentGender.LAKI_LAKI ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                    }`}>
                      {std.gender}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div>{std.phone || '-'}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{std.email || '-'}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-medium">{std.parentName || '-'}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{std.parentPhone || '-'}</div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenUpdate(std)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                        title="Edit Data"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleDelete(std.id!, std.name)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition"
                          title="Hapus Data"
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
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="text-sm font-bold text-slate-800">
                {formType === 'create' ? 'Tambah Siswa Baru' : 'Edit Biodata Siswa'}
              </h4>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                    placeholder="Nama Lengkap"
                  />
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">NISN *</label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={formData.nisn}
                    onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                    placeholder="Nomor Induk Siswa Nasional"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Jenis Kelamin *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as StudentGender })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 bg-white cursor-pointer"
                  >
                    <option value={StudentGender.LAKI_LAKI}>Laki-laki</option>
                    <option value={StudentGender.PEREMPUAN}>Perempuan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kelas *</label>
                  <select
                    disabled={currentUser.role === UserRole.WALI_KELAS}
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 bg-white disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {classesList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">No. HP Siswa</label>
                  <input
                    type="text"
                    maxLength={20}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                    placeholder="Contoh: 0812xxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Siswa</label>
                  <input
                    type="email"
                    maxLength={100}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                    placeholder="siswa@student.id"
                  />
                </div>

                <div className="col-span-2 border-t border-slate-100 pt-3">
                  <h5 className="text-xs font-bold text-slate-700 mb-3">Informasi Orang Tua / Wali</h5>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nama Orang Tua / Wali</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                    placeholder="Nama Ayah / Ibu / Wali"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">No. HP Orang Tua / Wali</label>
                  <input
                    type="text"
                    maxLength={20}
                    value={formData.parentPhone}
                    onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                    placeholder="No HP aktif orang tua"
                  />
                </div>
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
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImporter && (
        <TemplateImporter
          menuType="siswa"
          classId={selectedClass}
          onImport={handleImportStudents}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  );
}
