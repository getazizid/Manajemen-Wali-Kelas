import { useState } from 'react';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { User, UserRole } from '../types';
import { School, LogIn, ShieldAlert, Mail, Lock } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  appName: string;
  appDesc: string;
}

export default function Login({ onLoginSuccess, appName, appDesc }: LoginProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Email/Password login states
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // Sign in using Email/Password
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const firebaseUser = result.user;
      
      // Fetch user profile from Firestore
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        onLoginSuccess({
          id: firebaseUser.uid,
          name: data.name || 'User',
          email: data.email || firebaseUser.email || '',
          role: data.role as UserRole,
          classId: data.classId || '',
          createdAt: data.createdAt || new Date().toISOString()
        });
      } else {
        // Fallback profile if Firestore is not updated yet
        onLoginSuccess({
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || '',
          role: UserRole.WALI_KELAS,
          classId: 'XI-RPL-1',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email atau password salah. Pastikan akun sudah dibuat oleh Admin.');
      } else {
        setError(err.message || 'Gagal masuk menggunakan Email.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sign in using Google Auth
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      
      if (!firebaseUser.email) {
        throw new Error('Akun Google tidak memiliki alamat email.');
      }

      // Read or create user record in Firestore
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      let appUser: User;

      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        appUser = {
          id: firebaseUser.uid,
          name: data.name || firebaseUser.displayName || 'User',
          email: data.email || firebaseUser.email,
          role: data.role as UserRole,
          classId: data.classId || '',
          createdAt: data.createdAt || new Date().toISOString(),
        };
      } else {
        // Only abdulazizitn@gmail.com becomes ADMIN by default, others become WALI_KELAS
        const isDefaultAdmin = firebaseUser.email.toLowerCase() === 'abdulazizitn@gmail.com';
        const role = isDefaultAdmin ? UserRole.ADMIN : UserRole.WALI_KELAS;
        const defaultClassId = isDefaultAdmin ? '' : 'XI-RPL-1'; // Default class for testing if Wali Kelas

        appUser = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'Wali Kelas Baru',
          email: firebaseUser.email,
          role: role,
          classId: defaultClassId,
          createdAt: new Date().toISOString(),
        };

        // Save new user profile
        await setDoc(userDocRef, {
          name: appUser.name,
          email: appUser.email,
          role: appUser.role,
          classId: appUser.classId,
          createdAt: appUser.createdAt,
        });
      }

      onLoginSuccess(appUser);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal masuk menggunakan Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-200">
            <School className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900 font-sans">
          {appName}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          {appDesc}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl sm:px-10 border border-slate-100 space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Email/Password Login Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Email Pengguna
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@sekolah.sch.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer mt-2"
            >
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? 'Memproses...' : 'Masuk Aplikasi'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-slate-400 font-medium">atau masuk lewat</span>
            </div>
          </div>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex justify-center items-center py-2.5 px-4 border border-slate-200 rounded-xl bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm transition-colors duration-150 disabled:opacity-50 cursor-pointer"
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.6c-.28 1.48-1.12 2.73-2.38 3.58v3h3.84c2.25-2.06 3.68-5.1 3.68-8.41Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.84-3c-1.07.72-2.43 1.15-4.12 1.15-3.17 0-5.85-2.14-6.81-5.02H1.3a12.01 12.01 0 0 0 0 11.75l3.86-3C6.12 21.86 8.8 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.19 14.22a7.18 7.18 0 0 1 0-4.44V5.92H1.3a11.96 11.96 0 0 0 0 12.16l3.89-3.86Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.96 1.19 15.24 0 12 0 8.8 0 6.12 2.14 5.16 5.02L9.05 8.9c.96-2.9 3.64-4.15 6.95-4.15Z"
              />
            </svg>
            Google Workspace
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          © 2026 {appName}. Hak Cipta Dilindungi.
        </div>
      </div>
    </div>
  );
}
