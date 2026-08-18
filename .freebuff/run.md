# วิธีรันโปรเจกต์ (run doc)

## เตรียม dependencies

```bash
npm install                 # dependencies ฝั่งเซิร์ฟเวอร์ (express, fast-xml-parser)
npm run setup               # สร้าง venv + ติดตั้ง yt-dlp (ครั้งแรกครั้งเดียว)
```

## สร้างหน้าเว็บ (frontend build)

หน้าเว็บเป็น React + MUI อยู่ในโฟลเดอร์ `web/` ผล build ไปที่ `web/dist/`
เซิร์ฟเวอร์จะเสิร์ฟ `web/dist` ถ้ามี ไม่เช่นนั้นจะมองหาโฟลเดอร์ `public/` (ซึ่งถูกลบแล้ว)

```bash
npm run build:web           # = cd web && npm install && npm run build
```

ถ้าแก้โค้ดใน `web/src/` ต้อง build ใหม่ทุกครั้ง (`cd web && npm run build`)
ระหว่างพัฒนาใช้ `cd web && npm run dev` (พอร์ต 5174, proxy /api ไปพอร์ต 5173)

## รันเซิร์ฟเวอร์

```bash
npm start                   # พอร์ต 5173 (เปลี่ยนได้ด้วย PORT=xxxx npm start)
```

- เปิดที่ http://localhost:5173 (หรือ http://<IPเครื่อง>:5173 จากเครื่องอื่นในเน็ต)
- ต้อง build หน้าเว็บก่อน (`npm run build:web`) ไม่งั้นจะได้หน้าเปล่า
