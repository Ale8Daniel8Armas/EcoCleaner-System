import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [estado, setEstado] = useState('Comprobando...')

  useEffect(() => {
    supabase.auth.getSession().then(({ error }) =>
      setEstado(error ? 'Error de conexión' : 'Conectado a Supabase')
    )
  }, [])

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>EcoCleaner</h1>
      <p>{estado}</p>
    </main>
  )
}