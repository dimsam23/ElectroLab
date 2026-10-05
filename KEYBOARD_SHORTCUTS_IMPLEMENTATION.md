Keyboard Shortcuts Implementation untuk ElectroLab Simulator

Fitur-fitur yang telah ditambahkan:

1. UNDO (Ctrl+Z)
   - Membatalkan aksi terakhir dan kembali ke state sebelumnya
   - History disimpan otomatis setiap kali ada perubahan circuit
   - Maksimal 50 snapshot untuk menghemat memory

2. REDO (Ctrl+Y)
   - Mengulangi aksi yang telah di-undo
   - Bekerja setelah Ctrl+Z

3. COPY (Ctrl+C)
   - Menyalin komponen, junction, atau wire yang dipilih ke clipboard
   - Data disimpan dalam format JSON internal

4. CUT (Ctrl+X)
   - Menyalin komponen yang dipilih ke clipboard
   - Menghapus komponen dari circuit setelah copy
   - Menghemat langkah dibanding copy + delete

5. PASTE (Ctrl+V)
   - Menempel komponen/junction/wire dari clipboard
   - Semua item yang di-paste akan offset 40px ke kanan dan bawah
   - ID automatically di-generate untuk menghindari konflik
   - Wire yang dipaste juga di-map ke komponen/junction yang baru

6. SELECT ALL (Ctrl+A)
   - Memilih komponen pertama di circuit
   - (Untuk future: bisa diperluas untuk multiple selection)

AKSI-AKSI YANG DICATAT KE HISTORY:
- Menambah komponen (drag dari palette)
- Menghapus komponen/junction/wire
- Memutar komponen (R atau tombol Rotate)
- Membuat kabel baru
- Menggeser komponen/junction
- Mengubah parameter komponen (nilai resistor, dll)
- Clear circuit
- Copy/Cut/Paste
- Setiap perubahan di Properties panel

FILE-FILE YANG DITAMBAHKAN:
1. public/js/simulator/history.js
   - Manajemen undo/redo dengan snapshot-based approach
   - Fungsi: createHistory, pushSnapshot, undo, redo, canUndo, canRedo

2. public/js/simulator/clipboard.js
   - Manajemen clipboard untuk copy/paste/cut
   - Fungsi: createClipboard, copyToClipboard, copyAllToClipboard, getClipboardData, hasClipboardData, clearClipboard

FILE-FILE YANG DIMODIFIKASI:
1. public/js/simulator/main.js
   - Menambah import history dan clipboard
   - Menambah fungsi handleUndo, handleRedo, handleCopy, handleCut, handlePaste, handleSelectAll
   - Menambah saveToHistory() di aksi-aksi penting
   - Update setupInteraction dengan keyboardActions

2. public/js/simulator/interaction.js
   - Menambah parameter keyboardActions di setupInteraction
   - Menambah setHistoryCallback untuk menghubungkan dengan history
   - Menambah keyboard event listener untuk Ctrl+Z/Y/C/X/V/A
   - Menambah saveToHistoryCallback() call saat wire dibuat dan drag selesai

3. public/js/simulator/properties.js
   - Menambah handler onParamChangeStart
   - Memanggil saveToHistory() sebelum perubahan parameter

CARA PENGGUNAAN:
1. Buka simulator di browser
2. Gunakan keyboard shortcuts seperti biasa:
   - Ctrl+Z untuk undo
   - Ctrl+Y untuk redo
   - Ctrl+C untuk copy komponen yang dipilih
   - Ctrl+X untuk cut komponen
   - Ctrl+V untuk paste komponen (offset 40px)
   - Ctrl+A untuk select all

NOTES:
- History hanya menyimpan data circuit, tidak termasuk selection state
- Clipboard dapat menyimpan satu set komponen/junction/wire sekaligus
- Paste akan offset 40px untuk menghindari tumpang tindih dengan original
- Perubahan parameter (value, unit, toggle) juga dicatat ke history saat focus
