import { toast } from 'sonner';

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  toast[type](message, {
    position: 'bottom-center',
    duration: 3000,
  });
}
