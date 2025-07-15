import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';

type AuthView = 'login' | 'register' | 'forgot-password';

interface AuthContainerProps {
  onAuthSuccess: () => void;
}

export default function AuthContainer({ onAuthSuccess }: AuthContainerProps) {
  const [currentView, setCurrentView] = useState<AuthView>('login');

  const handleSwitchToLogin = () => setCurrentView('login');
  const handleSwitchToRegister = () => setCurrentView('register');
  const handleSwitchToForgotPassword = () => setCurrentView('forgot-password');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {currentView === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Login
                onSwitchToRegister={handleSwitchToRegister}
                onSwitchToForgotPassword={handleSwitchToForgotPassword}
                onLoginSuccess={onAuthSuccess}
              />
            </motion.div>
          )}

          {currentView === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Register
                onSwitchToLogin={handleSwitchToLogin}
                onRegisterSuccess={onAuthSuccess}
              />
            </motion.div>
          )}

          {currentView === 'forgot-password' && (
            <motion.div
              key="forgot-password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ForgotPassword onSwitchToLogin={handleSwitchToLogin} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
} 