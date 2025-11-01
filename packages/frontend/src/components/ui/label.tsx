import React from 'react'
import { cn } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'text-foreground text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          className,
        )}
        {...props}
      />
    )
  },
)
Label.displayName = 'Label'

export { Label }
