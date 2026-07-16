import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, UserRole } from './types';

// Components
import Login from './components/Login';
import NotificationCenter from './components/NotificationCenter';
import Dashboard from './components/Dashboard';
import StudentManager from './components/StudentManager';
import ClassOfficerManager from './components/ClassOfficerManager';
import SeatingManager from './components/SeatingManager';
import InventoryManager from './components/InventoryManager';
import AchievementManager from './components/AchievementManager';
import ViolationManager from './components/ViolationManager';
import HomeVisitManager from './components/HomeVisitManager';
import UserManager from './components/UserManager';
import ClassManager from './components/ClassManager';
import SettingsManager from './components/SettingsManager';

// Icons
import {
  School, LogOut, LayoutDashboard, Users, UserCheck, Armchair,
  Archive, Trophy, ShieldAlert, Home, UserCog, Menu, X, Settings
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [classesList, setClassesList] = useState<string[]>(['XI-RPL-1', 'XI-RPL-2', 'X-TKJ-1']);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [appName, setAppName] = useState<string>(localStorage.getItem('appName') || 'SIWALI');
  const [appDesc, setAppDesc] = useState<string>(localStorage.getItem('appDesc') || 'Manajemen Wali Kelas');

  useEffect(() => {
    // 0. Fetch App Settings
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'app'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          const name = data.appName || 'SIWALI';
          const desc = data.appDesc || 'Manajemen Wali Kelas';
          setAppName(name);
          setAppDesc(desc);
          localStorage.setItem('appName', name);
          localStorage.setItem('appDesc', desc);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };
    fetchSettings();

    // 1. Listen for standard Firebase Auth states
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setCurrentUser({
              id: firebaseUser.uid,
              name: data.name || firebaseUser.displayName || 'User',
              email: data.email || firebaseUser.email || '',
              role: data.role as UserRole,
              classId: data.classId || '',
              createdAt: data.createdAt || new Date().toISOString()
            });
          } else {
            // Profile fallback
            const isDefaultAdmin = firebaseUser.email?.toLowerCase() === 'abdulazizitn@gmail.com';
            setCurrentUser({
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: isDefaultAdmin ? UserRole.ADMIN : UserRole.WALI_KELAS,
              classId: isDefaultAdmin ? '' : 'XI-RPL-1',
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });

    // 2. Fetch list of available classes dynamically
    const fetchClasses = async () => {
      try {
        const snap = await getDocs(collection(db, 'classes'));
        if (snap.size > 0) {
          const ids: string[] = [];
          snap.forEach(d => ids.push(d.id));
          setClassesList(ids);
        }
      } catch (err) {
        console.error('Error fetching classes:', err);
      }
    };

    fetchClasses();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    document.title = appName;
    localStorage.setItem('appName', appName);
    localStorage.setItem('appDesc', appDesc);
  }, [appName, appDesc]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari aplikasi?')) {
      await signOut(auth);
      setCurrentUser(null);
      setActiveTab('dashboard');
    }
  };



  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-500 font-semibold mt-4">Inisialisasi Sistem Keamanan {appName}...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} appName={appName} appDesc={appDesc} />;
  }

  // Sidebar navigation menu items
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard Statistik', icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.KEPALA_SEKOLAH, UserRole.WALI_KELAS] },
    { id: 'siswa', label: 'Data Siswa', icon: Users, roles: [UserRole.ADMIN, UserRole.KEPALA_SEKOLAH, UserRole.WALI_KELAS] },
    { id: 'pengurus', label: 'Pengurus Kelas', icon: UserCheck, roles: [UserRole.ADMIN, UserRole.KEPALA_SEKOLAH, UserRole.WALI_KELAS] },
    { id: 'seating', label: 'Denah Tempat Duduk', icon: Armchair, roles: [UserRole.ADMIN, UserRole.KEPALA_SEKOLAH, UserRole.WALI_KELAS] },
    { id: 'inventaris', label: 'Inventaris Kelas', icon: Archive, roles: [UserRole.ADMIN, UserRole.KEPALA_SEKOLAH, UserRole.WALI_KELAS] },
    { id: 'prestasi', label: 'Prestasi Murid', icon: Trophy, roles: [UserRole.ADMIN, UserRole.KEPALA_SEKOLAH, UserRole.WALI_KELAS] },
    { id: 'pelanggaran', label: 'Pelanggaran Murid', icon: ShieldAlert, roles: [UserRole.ADMIN, UserRole.KEPALA_SEKOLAH, UserRole.WALI_KELAS] },
    { id: 'visit', label: 'Home Visit Log', icon: Home, roles: [UserRole.ADMIN, UserRole.KEPALA_SEKOLAH, UserRole.WALI_KELAS] },
    { id: 'classes', label: 'Manajemen Kelas', icon: School, roles: [UserRole.ADMIN] },
    { id: 'users', label: 'Manajemen Pengguna', icon: UserCog, roles: [UserRole.ADMIN] },
    { id: 'settings', label: 'Pengaturan Aplikasi', icon: Settings, roles: [UserRole.ADMIN] },
  ];

  const visibleMenuItems = menuItems.filter(item => item.roles.includes(currentUser.role));

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">

      {/* Dynamic Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-lg lg:hidden transition"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow shadow-indigo-100">
              <School className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 tracking-tight leading-tight">{appName}</h1>
              <p className="text-[9px] text-indigo-600 font-bold tracking-wider uppercase">
                {appDesc}
              </p>
            </div>
          </div>
        </div>

        {/* Right header controls */}
        <div className="flex items-center gap-3">
          {/* Real-time notifications */}
          <NotificationCenter classId={currentUser.role === UserRole.WALI_KELAS ? currentUser.classId : undefined} />

          {/* User profile dropdown summary */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl">
            <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-xs border border-indigo-200 uppercase">
              {currentUser.name.charAt(0)}
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-800 leading-none">{currentUser.name}</div>
              <div className="text-[9px] text-slate-500 font-mono mt-0.5 capitalize">{currentUser.role.replace('_', ' ')} {currentUser.classId && `| ${currentUser.classId}`}</div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
            title="Keluar Aplikasi"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="flex-1 flex relative">

        {/* Desktop Sidebar */}
        <aside className="w-64 bg-slate-900 text-slate-300 p-4 hidden lg:flex flex-col justify-between shrink-0 border-r border-slate-850">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 block mb-2">Navigasi Utama</span>
              <div className="space-y-1">
                {visibleMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                      <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* User profile card (Access Rights / Info) */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pengguna Aktif</p>
            <p className="text-xs font-semibold text-white mt-1">{currentUser.name}</p>
            <p className="text-[9px] text-indigo-400 font-mono mt-0.5 capitalize">{currentUser.role.replace('_', ' ')} {currentUser.classId && `| ${currentUser.classId}`}</p>
          </div>

        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
            <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 p-4 z-50 flex flex-col justify-between shadow-2xl animate-fade-in lg:hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-white tracking-wide uppercase">Navigasi Menu</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-1">
                  {visibleMenuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                      >
                        <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* User profile card (Access Rights / Info) */}
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mt-auto">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pengguna Aktif</p>
                <p className="text-xs font-semibold text-white mt-1">{currentUser.name}</p>
                <p className="text-[9px] text-indigo-400 font-mono mt-0.5 capitalize">{currentUser.role.replace('_', ' ')} {currentUser.classId && `| ${currentUser.classId}`}</p>
              </div>

            </aside>
          </>
        )}

        {/* Core Working Area */}
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 overflow-y-auto">
            {activeTab === 'dashboard' && <Dashboard currentUser={currentUser} classesList={classesList} />}
            {activeTab === 'siswa' && <StudentManager currentUser={currentUser} classesList={classesList} />}
            {activeTab === 'pengurus' && <ClassOfficerManager currentUser={currentUser} classesList={classesList} />}
            {activeTab === 'seating' && <SeatingManager currentUser={currentUser} classesList={classesList} />}
            {activeTab === 'inventaris' && <InventoryManager currentUser={currentUser} classesList={classesList} />}
            {activeTab === 'prestasi' && <AchievementManager currentUser={currentUser} classesList={classesList} />}
            {activeTab === 'pelanggaran' && <ViolationManager currentUser={currentUser} classesList={classesList} />}
            {activeTab === 'visit' && <HomeVisitManager currentUser={currentUser} classesList={classesList} />}
            {activeTab === 'classes' && currentUser.role === UserRole.ADMIN && <ClassManager currentUser={currentUser} onClassesChange={setClassesList} />}
            {activeTab === 'users' && currentUser.role === UserRole.ADMIN && <UserManager currentUser={currentUser} classesList={classesList} />}
            {activeTab === 'settings' && currentUser.role === UserRole.ADMIN && <SettingsManager appName={appName} appDesc={appDesc} onSettingsChange={(name, desc) => { setAppName(name); setAppDesc(desc); }} />}

            {activeTab === 'loading' && (
              <div className="py-40 text-center text-slate-400 text-xs">Memuat ulang modul...</div>
            )}
          </main>

          {/* Footer / PDF Bar */}
          <footer className="h-10 bg-slate-900 px-6 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-850 shrink-0 z-10">
            <div className="flex gap-4 font-mono">
              <span>Versi 1.0. Created by getaziz.id</span>
              <span>All rights reserved.</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Connected</span>
              <span className="hidden sm:inline text-slate-500">|</span>
              <button className="hover:text-white transition-colors">Bantuan & Panduan</button>
            </div>
          </footer>
        </div>

      </div>
    </div>
  );
}
