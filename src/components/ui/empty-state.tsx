import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    to: string;
    onClick?: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 text-muted-foreground/50 [&_svg]:size-12">
          {icon}
        </div>
      )}
      <h3 className="font-serif text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && (
        action.onClick ? (
          <button
            onClick={action.onClick}
            className={cn(buttonVariants({ variant: 'default' }), 'mt-6')}
          >
            {action.label}
          </button>
        ) : (
          <Link
            to={action.to}
            className={cn(buttonVariants({ variant: 'default' }), 'mt-6')}
          >
            {action.label}
          </Link>
        )
      )}
    </div>
  );
}
