/**
 * experimento-filters.ts — Client-side filtering for Granja experimentos.
 * Filters by subsistema and estado, with text search.
 */

function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function initExperimentFilters() {
  const sidebar = document.getElementById('filter-sidebar');
  const backdrop = document.getElementById('filter-backdrop');
  const mobileToggle = document.getElementById('filter-toggle-mobile');
  const closeBtn = document.getElementById('filter-close');
  const searchInput = document.getElementById('experimento-search') as HTMLInputElement | null;
  const searchClear = document.getElementById('search-clear');
  const resultsCount = document.getElementById('results-count');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const grid = document.getElementById('experimento-grid');
  const emptyState = document.getElementById('no-results');

  if (!sidebar || !grid) return;

  const cards = Array.from(grid.querySelectorAll('[data-subsistema]')) as HTMLElement[];
  const filterButtons = Array.from(document.querySelectorAll('.filter-btn')) as HTMLButtonElement[];
  const totalExperiments = cards.length;

  let activeSubsistema = 'all';
  let activeEstado = 'all';
  let searchTerm = '';

  // --- Mobile drawer ---
  function openDrawer() {
    sidebar!.classList.remove('-translate-x-full');
    backdrop!.classList.remove('opacity-0', 'invisible');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    sidebar!.classList.add('-translate-x-full');
    backdrop!.classList.add('opacity-0', 'invisible');
    document.body.style.overflow = '';
  }

  mobileToggle?.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  backdrop?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  // --- Filter button selection ---
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      const value = btn.dataset.value || 'all';

      if (group === 'subsistema') {
        activeSubsistema = value;
        filterButtons.filter(b => b.dataset.group === 'subsistema').forEach(b => b.classList.remove('active'));
      } else if (group === 'estado') {
        activeEstado = value;
        filterButtons.filter(b => b.dataset.group === 'estado').forEach(b => b.classList.remove('active'));
      }
      btn.classList.add('active');
      applyFilters();
    });
  });

  // --- Search with debounce ---
  let debounce: ReturnType<typeof setTimeout>;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      searchTerm = normalize(searchInput!.value.trim());
      searchClear!.classList.toggle('hidden', !searchTerm);
      applyFilters();
    }, 200);
  });

  searchClear?.addEventListener('click', () => {
    searchInput!.value = '';
    searchTerm = '';
    searchClear!.classList.add('hidden');
    applyFilters();
    searchInput!.focus();
  });

  // --- Clear all filters ---
  clearFiltersBtn?.addEventListener('click', () => {
    activeSubsistema = 'all';
    activeEstado = 'all';
    searchTerm = '';
    if (searchInput) searchInput.value = '';
    searchClear?.classList.add('hidden');
    filterButtons.forEach(b => b.classList.toggle('active', b.dataset.value === 'all'));
    applyFilters();
  });

  // --- Core filter logic ---
  function applyFilters() {
    let visibleCount = 0;

    cards.forEach((card) => {
      const sub = card.dataset.subsistema || '';
      const est = card.dataset.estado || '';
      const text = card.dataset.search || '';
      const matchesSub = activeSubsistema === 'all' || sub === activeSubsistema;
      const matchesEst = activeEstado === 'all' || est === activeEstado;
      const matchesSearch = !searchTerm || text.includes(searchTerm);
      const visible = matchesSub && matchesEst && matchesSearch;
      card.style.display = visible ? '' : 'none';
      if (visible) visibleCount++;
    });

    // Results count
    if (resultsCount) {
      resultsCount.innerHTML = `Mostrando <span class="font-semibold text-text-secondary">${visibleCount}</span> de ${totalExperiments} experimentos`;
    }

    // Empty state
    emptyState?.classList.toggle('hidden', visibleCount > 0);

    // Clear button visibility
    const hasActive = activeSubsistema !== 'all' || activeEstado !== 'all' || searchTerm !== '';
    clearFiltersBtn?.classList.toggle('hidden', !hasActive);
  }

  applyFilters();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExperimentFilters);
} else {
  initExperimentFilters();
}
