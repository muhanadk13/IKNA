import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { authService } from '../services/auth';
import type { PasswordResetData } from '../types';

interface ForgotPasswordProps {
  onSwitchToLogin: () => void;
}

export default function ForgotPassword({ onSwitchToLogin }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await authService.requestPasswordReset({ email });
      setSuccess('Password reset email sent! Please check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (error) setError('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h2>
          <p className="text-gray-600">Enter your email to receive reset instructions</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" role="form" aria-label="Forgot password form">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Enter your email"
                required
                disabled={isLoading}
                aria-label="Email address input"
              />
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg"
            >
              <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
              <span className="text-sm text-green-700">{success}</span>
            </motion.div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send reset email button"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Sending email...
              </div>
            ) : (
              'Send Reset Email'
            )}
          </button>

          {/* Back to Login */}
          <div className="text-center">
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="flex items-center justify-center mx-auto text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
              disabled={isLoading}
              aria-label="Back to Sign In"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Sign In
            </button>
          </div>
        </form>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> If you don't receive an email within a few minutes, check your spam folder or try again.
          </p>
        </div>
      </div>
    </motion.div>
  );
} 