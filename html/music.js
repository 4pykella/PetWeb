// Скрытый музыкальный плеер визитки.
// Открывается: Ctrl + Alt + M или если набрать на странице слово «music» (в любой раскладке).
// Треки — файлы из /music/: nginx отдаёт список папки (autoindex json),
// запасной вариант — /music/playlist.json (node html/music/generatePlaylist.js).
(function () {
    const MUSIC_DIR = '/music/';
    const AUDIO_RE = /\.(mp3|ogg|oga|opus|m4a|aac|flac|wav|webm)$/i;
    const SECRET = 'music';

    const $ = (id) => document.getElementById(id);
    const player = $('player');
    const audio = $('player-audio');
    const listEl = $('player-list');
    const playBtn = $('player-play');
    const seek = $('player-seek');
    const volume = $('player-volume');
    const mini = $('player-mini');
    const canvas = $('player-viz');

    const store = {
        get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    };

    let tracks = [];      // [{ file, title, artist }]
    let order = [];       // порядок воспроизведения (для shuffle)
    let current = -1;     // индекс в tracks
    let loaded = false;
    let shuffle = store.get('player:shuffle', false);
    let repeat = store.get('player:repeat', 'off'); // off | all | one
    let seeking = false;

    // ===== Плейлист =====
    function parseName(file) {
        const base = decodeURIComponent(file).replace(AUDIO_RE, '').replace(/^\d+[\s._-]+/, '').replace(/_/g, ' ');
        const m = base.split(/\s+[-–—]\s+/);
        return m.length > 1 ? { artist: m[0].trim(), title: m.slice(1).join(' - ').trim() } : { artist: '', title: base.trim() };
    }

    async function loadTracks() {
        let files = [];
        try {
            // nginx autoindex_format json → [{ name, type, ... }]
            const res = await fetch(MUSIC_DIR, { headers: { Accept: 'application/json' }, cache: 'no-cache' });
            const data = await res.json();
            files = data.filter(f => f.type === 'file').map(f => f.name);
        } catch (e) {
            try {
                files = await (await fetch(MUSIC_DIR + 'playlist.json', { cache: 'no-cache' })).json();
            } catch (e2) {
                files = [];
            }
        }
        tracks = files
            .filter(f => AUDIO_RE.test(f))
            .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }))
            .map(file => ({ file, ...parseName(file) }));
        buildOrder();
        renderList();
        $('player-count').textContent = tracks.length;

        const last = store.get('player:last', null);
        const idx = tracks.findIndex(t => t.file === last);
        if (tracks.length) select(idx >= 0 ? idx : 0, false);
        loaded = true;
    }

    function buildOrder() {
        order = tracks.map((_, i) => i);
        if (shuffle) {
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
            // текущий трек — первым, чтобы перемешивание не прерывало музыку
            if (current >= 0) order = [current, ...order.filter(i => i !== current)];
        }
    }

    function renderList() {
        if (!tracks.length) {
            listEl.innerHTML = '<li class="player-empty">Папка <code>html/music/</code> пуста — положи туда mp3 / ogg / flac.</li>';
            return;
        }
        listEl.innerHTML = tracks.map((t, i) =>
            `<li data-i="${i}"><span class="num">${String(i + 1).padStart(2, '0')}</span>
               <span class="name">${escapeHtml(t.title)}${t.artist ? `<small>${escapeHtml(t.artist)}</small>` : ''}</span>
               <span class="dur" data-dur="${i}"></span></li>`).join('');
    }

    function escapeHtml(s) {
        return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function select(i, autoplay = true) {
        if (!tracks[i]) return;
        current = i;
        const t = tracks[i];
        audio.src = MUSIC_DIR + encodeURIComponent(t.file);
        $('player-title').textContent = t.title;
        $('player-artist').textContent = t.artist || 'неизвестный исполнитель';
        listEl.querySelectorAll('li').forEach(li => li.classList.toggle('active', Number(li.dataset.i) === i));
        store.set('player:last', t.file);
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist || 'chepykella.ru', album: 'PetWeb' });
        }
        if (autoplay) play();
    }

    function step(dir) {
        if (!tracks.length) return;
        const pos = order.indexOf(current);
        let next = pos + dir;
        if (next >= order.length) next = 0;
        if (next < 0) next = order.length - 1;
        select(order[next]);
    }

    // ===== Воспроизведение =====
    async function play() {
        if (!tracks.length) return;
        if (current < 0) select(order[0], false);
        initViz();
        try {
            if (vizCtx && vizCtx.state === 'suspended') await vizCtx.resume();
            await audio.play();
        } catch (e) {
            /* браузер может запретить автоплей до первого клика */
        }
    }

    function toggle() {
        audio.paused ? play() : audio.pause();
    }

    function fmt(sec) {
        if (!isFinite(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    }

    audio.addEventListener('play', syncState);
    audio.addEventListener('pause', syncState);
    audio.addEventListener('loadedmetadata', () => {
        $('player-duration').textContent = fmt(audio.duration);
        const cell = listEl.querySelector(`[data-dur="${current}"]`);
        if (cell) cell.textContent = fmt(audio.duration);
    });
    audio.addEventListener('timeupdate', () => {
        $('player-time').textContent = fmt(audio.currentTime);
        if (!seeking && audio.duration) seek.value = Math.round(audio.currentTime / audio.duration * 1000);
        seek.style.setProperty('--p', `${seek.value / 10}%`);
    });
    audio.addEventListener('ended', () => {
        if (repeat === 'one') {
            audio.currentTime = 0;
            play();
        } else if (repeat === 'all' || order.indexOf(current) < order.length - 1) {
            step(1);
        }
    });
    audio.addEventListener('error', () => {
        $('player-artist').textContent = 'не удалось воспроизвести файл';
    });

    function syncState() {
        const playing = !audio.paused;
        playBtn.innerHTML = `<i class="fa-solid fa-${playing ? 'pause' : 'play'}"></i>`;
        playBtn.setAttribute('aria-label', playing ? 'Пауза' : 'Играть');
        player.classList.toggle('playing', playing);
        mini.hidden = !(playing && player.hidden);
    }

    seek.addEventListener('input', () => {
        seeking = true;
        seek.style.setProperty('--p', `${seek.value / 10}%`);
        if (audio.duration) $('player-time').textContent = fmt(seek.value / 1000 * audio.duration);
    });
    seek.addEventListener('change', () => {
        if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration;
        seeking = false;
    });

    // ===== Громкость =====
    function setVolume(v) {
        audio.volume = Math.min(1, Math.max(0, v));
        volume.value = audio.volume;
        volume.style.setProperty('--p', `${audio.volume * 100}%`);
        audio.muted = audio.volume === 0;
        $('player-mute').innerHTML = `<i class="fa-solid fa-volume-${audio.volume === 0 ? 'xmark' : audio.volume < 0.5 ? 'low' : 'high'}"></i>`;
        store.set('player:volume', audio.volume);
    }
    let volBeforeMute = 0.7;
    volume.addEventListener('input', () => setVolume(Number(volume.value)));
    $('player-mute').addEventListener('click', () => {
        if (audio.volume > 0) {
            volBeforeMute = audio.volume;
            setVolume(0);
        } else {
            setVolume(volBeforeMute || 0.7);
        }
    });
    setVolume(store.get('player:volume', 0.7));

    // ===== Кнопки =====
    playBtn.addEventListener('click', toggle);
    $('player-next').addEventListener('click', () => step(1));
    $('player-prev').addEventListener('click', () => {
        if (audio.currentTime > 3) audio.currentTime = 0;
        else step(-1);
    });

    const shuffleBtn = $('player-shuffle');
    const repeatBtn = $('player-repeat');
    function syncModes() {
        shuffleBtn.classList.toggle('on', shuffle);
        repeatBtn.classList.toggle('on', repeat !== 'off');
        repeatBtn.classList.toggle('one', repeat === 'one');
        repeatBtn.title = { off: 'Повтор: выкл', all: 'Повтор: все', one: 'Повтор: один трек' }[repeat];
    }
    shuffleBtn.addEventListener('click', () => {
        shuffle = !shuffle;
        store.set('player:shuffle', shuffle);
        buildOrder();
        syncModes();
    });
    repeatBtn.addEventListener('click', () => {
        repeat = { off: 'all', all: 'one', one: 'off' }[repeat];
        store.set('player:repeat', repeat);
        syncModes();
    });
    syncModes();

    listEl.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-i]');
        if (!li) return;
        const i = Number(li.dataset.i);
        i === current ? toggle() : select(i);
    });

    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', play);
        navigator.mediaSession.setActionHandler('pause', () => audio.pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => step(1));
        navigator.mediaSession.setActionHandler('previoustrack', () => step(-1));
    }

    // ===== Показ / скрытие =====
    function show() {
        player.hidden = false;
        requestAnimationFrame(() => player.classList.add('open'));
        if (!loaded) loadTracks();
        syncState();
    }
    function hide() {
        player.classList.remove('open');
        player.hidden = true;
        syncState();
    }
    function togglePlayer() {
        player.hidden ? show() : hide();
    }
    $('player-close').addEventListener('click', hide);
    mini.addEventListener('click', show);

    // Секретное слово: последние нажатые буквы (раскладка не важна — смотрим e.code)
    let typed = '';
    document.addEventListener('keydown', (e) => {
        const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

        if (e.ctrlKey && e.altKey && e.code === 'KeyM') {
            e.preventDefault();
            togglePlayer();
            return;
        }

        if (!inField && !e.ctrlKey && !e.altKey && !e.metaKey && /^Key[A-Z]$/.test(e.code)) {
            typed = (typed + e.code.slice(3).toLowerCase()).slice(-SECRET.length);
            if (typed === SECRET) {
                typed = '';
                togglePlayer();
                return;
            }
        }

        if (player.hidden || inField) return;
        // пробел на кнопке плеера — пусть сработает сама кнопка, без двойного переключения
        if (e.code === 'Space' && e.target.closest('button')) return;
        if (e.code === 'Escape') hide();
        else if (e.code === 'Space') { e.preventDefault(); toggle(); }
        else if (e.code === 'ArrowRight' && audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
        else if (e.code === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
        else if (e.code === 'KeyN') step(1);
        else if (e.code === 'KeyP') step(-1);
    });

    // ===== Визуализатор (Web Audio) =====
    let vizCtx = null;
    let analyser = null;
    function initViz() {
        if (vizCtx || !window.AudioContext) return;
        try {
            vizCtx = new AudioContext();
            const src = vizCtx.createMediaElementSource(audio);
            analyser = vizCtx.createAnalyser();
            analyser.fftSize = 128;
            src.connect(analyser);
            analyser.connect(vizCtx.destination);
            draw();
        } catch (e) {
            vizCtx = null;
        }
    }

    function draw() {
        requestAnimationFrame(draw);
        if (player.hidden) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth * dpr;
        const h = canvas.clientHeight * dpr;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        ctx.clearRect(0, 0, w, h);
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);

        const styles = getComputedStyle(document.documentElement);
        const neon = styles.getPropertyValue('--neon').trim() || '#3ae0a6';
        const accent = styles.getPropertyValue('--accent').trim() || '#259c71';
        const bars = 40;
        const gap = 3 * dpr;
        const bw = (w - gap * (bars - 1)) / bars;
        const grad = ctx.createLinearGradient(0, h, 0, 0);
        grad.addColorStop(0, accent);
        grad.addColorStop(1, neon);
        ctx.fillStyle = grad;
        for (let i = 0; i < bars; i++) {
            const v = data[Math.floor(i * data.length / bars)] / 255;
            const bh = Math.max(2 * dpr, v * h);
            const x = i * (bw + gap);
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, h - bh, bw, bh, 2 * dpr);
            else ctx.rect(x, h - bh, bw, bh);
            ctx.fill();
        }
    }
})();
