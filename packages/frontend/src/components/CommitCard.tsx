import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Commit } from '@/types/repo'
import { GitCommit, Calendar, User, Hash } from 'lucide-react'

interface CommitCardProps {
  commit: Commit
  onSelect: (commit: Commit) => void
}

export function CommitCard({ commit, onSelect }: CommitCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onSelect(commit)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-foreground text-lg font-semibold">
              {commit.message}
            </CardTitle>
            <div className="mt-2 flex items-center gap-2">
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
                <User className="h-4 w-4" />
                <span>{commit.author}</span>
              </div>
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(commit.timestamp)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {commit.hash.slice(0, 8)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Hash className="h-4 w-4" />
              <span className="font-mono text-xs">{commit.hash}</span>
            </div>
            {commit.parent && (
              <div className="flex items-center gap-1">
                <span className="text-xs">Parent:</span>
                <span className="font-mono text-xs">
                  {commit.parent.slice(0, 8)}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <GitCommit className="h-4 w-4" />
            <span>Commit</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
