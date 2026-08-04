import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { authRouter } from './modules/auth/auth.routes.js'
import { expenseRouter } from './modules/expense/expense.routes.js'
import { metadataRouter } from './modules/metadata/metadata.routes.js'
import { importRouter } from './modules/import/import.routes.js'
import { errorHandler } from './middleware/errorHandler.js'
import { env } from './config/env.js'

export const app: Express = express()

// Middleware
app.use(helmet())
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true)

    // Allow localhost on any port in development
    const allowedOrigins = [
      ...env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://192.168.68.102:5173',
      "https://vibe-my-life-frontend-sigma.vercel.app",
      "https://jemzhang.com"
    ]

    // Allow Railway domains (*.up.railway.app)
    const isRailwayDomain = origin.endsWith('.up.railway.app')

    if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || isRailwayDomain) {
      callback(null, true)
    } else {
      // Reject without an error so the browser gets a clean CORS failure, not a 500
      callback(null, false)
    }
  },
  credentials: true,
}))
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Routes
app.use('/api/auth', authRouter)
app.use('/api/expenses', expenseRouter)
app.use('/api/metadata', metadataRouter)
app.use('/api/import', importRouter)

// Error handler (must be last)
app.use(errorHandler)
