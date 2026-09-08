'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const [businesses, setBusinesses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Estado para controlar qué sección está activa ('menu', 'create', 'view', 'metrics', 'billing')
  const [activeSection, setActiveSection] = useState<'menu' | 'create' | 'view' | 'metrics' | 'billing'>('menu')

  // Estado para alternar la vista en tarjetas de los negocios ('cards' o 'table')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

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
  const [editName, setEditName] = useState('')
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

  async function handleGenerateToken(businessId: string) {
    const { data, error } = await supabase.rpc('generate_secure_business_token', {
      p_business_id: businessId
    })

    if (error) {
      alert("Error al generar token: " + error.message)
    } else {
      alert(`Token generado con éxito: ${data}`)
      fetchBusinesses()
    }
  }

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

    if (!name || !ownerEmail || !password || !amount) {
      alert("Por favor completa los campos obligatorios principales.")
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

      const { error } = await supabase.rpc('create_business_safe', {
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
        p_phone: formattedPhone,
        p_logo_url: logoUrl
      })

      if (error) throw error

      alert("¡Negocio registrado con éxito con su logotipo!")
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
      setActiveSection('view')
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

      const formattedEditPhone = editPhone ? `502${editPhone.replace(/\D/g, '').slice(-8)}` : null

      const { error } = await supabase.rpc('update_business_details_safe', {
        p_business_id: selectedBusiness.id,
        p_name: editName || selectedBusiness.name,
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

      // ── NUEVA LÓGICA: Actualiza la contraseña si el campo no está vacío ──
      if (editPassword && editPassword.trim() !== '') {
        const { error: passError } = await supabase.rpc('update_business_password_safe', {
          p_business_id: selectedBusiness.id,
          p_new_password: editPassword.trim()
        })

        if (passError) throw passError
      }
      // ──────────────────────────────────────────────────────────────────

      alert("¡Suscripción, nombre y detalles actualizados con éxito!")
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

  const filteredBusinesses = businesses.filter(b => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return true
    const nameMatch = (b.name || '').toLowerCase().includes(term)
    const emailMatch = (b.owner_email || '').toLowerCase().includes(term)
    const phoneMatch = (b.phone || '').toLowerCase().includes(term)
    return nameMatch || emailMatch || phoneMatch
  })

  // Cálculos para el Dashboard de Métricas
  const totalMRR = businesses.reduce((acc, b) => {
    const amt = parseFloat(b.amount || 0);
    return acc + (b.billing_cycle === 'Anual' ? amt / 12 : amt);
  }, 0);
  const activeCount = businesses.filter(b => (!b.status || b.status === 'activo') && b.payment_status === 'Al día').length;
  const pendingCount = businesses.filter(b => b.payment_status === 'Pendiente' || b.payment_status === 'Atrasado' || b.status === 'suspendido').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">
        <p className="text-emerald-400 font-semibold text-lg">Verificando credenciales de acceso...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f172a] p-3 sm:p-6 text-white w-full max-w-full overflow-x-hidden notranslate" translate="no">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* CABECERA SUPERIOR LIMPIA */}
        <header className="bg-[#1e293b] shadow rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-center gap-4 border border-slate-700 w-full">
          <div>
            <h1 className="text-base sm:text-xl font-bold text-white leading-tight">
              Panel SaaS <span className="text-emerald-500">(Administrador General)</span>
            </h1>
            <p className="text-xs text-slate-400">Gestión centralizada de negocios y suscripciones</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {activeSection !== 'menu' && (
              <button 
                onClick={() => setActiveSection('menu')}
                className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow"
              >
                🏠 Menú Principal
              </button>
            )}
        
            <button 
              onClick={handleRunDatabaseCleanup}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors shadow"
            >
              🧹 Depurar BD
            </button>
            <button onClick={handleLogout} className="bg-red-600 text-white px-3 py-2 rounded-xl hover:bg-red-500 transition-colors font-semibold text-xs shadow">
              Salir
            </button>
          </div>
        </header>

        {/* VISTA 1: MENÚ PRINCIPAL CON 4 TARJETAS */}
        {activeSection === 'menu' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6">
            
            {/* TARJETA 1: DAR DE ALTA NUEVO NEGOCIO */}
            <div 
              onClick={() => setActiveSection('create')}
              className="bg-[#1e293b] hover:bg-[#253248] border-2 border-slate-700 hover:border-emerald-500 rounded-3xl p-6 sm:p-8 cursor-pointer transition-all duration-200 shadow-xl flex flex-col justify-between group select-none"
            >
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                  ✨
                </div>
                <h3 className="text-xl font-extrabold text-white group-hover:text-emerald-400 transition-colors">
                  Dar de Alta Nuevo Negocio
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Registra un nuevo negocio en el sistema, configura sus credenciales de administrador, asigna planes de suscripción y logotipo corporativo.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-between text-emerald-400 font-bold text-sm">
                <span>Registrar ahora</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

            {/* TARJETA 2: VISUALIZAR NEGOCIOS */}
            <div 
              onClick={() => setActiveSection('view')}
              className="bg-[#1e293b] hover:bg-[#253248] border-2 border-slate-700 hover:border-emerald-500 rounded-3xl p-6 sm:p-8 cursor-pointer transition-all duration-200 shadow-xl flex flex-col justify-between group select-none"
            >
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                  🏢
                </div>
                <h3 className="text-xl font-extrabold text-white group-hover:text-emerald-400 transition-colors">
                  Visualizar Negocios ({businesses.length})
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Consulta el listado completo de clientes, administra tokens de activación mensuales, revisa estados de pago y gestiona sucursales.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-between text-emerald-400 font-bold text-sm">
                <span>Ver listado</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

            {/* TARJETA 3: DASHBOARD Y MÉTRICAS */}
            <div 
              onClick={() => setActiveSection('metrics')}
              className="bg-[#1e293b] hover:bg-[#253248] border-2 border-slate-700 hover:border-emerald-500 rounded-3xl p-6 sm:p-8 cursor-pointer transition-all duration-200 shadow-xl flex flex-col justify-between group select-none"
            >
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                  📊
                </div>
                <h3 className="text-xl font-extrabold text-white group-hover:text-emerald-400 transition-colors">
                  Dashboard de Métricas
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Analiza el rendimiento financiero de tu plataforma SaaS, ingresos recurrentes estimados (MRR) y proporción de clientes activos.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-between text-emerald-400 font-bold text-sm">
                <span>Ver métricas</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

            {/* TARJETA 4: HISTORIAL DE PAGOS */}
            <div 
              onClick={() => setActiveSection('billing')}
              className="bg-[#1e293b] hover:bg-[#253248] border-2 border-slate-700 hover:border-emerald-500 rounded-3xl p-6 sm:p-8 cursor-pointer transition-all duration-200 shadow-xl flex flex-col justify-between group select-none"
            >
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                  💰
                </div>
                <h3 className="text-xl font-extrabold text-white group-hover:text-emerald-400 transition-colors">
                  Historial de Pagos y Facturación
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Supervisa los estados de cuenta de cada negocio, identifica cuentas pendientes o atrasadas y gestiona los ciclos de cobro.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-between text-emerald-400 font-bold text-sm">
                <span>Ver facturación</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

          </div>
        )}

        {/* VISTA 2: FORMULARIO "DAR DE ALTA NUEVO NEGOCIO" */}
        {activeSection === 'create' && (
          <div className="bg-[#1e293b] p-5 sm:p-6 rounded-2xl shadow-xl border border-slate-700 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-emerald-400 flex items-center gap-2">
                  ✨ Dar de Alta Nuevo Negocio
                </h2>
                <p className="text-xs text-slate-400">Ingresa los datos corporativos, credenciales y plan de suscripción inicial.</p>
              </div>
              <button 
                onClick={() => setActiveSection('menu')}
                className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
              >
                ✕ Cerrar
              </button>
            </div>
            
            <form onSubmit={handleCreateBusiness} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 pt-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Nombre del Negocio *</label>
                <input 
                  placeholder="Ej. Comedor La Bonita" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="bg-[#0f172a] border border-slate-600 p-3 rounded-xl text-white text-xs sm:text-sm placeholder:text-slate-500 outline-none focus:border-emerald-500 w-full" 
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Correo del Administrador *</label>
                <input 
                  type="email" 
                  placeholder="admin@negocio.com" 
                  value={ownerEmail} 
                  onChange={e => setOwnerEmail(e.target.value)} 
                  className="bg-[#0f172a] border border-slate-600 p-3 rounded-xl text-white text-xs sm:text-sm placeholder:text-slate-500 outline-none focus:border-emerald-500 w-full" 
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Contraseña Temporal *</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="bg-[#0f172a] border border-slate-600 p-3 rounded-xl text-white text-xs sm:text-sm placeholder:text-slate-500 outline-none focus:border-emerald-500 w-full" 
                  required
                />
              </div>
              
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">WhatsApp del Negocio</label>
                <div className="flex bg-[#0f172a] border border-slate-600 rounded-xl overflow-hidden focus-within:border-emerald-500">
                  <span className="bg-slate-800 text-slate-300 px-3 py-3 text-xs flex items-center border-r border-slate-600 font-semibold select-none">
                    +502
                  </span>
                  <input 
                    type="text" 
                    maxLength={8}
                    placeholder="12345678" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} 
                    className="w-full bg-transparent p-3 text-white text-xs sm:text-sm placeholder:text-slate-500 outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Plan de Suscripción</label>
                <select 
                  value={subscriptionPlan} 
                  onChange={e => setSubscriptionPlan(e.target.value)} 
                  className="bg-[#0f172a] border border-slate-600 p-3 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500 w-full"
                >
                  <option value="Básico">Plan Básico</option>
                  <option value="Profesional">Plan Profesional</option>
                  <option value="Empresarial">Plan Empresarial</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Monto de Suscripción (Q) *</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  className="bg-[#0f172a] border border-slate-600 p-3 rounded-xl text-white text-xs sm:text-sm placeholder:text-slate-500 outline-none focus:border-emerald-500 w-full" 
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Ciclo de Cobro</label>
                <select 
                  value={billingCycle} 
                  onChange={e => setBillingCycle(e.target.value)} 
                  className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500"
                >
                  <option value="Mensual">Mensual</option>
                  <option value="Anual">Anual</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Día de Cobro (1-31)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="31" 
                  value={paymentDay} 
                  onChange={e => setPaymentDay(parseInt(e.target.value) || 1)} 
                  className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500" 
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Fecha de Alta</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500" 
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Fecha de Finalización (Opcional)</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500" 
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Estado de Pago</label>
                <select 
                  value={paymentStatus} 
                  onChange={e => setPaymentStatus(e.target.value)} 
                  className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500"
                >
                  <option value="Al día">Al día</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Atrasado">Atrasado</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Logotipo Institucional (Opcional)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => setLogoFile(e.target.files?.[0] || null)} 
                  className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded-xl text-xs text-white file:mr-3 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer" 
                />
              </div>

              <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setActiveSection('menu')} className="bg-slate-700 text-white px-5 py-3 rounded-xl font-bold text-sm">Cancelar</button>
                <button type="submit" disabled={uploadingLogo} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-500 transition-colors shadow-lg text-sm disabled:opacity-50">
                  {uploadingLogo ? 'Registrando...' : '💾 Registrar Nuevo Negocio'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* VISTA 3: VISUALIZAR NEGOCIOS */}
        {activeSection === 'view' && (
          <div className="bg-[#1e293b] p-5 sm:p-6 rounded-2xl shadow-xl border border-slate-700 space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-700 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-emerald-400">
                  🏢 Visualizar Negocios Registrados ({filteredBusinesses.length})
                </h2>
                <p className="text-xs text-slate-400">Administra fichas de clientes, tokens de activación y estados de suscripción.</p>
              </div>

              {/* CONTROLES DE VISTA (CARDS VS TABLA) Y BÚSQUEDA */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="flex bg-[#0f172a] p-1 rounded-xl border border-slate-600">
                  <button 
                    onClick={() => setViewMode('cards')} 
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${viewMode === 'cards' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                    🗂️ Tarjetas
                  </button>
                  <button 
                    onClick={() => setViewMode('table')} 
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${viewMode === 'table' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                    📊 Tabla
                  </button>
                </div>

                <input 
                  type="text"
                  placeholder="🔍 Buscar por nombre, correo..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-[#0f172a] border border-slate-600 px-3.5 py-2 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500 placeholder-slate-500 w-full sm:w-64"
                />
              </div>
            </div>

            {/* VISTA EN TARJETAS (CARDS) */}
            {viewMode === 'cards' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[650px] overflow-y-auto pr-1">
                {filteredBusinesses.length === 0 ? (
                  <p className="col-span-full text-center py-12 text-slate-400 text-sm">No se encontraron negocios con ese criterio.</p>
                ) : (
                  filteredBusinesses.map(b => (
                    <div key={b.id} className="bg-[#0f172a] border border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-md hover:border-emerald-500/50 transition-all gap-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {b.logo_url ? (
                              <img src={b.logo_url} alt="Logo" className="w-12 h-12 object-contain bg-[#1e293b] rounded-xl p-1 border border-slate-600 shadow" />
                            ) : (
                              <div className="w-12 h-12 bg-[#1e293b] rounded-xl flex items-center justify-center text-[10px] text-slate-500 border border-slate-600">Logo</div>
                            )}
                            <div>
                              <h3 className="font-bold text-sm sm:text-base text-white">{b.name}</h3>
                              <p className="text-xs text-slate-400 truncate max-w-[180px] sm:max-w-[200px]">{b.owner_email}</p>
                            </div>
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            b.status === 'suspendido' ? 'bg-amber-900/80 text-amber-300 border border-amber-600/50' :
                            b.status === 'inactivo' ? 'bg-red-900/80 text-red-300 border border-red-600/50' :
                            'bg-emerald-900/80 text-emerald-300 border border-emerald-600/50'
                          }`}>
                            {b.status || 'ACTIVO'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-[#1e293b]/60 p-3 rounded-xl border border-slate-700/60">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Plan / Ciclo</span>
                            <strong className="text-white">{b.subscription_plan} ({b.billing_cycle || 'Mensual'})</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Monto</span>
                            <strong className="text-emerald-400" translate="no">Q {b.amount ?? 0}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Próximo Cobro</span>
                            <strong className="text-emerald-400">Día {b.payment_day ?? 1}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Sucursales</span>
                            <strong className="text-white">{b.branches_count ?? 0} activas</strong>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between items-center bg-[#1e293b] p-2 rounded-lg border border-slate-700">
                            <span className="text-slate-400 text-[11px]">Token Mensual:</span>
                            <code className="text-emerald-400 font-bold">{b.activation_token || 'N/A'}</code>
                          </div>
                          <div className="flex justify-between items-center text-[11px] px-1">
                            <span className="text-slate-400">WhatsApp:</span>
                            <span className="text-slate-200">{b.phone ? `+${b.phone}` : 'No registrado'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                        <button 
                          onClick={() => handleGenerateToken(b.id)}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-xs font-bold transition-colors shadow"
                        >
                          🔑 Token
                        </button>

                        {b.phone && b.activation_token && (
                          <button
                            type="button"
                            onClick={() => {
                              const phoneNum = b.phone.replace(/\D/g, '')
                              const msg = encodeURIComponent(
                                `Hola! Tu pago para el negocio *${b.name}* ha sido verificado con éxito. Tu token de activación para Quantika POS es: *${b.activation_token}*. Ingrésalo en la pantalla de inicio para habilitar tu acceso inmediato.`
                              )
                              window.open(`https://wa.me/${phoneNum}?text=${msg}`, '_blank')
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                            title="Enviar por WhatsApp"
                          >
                            💬
                          </button>
                        )}

                        <button 
                          onClick={() => {
                            setSelectedBusiness(b)
                            setEditName(b.name || '')
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
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-xl text-xs font-bold transition-colors border border-slate-600 shadow"
                        >
                          ⚙️ Gestionar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* VISTA EN TABLA CLÁSICA */
              <div className="max-h-[600px] overflow-y-auto w-full rounded-xl border border-slate-700">
                <table className="w-full text-left min-w-[950px] relative">
                  <thead className="bg-slate-700 text-slate-300 border-b border-slate-600 font-bold text-xs sticky top-0 z-10">
                    <tr>
                      <th className="p-3.5 bg-slate-700">Logo</th>
                      <th className="p-3.5 bg-slate-700">Negocio / WhatsApp</th>
                      <th className="p-3.5 bg-slate-700">Dueño</th>
                      <th className="p-3.5 bg-slate-700">Plan / Ciclo</th>
                      <th className="p-3.5 bg-slate-700">Monto</th>
                      <th className="p-3.5 bg-slate-700">Día Cobro</th>
                      <th className="p-3.5 bg-slate-700">Token Activo</th>
                      <th className="p-3.5 bg-slate-700">Pago</th>
                      <th className="p-3.5 bg-slate-700 text-center">Sucursales</th>
                      <th className="p-3.5 bg-slate-700">Estado</th>
                      <th className="p-3.5 bg-slate-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200 text-xs">
                    {filteredBusinesses.length === 0 ? (
                      <tr><td colSpan={11} className="p-6 text-center text-slate-400">No se encontraron negocios.</td></tr>
                    ) : (
                      filteredBusinesses.map((b) => (
                        <tr key={b.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                          <td className="p-3.5">
                            {b.logo_url ? (
                              <img src={b.logo_url} alt="Logo" className="w-9 h-9 object-contain bg-[#0f172a] rounded-lg p-1 border border-slate-600" />
                            ) : (
                              <div className="w-9 h-9 bg-[#0f172a] rounded-lg flex items-center justify-center text-[9px] text-slate-500 border border-slate-600">Logo</div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold">{b.name}</div>
                            <div className="text-[10px] text-slate-400">{b.phone ? `📱 +${b.phone}` : 'Sin WhatsApp'}</div>
                          </td>
                          <td className="p-3.5 text-slate-300">{b.owner_email}</td>
                          <td className="p-3.5">
                            <div>{b.subscription_plan}</div>
                            <span className="text-[10px] text-emerald-400 font-semibold">{b.billing_cycle || 'Mensual'}</span>
                          </td>
                          <td className="p-3.5" translate="no">Q {b.amount ?? 0}</td>
                          <td className="p-3.5 font-bold">Día {b.payment_day ?? 1}</td>
                          <td className="p-3.5">
                            <code className="bg-black/40 text-emerald-400 px-2 py-1 rounded font-bold text-xs">
                              {b.activation_token || 'N/A'}
                            </code>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.payment_status === 'Atrasado' ? 'bg-red-900 text-red-300' :
                              b.payment_status === 'Pendiente' ? 'bg-amber-900 text-amber-300' :
                              'bg-emerald-900 text-emerald-300'
                            }`}>
                              {b.payment_status || 'Al día'}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-bold text-emerald-400">
                            <span className="bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full text-xs">
                              {b.branches_count ?? 0}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.status === 'suspendido' ? 'bg-amber-900 text-amber-300' :
                              b.status === 'inactivo' ? 'bg-red-900 text-red-300' :
                              'bg-emerald-900 text-emerald-300'
                            }`}>
                              {b.status ? b.status.toUpperCase() : 'ACTIVO'}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="flex gap-1.5">
                              <button 
                                onClick={() => handleGenerateToken(b.id)}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap"
                              >
                                🔑 Token
                              </button>
                              <button 
                                onClick={() => {
                                  setSelectedBusiness(b)
                                  setEditName(b.name || '')
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
                                className="bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-1 rounded text-[11px] font-semibold transition-colors border border-slate-600 whitespace-nowrap"
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
            )}
          </div>
        )}

        {/* VISTA 4: DASHBOARD Y MÉTRICAS */}
        {activeSection === 'metrics' && (
          <div className="bg-[#1e293b] p-5 sm:p-6 rounded-2xl shadow-xl border border-slate-700 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-emerald-400">📊 Dashboard de Métricas y Estadísticas Globales</h2>
                <p className="text-xs text-slate-400">Resumen financiero y operational de tu plataforma SaaS.</p>
              </div>
              <button onClick={() => setActiveSection('menu')} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold">✕ Cerrar</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#0f172a] border border-slate-700 p-5 rounded-2xl shadow">
                <span className="text-slate-400 text-xs block mb-1">Ingresos Mensuales Est. (MRR)</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-400" translate="no">Q {totalMRR.toFixed(2)}</h3>
              </div>
              <div className="bg-[#0f172a] border border-slate-700 p-5 rounded-2xl shadow">
                <span className="text-slate-400 text-xs block mb-1">Negocios Activos (Al día)</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-blue-400">{activeCount}</h3>
              </div>
              <div className="bg-[#0f172a] border border-slate-700 p-5 rounded-2xl shadow">
                <span className="text-slate-400 text-xs block mb-1">Negocios con Pagos Pendientes / Atrasados</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-400">{pendingCount}</h3>
              </div>
            </div>

            <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-700 space-y-3">
              <h4 className="font-bold text-sm text-emerald-400">Distribución por Planes de Suscripción</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-[#1e293b] rounded-xl border border-slate-700">
                  <span className="text-slate-400 block">Plan Básico</span>
                  <strong className="text-base text-white">{businesses.filter(b => b.subscription_plan === 'Básico').length} negocios</strong>
                </div>
                <div className="p-3 bg-[#1e293b] rounded-xl border border-slate-700">
                  <span className="text-slate-400 block">Plan Profesional</span>
                  <strong className="text-base text-white">{businesses.filter(b => b.subscription_plan === 'Profesional').length} negocios</strong>
                </div>
                <div className="p-3 bg-[#1e293b] rounded-xl border border-slate-700">
                  <span className="text-slate-400 block">Plan Empresarial</span>
                  <strong className="text-base text-white">{businesses.filter(b => b.subscription_plan === 'Empresarial').length} negocios</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 5: HISTORIAL DE PAGOS Y FACTURACIÓN */}
        {activeSection === 'billing' && (
          <div className="bg-[#1e293b] p-5 sm:p-6 rounded-2xl shadow-xl border border-slate-700 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-emerald-400">💰 Historial de Pagos y Facturación de Clientes</h2>
                <p className="text-xs text-slate-400">Supervisa qué negocios están al día o pendientes de cobro.</p>
              </div>
              <button onClick={() => setActiveSection('menu')} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold">✕ Cerrar</button>
            </div>

            <div className="max-h-[600px] overflow-y-auto w-full rounded-xl border border-slate-700">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-700 text-slate-300 font-bold text-xs sticky top-0">
                  <tr>
                    <th className="p-3.5">Negocio</th>
                    <th className="p-3.5">Plan / Ciclo</th>
                    <th className="p-3.5">Monto Acordado</th>
                    <th className="p-3.5">Día de Cobro</th>
                    <th className="p-3.5">Estado de Pago</th>
                    <th className="p-3.5">Acción Rápida</th>
                  </tr>
                </thead>
                <tbody className="text-xs text-slate-200">
                  {businesses.map(b => (
                    <tr key={b.id} className="border-b border-slate-700 hover:bg-slate-700/40">
                      <td className="p-3.5 font-semibold">{b.name}</td>
                      <td className="p-3.5">{b.subscription_plan} ({b.billing_cycle || 'Mensual'})</td>
                      <td className="p-3.5 font-bold text-emerald-400" translate="no">Q {b.amount ?? 0}</td>
                      <td className="p-3.5">Día {b.payment_day ?? 1}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.payment_status === 'Atrasado' ? 'bg-red-900 text-red-300' :
                          b.payment_status === 'Pendiente' ? 'bg-amber-900 text-amber-300' :
                          'bg-emerald-900 text-emerald-300'
                        }`}>
                          {b.payment_status || 'Al día'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {b.phone && (
                          <button
                            onClick={() => {
                              const phoneNum = b.phone.replace(/\D/g, '')
                              const msg = encodeURIComponent(
                                `Hola ${b.name}, te saludamos de Quantika POS para recordarte que tu cuota de suscripción de Q${b.amount} se encuentra pendiente. ¡Gracias por tu puntualidad!`
                              )
                              window.open(`https://wa.me/${phoneNum}?text=${msg}`, '_blank')
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-[11px] font-bold transition-colors"
                          >
                            💬 Cobrar por WhatsApp
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* --- MODAL DE GESTIÓN Y EDICIÓN --- */}
      {selectedBusiness && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] p-5 sm:p-6 rounded-2xl border border-emerald-500 w-full max-w-lg text-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-emerald-400 truncate pr-2">⚙️ Gestionar: {selectedBusiness.name}</h3>
              <button onClick={() => setSelectedBusiness(null)} className="text-slate-400 hover:text-white font-bold text-base p-1">✕</button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <p className="text-slate-300"><strong className="text-white">Total Sucursales:</strong> <span className="text-emerald-400 font-bold">{selectedBusiness.branches_count ?? 0}</span></p>

              {/* TOKEN ACTUAL */}
              <div className="bg-[#0f172a] p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                <div>
                  <span className="text-slate-400 text-xs block">Token de Activación Actual:</span>
                  <strong className="text-emerald-400 text-base">{selectedBusiness.activation_token || 'Sin token'}</strong>
                </div>
                <button 
                  type="button"
                  onClick={() => handleGenerateToken(selectedBusiness.id)}
                  className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                >
                  🔄 Regenerar Token
                </button>
              </div>

              {/* INFORMACIÓN GENERAL Y CREDENCIALES */}
              <div className="border-t border-slate-700 pt-3 space-y-2">
                <h4 className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Datos, Credenciales y Contacto</h4>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-xs">Nombre del Negocio</label>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)} 
                    className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500" 
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-xs">Correo del Dueño</label>
                  <input 
                    type="email" 
                    value={editOwnerEmail} 
                    onChange={e => setEditOwnerEmail(e.target.value)} 
                    className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500" 
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-xs">WhatsApp del Negocio (+502)</label>
                  <div className="flex bg-[#0f172a] border border-slate-600 rounded-xl overflow-hidden focus-within:border-emerald-500">
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
                    className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500" 
                    placeholder="Dejar en blanco para no cambiar" 
                  />
                </div>
                
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-xs">Logotipo Institucional (Opcional)</label>
                  <div className="flex items-center gap-3">
                    {selectedBusiness.logo_url && (
                      <img src={selectedBusiness.logo_url} alt="Logo actual" className="w-10 h-10 object-contain bg-[#0f172a] rounded-xl p-1 border border-slate-600" />
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => setEditLogoFile(e.target.files?.[0] || null)} 
                      className="w-full bg-[#0f172a] border border-slate-600 p-2 rounded-xl text-xs text-white file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer" 
                    />
                  </div>
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
                      className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500"
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
                      className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500"
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
                      className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold text-xs">Estado de Pago</label>
                    <select 
                      value={editPaymentStatus} 
                      onChange={e => setEditPaymentStatus(e.target.value)} 
                      className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500"
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
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors shadow disabled:opacity-50"
              >
                {uploadingLogo ? 'Guardando...' : 'Guardar y Actualizar'}
              </button>
              <button 
                onClick={() => updateBusinessStatus(selectedBusiness.id, 'suspendido')}
                className="bg-amber-600 hover:bg-amber-500 px-4 py-3 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors shadow"
              >
                Suspender
              </button>
            </div>

            <button 
              onClick={() => setSelectedBusiness(null)} 
              className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors"
            >
              Cerrar Ventana
            </button>
          </div>
        </div>
      )}
    </div>
  )
}