import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { User, UserRole } from '../types';
import { School, LogIn, ShieldAlert } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  appName: string;
}

export default function Login({ onLoginSuccess, appName }: LoginProps) {
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
        // Check if there are any existing real (non-demo) users in the database
        let isFirstRealUser = true;
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          const hasRealUsers = usersSnap.docs.some(
            docSnap => !docSnap.id.endsWith('_demo') && !docSnap.id.startsWith('wali_')
          );
          isFirstRealUser = !hasRealUsers;
        } catch (err) {
          console.error('Error checking existing users:', err);
        }

        const role = isFirstRealUser ? UserRole.ADMIN : UserRole.WALI_KELAS;
        const defaultClassId = isFirstRealUser ? '' : 'XI-RPL-1'; // Default class for testing if Wali Kelas

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
              className="w-full flex justify-center items-center py-3 px-4 border border-slate-200 rounded-xl bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-sm transition-colors duration-150 disabled:opacity-50 cursor-pointer"
            >
              <LogIn className="h-5 w-5 text-emerald-600 mr-2" />
              {loading ? 'Menghubungkan...' : 'Masuk dengan Google'}
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          © 2026 {appName}. Hak Cipta Dilindungi.
        </div>
      </div>
    </div>
  );
}
