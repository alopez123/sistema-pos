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
  const [phone, setPhone] = useState('')
  const [subscriptionPlan, setSubscriptionPlan] = useState('Básico')
  const [amount, setAmount] = useState('')
  const [paymentDay, setPaymentDay] = useState(1)
  const [billingCycle, setBillingCycle] = useState('Mensual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('Al día')
  const [logoFile, setLogoFile] = useState<File | null>(null)

  // Estados para el modal de gestión y edición
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null)
  const [editPlan, setEditPlan] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editPaymentDay, setEditPaymentDay] = useState(1)
  const [editBillingCycle, setEditBillingCycle] = useState('Mensual')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editPaymentStatus, setEditPaymentStatus] = useState('Al día')
  const [editOwnerEmail, setEditOwnerEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const router = useRouter()

  useEffect(() => {
    async function verifyAdminAndLoad() {
      const { data: { user } } = await supabase.auth.getUser()
      const localBiz = localStorage.getItem('currentBusiness')

      let isMaster = false
      if (localBiz) {
        try {
          const parsed = JSON.parse(localBiz)
          if (parsed.owner_email === 'alopezadmin@admin.com') isMaster = true
        } catch (e) {}
      }

      if ((!user || user.email !== 'alopezadmin@admin.com') && !isMaster) {
        alert("Acceso denegado: No tienes privilegios de Administrador Master[cite: 1].")
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
      console.error("Error al cargar negocios[cite: 1]:", error.message)
      return
    }

    if (data) {
      setBusinesses(data)
    }
  }

  async function handleGenerateToken(businessId: string) {
    const { data, error } = await supabase.rpc('generate_secure_business_token', {
      p_business_id: businessId
    })

    if (error) {
      alert("Error al generar token[cite: 1]: " + error.message)
    } else {
      alert(`Token generado con éxito: ${data}`)
      fetchBusinesses()
    }
  }

  // --- FUNCIÓN DE MANTENIMIENTO Y DEPURACIÓN ---
  const handleRunDatabaseCleanup = async () => {
    if (!confirm("¿Deseas depurar los registros operativos y bitácoras con más de 1 mes de antigüedad? Se respetarán las relaciones de las tablas.")) {
      return;
    }

    const { error } = await supabase.rpc('cleanup_old_operational_logs');

    if (error) {
      alert("Error al depurar la base de datos: " + error.message);
    } else {
      alert("¡Mantenimiento completado con éxito! Se han limpiado las tablas operativas y de bitácora antiguas, manteniendo intactas las ventas y compras.");
    }
  };

  const calculateNextBillingDate = (start: string, day: number, cycle: string) => {
    const baseDate = start ? new Date(start) : new Date();
    const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), day);
    
    if (targetDate < new Date()) {
      if (cycle === 'Anual') {
        targetDate.setFullYear(targetDate.getFullYear() + 1);
      } else {
        targetDate.setMonth(targetDate.getMonth() + 1);
      }
    }
    return targetDate.toISOString().split('T')[0];
  };

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
            else reject(new Error('Falló la compresión[cite: 1]'))
          }, 'image/jpeg', 0.8)
        }
        img.onerror = (error) => reject(error)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  async function handleCreateBusiness(e: React.FormEvent) {
    e.preventDefault()

    if (!name || !ownerEmail || !password || !amount) {
      alert("Por favor completa los campos obligatorios principales[cite: 1].")
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

      const formattedPhone = phone ? `502${phone}` : null

      const { data: newBizData, error } = await supabase.rpc('create_business_safe', {
        p_name: name,
        p_owner_email: ownerEmail,
        p_password: password,
        p_subscription_plan: subscriptionPlan,
        p_amount: parseFloat(amount) || 0,
        p_payment_day: paymentDay,
        p_billing_cycle: billingCycle,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_payment_status: paymentStatus,
        p_phone: formattedPhone
      })

      if (error) throw error

      if (logoUrl && newBizData) {
        await supabase
          .from('businesses')
          .update({ logo_url: logoUrl })
          .eq('id', newBizData)
      }

      alert("¡Negocio registrado con éxito[cite: 1]!")
      setName('')
      setOwnerEmail('')
      setPassword('')
      setPhone('')
      setAmount('')
      setPaymentDay(1)
      setStartDate('')
      setEndDate('')
      setBillingCycle('Mensual')
      setPaymentStatus('Al día')
      setLogoFile(null)
      fetchBusinesses()
    } catch (err: any) {
      alert("Error al registrar negocio[cite: 1]: " + err.message)
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
      alert("Error al actualizar estado[cite: 1]: " + error.message)
    } else {
      alert(`¡Suscripción actualizada a ${newStatus} con éxito[cite: 1]!`)
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

      const formattedEditPhone = editPhone ? `502${editPhone.replace(/\D/g, '').slice(-8)}` : null

      const { error } = await supabase.rpc('update_business_details_safe', {
        p_business_id: selectedBusiness.id,
        p_subscription_plan: editPlan || selectedBusiness.subscription_plan,
        p_amount: parseFloat(editAmount !== '' ? editAmount : selectedBusiness.amount) || 0,
        p_payment_day: editPaymentDay,
        p_status: 'activo',
        p_logo_url: updatedLogoUrl,
        p_new_email: editOwnerEmail || null,
        p_new_password: editPassword || null,
        p_billing_cycle: editBillingCycle,
        p_start_date: editStartDate || null,
        p_end_date: editEndDate || null,
        p_payment_status: editPaymentStatus,
        p_phone: formattedEditPhone
      })

      if (error) throw error

      alert("¡Suscripción, ciclo y detalles actualizados con éxito[cite: 1]!")
      setSelectedBusiness(null)
      setEditLogoFile(null)
      setEditPassword('')
      fetchBusinesses()
    } catch (err: any) {
      alert("Error al actualizar[cite: 1]: " + err.message)
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
        <p className="text-emerald-400 font-semibold text-lg">Verificando credenciales de acceso[cite: 1]...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 sm:p-8 text-white notranslate" translate="no">
      <div className="max-w-7xl mx-auto">
        
        {/* CABECERA */}
        <header className="bg-[#1e293b] shadow rounded-lg p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 border border-slate-700">
          <h1 className="text-xl sm:text-2xl font-bold text-white text-center sm:text-left">
            Panel de Control SaaS <span className="text-emerald-500 block sm:inline">(Master Admin)</span>
          </h1>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button onClick={() => router.push('/pos')} className="bg-slate-700 text-white px-4 py-2.5 rounded-lg hover:bg-slate-600 transition-colors font-semibold text-sm text-center">
              Ir a mi POS
            </button>
            <button 
              onClick={handleRunDatabaseCleanup}
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-colors shadow text-center"
            >
              🧹 Depurar Datos (&gt; 1 Mes)
            </button>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-500 transition-colors font-semibold text-sm text-center">
              Cerrar Sesión
            </button>
          </div>
        </header>

        {/* FORMULARIO PARA DAR DE ALTA NUEVO NEGOCIO */}
        <div className="bg-[#1e293b] p-4 sm:p-6 rounded-lg shadow mb-8 border border-slate-700">
          <h2 className="text-lg font-bold text-emerald-400 mb-4">Dar de alta nuevo negocio</h2>
          
          <form onSubmit={handleCreateBusiness} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
            
            {/* WHATSAPP CON +502 QUEMADO */}
            <div>
              <div className="flex bg-[#0f172a] border border-slate-600 rounded overflow-hidden focus-within:border-emerald-500">
                <span className="bg-slate-800 text-slate-300 px-3 py-3 text-sm flex items-center border-r border-slate-600 font-semibold select-none">
                  +502
                </span>
                <input 
                  type="text" 
                  maxLength={8}
                  placeholder="12345678" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} 
                  className="w-full bg-transparent p-3 text-white text-sm placeholder:text-slate-500 outline-none" 
                />
              </div>
            </div>

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
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Ciclo de Cobro</label>
              <select 
                value={billingCycle} 
                onChange={e => setBillingCycle(e.target.value)} 
                className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded text-white text-sm outline-none focus:border-emerald-500"
              >
                <option value="Mensual">Mensual</option>
                <option value="Anual">Anual</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Día de Cobro (1-31)</label>
              <input 
                type="number" 
                min="1" 
                max="31" 
                value={paymentDay} 
                onChange={e => setPaymentDay(parseInt(e.target.value) || 1)} 
                className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded text-white text-sm outline-none focus:border-emerald-500" 
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Fecha de Alta</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded text-white text-sm outline-none focus:border-emerald-500" 
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Fecha de Finalización (Opcional)</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded text-white text-sm outline-none focus:border-emerald-500" 
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Estado de Pago</label>
              <select 
                value={paymentStatus} 
                onChange={e => setPaymentStatus(e.target.value)} 
                className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded text-white text-sm outline-none focus:border-emerald-500"
              >
                <option value="Al día">Al día</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Atrasado">Atrasado</option>
              </select>
            </div>

            <div className="sm:col-span-2 md:col-span-3 lg:col-span-4">
              <label className="block text-xs text-slate-400 mb-1 font-semibold">Logotipo Institucional (Opcional)</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={e => setLogoFile(e.target.files?.[0] || null)} 
                className="w-full bg-[#0f172a] border border-slate-600 p-2 rounded text-xs text-white file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer" 
              />
            </div>

            <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 flex justify-end mt-2">
              <button type="submit" disabled={uploadingLogo} className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-emerald-500 transition-colors shadow-lg text-sm disabled:opacity-50">
                {uploadingLogo ? 'Guardando...' : 'Registrar Negocio'}
              </button>
            </div>
          </form>
        </div>

        {/* TABLA DE NEGOCIOS */}
        <div className="bg-[#1e293b] rounded-lg shadow border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[950px]">
              <thead className="bg-slate-700 text-slate-300 border-b border-slate-600 font-bold text-xs sm:text-sm">
                <tr>
                  <th className="p-4">Logo</th>
                  <th className="p-4">Negocio / WhatsApp</th>
                  <th className="p-4">Dueño</th>
                  <th className="p-4">Plan / Ciclo</th>
                  <th className="p-4">Monto</th>
                  <th className="p-4">Día / Próximo Cobro</th>
                  <th className="p-4">Token Activo</th>
                  <th className="p-4">Pago</th>
                  <th className="p-4 text-center">Sucursales</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-slate-200 text-xs sm:text-sm">
                {businesses.length === 0 ? (
                  <tr><td colSpan={11} className="p-6 text-center text-slate-400">No hay negocios registrados[cite: 1].</td></tr>
                ) : (
                  businesses.map((b) => (
                    <tr key={b.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                      <td className="p-4">
                        {b.logo_url ? (
                          <img src={b.logo_url} alt="Logo" className="w-10 h-10 object-contain bg-[#0f172a] rounded p-1 border border-slate-600" />
                        ) : (
                          <div className="w-10 h-10 bg-[#0f172a] rounded flex items-center justify-center text-[9px] text-slate-500 border border-slate-600">Sin logo[cite: 1]</div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold">{b.name}</div>
                        <div className="text-[11px] text-slate-400">{b.phone ? `📱 +${b.phone}` : 'Sin WhatsApp'}</div>
                      </td>
                      <td className="p-4 text-slate-300">{b.owner_email}</td>
                      <td className="p-4">
                        <div>{b.subscription_plan}</div>
                        <span className="text-[10px] text-emerald-400 font-semibold">{b.billing_cycle || 'Mensual'}</span>
                      </td>
                      <td className="p-4" translate="no">Q {b.amount ?? 0}</td>
                      <td className="p-4">
                        <span className="font-bold">Día {b.payment_day ?? 1}</span>
                        <div className="text-[10px] text-emerald-400">{calculateNextBillingDate(b.start_date, b.payment_day ?? 1, b.billing_cycle)}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-start">
                          <code className="bg-black/40 text-emerald-400 px-2 py-1 rounded font-bold text-xs">
                            {b.activation_token || 'N/A'}
                          </code>
                          {b.activation_token && (
                            <button
                              type="button"
                              onClick={() => {
                                const phoneNum = b.phone ? b.phone.replace(/\D/g, '') : ''
                                const msg = encodeURIComponent(
                                  `Hola! Tu pago para el negocio *${b.name}* ha sido verificado con éxito. Tu token de activación para Quantika POS es: *${b.activation_token}*. Ingrésalo en la pantalla de inicio para habilitar tu acceso inmediato.`
                                )
                                window.open(`https://wa.me/${phoneNum}?text=${msg}`, '_blank')
                              }}
                              className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1 transition-colors"
                            >
                              💬 Enviar por WhatsApp
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          b.payment_status === 'Atrasado' ? 'bg-red-900 text-red-300' :
                          b.payment_status === 'Pendiente' ? 'bg-amber-900 text-amber-300' :
                          'bg-emerald-900 text-emerald-300'
                        }`}>
                          {b.payment_status || 'Al día'}
                        </span>
                      </td>
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
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleGenerateToken(b.id)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap"
                            title="Generar token cifrado del mes"
                          >
                            🔑 Token
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedBusiness(b)
                              setEditPlan(b.subscription_plan || 'Básico')
                              setEditAmount(b.amount || '')
                              setEditPaymentDay(b.payment_day || 1)
                              setEditBillingCycle(b.billing_cycle || 'Mensual')
                              setEditStartDate(b.start_date || '')
                              setEditEndDate(b.end_date || '')
                              setEditPaymentStatus(b.payment_status || 'Al día')
                              setEditOwnerEmail(b.owner_email || '')
                              setEditPhone(b.phone ? b.phone.replace(/^502/, '') : '')
                              setEditPassword('')
                              setEditLogoFile(null)
                            }}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors border border-slate-600 whitespace-nowrap"
                          >
                            Gestionar
                          </button>
                        </div>
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
          <div className="bg-[#1e293b] p-5 sm:p-6 rounded-xl border border-emerald-500 w-full max-w-lg text-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-emerald-400 truncate pr-2">⚙️ Gestionar: {selectedBusiness.name}</h3>
              <button onClick={() => setSelectedBusiness(null)} className="text-slate-400 hover:text-white font-bold text-base p-1">✕</button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <p className="text-slate-300"><strong className="text-white">Total Sucursales[cite: 1]:</strong> <span className="text-emerald-400 font-bold">{selectedBusiness.branches_count ?? 0}</span></p>

              {/* TOKEN ACTUAL */}
              <div className="bg-[#0f172a] p-3 rounded-lg border border-slate-700 flex justify-between items-center">
                <div>
                  <span className="text-slate-400 text-xs block">Token de Activación Actual:</span>
                  <strong className="text-emerald-400 text-base">{selectedBusiness.activation_token || 'Sin token'}</strong>
                </div>
                <button 
                  type="button"
                  onClick={() => handleGenerateToken(selectedBusiness.id)}
                  className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded text-xs font-bold transition-colors"
                >
                  🔄 Regenerar Token
                </button>
              </div>

              {/* CREDENCIALES Y CONTACTO */}
              <div className="border-t border-slate-700 pt-3 space-y-2">
                <h4 className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Credenciales y Contacto[cite: 1]</h4>
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
                  <label className="block text-slate-400 mb-1 font-semibold text-xs">WhatsApp del Negocio (+502)</label>
                  <div className="flex bg-[#0f172a] border border-slate-600 rounded overflow-hidden focus-within:border-emerald-500">
                    <span className="bg-slate-800 text-slate-300 px-3 py-2 text-xs flex items-center border-r border-slate-600 font-semibold select-none">
                      +502
                    </span>
                    <input 
                      type="text" 
                      maxLength={8}
                      value={editPhone} 
                      onChange={e => setEditPhone(e.target.value.replace(/\D/g, ''))} 
                      className="w-full bg-transparent p-2.5 text-white text-xs sm:text-sm outline-none" 
                      placeholder="12345678"
                    />
                  </div>
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

              {/* PLAN Y FACTURACIÓN */}
              <div className="border-t border-slate-700 pt-3 space-y-3">
                <h4 className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Control de Suscripción y Pagos</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold text-xs">Plan de Suscripción</label>
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
                    <label className="block text-slate-400 mb-1 font-semibold text-xs">Ciclo de Cobro</label>
                    <select 
                      value={editBillingCycle} 
                      onChange={e => setEditBillingCycle(e.target.value)} 
                      className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-xs sm:text-sm outline-none focus:border-emerald-500"
                    >
                      <option value="Mensual">Mensual</option>
                      <option value="Anual">Anual</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold text-xs">Monto (Q)</label>
                    <input 
                      type="number" 
                      value={editAmount} 
                      onChange={e => setEditAmount(e.target.value)} 
                      className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-xs sm:text-sm outline-none focus:border-emerald-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold text-xs">Estado de Pago</label>
                    <select 
                      value={editPaymentStatus} 
                      onChange={e => setEditPaymentStatus(e.target.value)} 
                      className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-xs sm:text-sm outline-none focus:border-emerald-500"
                    >
                      <option value="Al día">Al día</option>
                      <option value="Pendiente">Pendiente</option>
                      <option value="Atrasado">Atrasado</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4 flex flex-col sm:flex-row gap-2">
              <button 
                onClick={handleSaveAndActivate}
                disabled={uploadingLogo}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors shadow disabled:opacity-50"
              >
                {uploadingLogo ? 'Guardando...' : 'Guardar y Actualizar'}
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