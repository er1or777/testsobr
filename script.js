/* ============================================================
   РОСГВАРДИЯ СОБР — Система тестирования
   Работает в связке с Google Apps Script (Code.gs).
   При отсутствии бэкенда работает на localStorage (демо-режим).
   ============================================================ */

/* --- КОНФИГУРАЦИЯ --- */
// Укажите URL развёрнутого Google Apps Script Web App,
// чтобы данные сохранялись на сервере и были видны всем пользователям.
// Оставьте пустым для демо-режима (данные только в вашем браузере).
const API_URL = '';

// Учётные данные главного администратора
const ADMIN_LOGIN = 'ADMIN';
const ADMIN_PASSWORD = 'krutoipocek';

const STORAGE = {
    tests: 'sobr_tests',
    results: 'sobr_results',
    curators: 'sobr_curators',
    session: 'sobr_session'
};

/* --- СОСТОЯНИЕ --- */
let state = {
    tests: [],
    results: [],
    curators: [],
    session: null,
    currentTest: null,
    currentAnswers: [],
    currentQuestion: 0,
    userFio: '',
    userId: ''
};

/* ============================================================
   СЛОЙ ДАННЫХ (API / localStorage)
   ============================================================ */
async function apiGet(action) {
    if (API_URL) {
        try {
            const res = await fetch(`${API_URL}?action=${action}`);
            return await res.json();
        } catch (e) { console.warn('API error, fallback', e); }
    }
    return null;
}

async function apiPost(action, payload) {
    if (API_URL) {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action, payload })
            });
            return await res.json();
        } catch (e) { console.warn('API error, fallback', e); }
    }
    return null;
}

function loadLocal() {
    state.tests = JSON.parse(localStorage.getItem(STORAGE.tests) || '[]');
    state.results = JSON.parse(localStorage.getItem(STORAGE.results) || '[]');
    state.curators = JSON.parse(localStorage.getItem(STORAGE.curators) || '[]');
    state.session = JSON.parse(localStorage.getItem(STORAGE.session) || 'null');
}
function saveLocal() {
    localStorage.setItem(STORAGE.tests, JSON.stringify(state.tests));
    localStorage.setItem(STORAGE.results, JSON.stringify(state.results));
    localStorage.setItem(STORAGE.curators, JSON.stringify(state.curators));
    localStorage.setItem(STORAGE.session, JSON.stringify(state.session));
}

async function fetchTests() {
    const remote = await apiGet('getTests');
    if (remote && Array.isArray(remote)) { state.tests = remote; return; }
    loadLocal();
}
async function fetchResults() {
    const remote = await apiGet('getResults');
    if (remote && Array.isArray(remote)) { state.results = remote; return; }
    loadLocal();
}
async function fetchCurators() {
    const remote = await apiGet('getCurators');
    if (remote && Array.isArray(remote)) { state.curators = remote; return; }
    loadLocal();
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    initScrollProgress();
    initHeader();
    initMobileMenu();
    initScrollSpy();
    initSmoothScroll();
    initBrandHome();
    initAdminLogin();
    initAdminTabs();
    initTestBuilder();
    initCurators();
    initResultsSearch();
    initQuiz();
    initModal();

    await refreshAll();

    // Восстанавливаем сессию при перезагрузке страницы
    if (state.session && state.session.role) {
        showAdminPanel();
    }
});

async function refreshAll() {
    await fetchTests();
    await fetchResults();
    await fetchCurators();
    renderTests();
    renderAdminTests();
    renderAdminResults();
    renderCurators();
    updateStats();
}

/* ============================================================
   SCROLL PROGRESS
   ============================================================ */
function initScrollProgress() {
    const bar = document.querySelector('.scroll-progress');
    window.addEventListener('scroll', () => {
        const h = document.body.scrollHeight - window.innerHeight;
        const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
        bar.style.width = pct + '%';
    });
}

/* ============================================================
   HEADER / MOBILE / SCROLLSPY / SMOOTH
   ============================================================ */
function initHeader() {
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 40) header.classList.add('compact');
        else header.classList.remove('compact');
    });
}

function initMobileMenu() {
    const burger = document.getElementById('burger');
    const nav = document.getElementById('navMenu');
    burger.addEventListener('click', () => {
        burger.classList.toggle('active');
        nav.classList.toggle('open');
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        burger.classList.remove('active');
        nav.classList.remove('open');
    }));
}

function initScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-menu a[data-nav]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(l => l.classList.remove('active'));
                const active = document.querySelector(`.nav-menu a[data-nav="${entry.target.id}"]`);
                if (active) active.classList.add('active');
            }
        });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(s => observer.observe(s));
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', (e) => {
            const id = a.getAttribute('href');
            if (id === '#' || id.length < 2) return;
            const target = document.querySelector(id);
            if (target) {
                e.preventDefault();
                const offset = 80;
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
}

function initBrandHome() {
    const brand = document.getElementById('brandHome');
    brand.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/* ============================================================
   СТАТИСТИКА / COUNTERS
   ============================================================ */
function updateStats() {
    const nums = document.querySelectorAll('.stat-number');
    if (nums[0]) nums[0].dataset.target = state.tests.length;
    if (nums[2]) nums[2].dataset.target = state.results.length;
    nums.forEach(el => {
        if (el.dataset.animated !== '1') {
            el.dataset.animated = '1';
            animateCounter(el);
        } else {
            el.textContent = el.dataset.target + (el.dataset.suffix || '');
        }
    });
}

function animateCounter(el) {
    const target = parseFloat(el.dataset.target) || 0;
    const suffix = el.dataset.suffix || '';
    const duration = 1500;
    const start = performance.now();
    const update = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const val = target < 10 ? (ease * target).toFixed(0) : Math.round(ease * target);
        el.textContent = val + suffix;
        if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
}

/* ============================================================
   РЕНДЕР ТЕСТОВ (главный экран)
   ============================================================ */
function renderTests() {
    const grid = document.getElementById('testsGrid');
    grid.innerHTML = '';
    if (!state.tests.length) {
        grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Тесты пока не добавлены. Ожидайте публикации администратором.</p></div>`;
        return;
    }
    state.tests.forEach(t => {
        const card = document.createElement('div');
        card.className = 'test-card reveal';
        card.innerHTML = `
            <h3>${escapeHtml(t.title)}</h3>
            <p>${escapeHtml(t.description || 'Без описания')}</p>
            <span class="test-meta">Вопросов: ${t.questions.length} · Порог: 80%</span>
            <button class="btn-primary" data-id="${t.id}">Пройти тест</button>
        `;
        card.querySelector('button').addEventListener('click', () => openTest(t.id));
        grid.appendChild(card);
    });
    observeReveal();
}

/* ============================================================
   МОДАЛЬНОЕ ОКНО ТЕСТА
   ============================================================ */
function initModal() {
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('closeResultBtn').addEventListener('click', closeModal);
    document.getElementById('testModal').addEventListener('click', (e) => {
        if (e.target.id === 'testModal') closeModal();
    });
}

function openTest(id) {
    const test = state.tests.find(t => t.id === id);
    if (!test) return;
    state.currentTest = test;
    state.currentAnswers = new Array(test.questions.length).fill(null);
    state.currentQuestion = 0;

    document.getElementById('modalTestTitle').textContent = test.title;
    document.getElementById('modalTestDesc').textContent = test.description || '';
    document.getElementById('userFio').value = '';
    document.getElementById('userId').value = '';
    document.getElementById('startError').textContent = '';

    showStep('stepStart');
    document.getElementById('testModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('testModal').classList.add('hidden');
    state.currentTest = null;
}

function showStep(stepId) {
    ['stepStart', 'stepQuiz', 'stepResult'].forEach(s => {
        document.getElementById(s).classList.toggle('hidden', s !== stepId);
    });
}

function initQuiz() {
    document.getElementById('startTestBtn').addEventListener('click', startTest);
    document.getElementById('prevQBtn').addEventListener('click', () => navigateQuestion(-1));
    document.getElementById('nextQBtn').addEventListener('click', () => navigateQuestion(1));
}

function startTest() {
    const fio = document.getElementById('userFio').value.trim();
    const uid = document.getElementById('userId').value.trim();
    const err = document.getElementById('startError');
    if (!fio) { err.textContent = 'Введите ФИО'; return; }
    if (!uid) { err.textContent = 'Введите ID сотрудника'; return; }
    state.userFio = fio;
    state.userId = uid;
    state.currentQuestion = 0;
    err.textContent = '';
    showStep('stepQuiz');
    renderQuestion();
}

function renderQuestion() {
    const test = state.currentTest;
    const q = test.questions[state.currentQuestion];
    const total = test.questions.length;

    document.getElementById('quizProgressText').textContent =
        `Вопрос ${state.currentQuestion + 1} из ${total}`;
    const pct = ((state.currentQuestion) / total) * 100;
    document.getElementById('quizProgressFill').style.width = pct + '%';

    document.getElementById('questionText').textContent = q.text;

    const list = document.getElementById('optionsList');
    list.innerHTML = '';
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        if (state.currentAnswers[state.currentQuestion] === i) btn.classList.add('selected');
        btn.textContent = opt;
        btn.addEventListener('click', () => {
            state.currentAnswers[state.currentQuestion] = i;
            renderQuestion();
        });
        list.appendChild(btn);
    });

    document.getElementById('prevQBtn').style.visibility = state.currentQuestion === 0 ? 'hidden' : 'visible';
    const nextBtn = document.getElementById('nextQBtn');
    nextBtn.textContent = state.currentQuestion === total - 1 ? 'Завершить' : 'Далее';
}

function navigateQuestion(dir) {
    const total = state.currentTest.questions.length;
    if (dir === 1 && state.currentQuestion === total - 1) {
        finishTest();
        return;
    }
    state.currentQuestion = Math.max(0, Math.min(total - 1, state.currentQuestion + dir));
    renderQuestion();
}

async function finishTest() {
    const test = state.currentTest;
    let correct = 0;
    test.questions.forEach((q, i) => {
        if (state.currentAnswers[i] === q.correct) correct++;
    });
    const total = test.questions.length;
    const percent = Math.round((correct / total) * 100);
    const passed = percent >= 80;

    const result = {
        id: Date.now().toString(),
        testId: test.id,
        testTitle: test.title,
        fio: state.userFio,
        userId: state.userId,
        correct,
        total,
        percent,
        passed,
        date: new Date().toISOString()
    };

    // Сохранение
    const remote = await apiPost('saveResult', result);
    state.results.push(result);
    if (!remote) saveLocal();

    showResult(result);
    updateStats();
    renderAdminResults();
}

function showResult(result) {
    showStep('stepResult');
    const badge = document.getElementById('resultBadge');
    const title = document.getElementById('resultTitle');
    const score = document.getElementById('resultScore');
    const detail = document.getElementById('resultDetail');

    badge.className = 'result-badge ' + (result.passed ? 'pass' : 'fail');
    badge.textContent = result.passed ? '✓' : '✕';

    title.className = 'result-title ' + (result.passed ? 'pass' : 'fail');
    title.textContent = result.passed ? 'Вы сдали тест' : 'Вы провалили тест';

    score.textContent = `${result.correct} из ${result.total} верно · ${result.percent}%`;

    detail.innerHTML = `Сотрудник: <strong>${escapeHtml(result.fio)}</strong> · ID: ${escapeHtml(result.userId)}<br>Тест: ${escapeHtml(result.testTitle)}<br>Порог сдачи: 80%`;
}

/* ============================================================
   РЕЗУЛЬТАТЫ (публичный поиск по ID)
   ============================================================ */
function initResultsSearch() {
    document.getElementById('resultsSearchBtn').addEventListener('click', searchResults);
    document.getElementById('resultsIdInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchResults();
    });
}

async function searchResults() {
    const uid = document.getElementById('resultsIdInput').value.trim();
    const list = document.getElementById('resultsList');
    list.innerHTML = '';
    if (!uid) { list.innerHTML = '<p class="empty-state">Введите ID</p>'; return; }

    await fetchResults();
    const found = state.results.filter(r => r.userId === uid);
    if (!found.length) {
        list.innerHTML = '<p class="empty-state">Результаты для этого ID не найдены.</p>';
        return;
    }
    found.sort((a, b) => new Date(b.date) - new Date(a.date));
    found.forEach(r => {
        const row = document.createElement('div');
        row.className = 'result-row ' + (r.passed ? 'pass' : 'fail');
        row.innerHTML = `
            <div>
                <div class="rr-title">${escapeHtml(r.testTitle)}</div>
                <div class="rr-meta">${formatDate(r.date)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
                <span class="rr-score">${r.correct}/${r.total} · ${r.percent}%</span>
                <span class="rr-status ${r.passed ? 'pass' : 'fail'}">${r.passed ? 'СДАНО' : 'ПРОВАЛ'}</span>
            </div>
        `;
        list.appendChild(row);
    });
}

/* ============================================================
   АДМИН: ВХОД
   ============================================================ */
function initAdminLogin() {
    document.getElementById('adminLoginBtn').addEventListener('click', adminLogin);
    document.getElementById('logoutBtn').addEventListener('click', adminLogout);
}

async function adminLogin() {
    const login = document.getElementById('adminLoginInput').value.trim();
    const pass = document.getElementById('adminPassInput').value.trim();
    const hint = document.getElementById('loginHint');

    if (!login || !pass) { hint.textContent = 'Введите логин и пароль'; return; }

    // Проверка главного администратора (ADMIN / krutoipocek)
    // В боевом режиме — через Google Apps Script.
    let role = null;
    if (login === ADMIN_LOGIN && pass === ADMIN_PASSWORD) {
        role = 'admin';
    } else {
        await fetchCurators();
        const curator = state.curators.find(c => c.login === login && c.password === pass);
        if (curator) role = 'curator';
    }

    if (!role) { hint.textContent = 'Неверный логин или пароль'; return; }

    state.session = { login, role };
    saveLocal();
    hint.textContent = '';
    showAdminPanel();
}

function adminLogout() {
    state.session = null;
    saveLocal();
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('adminLogin').classList.remove('hidden');
    document.getElementById('adminLoginInput').value = '';
    document.getElementById('adminPassInput').value = '';
    document.getElementById('adminNavLink').classList.remove('hidden');
}

function showAdminPanel() {
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    const isAdmin = state.session && state.session.role === 'admin';
    // Только админ назначает кураторов
    document.querySelector('.admin-tab[data-tab="tabCurators"]').style.display = isAdmin ? '' : 'none';
    renderAdminTests();
    renderAdminResults();
    renderCurators();
}

function initAdminTabs() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

/* ============================================================
   АДМИН: КОНСТРУКТОР ТЕСТОВ
   ============================================================ */
function initTestBuilder() {
    document.getElementById('addTestBtn').addEventListener('click', () => {
        document.getElementById('testForm').classList.remove('hidden');
        document.getElementById('testTitle').value = '';
        document.getElementById('testDesc').value = '';
        document.getElementById('questionsWrap').innerHTML = '';
        addQuestionBlock();
    });
    document.getElementById('cancelTestBtn').addEventListener('click', () => {
        document.getElementById('testForm').classList.add('hidden');
    });
    document.getElementById('addQuestionBtn').addEventListener('click', addQuestionBlock);
    document.getElementById('saveTestBtn').addEventListener('click', saveTest);
}

function addQuestionBlock() {
    const wrap = document.getElementById('questionsWrap');
    const idx = wrap.children.length + 1;
    const block = document.createElement('div');
    block.className = 'question-block';
    block.innerHTML = `
        <div class="q-head">
            <span class="q-num">Вопрос ${idx}</span>
            <button class="q-remove" type="button" title="Удалить">×</button>
        </div>
        <div class="form-row">
            <input type="text" class="q-text" placeholder="Текст вопроса">
        </div>
        <div class="q-options"></div>
        <button class="btn-secondary add-option" type="button" style="margin-top:8px">+ Вариант</button>
    `;
    wrap.appendChild(block);
    block.querySelector('.q-remove').addEventListener('click', () => {
        block.remove();
        renumberQuestions();
    });
    block.querySelector('.add-option').addEventListener('click', () => addOption(block));
    // два варианта по умолчанию
    addOption(block);
    addOption(block);
}

function addOption(block) {
    const opts = block.querySelector('.q-options');
    const row = document.createElement('div');
    row.className = 'option-row';
    row.innerHTML = `
        <input type="radio" name="correct_${Date.now()}_${Math.random()}" title="Верный ответ">
        <input type="text" class="opt-text" placeholder="Вариант ответа">
        <button class="q-remove" type="button" title="Удалить вариант">×</button>
    `;
    row.querySelector('.q-remove').addEventListener('click', () => row.remove());
    opts.appendChild(row);
}

function renumberQuestions() {
    document.querySelectorAll('#questionsWrap .question-block').forEach((b, i) => {
        b.querySelector('.q-num').textContent = 'Вопрос ' + (i + 1);
    });
}

async function saveTest() {
    const title = document.getElementById('testTitle').value.trim();
    const desc = document.getElementById('testDesc').value.trim();
    if (!title) { alert('Введите название теста'); return; }

    const blocks = document.querySelectorAll('#questionsWrap .question-block');
    const questions = [];
    let valid = true;

    blocks.forEach(block => {
        const text = block.querySelector('.q-text').value.trim();
        const optRows = block.querySelectorAll('.option-row');
        const options = [];
        let correct = -1;
        optRows.forEach((row, i) => {
            const val = row.querySelector('.opt-text').value.trim();
            if (val) options.push(val);
            if (row.querySelector('input[type="radio"]').checked) correct = options.length - 1;
        });
        if (!text || options.length < 2 || correct < 0) { valid = false; return; }
        questions.push({ text, options, correct });
    });

    if (!valid || !questions.length) {
        alert('Заполните все вопросы, добавьте минимум 2 варианта и отметьте верный ответ');
        return;
    }

    const test = {
        id: Date.now().toString(),
        title,
        description: desc,
        questions,
        author: state.session.login,
        createdAt: new Date().toISOString()
    };

    const remote = await apiPost('saveTest', test);
    state.tests.push(test);
    if (!remote) saveLocal();

    document.getElementById('testForm').classList.add('hidden');
    renderTests();
    renderAdminTests();
    updateStats();
}

/* ============================================================
   АДМИН: СПИСОК ТЕСТОВ
   ============================================================ */
function renderAdminTests() {
    const list = document.getElementById('adminTestsList');
    if (!list) return;
    list.innerHTML = '';
    if (!state.tests.length) {
        list.innerHTML = '<p class="empty-state">Тестов пока нет.</p>';
        return;
    }
    state.tests.forEach(t => {
        const item = document.createElement('div');
        item.className = 'admin-item';
        item.innerHTML = `
            <div>
                <div class="ai-title">${escapeHtml(t.title)}</div>
                <div class="ai-meta">Вопросов: ${t.questions.length} · Автор: ${escapeHtml(t.author || '—')}</div>
            </div>
            <div class="ai-actions">
                <button class="btn-del" data-id="${t.id}">Удалить</button>
            </div>
        `;
        item.querySelector('.btn-del').addEventListener('click', () => deleteTest(t.id));
        list.appendChild(item);
    });
}

async function deleteTest(id) {
    if (!confirm('Удалить этот тест?')) return;
    const remote = await apiPost('deleteTest', { id });
    state.tests = state.tests.filter(t => t.id !== id);
    if (!remote) saveLocal();
    renderTests();
    renderAdminTests();
    updateStats();
}

/* ============================================================
   АДМИН: РЕЗУЛЬТАТЫ
   ============================================================ */
function renderAdminResults() {
    const list = document.getElementById('adminResultsList');
    if (!list) return;
    list.innerHTML = '';
    if (!state.results.length) {
        list.innerHTML = '<p class="empty-state">Результатов пока нет.</p>';
        return;
    }
    const sorted = [...state.results].sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(r => {
        const item = document.createElement('div');
        item.className = 'admin-item';
        item.innerHTML = `
            <div>
                <div class="ai-title">${escapeHtml(r.fio)} · ID ${escapeHtml(r.userId)}</div>
                <div class="ai-meta">${escapeHtml(r.testTitle)} · ${formatDate(r.date)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
                <span class="rr-score">${r.correct}/${r.total} · ${r.percent}%</span>
                <span class="rr-status ${r.passed ? 'pass' : 'fail'}">${r.passed ? 'СДАНО' : 'ПРОВАЛ'}</span>
            </div>
        `;
        list.appendChild(item);
    });
}

/* ============================================================
   АДМИН: КУРАТОРЫ
   ============================================================ */
function initCurators() {
    document.getElementById('addCuratorBtn').addEventListener('click', addCurator);
}

async function addCurator() {
    const login = document.getElementById('curatorLogin').value.trim();
    const pass = document.getElementById('curatorPass').value.trim();
    if (!login || !pass) { alert('Введите логин и пароль'); return; }
    if (login === ADMIN_LOGIN) { alert('Этот логин занят'); return; }
    if (state.curators.some(c => c.login === login)) { alert('Куратор с таким логином уже существует'); return; }

    const curator = { id: Date.now().toString(), login, password: pass };
    const remote = await apiPost('saveCurator', curator);
    state.curators.push(curator);
    if (!remote) saveLocal();
    document.getElementById('curatorLogin').value = '';
    document.getElementById('curatorPass').value = '';
    renderCurators();
}

function renderCurators() {
    const list = document.getElementById('curatorsList');
    if (!list) return;
    list.innerHTML = '';
    if (!state.curators.length) {
        list.innerHTML = '<p class="empty-state">Кураторов пока нет.</p>';
        return;
    }
    state.curators.forEach(c => {
        const item = document.createElement('div');
        item.className = 'admin-item';
        item.innerHTML = `
            <div>
                <div class="ai-title">${escapeHtml(c.login)}</div>
                <div class="ai-meta">Роль: куратор</div>
            </div>
            <div class="ai-actions">
                <button class="btn-del" data-id="${c.id}">Удалить</button>
            </div>
        `;
        item.querySelector('.btn-del').addEventListener('click', () => deleteCurator(c.id));
        list.appendChild(item);
    });
}

async function deleteCurator(id) {
    if (!confirm('Удалить куратора?')) return;
    const remote = await apiPost('deleteCurator', { id });
    state.curators = state.curators.filter(c => c.id !== id);
    if (!remote) saveLocal();
    renderCurators();
}

/* ============================================================
   УТИЛИТЫ
   ============================================================ */
function observeReveal() {
    const els = document.querySelectorAll('.reveal:not(.visible)');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                observer.unobserve(e.target);
            }
        });
    }, { threshold: 0.12 });
    els.forEach(el => observer.observe(el));
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}