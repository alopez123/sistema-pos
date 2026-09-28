'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function GymMemberClassesView({ currentBusiness, currentBranch, darkMode }: any) {
  const [businessId, setBusinessId] = useState(currentBusiness?.id || '')
  const [members, setMembers] = useState<any[]>([])
  const [specialClasses, setSpecialClasses] = useState<any[]>([])
  const [fixedClasses, setFixedClasses] = useState<any[]>([])
  const [assignedList, setAssignedList] = useState<any[]>([])
  
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [memberSearchTerm, setMemberSearchTerm] = useState('') // 🔍 Estado para buscar socio por nombre o código
  const [selectedClassId, setSelectedClassId] = useState('')
  const [classType, setClassType] = useState<'special' | 'fixed'>('special')
  const [feeCharged, setFeeCharged] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const router = useRouter()

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
      fetchAllData(bId);
    }
  }, [currentBusiness]);

  async function fetchAllData(bId: string) {
    setLoading(true);
    try {
      // 1. Obtener socios[cite: 13]
      const { data: memData } = await supabase.rpc('get_gym_members_safe', { p_business_id: bId });
      setMembers(memData || []);

      // 2. Obtener Clases Especiales (Únicas)[cite: 13]
      const { data: spData } = await supabase.rpc('get_gym_special_classes', { p_business_id: bId });
      setSpecialClasses(spData || []);

      // 3. Obtener Clases Fijas (Recurrentes)[cite: 13]
      const { data: fxData } = await supabase.rpc('get_gym_fixed_classes', { p_business_id: bId });
      setFixedClasses(fxData || []);

      // 4. Obtener asignaciones vía RPC[cite: 13]
      const { data: assData, error: assErr } = await supabase.rpc('get_gym_member_classes_assigned', { p_business_id: bId });
      if (!assErr && assData) {
        setAssignedList(assData);
      } else {
        setAssignedList([]);
      }
    } catch (err: any) {
      console.error("Error al cargar datos:", err);
      showToast("Error al cargar datos: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function handleClassSelect(val: string) {
    setSelectedClassId(val);
    const [type, id] = val.split('_');
    setClassType(type as 'special' | 'fixed');

    if (type === 'special') {
      const found = specialClasses.find((c: any) => String(c.id) === String(id));
      if (found) setFeeCharged(String(found.price || 0));
    } else {
      const found = fixedClasses.find((c: any) => String(c.id) === String(id));
      if (found) setFeeCharged(String(found.monthly_fee || 0));
    }
  }

  async function handleAssignClass(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMemberId || !selectedClassId) {
      return showToast("Selecciona un socio y una clase.", "error");
    }

    const [type, classId] = selectedClassId.split('_');

    try {
      const { data, error } = await supabase.rpc('assign_gym_member_class', {
        p_member_id: Number(selectedMemberId),
        p_class_id: Number(classId),
        p_fee_charged: parseFloat(feeCharged) || 0,
        p_start_date: startDate,
        p_business_id: businessId,
        p_class_type: type // 👈 Envía si es 'special' o 'fixed'
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.message);

      showToast("✅ Clase asignada con éxito", "success");
      setSelectedClassId('');
      setFeeCharged('');
      fetchAllData(businessId);
    } catch (err: any) {
      showToast("Error al asignar clase: " + err.message, "error");
    }
  }
  // Filtrar socios por nombre o código de acceso
  const filteredMembers = members.filter(m => 
    (m.customer_name && m.customer_name.toLowerCase().includes(memberSearchTerm.toLowerCase())) ||
    (m.access_code && m.access_code.toLowerCase().includes(memberSearchTerm.toLowerCase()))
  );

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

      <div className="max-w-6xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className={`p-4 rounded-xl shadow flex flex-wrap justify-between items-center gap-3 border ${panelBg}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow">
              ← Volver al Dashboard
            </button>
            <div>
              <h1 className="text-lg font-bold text-cyan-400">🥇 Asignación de Clases y Costos Extra</h1>
              <p className="text-xs opacity-75">Inscribe socios a disciplinas recurrentes o clases especiales</p>
            </div>
          </div>
        </div>

        {/* Formulario de Asignación */}
        <div className={`p-6 rounded-2xl shadow-xl border ${panelBg} space-y-4`}>
          <h2 className="text-sm font-extrabold text-cyan-400 uppercase tracking-wide">Inscribir Socio a Clase / Disciplina</h2>
          
          <form onSubmit={handleAssignClass} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            
            {/* Buscador y Selector de Socio */}
            <div className="space-y-2">
              <label className="block font-semibold">Buscar y Seleccionar Socio *</label>
              <input 
                type="text"
                placeholder="🔍 Filtrar por nombre o código..."
                value={memberSearchTerm}
                onChange={e => setMemberSearchTerm(e.target.value)}
                className={`w-full border p-2 rounded-xl outline-none text-xs ${inputBg}`}
              />
              <select 
                value={selectedMemberId}
                onChange={e => setSelectedMemberId(e.target.value)}
                className={`w-full border p-2.5 rounded-xl outline-none font-semibold ${inputBg}`}
                required
              >
                <option value="">-- Elija el Socio ({filteredMembers.length} disponibles) --</option>
                {filteredMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.customer_name} ({m.access_code || 'S/C'})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Seleccionar Clase / Disciplina *</label>
              <select 
                value={selectedClassId}
                onChange={e => handleClassSelect(e.target.value)}
                className={`w-full border p-2.5 rounded-xl outline-none font-semibold ${inputBg}`}
                required
              >
                <option value="">-- Elija la Clase o Especial --</option>
                <optgroup label="🥊 Clases Especiales (Únicas)">
                  {specialClasses.map((c: any) => (
                    <option key={`special_${c.id}`} value={`special_${c.id}`}>
                      {c.class_name} ({c.class_date}) - Inst. {c.instructor_name} (Q {c.price})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🏅 Clases Fijas (Recurrentes)">
                  {fixedClasses.map((c: any) => (
                    <option key={`fixed_${c.id}`} value={`fixed_${c.id}`}>
                      {c.class_name} - Inst. {c.instructor_name} (Q {c.monthly_fee})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Costo Extra Cobrado (Q)</label>
              <input 
                type="number"
                step="0.01"
                value={feeCharged}
                onChange={e => setFeeCharged(e.target.value)}
                placeholder="0.00"
                className={`w-full border p-2.5 rounded-xl outline-none font-bold ${inputBg}`}
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Fecha de Inicio *</label>
              <input 
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={`w-full border p-2.5 rounded-xl outline-none ${inputBg}`}
                required
              />
            </div>

            <div className="md:col-span-2 flex items-end">
              <button 
                type="submit"
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-3 rounded-xl uppercase tracking-wider shadow transition-all cursor-pointer"
              >
                + Asignar Clase y Costo Extra
              </button>
            </div>

          </form>
        </div>

        {/* Listado de Socios Inscritos */}
        <div className={`rounded-xl shadow overflow-hidden border ${panelBg}`}>
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-sm font-extrabold text-cyan-400 uppercase tracking-wide">📋 Socios Inscritos en Clases</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap text-xs">
              <thead className="border-b border-slate-700 opacity-75">
                <tr>
                  <th className="p-4">Socio</th>
                  <th className="p-4">Clase / Disciplina</th>
                  <th className="p-4">Instructor</th>
                  <th className="p-4">Vigencia</th>
                  <th className="p-4">Costo Extra</th>
                  <th className="p-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center opacity-75">Cargando asignaciones...</td></tr>
                ) : assignedList.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center opacity-75">No hay clases asignadas a socios.</td></tr>
                ) : (
                  assignedList.map((item: any) => {
                    const statusVal = (item.status || '').toLowerCase();
                    const isCancelled = statusVal.includes('cancelado') || statusVal.includes('inactivo');
                    return (
                      <tr key={item.assignment_id} className={`border-b border-slate-700/50 hover:bg-slate-800/40 ${isCancelled ? 'bg-red-950/30' : ''}`}>
                        <td className="p-4 font-semibold text-cyan-300">{item.customer_name}</td>
                        <td className="p-4 font-bold">{item.class_name}</td>
                        <td className="p-4 opacity-85">{item.instructor}</td>
                        <td className="p-4">{item.start_date}</td>
                        <td className="p-4 font-black text-emerald-400" translate="no">Q {Number(item.fee_charged).toFixed(2)}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                            isCancelled ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {isCancelled ? 'Cancelado' : (item.status || 'Activo')}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  )
}