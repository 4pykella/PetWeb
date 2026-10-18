document.documentElement.classList.add('js');

// Тема: применяем сохранённую как можно раньше
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

document.addEventListener('DOMContentLoaded', function () {
    const themeBtn = document.getElementById('theme-toggle');
    const themeIcon = themeBtn.querySelector('i');

    function setIcon(theme) {
        themeIcon.className = theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }
    setIcon(savedTheme);

    // Переключение темы
    themeBtn.addEventListener('click', function () {
        const html = document.documentElement;
        const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        setIcon(newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // 3D-наклон карточек технологий
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
        document.querySelectorAll('.tech-card').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const angleX = (e.clientY - rect.top - rect.height / 2) / 12;
                const angleY = (rect.width / 2 - (e.clientX - rect.left)) / 12;
                card.style.transform = `perspective(500px) rotateX(${angleX}deg) rotateY(${angleY}deg) translateY(-4px)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });
    }

    // Появление карточек при скролле
    const cards = document.querySelectorAll('.card');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08 });

        cards.forEach(card => {
            card.classList.add('reveal');
            observer.observe(card);
        });
    }
});
