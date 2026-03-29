export const fetchApi = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers);
  
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const method = options.method ? options.method.toUpperCase() : 'GET';
  let finalUrl = url;
  
  if (method === 'GET') {
    const separator = url.includes('?') ? '&' : '?';
    finalUrl = `${url}${separator}t=${Date.now()}`;
  }

  console.log(`🚀 [ENVOI API] ${method} vers ${finalUrl}`);

  try {
    // ☢️ MODIFICATION ICI : On ajoute cache: 'no-store' pour forcer le téléchargement réel
    const response = await fetch(finalUrl, { 
      ...options, 
      headers,
      cache: 'no-store' // Interdit formellement le cache
    });
    
    console.log(`📦 [RETOUR API] ${method} ${finalUrl} -> Statut HTTP: ${response.status}`);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error(`❌ [ERREUR SERVEUR]`, data);
      throw new Error((data && (data.error || data.message)) || `Erreur bloquante (Code ${response.status})`);
    }

    return data;
  } catch (error: any) {
    console.error(`💥 [CRASH RÉSEAU/API]`, error);
    throw error;
  }
};