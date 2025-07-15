import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Shield, 
  Edit3, 
  Save, 
  X, 
  LogOut, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  Eye,
  EyeOff,
  Calendar,
  Check
} from 'lucide-react';
import { authService } from '../services/auth';
import type { User as UserType, ProfileUpdateData, ChangePasswordData } from '../types';

interface ProfileProps {
  onLogout: () => void;
  onBack: () => void;
}

export default function Profile({ onLogout, onBack }: ProfileProps) {
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile edit form
  const [editForm, setEditForm] = useState<ProfileUpdateData>({
    username: '',
    email: ''
  });

  // Password change form
  const [passwordForm, setPasswordForm] = useState<ChangePasswordData>({
    currentPassword: '',
    newPassword: ''
  });
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const profile = await authService.getProfile();
      setUser(profile);
      setEditForm({
        username: profile.username,
        email: profile.email
      });
    } catch (err: any) {
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const updatedUser = await authService.updateProfile(editForm);
      setUser(updatedUser);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== confirmNewPassword) {
      setError('New passwords do not match');
      return;
    }

    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await authService.changePassword(passwordForm);
      setSuccess('Password changed successfully!');
      setIsChangingPassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setConfirmNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setError('');
    setIsLoading(true);

    try {
      await authService.deleteAccount(deletePassword);
      onLogout();
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      onLogout();
    } catch (err) {
      console.error('Logout error:', err);
      onLogout();
    }
  };

  if (isLoading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 py-10 px-4 sm:px-8 md:px-12 lg:px-20 flex flex-col items-center">
      <div className="max-w-2xl w-full mx-auto bg-white rounded-3xl shadow-2xl p-8 relative px-[13px]">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="absolute left-6 top-6 flex items-center font-bold p-0 m-0 bg-transparent border-none shadow-none"
          style={{ color: 'white', fontSize: '75px', background: 'none', border: 'none', boxShadow: 'none', lineHeight: 1, cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseOver={e => (e.currentTarget.style.color = '#e5e5e5')}
          onMouseOut={e => (e.currentTarget.style.color = 'white')}
        >
          {'<'}
        </button>

        {/* Profile Avatar */}
        <div className="flex flex-col items-center mt-2 mb-8">
          <div className="h-36 w-36 rounded-full bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center shadow-xl mb-3 border-4 border-white">
            <User className="h-20 w-20 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-1 mr-[10px] mb-[10px]">{user?.username}</h1>
          <p className="text-gray-500 text-lg mr-[10px] mb-[10px]">{user?.email}</p>
        </div>

        {/* Divider */}
        <div className="my-8 mr-[10px]" />

        {/* Profile Information */}
        <div className="mb-10 shadow-lg rounded-2xl bg-white p-6 mr-[10px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center"><Mail className="h-5 w-5 mr-2 text-primary" />Profile Information</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center text-primary hover:text-blue-700 font-medium transition-colors shadow-md rounded-xl bg-white/80 px-4 py-2 mr-[10px]"
              >
                <Edit3 className="h-4 w-4 mr-1" />
                Edit
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 mb-[10px]">Username</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 mb-[10px]">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm"
                  disabled={isLoading}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                  className="flex items-center px-4 py-2 bg-primary text-white rounded-xl shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm({ username: user?.username || '', email: user?.email || '' });
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors rounded-xl shadow-md bg-white/80"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center mb-[10px] ml-[10px]">
                <div>
                  <p className="text-sm text-gray-500 mb-[10px]">Username</p>
                  <p className="font-medium mb-[10px] flex items-center">{user?.username} <User className="h-5 w-5 text-gray-400 align-middle" /></p>
                </div>
              </div>
              <div className="flex items-center mb-[10px] ml-[10px]">
                <div>
                  <p className="text-sm text-gray-500 mb-[10px]">Email</p>
                  <p className="font-medium mb-[10px] flex items-center">{user?.email} <Mail className="h-5 w-5 text-gray-400 align-middle" /></p>
                </div>
              </div>
              <div className="flex items-center mb-[10px] ml-[10px]">
                <div>
                  <p className="text-sm text-gray-500 mb-[10px]">Member since</p>
                  <p className="font-medium mb-[10px] flex items-center">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'} <Calendar className="h-5 w-5 text-gray-400 align-middle" /></p>
                </div>
              </div>
              <div className="flex items-center mb-[10px] ml-[10px]">
                <div>
                  <p className="text-sm text-gray-500 mb-[10px]">Email verified</p>
                  <p className={`font-medium flex items-center ${user?.is_verified ? 'text-green-600' : 'text-red-600'} mb-[10px]`}>{user?.is_verified ? 'Yes' : 'No'} <Check className="h-5 w-5 text-gray-400 align-middle" /></p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="my-8 mr-[10px]" />

        {/* Change Password */}
        <div className="mb-10 shadow-lg rounded-2xl bg-white p-6 mr-[10px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center"><Shield className="h-5 w-5 mr-2 text-primary" />Change Password</h2>
            {!isChangingPassword && (
              <button
                onClick={() => setIsChangingPassword(true)}
                className="flex items-center text-primary hover:text-blue-700 font-medium transition-colors shadow-md rounded-xl bg-white/80 px-4 py-2 mr-[10px]"
              >
                <Edit3 className="h-4 w-4 mr-1" />
                Change
              </button>
            )}
          </div>
          {isChangingPassword ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 mb-[10px]">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 mb-[10px]">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 mb-[10px]">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleChangePassword}
                  disabled={isLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !confirmNewPassword}
                  className="flex items-center px-4 py-2 bg-primary text-white rounded-xl shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Update Password
                </button>
                <button
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordForm({ currentPassword: '', newPassword: '' });
                    setConfirmNewPassword('');
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors rounded-xl shadow-md bg-white/80"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-600 mb-[10px]">Keep your account secure by changing your password regularly.</p>
          )}
        </div>

        {/* Divider */}
        <div className="my-8 mr-[10px]" />

        {/* Account Actions */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="flex items-center px-6 py-3 bg-white text-primary hover:bg-blue-50 rounded-xl shadow-lg transition-all w-full md:w-auto font-semibold"
            style={{ width: '200px' }}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sign Out
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isLoading}
            className="flex items-center px-6 py-3 bg-gradient-to-r from-red-400 to-red-600 text-white hover:from-red-500 hover:to-red-700 rounded-xl shadow-lg transition-all w-full md:w-auto font-semibold"
            style={{ width: '200px' }}
          >
            <Trash2 className="h-5 w-5 mr-3" />
            Delete Account
          </button>
        </div>

        {/* Delete Account Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 mr-[10px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl mr-[10px]"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4 mb-[10px]">Delete Account</h3>
              <p className="text-gray-600 mb-4 mb-[10px]">This action cannot be undone. All your data will be permanently deleted.</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2 mb-[10px]">Enter your password to confirm</label>
                <div className="relative">
                  <input
                    type={showDeletePassword ? 'text' : 'password'}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={isLoading || !deletePassword}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-400 to-red-600 text-white rounded-xl shadow-lg hover:from-red-500 hover:to-red-700 transition-all disabled:opacity-50"
                >
                  Delete Account
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword('');
                  }}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors rounded-xl shadow-md bg-white/80"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
} 