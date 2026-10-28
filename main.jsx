import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/*
  The Fictional Archive
  Single-file React app. No external libraries required.
  Features: scrapbook pages, draggable collage items, character profiles,
  keepsakes, switchable atlas styles, local autosave, undo/redo, JSON import/export.
*/

const STORAGE_KEY = "fictional-archive-v1";

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const clone = (v) => JSON.parse(JSON.stringify(v));

const starter = {
  version: 1,
  title: "The Fictional Archive",
  activePageId: "page-1",
  activeTab: "scrapbook",
  atlasStyle: "handdrawn",
  pages: [
    {
      id: "page-1",
      title: "The Ones We Remember",
      template: "collage",
      background: "#e8dcc5",
      elements: [
        { id: "el-1", type: "heading", text: "THE ONES WE REMEMBER", x: 7, y: 7, w: 78, h: 12, rotate: -1, color: "#382c27", size: 23 },
        { id: "el-2", type: "note", text: "Every story leaves something behind.", x: 9, y: 25, w: 48, h: 17, rotate: 2, color: "#473a32", size: 14 },
        { id: "el-3", type: "photo", text: "CHARACTER PORTRAIT", x: 62, y: 23, w: 27, h: 34, rotate: 3, color: "#473a32", size: 11 },
        { id: "el-4", type: "tape", text: "ARCHIVE / 01", x: 11, y: 51, w: 29, h: 8, rotate: -3, color: "#4d4439", size: 10 },
        { id: "el-5", type: "note", text: "Names, places, rumors, little truths. Keep the fragments that matter.", x: 13, y: 66, w: 65, h: 18, rotate: -1, color: "#473a32", size: 13 }
      ]
    },
    {
      id: "page-2",
      title: "Evidence & Fragments",
      template: "journal",
      background: "#eee5d4",
      elements: [
        { id: "el-6", type: "heading", text: "EVIDENCE & FRAGMENTS", x: 8, y: 8, w: 78, h: 10, rotate: 0, color: "#382c27", size: 19 },
        { id: "el-7", type: "note", text: "A page for things that do not fit neatly anywhere else.", x: 9, y: 24, w: 75, h: 14, rotate: 0, color: "#473a32", size: 13 },
        { id: "el-8", type: "ticket", text: "ENTRY 004\nDATE UNKNOWN", x: 12, y: 46, w: 32, h: 19, rotate: -2, color: "#473a32", size: 11 },
        { id: "el-9", type: "note", text: "Add a letter, a sketch, a rumor, or a detail worth keeping.", x: 49, y: 48, w: 39, h: 24, rotate: 2, color: "#473a32", size: 12 }
      ]
    }
  ],
  characters: [
    { id: "char-1", name: "Mara Venn", role: "The Cartographer", affiliation: "The North Archive", traits: "Observant, guarded, stubbornly loyal", biography: "Keeps maps of places that no longer appear on official charts.", locationId: "loc-1", notes: "Carries a brass compass with a cracked face." }
  ],
  keepsakes: [
    { id: "keep-1", name: "Cracked Brass Compass", category: "Object", ownerId: "char-1", locationId: "loc-1", description: "The needle points toward places that have been erased.", details: "Found beneath a loose floorboard in the old archive." }
  ],
  atlas: {
    title: "THE KNOWN & UNSETTLED",
    subtitle: "Field atlas / private copy",
    locations: [
      { id: "loc-1", name: "The North Archive", type: "Landmark", x: 28, y: 31, notes: "A stone building above the old river road." },
      { id: "loc-2", name: "Glasswater Crossing", type: "Crossing", x: 67, y: 56, notes: "The water reflects a sky that is not always there." },
      { id: "loc-3", name: "The Unmarked Wood", type: "Region", x: 46, y: 76, notes: "Paths shift when followed alone." }
    ],
    routes: [{ id: "route-1", from: "loc-1", to: "loc-2" }, { id: "route-2", from: "loc-2", to: "loc-3" }]
  }
};

const palettes = {
  ink: { bg: "#15191c", panel: "#202629", panel2: "#272f32", text: "#e7e2d7", muted: "#a5aaa6", line: "#3a4447", accent: "#c8a66a", accent2: "#8ea6a0" },
  paper: { bg: "#171a1d", panel: "#24282b", panel2: "#303538", text: "#eee6d7", muted: "#b7b0a4", line: "#494843", accent: "#d6b778", accent2: "#9ab0a5" }
};

function safeParse(raw) {
  try {
    const value = JSON.parse(raw);
    if (value && value.version === 1 && Array.isArray(value.pages) && Array.isArray(value.characters)) return value;
  } catch (_) {}
  return null;
}

export default function App() {
  const [data, setData] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = safeParse(window.localStorage.getItem(STORAGE_KEY) || "");
      if (saved) return saved;
    }
    return clone(starter);
  });
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [notice, setNotice] = useState("Local archive ready");
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const fileInputRef = useRef(null);
  const dragRef = useRef(null);
  const saveTimer = useRef(null);

  const theme = palettes.ink;
  const activePage = data.pages.find((p) => p.id === data.activePageId) || data.pages[0];
  const selectedElement = activePage?.elements.find((e) => e.id === selectedElementId) || null;
  const selectedLocation = data.atlas.locations.find((l) => l.id === selectedLocationId) || null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setNotice("Saved locally");
      } catch (_) {
        setNotice("Storage full: export a backup");
      }
    }, 250);
    return () => clearTimeout(saveTimer.current);
  }, [data]);

  const update = useCallback((mutator, label = "Updated") => {
    setData((current) => {
      const next = clone(current);
      mutator(next);
      setHistory((h) => [...h.slice(-39), clone(current)]);
      setFuture([]);
      setNotice(label);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const previous = h[h.length - 1];
      setFuture((f) => [clone(data), ...f].slice(0, 40));
      setData(clone(previous));
      setNotice("Undo");
      return h.slice(0, -1);
    });
  }, [data]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setHistory((h) => [...h.slice(-39), clone(data)]);
      setData(clone(next));
      setNotice("Redo");
      return f.slice(1);
    });
  }, [data]);

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fictional-archive.json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Project exported");
  };

  const importProject = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = safeParse(String(reader.result || ""));
      if (!imported) {
        setNotice("That file is not a valid Archive project");
        return;
      }
      setHistory((h) => [...h.slice(-39), clone(data)]);
      setFuture([]);
      setData(imported);
      setSelectedElementId(null);
      setSelectedLocationId(null);
      setNotice("Project imported");
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const addPage = (template = "collage") => {
    const id = uid();
    const backgrounds = { collage: "#e8dcc5", journal: "#eee5d4", midnight: "#d8d8d0" };
    const title = template === "journal" ? "New Journal Page" : template === "midnight" ? "Night Notes" : "Untitled Collage";
    update((d) => {
      d.pages.push({
        id, title, template, background: backgrounds[template] || backgrounds.collage,
        elements: [
          { id: uid(), type: "heading", text: title.toUpperCase(), x: 8, y: 8, w: 78, h: 12, rotate: 0, color: "#382c27", size: 20 },
          { id: uid(), type: "note", text: "Click to edit this note.", x: 10, y: 29, w: 60, h: 18, rotate: -1, color: "#473a32", size: 13 }
        ]
      });
      d.activePageId = id;
      d.activeTab = "scrapbook";
    }, "Page created");
    setSelectedElementId(null);
  };

  const addElement = (type) => {
    if (!activePage) return;
    const defaults = {
      heading: { text: "NEW HEADING", w: 65, h: 12, size: 19 },
      note: { text: "Write a note…", w: 48, h: 19, size: 13 },
      photo: { text: "PHOTO / PORTRAIT", w: 29, h: 32, size: 10 },
      tape: { text: "PAPER TAPE", w: 31, h: 8, size: 10 },
      ticket: { text: "ARCHIVE ENTRY\nNO. 001", w: 32, h: 18, size: 10 },
      sticker: { text: "✦", w: 13, h: 13, size: 26 }
    };
    const item = { id: uid(), type, x: 15 + Math.random() * 18, y: 40 + Math.random() * 12, rotate: Math.round(Math.random() * 6 - 3), color: "#473a32", ...defaults[type] };
    update((d) => {
      const page = d.pages.find((p) => p.id === d.activePageId);
      if (page) page.elements.push(item);
    }, `${type[0].toUpperCase() + type.slice(1)} added`);
    setSelectedElementId(item.id);
  };

  const updateElement = (id, patch) => update((d) => {
    const page = d.pages.find((p) => p.id === d.activePageId);
    const element = page?.elements.find((e) => e.id === id);
    if (element) Object.assign(element, patch);
  }, "Element edited");

  const removeElement = (id) => {
    update((d) => {
      const page = d.pages.find((p) => p.id === d.activePageId);
      if (page) page.elements = page.elements.filter((e) => e.id !== id);
    }, "Element removed");
    setSelectedElementId(null);
  };

  const addCharacter = () => {
    const item = { id: uid(), name: "New Character", role: "Unwritten", affiliation: "", traits: "", biography: "", locationId: "", notes: "" };
    update((d) => { d.characters.push(item); d.activeTab = "characters"; }, "Character created");
    setMobilePanel(true);
  };

  const updateCharacter = (id, patch) => update((d) => {
    const c = d.characters.find((item) => item.id === id);
    if (c) Object.assign(c, patch);
  }, "Character saved");

  const addKeepsake = () => {
    const item = { id: uid(), name: "Untitled Keepsake", category: "Artifact", ownerId: "", locationId: "", description: "", details: "" };
    update((d) => { d.keepsakes.push(item); d.activeTab = "keepsakes"; }, "Keepsake created");
  };

  const updateKeepsake = (id, patch) => update((d) => {
    const k = d.keepsakes.find((item) => item.id === id);
    if (k) Object.assign(k, patch);
  }, "Keepsake saved");

  const addLocation = (x = 50, y = 50) => {
    const item = { id: uid(), name: "Unmarked Place", type: "Location", x, y, notes: "" };
    update((d) => { d.atlas.locations.push(item); }, "Atlas location added");
    setSelectedLocationId(item.id);
  };

  const updateLocation = (id, patch) => update((d) => {
    const l = d.atlas.locations.find((item) => item.id === id);
    if (l) Object.assign(l, patch);
  }, "Location saved");

  const deleteLocation = (id) => {
    update((d) => {
      d.atlas.locations = d.atlas.locations.filter((l) => l.id !== id);
      d.atlas.routes = d.atlas.routes.filter((r) => r.from !== id && r.to !== id);
      d.characters.forEach((c) => { if (c.locationId === id) c.locationId = ""; });
      d.keepsakes.forEach((k) => { if (k.locationId === id) k.locationId = ""; });
    }, "Location removed");
    setSelectedLocationId(null);
  };

  const startDrag = (event, element) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedElementId(element.id);
    const rect = event.currentTarget.closest(".scrapbook-canvas").getBoundingClientRect();
    dragRef.current = { id: element.id, startX: event.clientX, startY: event.clientY, x: element.x, y: element.y, rect };
    const move = (e) => {
      if (!dragRef.current) return;
      const dX = ((e.clientX - dragRef.current.startX) / dragRef.current.rect.width) * 100;
      const dY = ((e.clientY - dragRef.current.startY) / dragRef.current.rect.height) * 100;
      const page = data.pages.find((p) => p.id === data.activePageId);
      const current = page?.elements.find((el) => el.id === dragRef.current.id);
      if (!current) return;
      const next = clone(data);
      const targetPage = next.pages.find((p) => p.id === next.activePageId);
      const target = targetPage?.elements.find((el) => el.id === dragRef.current.id);
      if (target) { target.x = Math.max(0, Math.min(90, dragRef.current.x + dX)); target.y = Math.max(0, Math.min(88, dragRef.current.y + dY)); }
      setData(next);
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setHistory((h) => [...h.slice(-39), clone(data)]);
      setFuture([]);
      setNotice("Element moved");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const tabs = [
    { id: "scrapbook", label: "Scrapbook", icon: "▧" },
    { id: "characters", label: "Characters", icon: "◉" },
    { id: "keepsakes", label: "Keepsakes", icon: "◇" },
    { id: "atlas", label: "Atlas", icon: "⌖" }
  ];

  const pageCount = data.pages.length;
  const styles = `
    * { box-sizing: border-box; }
    .fa-app { min-height: 100vh; background:${theme.bg}; color:${theme.text}; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .fa-app button, .fa-app input, .fa-app textarea, .fa-app select { font: inherit; }
    .fa-top { height:64px; border-bottom:1px solid ${theme.line}; display:flex; align-items:center; gap:14px; padding:0 20px; position:sticky; top:0; z-index:10; background:${theme.bg}; }
    .fa-brand { display:flex; align-items:center; gap:10px; min-width:210px; }
    .fa-mark { width:32px; height:32px; border:1px solid ${theme.accent}; display:grid; place-items:center; color:${theme.accent}; font-family:Georgia,serif; font-size:20px; transform:rotate(-4deg); }
    .fa-brand-title { font-size:13px; font-weight:750; letter-spacing:.13em; text-transform:uppercase; }
    .fa-brand-sub { font-size:10px; color:${theme.muted}; letter-spacing:.12em; margin-top:3px; text-transform:uppercase; }
    .fa-top-actions { display:flex; align-items:center; gap:7px; margin-left:auto; }
    .fa-btn { border:1px solid ${theme.line}; background:${theme.panel}; color:${theme.text}; padding:8px 11px; border-radius:7px; cursor:pointer; transition:background .15s,border-color .15s; font-size:12px !important; white-space:nowrap; }
    .fa-btn:hover { border-color:${theme.accent}; background:${theme.panel2}; }
    .fa-btn.primary { background:${theme.accent}; color:#211d17; border-color:${theme.accent}; font-weight:700; }
    .fa-btn.ghost { background:transparent; }
    .fa-btn:disabled { opacity:.35; cursor:not-allowed; }
    .fa-shell { display:grid; grid-template-columns:220px minmax(0,1fr) 260px; min-height:calc(100vh - 64px); }
    .fa-left, .fa-right { background:${theme.panel}; padding:16px 13px; min-width:0; }
    .fa-left { border-right:1px solid ${theme.line}; }
    .fa-right { border-left:1px solid ${theme.line}; }
    .fa-center { padding:22px clamp(12px,2.8vw,34px) 32px; min-width:0; overflow:hidden; }
    .fa-eyebrow { color:${theme.accent}; font-size:10px; letter-spacing:.16em; text-transform:uppercase; font-weight:750; }
    .fa-section-title { font-size:12px; text-transform:uppercase; letter-spacing:.12em; color:${theme.muted}; margin:20px 8px 8px; }
    .fa-nav { display:flex; flex-direction:column; gap:5px; }
    .fa-nav button { border:1px solid transparent; display:flex; align-items:center; gap:10px; text-align:left; width:100%; padding:10px; background:transparent; color:${theme.muted}; border-radius:7px; cursor:pointer; font-size:13px; }
    .fa-nav button.active { background:${theme.panel2}; border-color:${theme.line}; color:${theme.text}; }
    .fa-nav .nav-icon { width:20px; text-align:center; color:${theme.accent}; font-size:17px; }
    .fa-mini-card { padding:10px; border:1px solid ${theme.line}; border-radius:8px; margin-top:7px; cursor:pointer; background:rgba(255,255,255,.015); }
    .fa-mini-card.active { border-color:${theme.accent}; background:${theme.panel2}; }
    .fa-mini-title { font-size:12px; font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .fa-mini-meta { font-size:10px; color:${theme.muted}; margin-top:4px; }
    .fa-workhead { display:flex; align-items:flex-start; gap:12px; justify-content:space-between; margin-bottom:20px; }
    .fa-workhead h1 { font-family:Georgia,"Times New Roman",serif; font-size:clamp(25px,3vw,36px); line-height:1.1; font-weight:500; margin:6px 0 7px; }
    .fa-subtitle { font-size:12px; color:${theme.muted}; line-height:1.6; }
    .fa-toolbar { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
    .fa-canvas-wrap { padding:12px; border:1px solid ${theme.line}; border-radius:10px; background:#101416; box-shadow:0 16px 42px rgba(0,0,0,.18); }
    .scrapbook-canvas { position:relative; width:100%; aspect-ratio: 0.86; max-height: min(75vh, 900px); overflow:hidden; background:#e8dcc5; background-image:radial-gradient(rgba(90,70,45,.09) .7px, transparent .7px); background-size:5px 5px; box-shadow:0 2px 9px rgba(0,0,0,.2); touch-action:pan-y; }
    .fa-paper-element { position:absolute; cursor:grab; user-select:none; touch-action:none; display:flex; align-items:center; justify-content:center; text-align:center; overflow:hidden; white-space:pre-wrap; line-height:1.25; }
    .fa-paper-element:active { cursor:grabbing; }
    .fa-paper-element.selected { outline:1.5px dashed #b78e4c; outline-offset:3px; }
    .fa-paper-element.heading { font-family:Georgia,"Times New Roman",serif; font-weight:700; letter-spacing:.08em; }
    .fa-paper-element.note { padding:6px; font-family:Georgia,"Times New Roman",serif; background:rgba(255,250,236,.72); box-shadow:1px 3px 6px rgba(50,35,20,.12); text-align:left; align-items:flex-start; }
    .fa-paper-element.photo { background:linear-gradient(145deg,#7d8078,#c1b9a7 42%,#6d726e); border:7px solid #f5eedf; box-shadow:2px 5px 9px rgba(50,35,20,.24); color:#393d39; font-family:monospace; letter-spacing:.1em; }
    .fa-paper-element.tape { background:rgba(193,170,112,.68); font-family:monospace; letter-spacing:.12em; }
    .fa-paper-element.ticket { background:#f4ead5; border:1px dashed #9a8668; font-family:monospace; }
    .fa-paper-element.sticker { font-family:Georgia,serif; color:#9b6c39; }
    .fa-canvas-footer { display:flex; justify-content:space-between; gap:10px; margin-top:10px; color:${theme.muted}; font-size:10px; letter-spacing:.05em; }
    .fa-label { display:block; color:${theme.muted}; font-size:10px; letter-spacing:.1em; text-transform:uppercase; margin:13px 0 6px; }
    .fa-input, .fa-textarea, .fa-select { width:100%; border:1px solid ${theme.line}; border-radius:7px; background:${theme.bg}; color:${theme.text}; padding:9px 10px; outline:none; font-size:12px !important; }
    .fa-input:focus, .fa-textarea:focus, .fa-select:focus { border-color:${theme.accent}; }
    .fa-textarea { min-height:84px; resize:vertical; line-height:1.5; }
    .fa-field-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .fa-muted { color:${theme.muted}; font-size:11px; line-height:1.5; }
    .fa-card-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
    .fa-record-card { background:${theme.panel}; border:1px solid ${theme.line}; border-radius:10px; padding:14px; min-width:0; }
    .fa-record-card h3 { font-family:Georgia,serif; font-size:20px; font-weight:500; margin:0 0 4px; }
    .fa-record-card p { font-size:12px; color:${theme.muted}; line-height:1.55; white-space:pre-wrap; }
    .fa-record-top { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
    .fa-chip { display:inline-block; border:1px solid ${theme.line}; border-radius:99px; padding:4px 7px; color:${theme.accent2}; font-size:9px; letter-spacing:.08em; text-transform:uppercase; }
    .fa-empty { border:1px dashed ${theme.line}; border-radius:10px; padding:30px 18px; text-align:center; color:${theme.muted}; font-size:12px; }
    .fa-atlas { position:relative; aspect-ratio:1.12; min-height:300px; overflow:hidden; border:1px solid #736b5a; border-radius:8px; background:#e4d7ba; color:#332d25; }
    .fa-atlas.technical { background:#17282b; color:#c8e0d8; border-color:#496a68; }
    .fa-atlas svg { display:block; width:100%; height:100%; touch-action:manipulation; }
    .fa-atlas-title { font-family:Georgia,serif; font-size:clamp(20px,3vw,30px); letter-spacing:.12em; }
    .fa-atlas-sub { font-family:monospace; font-size:10px; letter-spacing:.13em; }
    .fa-atlas-loc { cursor:pointer; }
    .fa-atlas-loc:focus { outline:none; }
    .fa-atlas-legend { display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; color:${theme.muted}; font-size:10px; }
    .fa-status { color:${theme.muted}; font-size:10px; margin-top:auto; padding:12px 8px 0; }
    .fa-mobile-menu { display:none; }
    @media(max-width:1050px) { .fa-shell { grid-template-columns:190px minmax(0,1fr); } .fa-right { display:none; } .fa-brand { min-width:180px; } }
    @media(max-width:700px) {
      .fa-top { height:58px; padding:0 10px; gap:8px; } .fa-brand { min-width:0; } .fa-brand-sub { display:none; } .fa-brand-title { font-size:10px; letter-spacing:.08em; } .fa-mark { width:29px; height:29px; }
      .fa-top-actions { gap:4px; } .fa-top-actions .wide { display:none; } .fa-btn { padding:8px 9px; }
      .fa-shell { display:block; min-height:calc(100vh - 58px); } .fa-left { display:none; } .fa-center { padding:17px 10px 28px; }
      .fa-mobile-menu { display:flex; gap:5px; overflow-x:auto; margin-bottom:17px; padding-bottom:3px; }
      .fa-mobile-menu .fa-btn { flex:0 0 auto; } .fa-workhead { margin-bottom:15px; } .fa-workhead h1 { font-size:27px; }
      .fa-canvas-wrap { padding:6px; } .scrapbook-canvas { aspect-ratio:.78; max-height:none; }
      .fa-paper-element.note { padding:4px; } .fa-card-grid { grid-template-columns:1fr; }
      .fa-field-row { grid-template-columns:1fr 1fr; } .fa-atlas { aspect-ratio:.85; min-height:320px; }
    }
  `;

  const renderScrapbook = () => (
    <>
      <div className="fa-workhead">
        <div>
          <div className="fa-eyebrow">Volume I / Scrapbook</div>
          <h1>{activePage?.title || "Scrapbook"}</h1>
          <div className="fa-subtitle">A working collection of character fragments, memories, and things worth keeping.</div>
        </div>
        <button className="fa-btn" onClick={() => addPage("collage")}>＋ New page</button>
      </div>
      <div className="fa-toolbar">
        <button className="fa-btn" onClick={() => addElement("heading")}>＋ Heading</button>
        <button className="fa-btn" onClick={() => addElement("note")}>＋ Note</button>
        <button className="fa-btn" onClick={() => addElement("photo")}>＋ Photo</button>
        <button className="fa-btn" onClick={() => addElement("ticket")}>＋ Ticket</button>
        <button className="fa-btn" onClick={() => addElement("tape")}>＋ Tape</button>
        <button className="fa-btn" onClick={() => addElement("sticker")}>＋ Sticker</button>
        <button className="fa-btn" onClick={() => addPage("journal")}>Journal template</button>
      </div>
      {activePage ? (
        <div className="fa-canvas-wrap">
          <div className="scrapbook-canvas" style={{ backgroundColor: activePage.background }}>
            {activePage.elements.map((el) => (
              <div
                key={el.id}
                className={`fa-paper-element ${el.type} ${selectedElementId === el.id ? "selected" : ""}`}
                style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`, transform: `rotate(${el.rotate || 0}deg)`, color: el.color || "#473a32", fontSize: `${el.size || 13}px` }}
                onPointerDown={(e) => startDrag(e, el)}
                onClick={() => setSelectedElementId(el.id)}
                title="Select and drag to move"
              >
                {el.text}
              </div>
            ))}
          </div>
          <div className="fa-canvas-footer"><span>PAGE {String(data.pages.findIndex(p => p.id === activePage.id) + 1).padStart(2, "0")} / {String(pageCount).padStart(2, "0")}</span><span>SELECT · DRAG · EDIT</span></div>
        </div>
      ) : <div className="fa-empty">Create a page to begin your scrapbook.</div>}
      <div className="fa-muted" style={{ marginTop: 12 }}>Tip: select an item to edit its text and appearance in the right panel. Drag items directly on the page to rearrange the collage.</div>
    </>
  );

  const renderCharacters = () => (
    <>
      <div className="fa-workhead"><div><div className="fa-eyebrow">Index / People & personas</div><h1>Characters</h1><div className="fa-subtitle">Keep the people, their histories, and their connections in one place.</div></div><button className="fa-btn primary" onClick={addCharacter}>＋ Character</button></div>
      {data.characters.length ? <div className="fa-card-grid">{data.characters.map((c) => (
        <div className="fa-record-card" key={c.id}>
          <div className="fa-record-top"><span className="fa-chip">{c.role || "Character"}</span><button className="fa-btn ghost" onClick={() => updateCharacter(c.id, { expanded: !c.expanded })}>{c.expanded ? "Close" : "Edit"}</button></div>
          <h3 style={{ marginTop: 12 }}>{c.name}</h3><div className="fa-muted">{c.affiliation || "No affiliation recorded"}</div>
          <p>{c.traits || "Traits not yet documented."}</p>
          {c.expanded && <div style={{ borderTop: `1px solid ${theme.line}`, marginTop: 10, paddingTop: 6 }}>
            <label className="fa-label">Name</label><input className="fa-input" value={c.name} onChange={(e) => updateCharacter(c.id, { name: e.target.value })}/>
            <label className="fa-label">Role / epithet</label><input className="fa-input" value={c.role} onChange={(e) => updateCharacter(c.id, { role: e.target.value })}/>
            <label className="fa-label">Affiliation</label><input className="fa-input" value={c.affiliation} onChange={(e) => updateCharacter(c.id, { affiliation: e.target.value })}/>
            <label className="fa-label">Traits</label><textarea className="fa-textarea" value={c.traits} onChange={(e) => updateCharacter(c.id, { traits: e.target.value })}/>
            <label className="fa-label">Biography</label><textarea className="fa-textarea" value={c.biography} onChange={(e) => updateCharacter(c.id, { biography: e.target.value })}/>
            <label className="fa-label">Personal notes</label><textarea className="fa-textarea" value={c.notes} onChange={(e) => updateCharacter(c.id, { notes: e.target.value })}/>
            <label className="fa-label">Atlas location</label><select className="fa-select" value={c.locationId || ""} onChange={(e) => updateCharacter(c.id, { locationId: e.target.value })}><option value="">Unlinked</option>{data.atlas.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            <button className="fa-btn" style={{ marginTop: 10 }} onClick={() => update((d) => { d.characters = d.characters.filter(x => x.id !== c.id); d.keepsakes.forEach(k => { if (k.ownerId === c.id) k.ownerId = ""; }); }, "Character removed")}>Remove character</button>
          </div>}
          {!c.expanded && <div className="fa-muted">{c.biography ? `${c.biography.slice(0, 115)}${c.biography.length > 115 ? "…" : ""}` : "Open Edit to add a biography."}</div>}
          {c.locationId && <div className="fa-chip" style={{ marginTop: 12 }}>{data.atlas.locations.find(l => l.id === c.locationId)?.name || "Linked location"}</div>}
        </div>
      ))}</div> : <div className="fa-empty">No characters yet. Add the first person to your archive.</div>}
    </>
  );

  const renderKeepsakes = () => (
    <>
      <div className="fa-workhead"><div><div className="fa-eyebrow">Inventory / Objects & ephemera</div><h1>Keepsakes</h1><div className="fa-subtitle">Artifacts, letters, photographs, rumors, and objects with a story attached.</div></div><button className="fa-btn primary" onClick={addKeepsake}>＋ Keepsake</button></div>
      {data.keepsakes.length ? <div className="fa-card-grid">{data.keepsakes.map((k) => (
        <div className="fa-record-card" key={k.id}>
          <div className="fa-record-top"><span className="fa-chip">{k.category || "Artifact"}</span><button className="fa-btn ghost" onClick={() => updateKeepsake(k.id, { expanded: !k.expanded })}>{k.expanded ? "Close" : "Edit"}</button></div>
          <h3 style={{ marginTop: 12 }}>{k.name}</h3><p>{k.description || "No description recorded."}</p>
          {k.ownerId && <div className="fa-muted">Held by: {data.characters.find(c => c.id === k.ownerId)?.name || "Unknown"}</div>}
          {k.expanded && <div style={{ borderTop: `1px solid ${theme.line}`, marginTop: 10, paddingTop: 6 }}>
            <label className="fa-label">Name</label><input className="fa-input" value={k.name} onChange={(e) => updateKeepsake(k.id, { name: e.target.value })}/>
            <label className="fa-label">Category</label><input className="fa-input" value={k.category} onChange={(e) => updateKeepsake(k.id, { category: e.target.value })}/>
            <label className="fa-label">Description</label><textarea className="fa-textarea" value={k.description} onChange={(e) => updateKeepsake(k.id, { description: e.target.value })}/>
            <label className="fa-label">History / details</label><textarea className="fa-textarea" value={k.details} onChange={(e) => updateKeepsake(k.id, { details: e.target.value })}/>
            <label className="fa-label">Character</label><select className="fa-select" value={k.ownerId || ""} onChange={(e) => updateKeepsake(k.id, { ownerId: e.target.value })}><option value="">No linked character</option>{data.characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <label className="fa-label">Atlas location</label><select className="fa-select" value={k.locationId || ""} onChange={(e) => updateKeepsake(k.id, { locationId: e.target.value })}><option value="">Unlinked</option>{data.atlas.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            <button className="fa-btn" style={{ marginTop: 10 }} onClick={() => update((d) => { d.keepsakes = d.keepsakes.filter(x => x.id !== k.id); }, "Keepsake removed")}>Remove keepsake</button>
          </div>}
          {!k.expanded && k.details && <div className="fa-muted">{k.details.slice(0, 120)}{k.details.length > 120 ? "…" : ""}</div>}
          {k.locationId && <div className="fa-chip" style={{ marginTop: 12 }}>{data.atlas.locations.find(l => l.id === k.locationId)?.name || "Linked location"}</div>}
        </div>
      ))}</div> : <div className="fa-empty">The keepsake cabinet is empty. Add an artifact, letter, or other fragment.</div>}
    </>
  );

  const renderAtlas = () => {
    const technical = data.atlasStyle === "technical";
    const ink = technical ? "#b9d5cc" : "#514637";
    const accent = technical ? "#70b5a5" : "#8b6941";
    const bg = technical ? "#17282b" : "#e4d7ba";
    return <>
      <div className="fa-workhead"><div><div className="fa-eyebrow">Rear section / Cartography</div><h1>Personal Atlas</h1><div className="fa-subtitle">A map of the places that belong to this world. Select a marker to edit it.</div></div><button className="fa-btn primary" onClick={() => addLocation(50, 50)}>＋ Location</button></div>
      <div className="fa-toolbar">
        <button className={`fa-btn ${!technical ? "primary" : ""}`} onClick={() => update(d => { d.atlasStyle = "handdrawn"; }, "Hand-drawn atlas")}>Hand-drawn</button>
        <button className={`fa-btn ${technical ? "primary" : ""}`} onClick={() => update(d => { d.atlasStyle = "technical"; }, "Technical atlas")}>Technical</button>
        <button className="fa-btn" onClick={() => update(d => { d.atlas.title = prompt("Atlas title", d.atlas.title) || d.atlas.title; }, "Atlas title updated")}>Edit title</button>
      </div>
      <div className={`fa-atlas ${technical ? "technical" : ""}`} style={{ background: bg }}>
        <svg viewBox="0 0 800 710" role="img" aria-label="Editable fictional atlas">
          <defs>
            <pattern id="atlasGrid" width={technical ? "32" : "48"} height={technical ? "32" : "48"} patternUnits="userSpaceOnUse">
              <path d={technical ? "M 32 0 L 0 0 0 32" : "M 48 0 L 0 0 0 48"} fill="none" stroke={ink} strokeOpacity={technical ? ".16" : ".09"} strokeWidth="1"/>
            </pattern>
            <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
              <line x1="0" y1="0" x2="0" y2="9" stroke={ink} strokeOpacity=".13" strokeWidth="2"/>
            </pattern>
          </defs>
          <rect width="800" height="710" fill="url(#atlasGrid)"/>
          {!technical && <g fill="none" stroke={ink} strokeOpacity=".35" strokeWidth="2">
            <path d="M60 180 Q110 105 200 155 T340 150 Q400 180 470 110 T670 155 L730 220 Q680 270 710 340 T650 450 Q580 500 600 570 L480 650 Q420 600 360 630 T200 570 Q170 490 110 460 T80 320 Q105 255 60 180Z" fill="url(#hatch)"/>
            <path d="M95 240 Q170 205 215 250 T330 270 T440 230 T590 260 T705 300" strokeWidth="3"/>
            <path d="M150 420 Q220 370 275 420 T390 450 T500 420 T655 465" strokeDasharray="5 7"/>
            <path d="M275 110 Q300 180 280 250 T320 370 T290 500" strokeWidth="2"/>
            <path d="M520 120 Q490 220 530 300 T500 450 T530 580" strokeWidth="2"/>
          </g>}
          {technical && <g fill="none" stroke={ink} strokeOpacity=".3" strokeWidth="1.4">
            <path d="M65 170 L175 110 L295 140 L370 100 L480 140 L585 115 L720 180 L690 310 L735 410 L655 515 L600 615 L465 650 L365 610 L250 640 L140 565 L90 445 L115 330Z"/>
            <path d="M80 240 L720 240 M80 340 L720 340 M80 440 L720 440 M80 540 L720 540 M180 80 L180 640 M280 80 L280 640 M380 80 L380 640 M480 80 L480 640 M580 80 L580 640 M680 80 L680 640" strokeDasharray="3 7"/>
            <path d="M110 210 Q240 270 310 330 T470 410 T680 530" stroke={accent} strokeWidth="3" strokeDasharray="7 5"/>
          </g>}
          <text x="42" y="48" fill={ink} className="fa-atlas-title">{data.atlas.title}</text>
          <text x="44" y="72" fill={ink} className="fa-atlas-sub">{data.atlas.subtitle}</text>
          <g transform="translate(718 92)" stroke={ink} fill="none" strokeWidth="2">
            <path d="M0 35 L0 -10 M-10 8 L0 -10 L10 8 M0 0 L-12 35 L0 29 L12 35Z"/>
            <text x="0" y="-20" fill={ink} stroke="none" fontSize="13" textAnchor="middle">N</text>
          </g>
          {data.atlas.routes.map((route) => {
            const a = data.atlas.locations.find(l => l.id === route.from);
            const b = data.atlas.locations.find(l => l.id === route.to);
            if (!a || !b) return null;
            return <line key={route.id} x1={a.x * 8} y1={a.y * 7.1} x2={b.x * 8} y2={b.y * 7.1} stroke={accent} strokeWidth="2" strokeDasharray={technical ? "7 5" : "3 5"} opacity=".8"/>;
          })}
          {data.atlas.locations.map((l, i) => (
            <g key={l.id} className="fa-atlas-loc" tabIndex="0" role="button" aria-label={`Select ${l.name}`} onClick={() => setSelectedLocationId(l.id)} onKeyDown={(e) => { if (e.key === "Enter") setSelectedLocationId(l.id); }}>
              <circle cx={l.x * 8} cy={l.y * 7.1} r={selectedLocationId === l.id ? 13 : 9} fill={selectedLocationId === l.id ? accent : bg} stroke={accent} strokeWidth="2.5"/>
              <circle cx={l.x * 8} cy={l.y * 7.1} r="2.5" fill={accent}/>
              <text x={l.x * 8 + 15} y={l.y * 7.1 - 10} fill={ink} fontSize="15" fontFamily={technical ? "monospace" : "Georgia,serif"}>{l.name}</text>
              <text x={l.x * 8 + 15} y={l.y * 7.1 + 7} fill={ink} opacity=".7" fontSize="9" letterSpacing="1">{l.type.toUpperCase()}</text>
            </g>
          ))}
          <text x="42" y="674" fill={ink} className="fa-atlas-sub">PRIVATE COPY / {String(data.atlas.locations.length).padStart(2, "0")} LOCATIONS MAPPED</text>
          <text x="750" y="674" fill={ink} className="fa-atlas-sub" textAnchor="end">NORTH IS A SUGGESTION</text>
        </svg>
      </div>
      <div className="fa-atlas-legend"><span>● {data.atlas.locations.length} mapped locations</span><span>┄ Routes connect known places</span><span>Selected marker opens its details in the side panel</span></div>
      {selectedLocation && <div className="fa-record-card" style={{ marginTop: 14 }}>
        <div className="fa-record-top"><h3>{selectedLocation.name}</h3><button className="fa-btn" onClick={() => deleteLocation(selectedLocation.id)}>Remove</button></div>
        <label className="fa-label">Location name</label><input className="fa-input" value={selectedLocation.name} onChange={(e) => updateLocation(selectedLocation.id, { name: e.target.value })}/>
        <label className="fa-label">Type</label><input className="fa-input" value={selectedLocation.type} onChange={(e) => updateLocation(selectedLocation.id, { type: e.target.value })}/>
        <label className="fa-label">Notes</label><textarea className="fa-textarea" value={selectedLocation.notes} onChange={(e) => updateLocation(selectedLocation.id, { notes: e.target.value })}/>
        <div className="fa-field-row"><div><label className="fa-label">X position</label><input className="fa-input" type="number" min="5" max="90" value={selectedLocation.x} onChange={(e) => updateLocation(selectedLocation.id, { x: Math.max(5, Math.min(90, Number(e.target.value))) })}/></div><div><label className="fa-label">Y position</label><input className="fa-input" type="number" min="10" max="90" value={selectedLocation.y} onChange={(e) => updateLocation(selectedLocation.id, { y: Math.max(10, Math.min(90, Number(e.target.value))) })}/></div></div>
      </div>}
    </>;
  };

  const renderRight = () => {
    if (data.activeTab === "scrapbook") {
      return <>
        <div className="fa-eyebrow">Inspector / Page</div>
        <label className="fa-label">Page title</label>
        <input className="fa-input" value={activePage?.title || ""} onChange={(e) => update(d => { const p = d.pages.find(x => x.id === d.activePageId); if (p) p.title = e.target.value; }, "Page title edited")}/>
        <label className="fa-label">Paper tone</label>
        <div style={{ display: "flex", gap: 7, marginTop: 7 }}>
          {["#e8dcc5", "#eee5d4", "#d8d8d0", "#e3d3d0", "#d4d9d2"].map(color => <button key={color} aria-label={`Set paper ${color}`} onClick={() => update(d => { const p = d.pages.find(x => x.id === d.activePageId); if (p) p.background = color; }, "Paper color changed")} style={{ width: 26, height: 26, borderRadius: 6, border: activePage?.background === color ? `2px solid ${theme.accent}` : `1px solid ${theme.line}`, background: color, cursor: "pointer" }}/>)}
        </div>
        {selectedElement ? <>
          <div className="fa-section-title" style={{ marginLeft: 0 }}>Selected element</div>
          <div className="fa-chip">{selectedElement.type}</div>
          <label className="fa-label">Text</label><textarea className="fa-textarea" value={selectedElement.text} onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}/>
          <div className="fa-field-row">
            <div><label className="fa-label">Width %</label><input className="fa-input" type="number" min="8" max="90" value={selectedElement.w} onChange={(e) => updateElement(selectedElement.id, { w: Math.max(8, Math.min(90, Number(e.target.value))) })}/></div>
            <div><label className="fa-label">Height %</label><input className="fa-input" type="number" min="5" max="80" value={selectedElement.h} onChange={(e) => updateElement(selectedElement.id, { h: Math.max(5, Math.min(80, Number(e.target.value))) })}/></div>
          </div>
          <div className="fa-field-row">
            <div><label className="fa-label">Rotation °</label><input className="fa-input" type="number" min="-30" max="30" value={selectedElement.rotate || 0} onChange={(e) => updateElement(selectedElement.id, { rotate: Math.max(-30, Math.min(30, Number(e.target.value))) })}/></div>
            <div><label className="fa-label">Text size</label><input className="fa-input" type="number" min="8" max="32" value={selectedElement.size || 13} onChange={(e) => updateElement(selectedElement.id, { size: Math.max(8, Math.min(32, Number(e.target.value))) })}/></div>
          </div>
          <label className="fa-label">Ink color</label><input className="fa-input" type="color" value={selectedElement.color || "#473a32"} onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })} style={{ height: 39, padding: 4 }}/>
          <button className="fa-btn" style={{ width: "100%", marginTop: 12 }} onClick={() => updateElement(selectedElement.id, { rotate: (selectedElement.rotate || 0) + 2 })}>Rotate +2°</button>
          <button className="fa-btn" style={{ width: "100%", marginTop: 7, color: "#e6a39a" }} onClick={() => removeElement(selectedElement.id)}>Remove element</button>
        </> : <div className="fa-empty" style={{ marginTop: 18, padding: 16 }}>Select a page element to edit its text, size, rotation, and ink.</div>}
        <div className="fa-section-title" style={{ marginLeft: 0 }}>Pages · {pageCount}</div>
        {data.pages.map((p, i) => <div className={`fa-mini-card ${p.id === data.activePageId ? "active" : ""}`} key={p.id} onClick={() => { update(d => { d.activePageId = p.id; }, "Page opened"); setSelectedElementId(null); }}><div className="fa-mini-title">{p.title || "Untitled page"}</div><div className="fa-mini-meta">PAGE {String(i + 1).padStart(2, "0")} · {p.elements.length} ELEMENTS</div></div>)}
        <button className="fa-btn" style={{ width: "100%", marginTop: 8 }} onClick={() => { if (data.pages.length <= 1) { setNotice("Keep at least one scrapbook page"); return; } update(d => { d.pages = d.pages.filter(p => p.id !== d.activePageId); d.activePageId = d.pages[0].id; }, "Page removed"); setSelectedElementId(null); }}>Delete current page</button>
      </>;
    }
    if (data.activeTab === "atlas") {
      return <>
        <div className="fa-eyebrow">Atlas index</div><div className="fa-section-title" style={{ marginLeft: 0 }}>Mapped places</div>
        {data.atlas.locations.map((l, i) => <div className={`fa-mini-card ${l.id === selectedLocationId ? "active" : ""}`} key={l.id} onClick={() => setSelectedLocationId(l.id)}><div className="fa-mini-title">{l.name}</div><div className="fa-mini-meta">{l.type} · {String(i + 1).padStart(2, "0")}</div></div>)}
        {!selectedLocation && <div className="fa-empty" style={{ marginTop: 12 }}>Choose a place on the map or from the index.</div>}
        <div className="fa-section-title" style={{ marginLeft: 0 }}>Linked archive</div>
        <div className="fa-muted">Characters and keepsakes can link to atlas locations. Edit those links from their records.</div>
      </>;
    }
    return <><div className="fa-eyebrow">Archive index</div><div className="fa-section-title" style={{ marginLeft: 0 }}>Quick counts</div><div className="fa-record-card"><div className="fa-mini-title">Characters</div><h3 style={{ fontFamily: "Georgia,serif", fontSize: 28, margin: "5px 0" }}>{data.characters.length}</h3></div><div className="fa-record-card" style={{ marginTop: 8 }}><div className="fa-mini-title">Keepsakes</div><h3 style={{ fontFamily: "Georgia,serif", fontSize: 28, margin: "5px 0" }}>{data.keepsakes.length}</h3></div><div className="fa-record-card" style={{ marginTop: 8 }}><div className="fa-mini-title">Atlas locations</div><h3 style={{ fontFamily: "Georgia,serif", fontSize: 28, margin: "5px 0" }}>{data.atlas.locations.length}</h3></div><div className="fa-section-title" style={{ marginLeft: 0 }}>Local-first</div><div className="fa-muted">Your project autosaves in this browser. Export a JSON backup to move it to another device or browser.</div></>;
  };

  return (
    <div className="fa-app">
      <style>{styles}</style>
      <header className="fa-top">
        <div className="fa-brand">
          <div className="fa-mark">✳</div>
          <div><div className="fa-brand-title">The Fictional Archive</div><div className="fa-brand-sub">Private world / Volume I</div></div>
        </div>
        <div className="fa-top-actions">
          <span className="fa-muted wide" style={{ marginRight: 4 }}>{notice}</span>
          <button className="fa-btn wide" disabled={!history.length} onClick={undo} title="Undo">↶ Undo</button>
          <button className="fa-btn wide" disabled={!future.length} onClick={redo} title="Redo">↷ Redo</button>
          <button className="fa-btn wide" onClick={() => fileInputRef.current?.click()}>Import</button>
          <button className="fa-btn primary" onClick={exportProject}>Export</button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={importProject} style={{ display: "none" }}/>
        </div>
      </header>
      <div className="fa-shell">
        <aside className="fa-left">
          <div className="fa-eyebrow" style={{ margin: "5px 8px 13px" }}>Contents</div>
          <nav className="fa-nav">{tabs.map(t => <button key={t.id} className={data.activeTab === t.id ? "active" : ""} onClick={() => update(d => { d.activeTab = t.id; }, `${t.label} opened`)}><span className="nav-icon">{t.icon}</span>{t.label}{t.id === "atlas" && <span style={{ marginLeft: "auto", fontSize: 10 }}>BACK</span>}</button>)}</nav>
          <div className="fa-section-title">Current volume</div>
          <div className="fa-mini-card"><div className="fa-mini-title">The Known & Unsettled</div><div className="fa-mini-meta">FICTIONAL SETTING</div></div>
          <div className="fa-section-title">Scrapbook pages</div>
          {data.pages.map((p, i) => <div className={`fa-mini-card ${p.id === data.activePageId && data.activeTab === "scrapbook" ? "active" : ""}`} key={p.id} onClick={() => update(d => { d.activePageId = p.id; d.activeTab = "scrapbook"; }, "Page opened")}><div className="fa-mini-title">{p.title || "Untitled page"}</div><div className="fa-mini-meta">PAGE {String(i + 1).padStart(2, "0")}</div></div>)}
          <button className="fa-btn" style={{ width: "100%", marginTop: 9 }} onClick={() => addPage("collage")}>＋ Add scrapbook page</button>
          <div className="fa-status">● {notice}<br/>Stored on this device</div>
        </aside>
        <main className="fa-center">
          <div className="fa-mobile-menu">{tabs.map(t => <button key={t.id} className={`fa-btn ${data.activeTab === t.id ? "primary" : ""}`} onClick={() => update(d => { d.activeTab = t.id; }, `${t.label} opened`)}>{t.icon} {t.label}</button>)}<button className="fa-btn" onClick={() => setMobilePanel(v => !v)}>{mobilePanel ? "Hide details" : "Details"}</button></div>
          {data.activeTab === "scrapbook" && renderScrapbook()}
          {data.activeTab === "characters" && renderCharacters()}
          {data.activeTab === "keepsakes" && renderKeepsakes()}
          {data.activeTab === "atlas" && renderAtlas()}
          {mobilePanel && <div className="fa-record-card" style={{ marginTop: 18 }}>{renderRight()}</div>}
        </main>
        <aside className="fa-right">{renderRight()}</aside>
      </div>
    </div>
  );
}


import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<App />);
