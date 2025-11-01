import { AxiosClient } from '@/utils/axios'
import { User } from '@/types/auth'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getTerminalToken } from '@/utils/session'

interface AuthState {
  isUserLoaded: boolean
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  isTerminalSessionLoading: boolean

  // Actions
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setIsAuthenticated: (isAuthenticated: boolean) => void
  getUser: () => Promise<void>
  updateUsername: (username: string) => Promise<boolean>
  logout: () => void
  completeTerminalSession: () => Promise<void>
  checkLocalTerminalSession: () => boolean
  clearError: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isUserLoaded: false,
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isTerminalSessionLoading: false,

      setUser: (user: User | null) => {
        set({ user })
      },

      setToken: (token: string | null) => {
        set({ token })
      },

      setIsAuthenticated: (isAuthenticated: boolean) => {
        set({ isAuthenticated })
      },

      getUser: async () => {
        set({ isUserLoaded: false })
        try {
          const response = await AxiosClient.get('/api/v1/auth/user')
          const data = response.data.data.user
          const newUser: User = {
            _id: data._id,
            name: data.name || '',
            clerkId: data.clerkId || '',
            email: data.email || '',
            admin: data.admin,
            provider: data.provider || 'email',
            username: data.username,
          }
          set({
            user: newUser,
          })
        } catch (error) {
          console.error('Error fetching user:', error)
        } finally {
          set({ isUserLoaded: true })
        }
      },

      updateUsername: async (username: string) => {
        set({ isLoading: true, error: null })
        try {
          await AxiosClient.patch('/api/v1/auth/user/username', {
            username,
          })
          const updatedUser: User = { ...get().user, username } as User
          set({ user: updatedUser })
          return true
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          const errorMessage =
            error?.response?.data?.message || 'Failed to update username'
          set({ error: errorMessage })
          return false
        } finally {
          set({ isLoading: false })
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        })
      },

      completeTerminalSession: async () => {
        set({ isTerminalSessionLoading: true })
        try {
          await AxiosClient.post(`/api/v1/auth/session/${getTerminalToken()}`)
        } catch (error) {
          console.error('Error completing terminal session:', error)
        } finally {
          set({ isTerminalSessionLoading: false })
        }
      },

      checkLocalTerminalSession: () => {
        const token = getTerminalToken()
        if (token) {
          return true
        }
        return false
      },

      clearError: () => {
        set({ error: null })
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },

      setError: (error: string | null) => {
        set({ error })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
    },
  ),
)
