// Historial en IndexedDB
//   lecturas: cada tel (2 s)
//   minutos:  resumen por minuto
//   eventos:  estados, riegos, alarmas, conexión, comandos

const VERSION_BD = 1;
export const RETENCION_LECTURAS_DIAS = 2;
export const RETENCION_MINUTOS_DIAS = 180;
const DIA_MS = 86400000;

function promesa(req) {
  return new Promise((resolver, rechazar) => {
    req.onsuccess = () => resolver(req.result);
    req.onerror = () => rechazar(req.error);
  });
}

function finTransaccion(tx) {
  return new Promise((resolver, rechazar) => {
    tx.oncomplete = () => resolver();
    tx.onerror = () => rechazar(tx.error);
    tx.onabort = () => rechazar(tx.error);
  });
}

export class Almacen {
  constructor(nombre) {
    this.nombre = nombre;
    this.bd = null;
  }

  async abrir() {
    if (this.bd) return this;
    if (!("indexedDB" in window)) return this;
    const req = indexedDB.open(this.nombre, VERSION_BD);
    req.onupgradeneeded = () => {
      const bd = req.result;
      if (!bd.objectStoreNames.contains("lecturas")) bd.createObjectStore("lecturas", { keyPath: "t" });
      if (!bd.objectStoreNames.contains("minutos")) bd.createObjectStore("minutos", { keyPath: "t" });
      if (!bd.objectStoreNames.contains("eventos")) {
        const ev = bd.createObjectStore("eventos", { keyPath: "id", autoIncrement: true });
        ev.createIndex("t", "t");
      }
    };
    try {
      this.bd = await promesa(req);
    } catch {
      this.bd = null; // sin almacenamiento: sigue sin historial
    }
    return this;
  }

  get disponible() {
    return this.bd !== null;
  }

  async guardar(almacen, registros) {
    if (!this.bd || !registros.length) return;
    const tx = this.bd.transaction(almacen, "readwrite");
    const st = tx.objectStore(almacen);
    registros.forEach((r) => st.put(r));
    await finTransaccion(tx);
  }

  async rango(almacen, desde, hasta, limite = Infinity) {
    if (!this.bd) return [];
    const tx = this.bd.transaction(almacen, "readonly");
    const st = almacen === "eventos" ? tx.objectStore(almacen).index("t") : tx.objectStore(almacen);
    const res = [];
    return new Promise((resolver, rechazar) => {
      const cursor = st.openCursor(IDBKeyRange.bound(desde, hasta));
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c || res.length >= limite) return resolver(res);
        res.push(c.value);
        c.continue();
      };
      cursor.onerror = () => rechazar(cursor.error);
    });
  }

  async ultimosEventos(cantidad = 200) {
    if (!this.bd) return [];
    const tx = this.bd.transaction("eventos", "readonly");
    const res = [];
    return new Promise((resolver) => {
      const cursor = tx.objectStore("eventos").index("t").openCursor(null, "prev");
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c || res.length >= cantidad) return resolver(res);
        res.push(c.value);
        c.continue();
      };
      cursor.onerror = () => resolver(res);
    });
  }

  async contar(almacen) {
    if (!this.bd) return 0;
    return promesa(this.bd.transaction(almacen, "readonly").objectStore(almacen).count());
  }

  // retención
  async limpiar(ahora = Date.now()) {
    if (!this.bd) return;
    const tx = this.bd.transaction(["lecturas", "minutos", "eventos"], "readwrite");
    tx.objectStore("lecturas").delete(IDBKeyRange.upperBound(ahora - RETENCION_LECTURAS_DIAS * DIA_MS));
    tx.objectStore("minutos").delete(IDBKeyRange.upperBound(ahora - RETENCION_MINUTOS_DIAS * DIA_MS));
    const ev = tx.objectStore("eventos").index("t").openCursor(IDBKeyRange.upperBound(ahora - RETENCION_MINUTOS_DIAS * DIA_MS));
    ev.onsuccess = () => {
      const c = ev.result;
      if (c) { c.delete(); c.continue(); }
    };
    await finTransaccion(tx);
  }

  async borrarTodo() {
    if (!this.bd) return;
    const tx = this.bd.transaction(["lecturas", "minutos", "eventos"], "readwrite");
    ["lecturas", "minutos", "eventos"].forEach((s) => tx.objectStore(s).clear());
    await finTransaccion(tx);
  }

  static async estimarUso() {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return { usado: usage, cuota: quota };
  }
}
