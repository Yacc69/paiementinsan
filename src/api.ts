export const fetchApi = async (url: string, options: RequestInit = {}) => {
  // 1. Récupération dynamique du token au moment précis de l'appel
  const token = localStorage.getItem('token');
  
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Configuration par défaut du Content-Type
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // 2. Gestion de l'URL pour éviter le cache agressif de Vercel sur les requêtes GET
  // On ajoute un timestamp (?t=...) pour forcer Vercel à demander la donnée fraîche à Supabase
  let finalUrl = url;
  if (!options.method || options.method.toUpperCase() === 'GET') {
    const separator = url.includes('?') ? '&' : '?';
    finalUrl = `${url}${separator}t=${Date.now()}`;
  }

  try {
    const response = await fetch(finalUrl, { ...options, headers });

    // 3. Gestion automatique de l'expiration de session
    if (response.status === 401 || response.status === 403) {
      // Si le token est invalide, on nettoie et on peut rediriger
      localStorage.removeItem('token');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || 'Une erreur est survenue');
    }

    return await response.json();
  } catch (error: any) {
    console.error(`Erreur API [${url}]:`, error.message);
    throw error;
  }
};