const fs = require("fs");
const path = require("path");

const DOCS_DIR = path.join(__dirname, "docs");
const OUTPUT_FILE = path.join(__dirname, "files.json");

// Рекурсивная функция обхода папки
function walk(dir) {
  const tree = {};
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    if (item.isDirectory()) {
      tree[item.name] = walk(path.join(dir, item.name));
    } else if (item.isFile() && item.name.endsWith(".md")) {
      const name = item.name.replace(".md", "");
      tree[name] = path.relative(__dirname, path.join(dir, item.name)).replace(/\\/g, "/");
    }
  }
  return tree;
}

// Генерация дерева
const fileTree = walk(DOCS_DIR);
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(fileTree, null, 2), "utf-8");
console.log("✅ files.json создан!");
