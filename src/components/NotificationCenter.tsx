import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Notification, NotificationType } from '../types';
import { Bell, Trophy, ShieldAlert, User, Archive, Home, X } from 'lucide-react';

interface NotificationCenterProps {
  classId?: string;
}

export default function NotificationCenter({ classId }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [toast, setToast] = useState<Notification | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Notification[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          classId: data.classId || '',
          title: data.title || '',
          message: data.message || '',
          type: data.type as NotificationType,
          createdAt: data.createdAt || '',
        });
      });

      // Filter based on classId if it's not empty and the notification specifies a classId
      const filtered = classId 
        ? list.filter(n => !n.classId || n.classId === classId)
        : list;

      setNotifications(filtered);

      // Trigger a real-time toast if there is a brand new notification
      if (filtered.length > 0) {
        const latest = filtered[0];
        // Only show toast if the notification was created within the last 15 seconds (to prevent toast on startup)
        const ageInMs = Date.now() - new Date(latest.createdAt).getTime();
        if (ageInMs < 15000) {
          setToast(latest);
          const timer = setTimeout(() => {
            setToast(null);
          }, 6000);
          return () => clearTimeout(timer);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
    });

    return () => unsubscribe();
  }, [classId]);

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.PRESTASI:
        return <Trophy className="h-4 w-4 text-amber-500" />;
      case NotificationType.PELANGGARAN:
        return <ShieldAlert className="h-4 w-4 text-rose-500" />;
      case NotificationType.SISWA:
        return <User className="h-4 w-4 text-blue-500" />;
      case NotificationType.INVENTARIS:
        return <Archive className="h-4 w-4 text-emerald-500" />;
      case NotificationType.VISIT:
        return <Home className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <div className="relative z-40">
      {/* Toast alert */}
      {toast && (
        <div className="fixed bottom-4 right-4 max-w-sm w-full bg-white border border-slate-100 rounded-2xl shadow-xl p-4 flex items-start gap-3 border-l-4 border-l-emerald-500 animate-slide-in">
          <div className="p-2 rounded-xl bg-slate-50">
            {getIcon(toast.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-slate-800">{toast.title}</h4>
            <p className="text-xs text-slate-500 mt-1">{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Trigger Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-800 transition"
      >
        <Bell className="h-5 w-5" />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <>
          <div className="fixed inset-0" onClick={() => setShowDropdown(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden py-2 animate-fade-in-down">
            <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-800">Notifikasi Terbaru</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Real-time</span>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 px-4 text-center text-slate-400 text-xs">
                  Tidak ada notifikasi baru
                </div>
              ) : (
                notifications.map((not) => (
                  <div key={not.id} className="px-4 py-3 hover:bg-slate-50 flex gap-3 border-b border-slate-50">
                    <div className="p-1.5 h-fit rounded-lg bg-slate-100">
                      {getIcon(not.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-800">{not.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{not.message}</p>
                      <p className="text-[9px] text-slate-400 mt-1">
                        {new Date(not.createdAt).toLocaleTimeString('id-ID')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
