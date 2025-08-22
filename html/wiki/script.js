 // Конфигурация marked.js
        marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: function (code, lang) {
                return code;
            }
        });

        // Пароль для редактирования (замените на свой)
        const ADMIN_PASSWORD = ;

        // Данные вики
        let wikiData = {};
        let isEditMode = false;

        // DOM элементы
        const editModal = document.getElementById("edit-modal");
        const editToggle = document.getElementById("edit-toggle");
        const closeModal = document.getElementsByClassName("close")[0];
        const authSection = document.getElementById("auth-section");
        const editSection = document.getElementById("edit-section");
        const authBtn = document.getElementById("auth-btn");
        const addArticleBtn = document.getElementById("add-article-btn");
        const saveWikiBtn = document.getElementById("save-wiki-btn");
        const adminPasswordInput = document.getElementById("admin-password");
        const newArticlePathInput = document.getElementById("new-article-path");
        const newArticleContentInput = document.getElementById("new-article-content");
        const editStatus = document.getElementById("edit-status");

        // Загрузка данных
        fetch('wiki.json')
            .then(response => response.json())
            .then(data => {
                wikiData = data.wiki || {};
                buildWikiTree(wikiData, document.getElementById('wiki-tree'));
                loadDefaultArticle();
            })
            .catch(error => {
                console.error('Ошибка загрузки wiki.json:', error);
                wikiData = {};
                buildWikiTree(wikiData, document.getElementById('wiki-tree'));
                loadDefaultArticle();
            });

        // Инициализация
        document.addEventListener('DOMContentLoaded', function () {
            // Загрузка темы
            const savedTheme = localStorage.getItem('theme') || 'dark';
            document.documentElement.setAttribute('data-theme', savedTheme);
            document.getElementById('theme-toggle').textContent = savedTheme === 'dark' ? '🌙' : '☀️';

            // Обработчики
            document.getElementById('search-input').addEventListener('input', function (e) {
                searchWiki(e.target.value);
            });

            document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

            // Редактирование
            editToggle.addEventListener('click', openEditModal);
            closeModal.addEventListener('click', closeEditModal);
            authBtn.addEventListener('click', checkAuth);
            addArticleBtn.addEventListener('click', addNewArticle);
            saveWikiBtn.addEventListener('click', saveWikiData);
        });

        // Загрузка статьи по умолчанию
        function loadDefaultArticle() {
            if (wikiData['Главная'] && wikiData['Главная'].content) {
                loadArticle('Главная', wikiData['Главная'].content);
            }
        }

        // Построение дерева
        function buildWikiTree(data, parentElement, path = []) {
            parentElement.innerHTML = '';
            for (const [key, value] of Object.entries(data)) {
                const li = document.createElement('li');
                li.className = 'tree-item';

                const currentPath = [...path, key];
                const pathString = currentPath.join('/');

                if (value.children) {
                    li.classList.add('has-children');
                    li.textContent = key;
                    li.addEventListener('click', function (e) {
                        e.stopPropagation();
                        this.classList.toggle('active');
                    });

                    const childUl = document.createElement('ul');
                    childUl.className = 'tree-children';
                    li.appendChild(childUl);
                    buildWikiTree(value.children, childUl, currentPath);
                } else {
                    li.classList.add('no-children');
                    li.textContent = key;
                    li.addEventListener('click', function () {
                        loadArticle(key, value.content);
                    });
                }

                parentElement.appendChild(li);
            }
        }

        // Загрузка статьи
        function loadArticle(title, content) {
            document.getElementById('article-title').textContent = title;
            document.getElementById('article-content').innerHTML = marked.parse(content || '');
        }

        // Поиск
        function searchWiki(query) {
            const treeItems = document.querySelectorAll('.tree-item');
            const queryLower = query.toLowerCase();

            treeItems.forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(queryLower) ? 'block' : 'none';

                if (text.includes(queryLower)) {
                    let parent = item.parentElement;
                    while (parent && parent.classList.contains('tree-children')) {
                        parent.previousElementSibling.classList.add('active');
                        parent.style.display = 'block';
                        parent = parent.parentElement;
                    }
                }
            });
        }

        // Переключение темы
        function toggleTheme() {
            const html = document.documentElement;
            const isDark = html.getAttribute('data-theme') === 'dark';
            const newTheme = isDark ? 'light' : 'dark';

            html.setAttribute('data-theme', newTheme);
            document.getElementById('theme-toggle').textContent = isDark ? '☀️' : '🌙';
            localStorage.setItem('theme', newTheme);
        }

        // Редактирование
        function openEditModal() {
            editModal.style.display = "block";
            authSection.style.display = "block";
            editSection.style.display = "none";
            adminPasswordInput.value = "";
        }

        function closeEditModal() {
            editModal.style.display = "none";
        }

        function checkAuth() {
            if (adminPasswordInput.value === ADMIN_PASSWORD) {
                authSection.style.display = "none";
                editSection.style.display = "block";
                editStatus.textContent = "";
                isEditMode = true;
            } else {
                editStatus.textContent = "Неверный пароль!";
                editStatus.style.color = "red";
            }
        }

        function addNewArticle() {
            const path = newArticlePathInput.value.trim();
            const content = newArticleContentInput.value.trim();

            if (!path || !content) {
                editStatus.textContent = "Заполните все поля!";
                editStatus.style.color = "red";
                return;
            }

            const pathParts = path.split('/');
            let currentLevel = wikiData;

            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];

                if (i === pathParts.length - 1) {
                    // Последняя часть пути - сама статья
                    if (currentLevel[part]) {
                        editStatus.textContent = `Статья "${part}" уже существует!`;
                        editStatus.style.color = "red";
                        return;
                    }
                    currentLevel[part] = { content: content };
                } else {
                    // Промежуточные части - категории
                    if (!currentLevel[part]) {
                        currentLevel[part] = { children: {} };
                    } else if (!currentLevel[part].children) {
                        // Если это была статья, преобразуем в категорию
                        const existingContent = currentLevel[part].content;
                        currentLevel[part] = {
                            content: existingContent,
                            children: {}
                        };
                    }
                    currentLevel = currentLevel[part].children;
                }
            }

            editStatus.textContent = "Статья успешно добавлена!";
            editStatus.style.color = "green";
            newArticlePathInput.value = "";
            newArticleContentInput.value = "";

            // Обновляем дерево
            buildWikiTree(wikiData, document.getElementById('wiki-tree'));
        }

        function saveWikiData() {
            // В реальном приложении здесь бы был запрос к серверу
            // Для демо просто сохраняем в localStorage
            const dataToSave = {
                wiki: wikiData,
                updated: new Date().toISOString()
            };

            localStorage.setItem('wikiBackup', JSON.stringify(dataToSave));
            editStatus.textContent = "Данные сохранены в localStorage (в демо-режиме)";
            editStatus.style.color = "green";

            // В реальном приложении:
            // fetch('save_wiki.php', { method: 'POST', body: JSON.stringify(dataToSave) })
            //     .then(response => ...)
        }

        // Закрытие модального окна при клике вне его
        window.addEventListener('click', function (event) {
            if (event.target === editModal) {
                closeEditModal();
            }
        });