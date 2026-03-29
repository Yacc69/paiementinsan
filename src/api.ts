export const fetchApi = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers);
  
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const method = options.method ? options.method.toUpperCase() : 'GET';
  let finalUrl = url;
  
  // Anti-cache uniquement pour GET
  if (method === 'GET') {
    const separator = url.includes('?') ? '&' : '?';
    finalUrl = `${url}${separator}t=${Date.now()}`;
  }

  // 📡 LE RADAR : On annonce ce qui part
  console.log(`🚀 [ENVOI API] ${method} vers ${finalUrl}`);

  try {
    const response = await fetch(finalUrl, { ...options, headers });
    
    // 📡 LE RADAR : On annonce ce qui revient
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