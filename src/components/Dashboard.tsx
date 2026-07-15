import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student, Achievement, Violation, Inventory, HomeVisit, User, UserRole, StudentGender, InventoryCondition } from '../types';
import { Users, Trophy, ShieldAlert, Archive, Home, HelpCircle, Activity, Award } from 'lucide-react';

interface DashboardProps {
  currentUser: User;
  classesList: string[];
}

export default function Dashboard({ currentUser, classesList }: DashboardProps) {
  const [selectedClass, setSelectedClass] = useState<string>(
    currentUser.role === UserRole.WALI_KELAS ? currentUser.classId || '' : 'all'
  );

  const [students, setStudents] = useState<Student[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [visits, setVisits] = useState<HomeVisit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Students
      const stdSnap = await getDocs(collection(db, 'students'));
      const stdList: Student[] = [];
      stdSnap.forEach(docSnap => {
        const d = docSnap.data();
        stdList.push({ id: docSnap.id, ...d } as Student);
      });

      // 2. Fetch Achievements
      const achSnap = await getDocs(collection(db, 'achievements'));
      const achList: Achievement[] = [];
      achSnap.forEach(docSnap => {
        const d = docSnap.data();
        achList.push({ id: docSnap.id, ...d } as Achievement);
      });

      // 3. Fetch Violations
      const vioSnap = await getDocs(collection(db, 'violations'));
      const vioList: Violation[] = [];
      vioSnap.forEach(docSnap => {
        const d = docSnap.data();
        vioList.push({ id: docSnap.id, ...d } as Violation);
      });

      // 4. Fetch Inventories
      const invSnap = await getDocs(collection(db, 'inventories'));
      const invList: Inventory[] = [];
      invSnap.forEach(docSnap => {
        const d = docSnap.data();
        invList.push({ id: docSnap.id, ...d } as Inventory);
      });

      // 5. Fetch Home Visits
      const visSnap = await getDocs(collection(db, 'home_visits'));
      const visList: HomeVisit[] = [];
      visSnap.forEach(docSnap => {
        const d = docSnap.data();
        visList.push({ id: docSnap.id, ...d } as HomeVisit);
      });

      // Apply initial filters based on selection
      const clsFilter = selectedClass === 'all' ? null : selectedClass;
      
      setStudents(clsFilter ? stdList.filter(s => s.classId === clsFilter) : stdList);
      setAchievements(clsFilter ? achList.filter(a => a.classId === clsFilter) : achList);
      setViolations(clsFilter ? vioList.filter(v => v.classId === clsFilter) : vioList);
      setInventories(clsFilter ? invList.filter(i => i.classId === clsFilter) : invList);
      setVisits(clsFilter ? visList.filter(v => v.classId === clsFilter) : visList);

    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClass]);

  // Calculations for stats
  const totalStudents = students.length;
  const maleCount = students.filter(s => s.gender === StudentGender.LAKI_LAKI).length;
  const femaleCount = students.filter(s => s.gender === StudentGender.PEREMPUAN).length;
  const malePercentage = totalStudents > 0 ? Math.round((maleCount / totalStudents) * 100) : 0;
  const femalePercentage = totalStudents > 0 ? Math.round((femaleCount / totalStudents) * 100) : 0;

  const totalAchievements = achievements.length;
  const totalViolations = violations.length;
  const totalViolationPoints = violations.reduce((acc, curr) => acc + (curr.points || 0), 0);

  // Inventories summary
  const totalInventoryCount = inventories.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const goodConditionCount = inventories.filter(i => i.condition === InventoryCondition.BAIK).reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const damagedCount = totalInventoryCount - goodConditionCount;
  const goodConditionPercentage = totalInventoryCount > 0 ? Math.round((goodConditionCount / totalInventoryCount) * 100) : 0;

  // Home visits count
  const totalVisits = visits.length;

  return (
    <div className="space-y-6">
      {/* Top Banner and class switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Ringkasan Analitik Kelas</h2>
          <p className="text-xs text-slate-500 mt-1">Sistem informasi monitoring kegiatan kelas terpadu</p>
        </div>

        {/* Filter selection */}
        {currentUser.role !== UserRole.WALI_KELAS && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-slate-500 font-medium">Pantau Kelas:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs bg-transparent focus:outline-none font-bold text-slate-700 cursor-pointer"
            >
              <option value="all">Semua Kelas</option>
              {classesList.map(c => (
                <option key={c} value={c}>Kelas {c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 text-xs">Memuat data statistik...</div>
      ) : (
        <>
          {/* Stats Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Stat: Siswa */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400">Total Siswa</span>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalStudents}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{maleCount} L / {femaleCount} P</p>
              </div>
            </div>

            {/* Stat: Prestasi */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400">Prestasi Murid</span>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalAchievements}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Penghargaan tercatat</p>
              </div>
            </div>

            {/* Stat: Pelanggaran */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400">Poin Pelanggaran</span>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalViolationPoints}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{totalViolations} kasus disiplin</p>
              </div>
            </div>

            {/* Stat: Home Visit */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <Home className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400">Home Visit Log</span>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalVisits}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Kunjungan terlaksana</p>
              </div>
            </div>

          </div>

          {/* Visual Analytics Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Gender and Inventory Ratios (Left/Middle block) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-6">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-600" />
                Rasio Demografis & Kelayakan Fasilitas
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                
                {/* Gender Ratio Card */}
                <div className="space-y-4 border border-slate-50 p-4 rounded-xl bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Proporsi Gender Siswa</h4>
                  
                  {totalStudents === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Belum ada siswa.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span className="font-semibold text-blue-700">Laki-laki ({maleCount})</span>
                        <span className="font-semibold text-pink-700">Perempuan ({femaleCount})</span>
                      </div>
                      
                      {/* Proporsi Bar */}
                      <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden flex">
                        <div className="bg-blue-500 transition-all duration-500" style={{ width: `${malePercentage}%` }}></div>
                        <div className="bg-pink-500 transition-all duration-500" style={{ width: `${femalePercentage}%` }}></div>
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>{malePercentage}%</span>
                        <span>{femalePercentage}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Inventory Condition Card */}
                <div className="space-y-4 border border-slate-50 p-4 rounded-xl bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Kondisi Barang Inventaris</h4>
                  
                  {totalInventoryCount === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Belum ada inventaris.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span className="font-semibold text-emerald-700">Baik ({goodConditionCount})</span>
                        <span className="font-semibold text-red-700">Rusak/Perbaikan ({damagedCount})</span>
                      </div>

                      {/* Bar */}
                      <div className="h-4 w-full bg-red-200 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${goodConditionPercentage}%` }}></div>
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Layak: {goodConditionPercentage}%</span>
                        <span>Total: {totalInventoryCount} unit</span>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Custom SVG Line graph showing violations trend or point summary */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Distribusi Poin Pelanggaran Siswa</h4>
                {violations.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center bg-slate-50 rounded-xl">Tidak ada pelanggaran tercatat.</p>
                ) : (
                  <div className="space-y-2">
                    {/* Render top 3 student violation leaders for BK follow-up guidance */}
                    {Array.from(
                      violations.reduce((acc, curr) => {
                        acc.set(curr.studentName, (acc.get(curr.studentName) || 0) + curr.points);
                        return acc;
                      }, new Map<string, number>()).entries()
                    )
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([name, pts]) => (
                        <div key={name} className="flex items-center justify-between text-xs bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                          <span className="font-semibold text-slate-700">{name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pts >= 25 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            Poin Akumulasi: {pts}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent achievements panel (Right block) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  Prestasi Unggulan Kelas
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">Daftar torehan medali dan apresiasi siswa terkini</p>

                <div className="mt-4 space-y-3.5">
                  {achievements.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed">
                      Belum ada prestasi tercatat.
                    </div>
                  ) : (
                    achievements.slice(0, 4).map((ach) => (
                      <div key={ach.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                        <Trophy className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{ach.achievementName}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">{ach.studentName} | Kelas {ach.classId}</p>
                          <span className="text-[8px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded mt-1.5 inline-block">
                            {ach.level}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="text-[10px] text-slate-400 border-t border-slate-50 pt-3 text-center">
                Pembaruan data otomatis sinkronisasi cloud real-time.
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
