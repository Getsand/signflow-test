import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * Card Component
 * 
 * A container component with shadow and rounded corners.
 * Used for grouping related content with optional hover effects.
 */
export const Card: React.FC<CardProps> = ({
  children,
  hover = false,
  padding = 'md',
  className = '',
  ...props
}) => {
  // Base styles – clean SaaS card
  const baseStyles = 'bg-white rounded-xl border border-gray-200 transition-smooth card-shadow';

  // Hover styles
  const hoverStyles = hover ? 'hover:shadow-md hover:border-gray-300 cursor-pointer' : '';

  // Padding styles
  const paddingStyles: Record<typeof padding, string> = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const combinedStyles = `${baseStyles} ${hoverStyles} ${paddingStyles[padding]} ${className}`;

  return (
    <div className={combinedStyles} {...props}>
      {children}
    </div>
  );
};

/**
 * CardHeader Component
 * 
 * Header section for cards with consistent spacing and typography.
 */
export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`mb-4 ${className}`} {...props}>
      {children}
    </div>
  );
};

/**
 * CardTitle Component
 * 
 * Title for card headers with consistent styling.
 */
export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <h3 className={`text-xl font-semibold text-neutral-900 ${className}`} {...props}>
      {children}
    </h3>
  );
};

/**
 * CardDescription Component
 * 
 * Description text for card headers.
 */
export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <p className={`text-sm text-neutral-600 mt-1 ${className}`} {...props}>
      {children}
    </p>
  );
};

/**
 * CardContent Component
 * 
 * Main content area for cards.
 */
export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
};

/**
 * CardFooter Component
 * 
 * Footer section for cards with actions or additional information.
 */
export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`mt-6 pt-4 border-t border-neutral-200 ${className}`} {...props}>
      {children}
    </div>
  );
};


