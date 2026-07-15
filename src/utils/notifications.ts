import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { NotificationType } from '../types';

/**
 * Creates a notification in Firestore which propagates in real-time
 */
export async function sendRealtimeNotification(
  title: string,
  message: string,
  type: NotificationType,
  classId?: string
) {
  const path = 'notifications';
  try {
    await addDoc(collection(db, path), {
      title,
      message,
      type,
      classId: classId || null,
      createdAt: new Date().toISOString(), // Use ISO string or simple timestamp
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
