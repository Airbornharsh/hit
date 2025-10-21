import dotenv from 'dotenv'
dotenv.config({
  quiet: true,
})
import express from 'express'
import cluster from 'cluster'
import { createServer } from 'http'
import cors from 'cors'
import authRoutes from './routes/auth.routes'
import { PORT } from './config/config'
import { connectDB } from './db/mongo/init'
import repoRoutes from './routes/repo.routes'
import branchRoutes from './routes/branch.routes'

const numCPUs = Number(process.env.CLUSTERS) || 1

if (cluster.isPrimary) {
  console.log(`Master process ${process.pid} is running`)

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }
} else {
  const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'sessionId',
      'X-Session-ID',
      'session-id',
      'x-session-id',
      'x-sessionid',
    ],
    credentials: true,
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }

  const app = express()
  const server = createServer(app)

  connectDB()

  app.set('trust proxy', true)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    next()
  })

  app.use(cors(corsOptions))
  app.use(express.json({ limit: '50mb' }))
  app.use(express.urlencoded({ limit: '50mb', extended: true }))

  app.use(express.static('public'))

  app.get('/', (req, res) => {
    res.send('Server is running')
  })
  app.get('/api/v1/health', (req, res) => {
    res.send('OK')
  })

  app.use('/api/v1/auth', authRoutes)
  app.use('/api/v1/repo', repoRoutes)
  app.use('/api/v1/branch', branchRoutes)

  server.listen(PORT, async () => {
    console.log(`Worker process ${process.pid} started on port ${PORT}`)
  })

  process.on('SIGINT', async () => {
    console.log('Shutting down server...')
    process.exit()
  })
}
