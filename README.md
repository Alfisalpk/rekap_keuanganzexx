# REKAP KEUANGAN TABUNGAN BERSAMA “ZEXX”

Aplikasi pencatatan dan evaluasi keuangan pribadi berbasis Google Apps Script dan Google Sheets. Antarmuka mengadaptasi dashboard TailAdmin: navigasi sidebar ringkas, kartu ringkasan, kalender bulanan, tabel, dan grafik.

## Fitur utama

- Dua ruang terpisah dalam satu aplikasi: **Tabungan Bersama** dan **Umroh Bersama**. Transaksi, pinjaman, ringkasan, dan ekspor tidak tercampur antarruang.
- Login admin/pengguna, penambahan dan pengelolaan pengguna oleh admin, serta ubah kata sandi. Kata sandi disimpan sebagai hash SHA-256 dengan salt acak; sesi berlaku sampai enam jam.
- Pencatatan transaksi uang masuk/keluar, kategori, keterangan, tanggal transaksi, dan nama pencatat. Transaksi mendapat ID angka berurutan dan kode seperti `TX-001`.
- Peminjaman dengan nama, tujuan/keterangan, jumlah, total cicilan, status lunas, dan sisa yang belum dikembalikan. Pencairan pinjaman otomatis dicatat sebagai pengeluaran; pengembalian dicatat sebagai pemasukan.
- Ringkasan saldo bersih, pemasukan/pengeluaran total dan bulan ini, serta daftar pinjaman yang masih aktif.
- Kalender interaktif: pilih tanggal untuk membuka formulir pencatatan transaksi.
- Indikator loading saat login dan saat aplikasi meminta data ke server.
- Statistik grafik arus kas bulanan, tren garis, komposisi kategori, perbandingan bulanan, dan radar.
- Ekspor catatan transaksi dan pinjaman menjadi XLSX atau PDF, dilengkapi tabel serta grafik arus kas bulanan 12 bulan terakhir.
- Backend membaca data dalam satu batch per tabel dan mengunci alokasi ID agar pencatatan bersamaan tidak memakai ID yang sama.

## Isi proyek

Empat file aplikasi Apps Script/HTML beserta dokumen ini (total lima file):

1. `Code.gs` — backend, autentikasi, database Sheets, dan ekspor.
2. `Index.html` — kerangka aplikasi.
3. `Styles.html` — gaya responsif.
4. `App.html` — navigasi dan interaksi aplikasi.
5. `README.md` — sorotan fitur serta panduan ini.

## Panduan instalasi

### 1. Buat project Apps Script

1. Buka [script.google.com](https://script.google.com) dengan akun Google yang akan memiliki aplikasi.
2. Pilih **New project** dan beri nama, misalnya `Rekap Keuangan ZEXX`.
3. Ubah file `Code.gs` bawaan dengan isi `Code.gs` dari folder proyek ini.
4. Buat tiga file HTML bernama **Index**, **Styles**, dan **App**. Salin isi masing-masing file proyek ke file HTML bernama sama. Apps Script menampilkan nama file tanpa akhiran `.html`.
5. Di **Project Settings**, tetapkan zona waktu **(GMT+07:00) Jakarta** agar tanggal catatan konsisten.

### 2. Siapkan database dan akun admin

1. Pilih fungsi `setup` di dropdown editor Apps Script, lalu klik **Run**.
2. Tinjau dan izinkan akses Google Sheets dan Drive yang diminta. Fungsi ini membuat spreadsheet `Data Rekap Keuangan ZEXX` dan tab `Pengguna`, `Transaksi`, serta `Peminjaman`.
3. Buka **Executions** atau **Execution log** dari pemanggilan `setup`. Catat username dan kata sandi admin awal yang tampil pada log. Username awal adalah `admin`; kata sandi dibuat acak pada setup pertama.
4. Simpan URL spreadsheet dari log hasil `setup` sebagai lokasi data. Spreadsheet tersebut dapat dibuka untuk pemeriksaan atau pencadangan; sebaiknya perubahan catatan dilakukan dari aplikasi.

Jika akun admin sudah dibuat tetapi kata sandi awal terlewat, pilih fungsi `resetAdminPassword` di editor Apps Script lalu klik **Run**. Kata sandi baru untuk username admin akan tampil di **Execution log**.

Jalankan `setup()` untuk instalasi baru. Jika setup gagal di tengah jalan, Anda boleh menjalankannya kembali: tab database yang hilang akan dibuat, sedangkan akun admin yang sudah ada tidak akan dibuat ulang.

### 3. Deploy sebagai web app

1. Klik **Deploy → New deployment**.
2. Pilih tipe **Web app**.
3. **Execute as:** *Me* (pemilik project), supaya pengguna aplikasi menggunakan database milik pemilik.
4. Pilih **Who has access** sesuai kebutuhan. Untuk aplikasi pribadi, gunakan akses akun Google sendiri. Bila beberapa anggota perlu masuk dari akun Google berbeda, pilih cakupan akses yang sesuai kebijakan organisasi/akun Anda. Login aplikasi tetap diperlukan.
5. Klik **Deploy**, selesaikan otorisasi, lalu buka URL Web app.
6. Masuk dengan akun admin awal dan segera ganti kata sandi melalui menu **Pengaturan**.

## Panduan penggunaan

### Catat keuangan

- Pilih ruang **Tabungan Bersama** atau **Umroh Bersama** dari sidebar. Masing-masing memiliki transaksi, pinjaman, kalender, statistik, dan ekspor sendiri.
- Klik **Catat transaksi** atau tanggal di menu **Kalender**. Isi tanggal, uang masuk/keluar, kategori, jumlah, pencatat, dan keterangan.
- Gunakan menu **Transaksi** untuk mencari berdasarkan teks, memfilter bulan, mengubah catatan, atau menghapus transaksi.
- ID transaksi internal berupa angka. Kode yang mudah dibaca memakai awalan `TX-` dan minimal tiga digit; misalnya ID 1 menjadi `TX-001`, ID 1000 menjadi `TX-1000`.

### Catat pinjaman dan pengembalian

- Dari **Peminjaman**, pilih **Catat pinjaman**, lalu isi peminjam, tanggal, jumlah, dan tujuan pinjaman.
- Saat pinjaman dibuat, aplikasi otomatis mencatat uang yang dipinjam sebagai transaksi keluar kategori **Pinjaman**.
- Tekan **Bayar** untuk mencatat pengembalian penuh atau sebagian. Pengembalian masuk ke transaksi sebagai pemasukan. Kolom sisa dihitung dari jumlah pinjaman dikurangi semua cicilan; status menjadi **Lunas** saat sisa nol.
- Menghapus data pinjaman tidak menghapus jejak transaksi pencairannya. Untuk koreksi histori, periksa transaksi terkait secara terpisah.

### Statistik dan ekspor

- **Statistik** menampilkan tren 12 bulan, kategori pengeluaran, perbandingan pemasukan/pengeluaran/saldo, rasio saldo bersih terhadap pemasukan, dan profil kategori.
- **Rekap & ekspor** mengunduh tabel transaksi, daftar pinjaman, dan grafik arus kas bulanan dalam file XLSX atau PDF. Grafik analisis interaktif tersedia pada menu Statistik.

### Pengguna

- Admin membuka **Pengguna** untuk menambahkan akun, mengubah nama/username/kata sandi, menonaktifkan akun, atau menghapus akun.
- Pengguna biasa dapat mencatat keuangan dan mengganti kata sandinya, tetapi tidak dapat mengelola akun pengguna.

## Catatan operasional

- UI memuat Chart.js, Font Awesome, dan font dari CDN; akses internet diperlukan agar pustaka grafik, ikon, dan font eksternal termuat. Pencatatan serta pembacaan data ditangani Apps Script/Sheets.
- Google Sheets adalah database untuk pemakaian pribadi atau tim kecil. Aplikasi ini tidak menggantikan pembukuan akuntansi, tidak mengimpor rekening secara otomatis, dan tidak merekonsiliasi saldo awal. Nilai saldo bersih dihitung dari total transaksi masuk dikurangi transaksi keluar sejak pencatatan dimulai.
- Simpan salinan spreadsheet berkala. Batasi akses spreadsheet dan web app kepada orang yang dipercaya.
- Jika mengubah kode Apps Script setelah deployment, buat versi deployment baru melalui **Deploy → Manage deployments → Edit → New version**.
