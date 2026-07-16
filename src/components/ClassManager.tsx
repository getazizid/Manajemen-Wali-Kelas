import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { User, UserRole } from '../types';
import { Plus, Search, Edit2, Trash2, X, School, UserCheck } from 'lucide-react';

interface ClassManagerProps {
  currentUser: User;
  onClassesChange: (updatedClasses: string[]) => void;
}

interface ClassData {
  id: string;
  name: string;
  homeroomTeacherId: string;
  homeroomTeacherName: string;
  createdAt?: string;
}

export default function ClassManager({ currentUser, onClassesChange }: ClassManagerProps) {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form states
  const [showModal, setShowModal] = useState<boolean>(false);
  const [formType, setFormType] = useState<'create' | 'update'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id: '', // Class Code (e.g. XI-RPL-1)
    name: '',
    homeroomTeacherId: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Classes
      const classesSnap = await getDocs(query(collection(db, 'classes')));
      const classesList: ClassData[] = [];
      classesSnap.forEach(docSnap => {
        const data = docSnap.data();
        classesList.push({
          id: docSnap.id,
          name: data.name || '',
          homeroomTeacherId: data.homeroomTeacherId || '',
          homeroomTeacherName: data.homeroomTeacherName || 'Belum Ditentukan'
        });
      });
      classesList.sort((a, b) => a.id.localeCompare(b.id));
      setClasses(classesList);

      // Report list of class IDs to parent state
      onClassesChange(classesList.map(c => c.id));

      // 2. Fetch Users with Role WALI_KELAS
      const usersSnap = await getDocs(query(collection(db, 'users')));
      const teachersList: User[] = [];
      usersSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.role === UserRole.WALI_KELAS) {
          teachersList.push({
            id: docSnap.id,
            name: data.name || '',
            email: data.email || '',
            role: data.role as UserRole,
            classId: data.classId || '',
            createdAt: data.createdAt || ''
          });
        }
      });
      teachersList.sort((a, b) => a.name.localeCompare(b.name));
      setTeachers(teachersList);

    } catch (error) {
      console.error('Error fetching class manager data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [search]);

  const filteredClasses = classes.filter(cls =>
    cls.id.toLowerCase().includes(search.toLowerCase()) ||
    cls.name.toLowerCase().includes(search.toLowerCase()) ||
    cls.homeroomTeacherName.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenCreate = () => {
    setFormType('create');
    setFormData({
      id: '',
      name: '',
      homeroomTeacherId: teachers[0]?.id || ''
    });
    setEditingId(null);
    setShowModal(true);
  };

  const handleOpenUpdate = (cls: ClassData) => {
    setFormType('update');
    setFormData({
      id: cls.id,
      name: cls.name,
      homeroomTeacherId: cls.homeroomTeacherId
    });
    setEditingId(cls.id);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id.trim() || !formData.name.trim()) {
      alert('Kode Kelas dan Nama Kelas wajib diisi.');
      return;
    }

    const classIdClean = formData.id.trim().toUpperCase();
    
    // Find teacher name from selected ID
    const selectedTeacher = teachers.find(t => t.id === formData.homeroomTeacherId);
    const teacherName = selectedTeacher ? selectedTeacher.name : 'Belum Ditentukan';

    const path = 'classes';
    try {
      const payload = {
        name: formData.name.trim(),
        homeroomTeacherId: formData.homeroomTeacherId,
        homeroomTeacherName: teacherName,
        updatedAt: new Date().toISOString()
      };

      if (formType === 'create') {
        // If creating, make sure ID is unique
        const exists = classes.some(c => c.id === classIdClean);
        if (exists) {
          alert('Kode Kelas sudah digunakan.');
          return;
        }
        await setDoc(doc(db, path, classIdClean), {
          ...payload,
          createdAt: new Date().toISOString()
        });
      } else {
        await setDoc(doc(db, path, editingId!), payload, { merge: true });
      }
      
      setShowModal(false);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus Kelas ${name} (${id})? Semua murid, denah kursi, dan data di kelas ini mungkin perlu disesuaikan.`)) return;
    
    const path = 'classes';
    try {
      await deleteDoc(doc(db, path, id));
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} kelas terpilih? Semua murid, denah kursi, dan data di kelas-kelas ini mungkin perlu disesuaikan.`)) return;
    const path = 'classes';
    try {
      setLoading(true);
      const promises = selectedIds.map(id => deleteDoc(doc(db, path, id)));
      await Promise.all(promises);
      setSelectedIds([]);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Manajemen Kelas</h3>
          <p className="text-xs text-slate-500 mt-1">Kelola data kelas dan tunjuk guru sebagai Wali Kelas</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-sm shadow-indigo-100 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Tambah Kelas
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kode kelas, nama kelas, atau wali kelas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
          />
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus Terpilih ({selectedIds.length})
            </button>
          )}
          <div className="text-xs text-slate-500">
            Total Kelas: <strong className="text-slate-800">{filteredClasses.length}</strong> kelas
          </div>
        </div>
      </div>

      {/* Table List */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-xs">Loading data kelas...</div>
        ) : filteredClasses.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">Tidak ada kelas ditemukan.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-semibold uppercase tracking-wider bg-slate-50/30">
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                    checked={filteredClasses.length > 0 && filteredClasses.every(cls => selectedIds.includes(cls.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const toAdd = filteredClasses.map(cls => cls.id).filter(id => !selectedIds.includes(id));
                        setSelectedIds([...selectedIds, ...toAdd]);
                      } else {
                        const toRemove = filteredClasses.map(cls => cls.id);
                        setSelectedIds(selectedIds.filter(id => !toRemove.includes(id)));
                      }
                    }}
                  />
                </th>
                <th className="py-3 px-6">Kode Kelas</th>
                <th className="py-3 px-4">Nama Lengkap Kelas</th>
                <th className="py-3 px-4">Wali Kelas</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700 text-xs">
              {filteredClasses.map((cls) => (
                <tr key={cls.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-4 px-4 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                      checked={selectedIds.includes(cls.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds([...selectedIds, cls.id]);
                        } else {
                          setSelectedIds(selectedIds.filter(id => id !== cls.id));
                        }
                      }}
                    />
                  </td>
                  <td className="py-4 px-6 font-bold text-indigo-600 flex items-center gap-2">
                    <School className="h-4 w-4 text-indigo-500/80" />
                    {cls.id}
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-800">
                    {cls.name}
                  </td>
                  <td className="py-4 px-4 text-slate-600 flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                    <div>
                      <p className="font-semibold text-slate-700">{cls.homeroomTeacherName}</p>
                      <p className="text-[10px] text-slate-400">ID: {cls.homeroomTeacherId || '-'}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenUpdate(cls)}
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg transition cursor-pointer"
                        title="Edit Kelas"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cls.id, cls.name)}
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition cursor-pointer"
                        title="Hapus Kelas"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal CRUD */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800">
                {formType === 'create' ? 'Tambah Kelas Baru' : 'Edit Data Kelas'}
              </h4>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Kode Kelas (Contoh: XI-RPL-1)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Kode Kelas"
                  disabled={formType === 'update'}
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 disabled:bg-slate-100/70 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nama Lengkap Kelas (Contoh: XI Rekayasa Perangkat Lunak 1)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap Kelas"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Wali Kelas
                </label>
                <select
                  value={formData.homeroomTeacherId}
                  onChange={(e) => setFormData({ ...formData, homeroomTeacherId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 font-semibold cursor-pointer"
                >
                  <option value="">-- Pilih Wali Kelas (Belum Ditentukan) --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
                {teachers.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1 font-medium">
                    Info: Daftarkan pengguna dengan peran "Wali Kelas" di Manajemen Pengguna terlebih dahulu agar muncul di pilihan ini.
                  </p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-sm shadow-indigo-100 cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
