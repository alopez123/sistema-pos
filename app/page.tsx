'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Estado para el número de WhatsApp del Admin consultado desde la base de datos
  const [adminPhone, setAdminPhone] = useState('50248069299') // Valor por defecto de respaldo

  // Estados renovación QR + Token
  const [showRenewalModal, setShowRenewalModal] = useState(false)
  const [pendingBusiness, setPendingBusiness] = useState<any>(null)
  const [selectedBank, setSelectedBank] = useState<'BI' | 'BAM'>('BI')
  const [referenceCode, setReferenceCode] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [inputToken, setInputToken] = useState('')
  const [validatingToken, setValidatingToken] = useState(false)

  // Estados para Modal de Cambio Obligatorio de Contraseña (Primer Uso)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [tempUserAccount, setTempUserAccount] = useState<any>(null)

  const router = useRouter()

  // Consultar el número de WhatsApp del administrador al cargar la página
  useEffect(() => {
    async function fetchAdminWhatsApp() {
      try {
        const { data, error } = await supabase.rpc('get_admin_whatsapp_phone')
        if (!error && data && data.length > 0 && data[0].whatsapp_number) {
          setAdminPhone(data[0].whatsapp_number.replace(/\D/g, ''))
        }
      } catch (e) {
        console.error("Error al obtener teléfono del admin:", e)
      }
    }
    fetchAdminWhatsApp()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Intentar inicio de sesión como Dueño de Negocio
      const { data, error } = await supabase
        .rpc('verify_business_login', { p_email: email, p_password: password })

      if (!error && data && data.length > 0) {
        const userAccount = data[0]

        if (userAccount.owner_email !== 'alopezadmin@admin.com') {
          if (userAccount.must_change_password === true) {
            setTempUserAccount(userAccount)
            setShowPasswordModal(true)
            setLoading(false)
            return
          }

          if (userAccount.payment_status === 'Pendiente' || userAccount.payment_status === 'Atrasado') {
            setPendingBusiness(userAccount)
            setShowRenewalModal(true)
            setLoading(false)
            return
          }
        }

        const status = (userAccount.status || 'activo').toLowerCase();
        if (status !== 'activo') {
          alert('Esta cuenta se encuentra ' + status + '. Contacte al soporte.')
          setLoading(false)
          return
        }

        localStorage.removeItem('currentStaff')
        localStorage.setItem('currentBusiness', JSON.stringify(userAccount))

        if (userAccount.owner_email === 'alopezadmin@admin.com') {
          router.push('/admin')
        } else {
          router.push('/dashboard')
        }
        return
      }

      // 2. Intentar inicio de sesión como Empleado / Sucursal (Staff)
      const { data: staffData, error: staffError } = await supabase
        .rpc('verify_staff_login', { p_username: email.trim().toLowerCase(), p_access_code: password.trim() })

      if (staffError || !staffData || staffData.length === 0) {
        alert('Usuario, correo o contraseña incorrectos.')
        setLoading(false)
        return
      }

      const staff = staffData[0]
      const targetBizId = staff.business_id || staff.busines_id

      // Consultar el negocio usando la función RPC segura para saltar el RLS
      const { data: bizDataList, error: bizError } = await supabase
        .rpc('get_business_status_by_id', { p_business_id: targetBizId })

      if (bizError || !bizDataList || bizDataList.length === 0) {
        alert('No se encontró información del negocio asociado.')
        setLoading(false)
        return
      }

      const bizData = bizDataList[0]

      const bizStatus = (bizData.status || 'activo').toLowerCase();
      if (bizStatus !== 'activo' && bizStatus !== 'pendiente' && bizStatus !== 'atrasado') {
        alert('Acceso denegado: El negocio se encuentra ' + bizStatus + '.')
        setLoading(false)
        return
      }

      if (bizData.payment_status === 'Pendiente' || bizData.payment_status === 'Atrasado' || bizStatus === 'pendiente' || bizStatus === 'atrasado') {
        setPendingBusiness(bizData)
        setShowRenewalModal(true)
        setLoading(false)
        return
      }

      const userRole = (staff.role || 'vendedor').trim().toLowerCase();
      const { data: branchData } = await supabase.from('branches').select('name').eq('id', staff.branch_id).single()

      localStorage.removeItem('currentBusiness')
      localStorage.setItem('currentStaff', JSON.stringify({
        id: staff.id, name: staff.name, username: staff.username || staff.email,
        branch_id: staff.branch_id, business_id: targetBizId, branch_name: branchData?.name || 'Sucursal', role: userRole
      }))

      if (userRole === 'cajero') router.push('/cajero')
      else router.push('/pos')

    } catch (err) {
      console.error("Error inesperado:", err)
      alert("Ocurrió un error al intentar ingresar.")
    } finally {
      setLoading(false)
    }
  }

  // --- FUNCIÓN DE RECUPERACIÓN DE CONTRASEÑA POR WHATSAPP MEDIANTE RPC ---
  const handleForgotPassword = async () => {
    const inputVal = email.trim();
    if (!inputVal) {
      alert("Por favor ingresa tu correo o nombre de usuario en el campo superior para identificar el negocio.");
      return;
    }

    let businessNameFound = inputVal;

    try {
      const { data, error } = await supabase.rpc('get_business_name_by_login', {
        p_input: inputVal
      });

      if (!error && data && data.length > 0 && data[0].business_name) {
        businessNameFound = data[0].business_name;
      }
    } catch (e) {
      console.error("Error al buscar negocio para recuperación:", e);
    }

    const message = encodeURIComponent(
      `Hola Admin, he olvidado la contraseña de acceso para el negocio *${businessNameFound}* (Cuenta: ${inputVal}). Por favor ayúdeme a restablecerla en Quantika POS.`
    );
    window.open(`https://wa.me/${adminPhone}?text=${message}`, '_blank');
  };
  

  const handleUpdatePassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      alert("La nueva contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (newPassword !== confirmPassword) {
      alert("Las contraseñas no coinciden.")
      return
    }

    setChangingPassword(true)
    try {
      const { error } = await supabase.rpc('update_business_password_safe', {
        p_business_id: tempUserAccount.id,
        p_new_password: newPassword.trim()
      })

      if (error) throw error

      alert("¡Contraseña actualizada con éxito! Ya puedes ingresar al sistema.")
      setShowPasswordModal(false)
      setNewPassword('')
      setConfirmPassword('')

      const updatedAccount = { ...tempUserAccount, must_change_password: false }
      localStorage.setItem('currentBusiness', JSON.stringify(updatedAccount))
      router.push('/dashboard')

    } catch (err: any) {
      alert("Error al actualizar contraseña: " + err.message)
    } finally {
      setChangingPassword(false)
    }
  }

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 500
          const MAX_HEIGHT = 500
          let width = img.width; let height = img.height
          if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
          else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
          canvas.width = width; canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Falló compresión')); }, 'image/jpeg', 0.8)
        }
        img.onerror = (error) => reject(error)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const handleSendPaymentProof = async () => {
    if (!referenceCode.trim()) {
      alert("Por favor ingresa el número de boleta o referencia de pago.")
      return
    }

    setUploadingProof(true)
    try {
      let proofUrl = ""
      if (proofFile) {
        const compressedBlob = await compressImage(proofFile)
        const fileName = `proof-${pendingBusiness.id}-${Date.now()}.jpg`
        const filePath = `proofs/${fileName}`

        await supabase.storage.from('products').upload(filePath, compressedBlob, { contentType: 'image/jpeg', upsert: true })
        const { data: pubUrl } = supabase.storage.from('products').getPublicUrl(filePath)
        proofUrl = pubUrl.publicUrl
      }

      const message = encodeURIComponent(
        `Hola Admin, he realizado el pago de mi suscripción para el negocio *${pendingBusiness?.name}* a través de *${selectedBank}*.\n\n*Monto:* Q${pendingBusiness?.amount || 300}\n*No. de Boleta / Referencia:* ${referenceCode}\n${proofUrl ? `*Comprobante:* ${proofUrl}` : ''}\n\nPor favor envíeme mi token de activación.`
      )

      window.open(`https://wa.me/${adminPhone}?text=${message}`, '_blank')
    } catch (err: any) {
      alert("Error al adjuntar comprobante: " + err.message)
    } finally {
      setUploadingProof(false)
    }
  }

  const handleActivateWithToken = async () => {
    if (!inputToken.trim()) {
      alert("Por favor ingresa el token de activación.")
      return
    }

    setValidatingToken(true)
    try {
      const { data: isValid, error } = await supabase
        .rpc('validate_and_activate_business_token', {
          p_business_id: pendingBusiness.id,
          p_token: inputToken.trim()
        })

      if (error) throw error

      if (isValid === true) {
        alert("¡Suscripción activada con éxito! Ya puedes iniciar sesión.")
        setShowRenewalModal(false)
        setInputToken('')
        setReferenceCode('')
        setProofFile(null)
        setPendingBusiness(null)
      } else {
        alert("Token incorrecto o inválido para este periodo. Verifica con el administrador.")
      }
    } catch (err: any) {
      alert("Error al validar token: " + err.message)
    } finally {
      setValidatingToken(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4 notranslate" translate="no">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-white text-3xl font-extrabold tracking-wide">Quantika <span className="text-emerald-500">POS</span></h1>
          <p className="text-slate-400 mt-2 text-sm">Sistema de gestión empresarial</p>
        </div>
        
        <form onSubmit={handleLogin} className="bg-[#1e293b] p-8 rounded-lg shadow-2xl border border-slate-700 space-y-6">
          <div>
            <label className="block text-slate-300 mb-2 text-sm font-medium">Usuario o Correo</label>
            <input 
              type="text" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-all" 
              placeholder="negocio-usuario o correo"
              required
            />
          </div>
          
          <div>
            <label className="block text-slate-300 mb-2 text-sm font-medium">Contraseña / Código de Acceso</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded text-white outline-none focus:border-emerald-500 transition-all" 
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full py-3 rounded font-bold transition-all shadow-lg ${
              loading ? 'bg-emerald-800 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-[1.02]'
            }`}
          >
            {loading ? 'Validando...' : 'Iniciar Sesión'}
          </button>

          {/* BOTÓN O ENLACE DE OLVIDÉ MI CONTRASEÑA */}
          <div className="text-center pt-1">
            <button 
              type="button"
              onClick={handleForgotPassword}
              className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </form>

        <div className="text-center mt-8 space-y-1">
          <p className="text-slate-500 text-xs">© 2026 Quantika POS - Acceso Restringido</p>
          <p className="text-emerald-400/80 text-[11px] font-semibold tracking-wider uppercase">Powered by CodeNexa Academy</p>
        </div>
      </div>

      {/* --- MODAL CAMBIO OBLIGATORIO DE CONTRASEÑA --- */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] p-6 rounded-xl border border-emerald-500 w-full max-w-sm text-white shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-emerald-400">🔒 Establecer Nueva Contraseña</h3>
              <p className="text-xs text-slate-300">Es tu primer inicio de sesión. Por seguridad, debes cambiar tu contraseña temporal.</p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nueva Contraseña:</label>
                <input 
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-xs outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirmar Nueva Contraseña:</label>
                <input 
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu nueva contraseña"
                  className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <button 
                type="button"
                onClick={handleUpdatePassword}
                disabled={changingPassword}
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg text-xs font-bold transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
              >
                {changingPassword ? 'Actualizando...' : 'Guardar y Entrar al Sistema'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE RENOVACIÓN CON QR, COMPROBANTE Y TOKEN --- */}
      {showRenewalModal && pendingBusiness && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] p-6 rounded-xl border border-emerald-500 w-full max-w-md text-white shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto">
            
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-emerald-400">💳 Renovación y Activación por Token</h3>
              <p className="text-xs text-slate-300">El negocio asociado se encuentra pendiente de pago. Escanea el QR, sube tu comprobante y pide tu token.</p>
            </div>

            <div className="bg-[#0f172a] p-3 rounded-lg border border-slate-700 text-xs space-y-1">
              <p><span className="text-slate-400">Negocio:</span> <strong className="text-white">{pendingBusiness.name}</strong></p>
              <p><span className="text-slate-400">Monto a Cancelar:</span> <strong className="text-emerald-400 text-sm">Q {pendingBusiness.amount || 300}</strong></p>
            </div>

            {/* Selector de Banco */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Selecciona el banco:</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={() => setSelectedBank('BI')}
                  className={`py-2 rounded-lg font-bold text-xs border transition-all ${selectedBank === 'BI' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-[#0f172a] border-slate-700 text-slate-400'}`}
                >
                  Banco BI
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedBank('BAM')}
                  className={`py-2 rounded-lg font-bold text-xs border transition-all ${selectedBank === 'BAM' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-[#0f172a] border-slate-700 text-slate-400'}`}
                >
                  Banco BAM
                </button>
              </div>
            </div>

            {/* QR */}
            <div className="flex flex-col items-center justify-center bg-white p-4 rounded-lg space-y-2 shadow-inner">
              <img src={selectedBank === 'BI' ? '/qr-bi.png' : '/qr-bam.png'} alt={`QR ${selectedBank}`} className="w-40 h-40 object-contain" />
              <span className="text-[11px] font-bold text-slate-800">Escanea con tu app de {selectedBank === 'BI' ? 'Banco Industrial' : 'BAM'}</span>
            </div>

            {/* Subir comprobante y Referencia */}
            <div className="space-y-3 border-t border-slate-700 pt-3">
              <label className="block text-xs font-semibold text-slate-300">1. Datos del pago y comprobante:</label>
              <input 
                type="text"
                value={referenceCode}
                onChange={e => setReferenceCode(e.target.value)}
                placeholder="No. de Boleta / Referencia"
                className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-xs outline-none focus:border-emerald-500"
              />
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Adjuntar captura de pantalla (opcional):</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => setProofFile(e.target.files?.[0] || null)}
                  className="w-full bg-[#0f172a] border border-slate-600 p-1.5 rounded text-[11px] text-white file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-emerald-600 file:text-white cursor-pointer"
                />
              </div>
              <button 
                type="button"
                onClick={handleSendPaymentProof}
                disabled={uploadingProof}
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded text-xs font-bold transition-colors shadow flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploadingProof ? 'Subiendo imagen...' : '💬 Enviar Comprobante y Pedir Token por WhatsApp'}
              </button>
            </div>

            {/* Ingresar Token de Activación */}
            <div className="space-y-2 border-t border-slate-700 pt-3">
              <label className="block text-xs font-semibold text-emerald-400">2. Ingresa el Token recibido por WhatsApp:</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={inputToken}
                  onChange={e => setInputToken(e.target.value)}
                  placeholder="Ingrese su Token"
                  className="flex-1 bg-[#0f172a] border border-emerald-500 p-2.5 rounded text-white text-xs font-bold uppercase tracking-wider outline-none"
                />
                <button 
                  type="button"
                  onClick={handleActivateWithToken}
                  disabled={validatingToken}
                  className="bg-blue-600 hover:bg-blue-500 px-4 py-2.5 rounded text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {validatingToken ? 'Validando...' : '🔓 Activar'}
                </button>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setShowRenewalModal(false)}
              className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-xs text-slate-300 transition-colors mt-2"
            >
              Cerrar Ventana
            </button>

          </div>
        </div>
      )}
    </div>
  )
}