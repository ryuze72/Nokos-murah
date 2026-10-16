# NOKOS SMSCode

Website nomor virtual (NOKOS) menggunakan API SMSCode.gg + deposit QRIS manual.

## Fitur

- Lihat saldo real-time (USD + konversi IDR)
- **Deposit via QRIS** (TOKO RYUZE / DANA Bisnis)
  - Scan QRIS → bayar → upload screenshot bukti pembayaran
  - Form wajib isi:
    - Nominal deposit
    - Nomor WhatsApp
    - Email
    - Bank / E-Wallet pengirim
- Pilih negara & layanan (WhatsApp, Telegram, Shopee, TikTok, dll)
- Lihat harga + stok real-time
- Beli nomor dengan 1 klik
- Polling otomatis sampai OTP masuk
- Tombol Cancel / Finish / Resend / Salin
- Riwayat pesanan

## Cara Menjalankan

```bash
cd nokos-smscode
npm install
npm start
```

Buka: **http://localhost:3000**

## Deposit Flow

1. User buka tab **Deposit**
2. Scan QRIS TOKO RYUZE (DANA Bisnis)
3. Transfer nominal yang diinginkan
4. Screenshot bukti pembayaran
5. Isi form (nominal, WA, email, bank/e-wallet)
6. Upload screenshot → Kirim
7. Data tersimpan di `deposits.json` + folder `proofs/`
8. Admin cek & top-up manual di dashboard SMSCode

## File Penting

| File | Keterangan |
|------|------------|
| `deposits.json` | Semua request deposit |
| `proofs/` | Screenshot bukti pembayaran |
| `.env` | API Key SMSCode |
| `public/qris-deposit.jpg` | Gambar QRIS |

## Catatan

- Saldo SMSCode harus diisi manual oleh admin setelah verifikasi deposit.
- Minimal deposit: Rp 10.000
- API Key disimpan di backend (aman).
- Set `SMSCODE_API_KEY` di environment Vercel (jangan commit .env).
