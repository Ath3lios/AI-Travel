# AI Travel Planner

Ứng dụng lập kế hoạch du lịch bằng AI với kiến trúc tách riêng:

- `frontend`: React + Vite
- `backend`: FastAPI + SQLite
- `AI`: Gemini để sinh lịch trình
- `Maps`: Goong cho autocomplete, geocode, route và map hiển thị

## Tính năng hiện tại

- Đăng ký, đăng nhập và xác thực bằng JWT
- Tạo lịch trình du lịch theo:
  - điểm đến
  - thành phố xuất phát
  - số ngày
  - số người
  - ngân sách
  - phong cách du lịch
- Xem danh sách chuyến đi và chi tiết lịch trình theo ngày
- Sửa và regenerate lịch trình bằng AI
- Hiển thị bản đồ lộ trình bằng Goong Maps trên trang chi tiết trip
- Dashboard người dùng với travel guides mẫu
- Admin dashboard:
  - thống kê tổng quan hệ thống
  - quản lý user
  - quản lý trip
  - quản lý catalog `destinations`, `hotels`, `activities`
  - audit log
  - export CSV
  - import CSV cho catalog
  - backup file SQLite
- Đồng bộ dữ liệu catalog từ itinerary AI sau khi tạo hoặc regenerate trip

## Cấu trúc thư mục

```text
ai-travel-planner/
|-- backend/
|   |-- main.py
|   |-- config.py
|   |-- database.py
|   |-- routers/
|   |-- services/
|   `-- requirements.txt
|-- frontend/
|   |-- src/
|   |-- public/
|   `-- package.json
`-- README.md
```

## Yêu cầu môi trường

- Python 3.10+
- Node.js 18+
- npm 9+

## Thiết lập backend

```bash
cd backend
python -m venv ../venv
```

Kích hoạt môi trường ảo:

- Windows PowerShell

```powershell
..\venv\Scripts\Activate.ps1
```

- macOS/Linux

```bash
source ../venv/bin/activate
```

Cài dependencies:

```bash
pip install -r requirements.txt
```

Tạo file `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

ADMIN_EMAILS=admin@example.com
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

GOONG_API_KEY=your_goong_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
EXCHANGERATE_API_KEY=your_exchangerate_api_key

GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODEL=gemini-2.5-flash-lite
```

Ghi chú:

- `GEMINI_API_KEY` gần như bắt buộc nếu muốn sinh itinerary bằng AI.
- `GOONG_API_KEY` cần cho autocomplete địa điểm, geocode, route và một phần trải nghiệm map.
- `OPENWEATHER_API_KEY` và `EXCHANGERATE_API_KEY` là tùy chọn, dùng để cải thiện dữ liệu phụ trợ trong pipeline itinerary.
- `ADMIN_EMAILS` là danh sách email phân tách bằng dấu phẩy; user đăng nhập bằng các email này sẽ được gán role `admin`.

Chạy backend:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend mặc định chạy tại `http://localhost:8000`

Các route chính:

- `/auth`
- `/trips`
- `/maps`
- `/catalog`
- `/admin`

## Thiết lập frontend

```bash
cd frontend
npm install
```

Tạo file `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_GOONG_MAP_KEY=your_goong_map_key
VITE_UNSPLASH_ACCESS_KEY=your_unsplash_access_key
```

Ghi chú:

- `VITE_API_URL` là bắt buộc.
- `VITE_GOONG_MAP_KEY` cần nếu muốn render bản đồ Goong trong giao diện trip detail.
- `VITE_UNSPLASH_ACCESS_KEY` là tùy chọn; nếu không có thì frontend vẫn có ảnh fallback local và ảnh từ Wikipedia khi lấy được.

Chạy frontend:

```bash
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173`

## Scripts thường dùng

Frontend:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

Backend:

- `uvicorn main:app --reload --host 0.0.0.0 --port 8000`

## Luồng sử dụng nhanh

1. Chạy backend ở thư mục `backend`
2. Chạy frontend ở thư mục `frontend`
3. Đăng ký tài khoản mới
4. Nếu muốn vào trang admin, thêm email của tài khoản vào `ADMIN_EMAILS`
5. Tạo trip tại `/dashboard`

## Ghi chú vận hành

- SQLite được cấu hình tại `backend/travel_planner.db`
- Backend sẽ tự tạo bảng khi startup
- CORS mặc định cho phép:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
- Nếu thiếu `GOONG_API_KEY`, các API map sẽ báo lỗi cấu hình
- Nếu thiếu `GEMINI_API_KEY`, chất lượng hoặc khả năng sinh itinerary sẽ bị ảnh hưởng rõ rệt
- Admin dashboard có thể cảnh báo thiếu API key và số lượng lỗi API gần đây
