'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function GymAddonsView({ membership, darkMode, onClose }: { membership: any, darkMode: boolean, onClose: () => void }) {
  const [addons, setAddons] = useState<any[]>([])
  const [serviceName, setServiceName] = useState('')
  const [extraCost, setExtraCost] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchAddons()
  }, [membership])

  async function fetchAddons() {
    const { data } = await supabase
      .from('gym_membership_addons')
      .select('*')
      .eq('membership_id', membership.id)

    if (data) setAddons(data)
  }

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault()
    if (!serviceName.trim() || !extraCost) return

    setLoading(true)
    const { error } = await supabase
      .from('gym_membership_addons')
      .insert([{
        membership_id: membership.id,
        service_name: serviceName.trim(),
        extra_cost: parseFloat(extraCost) || 0,
        status: 'Activo'
      }])

    if (error) {
      alert('Error al agregar servicio: ' + error.message)
    } else {
      setServiceName('')
      setExtraCost('')
      fetchAddons()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`${darkMode ? 'bg-[#111827] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'} border w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl relative space-y-6 transition-colors`}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-cyan-500 font-bold text-sm">✕</button>
        
        <div className="space-y-1">
          <h3 className="text-xl font-black">🥊 Clases y Servicios Adicionales</h3>
          <p className="text-xs text-slate-400">Socio: <strong>{membership?.customer_name || 'No seleccionado'}</strong></p>
        </div>

        {/* Formulario para agregar servicio */}
        <form onSubmit={handleAddService} className="space-y-3 text-xs bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
          <h4 className="font-bold text-cyan-400 uppercase tracking-wider text-[11px]">Asignar Nueva Disciplina / Extra</h4>
          <div className="space-y-2">
            <input 
              type="text"
              required
              placeholder="Ej. Clase Especial de Boxeo / Zumba VIP"
              value={serviceName}
              onChange={e => setServiceName(e.target.value)}
              className={`w-full ${darkMode ? 'bg-[#070b12] border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'} border rounded-xl px-3 py-2.5 outline-none focus:border-cyan-500`}
            />
            <input 
              type="number"
              step="0.01"
              required
              placeholder="Costo Extra (Ej. 75.00)"
              value={extraCost}
              onChange={e => setExtraCost(e.target.value)}
              className={`w-full ${darkMode ? 'bg-[#070b12] border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'} border rounded-xl px-3 py-2.5 outline-none focus:border-cyan-500`}
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-2.5 rounded-xl uppercase tracking-wider transition-colors shadow"
          >
            ➕ Agregar Servicio a la Membresía
          </button>
        </form>

        {/* Listado de servicios actuales */}
        <div className="space-y-2">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Servicios Activos Contratados</h4>
          <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
            {addons.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No cuenta con servicios extra asociados.</p>
            ) : (
              addons.map((addon, idx) => (
                <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${darkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                    <span className="font-bold block text-sm">{addon.service_name}</span>
                    <span className="text-[10px] text-slate-400">Agregado el: {addon.added_date}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-emerald-400 text-sm">Q {addon.extra_cost}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-2">
          <button 
            onClick={onClose} 
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-xs font-bold"
          >
            Cerrar Ventana
          </button>
        </div>

      </div>
    </div>
  )
}