import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { authRouter } from './modules/auth/auth.routes.js'
import { expenseRouter } from './modules/expense/expense.routes.js'
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
      env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
    ]
    
    if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
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

// Error handler (must be last)
app.use(errorHandler)
