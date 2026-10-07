// src/components/LogoutButton.jsx
import React from 'react';
import { logout } from '../utils/auth';

export default function LogoutButton() {
  return (
    <button onClick={logout} className="btn-logout" style={{ marginLeft: 'auto' }}>
      Logout
    </button>
  );
}
