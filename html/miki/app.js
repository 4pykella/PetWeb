document.addEventListener("DOMContentLoaded", async () => {
  const nav = document.getElementById("nav");
  const content = document.getElementById("content");
  const searchInput = document.getElementById("search");
  const themeBtn = document.getElementById("theme-toggle");

  // ==== Смена темы ====
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeBtn.textContent = savedTheme === "dark" ? "🌙" : "☀️";
  themeBtn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const newTheme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    themeBtn.textContent = isDark ? "☀️" : "🌙";
    localStorage.setItem("theme", newTheme);
  });

  // ==== Рендеринг дерева ====
  function renderNav(tree, parent) {
    for (let key in tree) {
      const li = document.createElement("li");
      li.classList.add("tree-item");

      if (typeof tree[key] === "string") {
        const a = document.createElement("a");
        a.href = "#";
        a.textContent = key;
        a.dataset.path = tree[key];
        a.onclick = (e) => {
          e.preventDefault();
          loadFile(tree[key]);

          // Подсветка выбранного файла
          nav.querySelectorAll("a.active").forEach(el => el.classList.remove("active"));
          a.classList.add("active");
        };
        li.appendChild(a);
      } else {
        const folderSpan = document.createElement("span");
        folderSpan.textContent = key;
        folderSpan.classList.add("folder");
        folderSpan.onclick = () => {
          const ul = folderSpan.nextElementSibling;
          ul.classList.toggle("open");
          folderSpan.classList.toggle("open");
        };
        li.appendChild(folderSpan);

        const ul = document.createElement("ul");
        ul.classList.add("nested");
        renderNav(tree[key], ul);
        li.appendChild(ul);
      }
      parent.appendChild(li);
    }
  }

  // ==== Загрузка Markdown ====
  async function loadFile(path) {
    try {
      const res = await fetch(path);
      const text = await res.text();
      content.innerHTML = marked.parse(text);
      // id для заголовков — работают ссылки-оглавления вида [Шаг 1](#шаг-1-теория)
      content.querySelectorAll("h1, h2, h3, h4").forEach(h => {
        h.id = h.textContent.toLowerCase().trim()
          .replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");
      });
      if (window.hljs) content.querySelectorAll("pre code").forEach(b => hljs.highlightElement(b));
      // внешние ссылки — в новой вкладке
      content.querySelectorAll('a[href^="http"]').forEach(a => {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      });
      if (location.hash !== "#" + path) history.replaceState(null, "", "#" + path);
      content.scrollIntoView({ block: "start" });
    } catch (err) {
      content.innerHTML = `<p style="color:red">Ошибка загрузки: ${path}</p>`;
    }
  }

  // ==== Загрузка дерева файлов ====
  const res = await fetch("files.json");
  const files = await res.json();
  renderNav(files, nav);

  // ==== Авто-открытие первой папки и первого файла ====
  const firstFolder = nav.querySelector(".folder");
  if (firstFolder) {
    const ul = firstFolder.nextElementSibling;
    ul.classList.add("open");
    firstFolder.classList.add("open");
  }
  // ==== Открытие файла по пути (ссылки вида #docs/папка/файл.md) ====
  function openPath(path) {
    const link = [...nav.querySelectorAll("a[data-path]")].find(a => a.dataset.path === path);
    nav.querySelectorAll("a.active").forEach(el => el.classList.remove("active"));
    if (link) {
      link.classList.add("active");
      let parent = link.parentElement;
      while (parent && parent.id !== "nav") {
        if (parent.classList.contains("nested")) {
          parent.classList.add("open");
          if (parent.previousElementSibling) parent.previousElementSibling.classList.add("open");
        }
        parent = parent.parentElement;
      }
    }
    loadFile(path);
  }

  content.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    const target = decodeURIComponent(a.getAttribute("href").slice(1));
    if (target.startsWith("docs/")) {
      openPath(target);
    } else {
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  window.addEventListener("hashchange", () => {
    const path = decodeURIComponent(location.hash.slice(1));
    if (path.startsWith("docs/")) openPath(path);
  });

  const initialPath = decodeURIComponent(location.hash.slice(1));
  const firstFile = nav.querySelector(".tree-item a");
  if (initialPath.startsWith("docs/")) {
    openPath(initialPath);
  } else if (firstFile) {
    firstFile.classList.add("active");
    loadFile(firstFile.dataset.path);
  }

  // ==== Поиск по дереву ====
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const allItems = nav.querySelectorAll(".tree-item, .folder, .nested");
    allItems.forEach(i => i.classList.remove("hidden"));

    if (!query) return;

    const items = nav.querySelectorAll(".tree-item, .folder");
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      if (!text.includes(query)) {
        item.classList.add("hidden");
      } else {
        let parent = item.parentElement;
        while (parent && parent.id !== "nav") {
          if (parent.classList.contains("nested")) parent.classList.add("open");
          if (parent.previousSibling && parent.previousSibling.classList.contains("folder"))
            parent.previousSibling.classList.remove("hidden");
          parent = parent.parentElement;
        }
      }
    });
  });
});

const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const sidebar = document.querySelector('.sidebar');
const menuOverlay = document.getElementById('menu-overlay');

if (mobileMenuToggle && sidebar && menuOverlay) {
    function toggleMenu() {
        sidebar.classList.toggle('active');
        menuOverlay.classList.toggle('active');
        
        // Меняем иконку
        if (sidebar.classList.contains('active')) {
            mobileMenuToggle.innerHTML = '✕';
            document.body.style.overflow = 'hidden'; // Блокируем прокрутку фона
        } else {
            mobileMenuToggle.innerHTML = '☰';
            document.body.style.overflow = ''; // Восстанавливаем прокрутку
        }
    }
    
    mobileMenuToggle.addEventListener('click', toggleMenu);
    
    // Закрываем меню при клике на overlay
    menuOverlay.addEventListener('click', toggleMenu);
    
    // Закрываем меню при клике на ссылку в сайдбаре
    const sidebarLinks = sidebar.querySelectorAll('a');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 900) {
                toggleMenu();
            }
        });
    });
    
    // Закрываем меню при изменении размера окна
    window.addEventListener('resize', function() {
        if (window.innerWidth > 900) {
            sidebar.classList.remove('active');
            menuOverlay.classList.remove('active');
            mobileMenuToggle.innerHTML = '☰';
            document.body.style.overflow = '';
        }
    });
}