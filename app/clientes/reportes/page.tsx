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
  const [customersList, setCustomersList] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

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

  const [editingClient, setEditingClient] = useState<any | null>(null)
  const [editName, setEditName] = useState('')
  const [editNit, setEditNit] = useState('')
  const [editDpi, setEditDpi] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const [selectedClientHistory, setSelectedClientHistory] = useState<any | null>(null)
  const [clientSalesHistory, setClientSalesHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

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
        loadCustomers(bId)
      } else {
        setLoading(false)
      }
    } catch (e) {
      console.error("Error al leer sesión:", e)
      setLoading(false)
    }
  }, [])

  const loadCustomers = async (bId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', bId)
      .order('name', { ascending: true })

    if (error) {
      console.error("Error al cargar clientes:", error.message)
    } else if (data) {
      setCustomersList(data)
    }
    setLoading(false)
  }

  // Consumimos la función RPC segura para evitar bloqueos por RLS y traer todo el historial multi-sucursal
  const handleOpenExpediente = async (client: any) => {
    setSelectedClientHistory(client)
    setLoadingHistory(true)

    try {
      const { data, error } = await supabase.rpc('get_customer_sales_history', {
        p_business_id: businessId,
        p_customer_id: client.id
      })

      if (!error && data) {
        setClientSalesHistory(data)
      } else {
        console.error("Error al cargar historial mediante RPC:", error?.message)
        setClientSalesHistory([])
      }
    } catch (err) {
      console.error("Excepción al cargar expediente:", err)
      setClientSalesHistory([])
    }

    setLoadingHistory(false)
  }

  const handleOpenEdit = (client: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingClient(client)
    setEditName(client.name || '')
    setEditNit(client.nit || '')
    setEditDpi(client.dpi || '')
    setEditPhone(client.phone || '')
    setEditEmail(client.email || '')
    setEditAddress(client.address || '')
  }

  const handleSaveCustomerEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClient || !editingClient.id) return

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
      .eq('id', editingClient.id)

    setIsUpdating(false)

    if (error) {
      alert("Error al actualizar cliente: " + error.message)
    } else {
      alert("✅ ¡Datos del cliente actualizados con éxito!")
      setEditingClient(null)
      if (businessId) loadCustomers(businessId)
    }
  }

  const filteredCustomers = customersList.filter((c: any) => 
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (c.nit && c.nit.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.dpi && c.dpi.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-4 sm:p-6 flex flex-col w-full notranslate ${themeBg}`} translate="no">
      <header className={`p-4 rounded-xl shadow mb-6 flex justify-between items-center border w-full flex-wrap gap-3 ${panelBg}`}>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-emerald-500 flex items-center gap-2">
            👥 Directorio General y Expediente de Clientes
          </h1>
          <p className="text-xs opacity-75 mt-0.5">Gestión de clientes y compras centralizadas por negocio y sucursales.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className={`px-3 py-2 rounded-lg font-semibold text-xs transition-colors border ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-amber-300 border-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'}`}
          >
            {isDarkMode ? '☀️ Claro' : '🌙 Oscuro'}
          </button>

          <button 
            onClick={() => router.push('/pos')}
            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-xs font-semibold transition-colors text-white"
          >
            ← Volver al POS
          </button>
        </div>
      </header>

      <div className={`p-5 sm:p-6 rounded-xl shadow border flex-1 flex flex-col gap-4 ${panelBg}`}>
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <input 
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="🔍 Buscar por nombre, NIT, DPI o teléfono..."
            className={`w-full md:w-96 border px-4 py-2.5 rounded-xl text-xs outline-none focus:border-emerald-500 ${inputBg}`}
          />
          <button 
            onClick={() => businessId && loadCustomers(businessId)}
            className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors text-white shadow"
          >
            🔄 Actualizar Directorio
          </button>
        </div>

        {loading ? (
          <p className="text-center opacity-75 py-20 text-sm">Cargando base de datos de clientes...</p>
        ) : filteredCustomers.length === 0 ? (
          <p className="text-center opacity-75 py-20 text-sm">No se encontraron clientes registrados en el sistema.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto max-h-[68vh] pr-1">
            {filteredCustomers.map((client: any, idx: number) => (
              <div 
                key={idx} 
                className={`border rounded-xl p-4 flex flex-col justify-between shadow-sm transition-all ${subPanelBg} hover:border-emerald-500/60`}
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h2 className="font-bold text-sm text-emerald-400 line-clamp-1">{client.name}</h2>
                    <div className="flex gap-1">
                      <button 
                        onClick={(e) => handleOpenEdit(client, e)}
                        className="text-[10px] bg-sky-500/20 text-sky-300 font-semibold px-2 py-1 rounded-lg hover:bg-sky-500/30 transition-colors"
                        title="Editar datos del cliente"
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs opacity-90 border-t border-slate-700/50 pt-2">
                    <p>NIT: <span className="text-emerald-400 font-mono font-bold">{client.nit || 'CF'}</span></p>
                    <p>DPI: <span className="font-mono">{client.dpi || 'No registrado'}</span></p>
                    <p>📞 {client.phone || 'No registrado'}</p>
                    <p className="truncate">✉️ {client.email || 'No registrado'}</p>
                    <p className="truncate">📍 {client.address || 'No registrada'}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-end items-center">
                  <button 
                    onClick={() => handleOpenExpediente(client)}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition-colors shadow"
                  >
                    Ver Expediente 📂
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- MODAL PARA EDITAR CLIENTE --- */}
      {editingClient !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`p-6 rounded-2xl border border-sky-500 w-full max-w-md shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-opacity-50">
              <h3 className="text-base font-bold text-sky-400">✏️ Expediente Comercial del Cliente</h3>
              <button onClick={() => setEditingClient(null)} className="font-bold text-lg opacity-75 hover:opacity-100">✕</button>
            </div>

            <form onSubmit={handleSaveCustomerEdit} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 opacity-90">Nombre Completo o Razón Social *</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  className={`w-full border p-2.5 rounded-xl text-xs ${inputBg}`} 
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
                    className={`w-full border p-2.5 rounded-xl text-xs ${inputBg}`} 
                  />
                </div>
                <div>
                  <label className="block mb-1 opacity-90">DPI (13 dígitos)</label>
                  <input 
                    type="text" 
                    maxLength={13} 
                    value={editDpi} 
                    onChange={e => setEditDpi(e.target.value.replace(/\D/g, ''))} 
                    className={`w-full border p-2.5 rounded-xl text-xs font-mono ${inputBg}`} 
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
                    className={`w-full border p-2.5 rounded-xl text-xs ${inputBg}`} 
                  />
                </div>
                <div>
                  <label className="block mb-1 opacity-90">Correo Electrónico</label>
                  <input 
                    type="email" 
                    value={editEmail} 
                    onChange={e => setEditEmail(e.target.value)} 
                    className={`w-full border p-2.5 rounded-xl text-xs ${inputBg}`} 
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 opacity-90">Dirección Fiscal / Entrega</label>
                <input 
                  type="text" 
                  value={editAddress} 
                  onChange={e => setEditAddress(e.target.value)} 
                  className={`w-full border p-2.5 rounded-xl text-xs ${inputBg}`} 
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  disabled={isUpdating} 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-xl font-bold text-white text-xs transition-colors shadow"
                >
                  {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingClient(null)} 
                  className="bg-slate-600 hover:bg-slate-500 px-4 py-2.5 rounded-xl text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL PARA VER EXPEDIENTE / HISTORIAL DE COMPRAS MULTI-SUCURSAL --- */}
      {selectedClientHistory !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`p-6 rounded-2xl border border-emerald-500 w-full max-w-lg shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-opacity-50">
              <div>
                <h3 className="text-base font-bold text-emerald-400">📂 Expediente Global del Cliente</h3>
                <p className="text-xs text-slate-300 font-semibold">{selectedClientHistory.name} (NIT: {selectedClientHistory.nit || 'CF'})</p>
              </div>
              <button onClick={() => setSelectedClientHistory(null)} className="font-bold text-lg opacity-75 hover:opacity-100">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 space-y-1">
                <p>📞 <strong>Teléfono:</strong> {selectedClientHistory.phone || 'No registrado'}</p>
                <p>✉️ <strong>Correo:</strong> {selectedClientHistory.email || 'No registrado'}</p>
                <p>📍 <strong>Dirección:</strong> {selectedClientHistory.address || 'No registrada'}</p>
              </div>

              <h4 className="font-bold text-sm text-purple-400 pt-2">🛒 Historial de Transacciones en el Negocio:</h4>

              {loadingHistory ? (
                <p className="text-center py-6 opacity-75">Buscando transacciones en todas las sucursales...</p>
              ) : clientSalesHistory.length === 0 ? (
                <p className="text-center py-6 opacity-75 text-slate-400">Este cliente no registra compras asociadas en este negocio.</p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {clientSalesHistory.map((sale: any, i: number) => (
                    <div key={i} className={`p-3 rounded-xl border space-y-2 ${subPanelBg}`}>
                      <div className="flex justify-between items-center font-bold border-b border-slate-700/50 pb-1">
                        <div>
                          <span className="text-emerald-400">Venta #{sale.id.slice(0, 8)}</span>
                          <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                            Sucursal: {sale.branch_name || 'Principal'}
                          </span>
                        </div>
                        <span className="text-white text-sm">Q {Number(sale.total_amount).toFixed(2)}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">Fecha: {new Date(sale.created_at).toLocaleString()} | Método: {sale.payment_method}</p>
                      
                      <div className="space-y-1 pt-1">
                        {sale.sale_items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-[11px] text-slate-300 pl-2 border-l-2 border-emerald-500/40">
                            <span>{item.quantity}x {item.product_name || 'Producto'}</span>
                            <span className="font-mono">Q {(item.quantity * Number(item.unit_price)).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={() => setSelectedClientHistory(null)}
              className="w-full bg-slate-600 hover:bg-slate-500 text-white py-2.5 rounded-xl font-bold text-xs shadow mt-2"
            >
              Cerrar Expediente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}