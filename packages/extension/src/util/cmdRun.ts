import { exec, spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Log from './log'
import { FileStatus } from '../fileStatusProvider'

export interface CommandInput {
  command: string
  workspaceDir?: string
}

export interface CommandOutput {
  success: boolean
  data?: any
  message: string
}

export interface CommitTreeData {
  staged: Record<string, FileStatus>
  unstaged: Record<string, FileStatus>
}

export async function cmdRun<TInput, TOutput>(input: TInput): Promise<TOutput> {
  const tmpDir = os.tmpdir()
  const readPipe = path.join(tmpDir, `go_read_${Date.now()}`)
  const writePipe = path.join(tmpDir, `go_write_${Date.now()}`)

  ;[readPipe, writePipe].forEach((p) => {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p)
    }
  })

  try {
    await Promise.all([
      new Promise<void>((res, rej) => {
        const mk = spawn('mkfifo', [readPipe])
        mk.on('close', (c) =>
          c === 0 ? res() : rej(new Error('[Hit] mkfifo read failed')),
        )
        mk.on('error', rej)
      }),
      new Promise<void>((res, rej) => {
        const mk = spawn('mkfifo', [writePipe])
        mk.on('close', (c) =>
          c === 0 ? res() : rej(new Error('[Hit] mkfifo write failed')),
        )
        mk.on('error', rej)
      }),
    ])

    const goProc = spawn('hit', ['repo-extension', readPipe, writePipe])

    goProc.stdout.on('data', (data) => {
      Log.log('[PROCESS STDOUT]', String(data))
    })

    goProc.stderr.on('data', (data) => {
      // Log.error("[PROCESS STDERR]", String(data));
    })

    goProc.on('error', (error) => {
      Log.error('Go process error:', error)
      throw error
    })

    const writeStream = fs.createWriteStream(readPipe)
    writeStream.write(JSON.stringify(input))
    writeStream.end()

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
    })

    const readStream = fs.createReadStream(writePipe, { encoding: 'utf8' })
    let output = ''

    for await (const chunk of readStream) {
      output += chunk
    }

    if (!output.trim()) {
      throw new Error('[Hit] No output received from Go process')
    }

    return JSON.parse(output)
  } finally {
    ;[readPipe, writePipe].forEach((p) => {
      try {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p)
        }
      } catch (error) {
        Log.warn('Failed to clean up pipe:', p, error)
      }
    })
  }
}

// execute a command normally without using the extension as per the repoDirectory
export async function cmdRunExec(
  command: string,
  repoDirectory: string,
): Promise<void> {
  const currentDir = process.cwd()
  try {
    process.chdir(repoDirectory)
  } catch (error) {
    Log.error('Error changing directory:', error)
    throw error
  }
  try {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        Log.error('Error executing command:', error)
        throw error
      }
      // Log.log("Command output:", stdout);
    })
  } finally {
    process.chdir(currentDir)
  }
}
