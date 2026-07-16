import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { User, UserRole } from '../types';
import { Plus, Search, Edit2, Trash2, Shield, X, UserCog, Mail, FileSpreadsheet } from 'lucide-react';
import TemplateImporter from './TemplateImporter';

interface UserManagerProps {
  currentUser: User;
  classesList: string[];
}

export default function UserManager({ currentUser, classesList }: UserManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [showImporter, setShowImporter] = useState<boolean>(false);

  // Form states
  const [showModal, setShowModal] = useState<boolean>(false);
  const [formType, setFormType] = useState<'create' | 'update'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    uid: '', // Custom UID if manual creation, otherwise will use generated
    name: '',
    email: '',
    role: UserRole.WALI_KELAS,
    classId: '',
    password: '' // Added password field
  });

  const fetchUsers = async () => {
    setLoading(true);
    const path = 'users';
    try {
      const q = query(collection(db, path));
      const snapshot = await getDocs(q);
      const list: User[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || '',
          email: data.email || '',
          role: data.role as UserRole,
          classId: data.classId || '',
          createdAt: data.createdAt || ''
        });
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setUsers(list);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(usr =>
    usr.name.toLowerCase().includes(search.toLowerCase()) ||
    usr.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenCreate = () => {
    setFormType('create');
    setFormData({
      uid: '',
      name: '',
      email: '',
      role: UserRole.WALI_KELAS,
      classId: classesList[0] || '',
      password: '' // Reset password field
    });
    setEditingId(null);
    setShowModal(true);
  };

  const handleOpenUpdate = (usr: User) => {
    setFormType('update');
    setFormData({
      uid: usr.id || '',
      name: usr.name,
      email: usr.email,
      role: usr.role,
      classId: usr.classId || '',
      password: '' // Empty for editing
    });
    setEditingId(usr.id || null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      alert('Nama dan email wajib diisi.');
      return;
    }

    const path = 'users';
    try {
      let targetUid = editingId!;

      if (formType === 'create') {
        if (!formData.password || formData.password.length < 6) {
          alert('Password wajib diisi minimal 6 karakter.');
          return;
        }

        // Create user in Firebase Authentication using a temporary app instance
        // so that the current logged in Admin is NOT logged out!
        try {
          const { initializeApp } = await import('firebase/app');
          const { getAuth, createUserWithEmailAndPassword } = await import('firebase/auth');
          
          const tempAppName = `temp-app-${Date.now()}`;
          const tempApp = initializeApp(db.app.options, tempAppName);
          const tempAuth = getAuth(tempApp);
          
          const userCred = await createUserWithEmailAndPassword(tempAuth, formData.email, formData.password);
          targetUid = userCred.user.uid;
          await tempApp.delete();
        } catch (authErr: any) {
          console.error('Error creating Auth user:', authErr);
          alert(`Gagal membuat akun autentikasi: ${authErr.message || String(authErr)}`);
          return;
        }
      }

      const payload = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        classId: formData.role === UserRole.WALI_KELAS ? formData.classId : '',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, path, targetUid), payload, { merge: true });
      
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (id === currentUser.id) {
      alert('Anda tidak bisa menghapus akun Anda sendiri.');
      return;
    }
    if (!confirm(`Hapus pengguna ${name}?`)) return;
    
    const path = 'users';
    try {
      await deleteDoc(doc(db, path, id));
      fetchUsers();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleImportUsers = async (parsedRows: any[]) => {
    const path = 'users';
    const promises = parsedRows.map(async (row) => {
      const uidVal = row['UID'] || row['uid'] || '';
      const name = row['Nama Pengguna'] || row['nama pengguna'] || '';
      const email = row['Email'] || row['email'] || '';
      const roleStr = (row['Peran'] || row['peran'] || '').toLowerCase();
      const classId = row['Kelas'] || row['kelas'] || '';

      if (!name || !email) return;

      const targetUid = uidVal.trim() || `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      let role = UserRole.WALI_KELAS;
      if (roleStr.includes('admin')) {
        role = UserRole.ADMIN;
      } else if (roleStr.includes('kepala') || roleStr.includes('kepsek')) {
        role = UserRole.KEPALA_SEKOLAH;
      }

      const payload = {
        name,
        email,
        role,
        classId: role === UserRole.WALI_KELAS ? classId : '',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, path, targetUid), payload, { merge: true });
    });

    await Promise.all(promises);
    fetchUsers();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Manajemen Pengguna</h3>
          <p className="text-xs text-slate-500 mt-1">Daftarkan dan kelola peran admin, kepala sekolah, dan wali kelas</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowImporter(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-sky-600" />
            Import Template
          </button>
          
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-sm shadow-indigo-100"
          >
            <Plus className="h-4 w-4" />
            Tambah Pengguna
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
          />
        </div>
        <div className="text-xs text-slate-500">
          Total Terdaftar: <strong className="text-slate-800">{filteredUsers.length}</strong> pengguna
        </div>
      </div>

      {/* Table List */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-xs">Loading data pengguna...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">Tidak ada pengguna ditemukan.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-semibold uppercase tracking-wider bg-slate-50/30">
                <th className="py-3 px-6">Nama Pengguna</th>
                <th className="py-3 px-4">Email / Kontak</th>
                <th className="py-3 px-4">Hak Akses / Peran</th>
                <th className="py-3 px-4">Alokasi Kelas</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700 text-xs">
              {filteredUsers.map((usr) => (
                <tr key={usr.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-4 px-6 font-semibold text-slate-800 flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-indigo-600/70" />
                    {usr.name}
                    {usr.id === currentUser.id && (
                      <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded ml-1">Saya</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3 text-slate-400" />
                      {usr.email}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      usr.role === UserRole.ADMIN ? 'bg-red-50 text-red-700' :
                      usr.role === UserRole.KEPALA_SEKOLAH ? 'bg-indigo-50 text-indigo-700' :
                      'bg-indigo-50 text-indigo-700'
                    }`}>
                      <Shield className="h-2.5 w-2.5" />
                      {usr.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-700">
                    {usr.role === UserRole.WALI_KELAS ? `Kelas ${usr.classId || 'Belum Ditunjuk'}` : '-'}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenUpdate(usr)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(usr.id!, usr.name)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition"
                        disabled={usr.id === currentUser.id}
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

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="text-sm font-bold text-slate-800">
                {formType === 'create' ? 'Tambah Pengguna Baru' : 'Sunting Akun Pengguna'}
              </h4>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formType === 'create' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">User ID / UID (Opsional)</label>
                  <input
                    type="text"
                    value={formData.uid}
                    onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                    placeholder="Kosongkan untuk otomatis"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                  placeholder="Nama Lengkap dsb"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Pengguna *</label>
                <input
                  type="email"
                  required
                  maxLength={100}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                  placeholder="email@sekolah.sch.id"
                />
              </div>

              {formType === 'create' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 font-semibold"
                    placeholder="Minimal 6 karakter"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Peran / Hak Akses *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 bg-white"
                  >
                    <option value={UserRole.ADMIN}>Admin</option>
                    <option value={UserRole.KEPALA_SEKOLAH}>Kepala Sekolah</option>
                    <option value={UserRole.WALI_KELAS}>Wali Kelas</option>
                  </select>
                </div>

                {formData.role === UserRole.WALI_KELAS && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Pilih Kelas *</label>
                    <select
                      value={formData.classId}
                      onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 bg-white"
                    >
                      {classesList.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
                >
                  Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImporter && (
        <TemplateImporter
          menuType="users"
          onImport={handleImportUsers}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  );
}
