import { Badge } from '@/components/ui/badge'
import { Branch } from '@/types/repo'
import { GitBranch, Calendar, Hash } from 'lucide-react'

interface BranchCardProps {
  branch: Branch
  isDefault?: boolean
  onSelect: (branch: Branch) => void
}

export function BranchCard({
  branch,
  isDefault = false,
  onSelect,
}: BranchCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div
      className="hover:bg-accent cursor-pointer px-6 py-4 transition-colors"
      onClick={() => onSelect(branch)}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-primary hover:text-primary/80 text-lg font-semibold">
              {branch.name}
            </h3>
            {isDefault && (
              <Badge variant="default" className="text-xs">
                default
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              <span className="font-mono text-xs">
                {branch.headCommit.slice(0, 8)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Updated {formatDate(branch.updatedAt)}</span>
            </div>
          </div>
        </div>
        <div className="text-muted-foreground flex items-center gap-1 text-sm">
          <GitBranch className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}
