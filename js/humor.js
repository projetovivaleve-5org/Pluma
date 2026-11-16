/**
 * PLUMA - Registro de Humor
 * Salva no back-end (precisa de login):
 *  - /v1/mood-logs: emoção da tela (OTIMO..ANSIOSO) + atividades + nota. Limite: 3 por dia.
 *    Alimenta o Histórico, as estatísticas e a IA.
 */

const api = window.VivaLeveAPI;

let selectedEmotion = null;
let selectedActivities = [];
let salvando = false;

document.addEventListener('DOMContentLoaded', function() {
    if (!api.exigirLogin()) return;
    initHumorPage();
});

function initHumorPage() {
    setCurrentDate();
    setupEmotionsGrid();
    setupActivities();
    setupCharCounter();
    setupSaveButton();
    loadQuickHistory();
}

// ============================================
// DATA ATUAL
// ============================================

function setCurrentDate() {
    const dateElement = document.querySelector('#currentDate span');
    if (dateElement) {
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        const today = new Date().toLocaleDateString('pt-BR', options);
        dateElement.textContent = today.charAt(0).toUpperCase() + today.slice(1);
    }
}

// ============================================
// GRID DE EMOÇÕES
// ============================================

function setupEmotionsGrid() {
    const emotionsGrid = document.getElementById('emotionsGrid');
    if (!emotionsGrid) return;

    emotionsGrid.querySelectorAll('.emotion-card').forEach(card => {
        card.addEventListener('click', function() {
            selectEmotion(this);
        });
        card.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectEmotion(this);
            }
        });
    });
}

function selectEmotion(card) {
    document.querySelectorAll('.emotion-card').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
    });

    card.classList.add('selected');
    card.setAttribute('aria-pressed', 'true');
    selectedEmotion = card.dataset.emotion;
    updateSaveButton();

    card.style.transform = 'scale(1.05)';
    setTimeout(() => {
        card.style.transform = '';
    }, 200);
}

// ============================================
// ATIVIDADES
// ============================================

function setupActivities() {
    const activitiesGrid = document.getElementById('activitiesGrid');
    if (!activitiesGrid) return;

    activitiesGrid.querySelectorAll('.activity-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            toggleActivity(this);
        });
    });
}

function toggleActivity(tag) {
    const activity = tag.dataset.activity;

    if (tag.classList.contains('selected')) {
        tag.classList.remove('selected');
        selectedActivities = selectedActivities.filter(a => a !== activity);
    } else {
        tag.classList.add('selected');
        selectedActivities.push(activity);
    }
}

// ============================================
// CONTADOR DE CARACTERES
// ============================================

function setupCharCounter() {
    const noteTextarea = document.getElementById('moodNote');
    const charCount = document.getElementById('noteCharCount');
    if (!noteTextarea || !charCount) return;

    noteTextarea.addEventListener('input', function() {
        charCount.textContent = this.value.length;
    });
}

// ============================================
// SALVAR
// ============================================

function setupSaveButton() {
    document.getElementById('saveBtn').addEventListener('click', saveMoodRecord);
}

function updateSaveButton() {
    document.getElementById('saveBtn').disabled = !selectedEmotion || salvando;
}

function setSalvando(ativo) {
    salvando = ativo;
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.innerHTML = ativo
        ? '<i class="fas fa-spinner fa-spin"></i> Salvando...'
        : '<i class="fas fa-save"></i> Salvar Registro';
    updateSaveButton();
}

async function saveMoodRecord() {
    if (!selectedEmotion || salvando) return;

    const note = document.getElementById('moodNote').value.trim();
    setSalvando(true);

    try {
        const atividades = selectedActivities
            .map(a => api.ATIVIDADE_PARA_API[a])
            .filter(Boolean);
        // Se falhar (ex.: limite de 3 por dia), nada é salvo.
        await api.humor.criar(api.emocao.paraApi(selectedEmotion), note || null, atividades);

        showSaveConfirmation();
    } catch (e) {
        if (api.tratarSemLogin(e)) return;
        alert(api.mensagemErro(e, 'Erro ao salvar. Tente novamente.'));
    } finally {
        setSalvando(false);
    }
}

function showSaveConfirmation() {
    document.querySelector('.humor-question').style.display = 'none';
    document.getElementById('emotionsGrid').style.display = 'none';
    document.querySelectorAll('.card').forEach(c => c.style.display = 'none');
    document.querySelector('.save-section').style.display = 'none';

    document.getElementById('saveConfirmation').classList.add('visible');

    loadQuickHistory();

    setTimeout(() => {
        resetForm();
    }, 3000);
}

function resetForm() {
    selectedEmotion = null;
    selectedActivities = [];

    document.querySelectorAll('.emotion-card').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
    });
    document.querySelectorAll('.activity-tag').forEach(t => {
        t.classList.remove('selected');
    });

    document.getElementById('moodNote').value = '';
    const charCount = document.getElementById('noteCharCount');
    if (charCount) charCount.textContent = '0';

    document.querySelector('.humor-question').style.display = '';
    document.getElementById('emotionsGrid').style.display = '';
    document.querySelectorAll('.card').forEach(c => c.style.display = '');
    document.querySelector('.save-section').style.display = '';

    document.getElementById('saveConfirmation').classList.remove('visible');
    updateSaveButton();
}

// ============================================
// HISTÓRICO RÁPIDO (últimos 7 registros do back)
// ============================================

async function loadQuickHistory() {
    const container = document.getElementById('quickHistoryItems');
    const section = document.getElementById('quickHistory');
    if (!container || !section) return;

    let registros;
    try {
        registros = await api.humor.todos();
    } catch (e) {
        if (api.tratarSemLogin(e)) return;
        section.style.display = 'none';
        return;
    }

    if (!registros || registros.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';

    const recentes = registros
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 7);

    container.innerHTML = recentes.map(r => {
        const emotionData = Pluma.getEmotionData(api.emocao.daApi(r.mood));
        const date = new Date(r.createdAt || r.logDate);
        return `
            <div class="quick-history-item" title="${Pluma.escapeHtml(emotionData.label)}">
                <span class="emotion-icon">${emotionData.icon}</span>
                <span class="date">${date.getDate()}/${date.getMonth() + 1}</span>
            </div>
        `;
    }).join('');
}
