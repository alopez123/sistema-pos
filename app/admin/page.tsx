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
  const [logoFile, setLogoFile] = useState<File | null>(null)

  // Estados para el modal de gestión y edición
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null)
  const [editPlan, setEditPlan] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editBillingDate, setEditBillingDate] = useState('')
  const [editOwnerEmail, setEditOwnerEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

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

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 400
          const MAX_HEIGHT = 400
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Falló la compresión'))
          }, 'image/jpeg', 0.8)
        }
        img.onerror = (error) => reject(error)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  async function handleCreateBusiness(e: React.FormEvent) {
    e.preventDefault()

    if (!name || !ownerEmail || !password || !amount || !nextBillingDate) {
      alert("Por favor completa todos los campos obligatorios.")
      return
    }

    setUploadingLogo(true)
    try {
      let logoUrl = null

      if (logoFile) {
        const compressedBlob = await compressImage(logoFile)
        const fileName = `logo-${Date.now()}.jpg`
        const filePath = `logos/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, compressedBlob, { contentType: 'image/jpeg', upsert: true })

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('products')
          .getPublicUrl(filePath)

        logoUrl = publicUrlData.publicUrl
      }

      const { data: newBizData, error } = await supabase.rpc('create_business_safe', {
        p_name: name,
        p_owner_email: ownerEmail,
        p_password: password,
        p_subscription_plan: subscriptionPlan,
        p_amount: parseFloat(amount) || 0,
        p_next_billing_date: nextBillingDate
      })

      if (error) throw error

      if (logoUrl && newBizData) {
        await supabase
          .from('businesses')
          .update({ logo_url: logoUrl })
          .eq('id', newBizData)
      }

      alert("¡Negocio registrado con éxito!")
      setName('')
      setOwnerEmail('')
      setPassword('')
      setAmount('')
      setNextBillingDate('')
      setLogoFile(null)
      fetchBusinesses()
    } catch (err: any) {
      alert("Error al registrar negocio: " + err.message)
    } finally {
      setUploadingLogo(false)
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

    setUploadingLogo(true)
    try {
      let updatedLogoUrl = selectedBusiness.logo_url

      if (editLogoFile) {
        const compressedBlob = await compressImage(editLogoFile)
        const fileName = `logo-${selectedBusiness.id}-${Date.now()}.jpg`
        const filePath = `logos/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, compressedBlob, { contentType: 'image/jpeg', upsert: true })

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('products')
          .getPublicUrl(filePath)

        updatedLogoUrl = publicUrlData.publicUrl
      }

      const { error } = await supabase.rpc('update_business_details_safe', {
        p_business_id: selectedBusiness.id,
        p_subscription_plan: editPlan || selectedBusiness.subscription_plan,
        p_amount: parseFloat(editAmount !== '' ? editAmount : selectedBusiness.amount) || 0,
        p_next_billing_date: editBillingDate || selectedBusiness.next_billing_date,
        p_status: 'activo',
        p_logo_url: updatedLogoUrl,
        p_new_email: editOwnerEmail || null,
        p_new_password: editPassword || null
      })

      if (error) throw error

      alert("¡Credenciales, suscripción y detalles actualizados con éxito!")
      setSelectedBusiness(null)
      setEditLogoFile(null)
      setEditPassword('')
      fetchBusinesses()
    } catch (err: any) {
      alert("Error al actualizar: " + err.message)
    } finally {
      setUploadingLogo(false)
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

        {/* FORMULARIO PARA DAR DE ALTA NUEVO NEGOCIO */}
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

            <div className="sm:col-span-2 md:col-span-3">
              <label className="block text-xs text-slate-400 mb-1 font-semibold">Logotipo Institucional (Opcional)</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={e => setLogoFile(e.target.files?.[0] || null)} 
                className="w-full bg-[#0f172a] border border-slate-600 p-2 rounded text-xs text-white file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer" 
              />
            </div>

            <div className="sm:col-span-2 md:col-span-3 flex justify-end mt-2">
              <button type="submit" disabled={uploadingLogo} className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-emerald-500 transition-colors shadow-lg text-sm disabled:opacity-50">
                {uploadingLogo ? 'Guardando...' : 'Registrar Negocio'}
              </button>
            </div>
          </form>
        </div>

        {/* TABLA DE NEGOCIOS */}
        <div className="bg-[#1e293b] rounded-lg shadow border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[750px]">
              <thead className="bg-slate-700 text-slate-300 border-b border-slate-600 font-bold text-xs sm:text-sm">
                <tr>
                  <th className="p-4">Logo</th>
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
                  <tr><td colSpan={9} className="p-6 text-center text-slate-400">No hay negocios registrados.</td></tr>
                ) : (
                  businesses.map((b) => (
                    <tr key={b.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                      <td className="p-4">
                        {b.logo_url ? (
                          <img src={b.logo_url} alt="Logo" className="w-10 h-10 object-contain bg-[#0f172a] rounded p-1 border border-slate-600" />
                        ) : (
                          <div className="w-10 h-10 bg-[#0f172a] rounded flex items-center justify-center text-[9px] text-slate-500 border border-slate-600">Sin logo</div>
                        )}
                      </td>
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
                            setEditOwnerEmail(b.owner_email || '')
                            setEditPassword('')
                            setEditLogoFile(null)
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

      {/* --- MODAL DE GESTIÓN Y EDICIÓN --- */}
      {selectedBusiness && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] p-5 sm:p-6 rounded-xl border border-emerald-500 w-full max-w-md text-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-emerald-400 truncate pr-2">⚙️ Gestionar: {selectedBusiness.name}</h3>
              <button onClick={() => setSelectedBusiness(null)} className="text-slate-400 hover:text-white font-bold text-base p-1">✕</button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <p className="text-slate-300"><strong className="text-white">Total Sucursales:</strong> <span className="text-emerald-400 font-bold">{selectedBusiness.branches_count ?? 0}</span></p>

              {/* CAMPOS DE CREDENCIALES DEL DUEÑO */}
              <div className="border-t border-slate-700 pt-3 space-y-3">
                <h4 className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Credenciales de Acceso</h4>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-xs">Correo del Dueño</label>
                  <input 
                    type="email" 
                    value={editOwnerEmail} 
                    onChange={e => setEditOwnerEmail(e.target.value)} 
                    className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-xs sm:text-sm outline-none focus:border-emerald-500" 
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-xs">Nueva Contraseña (Opcional)</label>
                  <input 
                    type="password" 
                    value={editPassword} 
                    onChange={e => setEditPassword(e.target.value)} 
                    className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-xs sm:text-sm outline-none focus:border-emerald-500" 
                    placeholder="Dejar en blanco para no cambiar" 
                  />
                </div>
              </div>

              {/* Sección de Logo */}
              <div className="border-t border-slate-700 pt-3">
                <label className="block text-slate-400 mb-2 font-semibold text-xs">Logotipo del Negocio</label>
                <div className="flex items-center gap-3">
                  {selectedBusiness.logo_url ? (
                    <img src={selectedBusiness.logo_url} alt="Logo actual" className="w-16 h-16 object-contain bg-[#0f172a] rounded p-1 border border-slate-600" />
                  ) : (
                    <div className="w-16 h-16 bg-[#0f172a] rounded flex items-center justify-center text-[10px] text-slate-500 border border-slate-600">Sin logo</div>
                  )}
                  <div className="flex-1">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => setEditLogoFile(e.target.files?.[0] || null)} 
                      className="w-full bg-[#0f172a] border border-slate-600 p-1.5 rounded text-[11px] text-white file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-emerald-600 file:text-white cursor-pointer" 
                    />
                  </div>
                </div>
              </div>

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
                disabled={uploadingLogo}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors shadow disabled:opacity-50"
              >
                {uploadingLogo ? 'Guardando...' : 'Guardar y Activar'}
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