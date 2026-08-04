import 'dotenv/config'
import { env } from './config/env.js'
import { app } from './server.js'

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`)
})
