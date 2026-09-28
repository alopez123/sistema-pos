'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function GymInscriptionsPage() {
  const [businessId, setBusinessId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [age, setAge] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  
  // Contacto de emergencia
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyRelation, setEmergencyRelation] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')

  // Planes de membresía dinámicos
  const [plans, setPlans] = useState<any[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [membershipType, setMembershipType] = useState('')
  const [amountPaid, setAmountPaid] = useState('0')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [durationMonths, setDurationMonths] = useState(1)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const router = useRouter()

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => { setToast(null) }, 4500)
  }

  useEffect(() => {
    let bId = '';
    const savedBiz = localStorage.getItem('currentBusiness');
    if (savedBiz) {
      try {
        const bizObj = JSON.parse(savedBiz);
        if (bizObj?.id) {
          bId = bizObj.id;
          setBusinessId(bId);
        }
      } catch (e) {
        console.error("Error al leer currentBusiness:", e);
      }
    }

    const savedBranch = localStorage.getItem('currentBranch');
    if (savedBranch) {
      try {
        const branchObj = JSON.parse(savedBranch);
        if (branchObj?.id) setBranchId(branchObj.id);
      } catch (e) {
        console.error("Error al leer currentBranch:", e);
      }
    }

    if (bId) {
      fetchPlans(bId);
    }
  }, []);

  async function fetchPlans(bId: string) {
    try {
      const { data, error } = await supabase.rpc('get_gym_membership_plans', { p_business_id: bId });
      if (!error && data && data.length > 0) {
        setPlans(data);
        // Seleccionar por defecto el primer plan
        handlePlanSelection(data[0].id, data);
      }
    } catch (err) {
      console.error("Error al cargar planes:", err);
    }
  }

  function handlePlanSelection(planId: string | number, planList = plans) {
    const plan = planList.find((p: any) => String(p.id) === String(planId));
    if (plan) {
      setSelectedPlanId(String(plan.id));
      setMembershipType(plan.plan_name);
      setDurationMonths(Number(plan.duration_months));
      
      // Sumar mensualidad + inscripción automáticamente
      const total = Number(plan.monthly_fee) + Number(plan.inscription_fee || 0);
      setAmountPaid(total.toString());
    }
  }

  useEffect(() => {
    if (startDate) {
      const start = new Date(startDate);
      // Soporta meses decimales (ej. 0.25 para 1 semana)
      const daysToAdd = Math.round(Number(durationMonths) * 30);
      start.setDate(start.getDate() + daysToAdd);
      setDueDate(start.toISOString().split('T')[0]);
    }
  }, [startDate, durationMonths]);

  // Cálculo automático de edad si cambia la fecha de nacimiento
  useEffect(() => {
    if (birthDate) {
      const birth = new Date(birthDate);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        calculatedAge--;
      }
      if (calculatedAge >= 0) {
        setAge(calculatedAge.toString());
      }
    }
  }, [birthDate]);

  async function compressImage(file: File, maxWidth = 400, maxHeight = 400, quality = 0.75): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          if (width > height) {
            if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
          } else {
            if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; }
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('Compresión fallida')); return }
            const compressedFile = new File([blob], file.name.split('.')[0] + ".jpg", { type: 'image/jpeg' })
            resolve(compressedFile)
          }, 'image/jpeg', quality)
        }
      }
      reader.onerror = (error) => reject(error)
    })
  }

  async function handleRegisterInscription(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !businessId) {
      return showToast("Por favor ingresa el nombre completo del socio.", "error");
    }

    setIsSubmitting(true);
    try {
      let photoUrl = null;
      if (imageFile) {
        const optimizedFile = await compressImage(imageFile);
        const fileName = `gym_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('products').upload(fileName, optimizedFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('products').getPublicUrl(fileName);
        photoUrl = data.publicUrl;
      }

      // 1. Inscribir socio mediante la función RPC
      const { data, error } = await supabase.rpc('create_gym_member_safe', {
        p_business_id: businessId,
        p_full_name: fullName.trim(),
        p_phone: phone.trim() || null,
        p_membership_type: membershipType.trim(),
        p_start_date: startDate || null,
        p_due_date: dueDate || null,
        p_birth_date: birthDate || null,
        p_age: age ? parseInt(age) : null,
        p_photo_url: photoUrl,
        p_access_code: customCode.trim() || null,
        p_emergency_name: emergencyName.trim() || null,
        p_emergency_relation: emergencyRelation.trim() || null,
        p_emergency_phone: emergencyPhone.trim() || null
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.message || 'Error al registrar socio');

      const newMemberId = data.member_id;

      // 2. Registrar el pago inicial en la tabla de ventas
      const numericAmount = parseFloat(amountPaid) || 0;
      if (numericAmount > 0 && newMemberId) {
        const ticketNum = Math.floor(1000 + Math.random() * 9000);
        await supabase.from('sales').insert({
          business_id: businessId,
          branch_id: branchId || null,
          total_amount: numericAmount,
          status: 'Completada',
          payment_method: 'efectivo',
          order_number: ticketNum,
          created_at: new Date().toISOString()
        });
      }

      showToast("✅ ¡Socio inscrito y pago registrado con éxito!", "success");
      
      setTimeout(() => {
        router.push('/gymmembersview');
      }, 2000);

    } catch (err: any) {
      console.error("Error al inscribir:", err);
      showToast("Error al registrar inscripción: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const themeBg = 'bg-[#0f172a] text-white';
  const panelBg = 'bg-[#1e293b] border-slate-700 text-white shadow-xl';
  const inputBg = 'bg-[#0f172a] text-white border-slate-600 focus:border-cyan-500';

  return (
    <div className={`min-h-screen p-4 md:p-8 flex flex-col notranslate relative ${themeBg}`} translate="no">
      
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

      <div className="max-w-3xl mx-auto w-full space-y-6">
        
        <div className={`p-4 rounded-2xl shadow flex items-center justify-between border ${panelBg}`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/dashboard')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow transition-colors"
            >
              ← Volver al Dashboard
            </button>
            <div>
              <h1 className="text-lg font-extrabold text-cyan-400">📝 Módulo de Inscripciones y Planes</h1>
              <p className="text-xs opacity-75">Alta de socios, foto, contacto de emergencia y membresías</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/gymmembersview')}
            className="text-xs bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 px-3 py-2 rounded-xl font-bold transition-all"
          >
            📋 Ver Listado de Socios
          </button>
        </div>

        <form onSubmit={handleRegisterInscription} className={`p-6 md:p-8 rounded-2xl border space-y-6 ${panelBg}`}>
          
          <div className="border-b border-slate-700 pb-3">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">1. Datos Personales y Fotografía</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Nombre Completo del Socio *</label>
              <input 
                type="text" 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Ej. Juan Carlos Morales"
                className={`w-full border p-3 rounded-xl outline-none text-sm ${inputBg}`}
                required
              />
            </div>
            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Teléfono / WhatsApp</label>
              <input 
                type="text" 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Ej. +502 5555-4444"
                className={`w-full border p-3 rounded-xl outline-none text-sm ${inputBg}`}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Fecha de Nacimiento</label>
              <input 
                type="date" 
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                className={`w-full border p-3 rounded-xl outline-none text-sm ${inputBg}`}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Edad del Socio (Autocalculada)</label>
              <input 
                type="number" 
                min="1" max="120"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="Ej. 25"
                className={`w-full border p-3 rounded-xl outline-none text-sm font-bold text-amber-300 ${inputBg}`}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Fotografía del Socio</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={e => setImageFile(e.target.files?.[0] || null)}
                className="text-xs opacity-75 file:bg-cyan-600 file:text-white file:border-0 file:p-2.5 file:rounded-xl w-full cursor-pointer"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Código de Acceso (Opcional)</label>
              <input 
                type="text" 
                value={customCode}
                onChange={e => setCustomCode(e.target.value)}
                placeholder="Vacío para autogenerar (COD-0000001)"
                className={`w-full border p-3 rounded-xl outline-none text-sm font-mono text-amber-400 ${inputBg}`}
              />
            </div>
          </div>

          <div className="border-b border-slate-700 pt-2 pb-3">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">2. Contacto de Emergencia</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Nombre del Contacto</label>
              <input 
                type="text" 
                value={emergencyName}
                onChange={e => setEmergencyName(e.target.value)}
                placeholder="Ej. María López"
                className={`w-full border p-3 rounded-xl outline-none text-sm ${inputBg}`}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Parentesco</label>
              <input 
                type="text" 
                value={emergencyRelation}
                onChange={e => setEmergencyRelation(e.target.value)}
                placeholder="Ej. Esposa, Madre, Hermano"
                className={`w-full border p-3 rounded-xl outline-none text-sm ${inputBg}`}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Teléfono de Emergencia</label>
              <input 
                type="text" 
                value={emergencyPhone}
                onChange={e => setEmergencyPhone(e.target.value)}
                placeholder="Ej. +502 4444-3333"
                className={`w-full border p-3 rounded-xl outline-none text-sm ${inputBg}`}
              />
            </div>
          </div>

          <div className="border-b border-slate-700 pt-2 pb-3">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">3. Configuración de la Membresía (Planes Configurados)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Seleccionar Plan / Servicio *</label>
              <select 
                value={selectedPlanId}
                onChange={e => handlePlanSelection(e.target.value)}
                className={`w-full border p-3 rounded-xl outline-none text-sm font-semibold text-cyan-300 ${inputBg}`}
                required
              >
                {plans.length === 0 ? (
                  <option value="">Cargando planes o crea uno en Settings...</option>
                ) : (
                  plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.plan_name} (Q {Number(p.monthly_fee).toFixed(2)}/mes + Q {Number(p.inscription_fee || 0).toFixed(2)} insc.)
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Duración del Plan</label>
              <input 
                type="text"
                disabled
                value={`${durationMonths} Mes(es)`}
                className={`w-full border p-3 rounded-xl outline-none text-sm font-semibold opacity-80 ${inputBg}`}
              />
            </div>

            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Fecha de Inicio *</label>
              <input 
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={`w-full border p-3 rounded-xl outline-none text-sm ${inputBg}`}
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1.5 opacity-90 text-amber-400">Fecha de Vencimiento (Automática) *</label>
              <input 
                type="date" 
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className={`w-full border p-3 rounded-xl outline-none text-sm font-bold text-amber-300 ${inputBg}`}
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Monto Total a Cancelar (Mensualidad + Inscripción)</label>
              <input 
                type="number" 
                step="0.01"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                className={`w-full border p-3 rounded-xl outline-none text-sm font-bold text-emerald-400 ${inputBg}`}
              />
            </div>

            <div>
              <label className="block font-semibold mb-1.5 opacity-90">Notas u Observaciones</label>
              <input 
                type="text" 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ej. Pago en efectivo / Promoción especial"
                className={`w-full border p-3 rounded-xl outline-none text-sm ${inputBg}`}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700 flex gap-3">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white py-3.5 rounded-xl font-extrabold text-sm shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Registrando Socio...' : '💾 Registrar Inscripción y Generar Carnet QR'}
            </button>
            <button 
              type="button"
              onClick={() => router.push('/gymmembersview')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-3.5 rounded-xl font-bold text-sm transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}