'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function ClientesReportesPage() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState<string>('')
  const [reportData, setReportData] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  // Estado para el Tema (Modo Oscuro / Modo Claro Local)
  const [isDarkMode, setIsDarkMode] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem('clients_theme')
    if (savedTheme === 'light') {
      setIsDarkMode(false)
    }
  }, [])

  const toggleTheme = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('clients_theme', newMode ? 'dark' : 'light')
  }

  const [selectedClient, setSelectedClient] = useState<any | null>(null)
  
  // Estados para el Modal de Edición de Cliente
  const [editingClient, setEditingClient] = useState<any | null>(null)
  const [editName, setEditName] = useState('')
  const [editNit, setEditNit] = useState('')
  const [editDpi, setEditDpi] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    try {
      const staffDataStr = localStorage.getItem('currentStaff')
      const bizStr = localStorage.getItem('currentBusiness')

      let bId = ''
      if (staffDataStr) {
        const staff = JSON.parse(staffDataStr)
        bId = staff.business_id || ''
      } else if (bizStr) {
        const biz = JSON.parse(bizStr)
        bId = biz.id || biz.business_id || ''
      }

      if (bId) {
        setBusinessId(bId)
        loadCustomerTopProducts(bId)
      } else {
        setLoading(false)
      }
    } catch (e) {
      console.error("Error al leer sesión:", e)
      setLoading(false)
    }
  }, [])

  const loadCustomerTopProducts = async (bId: string) => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_customer_top_products', {
      p_business_id: bId
    })

    if (error) {
      console.error("Error al cargar reporte de clientes:", error.message)
    } else if (data) {
      setReportData(data)
    }
    setLoading(false)
  }

  const handleOpenEdit = (client: any, e: React.MouseEvent) => {
    e.stopPropagation() // Evita que se abra el modal de artículos al hacer clic en Editar
    setEditingClient(client)
    setEditName(client.customer_name || '')
    setEditNit(client.customer_nit || '')
    setEditDpi(client.customer_dpi === 'No registrado' ? '' : (client.customer_dpi || ''))
    setEditPhone(client.customer_phone === 'No registrado' ? '' : (client.customer_phone || ''))
    setEditEmail(client.customer_email === 'No registrado' ? '' : (client.customer_email || ''))
    setEditAddress(client.customer_address === 'No registrada' ? '' : (client.customer_address || ''))
  }

  const handleSaveCustomerEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClient || !editingClient.customer_id) return

    setIsUpdating(true)
    const { error } = await supabase
      .from('customers')
      .update({
        name: editName.trim(),
        nit: editNit.trim() || 'CF',
        dpi: editDpi.trim() || null,
        phone: editPhone.trim() || null,
        email: editEmail.trim() || null,
        address: editAddress.trim() || null
      })
      .eq('id', editingClient.customer_id)

    setIsUpdating(false)

    if (error) {
      alert("Error al actualizar cliente: " + error.message)
    } else {
      alert("✅ ¡Datos del cliente actualizados con éxito!")
      setEditingClient(null)
      if (businessId) loadCustomerTopProducts(businessId)
    }
  }

  const groupedByCustomer = reportData.reduce((acc: any, row: any) => {
    if (!acc[row.customer_id]) {
      acc[row.customer_id] = {
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        customer_nit: row.customer_nit,
        customer_dpi: row.customer_dpi || 'No registrado',
        customer_phone: row.customer_phone || 'No registrado',
        customer_email: row.customer_email || 'No registrado',
        customer_address: row.customer_address || 'No registrada',
        total_spent_general: 0,
        products: []
      }
    }
    return acc
  }, {})

  const customersArray = Object.values(groupedByCustomer).filter((c: any) => 
    c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.customer_nit.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customer_dpi.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Clases dinámicas según el tema (Modo Oscuro vs Modo Claro)
  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-6 flex flex-col w-full px-6 notranslate ${themeBg}`} translate="no">
      <header className={`p-4 rounded-lg shadow mb-6 flex justify-between items-center border w-full ${panelBg}`}>
        <h1 className="text-xl font-bold text-emerald-500 flex items-center gap-2">
          👥 Directorio de Clientes
        </h1>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className={`px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors border ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-amber-300 border-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'}`}
          >
            {isDarkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
          </button>

          <button 
            onClick={() => router.push('/pos')}
            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-semibold transition-colors text-white"
          >
            ← Volver al POS
          </button>
        </div>
      </header>

      <div className={`p-6 rounded-lg shadow border flex-1 flex flex-col gap-4 ${panelBg}`}>
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <input 
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="🔍 Buscar cliente por nombre, NIT o DPI..."
            className={`w-full md:w-96 border px-4 py-2.5 rounded-lg text-sm outline-none focus:border-emerald-500 ${inputBg}`}
          />
          <button 
            onClick={() => businessId && loadCustomerTopProducts(businessId)}
            className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors text-white"
          >
            🔄 Actualizar Datos
          </button>
        </div>

        {loading ? (
          <p className="text-center opacity-75 py-20">Cargando directorio de clientes...</p>
        ) : customersArray.length === 0 ? (
          <p className="text-center opacity-75 py-20">No se encontraron clientes registrados.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto max-h-[68vh] pr-2">
            {customersArray.map((client: any, idx: number) => (
              <div 
                key={idx} 
                className={`border rounded-lg p-4 flex flex-col justify-between shadow transition-all group ${subPanelBg}`}
              >
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start">
                    <h2 className="font-bold text-sm text-emerald-500 line-clamp-1">{client.customer_name}</h2>
                    <div className="flex gap-1">
                      <button 
                        onClick={(e) => handleOpenEdit(client, e)}
                        className="text-[10px] bg-sky-500/25 text-sky-400 font-semibold px-2 py-0.5 rounded hover:bg-sky-500/40"
                        title="Editar cliente"
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  </div>
                  <p className="text-xs opacity-75">NIT: <span className="text-emerald-500 font-mono font-semibold">{client.customer_nit}</span></p>
                  <p className="text-xs opacity-75">DPI: <span className="font-mono">{client.customer_dpi}</span></p>
                  <p className="text-[11px] opacity-85">📞 {client.customer_phone}</p>
                  <p className="text-[11px] opacity-85 truncate">✉️ {client.customer_email}</p>
                  <p className="text-[11px] opacity-85 truncate">📍 {client.customer_address}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- MODAL PARA EDITAR CLIENTE --- */}
      {editingClient !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`p-6 rounded-xl border border-sky-500 w-full max-w-md shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-opacity-50">
              <h3 className="text-base font-bold text-sky-400">✏️ Editar Datos del Cliente</h3>
              <button onClick={() => setEditingClient(null)} className="font-bold text-lg opacity-75 hover:opacity-100">✕</button>
            </div>

            <form onSubmit={handleSaveCustomerEdit} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 opacity-90">Nombre Completo *</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  className={`w-full border p-2.5 rounded-lg text-xs ${inputBg}`} 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 opacity-90">NIT</label>
                  <input 
                    type="text" 
                    value={editNit} 
                    onChange={e => setEditNit(e.target.value)} 
                    className={`w-full border p-2.5 rounded-lg text-xs ${inputBg}`} 
                  />
                </div>
                <div>
                  <label className="block mb-1 opacity-90">DPI (13 dígitos)</label>
                  <input 
                    type="text" 
                    maxLength={13} 
                    value={editDpi} 
                    onChange={e => setEditDpi(e.target.value.replace(/\D/g, ''))} 
                    className={`w-full border p-2.5 rounded-lg text-xs font-mono ${inputBg}`} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 opacity-90">Teléfono / WhatsApp</label>
                  <input 
                    type="text" 
                    value={editPhone} 
                    onChange={e => setEditPhone(e.target.value)} 
                    className={`w-full border p-2.5 rounded-lg text-xs ${inputBg}`} 
                  />
                </div>
                <div>
                  <label className="block mb-1 opacity-90">Correo Electrónico</label>
                  <input 
                    type="email" 
                    value={editEmail} 
                    onChange={e => setEditEmail(e.target.value)} 
                    className={`w-full border p-2.5 rounded-lg text-xs ${inputBg}`} 
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 opacity-90">Dirección</label>
                <input 
                  type="text" 
                  value={editAddress} 
                  onChange={e => setEditAddress(e.target.value)} 
                  className={`w-full border p-2.5 rounded-lg text-xs ${inputBg}`} 
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  disabled={isUpdating} 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-lg font-bold text-white text-xs transition-colors"
                >
                  {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingClient(null)} 
                  className="bg-slate-600 hover:bg-slate-500 px-4 py-2.5 rounded-lg text-white text-xs"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}