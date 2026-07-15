export enum UserRole {
  ADMIN = 'admin',
  KEPALA_SEKOLAH = 'kepala_sekolah',
  WALI_KELAS = 'wali_kelas',
}

export enum StudentGender {
  LAKI_LAKI = 'Laki-laki',
  PEREMPUAN = 'Perempuan',
}

export enum InventoryCondition {
  BAIK = 'Baik',
  RUSAK_RINGAN = 'Rusak Ringan',
  RUSAK_BERAT = 'Rusak Berat',
}

export enum AchievementCategory {
  AKADEMIK = 'Akademik',
  NON_AKADEMIK = 'Non-Akademik',
}

export enum AchievementLevel {
  SEKOLAH = 'Sekolah',
  KECAMATAN = 'Kecamatan',
  KABUPATEN = 'Kabupaten',
  PROVINSI = 'Provinsi',
  NASIONAL = 'Nasional',
  INTERNASIONAL = 'Internasional',
}

export enum ViolationCategory {
  RINGAN = 'Ringan',
  SEDANG = 'Sedang',
  BERAT = 'Berat',
}

export enum NotificationType {
  SISWA = 'siswa',
  PRESTASI = 'prestasi',
  PELANGGARAN = 'pelanggaran',
  INVENTARIS = 'inventaris',
  VISIT = 'visit',
}

export interface User {
  id?: string; // UID
  name: string;
  email: string;
  role: UserRole;
  classId?: string; // assigned class code for wali_kelas (e.g., 'X-IPA-1')
  createdAt: string;
}

export interface Class {
  id: string; // class code/ID (e.g. 'XI-RPL-1')
  name: string; // e.g. 'XI RPL 1'
  homeroomTeacherId: string;
  homeroomTeacherName: string;
  createdAt: string;
}

export interface Student {
  id?: string;
  name: string;
  nisn: string;
  classId: string;
  gender: StudentGender;
  phone: string;
  email: string;
  parentName: string;
  parentPhone: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassOfficer {
  classId: string;
  ketua: string; // Student ID or student name
  wakil: string;
  sekretaris: string;
  bendahara: string;
  updatedAt: string;
}

export interface Seat {
  row: number;
  col: number;
  studentId: string;
  studentName: string;
}

export interface SeatingArrangement {
  classId: string;
  rows: number;
  cols: number;
  seats: Seat[];
  updatedAt: string;
}

export interface Inventory {
  id?: string;
  classId: string;
  itemName: string;
  quantity: number;
  condition: InventoryCondition;
  createdAt: string;
  updatedAt: string;
}

export interface Achievement {
  id?: string;
  studentId: string;
  studentName: string;
  classId: string;
  achievementName: string;
  category: AchievementCategory;
  level: AchievementLevel;
  date: string;
  description: string;
  createdAt: string;
}

export interface Violation {
  id?: string;
  studentId: string;
  studentName: string;
  classId: string;
  violationName: string;
  points: number;
  category: ViolationCategory;
  date: string;
  actionTaken: string;
  createdAt: string;
}

export interface HomeVisit {
  id?: string;
  studentId: string;
  studentName: string;
  classId: string;
  date: string;
  purpose: string;
  result: string;
  documentationUrl?: string;
  createdAt: string;
}

export interface Notification {
  id?: string;
  classId?: string; // empty means system-wide, non-empty means class-specific
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
}
