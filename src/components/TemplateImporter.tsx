import React, { useState } from 'react';
import { Download, Upload, AlertCircle, CheckCircle2, FileSpreadsheet, X, HelpCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student } from '../types';

interface TemplateImporterProps {
  menuType: 'siswa' | 'pengurus' | 'seating' | 'inventaris' | 'prestasi' | 'pelanggaran' | 'visit' | 'users';
  classId?: string;
  students?: Student[]; // for mapping student names/NISN to IDs
  onImport: (parsedData: any[]) => Promise<void>;
  onClose: () => void;
}

export default function TemplateImporter({ menuType, classId, students = [], onImport, onClose }: TemplateImporterProps) {
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Define headers and structure for templates
  const getTemplateConfig = () => {
    switch (menuType) {
      case 'siswa':
        return {
          title: 'Import Siswa',
          headers: ['Nama', 'NISN', 'Jenis Kelamin', 'Kelas', 'No HP', 'Email', 'Nama Orang Tua', 'No HP Orang Tua'],
          example: 'Ahmad Syarif,1234567890,Laki-laki,XI-RPL-1,08123456789,ahmad@student.id,Joko,08129876543\nSiti Aminah,1234567891,Perempuan,XI-RPL-2,08123456780,siti@student.id,Aminah,08129876540',
          desc: 'Gunakan template ini untuk mendaftarkan murid-murid baru secara massal. Kolom Kelas dapat diisi untuk menentukan atau membuat kelas baru.'
        };
      case 'pengurus':
        return {
          title: 'Import Pengurus Kelas',
          headers: ['Jabatan', 'Nama atau NISN'],
          example: 'Ketua Kelas,Ahmad Syarif\nWakil Ketua,Siti Aminah\nSekretaris,Bambang\nBendahara,Citra',
          desc: 'Masukkan jabatan pengurus beserta nama atau NISN murid yang bersangkutan.'
        };
      case 'seating':
        return {
          title: 'Import Denah Tempat Duduk',
          headers: ['Baris', 'Kolom', 'Nama atau NISN'],
          example: '0,0,Ahmad Syarif\n0,1,Siti Aminah\n1,0,Bambang',
          desc: 'Tentukan baris (mulai dari 0) dan kolom (mulai dari 0) tempat duduk murid.'
        };
      case 'inventaris':
        return {
          title: 'Import Inventaris Kelas',
          headers: ['Nama Barang', 'Jumlah', 'Kondisi'],
          example: 'Papan Tulis,1,Baik\nAC Split,2,Rusak Ringan\nMeja Guru,1,Baik',
          desc: 'Kondisi wajib diisi dengan: Baik, Rusak Ringan, atau Rusak Berat.'
        };
      case 'prestasi':
        return {
          title: 'Import Prestasi Murid',
          headers: ['Nama atau NISN', 'Nama Prestasi', 'Kategori', 'Tingkat', 'Tanggal', 'Keterangan'],
          example: 'Siti Aminah,Juara 1 Lomba Debat Bahasa Inggris,Non-Akademik,Provinsi,2026-05-12,Penghargaan tingkat regional',
          desc: 'Kategori: Akademik / Non-Akademik. Tingkat: Sekolah / Kecamatan / Kabupaten / Provinsi / Nasional / Internasional.'
        };
      case 'pelanggaran':
        return {
          title: 'Import Pelanggaran Murid',
          headers: ['Nama atau NISN', 'Nama Pelanggaran', 'Poin', 'Kategori', 'Tanggal', 'Tindakan'],
          example: 'Bambang,Terlambat masuk sekolah,5,Ringan,2026-06-01,Peringatan lisan dan pembinaan',
          desc: 'Poin berkisar antara 1-100. Kategori: Ringan / Sedang / Berat.'
        };
      case 'visit':
        return {
          title: 'Import Log Home Visit',
          headers: ['Nama atau NISN', 'Tanggal', 'Tujuan', 'Hasil', 'Link Dokumentasi'],
          example: 'Bambang,2026-06-10,Konseling akademik di rumah,Sepakat pembinaan berkala bersama orang tua,https://images.unsplash.com/photo-1513258496099-48168024aec0',
          desc: 'Link Dokumentasi opsional. Tanggal berformat YYYY-MM-DD.'
        };
      case 'users':
        return {
          title: 'Import Pengguna',
          headers: ['Nama Lengkap', 'Email', 'Peran', 'Kelas'],
          example: 'Andi Saputra,andi@sekolah.sch.id,wali_kelas,XI-RPL-1\nZainal,zainal@sekolah.sch.id,kepala_sekolah,',
          desc: 'Peran diisi dengan: admin, kepala_sekolah, atau wali_kelas.'
        };
    }
  };

  const config = getTemplateConfig();

  // Helper to split CSV-like example string securely
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Generate and download Excel (.xlsx) file using SheetJS
  const handleDownloadTemplate = () => {
    try {
      const headers = config.headers;
      const exampleLines = config.example.split('\n');
      const data: any[][] = [headers];
      
      exampleLines.forEach(line => {
        if (line.trim()) {
          data.push(parseCSVLine(line));
        }
      });

      // Create Worksheet and Workbook
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template " + menuType);

      // Auto-fit column widths for better appearance
      const maxCols = headers.length;
      ws['!cols'] = Array(maxCols).fill(null).map((_, colIdx) => {
        let maxLen = headers[colIdx].length;
        data.forEach(row => {
          if (row[colIdx]) {
            const valStr = String(row[colIdx]);
            if (valStr.length > maxLen) {
              maxLen = valStr.length;
            }
          }
        });
        return { wch: Math.max(maxLen + 3, 12) };
      });

      // Write and trigger download
      XLSX.writeFile(wb, `template_${menuType}_${classId || 'sekolah'}.xlsx`);
    } catch (err) {
      console.error('Error generating Excel template:', err);
      setErrorMsg('Gagal membuat file template Excel.');
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErrorMsg('Format file harus berakhiran .xlsx atau .xls (Excel)');
      return;
    }
    setErrorMsg(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const data = new Uint8Array(buffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
          setErrorMsg('File Excel tidak memiliki lembar kerja (sheet).');
          return;
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to json with headers as raw array of arrays
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rawRows.length < 2) {
          setErrorMsg('File Excel kosong atau tidak memiliki baris data.');
          return;
        }

        // Parse rows mapped to config.headers
        const rows: any[] = [];
        for (let i = 1; i < rawRows.length; i++) {
          const values = rawRows[i];
          if (!values || values.length === 0) continue;

          // Skip if the entire row is completely empty
          const isRowEmpty = values.every(v => v === undefined || v === null || String(v).trim() === '');
          if (isRowEmpty) continue;

          const item: any = {};
          config.headers.forEach((header, index) => {
            const val = values[index];
            item[header] = val !== undefined && val !== null ? String(val).trim() : '';
          });
          rows.push(item);
        }

        if (rows.length === 0) {
          setErrorMsg('Tidak ada baris data valid yang ditemukan di file Excel.');
        } else {
          setParsedRows(rows);
        }
      } catch (err: any) {
        console.error('Error reading Excel file:', err);
        setErrorMsg('Gagal membaca file Excel. Pastikan format file benar.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const executeImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setErrorMsg(null);
    try {
      await onImport(parsedRows);
      setSuccessCount(parsedRows.length);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Gagal menyimpan data impor. Pastikan data berformat benar.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-slide-in">
        
        {/* Header */}
        <div className="bg-sky-50 px-6 py-5 border-b border-sky-100/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-sky-500/10 p-2 rounded-xl text-sky-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">{config.title}</h3>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Metode Import Template Excel Massal</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[65vh]">
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100 flex gap-2">
            <HelpCircle className="h-5 w-5 text-sky-500 shrink-0" />
            <span>
              {config.desc} Anda dapat mendownload template Excel di bawah ini, mengisinya di Excel/Spreadsheet, lalu mengupload kembali file berformat <b>.xlsx</b> atau <b>.xls</b>.
            </span>
          </p>

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="w-full py-2.5 px-4 border border-sky-200 text-sky-600 bg-sky-50/30 hover:bg-sky-50 hover:border-sky-300 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            Unduh Template Excel (.xlsx)
          </button>

          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-6 text-center transition flex flex-col items-center justify-center min-h-[140px] relative ${
              dragActive 
                ? 'border-sky-500 bg-sky-50/20' 
                : 'border-slate-200 hover:border-sky-300 hover:bg-slate-50/50'
            }`}
          >
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="bg-sky-500/10 p-3 rounded-2xl text-sky-600 mb-2.5">
              <Upload className="h-5 w-5" />
            </div>
            {fileName ? (
              <div>
                <p className="text-xs font-bold text-slate-800 line-clamp-1">{fileName}</p>
                <p className="text-[10px] text-sky-600 font-semibold mt-1">Klik atau seret file lain untuk mengganti</p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-slate-700">Pilih File Excel Anda</p>
                <p className="text-[10px] text-slate-400 mt-1">Seret file .xlsx/.xls atau klik untuk browse</p>
              </div>
            )}
          </div>

          {/* Messages */}
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-xs leading-relaxed animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800 text-xs font-bold animate-fade-in">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 animate-pulse" />
              <span>Berhasil mengimpor {successCount} baris data! Halaman akan segera disegarkan.</span>
            </div>
          )}

          {/* Rows Preview */}
          {parsedRows.length > 0 && successCount === null && (
            <div className="space-y-2 animate-fade-in">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Pratinjau Data ({parsedRows.length} baris):</h4>
              <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-36 overflow-y-auto">
                <table className="w-full text-[10px] text-left border-collapse bg-slate-50/50">
                  <thead className="bg-slate-50 sticky top-0 text-slate-500 font-bold border-b border-slate-100">
                    <tr>
                      {config.headers.slice(0, 3).map((h, i) => (
                        <th key={i} className="p-2 truncate">{h}</th>
                      ))}
                      {config.headers.length > 3 && <th className="p-2">Lainnya...</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition text-slate-600">
                        {config.headers.slice(0, 3).map((h, i) => (
                          <td key={i} className="p-2 truncate max-w-[120px]">{row[h]}</td>
                        ))}
                        {config.headers.length > 3 && <td className="p-2 text-slate-400">...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={importing}
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={parsedRows.length === 0 || importing || successCount !== null}
            onClick={executeImport}
            className={`px-5 py-2 text-white rounded-xl text-xs font-semibold transition shadow-sm ${
              parsedRows.length === 0 || importing || successCount !== null
                ? 'bg-slate-300 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-sky-500 hover:bg-sky-600 shadow-sky-100'
            }`}
          >
            {importing ? 'Memproses...' : 'Impor Sekarang'}
          </button>
        </div>

      </div>
    </div>
  );
}
