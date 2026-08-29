'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AccountsPage() {
  const [activeTab, setActiveTab] = useState<'cobrar' | 'pagar'>('cobrar')
  const [receivables, setReceivables] = useState<any[]>([])
  const [payables, setPayables] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [businessId, setBusinessId] = useState<string>('')
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const router = useRouter()

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => { setToast(null) }, 4500)
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem('pos_theme')
    if (savedTheme === 'light') setIsDarkMode(false)

    const staffStr = localStorage.getItem('currentStaff')
    const bizStr = localStorage.getItem('currentBusiness')
    let bId = ''

    if (staffStr) {
      try {
        const staff = JSON.parse(staffStr)
        bId = staff.business_id || staff.busines_id
      } catch (e) {}
    }
    if (!bId && bizStr) {
      try {
        const biz = JSON.parse(bizStr)
        bId = biz.id || biz.business_id
      } catch (e) {}
    }

    if (bId) {
      setBusinessId(bId)
      loadAccountsData(bId)
    } else {
      router.push('/')
    }
  }, [router])

  async function loadAccountsData(bId: string) {
    const staffStr = localStorage.getItem('currentStaff');
    let currentBranchId = '';
    
    if (staffStr) {
      try {
        const staff = JSON.parse(staffStr);
        currentBranchId = staff.branch_id || '';
      } catch (e) {}
    }

    // Cuentas por Cobrar filtradas estrictamente por la sucursal actual del POS
    let query = supabase
      .from('sales')
      .select('id, total_amount, created_at, payment_method, status, branch_id, customer:customers(name, nit, phone)')
      .eq('business_id', bId)
      .ilike('payment_method', 'Crédito');

    if (currentBranchId) {
      query = query.eq('branch_id', currentBranchId);
    }

    const { data: recData, error: recError } = await query.order('created_at', { ascending: false });

    if (!recError && recData) {
      setReceivables(recData);
    }

    // Cuentas por Pagar filtradas por la sucursal actual
    let payQuery = supabase
      .from('purchases')
      .select('*')
      .eq('business_id', bId);

    if (currentBranchId) {
      payQuery = payQuery.eq('branch_id', currentBranchId);
    }

    const { data: payData, error: payError } = await payQuery.order('created_at', { ascending: false });

    if (!payError && payData) {
      setPayables(payData);
    }
  }

  const filteredReceivables = receivables.filter(item => {
    const custName = (item.customer?.name || '').toLowerCase()
    const custNit = (item.customer?.nit || '').toLowerCase()
    const term = searchTerm.toLowerCase()
    return custName.includes(term) || custNit.includes(term)
  })

  const totalReceivableAmount = receivables.reduce((acc, item) => acc + Number(item.total_amount || 0), 0)
  const totalPayableAmount = payables.reduce((acc, item) => acc + Number(item.total_amount || 0), 0)

  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-4 sm:p-6 flex flex-col w-full max-w-full notranslate pb-20 lg:pb-6 relative ${themeBg}`} translate="no">
      {toast && (
        <div className="fixed top-5 right-5 z-[999999] animate-bounce">
          <div className={`px-5 py-3 rounded-xl shadow-2xl border font-bold text-sm flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-red-600 text-white border-red-400'
          }`}>
            <span>{toast.type === 'success' ? '✅' : '❌'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className={`p-4 rounded-xl shadow mb-6 flex justify-between items-center border ${panelBg}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/pos')} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs font-bold text-white transition-colors">
            ⬅️ Volver al POS
          </button>
          <h1 className="text-base sm:text-xl font-bold text-emerald-500">💰 Cuentas de la Sucursal</h1>
        </div>
        <button onClick={() => router.push('/dashboard')} className="bg-red-700 hover:bg-red-600 px-3 py-2 rounded-lg text-xs font-bold text-white transition-colors">
          Salir
        </button>
      </header>

      {/* TARJETAS RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className={`p-5 rounded-xl border shadow flex justify-between items-center ${panelBg}`}>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Cuentas por Cobrar (Sucursal)</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1" translate="no">Q {totalReceivableAmount.toFixed(2)}</p>
          </div>
          <span className="text-3xl">📥</span>
        </div>

        <div className={`p-5 rounded-xl border shadow flex justify-between items-center ${panelBg}`}>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Cuentas por Pagar (Sucursal)</p>
            <p className="text-2xl font-extrabold text-amber-400 mt-1" translate="no">Q {totalPayableAmount.toFixed(2)}</p>
          </div>
          <span className="text-3xl">📤</span>
        </div>
      </div>

      {/* PESTAÑAS */}
      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => setActiveTab('cobrar')}
          className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'cobrar' ? 'bg-emerald-600 text-white shadow-lg' : `${panelBg} opacity-75`}`}
        >
          📥 Cuentas por Cobrar ({receivables.length})
        </button>
        <button 
          onClick={() => setActiveTab('pagar')}
          className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'pagar' ? 'bg-amber-600 text-white shadow-lg' : `${panelBg} opacity-75`}`}
        >
          📤 Cuentas por Pagar ({payables.length})
        </button>
      </div>

      {/* CONTENEDOR PRINCIPAL DE DATOS */}
      <div className={`p-5 rounded-xl shadow border flex-1 ${panelBg}`}>
        {activeTab === 'cobrar' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h2 className="font-bold text-base text-emerald-400">Listado de Créditos de la Sucursal</h2>
              <input 
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="🔍 Buscar por cliente o NIT..."
                className={`border px-3 py-2 rounded-xl text-xs outline-none w-64 ${inputBg}`}
              />
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[60vh] pr-1">
              {filteredReceivables.length === 0 ? (
                <p className="text-center py-12 text-slate-400 text-sm">No hay cuentas por cobrar pendientes en esta sucursal.</p>
              ) : (
                filteredReceivables.map(item => (
                  <div key={item.id} className={`p-4 rounded-xl border flex justify-between items-center flex-wrap gap-3 ${subPanelBg}`}>
                    <div>
                      <p className="font-bold text-sm text-white">{item.customer?.name || 'Cliente General'}</p>
                      <p className="text-xs text-slate-400">NIT: {item.customer?.nit || 'CF'} | Tel: {item.customer?.phone || 'No registrado'}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Fecha de Emisión: {new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <span className="text-emerald-400 font-extrabold text-base block" translate="no">Q {Number(item.total_amount).toFixed(2)}</span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">Pendiente de Cobro</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'pagar' && (
          <div className="space-y-4">
            <h2 className="font-bold text-base text-amber-400">Listado de Cuentas por Pagar (Sucursal)</h2>
            <div className="space-y-2.5 overflow-y-auto max-h-[60vh] pr-1">
              {payables.length === 0 ? (
                <p className="text-center py-12 text-slate-400 text-sm">No hay cuentas por pagar registradas en esta sucursal.</p>
              ) : (
                payables.map((item, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border flex justify-between items-center ${subPanelBg}`}>
                    <div>
                      <p className="font-bold text-sm text-white">Proveedor / Compra #{item.id || idx}</p>
                      <p className="text-xs text-slate-400">Fecha: {new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="text-amber-400 font-extrabold text-base" translate="no">Q {Number(item.total_amount || 0).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* BARRA INFERIOR MÓVIL */}
      <nav className={`lg:hidden fixed bottom-0 left-0 right-0 border-t px-2 py-2 flex justify-around items-center z-50 shadow-2xl ${panelBg}`}>
        <button onClick={() => router.push('/pos')} className="flex flex-col items-center text-xs text-slate-400 hover:text-emerald-400">
          <span className="text-lg">🛍️</span>
          <span className="text-[10px] mt-0.5 font-semibold">POS</span>
        </button>
        <button onClick={() => router.push('/cajero')} className="flex flex-col items-center text-xs text-slate-400 hover:text-emerald-400">
          <span className="text-lg">💵</span>
          <span className="text-[10px] mt-0.5 font-semibold">Caja</span>
        </button>
        <button onClick={() => router.push('/cuentas')} className="flex flex-col items-center text-xs text-emerald-400">
          <span className="text-lg">💰</span>
          <span className="text-[10px] mt-0.5 font-bold">Cuentas</span>
        </button>
      </nav>
    </div>
  )
}