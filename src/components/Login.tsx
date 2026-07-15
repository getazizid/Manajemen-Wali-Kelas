import { useState } from 'react';
import { signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from '../firebase';
import { User, UserRole } from '../types';
import { School, LogIn, ShieldAlert, Award, Star, Activity } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sign in using Google Auth
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      
      if (!firebaseUser.email) {
        throw new Error('Google account is missing an email address.');
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
        // Bootstrap abdulazizitn@gmail.com as ADMIN, others as WALI_KELAS
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

  // Login using Demo Account (Quick Switch for preview)
  const handleDemoLogin = async (role: UserRole, id: string, name: string, email: string, classId: string) => {
    setLoading(true);
    setError(null);
    try {
      let firebaseUid = id;
      let anonymousAuthSuccess = false;

      // 1. Try to sign in anonymously to obtain a secure Firebase Auth context
      try {
        const userCredential = await signInAnonymously(auth);
        firebaseUid = userCredential.user.uid;
        anonymousAuthSuccess = true;
      } catch (authErr: any) {
        console.warn('Anonymous Auth is not enabled in Firebase Console. Falling back to local state-only session.', authErr);
      }

      // 2. Prepare the demo user profile
      const demoUser: User = {
        id: firebaseUid,
        name,
        email,
        role,
        classId,
        createdAt: new Date().toISOString(),
      };
      
      // 3. Attempt to save the user profile document in Firestore
      try {
        const userDocRef = doc(db, 'users', firebaseUid);
        await setDoc(userDocRef, {
          name,
          email,
          role,
          classId,
          createdAt: new Date().toISOString(),
        }, { merge: true });
      } catch (dbErr: any) {
        console.warn('Could not write profile to Firestore (likely because rules block it or unauthenticated). Proceeding with client-side session.', dbErr);
        // Do not block login even if the database write fails - let them use the app
      }

      onLoginSuccess(demoUser);
    } catch (err: any) {
      console.error(err);
      setError(`Gagal masuk sebagai Akun Demo. Error: ${err?.message || String(err)}`);
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
          SIWALI
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Sistem Manajemen Wali Kelas SMA/SMK
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl sm:px-10 border border-slate-100">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
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

          <div className="space-y-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-slate-200 rounded-xl bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-sm transition-colors duration-150 disabled:opacity-50"
            >
              <LogIn className="h-5 w-5 text-emerald-600 mr-2" />
              {loading ? 'Menghubungkan...' : 'Masuk dengan Google'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Atau Gunakan Akses Cepat Demo</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleDemoLogin(
                  UserRole.ADMIN,
                  'admin_demo',
                  'Abdul Aziz (Demo Admin)',
                  'abdulazizitn@gmail.com',
                  ''
                )}
                disabled={loading}
                className="w-full flex justify-between items-center py-2.5 px-4 rounded-xl border border-rose-100 bg-rose-50/50 hover:bg-rose-50 text-rose-800 text-sm font-medium transition-colors"
              >
                <span className="flex items-center">
                  <span className="w-2 h-2 rounded-full bg-rose-500 mr-2"></span>
                  Masuk sebagai Admin
                </span>
                <span className="text-xs bg-rose-200/50 text-rose-700 px-2.5 py-1 rounded-md">Penuh</span>
              </button>

              <button
                onClick={() => handleDemoLogin(
                  UserRole.KEPALA_SEKOLAH,
                  'kepsek_demo',
                  'H. Mulyadi, M.Pd (Demo Kepsek)',
                  'kepsek@sekolah.sch.id',
                  ''
                )}
                disabled={loading}
                className="w-full flex justify-between items-center py-2.5 px-4 rounded-xl border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-800 text-sm font-medium transition-colors"
              >
                <span className="flex items-center">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></span>
                  Masuk sebagai Kepala Sekolah
                </span>
                <span className="text-xs bg-indigo-200/50 text-indigo-700 px-2.5 py-1 rounded-md">Pantau</span>
              </button>

              <button
                onClick={() => handleDemoLogin(
                  UserRole.WALI_KELAS,
                  'wali_rpl1',
                  'Drs. Bambang (Demo Wali XI-RPL-1)',
                  'bambang@sekolah.sch.id',
                  'XI-RPL-1'
                )}
                disabled={loading}
                className="w-full flex justify-between items-center py-2.5 px-4 rounded-xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 text-sm font-medium transition-colors"
              >
                <span className="flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                  Masuk Wali Kelas XI-RPL-1
                </span>
                <span className="text-xs bg-emerald-200/50 text-emerald-700 px-2.5 py-1 rounded-md">Kelola</span>
              </button>

              <button
                onClick={() => handleDemoLogin(
                  UserRole.WALI_KELAS,
                  'wali_rpl2',
                  'Siti Aminah, S.Pd. (Demo Wali XI-RPL-2)',
                  'siti@sekolah.sch.id',
                  'XI-RPL-2'
                )}
                disabled={loading}
                className="w-full flex justify-between items-center py-2.5 px-4 rounded-xl border border-amber-100 bg-amber-50/50 hover:bg-amber-50 text-amber-800 text-sm font-medium transition-colors"
              >
                <span className="flex items-center">
                  <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
                  Masuk Wali Kelas XI-RPL-2
                </span>
                <span className="text-xs bg-amber-200/50 text-amber-700 px-2.5 py-1 rounded-md">Kelola</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          © 2026 SIWALI. Hak Cipta Dilindungi.
        </div>
      </div>
    </div>
  );
}
