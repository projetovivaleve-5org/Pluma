/**
 * PLUMA - Diário Emocional
 * Criação, edição, busca e exclusão de entradas no back-end (/v1/diary). Precisa de login.
 */

const api = window.VivaLeveAPI;

let entradas = [];            // cache da última lista carregada do back
let currentEntryId = null;
let selectedEntryEmotion = null;
let isEditing = false;
let salvando = false;

document.addEventListener('DOMContentLoaded', function() {
    if (!api.exigirLogin()) return;
    initDiaryPage();
});

function initDiaryPage() {
    setupModal();
    setupSearch();
    setupButtons();
    setupEmotionSelector();
    loadEntries();
}

// ============================================
// CARREGAR ENTRADAS
// ============================================

async function loadEntries(query = '') {
    const container = document.getElementById('diaryEntries');
    const emptyState = document.getElementById('diaryEmpty');

    container.style.display = '';
    emptyState.style.display = 'none';
    container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Carregando...</p></div>';

    try {
        entradas = (await api.diario.listar(query.trim() || undefined)) || [];
    } catch (e) {
        if (api.tratarSemLogin(e)) return;
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>${Pluma.escapeHtml(api.mensagemErro(e))}</p>
            </div>
        `;
        return;
    }

    entradas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (entradas.length === 0) {
        if (query.trim()) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Nenhuma entrada encontrada para "${Pluma.escapeHtml(query)}"</p>
                </div>
            `;
        } else {
            container.style.display = 'none';
            emptyState.style.display = '';
        }
        return;
    }

    container.innerHTML = entradas.map(entry => createEntryCard(entry)).join('');

    container.querySelectorAll('.diary-entry').forEach(card => {
        card.addEventListener('click', function(e) {
            if (!e.target.closest('.entry-action')) {
                viewEntry(Number(this.dataset.id));
            }
        });
    });
    container.querySelectorAll('.entry-action.edit').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            editEntry(Number(this.closest('.diary-entry').dataset.id));
        });
    });
    container.querySelectorAll('.entry-action.delete').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteEntry(Number(this.closest('.diary-entry').dataset.id));
        });
    });
}

function dadosEmocao(entry) {
    return entry.emotion
        ? Pluma.getEmotionData(api.emocao.daApi(entry.emotion))
        : { icon: '📝', label: '' };
}

function createEntryCard(entry) {
    const emotionData = dadosEmocao(entry);
    const dayName = Pluma.getDayName(entry.createdAt);

    return `
        <div class="diary-entry" data-id="${entry.id}">
            <div class="entry-header">
                <div class="entry-date">
                    <span class="entry-day">${dayName}</span>
                    <span class="entry-full-date">${Pluma.formatDate(entry.createdAt, 'medium')}</span>
                </div>
                <span class="entry-emotion">${emotionData.icon}</span>
            </div>
            <h3 class="entry-title">${Pluma.escapeHtml(entry.title)}</h3>
            <p class="entry-preview">${Pluma.escapeHtml(entry.text)}</p>
            <div class="entry-actions">
                <button class="entry-action edit">
                    <i class="fas fa-edit"></i>
                    Editar
                </button>
                <button class="entry-action delete">
                    <i class="fas fa-trash"></i>
                    Excluir
                </button>
            </div>
        </div>
    `;
}

function acharEntrada(id) {
    return entradas.find(e => e.id === id);
}

// ============================================
// VISUALIZAR ENTRADA
// ============================================

function viewEntry(id) {
    const entry = acharEntrada(id);
    if (!entry) return;

    currentEntryId = id;
    const emotionData = dadosEmocao(entry);

    document.getElementById('entryViewContent').innerHTML = `
        <div class="entry-view-meta">
            <span class="entry-view-emotion">${emotionData.icon}</span>
            <div>
                <span class="entry-view-date">${Pluma.formatDateTime(entry.createdAt)}</span>
                ${emotionData.label ? `<span class="badge badge-verde" style="margin-left: 8px;">${emotionData.label}</span>` : ''}
            </div>
        </div>
        <h2 class="entry-view-title">${Pluma.escapeHtml(entry.title)}</h2>
        <div class="entry-view-text">${Pluma.escapeHtml(entry.text)}</div>
    `;

    document.getElementById('diaryList').style.display = 'none';
    document.getElementById('entryView').classList.add('visible');
}

function closeEntryView() {
    currentEntryId = null;
    document.getElementById('entryView').classList.remove('visible');
    document.getElementById('diaryList').style.display = '';
}

// ============================================
// MODAL
// ============================================

function setupModal() {
    const modal = document.getElementById('entryModal');

    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelEntry').addEventListener('click', closeModal);
    document.getElementById('saveEntry').addEventListener('click', saveEntry);

    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('visible')) closeModal();
    });
}

function openModal(editMode = false) {
    isEditing = editMode;
    document.getElementById('modalTitle').textContent = editMode ? 'Editar Entrada' : 'Nova Entrada';

    if (!editMode) {
        currentEntryId = null;
        clearForm();
    }

    document.getElementById('entryModal').classList.add('visible');
    document.getElementById('entryTitle').focus();
}

function closeModal() {
    document.getElementById('entryModal').classList.remove('visible');
    clearForm();
}

function clearForm() {
    document.getElementById('entryTitle').value = '';
    document.getElementById('entryText').value = '';
    selectedEntryEmotion = null;
    document.querySelectorAll('.emotion-option').forEach(opt => opt.classList.remove('selected'));
}

// ============================================
// SELETOR DE EMOÇÃO
// ============================================

function setupEmotionSelector() {
    const options = document.querySelectorAll('.emotion-option');
    options.forEach(option => {
        option.addEventListener('click', function() {
            const jaSelecionada = this.classList.contains('selected');
            options.forEach(o => o.classList.remove('selected'));
            // clicar de novo na mesma emoção tira a seleção (a emoção é opcional)
            if (jaSelecionada) {
                selectedEntryEmotion = null;
            } else {
                this.classList.add('selected');
                selectedEntryEmotion = this.dataset.emotion;
            }
        });
    });
}

// ============================================
// SALVAR ENTRADA
// ============================================

function setSalvando(ativo) {
    salvando = ativo;
    const btn = document.getElementById('saveEntry');
    btn.disabled = ativo;
    if (ativo) {
        btn.dataset.textoOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    } else if (btn.dataset.textoOriginal) {
        btn.innerHTML = btn.dataset.textoOriginal;
    }
}

async function saveEntry() {
    if (salvando) return;

    const title = document.getElementById('entryTitle').value.trim();
    const text = document.getElementById('entryText').value.trim();

    if (!title || !text) {
        alert('Por favor, preencha o título e o texto.');
        return;
    }

    const dados = {
        title,
        text,
        emotion: api.emocao.paraApi(selectedEntryEmotion)
    };

    setSalvando(true);
    try {
        if (isEditing && currentEntryId) {
            await api.diario.atualizar(currentEntryId, dados);
        } else {
            await api.diario.criar(dados);
        }
    } catch (e) {
        if (api.tratarSemLogin(e)) return;
        alert(api.mensagemErro(e, 'Erro ao salvar. Tente novamente.'));
        return;
    } finally {
        setSalvando(false);
    }

    closeModal();
    if (document.getElementById('entryView').classList.contains('visible')) {
        closeEntryView();
    }
    document.getElementById('searchInput').value = '';
    loadEntries();
}

// ============================================
// EDITAR ENTRADA
// ============================================

function editEntry(id) {
    const entry = acharEntrada(id);
    if (!entry) return;

    currentEntryId = id;
    document.getElementById('entryTitle').value = entry.title;
    document.getElementById('entryText').value = entry.text;

    document.querySelectorAll('.emotion-option').forEach(o => o.classList.remove('selected'));
    selectedEntryEmotion = entry.emotion ? api.emocao.daApi(entry.emotion) : null;
    if (selectedEntryEmotion) {
        const option = document.querySelector(`.emotion-option[data-emotion="${selectedEntryEmotion}"]`);
        if (option) option.classList.add('selected');
    }

    openModal(true);
}

// ============================================
// EXCLUIR ENTRADA
// ============================================

async function deleteEntry(id) {
    if (!confirm('Tem certeza que deseja excluir esta entrada?')) return;

    try {
        await api.diario.apagar(id);
    } catch (e) {
        if (api.tratarSemLogin(e)) return;
        // 404: já não existe no back; segue e recarrega a lista
        if (e.status !== 404) {
            alert(api.mensagemErro(e, 'Erro ao excluir. Tente novamente.'));
            return;
        }
    }

    if (document.getElementById('entryView').classList.contains('visible')) {
        closeEntryView();
    }
    loadEntries(document.getElementById('searchInput').value);
}

// ============================================
// BUSCA (feita no back: GET /v1/diary?q=)
// ============================================

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', Pluma.debounce(function() {
        loadEntries(searchInput.value);
    }, 400));
}

// ============================================
// BOTÕES
// ============================================

function setupButtons() {
    document.getElementById('newEntryBtn').addEventListener('click', () => openModal(false));
    document.getElementById('emptyNewEntryBtn')?.addEventListener('click', () => openModal(false));

    document.getElementById('backBtn').addEventListener('click', closeEntryView);

    document.getElementById('editEntryBtn').addEventListener('click', () => {
        if (currentEntryId) editEntry(currentEntryId);
    });
    document.getElementById('deleteEntryBtn').addEventListener('click', () => {
        if (currentEntryId) deleteEntry(currentEntryId);
    });

    document.getElementById('filterBtn').addEventListener('click', () => {
        alert('Filtros avançados em desenvolvimento!');
    });
}
