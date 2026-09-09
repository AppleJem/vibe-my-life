export interface LoginCredentials {
  username: string
  password: string
}

export interface JwtPayload {
  userId: string
  method: 'credentials' | 'passkey' | 'google'
}

export interface LoginResponse {
  token: string
}
