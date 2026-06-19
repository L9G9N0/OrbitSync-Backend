import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Dashboard } from './components/Dashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
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
    </QueryClientProvider>
  );
}

export default App;
