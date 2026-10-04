/**
 * Banda de suscripción: convierte el correo en un alta real en Listmonk.
 * Se activa sobre cualquier `form[data-suscripcion]`; el valor del atributo es la
 * marca, que sólo sirve para trazabilidad del alta.
 */
for (const form of document.querySelectorAll<HTMLFormElement>('form[data-suscripcion]')) {
  const status = form.parentElement?.querySelector<HTMLElement>('[data-suscripcion-status]');
  const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!status || !btn) continue;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector<HTMLInputElement>('input[type="email"]')?.value.trim() ?? '';
    const anterior = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    status.classList.remove('hidden');

    let ok = false;
    let mensaje = 'Error de conexión. Intenta de nuevo.';
    try {
      const res = await fetch('/api/suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, marca: form.dataset.suscripcion }),
      });
      const json = await res.json();
      ok = res.ok;
      mensaje = ok ? json.message : json.error;
    } catch {
      /* mensaje ya trae el texto de conexión */
    }

    status.textContent = mensaje;
    status.className = `mt-3 text-sm text-center ${ok ? 'text-brand' : 'text-red-500'}`;
    if (ok) form.reset();
    btn.disabled = false;
    btn.textContent = anterior;
  });
}
