import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string }
}

const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization
  const token = authHeader?.split(' ')[1] // Bearer TOKEN

  if (!token) {
    res.status(401).json({ message: 'Access denied. No token provided.' })
    return
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as {
      userId: string
      email: string
    }

    req.user = decoded
    next()
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ message: 'Token expired' })
    } else {
      res.status(401).json({ message: 'Invalid token' })
    }
  }
}

export default authenticateToken
