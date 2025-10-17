import { IS_PRODUCTION } from '@/config/config'

export const fullDomain = (subdomain: string) => {
  if (IS_PRODUCTION) {
    return `${subdomain}.hit-server.harshkeshri.com`
  }
  return `${subdomain}.localhost:6521`
}
