import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserRole, StudentGender, InventoryCondition, AchievementCategory, AchievementLevel, ViolationCategory } from '../types';

export async function seedDatabaseIfEmpty() {
  const classesPath = 'classes';
  try {
    const classesSnap = await getDocs(collection(db, classesPath));
    if (classesSnap.size > 0) {
      console.log('Database already seeded or has data.');
      return;
    }

    console.log('Seeding initial data...');
    const batch = writeBatch(db);

    // 1. Seed Classes
    const classes = [
      { id: 'XI-RPL-1', name: 'XI Rekayasa Perangkat Lunak 1', homeroomTeacherId: 'wali_rpl1', homeroomTeacherName: 'Drs. Bambang Wijaya' },
      { id: 'XI-RPL-2', name: 'XI Rekayasa Perangkat Lunak 2', homeroomTeacherId: 'wali_rpl2', homeroomTeacherName: 'Siti Aminah, S.Pd.' },
      { id: 'X-TKJ-1', name: 'X Teknik Komputer Jaringan 1', homeroomTeacherId: 'wali_tkj1', homeroomTeacherName: 'Eko Prasetyo, M.T.' },
    ];

    for (const cls of classes) {
      const ref = doc(db, 'classes', cls.id);
      batch.set(ref, {
        id: cls.id,
        name: cls.name,
        homeroomTeacherId: cls.homeroomTeacherId,
        homeroomTeacherName: cls.homeroomTeacherName,
        createdAt: new Date().toISOString(),
      });
    }

    // 2. Seed Users
    const demoUsers = [
      { id: 'admin_demo', name: 'Abdul Aziz (Admin)', email: 'abdulazizitn@gmail.com', role: UserRole.ADMIN, classId: '' },
      { id: 'kepsek_demo', name: 'H. Mulyadi, M.Pd (Kepala Sekolah)', email: 'kepsek@sekolah.sch.id', role: UserRole.KEPALA_SEKOLAH, classId: '' },
      { id: 'wali_rpl1', name: 'Drs. Bambang Wijaya (Wali Kelas)', email: 'bambang@sekolah.sch.id', role: UserRole.WALI_KELAS, classId: 'XI-RPL-1' },
      { id: 'wali_rpl2', name: 'Siti Aminah, S.Pd. (Wali Kelas)', email: 'siti@sekolah.sch.id', role: UserRole.WALI_KELAS, classId: 'XI-RPL-2' },
    ];

    for (const usr of demoUsers) {
      const ref = doc(db, 'users', usr.id);
      batch.set(ref, {
        name: usr.name,
        email: usr.email,
        role: usr.role,
        classId: usr.classId,
        createdAt: new Date().toISOString(),
      });
    }

    // 3. Seed Students
    const students = [
      // XI-RPL-1 Students
      { id: 'std_rpl1_1', name: 'Aditya Pratama', nisn: '0054321001', classId: 'XI-RPL-1', gender: StudentGender.LAKI_LAKI, phone: '081234567890', email: 'aditya@student.id', parentName: 'Suparno', parentPhone: '081299990001' },
      { id: 'std_rpl1_2', name: 'Budi Santoso', nisn: '0054321002', classId: 'XI-RPL-1', gender: StudentGender.LAKI_LAKI, phone: '081234567891', email: 'budi@student.id', parentName: 'Joko Santoso', parentPhone: '081299990002' },
      { id: 'std_rpl1_3', name: 'Citra Lestari', nisn: '0054321003', classId: 'XI-RPL-1', gender: StudentGender.PEREMPUAN, phone: '081234567892', email: 'citra@student.id', parentName: 'Hari Lestari', parentPhone: '081299990003' },
      { id: 'std_rpl1_4', name: 'Dewi Sartika', nisn: '0054321004', classId: 'XI-RPL-1', gender: StudentGender.PEREMPUAN, phone: '081234567893', email: 'dewi@student.id', parentName: 'Ahmad Sartika', parentPhone: '081299990004' },
      { id: 'std_rpl1_5', name: 'Eka Wijaya', nisn: '0054321005', classId: 'XI-RPL-1', gender: StudentGender.LAKI_LAKI, phone: '081234567894', email: 'eka@student.id', parentName: 'Heri Wijaya', parentPhone: '081299990005' },
      { id: 'std_rpl1_6', name: 'Farhan Ramadhan', nisn: '0054321006', classId: 'XI-RPL-1', gender: StudentGender.LAKI_LAKI, phone: '081234567895', email: 'farhan@student.id', parentName: 'Ramadhan', parentPhone: '081299990006' },
      // XI-RPL-2 Students
      { id: 'std_rpl2_1', name: 'Gita Permata', nisn: '0054321007', classId: 'XI-RPL-2', gender: StudentGender.PEREMPUAN, phone: '081234567896', email: 'gita@student.id', parentName: 'Andi Permata', parentPhone: '081299990007' },
      { id: 'std_rpl2_2', name: 'Hadi Wibowo', nisn: '0054321008', classId: 'XI-RPL-2', gender: StudentGender.LAKI_LAKI, phone: '081234567897', email: 'hadi@student.id', parentName: 'Wibowo', parentPhone: '081299990008' },
    ];

    for (const std of students) {
      const ref = doc(db, 'students', std.id);
      batch.set(ref, {
        name: std.name,
        nisn: std.nisn,
        classId: std.classId,
        gender: std.gender,
        phone: std.phone,
        email: std.email,
        parentName: std.parentName,
        parentPhone: std.parentPhone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 4. Seed Inventories for XI-RPL-1
    const inventories = [
      { id: 'inv_1', classId: 'XI-RPL-1', itemName: 'LCD Proyektor Epson', quantity: 1, condition: InventoryCondition.BAIK },
      { id: 'inv_2', classId: 'XI-RPL-1', itemName: 'AC Split Panasonic', quantity: 2, condition: InventoryCondition.BAIK },
      { id: 'inv_3', classId: 'XI-RPL-1', itemName: 'Whiteboard Besar', quantity: 1, condition: InventoryCondition.BAIK },
      { id: 'inv_4', classId: 'XI-RPL-1', itemName: 'Meja Guru Kayu', quantity: 1, condition: InventoryCondition.BAIK },
      { id: 'inv_5', classId: 'XI-RPL-1', itemName: 'Kursi Siswa Futura', quantity: 36, condition: InventoryCondition.RUSAK_RINGAN },
      { id: 'inv_6', classId: 'XI-RPL-1', itemName: 'Speaker Aktif JBL', quantity: 2, condition: InventoryCondition.RUSAK_BERAT },
    ];

    for (const inv of inventories) {
      const ref = doc(db, 'inventories', inv.id);
      batch.set(ref, {
        classId: inv.classId,
        itemName: inv.itemName,
        quantity: inv.quantity,
        condition: inv.condition,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 5. Seed Class Officers for XI-RPL-1
    batch.set(doc(db, 'class_officers', 'XI-RPL-1'), {
      classId: 'XI-RPL-1',
      ketua: 'Aditya Pratama',
      wakil: 'Citra Lestari',
      sekretaris: 'Dewi Sartika',
      bendahara: 'Eka Wijaya',
      updatedAt: new Date().toISOString(),
    });

    // 6. Seed Achievements
    const achievements = [
      {
        id: 'ach_1',
        studentId: 'std_rpl1_1',
        studentName: 'Aditya Pratama',
        classId: 'XI-RPL-1',
        achievementName: 'Juara 1 Lomba Kompetensi Siswa (LKS) Web Technologies',
        category: AchievementCategory.AKADEMIK,
        level: AchievementLevel.PROVINSI,
        date: '2026-05-10',
        description: 'Meraih medali emas tingkat provinsi dalam pengembangan aplikasi web responsif.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ach_2',
        studentId: 'std_rpl1_3',
        studentName: 'Citra Lestari',
        classId: 'XI-RPL-1',
        achievementName: 'Juara 2 Debat Bahasa Inggris SMA/SMK',
        category: AchievementCategory.AKADEMIK,
        level: AchievementLevel.KABUPATEN,
        date: '2026-04-18',
        description: 'Mewakili sekolah dalam kompetisi debat bahasa inggris dan sukses membawa pulang piala.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ach_3',
        studentId: 'std_rpl1_4',
        studentName: 'Dewi Sartika',
        classId: 'XI-RPL-1',
        achievementName: 'Juara 3 Pencak Silat Piala Menpora',
        category: AchievementCategory.NON_AKADEMIK,
        level: AchievementLevel.NASIONAL,
        date: '2026-03-22',
        description: 'Meraih medali perunggu kategori Tanding Putri tingkat nasional.',
        createdAt: new Date().toISOString(),
      }
    ];

    for (const ach of achievements) {
      const ref = doc(db, 'achievements', ach.id);
      batch.set(ref, ach);
    }

    // 7. Seed Violations
    const violations = [
      {
        id: 'vio_1',
        studentId: 'std_rpl1_2',
        studentName: 'Budi Santoso',
        classId: 'XI-RPL-1',
        violationName: 'Terlambat Masuk Sekolah',
        points: 5,
        category: ViolationCategory.RINGAN,
        date: '2026-07-02',
        actionTaken: 'Teguran lisan oleh guru piket dan pencatatan poin.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'vio_2',
        studentId: 'std_rpl1_2',
        studentName: 'Budi Santoso',
        classId: 'XI-RPL-1',
        violationName: 'Tidak Menggunakan Atribut Seragam Lengkap (Dasi & Sabuk)',
        points: 5,
        category: ViolationCategory.RINGAN,
        date: '2026-07-08',
        actionTaken: 'Diberikan sanksi push-up 10 kali dan disita dasi tidak standar.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'vio_3',
        studentId: 'std_rpl1_6',
        studentName: 'Farhan Ramadhan',
        classId: 'XI-RPL-1',
        violationName: 'Meninggalkan Kelas Tanpa Izin (Bolos)',
        points: 15,
        category: ViolationCategory.SEDANG,
        date: '2026-06-15',
        actionTaken: 'Pemanggilan siswa dan diberikan tugas tambahan sejarah.',
        createdAt: new Date().toISOString(),
      }
    ];

    for (const vio of violations) {
      const ref = doc(db, 'violations', vio.id);
      batch.set(ref, vio);
    }

    // 8. Seed Home Visits
    const homeVisits = [
      {
        id: 'vis_1',
        studentId: 'std_rpl1_2',
        studentName: 'Budi Santoso',
        classId: 'XI-RPL-1',
        date: '2026-07-10',
        purpose: 'Koordinasi terkait keterlambatan berulang',
        result: 'Bertemu dengan ibu Budi (Ibu Siti). Ibu berjanji akan mengawasi jam bangun pagi Budi agar tidak terlambat lagi.',
        documentationUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=400',
        createdAt: new Date().toISOString(),
      }
    ];

    for (const vis of homeVisits) {
      const ref = doc(db, 'home_visits', vis.id);
      batch.set(ref, vis);
    }

    // 9. Seed Seating Arrangement
    batch.set(doc(db, 'seating_arrangements', 'XI-RPL-1'), {
      classId: 'XI-RPL-1',
      rows: 4,
      cols: 4,
      seats: [
        { row: 0, col: 0, studentId: 'std_rpl1_1', studentName: 'Aditya Pratama' },
        { row: 0, col: 1, studentId: 'std_rpl1_2', studentName: 'Budi Santoso' },
        { row: 0, col: 2, studentId: 'std_rpl1_3', studentName: 'Citra Lestari' },
        { row: 0, col: 3, studentId: 'std_rpl1_4', studentName: 'Dewi Sartika' },
        { row: 1, col: 0, studentId: 'std_rpl1_5', studentName: 'Eka Wijaya' },
        { row: 1, col: 1, studentId: 'std_rpl1_6', studentName: 'Farhan Ramadhan' },
      ],
      updatedAt: new Date().toISOString(),
    });

    // 10. Seed Notifications
    const notifications = [
      {
        id: 'not_1',
        classId: 'XI-RPL-1',
        title: 'Siswa Berprestasi Baru',
        message: 'Aditya Pratama meraih Juara 1 LKS Web Technologies tingkat Provinsi!',
        type: 'prestasi',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'not_2',
        classId: 'XI-RPL-1',
        title: 'Inventaris Rusak Berat',
        message: 'JBL Speaker Aktif di kelas XI-RPL-1 dilaporkan rusak berat.',
        type: 'inventaris',
        createdAt: new Date().toISOString(),
      }
    ];

    for (const not of notifications) {
      const ref = doc(db, 'notifications', not.id);
      batch.set(ref, not);
    }

    await batch.commit();
    console.log('Database seeded successfully!');

  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed');
  }
}
