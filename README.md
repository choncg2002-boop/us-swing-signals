# US Swing Signals

Swing trading signal platform for US stocks (1–3 month horizon) with S&P 500 scanning, WebSocket live prices, and a premium React dashboard.

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, yfinance, APScheduler |
| Frontend | React, Vite, Tailwind, Lightweight Charts |
| Real-time | WebSocket (`/ws/prices`, `/ws/signals`) |
| Deploy | Docker Compose, Render |

## Quick Start (Local)

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

API docs: **http://localhost:8000/docs**

## Deploy ถาวร (ใช้จากเครื่องอื่นได้)

ดูคู่มือเต็ม: **[DEPLOY.md](./DEPLOY.md)**

| วิธี | คำสั่ง |
|------|--------|
| **ออนไลน์ (Render ฟรี)** | Push GitHub → Render Blueprint จาก `render.yaml` |
| **WiFi บ้าน (Docker)** | ดับเบิลคลิก `deploy-local.bat` |

## Docker Deploy (Local / VPS)

```bash
docker compose up --build -d
```

- Frontend: http://localhost
- Backend API: http://localhost:8000
- WebSocket: ws://localhost/ws/prices (via nginx)

Optional Redis:

```bash
docker compose --profile with-redis up -d
```

## Features

### S&P 500 Universe

- Bundled list: `backend/app/data/sp500_tickers.json` (503 tickers)
- Auto-refresh from Wikipedia weekly (with User-Agent)
- `GET /api/v1/universe` — list tickers
- `GET /api/v1/signals` — scan full S&P 500 (batch-optimized via `yf.download`)

Update ticker list manually:

```powershell
cd backend
python -m scripts.update_sp500
```

### WebSocket Real-time

**Prices** — `ws://host/ws/prices`

```json
{"action": "subscribe", "tickers": ["AAPL", "MSFT"]}
```

Server pushes:

```json
{"type": "price_update", "data": {"ticker": "AAPL", "price": 198.5, ...}}
```

**Signals** — `ws://host/ws/signals`

Pushes `scan_complete` after scheduled daily scan (06:00 UTC).

Background jobs (APScheduler):

- Price poll every 60s for subscribed tickers
- Full S&P 500 scan daily

### Environment Variables

See `backend/.env.example` and `frontend/.env.example`.

| Variable | Description |
|----------|-------------|
| `USE_SP500_UNIVERSE` | Scan S&P 500 (default: true) |
| `PRICE_POLL_INTERVAL_SEC` | WebSocket price poll interval |
| `RUNTIME_DIR` | ASCII-safe runtime path (Windows Thai paths) |
| `CACHE_DIR` | Override file cache location |
| `BATCH_SIZE` | yfinance batch size (default: 50) |

## Render Deploy

1. Push repo ไป GitHub (โฟลเดอร์ `หุ้นสหรัฐ` เท่านั้น)
2. [Render](https://render.com) → New → Blueprint → เลือก repo
3. ได้ URL `https://xxx.onrender.com` ใช้ได้ทุกเครื่อง

รายละเอียด: **[DEPLOY.md](./DEPLOY.md)**

## Project Structure

```
backend/app/
  api/          REST + WebSocket routes
  core/         cache, paths, websocket manager
  data/         yfinance client, S&P 500 universe
  services/     APScheduler jobs
  strategy/     signal scanner

frontend/src/
  components/   chart, signals, layout
  hooks/        usePriceStream, useSignalStream
  pages/        Dashboard
```

## Notes

- First S&P 500 scan may take several minutes (503 tickers, rate-limited batches)
- yfinance on Windows with Thai folder paths: runtime cache auto-moves to `%LOCALAPPDATA%`
- Not financial advice — for educational/research use
