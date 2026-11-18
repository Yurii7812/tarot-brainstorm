const { app, BrowserWindow, Menu, protocol, net, ipcMain, dialog, session } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

// app://local/ をこのフォルダの中身に対応させる（画像出力の fetch が file:// だと使えないため）
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1400, height: 950, title: 'タロット・ブレインストーミング', backgroundColor: '#faf9f6', show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false, offscreen: !!process.env.TAROT_TEST },
    paintWhenInitiallyHidden: true,
  });
  // TAROT_TEST=1 のときは窓を出さない（試験で利用者の画面を邪魔しない）
  if (process.env.TAROT_TEST) win.setSize(1600, 1000); else { win.maximize(); win.once('ready-to-show', () => win.show()); }
  win.loadURL('app://local/app/index.html');
}

// 書き出し: 保存先を選んでもらい、.md と同じ名前の .png を並べて保存する
ipcMain.handle('save-export', async (ev, { name, md, png }) => {
  const win = BrowserWindow.fromWebContents(ev.sender);
  let dir = app.getPath('documents');
  if (!fs.existsSync(dir)) dir = os.homedir();
  const r = await dialog.showSaveDialog(win, {
    title: '書き出し（.md と画像）', defaultPath: path.join(dir, name + '.md'),
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (r.canceled || !r.filePath) return null;
  const base = r.filePath.replace(/\.md$/i, '');
  if (png) fs.writeFileSync(base + '.png', Buffer.from(png));
  fs.writeFileSync(base + '.md', md.replace('__PNG__', path.basename(base) + '.png'));
  return base + '.md';
});

app.whenReady().then(() => {
  // 写真の読み込みでカメラを使う（この画面にだけ許可する）
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'media' && wc.getURL().startsWith('app://local/')));
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname);
    const file = path.normalize(path.join(__dirname, rel));
    const ok = ['app', 'assets', path.join('node_modules', '@techstark', 'opencv-js', 'dist')]
      .some((d) => file.startsWith(path.join(__dirname, d) + path.sep));
    if (!ok) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
