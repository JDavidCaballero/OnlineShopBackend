import express, { Request, Response } from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import bodyParser from 'body-parser'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import authenticateToken from './mdlwre/authenticateToken'

const app = express()
dotenv.config()

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET
if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new Error('Missing token secrets in .env')
}

const port = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(bodyParser.json())

// Conexión a MongoDB
mongoose
  .connect(process.env.MONGODB_URI as string, {})
  .then((): void => {
    console.log('Conectado a MongoDB...')
    // migrateCategories();
  })
  .catch((err: Error): void =>
    console.error('No se pudo conectar a MongoDB...', err)
  )

// Products
const productSchema = new mongoose.Schema({
  productID: String,
  nombre: String,
  descripcion: String,
  categoria: String,
  precio: Number
})

// User
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  refreshToken: { type: String }
})

const Product = mongoose.model('Product', productSchema)
const Categories = mongoose.model('Categories', productSchema)
const User = mongoose.model('users', userSchema)

// //Migrate data of one collection to other
// async function migrateCategories() {

//   try{

//     const categories = await Product.distinct("categoria");

//     const categoryDocs = categories.map((categoria) => ({categoria}));

//     await Categories.insertMany(categoryDocs, {ordered: false});

//     console.log("Categories migrated successfully");

//   }catch(err){
//     console.error(err);
//   }

// }

// Rutas
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find()
    res.status(200).send(products)
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ message: err.message })
    } else {
      res.status(500).json({ message: 'Unknown error occurred' })
    }
  }
})

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Categories.find()
    res.status(200).send(categories)
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).json({ message: err.message })
    } else {
      res.status(500).json({ message: 'Unknown error occurred' })
    }
  }
})

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string
    email: string
  }
}

interface UserInfoResponse {
  name: string
  email: string
  id: string
}

app.get(
  '/api/user/info',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.user?.userId)

      if (!user) {
        res.status(404).json({ message: 'User not found' })
        return
      }

      const userInfo: UserInfoResponse = {
        name: user.name ?? '',
        email: user.email ?? '',
        id: user._id.toString()
      }

      res.status(200).json(userInfo)
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'JsonWebTokenError') {
          res.status(401).json({ message: 'Invalid token.' })
          return
        } else if (err.name === 'TokenExpiredError') {
          res.status(401).json({ message: 'Token expired.' })
          return
        }

        res.status(500).json({ message: err.message })
      } else {
        res.status(500).json({ message: 'Unknown error occurred' })
      }
    }
  }
)

// Post
app.post('/api/products', async (req, res) => {
  const product = new Product({
    productID: req.body.productID,
    nombre: req.body.nombre,
    descripcion: req.body.descripcion,
    categoria: req.body.categoria,
    precio: req.body.precio
  })
  await product.save()
  res.send(product)
})

app.post('/api/users/register', async (req, res): Promise<void> => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10)

    const user = new User({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword
    })
    await user.save()
    res
      .status(201)
      .send({ userCreated: user, message: 'User created successfully' })
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as any).code === 11000
    ) {
      res.status(400).json({ message: 'User already exists' })
      return
    }

    if (err instanceof Error) {
      res.status(500).json({ message: err.message })
    } else {
      res.status(500).json({ message: 'Unknown error occurred' })
    }
  }
})

app.post('/api/users/login', async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body

    // Find the user by email
    const user = await User.findOne({ email: req.body.email })
    if (!user) {
      res.status(400).send({ message: 'User not found' })
      return
    }

    if (!email || !password) {
      res.status(400).send({ message: 'Email and password are required' })
      return
    }

    if (!user.password || typeof user.password !== 'string') {
      res.status(500).send({ message: 'User password is not set correctly.' })
      return
    }

    // Check if the password is correct
    const isMatch = await bcrypt.compare(req.body.password, user.password)
    if (!isMatch) {
      res.status(400).send({ message: 'Invalid credentials' })
      return
    }

    const accessToken = jwt.sign(
      { userId: user._id, email: user.email },
      ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    )

    const refreshToken = jwt.sign(
      { userId: user._id, email: user.email },
      REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    )

    user.refreshToken = refreshToken
    await user.save()

    // Return the user object and token
    res.send({
      user: {
        name: user.name,
        email: user.email,
        id: user._id,
        accessToken,
        refreshToken
      }
    })
  } catch (error) {
    console.error('Error during login:', error)
    res.status(500).send({ message: 'Internal server error' })
  }
})

app.post('/api/users/refresh', async (req, res): Promise<void> => {
  const { refreshToken } = req.body

  if (!refreshToken) {
    res.status(401).send({ message: 'Refresh token missing' })
    return
  }

  try {
    const payload = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET!
    ) as { userId: string; email: string }

    const user = await User.findById(payload.userId)
    if (!user || user.refreshToken !== refreshToken) {
      res.status(403).send({ message: 'Invalid refresh token' })
      return
    }

    const newAccessToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: '15m' }
    )

    res.send({
      accessToken: newAccessToken
    })
  } catch (err) {
    console.error('Refresh token error:', err)
    res.status(403).send({ message: 'Invalid or expired refresh token' })
  }
})

app.post('/api/users/logout', async (req, res): Promise<void> => {
  const { refreshToken } = req.body

  if (!refreshToken) {
    res.status(400).send({ message: 'Refresh token missing' })
    return
  }

  try {
    const user = await User.findOne({ refreshToken })

    if (!user) {
      res.status(204).send()
      return
    }
    user.refreshToken = ''
    await user.save()

    res.status(200).send({ message: 'Logged out successfully' })
  } catch (err) {
    console.error('Logout error:', err)
    res.status(500).send({ message: 'Internal server error' })
  }
})

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}...`)
})
