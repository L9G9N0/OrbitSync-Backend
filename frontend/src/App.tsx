import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './store/AuthContext';
import { Dashboard } from './components/Dashboard';
import { LoginPage } from './components/LoginPage';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// ─── Loading Splash ───────────────────────────────────────────────────────────
const LoadingSplash: React.FC = () => (
  <div className="min-h-screen bg-[#030207] flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-950/50">
        <div className="absolute inset-1 rounded-full bg-[#030207] flex items-center justify-center">
          <Brain className="w-7 h-7 text-purple-400 animate-cosmic-pulse" />
        </div>
      </div>
      <p className="text-xs text-gray-600 font-mono animate-pulse">Restoring session…</p>
    </div>
  </div>
);

// ─── Protected Route Gate ─────────────────────────────────────────────────────
const AppRouter: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSplash />;

  return (
    <AnimatePresence mode="wait">
      {user ? (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Dashboard />
        </motion.div>
      ) : (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <LoginPage />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── App Root ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
        <Toaster
          theme="dark"
          position="top-right"
          closeButton
          richColors
          toastOptions={{
            style: {
              background: '#0c0b15',
              borderColor: '#2d1f4d',
              color: '#e2e8f0',
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
