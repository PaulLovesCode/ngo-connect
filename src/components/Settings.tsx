import React, { useState } from 'react';
import { Settings as SettingsIcon, Lock, Type, ChevronRight, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { auth } from '../lib/firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { cn } from '../lib/utils';

export function Settings() {
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('app-font-size');
    return saved ? parseInt(saved) : 16;
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFontSizeChange = (delta: number) => {
    const newSize = Math.min(Math.max(fontSize + delta, 12), 24);
    setFontSize(newSize);
    document.documentElement.style.fontSize = `${newSize}px`;
    localStorage.setItem('app-font-size', newSize.toString());
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setStatus({ type: 'error', message: 'New passwords do not match' });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('User not authenticated');

      // Re-authenticate user first
      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, passwordData.newPassword);
      
      setStatus({ type: 'success', message: 'Password updated successfully' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="flex items-center space-x-4 mb-8">
        <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
          <SettingsIcon size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Manage your account preferences and security</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Appearance Settings */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div className="flex items-center space-x-3 text-gray-900">
            <Type className="text-emerald-600" size={20} />
            <h2 className="text-xl font-bold">Appearance</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div>
                <p className="font-bold text-gray-900">Font Size</p>
                <p className="text-xs text-gray-500">Adjust the application text size</p>
              </div>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => handleFontSizeChange(-1)}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors font-bold"
                >
                  -
                </button>
                <span className="font-bold text-lg w-8 text-center">{fontSize}px</span>
                <button 
                  onClick={() => handleFontSizeChange(1)}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors font-bold"
                >
                  +
                </button>
              </div>
            </div>
            
            <div className="p-4 border border-emerald-100 bg-emerald-50/30 rounded-2xl">
              <p className="text-sm text-emerald-800 leading-relaxed">
                The font size adjustment helps you customize the interface for better readability. 
                Changes are saved automatically to your browser.
              </p>
            </div>
          </div>
        </section>

        {/* Security Settings */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div className="flex items-center space-x-3 text-gray-900">
            <Lock className="text-emerald-600" size={20} />
            <h2 className="text-xl font-bold">Security</h2>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Current Password</label>
              <input 
                type="password"
                required
                value={passwordData.currentPassword}
                onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">New Password</label>
              <input 
                type="password"
                required
                value={passwordData.newPassword}
                onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Confirm New Password</label>
              <input 
                type="password"
                required
                value={passwordData.confirmPassword}
                onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            {status && (
              <div className={cn(
                "p-4 rounded-2xl flex items-center space-x-3",
                status.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              )}>
                {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <p className="text-sm font-medium">{status.message}</p>
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Save size={18} />
              <span>{loading ? 'Updating...' : 'Update Password'}</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
