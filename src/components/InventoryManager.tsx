import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Inventory, InventoryCondition, User, UserRole } from '../types';
import { exportToCSV, printData } from '../utils/export';
import { sendRealtimeNotification } from '../utils/notifications';
import { NotificationType } from '../types';
import { Plus, Search, Edit2, Trash2, Printer, FileDown, ChevronLeft, ChevronRight, Archive, X, Filter, FileSpreadsheet } from 'lucide-react';
import TemplateImporter from './TemplateImporter';

interface InventoryManagerProps {
  currentUser: User;
  classesList: string[];
}

export default function InventoryManager({ currentUser, classesList }: InventoryManagerProps) {
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>(
    currentUser.role === UserRole.WALI_KELAS ? currentUser.classId || '' : (classesList[0] || 'XI-RPL-1')
  );

  // Pagination
  const [page, setPage] = useState<number>(1);
  const itemsPerPage = 6;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form states
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showImporter, setShowImporter] = useState<boolean>(false);
  const [formType, setFormType] = useState<'create' | 'update'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    itemName: '',
    quantity: 1,
    condition: InventoryCondition.BAIK
  });

  const isReadOnly = currentUser.role === UserRole.KEPALA_SEKOLAH;

  const fetchInventories = async () => {
    setLoading(true);
    const path = 'inventories';
    try {
      let q = query(collection(db, path));
      if (selectedClass) {
        q = query(collection(db, path), where('classId', '==', selectedClass));
      }
      const snapshot = await getDocs(q);
      const list: Inventory[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          classId: data.classId || '',
          itemName: data.itemName || '',
          quantity: data.quantity || 0,
          condition: data.condition as InventoryCondition,
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt || ''
        });
      });
      list.sort((a, b) => a.itemName.localeCompare(b.itemName));
      setInventories(list);
      setPage(1);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventories();
  }, [selectedClass]);

  useEffect(() => {
    setSelectedIds([]);
  }, [selectedClass, search]);

  // Search filter
  const filteredInventories = inventories.filter(inv =>
    inv.itemName.toLowerCase().includes(search.toLowerCase())
  );

  // Pagination helper
  const totalPages = Math.ceil(filteredInventories.length / itemsPerPage) || 1;
  const paginatedInventories = filteredInventories.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleOpenCreate = () => {
    setFormType('create');
    setFormData({
      itemName: '',
      quantity: 1,
      condition: InventoryCondition.BAIK
    });
    setEditingId(null);
    setShowModal(true);
  };

  const handleOpenUpdate = (inv: Inventory) => {
    setFormType('update');
    setFormData({
      itemName: inv.itemName,
      quantity: inv.quantity,
      condition: inv.condition
    });
    setEditingId(inv.id || null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName || formData.quantity < 1) {
      alert('Nama barang dan jumlah minimal wajib valid.');
      return;
    }

    const path = 'inventories';
    try {
      if (formType === 'create') {
        await addDoc(collection(db, path), {
          ...formData,
          classId: selectedClass,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await sendRealtimeNotification(
          'Inventaris Ditambahkan',
          `Barang baru "${formData.itemName}" (${formData.quantity} unit) ditambahkan ke kelas ${selectedClass}`,
          NotificationType.INVENTARIS,
          selectedClass
        );
      } else if (formType === 'update' && editingId) {
        const original = inventories.find(i => i.id === editingId);
        await setDoc(doc(db, path, editingId), {
          ...formData,
          classId: selectedClass,
          createdAt: original?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        await sendRealtimeNotification(
          'Inventaris Diperbarui',
          `Data barang "${formData.itemName}" telah diperbarui`,
          NotificationType.INVENTARIS,
          selectedClass
        );
      }
      setShowModal(false);
      fetchInventories();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus barang "${name}" dari inventaris?`)) return;
    const path = 'inventories';
    try {
      await deleteDoc(doc(db, path, id));
      
      await sendRealtimeNotification(
        'Inventaris Dihapus',
        `Barang "${name}" telah dihapus dari log inventaris kelas ${selectedClass}`,
        NotificationType.INVENTARIS,
        selectedClass
      );

      fetchInventories();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} barang inventaris yang terpilih?`)) return;
    const path = 'inventories';
    try {
      setLoading(true);
      const promises = selectedIds.map(id => deleteDoc(doc(db, path, id)));
      await Promise.all(promises);

      await sendRealtimeNotification(
        'Inventaris Dihapus Massal',
        `${selectedIds.length} barang inventaris telah dihapus`,
        NotificationType.INVENTARIS,
        selectedClass
      );

      setSelectedIds([]);
      fetchInventories();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ['Nama Barang', 'Jumlah', 'Kondisi', 'Terakhir Diupdate'];
    const rows = filteredInventories.map(i => [
      i.itemName,
      String(i.quantity),
      i.condition,
      new Date(i.updatedAt).toLocaleDateString('id-ID')
    ]);
    exportToCSV(`Inventaris_Kelas_${selectedClass}`, headers, rows);
  };

  const handlePrint = () => {
    const headers = ['No', 'Nama Barang / Fasilitas', 'Jumlah (Unit)', 'Kondisi Kelayakan'];
    const rows = filteredInventories.map((i, idx) => [
      String(idx + 1),
      i.itemName,
      String(i.quantity),
      i.condition
    ]);
    printData(
      `Daftar Inventaris Kelas ${selectedClass}`,
      headers,
      rows,
      [
        { label: 'Kelas', value: selectedClass },
        { label: 'Total Jenis Barang', value: `${filteredInventories.length} item` }
      ]
    );
  };

  const handleImportInventory = async (parsedRows: any[]) => {
    const path = 'inventories';
    const promises = parsedRows.map(async (row) => {
      const itemName = row['Nama Barang'] || row['nama barang'] || '';
      const qtyStr = row['Jumlah'] || row['jumlah'] || '1';
      const quantity = parseInt(qtyStr) || 1;
      const condStr = (row['Kondisi'] || row['kondisi'] || '').toLowerCase();
      
      let condition = InventoryCondition.BAIK;
      if (condStr.includes('ringan')) {
        condition = InventoryCondition.RUSAK_RINGAN;
      } else if (condStr.includes('berat') || condStr.includes('rusak')) {
        condition = InventoryCondition.RUSAK_BERAT;
      }

      if (!itemName) return;

      const payload = {
        itemName,
        quantity,
        condition,
        classId: selectedClass,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, path), payload);
    });

    await Promise.all(promises);
    await sendRealtimeNotification(
      'Import Inventaris Massal',
      `Berhasil mengimpor ${parsedRows.length} sarana baru ke inventaris kelas ${selectedClass}`,
      NotificationType.INVENTARIS,
      selectedClass
    );
    await fetchInventories();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Inventaris Kelas</h3>
          <p className="text-xs text-slate-500 mt-1">Kelola fasilitas, elektronik, dan sarana prasarana kelas</p>
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
              Tambah Inventaris
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
            placeholder="Cari nama barang..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
          />
        </div>
        <div className="flex items-center gap-3">
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
            Total Fasilitas: <strong className="text-slate-800">{filteredInventories.length}</strong> jenis
          </div>
        </div>
      </div>

      {/* Grid List */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-xs">Loading inventaris kelas...</div>
        ) : paginatedInventories.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">Tidak ada barang terdaftar.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-semibold uppercase tracking-wider bg-slate-50/30">
                {!isReadOnly && (
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                      checked={paginatedInventories.length > 0 && paginatedInventories.every(inv => selectedIds.includes(inv.id!))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const toAdd = paginatedInventories.map(inv => inv.id!).filter(id => !selectedIds.includes(id));
                          setSelectedIds([...selectedIds, ...toAdd]);
                        } else {
                          const toRemove = paginatedInventories.map(inv => inv.id!);
                          setSelectedIds(selectedIds.filter(id => !toRemove.includes(id)));
                        }
                      }}
                    />
                  </th>
                )}
                <th className="py-3 px-6">Nama Fasilitas / Barang</th>
                <th className="py-3 px-4">Jumlah (Unit)</th>
                <th className="py-3 px-4">Kondisi Kelayakan</th>
                <th className="py-3 px-4">Pembaharuan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700 text-xs">
              {paginatedInventories.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                  {!isReadOnly && (
                    <td className="py-4 px-4 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                        checked={selectedIds.includes(inv.id!)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, inv.id!]);
                          } else {
                            setSelectedIds(selectedIds.filter(id => id !== inv.id));
                          }
                        }}
                      />
                    </td>
                  )}
                  <td className="py-4 px-6 font-semibold text-slate-800">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4 text-indigo-600/70" />
                      {inv.itemName}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-bold text-slate-900">
                    {inv.quantity} unit
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                      inv.condition === InventoryCondition.BAIK ? 'bg-emerald-50 text-emerald-700' :
                      inv.condition === InventoryCondition.RUSAK_RINGAN ? 'bg-amber-50 text-amber-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {inv.condition}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-500">
                    {new Date(inv.updatedAt).toLocaleDateString('id-ID')}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenUpdate(inv)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleDelete(inv.id!, inv.itemName)}
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
                {formType === 'create' ? 'Tambah Inventaris Baru' : 'Edit Inventaris Kelas'}
              </h4>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nama Barang / Fasilitas *</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={formData.itemName}
                  onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                  placeholder="Contoh: LCD Proyektor, AC Split, Papan Tulis"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Jumlah (Unit) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kondisi Kelayakan *</label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value as InventoryCondition })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 bg-white"
                  >
                    <option value={InventoryCondition.BAIK}>Baik / Layak Pakai</option>
                    <option value={InventoryCondition.RUSAK_RINGAN}>Rusak Ringan</option>
                    <option value={InventoryCondition.RUSAK_BERAT}>Rusak Berat</option>
                  </select>
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
                  Simpan Barang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImporter && (
        <TemplateImporter
          menuType="inventaris"
          classId={selectedClass}
          onImport={handleImportInventory}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  );
}
