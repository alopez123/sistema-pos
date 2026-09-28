'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function GymFixedClassesPage({ currentBusiness, darkMode }: any) {
  const [businessId, setBusinessId] = useState(currentBusiness?.id || '')
  const [fixedClasses, setFixedClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Formulario
  const [className, setClassName] = useState('')
  const [instructorName, setInstructorName] = useState('')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  
  // Lista de horarios dinámicos: [{ day: 'Lunes', start: '14:00', end: '15:00' }]
  const [schedules, setSchedules] = useState<any[]>([
    { day: 'Lunes', start: '14:00', end: '15:00' }
  ])
  
  const [maxCapacity, setMaxCapacity] = useState('20')
  const [monthlyFee, setMonthlyFee] = useState('0.00')

  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => { setToast(null) }, 4500)
  }

  const daysOfWeekOptions = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

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
      fetchFixedClasses(bId);
    } else {
      setLoading(false);
    }
  }, [currentBusiness]);

  async function fetchFixedClasses(bId: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_gym_fixed_classes', {
        p_business_id: bId
      });
      if (error) throw error;
      setFixedClasses(data || []);
    } catch (err: any) {
      console.error("Error al cargar clases fijas:", err);
      showToast("Error al cargar clases fijas: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function handleDayToggle(day: string) {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  }

  function addScheduleRow() {
    setSchedules([...schedules, { day: 'Lunes', start: '08:00', end: '09:00' }]);
  }

  function updateScheduleRow(index: number, field: string, value: string) {
    const updated = [...schedules];
    updated[index][field] = value;
    setSchedules(updated);
  }

  function removeScheduleRow(index: number) {
    setSchedules(schedules.filter((_, i) => i !== index));
  }

  async function handleCreateFixedClass(e: React.FormEvent) {
    e.preventDefault();
    if (!className.trim() || !instructorName.trim() || schedules.length === 0) {
      return showToast("Ingresa el nombre, instructor y al menos un horario.", "error");
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('create_gym_fixed_class', {
        p_business_id: businessId,
        p_class_name: className.trim(),
        p_instructor_name: instructorName.trim(),
        p_days: selectedDays.length > 0 ? selectedDays : ['Lunes'],
        p_schedule: JSON.stringify(schedules),
        p_max_capacity: parseInt(maxCapacity) || 20,
        p_monthly_fee: parseFloat(monthlyFee) || 0.00
      });

      if (error) throw error;

      if (data.success) {
        showToast(data.message, "success");
        setClassName('');
        setInstructorName('');
        setSelectedDays([]);
        setSchedules([{ day: 'Lunes', start: '14:00', end: '15:00' }]);
        fetchFixedClasses(businessId);
      }
    } catch (err: any) {
      console.error("Error al guardar clase fija:", err);
      showToast("Error al guardar: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Deseas dar de baja esta clase fija recurrente?")) return;
    try {
      const { data, error } = await supabase.rpc('delete_gym_fixed_class', { p_class_id: id });
      if (error) throw error;
      showToast(data.message, "success");
      fetchFixedClasses(businessId);
    } catch (err: any) {
      showToast("Error al eliminar: " + err.message, "error");
    }
  }

  const themeBg = darkMode !== false ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = darkMode !== false ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const inputBg = darkMode !== false ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

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

      <div className="max-w-5xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className={`p-4 rounded-xl shadow flex justify-between items-center gap-3 border ${panelBg}`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/dashboard')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow"
            >
              ← Volver al Dashboard
            </button>
            <div>
              <h1 className="text-lg font-bold text-cyan-400">🏅 Gestión de Clases Fijas Recurrentes (Todo el Año)</h1>
              <p className="text-xs opacity-75">Configura disciplinas con múltiples horarios semanales y costos recurrentes</p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleCreateFixedClass} className={`p-6 rounded-2xl border shadow-xl space-y-4 ${panelBg}`}>
          <div className="border-b border-slate-700 pb-3">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Registrar Nueva Clase Fija Semanal</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1 opacity-95">Nombre de la Disciplina / Clase *</label>
              <input 
                type="text" 
                value={className}
                onChange={e => setClassName(e.target.value)}
                placeholder="Ej. Spinning, Yoga, CrossFit"
                className={`w-full border p-2.5 rounded-xl outline-none text-sm ${inputBg}`}
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 opacity-95">Instructor / Entrenador *</label>
              <input 
                type="text" 
                value={instructorName}
                onChange={e => setInstructorName(e.target.value)}
                placeholder="Ej. Profesor Carlos Gómez"
                className={`w-full border p-2.5 rounded-xl outline-none text-sm ${inputBg}`}
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 opacity-95">Cupo Máximo por Horario</label>
              <input 
                type="number" 
                min="1"
                value={maxCapacity}
                onChange={e => setMaxCapacity(e.target.value)}
                className={`w-full border p-2.5 rounded-xl outline-none text-sm font-bold text-amber-400 ${inputBg}`}
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 opacity-95">Costo Extra Recurrente (Mensual / Anual) (Q)</label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                value={monthlyFee}
                onChange={e => setMonthlyFee(e.target.value)}
                className={`w-full border p-2.5 rounded-xl outline-none text-sm font-bold text-emerald-400 ${inputBg}`}
                required
              />
            </div>
          </div>

          {/* Configuración de Horarios Múltiples por Día */}
          <div className="pt-2 border-t border-slate-700 space-y-3">
            <div className="flex justify-between items-center">
              <label className="font-bold text-xs text-cyan-300 uppercase">Horarios Semanales (Puedes agregar más de uno al día)</label>
              <button 
                type="button" 
                onClick={addScheduleRow}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow"
              >
                + Añadir Bloque de Horario
              </button>
            </div>

            <div className="space-y-2">
              {schedules.map((sch, index) => (
                <div key={index} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-slate-700 bg-slate-900/50">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[10px] opacity-75 mb-1">Día de la Semana</label>
                    <select 
                      value={sch.day}
                      onChange={e => updateScheduleRow(index, 'day', e.target.value)}
                      className={`w-full border p-2 rounded-lg text-xs font-semibold outline-none ${inputBg}`}
                    >
                      {daysOfWeekOptions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  <div className="w-32">
                    <label className="block text-[10px] opacity-75 mb-1">Hora Inicio</label>
                    <input 
                      type="time" 
                      value={sch.start}
                      onChange={e => updateScheduleRow(index, 'start', e.target.value)}
                      className={`w-full border p-2 rounded-lg text-xs outline-none font-mono ${inputBg}`}
                    />
                  </div>

                  <div className="w-32">
                    <label className="block text-[10px] opacity-75 mb-1">Hora Fin</label>
                    <input 
                      type="time" 
                      value={sch.end}
                      onChange={e => updateScheduleRow(index, 'end', e.target.value)}
                      className={`w-full border p-2 rounded-lg text-xs outline-none font-mono ${inputBg}`}
                    />
                  </div>

                  {schedules.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => removeScheduleRow(index)}
                      className="bg-red-600 hover:bg-red-500 text-white px-2.5 py-2 rounded-lg text-xs font-bold mt-4"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button 
              type="submit"
              disabled={saving}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-xl font-extrabold text-xs shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? 'Guardando...' : '➕ Registrar Clase Fija Recurrente'}
            </button>
          </div>
        </form>

        {/* Listado */}
        <div className={`rounded-xl shadow overflow-hidden border ${panelBg}`}>
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-bold text-sm text-cyan-400 uppercase tracking-wider">📋 Clases Fijas Recurrentes Registradas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="border-b border-slate-700 opacity-75 text-xs">
                <tr>
                  <th className="p-4">Clase / Disciplina</th>
                  <th className="p-4">Instructor</th>
                  <th className="p-4">Horarios Semanales</th>
                  <th className="p-4 text-center">Cupo</th>
                  <th className="p-4">Costo Recurrente</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center opacity-75">Cargando clases fijas...</td>
                  </tr>
                ) : fixedClasses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center opacity-75">No hay clases fijas recurrentes registradas.</td>
                  </tr>
                ) : (
                  fixedClasses.map((fc) => (
                    <tr key={fc.id} className="border-b border-slate-700/50 hover:bg-slate-800/40 text-sm">
                      <td className="p-4 font-semibold text-cyan-300">{fc.class_name}</td>
                      <td className="p-4 opacity-95">{fc.instructor_name}</td>
                      <td className="p-4 text-xs font-mono">
                        {Array.isArray(fc.schedule_ranges) && fc.schedule_ranges.map((s: any, idx: number) => (
                          <div key={idx} className="text-amber-300">
                            • {s.day}: {s.start} - {s.end}
                          </div>
                        ))}
                      </td>
                      <td className="p-4 text-center font-bold">{fc.max_capacity} pers.</td>
                      <td className="p-4 font-bold text-emerald-400" translate="no">Q {fc.monthly_fee}</td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handleDelete(fc.id)}
                          className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow transition-all"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}