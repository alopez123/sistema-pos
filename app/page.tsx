'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Intentar validar primero como Dueño o Administrador
      const { data, error } = await supabase
        .rpc('verify_business_login', { 
          p_email: email, 
          p_password: password 
        })

      if (!error && data && data.length > 0) {
        const userAccount = data[0]

        // Verificación de estado de cuenta del negocio (Dueño)
        const status = (userAccount.status || 'activo').toLowerCase();
        if (status !== 'activo') {
          alert('Esta cuenta se encuentra ' + status + '. Contacte al soporte.')
          setLoading(false)
          return
        }

        // Guardar contexto en sesión local del Dueño
        localStorage.removeItem('currentStaff')
        localStorage.setItem('currentBusiness', JSON.stringify(userAccount))

        // Redirección inteligente
        if (userAccount.owner_email === 'alopezadmin@admin.com') {
          router.push('/admin')
        } else {
          router.push('/dashboard')
        }
        return
      }

      // 2. SI NO ES DUEÑO, verificar si es un empleado (vendedor o cajero)
      const { data: staffData, error: staffError } = await supabase
        .rpc('verify_staff_login', {
          p_username: email.trim().toLowerCase(),
          p_access_code: password.trim()
        })

      if (staffError || !staffData || staffData.length === 0) {
        alert('Usuario, correo o contraseña incorrectos.')
        setLoading(false)
        return
      }

      const staff = staffData[0]
      
      // --- LECTURA LIMPIA Y SEGURA DEL ROL ---
      const userRole = (staff.role || 'vendedor').trim().toLowerCase();

      // --- VALIDACIÓN DE ESTADO DEL NEGOCIO PARA EMPLEADOS ---
      const { data: bizData } = await supabase
        .from('businesses')
        .select('status')
        .eq('id', staff.business_id)
        .single()

      const bizStatus = (bizData?.status || 'activo').toLowerCase();
      if (bizStatus !== 'activo') {
        alert('Acceso denegado: El negocio se encuentra ' + bizStatus + '. Contacte al administrador.')
        setLoading(false)
        return
      }

      // Buscar el nombre de la sucursal para guardarlo en la sesión
      const { data: branchData } = await supabase
        .from('branches')
        .select('name')
        .eq('id', staff.branch_id)
        .single()

      // Guardar sesión del empleado, su sucursal fija y su ROL corregido
      localStorage.removeItem('currentBusiness')
      localStorage.setItem('currentStaff', JSON.stringify({
        id: staff.id,
        name: staff.name,
        username: staff.username || staff.email,
        branch_id: staff.branch_id,
        business_id: staff.business_id,
        branch_name: branchData?.name || 'Sucursal',
        role: userRole // Guardamos el rol normalizado
      }))

      // REDIRECCIÓN INTELIGENTE SEGÚN EL ROL
      if (userRole === 'cajero') {
        router.push('/cajero') // Envía directo a la pantalla exclusiva de caja
      } else {
        router.push('/pos') // Envía al POS normal de toma de pedidos
      }

    } catch (err) {
      console.error("Error inesperado:", err)
      alert("Ocurrió un error al intentar ingresar.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-white text-4xl font-bold">POS <span className="text-emerald-500">SaaS</span></h1>
          <p className="text-slate-400 mt-2">Acceso a sistema de gestión</p>
        </div>
        
        <form onSubmit={handleLogin} className="bg-[#1e293b] p-8 rounded-lg shadow-2xl border border-slate-700 space-y-6">
          <div>
            <label className="block text-slate-300 mb-2 text-sm font-medium">Usuario o Correo</label>
            <input 
              type="text" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-all" 
              placeholder="comedor-nancyoliva o correo"
              required
            />
          </div>
          
          <div>
            <label className="block text-slate-300 mb-2 text-sm font-medium">Contraseña / Código de Acceso</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded text-white outline-none focus:border-emerald-500 transition-all" 
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full py-3 rounded font-bold transition-all shadow-lg ${
              loading ? 'bg-emerald-800 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-[1.02]'
            }`}
          >
            {loading ? 'Validando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-xs mt-8">
          © 2026 Sistema POS SaaS - Acceso Restringido
        </p>
      </div>
    </div>
  )
}