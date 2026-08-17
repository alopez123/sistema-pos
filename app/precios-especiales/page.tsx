'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function PriceLogsPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPriceLogs()
  }, [])

  async function loadPriceLogs() {
    try {
      const staffStr = localStorage.getItem('currentStaff')
      let bizId = ''
      let brId = '' // Variable para almacenar la sucursal actual

      if (staffStr) {
        try {
          const staffObj = JSON.parse(staffStr)
          bizId = staffObj.business_id || staffObj.busines_id
          brId = staffObj.branch_id // Extraemos el ID de la sucursal asignada
        } catch (e) {
          console.error("Error parseando currentStaff", e)
        }
      }

      if (!bizId) {
        const bizStr = localStorage.getItem('currentBusiness')
        if (bizStr) {
           const biz = JSON.parse(bizStr)
           bizId = biz.id || biz.business_id || biz.busines_id
        }
        
        if(!bizId){
          bizId = 'a15d7206-589f-40d0-9ddc-2efea2b475ee'
        }
      }

      const { data, error } = await supabase.rpc('get_price_logs_secure', {
        p_business_id: bizId
      })

      if (error) throw error
      
      if (data) {
        // Filtramos para que solo queden los registros de la sucursal en la que está el usuario
        // Si no hay branch_id (ej: usuario admin principal), los mostramos todos.
        const filteredLogs = brId 
          ? data.filter((log: any) => log.branch_id === brId)
          : data

        setLogs(filteredLogs)
      }
    } catch (err: any) {
      console.error("Error cargando bitácora:", err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-white notranslate" translate="no">
      <header className="bg-[#1e293b] p-4 rounded-lg shadow mb-6 flex justify-between items-center border border-slate-700">
        <h1 className="text-xl font-bold text-emerald-400">📋 Bitácora de Precios Especiales y Modificaciones</h1>
        <button 
          onClick={() => router.push('/pos')} 
          className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-xs font-semibold transition-colors"
        >
          ← Volver al POS
        </button>
      </header>

      <div className="bg-[#1e293b] p-6 rounded-lg shadow border border-slate-700">
        <h2 className="text-md font-bold text-slate-300 mb-4">Historial de Auditoría</h2>
        
        {loading ? (
          <p className="text-slate-400 text-center py-10">Cargando registros...</p>
        ) : logs.length === 0 ? (
          <p className="text-slate-400 text-center py-10">No hay registros de precios especiales para esta sucursal.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-2 px-3">Fecha / Hora</th>
                  <th className="py-2 px-3">Sucursal</th>
                  <th className="py-2 px-3">Usuario (Auth)</th>
                  <th className="py-2 px-3">Producto</th>
                  <th className="py-2 px-3">Precio Original</th>
                  <th className="py-2 px-3">Nuevo Precio</th>
                  <th className="py-2 px-3">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 text-slate-300">
                      {new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3 px-3 text-amber-300 font-medium">{log.branch_name || 'Sucursal Principal'}</td>
                    <td className="py-3 px-3 text-blue-300 font-semibold">{log.staff_name || 'Sistema / N/D'}</td>
                    <td className="py-3 px-3 font-bold text-white">{log.product_name || 'Producto'}</td>
                    <td className="py-3 px-3 text-slate-400" translate="no">Q {log.original_price}</td>
                    <td className="py-3 px-3 text-emerald-400 font-bold" translate="no">Q {log.new_price}</td>
                    <td className="py-3 px-3 text-slate-300">{log.reason || 'Modificación de precio'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}