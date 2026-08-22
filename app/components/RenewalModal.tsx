'use client'
import { useState } from 'react'

export default function RenewalModal({ business, onClose }: { business: any, onClose: () => void }) {
  const [selectedBank, setSelectedBank] = useState<'BI' | 'BAM'>('BI')
  const [referenceCode, setReferenceCode] = useState('')

  const handleSendProof = () => {
    if (!referenceCode.trim()) {
      alert("Por favor ingresa el número de boleta o código de transferencia.")
      return
    }

    const phoneNumber = "50200000000" // Reemplaza con tu número de WhatsApp real con código de país
    const message = encodeURIComponent(
      `Hola Admin, he realizado el pago de mi suscripción para el negocio *${business.name}* a través de *${selectedBank}*.\n\n*Monto:* Q${business.amount || 300}\n*No. de Boleta / Referencia:* ${referenceCode}\n\nPor favor verificar y actualizar mi cuenta.`
    )

    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 notranslate" translate="no">
      <div className="bg-[#1e293b] p-6 rounded-xl border border-emerald-500 w-full max-w-md text-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-emerald-400">💳 Renovación de Suscripción</h3>
          <p className="text-xs text-slate-300">
            Tu suscripción mensual/anual requiere pago para continuar operando sin interrupciones.
          </p>
        </div>

        <div className="bg-[#0f172a] p-3 rounded-lg border border-slate-700 text-xs space-y-1">
          <p><span className="text-slate-400">Negocio:</span> <strong className="text-white">{business.name}</strong></p>
          <p><span className="text-slate-400">Monto a Pagar:</span> <strong className="text-emerald-400 text-sm">Q {business.amount || 300}</strong></p>
        </div>

        {/* SELECTOR DE BANCO */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">Selecciona el banco para escanear el QR:</label>
          <div className="grid grid-cols-2 gap-2">
            <button 
              type="button"
              onClick={() => setSelectedBank('BI')}
              className={`py-2 rounded-lg font-bold text-xs border transition-all ${
                selectedBank === 'BI' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-[#0f172a] border-slate-700 text-slate-400'
              }`}
            >
              Banco BI
            </button>
            <button 
              type="button"
              onClick={() => setSelectedBank('BAM')}
              className={`py-2 rounded-lg font-bold text-xs border transition-all ${
                selectedBank === 'BAM' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-[#0f172a] border-slate-700 text-slate-400'
              }`}
            >
              Banco BAM
            </button>
          </div>
        </div>

        {/* CONTENEDOR DE LA IMAGEN QR */}
        <div className="flex flex-col items-center justify-center bg-white p-4 rounded-lg space-y-2">
          <img 
            src={selectedBank === 'BI' ? '/qr-bi.png' : '/qr-bam.png'} 
            alt={`QR ${selectedBank}`} 
            className="w-48 h-48 object-contain"
          />
          <span className="text-[11px] font-bold text-slate-800">Escanea desde tu app de {selectedBank === 'BI' ? 'Banco Industrial' : 'BAM'}</span>
        </div>

        {/* CAMPO DE COMPROBANTE */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-300">Número de Boleta o Referencia de Pago:</label>
          <input 
            type="text"
            value={referenceCode}
            onChange={e => setReferenceCode(e.target.value)}
            placeholder="Ej. REF-98765432"
            className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-xs outline-none focus:border-emerald-500"
          />
        </div>

        <div className="space-y-2 pt-2">
          <button 
            type="button"
            onClick={handleSendProof}
            className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg text-xs font-bold transition-colors shadow-lg flex items-center justify-center gap-2"
          >
            💬 Notificar Pago por WhatsApp
          </button>
          <button 
            type="button"
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-xs text-slate-300 transition-colors"
          >
            Cerrar / Pagar Más Tarde
          </button>
        </div>

      </div>
    </div>
  )
}