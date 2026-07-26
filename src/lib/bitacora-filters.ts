/**
 * bitacora-filters.ts — Client-side filtering, search and sort for bitácora pages.
 * Imported by all brand bitácora index pages.
 */

function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function initBitacoraFilters() {
  const sidebar = document.getElementById('filter-sidebar');
  const backdrop = document.getElementById('filter-backdrop');
  const mobileToggle = document.getElementById('filter-toggle-mobile');
  const closeBtn = document.getElementById('filter-close');
  const collapseBtn = document.getElementById('sidebar-collapse');
  const reopenBtn = document.getElementById('sidebar-reopen');
  const searchInput = document.getElementById('bitacora-search') as HTMLInputElement | null;
  const searchClear = document.getElementById('search-clear');
  const sortSelect = document.getElementById('bitacora-sort') as HTMLSelectElement | null;
  const resultsCount = document.getElementById('results-count');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const activeFilterBadge = document.getElementById('active-filter-count');
  const grid = document.getElementById('bitacora-grid');
  const emptyState = document.getElementById('no-results');

  if (!sidebar || !grid) return;

  const cards = Array.from(grid.querySelectorAll('[data-category]')) as HTMLElement[];
  const catButtons = Array.from(document.querySelectorAll('.cat-btn')) as HTMLButtonElement[];
  const totalArticles = cards.length;

  let activeCategory = 'all';
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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  // --- Desktop collapse / reopen ---
  collapseBtn?.addEventListener('click', () => {
    sidebar!.style.display = 'none';
    reopenBtn?.classList.remove('hidden');
    reopenBtn?.classList.add('lg:flex');
  });

  reopenBtn?.addEventListener('click', () => {
    sidebar!.style.display = '';
    reopenBtn?.classList.add('hidden');
    reopenBtn?.classList.remove('lg:flex');
  });

  // --- Category selection ---
  catButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat || 'all';
      catButtons.forEach((b) => b.classList.remove('active'));
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

  // --- Sort ---
  sortSelect?.addEventListener('change', () => applyFilters());

  // --- Clear all filters ---
  clearFiltersBtn?.addEventListener('click', () => {
    activeCategory = 'all';
    searchTerm = '';
    if (searchInput) searchInput.value = '';
    searchClear?.classList.add('hidden');
    if (sortSelect) sortSelect.value = 'recientes';
    catButtons.forEach((b) => b.classList.toggle('active', b.dataset.cat === 'all'));
    applyFilters();
  });

  // --- Core: filter + sort + UI feedback ---
  function applyFilters() {
    const sortValue = sortSelect?.value || 'recientes';
    let visibleCount = 0;

    cards.forEach((card) => {
      const cat = card.dataset.category || '';
      const text = card.dataset.search || '';
      const matchesCat = activeCategory === 'all' || cat === activeCategory;
      const matchesSearch = !searchTerm || text.includes(searchTerm);
      const visible = matchesCat && matchesSearch;
      card.style.display = visible ? '' : 'none';
      if (visible) visibleCount++;
    });

    // Sort visible cards by re-appending in order
    const sorted = cards
      .filter((c) => c.style.display !== 'none')
      .sort((a, b) => {
        switch (sortValue) {
          case 'antiguos':
            return (a.dataset.fecha || '').localeCompare(b.dataset.fecha || '');
          case 'lectura-asc':
            return parseInt(a.dataset.lectura || '99') - parseInt(b.dataset.lectura || '99');
          case 'lectura-desc':
            return parseInt(b.dataset.lectura || '0') - parseInt(a.dataset.lectura || '0');
          default:
            return (b.dataset.fecha || '').localeCompare(a.dataset.fecha || '');
        }
      });

    const hidden = cards.filter((c) => c.style.display === 'none');
    [...hidden, ...sorted].forEach((card) => grid!.appendChild(card));

    // Results count
    if (resultsCount) {
      resultsCount.innerHTML = `Mostrando <span class="font-semibold text-text-secondary">${visibleCount}</span> de ${totalArticles} artículos`;
    }

    // Empty state
    emptyState?.classList.toggle('hidden', visibleCount > 0);

    // Clear button visibility
    const hasActiveFilters = activeCategory !== 'all' || searchTerm !== '';
    clearFiltersBtn?.classList.toggle('hidden', !hasActiveFilters);

    // Mobile active-filter badge
    if (activeFilterBadge) {
      const count = (activeCategory !== 'all' ? 1 : 0) + (searchTerm ? 1 : 0);
      activeFilterBadge.textContent = String(count);
      activeFilterBadge.classList.toggle('hidden', count === 0);
      activeFilterBadge.classList.toggle('flex', count > 0);
    }
  }

  // Initial sort pass
  applyFilters();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBitacoraFilters);
} else {
  initBitacoraFilters();
}
