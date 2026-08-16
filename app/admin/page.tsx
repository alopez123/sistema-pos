'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const [businesses, setBusinesses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Estados para el formulario de nuevo negocio
  const [name, setName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [password, setPassword] = useState('')
  const [subscriptionPlan, setSubscriptionPlan] = useState('Básico')
  const [amount, setAmount] = useState('')
  const [nextBillingDate, setNextBillingDate] = useState('')

  // Estados para el modal de gestión y edición
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null)
  const [editPlan, setEditPlan] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editBillingDate, setEditBillingDate] = useState('')

  const router = useRouter()

  useEffect(() => {
    async function verifyAdminAndLoad() {
      const { data: { user } } = await supabase.auth.getUser()
      const localBiz = localStorage.getItem('currentBusiness')

      if ((!user || user.email !== 'alopezadmin@admin.com') && !localBiz) {
        alert("Acceso denegado: No tienes privilegios de Administrador Master.")
        router.push('/pos') 
        return
      }

      setLoading(false)
      fetchBusinesses()
    }

    verifyAdminAndLoad()
  }, [router])

  async function fetchBusinesses() {
    const { data, error } = await supabase.rpc('get_all_businesses_safe')

    if (error) {
      console.error("Error al cargar negocios:", error.message)
      return
    }

    if (data) {
      setBusinesses(data)
    }
  }

  async function handleCreateBusiness(e: React.FormEvent) {
    e.preventDefault()

    if (!name || !ownerEmail || !password || !amount || !nextBillingDate) {
      alert("Por favor completa todos los campos, incluyendo la contraseña.")
      return
    }

    const { error } = await supabase.rpc('create_business_safe', {
      p_name: name,
      p_owner_email: ownerEmail,
      p_password: password,
      p_subscription_plan: subscriptionPlan,
      p_amount: parseFloat(amount) || 0,
      p_next_billing_date: nextBillingDate
    })

    if (error) {
      alert("Error al registrar negocio: " + error.message)
    } else {
      alert("¡Negocio registrado con éxito!")
      setName('')
      setOwnerEmail('')
      setPassword('')
      setAmount('')
      setNextBillingDate('')
      fetchBusinesses()
    }
  }

  async function updateBusinessStatus(businessId: string, newStatus: string) {
    const { error } = await supabase.rpc('update_business_status_safe', {
      p_business_id: businessId,
      p_status: newStatus
    })

    if (error) {
      alert("Error al actualizar estado: " + error.message)
    } else {
      alert(`¡Suscripción actualizada a ${newStatus} con éxito!`)
      setSelectedBusiness(null)
      fetchBusinesses()
    }
  }

  async function handleSaveAndActivate() {
    if (!selectedBusiness) return

    const { error } = await supabase.rpc('update_business_details_safe', {
      p_business_id: selectedBusiness.id,
      p_subscription_plan: editPlan || selectedBusiness.subscription_plan,
      p_amount: parseFloat(editAmount !== '' ? editAmount : selectedBusiness.amount) || 0,
      p_next_billing_date: editBillingDate || selectedBusiness.next_billing_date,
      p_status: 'activo'
    })

    if (error) {
      alert("Error al actualizar y activar: " + error.message)
    } else {
      alert("¡Suscripción actualizada y reactivada con éxito!")
      setSelectedBusiness(null)
      fetchBusinesses()
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('currentBusiness')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">
        <p className="text-emerald-400 font-semibold text-lg">Verificando credenciales de acceso...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 sm:p-8 text-white notranslate" translate="no">
      <div className="max-w-6xl mx-auto">
        
        {/* CABECERA RESPONSIVE */}
        <header className="bg-[#1e293b] shadow rounded-lg p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 border border-slate-700">
          <h1 className="text-xl sm:text-2xl font-bold text-white text-center sm:text-left">
            Panel de Control SaaS <span className="text-emerald-500 block sm:inline">(Master Admin)</span>
          </h1>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button onClick={() => router.push('/pos')} className="bg-slate-700 text-white px-4 py-2.5 rounded-lg hover:bg-slate-600 transition-colors font-semibold text-sm text-center">
              Ir a mi POS
            </button>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-500 transition-colors font-semibold text-sm text-center">
              Cerrar Sesión
            </button>
          </div>
        </header>

        {/* FORMULARIO PARA DAR DE ALTA NUEVO NEGOCIO RESPONSIVE */}
        <div className="bg-[#1e293b] p-4 sm:p-6 rounded-lg shadow mb-8 border border-slate-700">
          <h2 className="text-lg font-bold text-emerald-400 mb-4">Dar de alta nuevo negocio</h2>
          
          <form onSubmit={handleCreateBusiness} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <input 
              placeholder="Nombre del Negocio" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="bg-[#0f172a] border border-slate-600 p-3 rounded text-white text-sm placeholder:text-slate-500 outline-none focus:border-emerald-500 w-full" 
              required
            />
            <input 
              type="email" 
              placeholder="Correo del Administrador" 
              value={ownerEmail} 
              onChange={e => setOwnerEmail(e.target.value)} 
              className="bg-[#0f172a] border border-slate-600 p-3 rounded text-white text-sm placeholder:text-slate-500 outline-none focus:border-emerald-500 w-full" 
              required
            />
            <input 
              type="password" 
              placeholder="Contraseña Temporal" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="bg-[#0f172a] border border-slate-600 p-3 rounded text-white text-sm placeholder:text-slate-500 outline-none focus:border-emerald-500 w-full" 
              required
            />
            <select 
              value={subscriptionPlan} 
              onChange={e => setSubscriptionPlan(e.target.value)} 
              className="bg-[#0f172a] border border-slate-600 p-3 rounded text-white text-sm outline-none focus:border-emerald-500 w-full"
            >
              <option value="Básico">Plan Básico</option>
              <option value="Profesional">Plan Profesional</option>
              <option value="Empresarial">Plan Empresarial</option>
            </select>
            <input 
              type="number" 
              placeholder="Monto de Suscripción (Q)" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              className="bg-[#0f172a] border border-slate-600 p-3 rounded text-white text-sm placeholder:text-slate-500 outline-none focus:border-emerald-500 w-full" 
              required
            />
            <input 
              type="date" 
              value={nextBillingDate} 
              onChange={e => setNextBillingDate(e.target.value)} 
              className="bg-[#0f172a] border border-slate-600 p-3 rounded text-white text-sm outline-none focus:border-emerald-500 w-full" 
              required
            />
            <div className="sm:col-span-2 md:col-span-3 flex justify-end mt-2">
              <button type="submit" className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-emerald-500 transition-colors shadow-lg text-sm">
                Registrar Negocio
              </button>
            </div>
          </form>
        </div>

        {/* TABLA DE NEGOCIOS CON SCROLL HORIZONTAL RESPONSIVE */}
        <div className="bg-[#1e293b] rounded-lg shadow border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[750px]">
              <thead className="bg-slate-700 text-slate-300 border-b border-slate-600 font-bold text-xs sm:text-sm">
                <tr>
                  <th className="p-4">Negocio</th>
                  <th className="p-4">Dueño</th>
                  <th className="p-4">Plan</th>
                  <th className="p-4">Monto</th>
                  <th className="p-4">Próximo Cobro</th>
                  <th className="p-4 text-center">Sucursales</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-slate-200 text-xs sm:text-sm">
                {businesses.length === 0 ? (
                  <tr><td colSpan={8} className="p-6 text-center text-slate-400">No hay negocios registrados.</td></tr>
                ) : (
                  businesses.map((b) => (
                    <tr key={b.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                      <td className="p-4 font-semibold">{b.name}</td>
                      <td className="p-4 text-slate-300">{b.owner_email}</td>
                      <td className="p-4">{b.subscription_plan}</td>
                      <td className="p-4" translate="no">Q {b.amount ?? 0}</td>
                      <td className="p-4">{b.next_billing_date ?? 'N/A'}</td>
                      <td className="p-4 text-center font-bold text-emerald-400">
                        <span className="bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs">
                          {b.branches_count ?? 0}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                          b.status === 'suspendido' ? 'bg-amber-900 text-amber-300' :
                          b.status === 'inactivo' ? 'bg-red-900 text-red-300' :
                          'bg-emerald-900 text-emerald-300'
                        }`}>
                          {b.status ? b.status.toUpperCase() : 'ACTIVO'}
                        </span>
                      </td>
                      <td className="p-4">
                        <button 
                          onClick={() => {
                            setSelectedBusiness(b)
                            setEditPlan(b.subscription_plan || 'Básico')
                            setEditAmount(b.amount || '')
                            setEditBillingDate(b.next_billing_date || '')
                          }}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors border border-slate-600 whitespace-nowrap"
                        >
                          Gestionar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- MODAL DE GESTIÓN Y EDICIÓN RESPONSIVE --- */}
      {selectedBusiness && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] p-5 sm:p-6 rounded-xl border border-emerald-500 w-full max-w-md text-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-emerald-400 truncate pr-2">⚙️ Gestionar: {selectedBusiness.name}</h3>
              <button onClick={() => setSelectedBusiness(null)} className="text-slate-400 hover:text-white font-bold text-base p-1">✕</button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <p className="text-slate-300 truncate"><strong className="text-white">Dueño:</strong> {selectedBusiness.owner_email}</p>
              <p className="text-slate-300"><strong className="text-white">Total Sucursales:</strong> <span className="text-emerald-400 font-bold">{selectedBusiness.branches_count ?? 0}</span></p>
              <p className="text-slate-300"><strong className="text-white">Estado actual:</strong> <span className="text-amber-400 font-bold uppercase">{selectedBusiness.status || 'activo'}</span></p>

              <div className="border-t border-slate-700 pt-3 space-y-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-xs">Actualizar Plan de Suscripción</label>
                  <select 
                    value={editPlan} 
                    onChange={e => setEditPlan(e.target.value)} 
                    className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-xs sm:text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="Básico">Plan Básico</option>
                    <option value="Profesional">Plan Profesional</option>
                    <option value="Empresarial">Plan Empresarial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-xs">Confirmar Monto (Q)</label>
                  <input 
                    type="number" 
                    value={editAmount} 
                    onChange={e => setEditAmount(e.target.value)} 
                    className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-xs sm:text-sm outline-none focus:border-emerald-500" 
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-xs">Nueva Fecha de Próximo Cobro</label>
                  <input 
                    type="date" 
                    value={editBillingDate} 
                    onChange={e => setEditBillingDate(e.target.value)} 
                    className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-xs sm:text-sm outline-none focus:border-emerald-500" 
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4 flex flex-col sm:flex-row gap-2">
              <button 
                onClick={handleSaveAndActivate}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors shadow"
              >
                Guardar y Activar
              </button>
              <button 
                onClick={() => updateBusinessStatus(selectedBusiness.id, 'suspendido')}
                className="bg-amber-600 hover:bg-amber-500 px-4 py-3 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors shadow"
              >
                Suspender
              </button>
            </div>

            <button 
              onClick={() => setSelectedBusiness(null)} 
              className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-colors"
            >
              Cerrar Ventana
            </button>
          </div>
        </div>
      )}
    </div>
  )
}