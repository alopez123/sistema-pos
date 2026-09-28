'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function GymCheckInViewPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [businessId, setBusinessId] = useState('')
  const [businessData, setBusinessData] = useState<{ name: string; logo: string }>({
    name: 'Gimnasio Oficial',
    logo: ''
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const savedBiz = localStorage.getItem('currentBusiness');
    if (savedBiz) {
      try {
        const bizObj = JSON.parse(savedBiz);
        if (bizObj?.id) setBusinessId(bizObj.id);
        if (bizObj?.name) {
          setBusinessData({
            name: bizObj.name,
            logo: bizObj.logo_url || bizObj.logo || bizObj.image_url || ''
          });
        }
      } catch (e) {
        console.error("Error al leer currentBusiness:", e);
      }
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  async function handleCheckIn(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const rawValue = code.trim();
    if (!rawValue || loading) return;

    let formattedCode = rawValue;
    if (/^\d+$/.test(rawValue)) {
      const paddedNum = rawValue.padStart(7, '0');
      formattedCode = `COD-${paddedNum}`;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.rpc('process_gym_qr_scan', {
        p_qr_code: formattedCode,
        p_business_id: businessId || null
      });

      if (error) throw error;
      setResult(data);
    } catch (err: any) {
      console.error("Error al procesar acceso:", err);
      setResult({
        success: false,
        message: "Error de sistema al procesar el código: " + err.message
      });
    } finally {
      setLoading(false);
      setCode('');
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-white flex flex-col items-center justify-between p-4 md:p-8 notranslate relative" translate="no">
      
      {/* Botón de Salir / Regresar al Dashboard en la esquina superior */}
      <div className="w-full max-w-2xl flex justify-between items-center">
        <div>
          <h1 className="text-sm font-bold text-cyan-400 tracking-wider">🏋️‍♂️ CONTROL DE ACCESO</h1>
          <p className="text-[11px] opacity-60">Recepción y Garita del Gimnasio</p>
        </div>
        <button 
          onClick={() => router.push('/dashboard')}
          className="bg-red-600/25 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/40 px-4 py-2 rounded-xl text-xs font-extrabold shadow transition-all flex items-center gap-2 cursor-pointer"
        >
          🚪 Salir / Dashboard
        </button>
      </div>

      {/* Contenedor Principal de Escaneo */}
      <div className="w-full max-w-2xl space-y-6 my-auto">
        
        <div className="bg-[#131b2e] border border-slate-700/80 p-6 md:p-8 rounded-3xl shadow-2xl space-y-6 text-center">
          
          {/* Icono Grande del Gimnasio (Al doble de tamaño: w-48 h-48) */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-44 h-44 rounded-3xl bg-gradient-to-tr from-cyan-600 to-blue-500 p-1.5 shadow-2xl flex items-center justify-center border-2 border-cyan-400/40">
              {businessData.logo ? (
                <img src={businessData.logo} alt="Logo Gimnasio" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <span className="text-6xl">🏋️‍♂️</span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-black text-white mt-1">{businessData.name}</h2>
              <p className="text-xs text-cyan-400 font-semibold uppercase tracking-widest mt-0.5">Control de Asistencia</p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400 mb-1">Código de Acceso / Carnet</h3>
            <p className="text-xs opacity-60">Ingrese solo los números del carnet (ej. <span className="font-mono text-cyan-300">2</span> para COD-0000002) o escanee el código QR.</p>
          </div>

          <form onSubmit={handleCheckIn} className="space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-cyan-400 text-lg md:text-xl opacity-80">
                COD-
              </span>
              <input 
                ref={inputRef}
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="0000002..."
                className="w-full bg-[#090d16] border-2 border-slate-600 focus:border-cyan-400 text-cyan-300 font-mono text-center text-xl md:text-2xl py-4 pl-20 pr-4 rounded-2xl outline-none shadow-inner tracking-wider transition-colors"
                autoFocus
                autoComplete="off"
              />
            </div>
            <button 
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black py-4 rounded-2xl text-sm shadow-lg uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Verificando...' : 'Registrar Ingreso / Salida (Enter)'}
            </button>
          </form>
        </div>

        {/* Resultado del Acceso */}
        {result && (
          <div className={`p-6 rounded-3xl border-2 shadow-2xl flex flex-col md:flex-row items-center gap-6 animate-fadeIn ${
            result.success ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200' : 'bg-red-950/40 border-red-500 text-red-200'
          }`}>
            {result.member?.photo_url && (
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/20 shadow-md flex-shrink-0 bg-slate-800">
                <img src={result.member.photo_url} alt="Socio" className="w-full h-full object-cover" />
              </div>
            )}
            
            <div className="flex-1 text-center md:text-left space-y-1">
              <div className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-1 shadow-sm bg-black/40 text-white">
                {result.success ? (result.scan_type === 'Entrada' ? '🟢 ENTRADA REGISTRADA' : '🔵 SALIDA REGISTRADA') : '❌ ACCESO DENEGADO'}
              </div>
              <h4 className="text-xl font-extrabold text-white">{result.member?.name || 'Aviso del Sistema'}</h4>
              <p className="text-sm font-medium opacity-90">{result.message}</p>
              
              {result.success && result.member && (
                <div className="text-xs opacity-75 pt-2 flex flex-wrap gap-4 justify-center md:justify-start">
                  <span>📱 Tel: {result.member.phone || 'N/A'}</span>
                  <span>⏳ Vence: {result.member.expiry_date ? new Date(result.member.expiry_date).toLocaleDateString() : 'N/A'}</span>
                  {result.member.emergency_name && (
                    <span className="text-amber-300 font-semibold">🚨 Emergencia: {result.member.emergency_name} ({result.member.emergency_phone})</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Pie informativo */}
      <div className="w-full max-w-2xl text-center">
        <p className="text-[11px] opacity-50 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
          💡 El sistema detecta automáticamente si el socio está ingresando por primera vez en el día o si está marcando su salida.
        </p>
      </div>

    </div>
  )
}