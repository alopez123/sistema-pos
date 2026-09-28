'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function GymMemberDetailPage({ currentBusiness, darkMode }: any) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const memberId = searchParams.get('id')

  const [member, setMember] = useState<any>(null)
  const [assignedClasses, setAssignedClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => { setToast(null) }, 4500)
  }

  useEffect(() => {
    if (memberId) {
      fetchMemberDetail(parseInt(memberId))
    } else {
      setLoading(false)
    }
  }, [memberId])

  async function fetchMemberDetail(mId: number) {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_gym_member_detail', {
        p_member_id: mId
      })
      if (error) throw error

      if (data && data.success) {
        setMember(data.member)
        setAssignedClasses(data.fixed_classes || [])
      } else {
        showToast(data?.message || 'No se pudo cargar la información del socio.', 'error')
      }
    } catch (err: any) {
      console.error("Error al cargar detalle del socio:", err)
      showToast("Error al cargar detalle: " + err.message, "error")
    } finally {
      setLoading(false)
    }
  }

  const themeBg = darkMode !== false ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = darkMode !== false ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'

  if (loading) {
    return (
      <div className={`min-h-screen p-8 text-center flex items-center justify-center ${themeBg}`}>
        <p className="font-bold text-cyan-400 animate-pulse">Cargando ficha del socio...</p>
      </div>
    )
  }

  if (!member) {
    return (
      <div className={`min-h-screen p-8 text-center space-y-4 ${themeBg}`}>
        <p className="text-red-400 font-bold">No se encontró el socio seleccionado.</p>
        <button onClick={() => router.push('/gymmembersview')} className="bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold">
          ← Volver a Socios
        </button>
      </div>
    )
  }

  return (
    <div className={`min-h-screen p-4 md:p-6 flex flex-col notranslate relative ${themeBg}`} translate="no">
      
      {toast && (
        <div className="fixed top-5 right-5 z-[99999] animate-bounce">
          <div className={`px-5 py-3 rounded-xl shadow-2xl border font-bold text-sm flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-red-600 text-white border-red-400'
          }`}>
            <span>{toast.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className={`p-4 rounded-xl shadow flex justify-between items-center gap-3 border ${panelBg}`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/gymmembersview')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow"
            >
              ← Volver a Socios
            </button>
            <div>
              <h1 className="text-lg font-bold text-cyan-400">📄 Ficha Técnica del Socio</h1>
              <p className="text-xs opacity-75">Información general, membresía y clases fijas contratadas</p>
            </div>
          </div>
        </div>

        {/* Tarjeta de Datos Personales y Clases */}
        <div className={`p-6 rounded-2xl border shadow-xl space-y-6 ${panelBg}`}>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-slate-700 pb-6">
            {member.photo_url ? (
              <img src={member.photo_url} alt="" className="w-24 h-24 rounded-2xl object-cover border-2 border-cyan-500 shadow-md" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-slate-700 flex items-center justify-center text-3xl shadow-md">👤</div>
            )}
            <div className="text-center sm:text-left space-y-1">
              <h2 className="text-xl font-black text-cyan-300">{member.customer_name}</h2>
              <p className="text-xs opacity-80">Teléfono: <span className="font-semibold text-white">{member.customer_phone || 'N/A'}</span></p>
              <p className="text-xs opacity-80">Correo: <span className="font-semibold text-white">{member.customer_email || 'N/A'}</span></p>
              <div className="pt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Código: {member.access_code || 'S/C'}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-black ${
                  new Date(member.expiry_date) >= new Date() ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  Vence: {member.expiry_date ? new Date(member.expiry_date).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Clases Fijas / Recurrentes Contratadas */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">🏅 Clases Fijas y Costos Extra Contratados</h3>
            
            {assignedClasses.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700 text-xs text-center opacity-75">
                Este socio no tiene clases fijas ni costos extra asignados actualmente.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {assignedClasses.map((ac) => (
                  <div key={ac.assignment_id} className="p-4 rounded-xl border border-slate-700 bg-slate-900/60 flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <h4 className="font-bold text-sm text-amber-300">{ac.class_name}</h4>
                      <p className="text-xs opacity-80">Instructor: <span className="text-white font-semibold">{ac.instructor_name}</span></p>
                      <p className="text-[11px] opacity-70 font-mono mt-0.5">
                        Vigencia: {new Date(ac.start_date).toLocaleDateString()} al {new Date(ac.expiry_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-400 block" translate="no">Q {ac.fee_charged}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-block mt-1">
                        {ac.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}