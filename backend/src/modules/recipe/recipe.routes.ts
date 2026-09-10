import { Router, type IRouter } from 'express'
import multer from 'multer'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { recipeController } from './recipe.controller.js'

// Photos are held in memory and never written to disk, the same as expense screenshots.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    // Qwen 3.8 accepts three images per request; more would be rejected by the model, so the
    // upload is capped where the ceiling actually is rather than one layer later.
    files: 3,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/heic']
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  },
})

export const recipeRouter: IRouter = Router()

recipeRouter.use(authMiddleware)

recipeRouter.get('/', recipeController.listRecipes)
recipeRouter.post('/', recipeController.createRecipe)

// Must precede `/:id` — Express matches in registration order, and this would otherwise
// read as a recipe whose id is "parse". Accepts photos, a block of text, or both; `upload`
// is what parses the multipart body, so `text` arrives as a field either way.
recipeRouter.post('/parse', upload.array('images', 3), recipeController.parseRecipe)

recipeRouter.get('/:id', recipeController.getRecipe)
recipeRouter.put('/:id', recipeController.updateRecipe)
recipeRouter.delete('/:id', recipeController.deleteRecipe)
