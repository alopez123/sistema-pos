'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Estados para el modal de recuperación de contraseña
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')

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

  // --- CONTACTAR POR WHATSAPP ---
  const handleWhatsAppSupport = () => {
    if (!recoveryEmail.trim()) {
      alert("Por favor ingresa tu correo o nombre del negocio primero.")
      return
    }
    const phoneNumber = "48069299" // Reemplaza con tu número de WhatsApp real con código de país (ej. Guatemala)
    const message = encodeURIComponent(`Hola Admin, necesito restablecer la contraseña de mi cuenta en Quantika POS. Mi correo/negocio es: ${recoveryEmail}`)
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank')
    setShowForgotModal(false)
    setRecoveryEmail('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-white text-3xl font-extrabold tracking-wide">Quantika <span className="text-emerald-500">POS</span></h1>
          <p className="text-slate-400 mt-2 text-sm">Sistema de gestión empresarial</p>
        </div>
        
        <form onSubmit={handleLogin} className="bg-[#1e293b] p-8 rounded-lg shadow-2xl border border-slate-700 space-y-6">
          <div>
            <label className="block text-slate-300 mb-2 text-sm font-medium">Usuario o Correo</label>
            <input 
              type="text" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-all" 
              placeholder="negocio-usuario o correo"
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

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">¿Problemas de acceso?</span>
            <button 
              type="button" 
              onClick={() => setShowForgotModal(true)}
              className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
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

        <div className="text-center mt-8 space-y-1">
          <p className="text-slate-500 text-xs">
            © 2026 Quantika POS - Acceso Restringido
          </p>
          <p className="text-emerald-400/80 text-[11px] font-semibold tracking-wider uppercase">
            Powered by CodeNexa Academy
          </p>
        </div>
      </div>

      {/* --- MODAL DE RECUPERACIÓN DE CONTRASEÑA --- */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] p-6 rounded-xl border border-emerald-500 w-full max-w-sm text-white shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-base font-bold text-emerald-400">🔑 Recuperar Acceso</h3>
              <button onClick={() => setShowForgotModal(false)} className="text-slate-400 hover:text-white font-bold text-lg p-1">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Ingresa tu correo o nombre del negocio para solicitar el restablecimiento de tu contraseña por WhatsApp:
            </p>

            <div>
              <input 
                type="text" 
                value={recoveryEmail}
                onChange={e => setRecoveryEmail(e.target.value)}
                placeholder="correo@negocio.com"
                className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded text-white text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-2">
              <button 
                type="button"
                onClick={handleWhatsAppSupport}
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg text-xs font-bold transition-colors shadow flex items-center justify-center gap-2"
              >
                💬 Solicitar por WhatsApp (Soporte)
              </button>
            </div>

            <button 
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full text-slate-400 hover:text-white py-1 text-xs transition-colors mt-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}