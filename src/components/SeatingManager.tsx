import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SeatingArrangement, Seat, Student, User, UserRole } from '../types';
import { sendRealtimeNotification } from '../utils/notifications';
import { NotificationType } from '../types';
import { Grid, Save, UserX, Armchair, RotateCcw, LayoutGrid, FileSpreadsheet } from 'lucide-react';
import TemplateImporter from './TemplateImporter';

interface SeatingManagerProps {
  currentUser: User;
  classesList: string[];
}

export default function SeatingManager({ currentUser, classesList }: SeatingManagerProps) {
  const [arrangement, setArrangement] = useState<SeatingArrangement | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showImporter, setShowImporter] = useState<boolean>(false);
  const [selectedClass, setSelectedClass] = useState<string>(
    currentUser.role === UserRole.WALI_KELAS ? currentUser.classId || '' : (classesList[0] || 'XI-RPL-1')
  );

  // Grid sizing
  const [rows, setRows] = useState<number>(4);
  const [cols, setCols] = useState<number>(4);
  const [seats, setSeats] = useState<Seat[]>([]);

  // Dialog state
  const [activeSeat, setActiveSeat] = useState<{ row: number; col: number } | null>(null);

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

  // Fetch seating arrangement
  const fetchArrangement = async () => {
    setLoading(true);
    const path = 'seating_arrangements';
    try {
      const docRef = doc(db, path, selectedClass);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as SeatingArrangement;
        setArrangement(data);
        setRows(data.rows || 4);
        setCols(data.cols || 4);
        setSeats(data.seats || []);
      } else {
        setArrangement(null);
        setRows(4);
        setCols(4);
        setSeats([]);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${path}/${selectedClass}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchArrangement();
  }, [selectedClass]);

  // Retrieve student in a specific seat
  const getSeatStudent = (row: number, col: number): Seat | undefined => {
    return seats.find(s => s.row === row && s.col === col);
  };

  // Assign a student to a seat
  const handleAssignSeat = (studentId: string, studentName: string) => {
    if (!activeSeat) return;
    const { row, col } = activeSeat;

    // Filter out previous assignment of the student (no duplicate seats)
    let updatedSeats = seats.filter(s => s.studentId !== studentId);

    // If another student was in this row/col, they will be overwritten because we filter it out too
    updatedSeats = updatedSeats.filter(s => !(s.row === row && s.col === col));

    if (studentId !== '') {
      updatedSeats.push({
        row,
        col,
        studentId,
        studentName
      });
    }

    setSeats(updatedSeats);
    setActiveSeat(null);
  };

  // Clear single seat
  const handleClearSeat = (row: number, col: number) => {
    if (isReadOnly) return;
    setSeats(seats.filter(s => !(s.row === row && s.col === col)));
  };

  // Reset entire grid
  const handleReset = () => {
    if (isReadOnly) return;
    if (confirm('Apakah Anda yakin ingin mereset seluruh denah tempat duduk?')) {
      setSeats([]);
    }
  };

  // Save changes to Firestore
  const handleSave = async () => {
    if (isReadOnly) return;
    const path = 'seating_arrangements';
    try {
      const payload: SeatingArrangement = {
        classId: selectedClass,
        rows,
        cols,
        seats,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, path, selectedClass), payload);

      await sendRealtimeNotification(
        'Denah Kelas Diperbarui',
        `Denah tempat duduk kelas ${selectedClass} telah berhasil ditata ulang`,
        NotificationType.SISWA,
        selectedClass
      );

      setArrangement(payload);
      alert('Denah tempat duduk berhasil disimpan!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  // Auto layout seats linearly for quick fill
  const handleAutoFill = () => {
    if (isReadOnly) return;
    const filled: Seat[] = [];
    let studentIndex = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (studentIndex < students.length) {
          filled.push({
            row: r,
            col: c,
            studentId: students[studentIndex].id || '',
            studentName: students[studentIndex].name
          });
          studentIndex++;
        }
      }
    }
    setSeats(filled);
  };

  // Students already seated (helper)
  const isStudentSeated = (studentId: string): boolean => {
    return seats.some(s => s.studentId === studentId);
  };

  const handleImportSeating = async (parsedRows: any[]) => {
    const updatedSeats: Seat[] = [];
    parsedRows.forEach(row => {
      const rowVal = parseInt(row['Baris'] || row['baris']);
      const colVal = parseInt(row['Kolom'] || row['kolom']);
      const studentVal = row['Nama atau NISN'] || row['nama atau nisn'] || '';

      if (isNaN(rowVal) || isNaN(colVal) || !studentVal) return;

      const student = students.find(s => s.name.toLowerCase() === studentVal.toLowerCase() || s.nisn === studentVal);
      if (student) {
        updatedSeats.push({
          row: rowVal,
          col: colVal,
          studentId: student.id || '',
          studentName: student.name
        });
      }
    });

    let maxRow = rows;
    let maxCol = cols;
    updatedSeats.forEach(s => {
      if (s.row + 1 > maxRow) maxRow = s.row + 1;
      if (s.col + 1 > maxCol) maxCol = s.col + 1;
    });

    if (maxRow > 6) maxRow = 6;
    if (maxCol > 6) maxCol = 6;

    const filteredSeats = updatedSeats.filter(s => s.row < maxRow && s.col < maxCol);

    const path = 'seating_arrangements';
    const payload: SeatingArrangement = {
      classId: selectedClass,
      rows: maxRow,
      cols: maxCol,
      seats: filteredSeats,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, path, selectedClass), payload);

    await sendRealtimeNotification(
      'Denah Kelas Diimpor',
      `Denah tempat duduk kelas ${selectedClass} berhasil diimpor melalui template`,
      NotificationType.SISWA,
      selectedClass
    );

    setRows(maxRow);
    setCols(maxCol);
    setSeats(filteredSeats);
    setArrangement(payload);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Denah Tempat Duduk</h3>
          <p className="text-xs text-slate-500 mt-1">Atur denah dan layout tata letak meja siswa</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
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

          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImporter(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition"
              >
                <FileSpreadsheet className="h-4 w-4 text-sky-600" />
                Import Template
              </button>
              <button
                onClick={handleAutoFill}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition"
              >
                Isi Otomatis
              </button>
              <button
                onClick={handleReset}
                className="p-1.5 border border-slate-200 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl transition"
                title="Reset Denah"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 text-xs">Loading denah kelas...</div>
      ) : (
        <div className="p-6">
          {/* Grid Settings */}
          {!isReadOnly && (
            <div className="mb-6 flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-semibold text-slate-700">Dimensi Meja:</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  Baris:
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={rows}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 4;
                      setRows(val);
                      // clear seats out of bounds
                      setSeats(seats.filter(s => s.row < val));
                    }}
                    className="w-12 px-2 py-1 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 bg-white"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  Kolom:
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={cols}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 4;
                      setCols(val);
                      // clear seats out of bounds
                      setSeats(seats.filter(s => s.col < val));
                    }}
                    className="w-12 px-2 py-1 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 bg-white"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Interactive Board View */}
          <div className="max-w-3xl mx-auto border border-slate-200 p-6 sm:p-8 rounded-3xl bg-slate-50 shadow-inner">
            {/* Board / Papan Tulis Indicator */}
            <div className="w-full max-w-sm mx-auto mb-10 py-2.5 bg-slate-800 text-white text-center rounded-lg shadow-sm text-xs font-bold uppercase tracking-widest">
              Papan Tulis / Meja Guru
            </div>

            {/* Grid Layout */}
            <div 
              className="grid gap-4 sm:gap-6 mx-auto justify-center"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(80px, 150px))`
              }}
            >
              {Array.from({ length: rows }).map((_, r) => (
                Array.from({ length: cols }).map((_, c) => {
                  const assignment = getSeatStudent(r, c);
                  return (
                    <div 
                      key={`${r}-${c}`}
                      className={`relative group h-24 rounded-2xl flex flex-col justify-between p-3 border transition-all duration-150 cursor-pointer ${
                        assignment 
                          ? 'bg-white border-indigo-200 shadow-sm hover:border-indigo-400' 
                          : 'bg-white/40 border-dashed border-slate-200 hover:bg-white hover:border-slate-300'
                      }`}
                      onClick={() => !isReadOnly && setActiveSeat({ row: r, col: c })}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                          B{r + 1}-K{c + 1}
                        </span>
                        {assignment && !isReadOnly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearSeat(r, c);
                            }}
                            className="hidden group-hover:block p-0.5 rounded bg-red-50 text-red-500 hover:bg-red-100 transition"
                            title="Kosongkan Kursi"
                          >
                            <UserX className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {assignment ? (
                        <div className="mt-1 text-center">
                          <p className="text-[10px] font-bold text-slate-800 line-clamp-2 leading-tight">
                            {assignment.studentName}
                          </p>
                          <span className="text-[8px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono mt-1 inline-block">
                            Terisi
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-2 text-slate-300">
                          <Armchair className="h-5 w-5" />
                          <span className="text-[9px] mt-1">Kosong</span>
                        </div>
                      )}
                    </div>
                  );
                })
              ))}
            </div>
          </div>

          {/* Bottom Save Action */}
          {!isReadOnly && (
            <div className="mt-8 flex justify-end gap-3 max-w-3xl mx-auto border-t border-slate-100 pt-5">
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-sm shadow-indigo-100"
              >
                <Save className="h-4 w-4" />
                Simpan Denah Kelas
              </button>
            </div>
          )}
        </div>
      )}

      {/* Select Student Modal */}
      {activeSeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="text-xs font-bold text-slate-800">
                Pilih Siswa untuk Baris {activeSeat.row + 1}, Kolom {activeSeat.col + 1}
              </h4>
              <button onClick={() => setActiveSeat(null)} className="text-slate-400 hover:text-slate-600">
                <UserX className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto space-y-1">
              {/* Option to clear seat */}
              <button
                onClick={() => handleAssignSeat('', '')}
                className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                Kosongkan Kursi
              </button>

              <div className="border-t border-slate-100 my-1.5"></div>

              {students.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Belum ada siswa di kelas ini.</p>
              ) : (
                students.map(s => {
                  const seated = isStudentSeated(s.id || '');
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleAssignSeat(s.id || '', s.name)}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition flex items-center justify-between ${
                        seated 
                          ? 'text-slate-400 hover:bg-slate-50 font-normal line-through' 
                          : 'text-slate-700 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <span>{s.name}</span>
                      {seated && <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Duduk</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {showImporter && (
        <TemplateImporter
          menuType="seating"
          classId={selectedClass}
          students={students}
          onImport={handleImportSeating}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  );
}
