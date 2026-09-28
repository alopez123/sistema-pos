'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function GymGuestsPage({ currentBusiness, darkMode }: any) {
  const [businessId, setBusinessId] = useState(currentBusiness?.id || '')
  const [members, setMembers] = useState<any[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  
  // Datos del invitado
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  
  const [loading, setLoading] = useState(false)
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
      fetchMembers(bId);
    } else {
      setLoading(false);
    }
  }, [currentBusiness]);

  async function fetchMembers(bId: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_gym_members_safe', {
        p_business_id: bId
      });
      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      console.error("Error al cargar socios:", err);
      showToast("Error al cargar socios: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterGuest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMemberId || !guestName.trim()) {
      return showToast("Selecciona al socio anfitrión e ingresa el nombre del invitado.", "error");
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('register_gym_guest', {
        p_business_id: businessId,
        p_member_id: parseInt(selectedMemberId),
        p_guest_name: guestName.trim(),
        p_phone: guestPhone.trim() || null,
        p_email: guestEmail.trim() || null
      });

      if (error) throw error;

      if (data.success) {
        showToast(data.message, "success");
        setGuestName('');
        setGuestPhone('');
        setGuestEmail('');
        setSelectedMemberId('');
      } else {
        showToast(data.message, "error");
      }
    } catch (err: any) {
      console.error("Error al registrar invitado:", err);
      showToast("Error al registrar invitado: " + err.message, "error");
    } finally {
      setSaving(false);
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

      <div className="max-w-2xl mx-auto w-full space-y-6">
        
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
              <h1 className="text-lg font-bold text-cyan-400">🎟️ Registro de Invitados / Prospectos</h1>
              <p className="text-xs opacity-75">Control de pases de cortesía por socio</p>
            </div>
          </div>
        </div>

        {/* Formulario de Registro */}
        <form onSubmit={handleRegisterGuest} className={`p-6 rounded-2xl border shadow-xl space-y-6 ${panelBg}`}>
          
          <div className="border-b border-slate-700 pb-3">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Información del Ingreso de Cortesía</h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Seleccionar Socio Anfitrión *</label>
              <select 
                value={selectedMemberId}
                onChange={e => setSelectedMemberId(e.target.value)}
                className={`w-full border p-3 rounded-xl outline-none text-sm font-semibold text-cyan-300 ${inputBg}`}
                required
              >
                <option value="">-- Seleccione al socio que invita --</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.customer_name} ({m.access_code || 'S/C'}) - Vence: {m.expiry_date ? new Date(m.expiry_date).toLocaleDateString() : 'N/A'}
                  </option>
                ))}
              </select>
              <p className="text-[11px] opacity-60 mt-1">El sistema verificará automáticamente cuántos pases le quedan disponibles en el mes.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block font-semibold mb-1.5 opacity-90">Nombre Completo del Invitado *</label>
                <input 
                  type="text" 
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="Ej. Carlos Mendoza"
                  className={`w-full border p-3 rounded-xl outline-none text-sm ${inputBg}`}
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1.5 opacity-90">Teléfono / WhatsApp</label>
                <input 
                  type="text" 
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  placeholder="Ej. +502 4433-2211"
                  className={`w-full border p-3 rounded-xl outline-none text-sm ${inputBg}`}
                />
              </div>

              <div className="col-span-full">
                <label className="block font-semibold mb-1.5 opacity-90">Correo Electrónico (Opcional)</label>
                <input 
                  type="email" 
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  placeholder="Ej. carlos@email.com"
                  className={`w-full border p-3 rounded-xl outline-none text-sm ${inputBg}`}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700 flex gap-3">
            <button 
              type="submit"
              disabled={saving}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-xl font-extrabold text-xs shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? 'Validando y Registrando...' : '🎟️ Registrar Ingreso de Invitado'}
            </button>
            <button 
              type="button"
              onClick={() => router.push('/dashboard')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-3 rounded-xl font-bold text-xs"
            >
              Cancelar
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}