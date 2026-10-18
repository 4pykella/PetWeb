// Miki — markdown-вики без бэкенда.
// files.json (дерево docs/) → навигация; страницы рендерятся marked + highlight.js;
// полнотекстовый поиск строится в браузере при первом открытии палитры.

const GITHUB_BLOB = "https://github.com/4pykella/PetWeb/blob/main/html/miki/";
const STORAGE_LAST = "miki:last";
const STORAGE_RECENT = "miki:recent";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* приватный режим */ }
  },
};

// ===== Утилиты =====
const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalize = (s) => s.toLowerCase().replace(/ё/g, "е");
const prettyName = (name) => name.replace(/\.md$/, "").replace(/_/g, " ");

// id заголовка — совместим со ссылками вида [Шаг 1](#шаг-1-теория)
const slugify = (text) => text.toLowerCase().trim()
  .replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");

// Набрали запрос не в той раскладке: «ljrth» → «докер»
const EN = "`qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const RU = "ёйцукенгшщзхъфывапролджэячсмитьбю";
function swapLayout(s) {
  return [...s].map(ch => {
    let i = EN.indexOf(ch);
    if (i >= 0) return RU[i];
    i = RU.indexOf(ch);
    return i >= 0 ? EN[i] : ch;
  }).join("");
}

// Markdown → простой текст для индекса и сниппетов
function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, m => m.replace(/```\w*/g, " "))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ===== Состояние =====
const state = {
  docs: [],            // [{ path, title, crumbs }] в порядке дерева
  byPath: new Map(),
  cache: new Map(),    // path → markdown
  index: null,         // поисковый индекс (строится лениво)
  current: null,
};

const nav = $("#nav");
const content = $("#content");
const sidebar = $("#sidebar");

// ===== Тема =====
const themeBtn = $("#theme-toggle");
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  $("i", themeBtn).className = theme === "dark" ? "fa-solid fa-moon" : "fa-solid fa-sun";
  $("#hljs-dark").disabled = theme !== "dark";
  $("#hljs-light").disabled = theme === "dark";
}
applyTheme(document.documentElement.getAttribute("data-theme") || "dark");
themeBtn.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem("theme", next); } catch (e) { /* ignore */ }
});

// ===== Дерево =====
function countDocs(tree) {
  return Object.values(tree).reduce((n, v) => n + (typeof v === "string" ? 1 : countDocs(v)), 0);
}

function renderTree(tree, parent, crumbs = []) {
  for (const [name, value] of Object.entries(tree)) {
    const li = document.createElement("li");
    li.className = "tree-item";

    if (typeof value === "string") {
      const doc = { path: value, title: prettyName(name), crumbs };
      state.docs.push(doc);
      state.byPath.set(value, doc);

      const a = document.createElement("a");
      a.href = "#" + value;
      a.dataset.path = value;
      a.innerHTML = `<i class="fa-regular fa-file-lines"></i><span>${escapeHtml(doc.title)}</span>`;
      li.appendChild(a);
    } else {
      if (countDocs(value) === 0) continue; // пустые папки не показываем
      const folder = document.createElement("div");
      folder.className = "folder";
      folder.innerHTML = `<i class="fa-solid fa-folder"></i><span>${escapeHtml(prettyName(name))}</span><i class="fa-solid fa-chevron-right chevron"></i>`;
      folder.addEventListener("click", () => toggleFolder(folder));

      const ul = document.createElement("ul");
      ul.className = "nested";
      renderTree(value, ul, [...crumbs, prettyName(name)]);

      li.append(folder, ul);
    }
    parent.appendChild(li);
  }
}

function toggleFolder(folder, open) {
  const ul = folder.nextElementSibling;
  const isOpen = open ?? !ul.classList.contains("open");
  ul.classList.toggle("open", isOpen);
  folder.classList.toggle("open", isOpen);
}

function revealInTree(path) {
  $$("a.active", nav).forEach(a => a.classList.remove("active"));
  const link = $$("a[data-path]", nav).find(a => a.dataset.path === path);
  if (!link) return;
  link.classList.add("active");
  for (let el = link.parentElement; el && el !== nav; el = el.parentElement) {
    if (el.classList.contains("nested")) toggleFolder(el.previousElementSibling, true);
  }
  // прокрутить сайдбар к активной странице, если она вне видимой области
  const r = link.getBoundingClientRect();
  if (r.top < 0 || r.bottom > window.innerHeight) link.scrollIntoView({ block: "center" });
}

$("#expand-all").addEventListener("click", () => $$(".folder", nav).forEach(f => toggleFolder(f, true)));
$("#collapse-all").addEventListener("click", () => $$(".folder", nav).forEach(f => toggleFolder(f, false)));

// Фильтр дерева по названию
$("#tree-filter").addEventListener("input", (e) => {
  const q = normalize(e.target.value.trim());
  $$(".tree-item", nav).forEach(li => li.classList.remove("hidden"));
  if (!q) {
    $$(".folder", nav).forEach(f => toggleFolder(f, false));
    if (state.current) revealInTree(state.current);
    return;
  }
  // снизу вверх: папка видна, если видно хоть что-то внутри
  $$(".tree-item", nav).reverse().forEach(li => {
    const own = normalize((li.firstElementChild.textContent || ""));
    const childVisible = $$(":scope > ul > .tree-item:not(.hidden)", li).length > 0;
    const match = own.includes(q) || childVisible;
    li.classList.toggle("hidden", !match);
    if (li.firstElementChild.classList.contains("folder")) toggleFolder(li.firstElementChild, childVisible);
  });
});

// ===== Загрузка страницы =====
async function fetchDoc(path) {
  if (state.cache.has(path)) return state.cache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(res.status);
  const text = await res.text();
  state.cache.set(path, text);
  return text;
}

function parseHash() {
  const raw = decodeURIComponent(location.hash.slice(1));
  const m = /^(docs\/.+?\.md)(?:#(.*))?$/.exec(raw);
  return m ? { path: m[1], anchor: m[2] || "" } : null;
}

async function openDoc(path, { anchor = "", query = "", push = true } = {}) {
  let md;
  try {
    md = await fetchDoc(path);
  } catch (err) {
    content.innerHTML = `<h1>Страница не найдена</h1><p>Не удалось загрузить <code>${escapeHtml(path)}</code>.</p>`;
    $("#breadcrumbs").innerHTML = "";
    $("#doc-meta").innerHTML = "";
    $("#doc-footer").innerHTML = "";
    $("#toc").innerHTML = "";
    return;
  }

  state.current = path;
  const doc = state.byPath.get(path) || { path, title: prettyName(path.split("/").pop()), crumbs: [] };

  content.innerHTML = marked.parse(md);
  enhanceContent(path);
  renderBreadcrumbs(doc);
  renderMeta(md);
  renderFooter(doc);
  renderToc();
  revealInTree(path);
  closeMobileMenu();

  document.title = `${doc.title} — Miki`;
  const hash = "#" + path + (anchor ? "#" + anchor : "");
  if (location.hash !== hash) history[push ? "pushState" : "replaceState"](null, "", hash);

  store.set(STORAGE_LAST, path);
  const recent = store.get(STORAGE_RECENT, []).filter(p => p !== path);
  store.set(STORAGE_RECENT, [path, ...recent].slice(0, 6));

  // анимация появления карточки
  const card = $("#doc");
  card.style.animation = "none";
  void card.offsetWidth;
  card.style.animation = "";

  if (query) {
    const first = highlightTerms(query);
    if (first && !anchor) {
      first.scrollIntoView({ block: "center" });
      return;
    }
  }
  const target = anchor && document.getElementById(anchor);
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
}

function enhanceContent(path) {
  // id и якоря для заголовков
  const used = new Map();
  $$("h1, h2, h3, h4", content).forEach(h => {
    let id = slugify(h.textContent);
    const n = used.get(id) || 0;
    used.set(id, n + 1);
    if (n) id += "-" + n;
    h.id = id;
    if (h.tagName !== "H1") {
      const a = document.createElement("a");
      a.className = "heading-anchor";
      a.href = "#" + id;
      a.textContent = "#";
      a.setAttribute("aria-label", "Ссылка на раздел");
      h.prepend(a);
    }
  });

  // блоки кода: шапка с языком и кнопка копирования
  $$("pre > code", content).forEach(code => {
    const pre = code.parentElement;
    const lang = (code.className.match(/language-([\w-]+)/) || [])[1] || "text";
    if (window.hljs && lang !== "text") hljs.highlightElement(code);

    const wrap = document.createElement("div");
    wrap.className = "code-block";
    wrap.innerHTML = `<div class="code-head"><span>${escapeHtml(lang)}</span>
      <button class="copy-btn" type="button"><i class="fa-regular fa-copy"></i> копировать</button></div>`;
    pre.replaceWith(wrap);
    wrap.appendChild(pre);

    const btn = $(".copy-btn", wrap);
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.innerText);
        btn.classList.add("copied");
        btn.innerHTML = `<i class="fa-solid fa-check"></i> скопировано`;
      } catch (e) {
        btn.innerHTML = `<i class="fa-solid fa-xmark"></i> не вышло`;
      }
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = `<i class="fa-regular fa-copy"></i> копировать`;
      }, 1600);
    });
  });

  // ссылки: внешние — в новой вкладке, относительные .md — внутри Miki
  const base = path.split("/").slice(0, -1);
  $$("a[href]", content).forEach(a => {
    const href = a.getAttribute("href");
    if (/^https?:\/\//.test(href)) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    } else if (/\.md(#.*)?$/.test(href) && !href.startsWith("#")) {
      const [file, anchor] = href.split("#");
      const parts = [...base];
      for (const seg of decodeURI(file).split("/")) {
        if (seg === "..") parts.pop();
        else if (seg && seg !== ".") parts.push(seg);
      }
      a.setAttribute("href", "#" + parts.join("/") + (anchor ? "#" + anchor : ""));
    }
  });
}

function renderBreadcrumbs(doc) {
  const parts = ["miki", ...doc.crumbs].map(c => `<span>${escapeHtml(c)}</span><i class="fa-solid fa-chevron-right"></i>`);
  $("#breadcrumbs").innerHTML = parts.join("") + `<span class="crumb-current">${escapeHtml(doc.title)}</span>`;
}

function renderMeta(md) {
  const words = stripMarkdown(md).split(" ").filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 180));
  const sections = $$("h2", content).length;
  const code = $$(".code-block", content).length;
  const items = [`<span><i class="fa-regular fa-clock"></i>${minutes} мин чтения</span>`];
  if (sections) items.push(`<span><i class="fa-solid fa-list"></i>${sections} разделов</span>`);
  if (code) items.push(`<span><i class="fa-solid fa-terminal"></i>${code} блоков кода</span>`);
  $("#doc-meta").innerHTML = items.join("");
}

function renderFooter(doc) {
  const i = state.docs.findIndex(d => d.path === doc.path);
  const prev = state.docs[i - 1];
  const next = state.docs[i + 1];
  const link = (d, cls, label) => d
    ? `<a class="${cls}" href="#${escapeHtml(d.path)}"><small>${label}</small><span>${escapeHtml(d.title)}</span></a>`
    : "";
  $("#doc-footer").innerHTML =
    `<div class="pager">${link(prev, "prev", "← Назад")}${link(next, "next", "Далее →")}</div>
     <a class="edit-link" href="${GITHUB_BLOB}${encodeURI(doc.path)}" target="_blank" rel="noopener noreferrer">
       <i class="fa-brands fa-github"></i> Открыть на GitHub</a>`;
}

// ===== Оглавление со scrollspy =====
let tocObserver;
function renderToc() {
  const toc = $("#toc");
  const heads = $$("h2, h3", content);
  if (tocObserver) tocObserver.disconnect();
  if (heads.length < 2) {
    toc.innerHTML = "";
    return;
  }
  toc.innerHTML = `<h4>На этой странице</h4><ul>${heads.map(h =>
    `<li><a href="#${h.id}" class="lvl-${h.tagName[1]}" data-id="${h.id}">${escapeHtml(h.textContent.replace(/^#/, ""))}</a></li>`
  ).join("")}</ul>`;

  tocObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      $$("a", toc).forEach(a => a.classList.toggle("active", a.dataset.id === e.target.id));
    });
  }, { rootMargin: "0px 0px -70% 0px" });
  heads.forEach(h => tocObserver.observe(h));
}

// Подсветить вхождения запроса в тексте страницы
function highlightTerms(query) {
  const terms = normalize(query).split(/\s+/).filter(t => t.length > 1);
  if (!terms.length) return null;
  const re = new RegExp(terms.map(escapeRe).join("|").replace(/е/g, "[её]"), "gi");
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement.closest(".code-head, .heading-anchor") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let first = null;
  for (const node of nodes) {
    const text = node.nodeValue;
    re.lastIndex = 0;
    if (!re.test(text)) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    text.replace(re, (m, idx) => {
      frag.append(text.slice(last, idx));
      const mark = document.createElement("mark");
      mark.className = "search-hit";
      mark.textContent = m;
      frag.append(mark);
      first = first || mark;
      last = idx + m.length;
    });
    frag.append(text.slice(last));
    node.replaceWith(frag);
  }
  return first;
}

// ===== Полнотекстовый поиск =====
async function buildIndex() {
  if (state.index) return state.index;
  const entries = [];
  await Promise.all(state.docs.map(async (doc) => {
    let md;
    try { md = await fetchDoc(doc.path); } catch (e) { return; }
    // режем страницу на секции по заголовкам — результат ведёт прямо к разделу
    let section = { heading: "", id: "", lines: [] };
    const sections = [section];
    let inCode = false;
    for (const line of md.split("\n")) {
      if (line.trim().startsWith("```")) inCode = !inCode;
      const h = !inCode && /^(#{1,4})\s+(.+)$/.exec(line);
      if (h) {
        section = { heading: h[2].trim(), id: h[1].length > 1 ? slugify(h[2]) : "", lines: [] };
        sections.push(section);
      } else {
        section.lines.push(line);
      }
    }
    for (const s of sections) {
      const text = stripMarkdown(s.lines.join("\n"));
      if (!text && !s.heading) continue;
      entries.push({
        doc,
        heading: s.heading,
        anchor: s.id,
        text,
        hay: normalize(`${doc.title} ${doc.crumbs.join(" ")} ${s.heading} ${text}`),
        titleN: normalize(doc.title),
        headN: normalize(s.heading),
      });
    }
  }));
  state.index = entries;
  return entries;
}

function search(query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length || !state.index) return [];
  const results = [];
  for (const e of state.index) {
    if (!terms.every(t => e.hay.includes(t))) continue;
    let score = 0;
    for (const t of terms) {
      if (e.titleN.includes(t)) score += e.titleN.startsWith(t) ? 30 : 20;
      if (e.headN.includes(t)) score += 10;
      const hits = e.hay.split(t).length - 1;
      score += Math.min(hits, 10);
    }
    if (terms.length > 1 && e.hay.includes(terms.join(" "))) score += 25; // точная фраза
    if (!e.heading) score += 2; // начало страницы
    results.push({ ...e, score });
  }
  results.sort((a, b) => b.score - a.score);
  // не больше трёх секций с одной страницы
  const perDoc = new Map();
  return results.filter(r => {
    const n = perDoc.get(r.doc.path) || 0;
    perDoc.set(r.doc.path, n + 1);
    return n < 3;
  }).slice(0, 25);
}

function snippet(text, terms) {
  const hay = normalize(text);
  let pos = -1;
  for (const t of terms) {
    pos = hay.indexOf(t);
    if (pos >= 0) break;
  }
  const start = Math.max(0, pos - 50);
  let s = (start ? "…" : "") + text.slice(start, start + 160) + (start + 160 < text.length ? "…" : "");
  s = escapeHtml(s);
  const re = new RegExp(terms.map(t => escapeRe(escapeHtml(t)).replace(/е/g, "[её]")).join("|"), "gi");
  return s.replace(re, m => `<mark>${m}</mark>`);
}

// ===== Палитра поиска =====
const palette = $("#palette");
const searchInput = $("#search");
const resultsEl = $("#search-results");
let results = [];
let selected = 0;
let usedQuery = ""; // запрос, по которому реально нашлось (с учётом раскладки)

async function openPalette(initial = "") {
  palette.hidden = false;
  searchInput.value = initial;
  searchInput.focus();
  renderResults();
  await buildIndex();
  renderResults();
}

function closePalette() {
  palette.hidden = true;
}

function renderResults() {
  const q = searchInput.value.trim();
  if (!q) {
    const recent = store.get(STORAGE_RECENT, []).map(p => state.byPath.get(p)).filter(Boolean);
    const sections = [...new Set(state.docs.map(d => d.crumbs[0]).filter(Boolean))];
    results = recent.map(doc => ({ doc, heading: "", anchor: "", text: "" }));
    resultsEl.innerHTML = (recent.length
      ? recent.map((doc, i) => resultItem({ doc }, [], i, "fa-clock-rotate-left")).join("")
      : "") +
      `<li class="palette-empty" role="presentation"><strong>${recent.length ? "Или поищи по разделам" : "Что ищем?"}</strong>
        Поиск идёт по заголовкам и тексту всех страниц.
        <div class="palette-chips">${sections.map(s => `<button type="button" data-chip="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}</div></li>`;
    selected = 0;
    highlightSelected();
    return;
  }
  if (!state.index) {
    resultsEl.innerHTML = `<li class="palette-empty"><i class="fa-solid fa-spinner fa-spin"></i> Индексирую страницы…</li>`;
    return;
  }

  let used = q;
  results = search(q);
  if (!results.length) {
    const swapped = swapLayout(normalize(q));
    const alt = search(swapped);
    if (alt.length) {
      results = alt;
      used = swapped;
    }
  }
  usedQuery = used;
  const terms = normalize(used).split(/\s+/).filter(Boolean);
  selected = 0;

  if (!results.length) {
    resultsEl.innerHTML = `<li class="palette-empty"><strong>Ничего не нашлось</strong>Попробуй другое слово или часть слова.</li>`;
    return;
  }
  const note = used !== q
    ? `<li class="palette-empty" role="presentation" style="padding:.4rem">Показаны результаты для «${escapeHtml(used)}»</li>` : "";
  resultsEl.innerHTML = note + results.map((r, i) => resultItem(r, terms, i)).join("");
  highlightSelected();
}

function resultItem(r, terms, i, icon = "fa-file-lines") {
  const path = [...r.doc.crumbs, r.doc.title].join(" / ");
  return `<li role="option" data-i="${i}">
    <div class="result-title"><i class="fa-solid ${icon}"></i>${escapeHtml(r.doc.title)}
      <span class="result-path">${escapeHtml(path)}</span></div>
    ${r.heading && r.heading !== r.doc.title ? `<div class="result-section"># ${escapeHtml(r.heading)}</div>` : ""}
    ${r.text ? `<div class="result-snippet">${snippet(r.text, terms)}</div>` : ""}
  </li>`;
}

function highlightSelected() {
  $$("li[data-i]", resultsEl).forEach(li => {
    const on = Number(li.dataset.i) === selected;
    li.classList.toggle("selected", on);
    if (on) li.scrollIntoView({ block: "nearest" });
  });
}

function choose(i) {
  const r = results[i];
  if (!r) return;
  const q = searchInput.value.trim() ? usedQuery : "";
  closePalette();
  openDoc(r.doc.path, { anchor: r.anchor, query: q });
}

searchInput.addEventListener("input", renderResults);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!results.length) return;
    selected = (selected + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
    highlightSelected();
  } else if (e.key === "Enter") {
    e.preventDefault();
    choose(selected);
  }
});
resultsEl.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-chip]");
  if (chip) {
    searchInput.value = chip.dataset.chip;
    searchInput.focus();
    renderResults();
    return;
  }
  const li = e.target.closest("li[data-i]");
  if (li) choose(Number(li.dataset.i));
});
resultsEl.addEventListener("mousemove", (e) => {
  const li = e.target.closest("li[data-i]");
  if (li && Number(li.dataset.i) !== selected) {
    selected = Number(li.dataset.i);
    highlightSelected();
  }
});
palette.addEventListener("click", (e) => {
  if (e.target === palette) closePalette();
});
$("#search-open").addEventListener("click", () => openPalette());
$("#search-open-top").addEventListener("click", () => openPalette());

document.addEventListener("keydown", (e) => {
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" || (e.ctrlKey || e.metaKey) && e.code === "KeyK") {
    e.preventDefault();
    palette.hidden ? openPalette() : closePalette();
  } else if (e.key === "/" && !typing && palette.hidden) {
    e.preventDefault();
    openPalette();
  } else if (e.key === "Escape" && !palette.hidden) {
    closePalette();
  }
});

// ===== Навигация по ссылкам =====
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.ctrlKey || e.metaKey) return;
  const href = decodeURIComponent(a.getAttribute("href").slice(1));
  if (href.startsWith("docs/")) {
    e.preventDefault();
    const [path, anchor] = href.split("#");
    openDoc(path, { anchor });
  } else if (href && a.closest("#content, #toc")) {
    e.preventDefault();
    const el = document.getElementById(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", "#" + state.current + "#" + href);
    }
  }
});

window.addEventListener("popstate", () => {
  const h = parseHash();
  if (h) openDoc(h.path, { anchor: h.anchor, push: false });
});

$("#brand").addEventListener("click", (e) => {
  e.preventDefault();
  if (state.docs[0]) openDoc(state.docs[0].path);
});

// ===== Мобильное меню =====
const menuBtn = $("#mobile-menu-toggle");
const overlay = $("#menu-overlay");
function setMobileMenu(open) {
  sidebar.classList.toggle("active", open);
  overlay.classList.toggle("active", open);
  $("i", menuBtn).className = open ? "fa-solid fa-xmark" : "fa-solid fa-bars";
  document.body.style.overflow = open ? "hidden" : "";
}
function closeMobileMenu() {
  if (sidebar.classList.contains("active")) setMobileMenu(false);
}
menuBtn.addEventListener("click", () => setMobileMenu(!sidebar.classList.contains("active")));
overlay.addEventListener("click", closeMobileMenu);
window.addEventListener("resize", () => {
  if (window.innerWidth > 900) closeMobileMenu();
});

// ===== Кнопка «наверх» =====
const toTop = $("#to-top");
window.addEventListener("scroll", () => toTop.classList.toggle("show", window.scrollY > 600), { passive: true });
toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

// ===== Старт =====
(async function init() {
  marked.use({ gfm: true, breaks: false });

  let tree = {};
  try {
    tree = await (await fetch("files.json", { cache: "no-cache" })).json();
  } catch (e) {
    content.innerHTML = `<p>Не удалось загрузить <code>files.json</code>.</p>`;
    return;
  }
  renderTree(tree, nav);
  $("#docs-count").textContent = `${state.docs.length} страниц`;

  const h = parseHash();
  const last = store.get(STORAGE_LAST, null);
  const start = h ? h.path : (state.byPath.has(last) ? last : state.docs[0] && state.docs[0].path);
  if (start) openDoc(start, { anchor: h ? h.anchor : "", push: false });
})();
