// Proceso principal: ventana y selección del puerto serie (ver SelectorPuerto)
const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("node:path");

const PRUEBA = process.argv.includes("--prueba");

let ventana = null;
let responderPuerto = null;   // callback de requestPort()
let puertos = [];

function enviarPuertos() {
  ventana?.webContents.send("puertos", puertos.map((p) => ({
    portId: p.portId, portName: p.portName, displayName: p.displayName, vendorId: p.vendorId, productId: p.productId,
  })));
}

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    show: false,
    title: "Invernadero IoT",
    backgroundColor: "#121C17",
    icon: path.join(__dirname, "..", "recursos", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const sesion = ventana.webContents.session;

  sesion.on("select-serial-port", (evento, lista, _webContents, callback) => {
    evento.preventDefault();
    responderPuerto = callback;
    puertos = lista;
    enviarPuertos();
  });
  sesion.on("serial-port-added", (_evento, puerto) => {
    if (!responderPuerto) return;
    puertos = [...puertos.filter((p) => p.portId !== puerto.portId), puerto];
    enviarPuertos();
  });
  sesion.on("serial-port-removed", (_evento, puerto) => {
    if (!responderPuerto) return;
    puertos = puertos.filter((p) => p.portId !== puerto.portId);
    enviarPuertos();
  });
  // solo permisos de puerto serie
  sesion.setPermissionCheckHandler((_wc, permiso) => permiso === "serial");
  sesion.setDevicePermissionHandler((detalles) => detalles.deviceType === "serial");
  sesion.setPermissionRequestHandler((_wc, _permiso, responder) => responder(false));

  // enlaces externos al navegador del sistema
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  ventana.webContents.on("will-navigate", (evento) => evento.preventDefault());

  ventana.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  if (PRUEBA) {
    // prueba de humo para CI
    ventana.webContents.once("did-finish-load", async () => {
      await new Promise((r) => setTimeout(r, 2500));
      const ok = await ventana.webContents.executeJavaScript(
        "!!document.querySelector('.app') && !!document.querySelector('.tablero-vivo .medidor')");
      console.log(ok ? "PRUEBA OK: interfaz y tablero cargados" : "PRUEBA FALLIDA: la interfaz no se dibujó");
      app.exit(ok ? 0 : 1);
    });
    return;
  }
  ventana.once("ready-to-show", () => ventana.show());
  ventana.on("closed", () => { ventana = null; });
}

ipcMain.on("puerto-elegido", (_evento, portId) => {
  if (!responderPuerto) return;
  responderPuerto(typeof portId === "string" ? portId : "");
  responderPuerto = null;
  puertos = [];
});

// una sola instancia
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!ventana) return;
    if (ventana.isMinimized()) ventana.restore();
    ventana.focus();
  });
  app.setAppUserModelId("co.edu.unillanos.invernadero");
  Menu.setApplicationMenu(null);
  app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
  // dibujo con la GPU aunque el controlador de video esté en la lista negra de Chromium
  app.commandLine.appendSwitch("ignore-gpu-blocklist");
  app.commandLine.appendSwitch("enable-gpu-rasterization");
  app.commandLine.appendSwitch("enable-zero-copy");
  app.whenReady().then(crearVentana);
  app.on("window-all-closed", () => app.quit());
}
