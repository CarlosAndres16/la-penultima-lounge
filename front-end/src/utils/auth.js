export async function logout() {
  const token = localStorage.getItem('token');
  if (!token) {
    return;
  }
  try {
    const userData = localStorage.getItem('user');
    const username = userData ? JSON.parse(userData).username : null;
    const res = await fetch('http://localhost:3000/api/v1/auth/cancel-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Logout failed');
    }
    localStorage.removeItem('token');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  } catch (e) {
    console.error('Logout error:', e);
    alert(e.message);
  }
}
