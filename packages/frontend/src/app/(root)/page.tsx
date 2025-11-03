'use client'

import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const { isLoaded } = useAuth()
  const { user } = useAuthStore()
  const router = useRouter()
  useEffect(() => {
    if (isLoaded) {
      if (user) {
        if (user?.username) {
          router.push(`/${user?.username}/repositories`)
        }
      } else {
        router.push('/auth')
      }
    }
  }, [router, user, isLoaded])
  return <div className="h-full overflow-auto p-6"></div>
}
