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

  const groupedByCustomer = reportData.reduce((acc: any, row: any) => {
    if (!acc[row.customer_id]) {
      acc[row.customer_id] = {
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        customer_nit: row.customer_nit,
        customer_phone: row.customer_phone || 'No registrado',
        customer_email: row.customer_email || 'No registrado',
        customer_address: row.customer_address || 'No registrada',
        total_spent_general: 0,
        products: []
      }
    }
    acc[row.customer_id].total_spent_general += Number(row.total_spent || 0)
    acc[row.customer_id].products.push({
      product_name: row.product_name,
      total_quantity: row.total_quantity,
      total_spent: row.total_spent
    })
    return acc
  }, {})

  const customersArray = Object.values(groupedByCustomer).filter((c: any) => 
    c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.customer_nit.toLowerCase().includes(searchTerm.toLowerCase())
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
          {/* BOTÓN INTERRUPTOR DE TEMA (CLARO / OSCURO) */}
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
            placeholder="🔍 Buscar cliente por nombre o NIT..."
            className={`w-full md:w-96 border px-4 py-2.5 rounded-lg text-sm outline-none focus:border-emerald-500 ${inputBg}`}
          />
          <button 
            onClick={() => businessId && loadCustomerTopProducts(businessId)}
            className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors text-white"
          >
            🔄 Actualizar Datos
          </button>
        </div>

        <p className="text-xs opacity-75">💡 Haz clic en cualquier tarjeta de cliente para ver sus artículos más comprados.</p>

        {loading ? (
          <p className="text-center opacity-75 py-20">Cargando directorio de clientes...</p>
        ) : customersArray.length === 0 ? (
          <p className="text-center opacity-75 py-20">No se encontraron clientes registrados.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto max-h-[68vh] pr-2">
            {customersArray.map((client: any, idx: number) => (
              <div 
                key={idx} 
                onClick={() => setSelectedClient(client)}
                className={`border rounded-lg p-4 flex flex-col justify-between shadow cursor-pointer transition-all group ${subPanelBg} hover:border-emerald-500`}
              >
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start">
                    <h2 className="font-bold text-sm group-hover:text-emerald-500 transition-colors line-clamp-1">{client.customer_name}</h2>
                    <span className="text-[10px] bg-emerald-500/25 text-emerald-500 font-semibold px-2 py-0.5 rounded">Ver compras</span>
                  </div>
                  <p className="text-xs opacity-75">NIT: <span className="text-emerald-500 font-mono font-semibold">{client.customer_nit}</span></p>
                  <p className="text-[11px] opacity-85">📞 {client.customer_phone}</p>
                  <p className="text-[11px] opacity-85 truncate">✉️ {client.customer_email}</p>
                  <p className="text-[11px] opacity-85 truncate">📍 {client.customer_address}</p>
                </div>

                <div className="border-t border-opacity-50 pt-3 mt-3 flex justify-between items-center text-xs">
                  <span className="opacity-70 uppercase text-[10px]">Total Acumulado</span>
                  <span className="font-bold text-emerald-500 text-sm" translate="no">Q {client.total_spent_general.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- MODAL DE ARTÍCULOS FRECUENTES DEL CLIENTE --- */}
      {selectedClient !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`p-6 rounded-xl border border-emerald-500 w-full max-w-lg shadow-2xl ${panelBg}`}>
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-opacity-50">
              <div>
                <h3 className="text-base font-bold text-emerald-500">{selectedClient.customer_name}</h3>
                <p className="text-xs opacity-75">NIT: <span className="font-mono">{selectedClient.customer_nit}</span></p>
                <p className="text-xs opacity-80 mt-1">📞 {selectedClient.customer_phone} | ✉️ {selectedClient.customer_email}</p>
                <p className="text-xs opacity-80">📍 {selectedClient.customer_address}</p>
              </div>
              <button 
                onClick={() => setSelectedClient(null)} 
                className="font-bold text-lg px-2 py-1 opacity-75 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <p className="text-xs font-semibold opacity-75 mb-2 uppercase tracking-wider">Artículos más comprados:</p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {selectedClient.products.map((prod: any, pIdx: number) => (
                <div key={pIdx} className={`p-3 rounded border flex justify-between items-center text-xs ${subPanelBg}`}>
                  <div>
                    <p className="font-semibold">{prod.product_name}</p>
                    <p className="text-[10px] opacity-75">Cantidad comprada: <span className="text-emerald-500 font-bold">{prod.total_quantity}</span></p>
                  </div>
                  <span className="font-bold text-emerald-500 text-sm" translate="no">Q {Number(prod.total_spent).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setSelectedClient(null)} 
              className="mt-6 w-full bg-slate-600 hover:bg-slate-500 text-white py-2.5 rounded-lg font-semibold text-xs transition-colors"
            >
              Cerrar Ventana
            </button>
          </div>
        </div>
      )}
    </div>
  )
}