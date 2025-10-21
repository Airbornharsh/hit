import React from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'destructive' | 'success' | 'warning'
  }
>(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: 'bg-background text-foreground border-border',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
    success:
      'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/10 dark:text-green-400 dark:border-green-800',
    warning:
      'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/10 dark:text-yellow-400 dark:border-yellow-800',
  }

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'relative w-full rounded-lg border p-4',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
})
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 leading-none font-medium tracking-tight', className)}
    {...props}
  />
))
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
))
AlertDescription.displayName = 'AlertDescription'

const AlertIcon = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'destructive' | 'success' | 'warning'
  }
>(({ className, variant = 'default', ...props }, ref) => {
  const icons = {
    default: Info,
    destructive: AlertCircle,
    success: CheckCircle,
    warning: AlertTriangle,
  }

  const Icon = icons[variant]

  return (
    <div
      ref={ref}
      className={cn('flex items-center gap-2', className)}
      {...props}
    >
      <Icon className="h-4 w-4" />
    </div>
  )
})
AlertIcon.displayName = 'AlertIcon'

export { Alert, AlertTitle, AlertDescription, AlertIcon }
