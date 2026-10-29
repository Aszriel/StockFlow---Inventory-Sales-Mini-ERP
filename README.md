# StockFlow - Mini ERP Module

StockFlow adalah sistem modul Mini ERP modern untuk manajemen produk, penyesuaian stok (*stock adjustments*), dan pencatatan pesanan penjualan (*sales orders*) dengan penanganan konkurensi data tingkat tinggi, transaksi atomik ACID, dan antarmuka web yang intuitif dan responsif.

---

## 📑 Daftar Isi
- [Arsitektur & Tata Letak Direktori](#arsitektur--tata-letak-direktori)
- [Teknologi yang Digunakan](#teknologi-yang-digunakan)
- [Panduan Menjalankan Aplikasi (< 5 Menit)](#panduan-menjalankan-aplikasi--5-menit)
  - [Opsi 1: Menjalankan via Docker Compose (Rekomendasi)](#opsi-1-menjalankan-via-docker-compose-rekomendasi)
  - [Opsi 2: Menjalankan Secara Lokal (Manual)](#opsi-2-menjalankan-secara-lokal-manual)
- [Contoh Perintah cURL (API Testing)](#contoh-perintah-curl-api-testing)
- [Keputusan Desain Teknis (Design Decisions)](#keputusan-desain-teknis-design-decisions)
  - [1. Pencegahan Race Condition & Negative Stock](#1-pencegahan-race-condition--negative-stock)
  - [2. Pencegahan Deadlock pada Transaksi Multi-Item](#2-pencegahan-deadlock-pada-transaksi-multi-item)
  - [3. Keamanan Nilai Uang Tanpa Tipe Data Float](#3-keamanan-nilai-uang-tanpa-tipe-data-float)
  - [4. Kontrak Error Kustom & Integritas Riwayat](#4-kontrak-error-kustom--integritas-riwayat)
- [Pengujian / Testing](#pengujian--testing)
  - [Backend Tests (Unit & Concurrency Race Detection)](#backend-tests-unit--concurrency-race-detection)
  - [Frontend Tests (Vitest)](#frontend-tests-vitest)
- [Rencana Pengembangan Selanjutnya (What I Would Do Next)](#rencana-pengembangan-selanjutnya-what-i-would-do-next)
- [Estimasi Waktu Pengerjaan](#estimasi-waktu-pengerjaan)

---

## 📁 Arsitektur & Tata Letak Direktori

```text
stockflow/
├── backend/                  # Service Go API
│   ├── cmd/server/           # Entrypoint main.go
│   ├── internal/
│   │   ├── config/           # Konfigurasi environment & DSN
│   │   ├── handler/          # HTTP Handler (REST endpoints) & Error Responses
│   │   ├── middleware/       # CORS, Logging, Panic recovery
│   │   ├── model/            # Domain models, Request/Response payloads
│   │   └── repository/       # Database queries, Row lock (FOR UPDATE), Transaksi
│   ├── Dockerfile            # Multi-stage lightweight build Go
│   ├── go.mod
│   └── go.sum
├── frontend/                 # React + TypeScript (Vite)
│   ├── src/
│   │   ├── components/       # SummaryCards, ProductTable, Modals
│   │   ├── services/         # Centralized API client & Error parser
│   │   ├── types/            # TypeScript domain interfaces
│   │   ├── utils/            # Formatters (IDR currency, relative time)
│   │   ├── App.tsx           # Main component & state orchestrator
│   │   └── index.css         # Modern vanilla CSS design system
│   ├── Dockerfile            # Multi-stage production build (Nginx)
│   ├── package.json
│   └── vite.config.ts        # Reverse proxy config to backend
├── db/
│   └── init/
│       ├── 01_schema.sql     # Skema DDL & database CHECK constraints
│       └── 02_seed.sql       # 14+ produk realistis, stok variatif, data transaksi
├── docker-compose.yml        # Orchestration PostgreSQL, Go Backend, React Frontend
├── prd.md                    # Dokumen spesifikasi teknis
└── README.md                 # Dokumentasi teknis lengkap
```

---

## 🛠 Teknologi yang Digunakan

- **Backend**: Go 1.24, `chi` router v5, `lib/pq` (driver PostgreSQL murni tanpa ORM overhead untuk kontrol transaksi atomik penuh).
- **Database**: PostgreSQL 16 (dengan `CHECK (price >= 0)`, `CHECK (stock >= 0)`, `CHECK (qty > 0)`).
- **Frontend**: React 19, TypeScript (Strict Mode), Vite 8, Lucide React Icons.
- **Styling**: Vanilla CSS Design System (Custom variables, Dark Slate theme, Responsive, Glassmorphism).
- **Pengujian**: Go test `-race` (Concurrency detector), `httptest`, Vitest (Frontend unit tests).
- **Containerization**: Docker & Docker Compose.

---

## 🚀 Panduan Menjalankan Aplikasi (< 5 Menit)

### Opsi 1: Menjalankan via Docker Compose (Rekomendasi)

Cukup satu perintah dari direktori root:

```bash
docker compose up --build
```

Setelah menyala:
- **Frontend Web UI**: Buka di browser `http://localhost:5173`
- **Backend API**: Berjalan di `http://localhost:8080`
- **PostgreSQL**: Port `5432` (Username: `postgres`, Password: `postgres`, DB: `stockflow`)

*Catatan: Skrip migrasi skema dan seed data 14+ produk otomatis dieksekusi saat container pertama kali menyala.*

---

### Opsi 2: Menjalankan Secara Lokal (Manual)

#### 1. Nyalakan Database PostgreSQL
Jika menggunakan Docker hanya untuk database:
```bash
docker compose up -d db
```
Atau jika menggunakan PostgreSQL lokal, jalankan skrip SQL:
```bash
psql -U postgres -d stockflow -f db/init/01_schema.sql
psql -U postgres -d stockflow -f db/init/02_seed.sql
```

#### 2. Jalankan Backend (Go)
```bash
cd backend
go run cmd/server/main.go
```
*Server API aktif di `http://localhost:8080`.*

#### 3. Jalankan Frontend (React + Vite)
Di terminal baru:
```bash
cd frontend
npm install
npm run dev
```
*Aplikasi web aktif di `http://localhost:5173`.*

---

## 📡 Contoh Perintah cURL (API Testing)

### 1. Ambil Ringkasan Dashboard (Summary Metrics)
```bash
curl -X GET http://localhost:8080/api/products/summary
```

### 2. Ambil Daftar Produk (Paginasi, Pencarian, & Filter)
```bash
# Semua produk (page 1, limit 10)
curl -X GET "http://localhost:8080/api/products?page=1&limit=10"

# Filter low stock (stok <= 10)
curl -X GET "http://localhost:8080/api/products?filter=low_stock"

# Pencarian produk berdasarkan nama/SKU
curl -X GET "http://localhost:8080/api/products?search=keyboard"
```

### 3. Tambah Produk Baru
```bash
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "ELEC-WCH-015",
    "name": "Apple Watch Ultra 2 GPS 49mm",
    "price": 14999000,
    "stock": 12,
    "is_active": true
  }'
```

### 4. Penyesuaian Stok (Stock Adjustment)
```bash
# Tambah stok (+5)
curl -X POST http://localhost:8080/api/products/1/stock \
  -H "Content-Type: application/json" \
  -d '{
    "type": "in",
    "qty": 5,
    "note": "Restock supplier resmi batch #301"
  }'

# Kurang stok (-2)
curl -X POST http://localhost:8080/api/products/1/stock \
  -H "Content-Type: application/json" \
  -d '{
    "type": "out",
    "qty": 2,
    "note": "Pemeriksaan QC internal"
  }'
```

*Jika jumlah pengurangan melebihi sisa stok, server mengembalikan respon `409 Conflict`:*
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Stock is not sufficient for requested quantity",
    "sku": "ELEC-KB-001",
    "available": 25
  }
}
```

### 5. Buat Sales Order (Transaksi Atomik Multi-Item)
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "PT Maju Bersama Sukses",
    "items": [
      { "sku": "ELEC-KB-001", "qty": 2 },
      { "sku": "ELEC-MS-002", "qty": 1 }
    ]
  }'
```

### 6. Batalkan Sales Order (Stok Dikembalikan Otomatis)
```bash
curl -X POST http://localhost:8080/api/orders/1/cancel
```

### 7. Hapus Produk (Validasi Riwayat Mutasi)
```bash
curl -X DELETE http://localhost:8080/api/products/1
```
*Jika produk memiliki riwayat mutasi stok atau order, server mengembalikan `409 Conflict`:*
```json
{
  "error": {
    "code": "PRODUCT_HAS_HISTORY",
    "message": "Cannot delete product because it has stock movement or order history"
  }
}
```

---

## 🧠 Keputusan Desain Teknis (Design Decisions)

### 1. Pencegahan Race Condition & Negative Stock
Masalah klasik pada sistem e-commerce/ERP adalah **overselling** ketika beberapa permintaan pemesanan masuk secara bersamaan (*concurrent*).
- **Anti-Pattern Terlarang**: Pola `SELECT stock` di aplikasi, validasi if-condition di memori Go, lalu eksekusi `UPDATE stock`. Pola ini rentan terhadap race condition karena dua goroutine dapat membaca nilai stok yang sama sebelum goroutine pertama sempat menulis pembaruan.
- **Solusi yang Diterapkan**:
  1. Penggunaan transaksi atomik database (`BEGIN ... COMMIT / ROLLBACK`).
  2. Penerapan **Pessimistic Row Locking** langsung pada tingkat database:
     ```sql
     SELECT id, price, stock, is_active FROM products WHERE sku = $1 FOR UPDATE
     ```
  3. Baris produk dikunci secara eksklusif selama transaksi berlangsung. Permintaan konkuren lain yang mencoba membaca SKU tersebut untuk dipesan akan mengantre hingga transaksi pertama selesai.
  4. Garansi lapis kedua pada Database Engine: Constraint DDL `CHECK (stock >= 0)`.

### 2. Pencegahan Deadlock pada Transaksi Multi-Item
Saat pesanan memuat banyak item:
- Jika Order A memesan `SKU-1` lalu `SKU-2`, sedangkan Order B secara bersamaan memesan `SKU-2` lalu `SKU-1`, database dapat mengalami **Deadlock**.
- **Solusi**: Di dalam repository Go (`order_repo.go`), seluruh SKU pesanan **diurutkan secara alfabetis (sort)** sebelum dilakukan eksekusi row lock:
  ```go
  sort.Strings(skus)
  ```
  Dengan urutan penguncian yang konsisten dan deterministik, siklus deadlock antar transaksi konkuren tereliminasi sepenuhnya.

### 3. Keamanan Nilai Uang Tanpa Tipe Data Float
Penggunaan tipe data `FLOAT` atau `DOUBLE` untuk mata uang sangat dihindari karena masalah presisi aritmatika floating point IEEE 754 (contoh: `0.1 + 0.2 = 0.30000000000000004`).
- Seluruh harga diatur bertipe `INTEGER` (mata uang Rupiah / IDR tidak memerlukan desimal sen).
- Perhitungan total pesanan (`total_inventory_value`) menggunakan konversi `BIGINT` di database agar aman dari integer overflow.
- `unit_price` dan `total` dihitung mutlak secara server-side dari database untuk mencegah manipulasi harga dari sisi klien.

### 4. Kontrak Error Kustom & Integritas Riwayat
Seluruh endpoint API mengembalikan format envelope error yang konsisten:
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "...",
    "sku": "...",
    "available": 0
  }
}
```
Pada antarmuka frontend, parsing error terpusat (`ApiClientError`) secara otomatis mendeteksi kode `INSUFFICIENT_STOCK` atau `PRODUCT_HAS_HISTORY`, menyorot kolom input yang bermasalah, dan menampilkan notifikasi yang jelas dan bersahabat kepada pengguna.

---

## 🧪 Pengujian / Testing

### Backend Tests (Unit & Concurrency Race Detection)

Uji seluruh unit test dan race detector di direktori `backend/`:

```bash
cd backend
go test -v -race ./...
```

Pengujian mencakup:
- Validasi input pesanan (nama pelanggan kosong, SKU duplikat, qty negatif).
- Struktur envelope error kustom (HTTP 400 & HTTP 409).
- **Concurrency Integration Test**: Menjalankan 25 goroutine secara serentak yang memperebutkan 10 stok produk. Memverifikasi bahwa tepat 10 order berhasil, 15 order ditolak dengan 409 `INSUFFICIENT_STOCK`, dan sisa stok akhir tepat 0 (tidak pernah negatif).

### Frontend Tests (Vitest)

Uji unit test utilitas frontend di direktori `frontend/`:

```bash
cd frontend
npm run test
```

Mencakup pengujian utilitas formatting mata uang `formatIDR()`, format waktu relatif `formatRelativeTime()`, dan format waktu absolut `formatDateTime()`.

---

## 🔮 Rencana Pengembangan Selanjutnya (What I Would Do Next)

Jika diberikan waktu pengembangan lebih lanjut, beberapa fitur yang akan diimplementasikan antara lain:
1. **Autentikasi & Otorisasi Berbasis Peran (RBAC)**: Menambahkan JWT authentication dengan peran pengguna seperti *Warehouse Staff* (hanya mutasi stok) dan *Sales Admin* (hanya pesanan dan katalog).
2. **Export Laporan (CSV / PDF)**: Fitur ekspor mutasi stok dan ringkasan pesanan penjualan untuk audit akuntansi berkala.
3. **Database Migration Tool Formal**: Mengintegrasikan `golang-migrate` untuk manajemen versi skema database yang bertahap saat deploy di production.
4. **WebSocket / Server-Sent Events (SSE)**: Notifikasi *real-time* saat stok barang menipis di bawah ambang batas (low stock alert) atau saat pesanan baru masuk dari cabang lain.
5. **Batch CSV Import**: Kemampuan import massal ribuan data produk sekaligus dari file spreadsheet.

---

## ⏱ Estimasi Waktu Pengerjaan

| Tahapan Pengerjaan | Deskripsi | Estimasi Waktu |
|---|---|---|
| **Tahap 1** | Setup Repositori, Docker Compose, Schema SQL (Constraints) & Seed Data | ~45 menit |
| **Tahap 2** | Arsitektur Go Backend, Endpoint Produk, Mutasi Stok & Transaksi Sales Order | ~2 jam |
| **Tahap 3** | Unit Test Go & Concurrency Race Condition Testing (`go test -race`) | ~35 menit |
| **Tahap 4** | Setup Vite React-TS, Domain Types, & Centralized API Client Error Parser | ~40 menit |
| **Tahap 5** | Implementasi UI (Summary Cards, Tabel Produk, Modal Adjust & Sales Order) | ~1.5 jam |
| **Tahap 6** | Unit Test Vitest, Verifikasi Build, Commit Git & Dokumentasi README.md | ~30 menit |
| **Total** | **Selesai dalam standar batas waktu penilaian** | **~5.5 jam** |
