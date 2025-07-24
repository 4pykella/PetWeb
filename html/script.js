document.addEventListener('DOMContentLoaded', function() {
    // Проверяем сохраненную тему
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Устанавливаем правильную иконку для кнопки
    const themeBtn = document.getElementById('theme-toggle');
    themeBtn.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
    
    // Добавляем 3D-эффект для карточек технологий
    const techCards = document.querySelectorAll('.tech-card');
    
    techCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const angleX = (y - centerY) / 20;
            const angleY = (centerX - x) / 20;
            
            card.style.transform = `perspective(500px) rotateX(${angleX}deg) rotateY(${angleY}deg)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(500px) rotateX(0) rotateY(0)';
        });
    });
    
    // Анимация появления при скролле
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.card').forEach(card => {
        observer.observe(card);
    });
});

// Переключение темы
document.getElementById('theme-toggle').addEventListener('click', function() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    
    // Меняем тему
    const newTheme = isDark ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    
    // Меняем иконку кнопки
    this.textContent = isDark ? '☀️' : '🌙';
    
    // Сохраняем выбор в localStorage
    localStorage.setItem('theme', newTheme);
});