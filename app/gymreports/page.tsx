'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function GymReportsPage({ currentBusiness, darkMode }: any) {
  const [businessId, setBusinessId] = useState(currentBusiness?.id || '')
  const [attendanceList, setAttendanceList] = useState<any[]>([])
  const [statsData, setStatsData] = useState<any>({
    realtimeInside: 0,
    peakHours: [],
    ageRanges: { '18-25': 0, '26-35': 0, '36-50': 0, '51+': 0 },
    preferredDays: { 'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 'Jueves': 0, 'Viernes': 0, 'Sábado': 0, 'Domingo': 0 },
    specialClassesCount: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'asistencia' | 'invitados' | 'estadisticas'>('asistencia')
  
  // Filtros de fecha (por defecto el día de hoy)
  const todayStr = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState(todayStr)

  const router = useRouter()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => { setToast(null) }, 4500)
  }

  useEffect(() => {
    let bId = currentBusiness?.id;
    const savedBiz = localStorage.getItem('currentBusiness');
    if (savedBiz) {
      try {
        const bizObj = JSON.parse(savedBiz);
        if (bizObj?.id) bId = bizObj.id;
      } catch (e) {
        console.error("Error al leer currentBusiness:", e);
      }
    }

    if (bId) {
      setBusinessId(bId);
      fetchReport(bId, startDate, endDate);
      fetchAdvancedStats(bId);
    } else {
      setLoading(false);
    }
  }, [currentBusiness]);

  async function fetchReport(bId: string, start: string, end: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_gym_attendance_report', {
        p_business_id: bId,
        p_start_date: start || null,
        p_end_date: end || null
      });

      if (error) throw error;
      setAttendanceList(data || []);
    } catch (err: any) {
      console.error("Error al cargar reporte:", err);
      showToast("Error al cargar las estadísticas: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAdvancedStats(bId: string) {
    try {
      const { data, error } = await supabase.rpc('get_gym_advanced_stats', {
        p_business_id: bId
      });

      if (error) throw error;

      if (data && data.success) {
        let peakFormatted: any = [];
        if (data.peak_hours) {
          peakFormatted = data.peak_hours.map((p: any) => [p.hour_range, p.total]);
        }

        let daysObj: any = { 'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 'Jueves': 0, 'Viernes': 0, 'Sábado': 0, 'Domingo': 0 };
        if (data.preferred_days) {
          data.preferred_days.forEach((d: any) => {
            if (daysObj[d.day_name] !== undefined) {
              daysObj[d.day_name] = d.total;
            }
          });
        }

        setStatsData({
          realtimeInside: data.realtime_inside || 0,
          peakHours: peakFormatted,
          ageRanges: data.age_ranges || { '18-25': 0, '26-35': 0, '36-50': 0, '51+': 0 },
          preferredDays: daysObj,
          specialClassesCount: data.special_classes_count || 0
        });
      }
    } catch (err) {
      console.error("Error al cargar estadísticas por RPC:", err);
    }
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (businessId) {
      fetchReport(businessId, startDate, endDate);
    }
  }

  const guestsList = attendanceList.filter(item => item.scan_type === 'Cortesía');
  const normalAttendance = attendanceList.filter(item => item.scan_type !== 'Cortesía');

  const currentList = activeTab === 'asistencia' ? normalAttendance : guestsList;
  const filteredList = currentList.filter(item => 
    (item.customer_name && item.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.access_code && item.access_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.customer_phone && item.customer_phone.includes(searchTerm))
  );

  const totalEntries = normalAttendance.filter(i => i.scan_type === 'Entrada').length;
  const totalExits = normalAttendance.filter(i => i.scan_type === 'Salida').length;
  const totalGuests = guestsList.length;

  const themeBg = darkMode !== false ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = darkMode !== false ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const inputBg = darkMode !== false ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  function sendWhatsAppPromo(phone: string, guestName: string) {
    if (!phone) return showToast("Este invitado no tiene número de teléfono registrado.", "error");
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(`¡Hola ${guestName}! Te saludamos del gimnasio. Esperamos que hayas disfrutado tu visita de cortesía. Queremos compartirte nuestros planes y costos actuales para que te nos unas. ¡Te esperamos! 💪🏋️‍♂️`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
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

      <div className="max-w-6xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className={`p-4 rounded-xl shadow flex flex-wrap justify-between items-center gap-3 border ${panelBg}`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/dashboard')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow"
            >
              ← Volver al Dashboard
            </button>
            <div>
              <h1 className="text-lg font-bold text-cyan-400">📊 Reportes, Asistencias e Invitados</h1>
              <p className="text-xs opacity-75">Control de flujo, pases de cortesía y prospección</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => router.push('/gymcheckinview')}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow transition-colors"
            >
              📷 Ir a Escáner de Acceso
            </button>
            <button 
              onClick={() => router.push('/gymguests')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow transition-colors"
            >
              🎟️ Registrar Invitado
            </button>
          </div>
        </div>

        {/* Tarjetas Estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`p-5 rounded-2xl border shadow flex items-center gap-4 ${panelBg}`}>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl font-black">
              🟢
            </div>
            <div>
              <p className="text-xs opacity-70 font-semibold uppercase">Total Entradas</p>
              <h3 className="text-2xl font-black text-emerald-400">{totalEntries}</h3>
            </div>
          </div>

          <div className={`p-5 rounded-2xl border shadow flex items-center gap-4 ${panelBg}`}>
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-2xl font-black">
              🔵
            </div>
            <div>
              <p className="text-xs opacity-70 font-semibold uppercase">Total Salidas</p>
              <h3 className="text-2xl font-black text-blue-400">{totalExits}</h3>
            </div>
          </div>

          <div className={`p-5 rounded-2xl border shadow flex items-center gap-4 ${panelBg}`}>
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl font-black">
              🎟️
            </div>
            <div>
              <p className="text-xs opacity-70 font-semibold uppercase">Invitados / Prospectos</p>
              <h3 className="text-2xl font-black text-amber-400">{totalGuests}</h3>
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex gap-2 border-b border-slate-700 pb-2 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('asistencia')}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all whitespace-nowrap ${
              activeTab === 'asistencia' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            📋 Registro de Asistencia ({normalAttendance.length})
          </button>
          <button 
            onClick={() => setActiveTab('invitados')}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all whitespace-nowrap ${
              activeTab === 'invitados' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            🎟️ Historial de Invitados / Prospectos ({guestsList.length})
          </button>
          <button 
            onClick={() => setActiveTab('estadisticas')}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all whitespace-nowrap ${
              activeTab === 'estadisticas' ? 'bg-indigo-500 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            📈 Estadísticas y Analítica 🚀
          </button>
        </div>

        {/* CONTENIDO DE LA PESTAÑA ESTADÍSTICAS */}
        {activeTab === 'estadisticas' ? (
          <div className="space-y-6">
            
            {/* Tarjetas Destacadas de Analítica */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`p-6 rounded-2xl border shadow flex items-center gap-5 ${panelBg}`}>
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-3xl">
                  🏋️‍♂️
                </div>
                <div>
                  <p className="text-xs opacity-70 font-semibold uppercase">Personas en el Gimnasio (Tiempo Real)</p>
                  <h3 className="text-3xl font-black text-cyan-400 mt-1">{statsData.realtimeInside} Activos</h3>
                  <p className="text-[11px] opacity-60 mt-0.5">Basado en entradas sin registro de salida posterior</p>
                </div>
              </div>

              <div className={`p-6 rounded-2xl border shadow flex items-center gap-5 ${panelBg}`}>
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-3xl">
                  ⭐
                </div>
                <div>
                  <p className="text-xs opacity-70 font-semibold uppercase">Alumnos con Clases Especiales</p>
                  <h3 className="text-3xl font-black text-indigo-400 mt-1">{statsData.specialClassesCount} Inscritos</h3>
                  <p className="text-[11px] opacity-60 mt-0.5">Asociados a disciplinas especiales y fijas</p>
                </div>
              </div>
            </div>

            {/* Grid de Reportes Detallados Históricos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Horas Más Concurridas (Histórico Completo) */}
              <div className={`p-5 rounded-2xl border shadow space-y-3 ${panelBg}`}>
                <h4 className="font-extrabold text-cyan-400 text-sm uppercase tracking-wide flex items-center gap-2">
                  ⏰ Horas Pico (Histórico Total)
                </h4>
                <div className="space-y-2 pt-2">
                  {statsData.peakHours.length === 0 ? (
                    <p className="text-xs opacity-60 italic">Sin datos suficientes de horarios.</p>
                  ) : (
                    statsData.peakHours.map(([hourRange, count]: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-900/40 p-2.5 rounded-xl border border-slate-800 text-xs">
                        <span className="font-semibold text-white">{hourRange}</span>
                        <span className="bg-cyan-500/20 text-cyan-300 font-black px-2.5 py-1 rounded-lg">{count} accesos</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Días Preferidos (Histórico Completo) */}
              <div className={`p-5 rounded-2xl border shadow space-y-3 ${panelBg}`}>
                <h4 className="font-extrabold text-emerald-400 text-sm uppercase tracking-wide flex items-center gap-2">
                  📅 Días de Asistencia (Histórico Total)
                </h4>
                <div className="space-y-2 pt-2">
                  {Object.entries(statsData.preferredDays).map(([day, count]: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-900/40 p-2 rounded-xl border border-slate-800 text-xs">
                      <span className="font-semibold text-white">{day}</span>
                      <span className="font-bold text-emerald-400">{count} visitas</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rangos de Edad (Todos los socios) */}
              <div className={`p-5 rounded-2xl border shadow space-y-3 ${panelBg}`}>
                <h4 className="font-extrabold text-amber-400 text-sm uppercase tracking-wide flex items-center gap-2">
                  👥 Rangos de Edad (Total Socios)
                </h4>
                <div className="space-y-2.5 pt-2">
                  {Object.entries(statsData.ageRanges).map(([range, count]: any, idx: number) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="opacity-80 font-semibold">{range} años</span>
                        <span className="font-bold text-amber-300">{count} socios</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, (count / (Object.values(statsData.ageRanges).reduce((a:any, b:any)=>a+b, 0) || 1)) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        ) : (
          <>
            {/* Filtros de Fecha y Buscador */}
            <form onSubmit={handleFilterSubmit} className={`p-4 rounded-xl shadow border flex flex-wrap gap-4 items-end justify-between ${panelBg}`}>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-semibold opacity-80 mb-1">Desde la Fecha:</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className={`border px-3 py-2 rounded-xl text-xs outline-none ${inputBg}`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold opacity-80 mb-1">Hasta la Fecha:</label>
                  <input 
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className={`border px-3 py-2 rounded-xl text-xs outline-none ${inputBg}`}
                  />
                </div>
                <button 
                  type="submit"
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow transition-colors h-[38px]"
                >
                  Filtrar Reporte
                </button>
              </div>

              <div className="w-full sm:w-auto flex-1 max-w-sm">
                <label className="block text-[11px] font-semibold opacity-80 mb-1">Buscar:</label>
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="🔍 Nombre, teléfono o código..."
                  className={`border px-3 py-2 rounded-xl text-xs outline-none w-full ${inputBg}`}
                />
              </div>
            </form>

            {/* Tabla Dinámica */}
            <div className={`rounded-xl shadow overflow-hidden border ${panelBg}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="border-b border-slate-700 opacity-75 text-xs">
                    <tr>
                      <th className="p-4">{activeTab === 'asistencia' ? 'Socio' : 'Invitado y Anfitrión'}</th>
                      <th className="p-4">Identificador</th>
                      <th className="p-4">Teléfono</th>
                      <th className="p-4 text-center">Tipo</th>
                      <th className="p-4">Fecha y Hora</th>
                      {activeTab === 'invitados' && <th className="p-4 text-center">Acciones de Ventas</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={activeTab === 'invitados' ? 6 : 5} className="p-8 text-center opacity-75">Cargando registros...</td>
                      </tr>
                    ) : filteredList.length === 0 ? (
                      <tr>
                        <td colSpan={activeTab === 'invitados' ? 6 : 5} className="p-8 text-center opacity-75">No hay registros en el rango de fechas seleccionado.</td>
                      </tr>
                    ) : (
                      filteredList.map((item) => (
                        <tr key={item.attendance_id} className="border-b border-slate-700/50 hover:bg-slate-800/40 text-sm">
                          <td className="p-4 font-semibold text-cyan-300 flex items-center gap-3">
                            {item.photo_url ? (
                              <img src={item.photo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-cyan-500" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                                {activeTab === 'asistencia' ? '👤' : '🎟️'}
                              </div>
                            )}
                            {item.customer_name}
                          </td>
                          <td className="p-4 font-mono text-amber-400 font-bold">{item.access_code}</td>
                          <td className="p-4 opacity-85">{item.customer_phone || 'N/A'}</td>
                          <td className="p-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-black ${
                              item.scan_type === 'Entrada' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                              item.scan_type === 'Salida' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                              'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {item.scan_type === 'Entrada' ? '🟢 ENTRADA' : item.scan_type === 'Salida' ? '🔵 SALIDA' : '🎟️ CORTESÍA'}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-xs opacity-90">
                            {new Date(item.created_at).toLocaleString()}
                          </td>
                          {activeTab === 'invitados' && (
                            <td className="p-4 text-center">
                              <button 
                                onClick={() => sendWhatsAppPromo(item.customer_phone, item.customer_name.split(' (')[0])}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold shadow flex items-center gap-1.5 mx-auto transition-all"
                              >
                                💬 Enviar Planes por WhatsApp
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}