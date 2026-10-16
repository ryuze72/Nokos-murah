# Cara Deploy ke Vercel

## 1. Import project
1. Buka https://vercel.com/new
2. Import repository **ryuze72/Nokos-murah**
3. Framework Preset: **Other** (atau biarkan auto)
4. Root Directory: `.` (default)

## 2. Environment Variable (WAJIB)
Tambahkan di Project Settings → Environment Variables:

| Name | Value |
|------|-------|
| `SMSCODE_API_KEY` | `45b3c202c81f718c98742e46f3113f65329866cd66c8d255420ca40499e0b826` |

Centang Production, Preview, Development.

## 3. Deploy
Klik **Deploy**. Vercel otomatis `npm install` + build.

## 4. Upload QRIS (penting)
1. Buka repo → folder `public/`
2. Upload file gambar QRIS kamu dengan nama **`qris-deposit.jpg`**
3. (Ganti file placeholder yang ada)

Atau via terminal:
```bash
git clone https://github.com/ryuze72/Nokos-murah.git
cd Nokos-murah
# copy QRIS kamu ke public/qris-deposit.jpg
git add public/qris-deposit.jpg
git commit -m "Add real QRIS image"
git push
```
Vercel akan auto-redeploy.

## Selesai
Website live di `https://nokos-murah-xxxx.vercel.app`
