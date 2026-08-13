# 📱 WA Gateway

WhatsApp Gateway microservice berbasis **NestJS + Baileys** untuk mengirim notifikasi otomatis dari platform [walikelas.id](https://walikelas.id) ke orang tua siswa.

## ✨ Fitur Utama

- **Session per Kelas** — Setiap `kelasId` memiliki session WhatsApp sendiri
- **Lazy Loading** — Socket hanya aktif saat dibutuhkan (kirim pesan / scan QR)
- **Auto-Sleep 5 Menit** — Socket idle otomatis ditutup untuk hemat RAM, credential tetap tersimpan
- **Auto-Reconnect** — Disconnect sementara akan otomatis reconnect
- **API Key Guard** — Semua endpoint dilindungi header `x-api-key` dengan timing-safe comparison
- **HTTP Hardening** — Helmet + CORS + ValidationPipe (whitelist & forbidNonWhitelisted)

## 📋 Prasyarat

- Node.js >= 20
- npm

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env, isi GATEWAY_API_KEY dengan secret key kamu

# 3. Jalankan
npm run start:dev
```

Server berjalan di `http://localhost:3000/api`

## 🔑 Environment Variables

| Variable | Deskripsi | Default |
|---|---|---|
| `PORT` | Port server | `3000` |
| `GATEWAY_API_KEY` | API key untuk autentikasi | *(wajib diisi)* |

## 📡 API Endpoints

> Semua endpoint membutuhkan header `x-api-key: <GATEWAY_API_KEY>`

### Session Management

#### Start Session
```
POST /api/whatsapp/session/start
Body: { "kelasId": 1 }
```
Response:
```json
{
  "connected": false,
  "kelasId": 1,
  "status": "qr_ready",
  "message": "Session dimulai. Silakan scan QR code via GET /api/whatsapp/session/qr/1"
}
```

#### Get QR Code
```
GET /api/whatsapp/session/qr/:kelasId
```
Response:
```json
{ "qr": "data:image/png;base64,..." }
```
> 💡 Copy value `qr`, paste di address bar browser → muncul QR code. Scan dari WhatsApp → Linked Devices → Link a Device.

#### Logout Session
```
DELETE /api/whatsapp/session/:kelasId
```
> ⚠️ Menghapus socket + credential dari disk. Harus scan QR ulang.

### Messaging

#### Send Text Message
```
POST /api/messages/send
Body: { "kelasId": 1, "phone": "6281234567890", "message": "Halo!" }
```
Response:
```json
{ "success": true, "message": "Message sent successfully", "to": "6281234567890@s.whatsapp.net", "kelasId": 1 }
```

## 🔄 Flow Penggunaan

```
POST /session/start → GET /session/qr/:id → Scan QR → POST /messages/send
```

1. **Start session** — inisiasi socket, generate QR
2. **Ambil QR** — tampilkan ke user untuk di-scan
3. **Scan QR** — dari WhatsApp di HP
4. **Kirim pesan** — bisa kirim berulang kali selama session aktif
5. Session idle 5 menit → socket auto-close (credential tetap ada, reconnect otomatis saat kirim pesan berikutnya)

## 🏗️ Struktur Proyek

```
src/
├── config/
│   └── configuration.ts        # ENV configuration factory
├── auth/
│   ├── guards/
│   │   └── api-key.guard.ts    # x-api-key validation (timing-safe)
│   └── auth.module.ts
├── whatsapp/
│   ├── whatsapp.service.ts     # Session lifecycle management
│   ├── whatsapp.controller.ts  # Session endpoints
│   └── whatsapp.module.ts
├── messages/
│   ├── dto/
│   │   └── send-message.dto.ts # Request validation
│   ├── messages.service.ts     # Send message logic
│   ├── messages.controller.ts  # Send endpoint
│   └── messages.module.ts
├── app.module.ts               # Root module assembly
└── main.ts                     # Bootstrap + Helmet + CORS + ValidationPipe
```

## 🚢 Production

```bash
npm run build
node dist/main.js

# Atau dengan PM2
pm2 start dist/main.js --name wa-gateway
```

## 📄 License

UNLICENSED — Private project for [walikelas.id](https://walikelas.id)
