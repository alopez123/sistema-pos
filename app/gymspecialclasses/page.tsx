'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function GymSpecialClassesPage({ currentBusiness, darkMode }: any) {
  const [businessId, setBusinessId] = useState(currentBusiness?.id || '')
  const [classList, setClassList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Formulario de nueva clase
  const [className, setClassName] = useState('')
  const [instructorName, setInstructorName] = useState('')
  const [classDate, setClassDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:00')
  const [maxCapacity, setMaxCapacity] = useState('20')
  const [price, setPrice] = useState('0.00')
  
  const [saving, setSaving] = useState(false)
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
      fetchClasses(bId);
    } else {
      setLoading(false);
    }
  }, [currentBusiness]);

  async function fetchClasses(bId: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_gym_special_classes', {
        p_business_id: bId
      });
      if (error) throw error;
      setClassList(data || []);
    } catch (err: any) {
      console.error("Error al cargar clases:", err);
      showToast("Error al cargar clases: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!className.trim() || !instructorName.trim() || !classDate || !startTime || !endTime) {
      return showToast("Por favor completa los campos obligatorios de la clase.", "error");
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('create_gym_special_class', {
        p_business_id: businessId,
        p_class_name: className.trim(),
        p_instructor_name: instructorName.trim(),
        p_class_date: classDate,
        p_start_time: startTime,
        p_end_time: endTime,
        p_max_capacity: parseInt(maxCapacity) || 20,
        p_price: parseFloat(price) || 0.00
      });

      if (error) throw error;

      if (data.success) {
        showToast(data.message, "success");
        setClassName('');
        setInstructorName('');
        fetchClasses(businessId);
      }
    } catch (err: any) {
      console.error("Error al guardar clase:", err);
      showToast("Error al guardar clase: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClass(classId: number) {
    if (!confirm("¿Estás seguro de eliminar esta clase programada?")) return;

    try {
      const { data, error } = await supabase.rpc('delete_gym_special_class', {
        p_class_id: classId
      });
      if (error) throw error;
      showToast(data.message, "success");
      fetchClasses(businessId);
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
              <h1 className="text-lg font-bold text-cyan-400">🥊 Gestión de Clases Especiales y Horarios</h1>
              <p className="text-xs opacity-75">Programa disciplinas, instructores, cupos y costos diarios</p>
            </div>
          </div>
        </div>

        {/* Formulario de Creación de Clases */}
        <form onSubmit={handleCreateClass} className={`p-6 rounded-2xl border shadow-xl space-y-4 ${panelBg}`}>
          <div className="border-b border-slate-700 pb-3">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Programar Nueva Clase o Disciplina</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="col-span-full sm:col-span-2">
              <label className="block font-semibold mb-1 opacity-90">Nombre de la Clase / Disciplina *</label>
              <input 
                type="text" 
                value={className}
                onChange={e => setClassName(e.target.value)}
                placeholder="Ej. Spinning Avanzado, Yoga, Zumba"
                className={`w-full border p-2.5 rounded-xl outline-none text-sm ${inputBg}`}
                required
              />
            </div>

            <div className="col-span-full sm:col-span-2">
              <label className="block font-semibold mb-1 opacity-90">Instructor / Entrenador *</label>
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
              <label className="block font-semibold mb-1 opacity-90">Fecha de la Clase *</label>
              <input 
                type="date" 
                value={classDate}
                onChange={e => setClassDate(e.target.value)}
                className={`w-full border p-2.5 rounded-xl outline-none text-sm ${inputBg}`}
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 opacity-90">Hora de Inicio *</label>
              <input 
                type="time" 
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className={`w-full border p-2.5 rounded-xl outline-none text-sm ${inputBg}`}
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 opacity-90">Hora de Finalización *</label>
              <input 
                type="time" 
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className={`w-full border p-2.5 rounded-xl outline-none text-sm ${inputBg}`}
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 opacity-90">Cupo Máximo</label>
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
              <label className="block font-semibold mb-1 opacity-90">Costo / Precio (Q)</label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className={`w-full border p-2.5 rounded-xl outline-none text-sm font-bold text-emerald-400 ${inputBg}`}
                required
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button 
              type="submit"
              disabled={saving}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-xl font-extrabold text-xs shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? 'Guardando...' : '➕ Programar Clase'}
            </button>
          </div>
        </form>

        {/* Listado de Clases Programadas */}
        <div className={`rounded-xl shadow overflow-hidden border ${panelBg}`}>
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-bold text-sm text-cyan-400 uppercase tracking-wider">📅 Clases y Horarios Programados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="border-b border-slate-700 opacity-75 text-xs">
                <tr>
                  <th className="p-4">Clase / Disciplina</th>
                  <th className="p-4">Instructor</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Horario</th>
                  <th className="p-4 text-center">Cupo</th>
                  <th className="p-4">Costo</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center opacity-75">Cargando clases programadas...</td>
                  </tr>
                ) : classList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center opacity-75">No hay clases especiales programadas actualmente. ¡Crea la primera arriba!</td>
                  </tr>
                ) : (
                  classList.map((c) => (
                    <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-800/40 text-sm">
                      <td className="p-4 font-semibold text-cyan-300">{c.class_name}</td>
                      <td className="p-4 opacity-90">{c.instructor_name}</td>
                      <td className="p-4 font-mono text-xs">{c.class_date}</td>
                      <td className="p-4 font-mono text-xs text-amber-300">{c.start_time} - {c.end_time}</td>
                      <td className="p-4 text-center font-bold">{c.max_capacity} pers.</td>
                      <td className="p-4 font-bold text-emerald-400" translate="no">Q {c.price}</td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handleDeleteClass(c.id)}
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