import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Export data to CSV compatible with Microsoft Excel
 */
export function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  // UTF-8 BOM to ensure Excel opens Indonesian special characters correctly
  const BOM = '\uFEFF';
  const csvContent = rows
    .map(e => e.map(val => {
      // Escape double quotes and wrap in quotes if value contains comma, semi-colon, or newline
      const cleanVal = (val || '').replace(/"/g, '""');
      if (cleanVal.includes(',') || cleanVal.includes(';') || cleanVal.includes('\n') || cleanVal.includes('"')) {
        return `"${cleanVal}"`;
      }
      return cleanVal;
    }).join(';')) // Excel Indonesian defaults to semicolon, but we'll use semicolon which is highly standard
    .join('\n');

  const blob = new Blob([BOM + headers.join(';') + '\n' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Custom PDF Printing using Window Print
 */
export async function printData(title: string, tableHeaders: string[], tableRows: string[][], additionalMeta?: { label: string; value: string }[]) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  let appName = 'SIWALI';
  let appDesc = 'Aplikasi Manajemen Wali Kelas SMA/SMK';
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'app'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      appName = data.appName || 'SIWALI';
      appDesc = data.appDesc || 'Aplikasi Manajemen Wali Kelas SMA/SMK';
    }
  } catch (err) {
    console.error('Error fetching settings for print:', err);
  }

  const metaHtml = additionalMeta && additionalMeta.length > 0
    ? `<div style="margin-bottom: 20px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 13px; color: #4b5563;">
        ${additionalMeta.map(m => `<div><strong>${m.label}:</strong> ${m.value}</div>`).join('')}
       </div>`
    : '';

  const headersHtml = tableHeaders.map(h => `<th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left; background-color: #f3f4f6; color: #1f2937; font-weight: 600; font-size: 12px;">${h}</th>`).join('');
  
  const rowsHtml = tableRows.map(row => {
    return `<tr style="border-bottom: 1px solid #e5e7eb;">
      ${row.map(cell => `<td style="border: 1px solid #e5e7eb; padding: 10px; font-size: 12px; color: #374151;">${cell || '-'}</td>`).join('')}
    </tr>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body {
          font-family: 'Inter', system-ui, sans-serif;
          color: #111827;
          margin: 40px;
          line-height: 1.5;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #111827;
          padding-bottom: 15px;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          text-transform: uppercase;
          margin: 0 0 5px 0;
          letter-spacing: 0.5px;
        }
        .subtitle {
          font-size: 14px;
          color: #4b5563;
          margin: 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        .footer {
          margin-top: 50px;
          font-size: 11px;
          color: #9ca3af;
          text-align: center;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
        }
        @media print {
          body { margin: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">${appName}</h1>
        <p class="subtitle">${appDesc}</p>
        <h2 style="font-size: 16px; margin: 15px 0 0 0; text-transform: uppercase; font-weight: bold; color: #111827; border-top: 1px solid #e5e7eb; padding-top: 10px;">${title}</h2>
      </div>
      
      ${metaHtml}

      <table>
        <thead>
          <tr>${headersHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="footer">
        Dicetak otomatis pada ${new Date().toLocaleString('id-ID')} | ${appName}
      </div>

      <script>
        window.onload = function() {
          window.print();
          // Close tab after print dialog completes in most browsers
          setTimeout(() => { window.close(); }, 500);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
