/* TrainMind online: sostituisce il database, l'assistente e i download di claude.ai
   con Supabase (dati e accesso) e la funzione /api/ai (assistente).
   Espone window.claude.use(...) come l'artifact, così il resto dell'app non cambia. */
(function () {
  const C = window.TM_CONFIG || {};
  const configured = !!(C.supabaseUrl && C.supabaseAnonKey && window.supabase);
  const sb = configured ? window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey) : null;

  let session = null;
  let loaded = false;
  const cache = {}; // collezione -> { id: dati }
  const listeners = {}; // "collezione" o "collezione/id" -> [fn]

  /* ---------- schermata di accesso ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const domReady = new Promise((r) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r()));
  function gate(html) {
    const LOGO = document.querySelector(".brand .mark")?.outerHTML || "";
    let el = document.getElementById("tmGate");
    if (!el) {
      el = document.createElement("div");
      el.id = "tmGate";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px max(16px,env(safe-area-inset-left,0px));background:var(--bg,#ECEFE9)";
      document.body.append(el);
    }
    el.innerHTML = `<div class="card stack" style="max-width:420px;width:100%">
      <div class="row" style="gap:12px;align-items:center"><div style="width:48px;height:48px">${LOGO.replace('class="mark"', 'class="mark" style="width:48px;height:48px"')}</div>
      <div><h1 style="font-size:1.8rem">Train<span style="color:var(--accent)">Mind</span></h1><p class="muted" style="font-size:.9rem">La settimana, pensata.</p></div></div>${html}</div>`;
    return el;
  }
  function closeGate() {
    document.getElementById("tmGate")?.remove();
  }
  function loginForm(msg) {
    const el = gate(`<p>Entra con la tua email: ti mando un link di accesso, senza password.</p>
      <label class="f"><span>Email</span><input type="email" id="tmEmail" autocomplete="email" inputmode="email" placeholder="nome@esempio.it"></label>
      <button class="btn pri" id="tmSend">Mandami il link</button>
      <p class="muted" id="tmMsg" role="status" style="font-size:.9rem">${esc(msg || "TrainMind è in prova su invito: usa l'email con cui sei stato invitato.")}</p>`);
    const send = async () => {
      const email = el.querySelector("#tmEmail").value.trim();
      const out = el.querySelector("#tmMsg");
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        out.textContent = "Scrivi un indirizzo email valido.";
        return;
      }
      el.querySelector("#tmSend").disabled = true;
      out.textContent = "Invio in corso…";
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname },
      });
      el.querySelector("#tmSend").disabled = false;
      if (error) {
        out.textContent = /signup|not allowed|not found/i.test(error.message)
          ? "Questa email non è abilitata. Chiedi l'invito a chi ti ha proposto TrainMind."
          : "Invio non riuscito: " + error.message;
      } else {
        out.innerHTML = `Ti ho mandato il link a <b>${esc(email)}</b>. Aprilo da questo dispositivo per entrare.`;
      }
    };
    el.querySelector("#tmSend").onclick = send;
    el.querySelector("#tmEmail").onkeydown = (e) => {
      if (e.key === "Enter") send();
    };
  }

  /* ---------- dati ---------- */
  const snapCol = (col) => ({
    docs: Object.entries(cache[col] || {}).map(([id, d]) => ({ id, data: () => d })),
    metadata: { fromCache: false },
  });
  const snapDoc = (col, id) => {
    const d = (cache[col] || {})[id];
    return { exists: d !== undefined, data: () => d, metadata: { fromCache: false } };
  };
  function emit(col, id) {
    (listeners[col] || []).forEach((fn) => fn(snapCol(col)));
    if (id) (listeners[col + "/" + id] || []).forEach((fn) => fn(snapDoc(col, id)));
  }
  async function loadAll() {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("docs").select("collection,doc_id,data").range(from, from + 999);
      if (error) throw error;
      data.forEach((r) => {
        (cache[r.collection] = cache[r.collection] || {})[r.doc_id] = r.data;
      });
      if (data.length < 1000) break;
    }
    loaded = true;
    Object.keys(listeners).forEach((k) => {
      const [col, id] = k.split("/");
      if (id) listeners[k].forEach((fn) => fn(snapDoc(col, id)));
      else listeners[k].forEach((fn) => fn(snapCol(col)));
    });
  }
  function live() {
    sb.channel("docs-" + session.user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: "user_id=eq." + session.user.id }, (p) => {
        const row = p.eventType === "DELETE" ? p.old : p.new;
        if (!row || !row.collection) return;
        const col = (cache[row.collection] = cache[row.collection] || {});
        const same = JSON.stringify(col[row.doc_id]) === JSON.stringify(row.data);
        if (p.eventType === "DELETE") delete col[row.doc_id];
        else col[row.doc_id] = row.data;
        if (!same || p.eventType === "DELETE") emit(row.collection, row.doc_id);
      })
      .subscribe();
  }
  async function upsertRows(rows) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await sb.from("docs").upsert(rows.slice(i, i + 200));
      if (error) throw error;
    }
  }
  const db = {
    collection: (col) => ({
      onSnapshot(cb) {
        (listeners[col] = listeners[col] || []).push(cb);
        if (loaded) cb(snapCol(col));
        return () => {};
      },
      doc: (id) => ({
        async set(data) {
          (cache[col] = cache[col] || {})[id] = data;
          await upsertRows([{ user_id: session.user.id, collection: col, doc_id: id, data, updated_at: new Date().toISOString() }]);
        },
        async delete() {
          if (cache[col]) delete cache[col][id];
          const { error } = await sb.from("docs").delete().eq("collection", col).eq("doc_id", id);
          if (error) throw error;
        },
      }),
    }),
    doc(path) {
      const [col, id] = path.split("/");
      return {
        onSnapshot(cb) {
          (listeners[path] = listeners[path] || []).push(cb);
          if (loaded) cb(snapDoc(col, id));
          return () => {};
        },
      };
    },
  };

  /* ---------- assistente ---------- */
  async function callAI(body, onText, signal) {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw { code: "not_granted", text: "Accesso scaduto: rientra." };
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify(body),
      signal,
    });
    if (!r.ok) {
      let msg = "";
      try {
        msg = (await r.json()).error || "";
      } catch (_) {}
      throw { code: r.status === 429 ? "rate_limited" : r.status === 401 ? "not_granted" : "error", text: msg || "L'assistente non ha risposto. Riprova." };
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      const shown = text.replace(/\n\[\[TM_ERROR:[^\]]*\]\]$/, "");
      if (onText) onText({ text: shown });
    }
    const m = text.match(/\n\[\[TM_ERROR:([^\]]*)\]\]$/);
    if (m) {
      if (m[1] === "rate_limited") throw { code: "rate_limited" };
      if (m[1] === "aborted") throw { code: "aborted" };
      throw { code: "error", text: m[1] === "refusal" ? "L'assistente non può rispondere a questa richiesta." : "Risposta interrotta. Riprova." };
    }
    return text;
  }
  function parseJSON(t) {
    let s = String(t || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const a = s.search(/[\[{]/);
    const b = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (a < 0 || b < a) throw { code: "empty", message: "Risposta non valida" };
    try {
      return JSON.parse(s.slice(a, b + 1));
    } catch (_) {
      throw { code: "empty", message: "Risposta non valida" };
    }
  }
  const sample = async (messages, opts = {}) => ({
    text: await callAI({ mode: "chat", messages, tier: opts.modelTier }, opts.onText, opts.signal),
  });
  sample.json = async (prompt, opts = {}) => parseJSON(await callAI({ mode: "json", prompt, tier: opts.modelTier }, null, opts.signal));

  /* ---------- download e condivisione dei PDF ---------- */
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const file = new File([blob], filename, { type: blob.type || "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        try {
          await navigator.share({ files: [file], title: filename });
          return;
        } catch (e) {
          if (e && e.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: filename });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    },
  };

  /* ---------- accesso e avvio ---------- */
  let resolveReady;
  const ready = new Promise((r) => (resolveReady = r));
  async function start(s) {
    if (session) return;
    session = s;
    gate(`<p>Carico i tuoi dati…</p>`);
    try {
      await loadAll();
      live();
      closeGate();
      resolveReady();
    } catch (e) {
      session = null;
      loginForm("Non riesco a caricare i dati: " + (e.message || "riprova tra poco."));
    }
  }
  if (!configured) {
    window.addEventListener("DOMContentLoaded", () =>
      gate(`<p>Manca la configurazione: compila <code>config.js</code> con l'indirizzo e la chiave pubblica del progetto Supabase.</p>`),
    );
  } else {
    domReady.then(() => sb.auth.getSession()).then(({ data }) => (data.session ? start(data.session) : loginForm()));
    sb.auth.onAuthStateChange((ev, s) => {
      if (s && !session) domReady.then(() => start(s));
      if (ev === "SIGNED_OUT") location.reload();
    });
  }

  window.claude = {
    use: async (name) => {
      if (!configured) return new Promise(() => {}); // resta in attesa: la schermata spiega cosa manca
      await ready;
      return name === "db" ? db : name === "sample" ? sample : name === "downloads" ? downloads : null;
    },
  };

  /* ---------- scheda "Account" nelle Impostazioni ---------- */
  window.TM_CLOUD = {
    card() {
      const email = session?.user?.email || "";
      return `<div class="card stack"><h2>Account</h2>
        <p class="muted">Sei entrato come <b>${esc(email)}</b>. I tuoi dati sono visibili solo a te.</p>
        <div class="row" style="flex-wrap:wrap;gap:8px">
          <button class="btn" data-act="cloudExport">Scarica un backup</button>
          <label class="btn" style="cursor:pointer">Importa un backup<input type="file" id="cloudFile" accept="application/json,.json" hidden></label>
          <button class="btn ghost" data-act="cloudLogout">Esci</button>
        </div>
        <p class="muted" style="font-size:.85rem">Il backup è un file con squadra, rosa, partite, settimane ed esercizi. Importandolo, i dati con lo stesso nome vengono sostituiti.</p></div>`;
    },
    async act(t) {
      const a = t.dataset.act;
      if (a === "cloudLogout") {
        await sb.auth.signOut();
        location.reload();
      }
      if (a === "cloudExport") {
        const out = { app: "TrainMind", v: 1, esportato: new Date().toISOString(), collections: cache };
        const name = "trainmind-backup-" + new Date().toISOString().slice(0, 10) + ".json";
        const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = Object.assign(document.createElement("a"), { href: url, download: name });
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    },
  };
  document.addEventListener("change", async (e) => {
    const inp = e.target;
    if (!inp || inp.id !== "cloudFile" || !inp.files || !inp.files[0]) return;
    try {
      const j = JSON.parse(await inp.files[0].text());
      const cols = j.collections || j;
      const rows = [];
      Object.entries(cols).forEach(([col, docs]) => {
        if (!docs || typeof docs !== "object") return;
        Object.entries(docs).forEach(([id, data]) => rows.push({ user_id: session.user.id, collection: col, doc_id: id, data, updated_at: new Date().toISOString() }));
      });
      if (!rows.length) throw new Error("vuoto");
      await upsertRows(rows);
      alert(`Importati ${rows.length} elementi. Ricarico l'app.`);
      location.reload();
    } catch (err) {
      alert("Il file non è un backup di TrainMind valido.");
    }
    inp.value = "";
  });
})();
