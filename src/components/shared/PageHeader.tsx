import { memo } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  title: string;
  badge?: string;
  description?: string;
  action?: {
    label: string;
    to: string;
    onClick?: () => void;
  };
}

function PageHeaderInner({ title, badge, description, action }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-4 border-b border-border">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-3xl font-bold text-foreground">{title}</h1>
          {badge && (
            <span className="truncate max-w-[200px] rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-muted-foreground text-sm mt-1">{description}</p>
        )}
      </div>
      {action && (
        action.onClick ? (
          <button
            onClick={action.onClick}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 max-md:min-h-[44px]"
          >
            {action.label}
          </button>
        ) : (
          <Link
            to={action.to}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 max-md:min-h-[44px]"
          >
            {action.label}
          </Link>
        )
      )}
    </div>
  );
}

export const PageHeader = memo(PageHeaderInner);
