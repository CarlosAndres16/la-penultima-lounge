import React, { useEffect, useState } from 'react';
import './Toast.css';

/**
 * Simple toast notification component.
 * Props:
 *   - message: string to display
 *   - type: 'error' | 'success' (default: 'error')
 *   - onClose: callback when the toast auto‑closes
 */
export default function Toast({ message, type = 'error', onClose }) {
  // Auto‑close after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => onClose && onClose(), 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type}`}> {message} </div>
  );
}
