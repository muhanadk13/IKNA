import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen } from 'lucide-react';
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 flex flex-col justify-center px-12">
          <div className="flex items-center mb-8">
            <BookOpen className="h-12 w-12 text-white mr-4" />
            <h1 className="text-4xl font-bold text-white">Anki</h1>
          </div>
          <h2 className="text-3xl font-semibold text-white mb-6">
            Master any subject with intelligent flashcards
          </h2>
          <p className="text-xl text-indigo-100 leading-relaxed">
            AI-powered learning that adapts to your pace. Create, study, and retain knowledge more effectively than ever before.
          </p>
        </div>
        {/* Decorative background pattern */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-24 translate-x-24"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[700px]">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <BookOpen className="h-10 w-10 text-indigo-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">Anki</h1>
            </div>
            <p className="text-gray-600">Smart flashcards for smarter learning</p>
          </div>

          <AnimatePresence mode="wait">
            {currentView === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <ForgotPassword onSwitchToLogin={handleSwitchToLogin} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
} 