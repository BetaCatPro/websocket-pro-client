class c {
  constructor() {
    this.events = {};
  }
  on(e, t) {
    return this.events[e] || (this.events[e] = []), this.events[e].push(t), () => this.off(e, t);
  }
  off(e, t) {
    this.events[e] && (this.events[e] = this.events[e].filter((s) => s !== t));
  }
  emit(e, ...t) {
    this.events[e] && this.events[e].forEach((s) => {
      try {
        s(...t);
      } catch (i) {
        console.error(`Event "${e}" listener error:`, i);
      }
    });
  }
  once(e, t) {
    const s = (...i) => {
      this.off(e, s), t(...i);
    };
    this.on(e, s);
  }
  removeAllListeners(e) {
    e ? delete this.events[e] : this.events = {};
  }
}
class l extends c {
  constructor(e, t, s) {
    super(), this.sendPing = s, this.lastPongTime = 0, this.intervalMs = e, this.timeoutMs = t;
  }
  start() {
    this.stop(), this.lastPongTime = Date.now(), this.intervalId = setInterval(() => {
      this.sendPing(), this.timeoutId = setTimeout(() => {
        this.emit("timeout");
      }, this.timeoutMs);
    }, this.intervalMs);
  }
  stop() {
    clearInterval(this.intervalId), clearTimeout(this.timeoutId);
  }
  recordPong() {
    this.lastPongTime = Date.now(), clearTimeout(this.timeoutId), this.emit("pong", Date.now() - this.lastPongTime);
  }
  getLastPongTime() {
    return this.lastPongTime;
  }
}
class u {
  constructor(e, t) {
    this.maxConcurrent = e, this.onTaskError = t, this.queue = [], this.runningCount = 0;
  }
  add(e, t) {
    return new Promise((s, i) => {
      const n = async () => {
        var o;
        try {
          await e(), s();
        } catch (a) {
          (o = this.onTaskError) == null || o.call(this, a), i(a);
        }
      };
      this.queue.push({ task: n, priority: t }), this.queue.sort((o, a) => a.priority - o.priority), this.run();
    });
  }
  run() {
    for (; this.runningCount < this.maxConcurrent && this.queue.length > 0; ) {
      const { task: e } = this.queue.shift();
      this.runningCount++, e().finally(() => {
        this.runningCount--, this.run();
      });
    }
  }
  clear() {
    this.queue = [];
  }
}
class m extends c {
  constructor(e, t, s) {
    super(), this.url = e, this.protocols = t, this.config = s, this.socket = null, this.reconnectAttempts = 0, this.messageQueue = [], this.heartbeat = new l(
      s.heartbeatInterval,
      s.heartbeatTimeout,
      () => this.sendRaw("ping")
    ), this.scheduler = new u(1, (i) => this.emit("error", i)), this.connect();
  }
  connect() {
    this.socket = new WebSocket(this.url, this.protocols), this.socket.binaryType = "arraybuffer", this.socket.onopen = (e) => {
      this.reconnectAttempts = 0, this.heartbeat.start(), this.flushMessageQueue(), this.emit("open", e);
    }, this.socket.onmessage = (e) => {
      if (e.data === "pong") {
        this.heartbeat.recordPong();
        return;
      }
      this.emit("message", e.data);
    }, this.socket.onclose = (e) => {
      this.heartbeat.stop(), this.emit("close", e);
    }, this.socket.onerror = (e) => {
      this.emit("error", e), this.scheduleReconnect();
    };
  }
  sendRaw(e) {
    var t;
    ((t = this.socket) == null ? void 0 : t.readyState) === WebSocket.OPEN && this.socket.send(e);
  }
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts)
      return;
    const e = Math.min(
      this.config.reconnectDelay * Math.pow(this.config.reconnectExponent, this.reconnectAttempts),
      this.config.maxReconnectDelay
    ), s = e * 0.2 * (Math.random() * 2 - 1), i = Math.max(1e3, e + s);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++, this.connect();
    }, i);
  }
  flushMessageQueue() {
    for (; this.messageQueue.length > 0; ) {
      const { data: e, resolve: t, reject: s } = this.messageQueue.shift();
      this.send(e).then(t).catch(s);
    }
  }
  send(e, t = this.config.defaultPriority) {
    var s;
    return ((s = this.socket) == null ? void 0 : s.readyState) === WebSocket.OPEN ? this.scheduler.add(() => new Promise((i, n) => {
      try {
        this.sendRaw(e), i();
      } catch (o) {
        n(o);
      }
    }), t) : new Promise((i, n) => {
      this.messageQueue.push({ data: e, priority: t, resolve: i, reject: n });
    });
  }
  close(e, t) {
    var s;
    clearTimeout(this.reconnectTimer), this.heartbeat.stop(), (s = this.socket) == null || s.close(e, t), this.socket = null;
  }
  reconnect() {
    clearTimeout(this.reconnectTimer), this.reconnectAttempts = 0, this.close(), this.connect();
  }
}
class g extends c {
  constructor(e) {
    super(), this.config = e, this.clients = /* @__PURE__ */ new Map();
  }
  connect(e, t = []) {
    const s = `${e}|${t.join(",")}`;
    if (this.clients.has(s))
      return this.clients.get(s);
    const i = new m(e, t, this.config);
    this.clients.set(s, i);
    const n = (o) => (a) => {
      this.emit(o, { url: e, protocols: t, data: a });
    };
    return i.on("open", n("open")), i.on("message", n("message")), i.on("close", n("close")), i.on("error", n("error")), i;
  }
  closeAll(e, t) {
    this.clients.forEach((s) => s.close(e, t)), this.clients.clear();
  }
  getClient(e, t) {
    const s = `${e}|${(t == null ? void 0 : t.join(",")) || ""}`;
    return this.clients.get(s);
  }
}
const h = {
  maxReconnectAttempts: 10,
  reconnectDelay: 1e3,
  reconnectExponent: 1.5,
  maxReconnectDelay: 3e4,
  heartbeatInterval: 25e3,
  heartbeatTimeout: 1e4,
  connectionPoolSize: 5,
  defaultPriority: 1,
  enableCompression: !1,
  serializer: {
    serialize: JSON.stringify,
    deserialize: JSON.parse
  }
}, d = (r = {}) => {
  const e = {
    ...h,
    ...r,
    serializer: {
      ...h.serializer,
      ...r.serializer
    }
  };
  return new g(e);
}, p = {
  serialize: JSON.stringify,
  deserialize: JSON.parse
}, f = {
  serialize: (r) => {
    throw new Error(
      "MsgPack serializer requires @msgpack/msgpack installation"
    );
  },
  deserialize: (r) => {
    throw new Error(
      "MsgPack serializer requires @msgpack/msgpack installation"
    );
  }
};
export {
  c as EventEmitter,
  p as JsonSerializer,
  f as MsgPackSerializer,
  m as WebSocketClient,
  g as WebSocketManager,
  d as createWebSocketManager
};
