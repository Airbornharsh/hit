'use client'

import { SignIn, SignUp, useSignIn, useUser } from '@clerk/nextjs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function AuthPage() {
  const [tab, setTab] = useState<'demo' | 'signin' | 'signup'>('demo')
  const [isLoading, setIsLoading] = useState(false)
  const { signIn, isLoaded } = useSignIn()
  const { user } = useUser()
  const loadedData = useMemo(() => {
    return {
      email: 'harshkeshriwork@gmail.com',
      password: 'Airbornharsh123#',
    }
  }, [])

  useEffect(() => {
    if (isLoaded && user) {
      window.location.href = '/'
    }
  }, [isLoaded, user])

  const handleDemoSignIn = async () => {
    try {
      setIsLoading(true)
      if (!signIn) return
      const { email, password } = loadedData
      const result = await signIn.create({
        identifier: email,
        password,
      })
      if (result.status === 'complete') {
        window.location.href = '/'
      } else {
        setTab('signin')
      }
    } catch (error) {
      console.error(error)
      setTab('signin')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-background flex min-h-full items-center justify-center p-4">
      <Link
        href="/help"
        className="text-muted-foreground hover:text-foreground absolute top-4 right-4 text-sm transition-colors"
      >
        Help
      </Link>
      <div className="w-full max-w-md">
        <Card className="bg-0 border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome To Hit</CardTitle>
            <CardDescription>
              Choose your preferred authentication method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue={tab}
              onValueChange={(value) =>
                setTab(value as 'demo' | 'signin' | 'signup')
              }
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="demo">Demo</TabsTrigger>
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="demo" className="mt-6">
                <div className="flex flex-col items-center gap-3">
                  <Button onClick={handleDemoSignIn} disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Demo Sign In'}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="signin" className="mt-6">
                <div className="space-y-4">
                  <SignIn
                    routing="hash"
                    signUpUrl="/auth#signup"
                    afterSignInUrl="/"
                  />
                </div>
              </TabsContent>

              <TabsContent value="signup" className="mt-6">
                <div className="space-y-4">
                  <SignUp
                    routing="hash"
                    signInUrl="/auth#signin"
                    afterSignUpUrl="/"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
