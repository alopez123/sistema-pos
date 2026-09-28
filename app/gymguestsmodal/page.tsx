'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function GymGuestsModal({ membership, businessId, darkMode, onClose }: { membership: any, businessId: string, darkMode: boolean, onClose: () => void }) {
  const [guests, setGuests] = useState<any[]>([])
  const [maxGuests, setMaxGuests] = useState(3) // Valor por defecto
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const currentMonthYear = new Date().toISOString().slice(0, 7) // Formato 'YYYY-MM'

  useEffect(() => {
    fetchGuestData()
  }, [membership])

  async function fetchGuestData() {
    // 1. Obtener el límite configurado en gym_settings para el negocio
    const { data: settingsData } = await supabase
      .from('gym_settings')
      .select('max_guests_per_month')
      .eq('business_id', businessId)
      .single()

    if (settingsData && settingsData.max_guests_per_month) {
      setMaxGuests(settingsData.max_guests_per_month)
    }

    // 2. Obtener los invitados registrados por este socio en el mes actual
    const { data: guestsData } = await supabase
      .from('gym_member_guests')
      .select('*')
      .eq('membership_id', membership.id)
      .eq('month_year', currentMonthYear)

    if (guestsData) {
      setGuests(guestsData)
    }
  }

  async function handleAddGuest(e: React.FormEvent) {
    e.preventDefault()
    if (!guestName.trim()) return

    if (guests.length >= maxGuests) {
      alert(`⚠️ El socio ha alcanzado su límite máximo de ${maxGuests} invitados para este mes.`)
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('gym_member_guests')
      .insert([{
        membership_id: membership.id,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim(),
        visit_date: new Date().toISOString().split('T')[0],
        month_year: currentMonthYear
      }])

    if (error) {
      alert('Error al registrar invitado: ' + error.message)
    } else {
      setGuestName('')
      setGuestPhone('')
      fetchGuestData()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`${darkMode ? 'bg-[#111827] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'} border w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl relative space-y-6 transition-colors`}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-cyan-500 font-bold text-sm">✕</button>
        
        <div className="space-y-1">
          <h3 className="text-xl font-black">👥 Control de Invitados Mensuales</h3>
          <p className="text-xs text-slate-400">Socio titular: <strong>{membership.customer_name}</strong></p>
        </div>

        {/* Resumen de cupos */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Cupos Utilizados este Mes</span>
            <span className="text-xl font-black text-cyan-400">{guests.length} / {maxGuests}</span>
          </div>
          <div>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
              guests.length >= maxGuests ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}>
              {guests.length >= maxGuests ? 'Límite alcanzado' : 'Cupos disponibles'}
            </span>
          </div>
        </div>

        {/* Formulario para agregar invitado si hay cupo */}
        {guests.length < maxGuests ? (
          <form onSubmit={handleAddGuest} className="space-y-3 text-xs pt-2">
            <h4 className="font-bold text-cyan-500 uppercase tracking-wider text-[11px]">Registrar Nuevo Invitado</h4>
            <div className="flex gap-2">
              <input 
                type="text"
                required
                placeholder="Nombre del invitado..."
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                className={`flex-1 ${darkMode ? 'bg-[#070b12] border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'} border rounded-xl px-3 py-2.5 outline-none focus:border-cyan-500`}
              />
              <input 
                type="text"
                placeholder="Teléfono (Opcional)"
                value={guestPhone}
                onChange={e => setGuestPhone(e.target.value)}
                className={`w-36 ${darkMode ? 'bg-[#070b12] border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'} border rounded-xl px-3 py-2.5 outline-none focus:border-cyan-500`}
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl uppercase tracking-wider transition-colors shadow"
            >
              Registrar Visita de Invitado
            </button>
          </form>
        ) : (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-red-400 text-xs font-semibold">
            Este socio ya cumplió con el límite de invitados permitidos para el ciclo mensual actual.
          </div>
        )}

        {/* Listado de invitados del mes */}
        <div className="space-y-2">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Historial de Invitados del Mes</h4>
          <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
            {guests.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No registra invitados este mes.</p>
            ) : (
              guests.map((g, idx) => (
                <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${darkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                    <span className="font-bold block">{g.guest_name}</span>
                    <span className="text-[10px] text-slate-400">📱 {g.guest_phone || 'Sin teléfono'}</span>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400">{g.visit_date}</span>
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