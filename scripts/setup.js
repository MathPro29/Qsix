// สร้าง Python venv ในโฟลเดอร์โปรเจกต์ แล้วติดตั้ง yt-dlp (ใช้สำหรับดึงข้อมูล/สตรีมเพลงจากหลาย platform)
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const venvDir = path.join(root, 'venv');
const py = process.platform === 'win32'
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

function run(cmd) {
  console.log('>', cmd);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

if (!fs.existsSync(venvDir)) {
  run(`${process.env.PYTHON || 'python'} -m venv venv`);
} else {
  console.log('venv มีอยู่แล้ว');
}

run(`"${py}" -m pip install --quiet --upgrade pip`);
run(`"${py}" -m pip install --quiet --upgrade yt-dlp`);

// ยืนยัน
execSync(`"${py}" -m yt_dlp --version`, { cwd: root, stdio: 'inherit' });
console.log('\nSetup เสร็จเรียบร้อย! รัน `npm start` ได้เลย');
