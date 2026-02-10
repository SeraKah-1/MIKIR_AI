# Deployment Guide for GlassQuiz AI

Aplikasi ini membutuhkan konfigurasi Environment Variables (Rahasia) agar dapat berjalan dengan fitur penuh.

## 1. Wajib: Google Gemini API Key
Aplikasi ini tidak akan bisa membuat soal tanpa API Key ini.

1.  Kunjungi [Google AI Studio](https://aistudio.google.com/).
2.  Klik **"Get API key"** -> **"Create API key"**.
3.  Copy kunci tersebut.

## 2. Opsional: Supabase Database
Jika Anda ingin menyimpan riwayat kuis yang dibuat (untuk analisa di masa depan), konfigurasi Supabase diperlukan. **Jika dilewati, aplikasi tetap bisa berjalan (hanya pembuatan kuis, tidak disimpan).**

1.  Kunjungi [Supabase](https://supabase.com/) dan buat proyek baru.
2.  Masuk ke **Project Settings** -> **API**.
3.  Anda membutuhkan dua nilai:
    *   **Project URL** (`https://xyz.supabase.co`)
    *   **anon public Key**
4.  Buka **SQL Editor** di sidebar kiri Supabase, copy-paste isi file `supabase_schema.sql` dan klik **Run**. Ini akan membuat tabel yang dibutuhkan.

## 3. Cara Mengatur Environment Variables

### A. Jika Local Development (Di komputer sendiri)
1.  Buat file bernama `.env` di folder utama (sejajar dengan `package.json`).
2.  Isi file tersebut seperti contoh di bawah:

```env
API_KEY=AIzaSyDxxxxxxxxx...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### B. Jika Deploy di Vercel / Netlify
1.  Masuk ke Dashboard proyek Anda di Vercel/Netlify.
2.  Cari menu **Settings** -> **Environment Variables**.
3.  Tambahkan Key dan Value satu per satu:
    *   Key: `API_KEY`, Value: (Key dari Google)
    *   Key: `SUPABASE_URL`, Value: (URL dari Supabase)
    *   Key: `SUPABASE_KEY`, Value: (Key Anon dari Supabase)
4.  Redeploy aplikasi Anda.

### C. Jika Deploy di Streamlit Community Cloud
1.  Di dashboard aplikasi, klik **Settings** -> **Secrets**.
2.  Masukkan format TOML berikut:

```toml
API_KEY = "AIzaSyDxxxxxxxxx..."
SUPABASE_URL = "https://your-project.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```
*(Catatan: Aplikasi React murni biasanya tidak di-hosting di Streamlit Cloud, tapi jika Anda menggunakan wrapper Python, ini caranya).*
