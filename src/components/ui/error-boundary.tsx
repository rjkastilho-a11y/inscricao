import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-lg font-semibold text-foreground">Algo deu errado</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Ocorreu um erro inesperado ao carregar esta página. Recarregue para tentar novamente.
          </p>
          <Button onClick={this.handleReload}>Recarregar</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
