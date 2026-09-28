'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function GymSettingsView({ currentBusiness, darkMode }: any) {
  const [businessId, setBusinessId] = useState(currentBusiness?.id || '')
  const [guestLimit, setGuestLimit] = useState<number | ''>(3)
  const [penaltyPercent, setPenaltyPercent] = useState<number | ''>(10.00)
  const [businessName, setBusinessName] = useState('Gym Demo')
  
  // Estados para la gestión de Planes de Membresía
  const [plans, setPlans] = useState<any[]>([])
  const [planName, setPlanName] = useState('')
  const [durationMonths, setDurationMonths] = useState(1)
  const [monthlyFee, setMonthlyFee] = useState('')
  const [inscriptionFee, setInscriptionFee] = useState('')

  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingPlan, setIsAddingPlan] = useState(false)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const router = useRouter()

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => { setToast(null) }, 4500)
  }

  useEffect(() => {
    let bId = currentBusiness?.id;
    let bName = currentBusiness?.name || 'Gym Demo';

    const savedBiz = localStorage.getItem('currentBusiness');
    if (savedBiz) {
      try {
        const bizObj = JSON.parse(savedBiz);
        if (bizObj?.id) bId = bizObj.id;
        if (bizObj?.name) bName = bizObj.name;
      } catch (e) {
        console.error("Error al leer currentBusiness:", e);
      }
    }

    if (bId) {
      setBusinessId(bId);
      setBusinessName(bName);
      fetchSettings(bId);
      fetchPlans(bId);
    } else {
      setLoading(false);
    }
  }, [currentBusiness]);

  async function fetchSettings(bId: string) {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', bId)
        .single();

      if (error) throw error;
      if (data) {
        setGuestLimit(data.monthly_guest_limit ?? 3);
        setPenaltyPercent(data.cancellation_penalty_percent ?? 10.00);
      }
    } catch (err: any) {
      console.error("Error al cargar configuración:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlans(bId: string) {
    try {
      const { data, error } = await supabase.rpc('get_gym_membership_plans', { p_business_id: bId });
      if (!error && data) {
        setPlans(data);
      }
    } catch (err: any) {
      console.error("Error al cargar planes:", err);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;

    setIsSaving(true);
    try {
      const { data, error } = await supabase.rpc('update_gym_settings', {
        p_business_id: businessId,
        p_monthly_guest_limit: Number(guestLimit) || 0,
        p_cancellation_penalty_percent: Number(penaltyPercent) || 0
      });

      if (error) throw error;

      if (data && data.success) {
        showToast("✅ Configuración guardada con éxito", "success");
      } else {
        throw new Error(data?.message || "No se pudo actualizar");
      }
    } catch (err: any) {
      console.error("Error al guardar:", err);
      showToast("Error al guardar: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planName.trim() || !monthlyFee) {
      return showToast("Ingresa el nombre del plan y la cuota mensual.", "error");
    }

    setIsAddingPlan(true);
    try {
      const { data, error } = await supabase.rpc('save_gym_membership_plan', {
        p_business_id: businessId,
        p_plan_name: planName.trim(),
        p_duration_months: Number(durationMonths) || 1,
        p_monthly_fee: parseFloat(monthlyFee) || 0,
        p_inscription_fee: parseFloat(inscriptionFee) || 0
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.message);

      showToast("✅ Plan agregado con éxito", "success");
      setPlanName('');
      setMonthlyFee('');
      setInscriptionFee('');
      setDurationMonths(1);
      fetchPlans(businessId);
    } catch (err: any) {
      showToast("Error al agregar plan: " + err.message, "error");
    } finally {
      setIsAddingPlan(false);
    }
  }

  async function handleDeletePlan(planId: number) {
    if (!confirm("¿Estás seguro de eliminar este plan?")) return;

    try {
      const { data, error } = await supabase.rpc('delete_gym_membership_plan', {
        p_plan_id: planId,
        p_business_id: businessId
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.message);

      showToast("🗑️ Plan eliminado", "success");
      fetchPlans(businessId);
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

      <div className="max-w-4xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className={`p-4 rounded-xl shadow flex justify-between items-center border ${panelBg}`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/dashboard')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow"
            >
              ← Volver al Dashboard
            </button>
            <div>
              <h1 className="text-lg font-bold text-cyan-400">⚙️ Configuración del Gimnasio</h1>
              <p className="text-xs opacity-75">Parámetros generales, políticas y planes de membresía</p>
            </div>
          </div>
        </div>

        {/* 1. Formulario de Parámetros Generales */}
        <form onSubmit={handleSaveSettings} className={`p-6 rounded-xl shadow border space-y-6 ${panelBg}`}>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-cyan-300 border-b border-slate-700 pb-3">
            Parámetros del Establecimiento: {businessName}
          </h2>

          {loading ? (
            <p className="text-center py-6 text-xs opacity-75">Cargando parámetros...</p>
          ) : (
            <div className="space-y-4 max-w-lg text-xs">
              <div>
                <label className="block font-semibold mb-1">Límite de Invitados Mensuales por Socio</label>
                <input 
                  type="number"
                  value={guestLimit}
                  onChange={e => setGuestLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  className={`w-full border p-2.5 rounded-xl outline-none font-bold ${inputBg}`}
                  min="0"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-amber-300">Porcentaje de Penalización por Cancelación Anticipada (%)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={penaltyPercent}
                  onChange={e => setPenaltyPercent(e.target.value === '' ? '' : Number(e.target.value))}
                  className={`w-full border p-2.5 rounded-xl outline-none font-bold text-amber-400 ${inputBg}`}
                  min="0"
                  max="100"
                />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-700">
            <button 
              type="submit"
              disabled={isSaving || loading}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : '💾 Guardar Parámetros'}
            </button>
          </div>
        </form>

        {/* 2. Sección de Gestión de Planes y Tarifas */}
        <div className={`p-6 rounded-xl shadow border space-y-6 ${panelBg}`}>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-cyan-300 border-b border-slate-700 pb-3">
            🏋️‍♂️ Tipos de Planes, Cuotas Mensuales e Inscripción
          </h2>

          <form onSubmit={handleAddPlan} className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs items-end">
            <div className="md:col-span-2">
              <label className="block font-semibold mb-1">Nombre del Plan *</label>
              <input 
                type="text"
                placeholder="Ej. Mensualidad General Full Access"
                value={planName}
                onChange={e => setPlanName(e.target.value)}
                className={`w-full border p-2.5 rounded-xl outline-none ${inputBg}`}
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Duración (Meses)</label>
              <select 
                value={durationMonths}
                onChange={e => setDurationMonths(Number(e.target.value))}
                className={`w-full border p-2.5 rounded-xl outline-none font-semibold ${inputBg}`}
              >
                <option value={0.25}>1 Semana</option>
                <option value={1}>1 Mes</option>
                <option value={3}>3 Meses</option>
                <option value={6}>6 Meses</option>
                <option value={12}>12 Meses</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Cuota Mensual (Q) *</label>
              <input 
                type="number"
                step="0.01"
                placeholder="150.00"
                value={monthlyFee}
                onChange={e => setMonthlyFee(e.target.value)}
                className={`w-full border p-2.5 rounded-xl outline-none font-bold text-emerald-400 ${inputBg}`}
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Inscripción (Q)</label>
              <input 
                type="number"
                step="0.01"
                placeholder="0.00"
                value={inscriptionFee}
                onChange={e => setInscriptionFee(e.target.value)}
                className={`w-full border p-2.5 rounded-xl outline-none font-bold text-amber-400 ${inputBg}`}
              />
            </div>

            <div className="md:col-span-5 pt-2">
              <button 
                type="submit"
                disabled={isAddingPlan}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl shadow transition-all disabled:opacity-50"
              >
                {isAddingPlan ? 'Agregando...' : '+ Crear y Guardar Plan'}
              </button>
            </div>
          </form>

          {/* Listado de Planes Existentes */}
          <div className="pt-4 border-t border-slate-700">
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-75 mb-3">Planes Activos Configurados</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="border-b border-slate-700 opacity-75">
                  <tr>
                    <th className="p-3">Nombre del Plan</th>
                    <th className="p-3">Duración</th>
                    <th className="p-3">Cuota Mensual</th>
                    <th className="p-3">Inscripción</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center opacity-60">No hay planes creados aún.</td></tr>
                  ) : (
                    plans.map((p: any) => (
                      <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-cyan-300">{p.plan_name}</td>
                        <td className="p-3">{p.duration_months} Mes(es)</td>
                        <td className="p-3 font-extrabold text-emerald-400">Q {Number(p.monthly_fee).toFixed(2)}</td>
                        <td className="p-3 font-bold text-amber-400">Q {Number(p.inscription_fee || 0).toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => handleDeletePlan(p.id)}
                            className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-1 rounded-lg text-[10px] font-bold transition-all"
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
    </div>
  )
}