'use client'

import { useState, useEffect, useRef } from 'react'
import { useRepoStore } from '@/stores/repoStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GitBranch, ChevronDown, Check } from 'lucide-react'
import { Branch } from '@/types/repo'

interface BranchSelectorProps {
  repoName: string
  onBranchSelect?: (branch: Branch) => void
}

export function BranchSelector({
  repoName,
  onBranchSelect,
}: BranchSelectorProps) {
  const {
    branches,
    isBranchesLoading,
    fetchBranches,
    setActiveBranch,
    getDefaultBranch,
  } = useRepoStore()

  const [isOpen, setIsOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const callOnce = useRef(false)

  useEffect(() => {
    if (repoName && !callOnce.current) {
      callOnce.current = true
      fetchBranches(repoName, { page: 1, limit: 50 })
    }
  }, [repoName, fetchBranches])

  useEffect(() => {
    const defaultBranch = getDefaultBranch()
    if (defaultBranch) {
      setSelectedBranch(defaultBranch)
      setActiveBranch(defaultBranch)
    }
  }, [branches, getDefaultBranch, setActiveBranch])

  const handleBranchSelect = (branch: Branch) => {
    setSelectedBranch(branch)
    setActiveBranch(branch)
    setIsOpen(false)
    if (onBranchSelect) {
      onBranchSelect(branch)
    }
  }

  const defaultBranch = getDefaultBranch()

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="border-border text-foreground hover:bg-accent hover:text-accent-foreground min-w-[200px] justify-between"
        disabled={isBranchesLoading}
      >
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          <span className="truncate">
            {selectedBranch?.name || 'Select branch'}
          </span>
          {selectedBranch && defaultBranch?._id === selectedBranch._id && (
            <Badge variant="secondary" className="text-xs">
              default
            </Badge>
          )}
        </div>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="border-border bg-card absolute top-full left-0 z-50 mt-1 w-full rounded-md border shadow-lg">
          <div className="max-h-60 overflow-y-auto">
            {branches.length === 0 ? (
              <div className="text-muted-foreground px-4 py-3 text-center text-sm">
                No branches found
              </div>
            ) : (
              branches.map((branch) => (
                <button
                  key={branch._id}
                  onClick={() => handleBranchSelect(branch)}
                  className="hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    <span className="truncate">{branch.name}</span>
                    {defaultBranch?._id === branch._id && (
                      <Badge variant="secondary" className="text-xs">
                        default
                      </Badge>
                    )}
                  </div>
                  {selectedBranch?._id === branch._id && (
                    <Check className="text-primary h-4 w-4" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  )
}
