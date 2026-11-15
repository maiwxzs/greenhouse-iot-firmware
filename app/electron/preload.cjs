// Puente mínimo entre la interfaz y el proceso principal: solo la elección del puerto USB.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("escritorio", {
  alPedirPuerto(callback) {
    const oyente = (_evento, lista) => callback(lista);
    ipcRenderer.on("puertos", oyente);
    return () => ipcRenderer.removeListener("puertos", oyente);
  },
  elegirPuerto(portId) {
    ipcRenderer.send("puerto-elegido", portId);
  },
});
