import axios from 'axios'
import zlib from 'zlib'
import { CacheService } from './cache.service'

class ZlibService {
  private static cache = CacheService.getInstance<string, string>({
    maxItems: 1000,
    defaultTtlMs: 5 * 60 * 1000, // 5 minutes
    sweepIntervalMs: 60 * 1000, // 1 minute
  })

  static async decompress(hash: string): Promise<string> {
    const cached = this.cache.get(hash)
    if (cached) {
      return cached
    }

    const link = `https://media.harshkeshri.com/hit/${hash.slice(0, 2)}/${hash.slice(2)}`

    try {
      const response = await axios.get(link, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'Accept-Encoding': 'identity',
        },
      })

      const decompressed = zlib.inflateSync(Buffer.from(response.data))
      const result = decompressed.toString()

      this.cache.set(hash, result)

      return result
    } catch (error) {
      console.error('Zlib decompression error:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(
        `Failed to decompress data for hash ${hash}: ${errorMessage}`,
      )
    }
  }
}

export default ZlibService
