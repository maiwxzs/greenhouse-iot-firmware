// Proceso principal de la aplicación de escritorio Invernadero IoT.
// Abre la ventana con la interfaz (dist/) y resuelve el acceso al puerto USB del Arduino:
// Electron no trae el diálogo de puertos del navegador, así que la lista se envía a la
// interfaz (componente SelectorPuerto) y esta devuelve el puerto elegido.
const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("node:path");

const PRUEBA = process.argv.includes("--prueba");

let ventana = null;
let responderPuerto = null;   // callback pendiente de navigator.serial.requestPort()
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
  // Solo se concede el acceso a puertos serie; ningún otro permiso del navegador
  sesion.setPermissionCheckHandler((_wc, permiso) => permiso === "serial");
  sesion.setDevicePermissionHandler((detalles) => detalles.deviceType === "serial");
  sesion.setPermissionRequestHandler((_wc, _permiso, responder) => responder(false));

  // Los enlaces externos se abren en el navegador del sistema; la ventana no navega a otros sitios
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  ventana.webContents.on("will-navigate", (evento) => evento.preventDefault());

  ventana.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  if (PRUEBA) {
    // Prueba de humo de la integración continua: la interfaz debe cargar y dibujar la maqueta
    ventana.webContents.once("did-finish-load", async () => {
      await new Promise((r) => setTimeout(r, 2500));
      const ok = await ventana.webContents.executeJavaScript(
        "!!document.querySelector('.app') && !!document.querySelector('.escena-svg [data-pieza=\"bomba\"]')");
      console.log(ok ? "PRUEBA OK: interfaz y maqueta cargadas" : "PRUEBA FALLIDA: la interfaz no se dibujó");
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

// Una sola instancia: si ya está abierta, se trae al frente
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
  app.whenReady().then(crearVentana);
  app.on("window-all-closed", () => app.quit());
}
