import {
  S3Client,
  PutObjectCommand,
  DeleteBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} from '../config/config'
import { writeFile, readFile } from 'fs/promises'
import axios from 'axios'

let r2Client: S3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

if (!r2Client) {
  console.error('Cloudflare R2 client initialization failed')
  throw new Error('Failed to initialize Cloudflare R2 client')
}

const subPath = 'hit'

class R2CloudflareService {
  static async generateSignedUploadUrl(
    filePath: string,
    contentType?: string,
  ): Promise<{ signedUrl: string; publicUrl: string }> {
    try {
      // Check if R2 is properly configured
      if (
        !R2_ACCOUNT_ID ||
        !R2_ACCESS_KEY_ID ||
        !R2_SECRET_ACCESS_KEY ||
        !R2_BUCKET_NAME
      ) {
        throw new Error(
          'Cloudflare R2 not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME environment variables.',
        )
      }

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: filePath,
        ContentType: contentType
          ? contentType
          : await R2CloudflareService.getContentType(filePath),
        CacheControl: (60 * 60 * 24 * 30).toString(),
      })

      const signedUrl = await getSignedUrl(r2Client, command, {
        expiresIn: 3600,
      })
      return {
        signedUrl,
        publicUrl: R2CloudflareService.getPublicUrl(filePath),
      }
    } catch (error) {
      console.error('Error generating signed upload URL:', error)
      throw error
    }
  }

  static getPublicUrl(filePath: string) {
    try {
      if (!R2_PUBLIC_URL) {
        throw new Error('R2_PUBLIC_URL is not configured')
      }

      // Construct the public URL
      const publicUrl = `${R2_PUBLIC_URL}/${filePath}`

      return publicUrl
    } catch (error) {
      console.error('Error getting public URL:', error)
      throw error
    }
  }

  static async downloadFile(url: string, localPath: string): Promise<void> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' })
      if (response.status !== 200) {
        throw new Error(`Failed to download file: ${response.statusText}`)
      }

      const buffer = Buffer.from(response.data)
      await writeFile(localPath, buffer)
    } catch (error) {
      console.error('Error downloading file:', error)
      throw error
    }
  }

  static async getContentType(localPath: string): Promise<string> {
    // Get file extension
    const extension = localPath.split('.').pop()?.toLowerCase()

    // Comprehensive MIME type mapping with correct types
    const mimeTypeMap: { [key: string]: string } = {
      // Video formats
      mp4: 'video/mp4',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      wmv: 'video/x-ms-wmv',
      flv: 'video/x-flv',
      webm: 'video/webm',
      mkv: 'video/x-matroska',
      m4v: 'video/x-m4v',
      '3gp': 'video/3gpp',
      ogv: 'video/ogg',

      // Audio formats
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      aac: 'audio/aac',
      ogg: 'audio/ogg',
      wma: 'audio/x-ms-wma',
      flac: 'audio/flac',
      m4a: 'audio/mp4',
      opus: 'audio/opus',

      // Image formats
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      bmp: 'image/bmp',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
      tiff: 'image/tiff',
      tif: 'image/tiff',

      // Document formats
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      rtf: 'application/rtf',

      // Archive formats
      zip: 'application/zip',
      rar: 'application/vnd.rar',
      '7z': 'application/x-7z-compressed',
      tar: 'application/x-tar',
      gz: 'application/gzip',

      // Web formats
      html: 'text/html',
      htm: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      xml: 'application/xml',

      // Other common formats
      csv: 'text/csv',
      tsv: 'text/tab-separated-values',
      md: 'text/markdown',
      log: 'text/plain',
    }

    // First check our comprehensive mapping
    if (extension && mimeTypeMap[extension]) {
      return mimeTypeMap[extension]
    }

    // Default fallback
    return 'application/octet-stream'
  }

  static async uploadToR2(
    localPath: string,
    filePath: string,
  ): Promise<{ url: string; thumbnail?: string }> {
    try {
      if (!localPath || !filePath) {
        throw new Error('localPath and filePath are required')
      }
      const contentType = await R2CloudflareService.getContentType(localPath)

      const data = await R2CloudflareService.generateSignedUploadUrl(
        filePath,
        contentType,
      )
      const publicUrl = R2CloudflareService.getPublicUrl(filePath)

      const fileBuffer = await readFile(localPath)
      const uploadResponse = await axios.put(data.signedUrl, fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': (60 * 60 * 24 * 30).toString(),
        },
      })

      if (uploadResponse.status !== 200) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`)
      }

      return {
        url: publicUrl,
      }
    } catch (error) {
      console.error('Error uploading to R2:', error)
      throw error
    }
  }

  static async adminDownloadAndUploadFile(
    type = 'voices',
    path1: string,
    fileUrl: string,
    fName?: string,
  ): Promise<string> {
    try {
      // Check if R2 is properly configured
      if (
        !R2_ACCOUNT_ID ||
        !R2_ACCESS_KEY_ID ||
        !R2_SECRET_ACCESS_KEY ||
        !R2_BUCKET_NAME
      ) {
        throw new Error(
          'Cloudflare R2 not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME environment variables.',
        )
      }

      if (!r2Client) {
        throw new Error('Cloudflare R2 client is not properly initialized')
      }

      // Fetch the file as a stream
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`)
      }

      // Convert response body to a Buffer
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(7)

      // Extract file extension from URL or content type
      const urlPath = new URL(fileUrl).pathname
      const urlExtension = urlPath.split('.').pop()?.toLowerCase()
      const contentType = await R2CloudflareService.getContentType(fileUrl)
      const mimeExtension = contentType?.split('/')[1]

      const extension = urlExtension || mimeExtension || 'bin'
      const fileName = fName ? fName : `${timestamp}_${randomId}.${extension}`
      const path = `hit/${type}/${path1}/${fileName}`

      const data = await R2CloudflareService.generateSignedUploadUrl(
        path,
        contentType,
      )

      // Upload buffer to R2 Storage
      const uploadResponse = await axios.put(data.signedUrl, buffer, {
        headers: {
          'Content-Type': contentType ?? undefined,
          'Cache-Control': (60 * 60 * 24 * 30).toString(),
        },
      })

      if (uploadResponse.status !== 200) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`)
      }

      // Return the public URL
      const url = R2CloudflareService.getPublicUrl(path)
      return url
    } catch (error: any) {
      console.error(`Error moving file from URL ${fileUrl}:`, error)
      throw error
    }
  }

  static async adminDownloadAndUploadFiles(
    type = 'voices',
    path1: string,
    fileUrl: string[],
  ): Promise<string[]> {
    return await Promise.all(
      fileUrl.map(
        async (url) =>
          await R2CloudflareService.adminDownloadAndUploadFile(
            type,
            path1,
            url,
          ),
      ),
    )
  }

  static async downloadAndUploadFile(
    userId: string,
    fileUrl: string,
    path1?: string,
  ): Promise<string> {
    try {
      // Check if R2 is properly configured
      if (
        !R2_ACCOUNT_ID ||
        !R2_ACCESS_KEY_ID ||
        !R2_SECRET_ACCESS_KEY ||
        !R2_BUCKET_NAME
      ) {
        throw new Error(
          'Cloudflare R2 not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME environment variables.',
        )
      }

      if (!r2Client) {
        throw new Error('Cloudflare R2 client is not properly initialized')
      }

      // Fetch the file as a stream
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`)
      }

      // Convert response body to a Buffer
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(7)

      // Extract file extension from URL or content type
      const urlPath = new URL(fileUrl).pathname
      const urlExtension = urlPath.split('.').pop()?.toLowerCase()
      const contentType = await R2CloudflareService.getContentType(fileUrl)
      const mimeExtension = contentType?.split('/')[1]

      const extension = urlExtension || mimeExtension || 'bin'
      const fileName = `${timestamp}_${randomId}.${extension}`
      const path = `hit/${userId}/${path1 ? path1 : ''}/${fileName}`

      // Upload buffer to R2 Storage
      const data = await R2CloudflareService.generateSignedUploadUrl(
        path,
        contentType,
      )
      const uploadResponse = await axios.put(data.signedUrl, buffer, {
        headers: {
          'Content-Type': contentType ?? undefined,
          'Cache-Control': (60 * 60 * 24 * 30).toString(),
        },
      })

      if (uploadResponse.status !== 200) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`)
      }

      // Return the public URL
      return R2CloudflareService.getPublicUrl(path)
    } catch (error: any) {
      console.error(`Error moving file from URL ${fileUrl}:`, error)
      throw error
    }
  }

  static async downloadAndUploadFiles(
    userId: string,
    files: {
      [key: string]: string | number | boolean | null | undefined
      url: string
    }[],
    path1?: string,
  ): Promise<
    {
      [key: string]: string | number | boolean | null | undefined
      url: string
    }[]
  > {
    try {
      const newFiles = await Promise.all(
        files.map(async (file) => {
          const url = file.url
          let newUrl = ''
          try {
            newUrl = await R2CloudflareService.downloadAndUploadFile(
              userId,
              url,
              path1,
            )
          } catch (error) {
            console.error(`Error downloading and uploading file ${url}:`, error)
            newUrl = ''
          }
          return {
            ...file,
            url: newUrl,
          }
        }),
      )

      return newFiles
    } catch (error) {
      console.error('Error downloading and uploading files:', error)
      return []
    }
  }

  static async removeHitDirectory(directory: string): Promise<void> {
    try {
      DeleteBucketCommand
    } catch (error) {
      console.error('Error removing hit directory:', error)
    }
  }
}

export default R2CloudflareService
