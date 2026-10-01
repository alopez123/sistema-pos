'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState<'enviar' | 'solicitar' | 'historial'>('enviar');
  const [transfers, setTransfers] = useState<any[]>([]);
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [otherBranchesProducts, setOtherBranchesProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  
  const [businessId, setBusinessId] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  
  // Estados para el formulario de envío
  const [selectedTargetBranch, setSelectedTargetBranch] = useState('');
  const [selectedProductToSend, setSelectedProductToSend] = useState<any>(null);
  const [sendQuantity, setSendQuantity] = useState('');
  
  // Estado para notificaciones profesionales
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  useEffect(() => {
    let resolvedBizId = '';
    let resolvedBranchId = '';

    // 1. Priorizar currentStaff (sucursal y negocio del usuario activo)
    const staffStr = localStorage.getItem('currentStaff');
    if (staffStr) {
      try {
        const staffData = JSON.parse(staffStr);
        if (staffData.branch_id) resolvedBranchId = staffData.branch_id;
        if (staffData.business_id || staffData.busines_id) {
          resolvedBizId = staffData.business_id || staffData.busines_id;
        }
      } catch (e) {}
    }

    // 2. Respaldar con currentBranch si no se encontró en staff
    if (!resolvedBranchId || !resolvedBizId) {
      const branchStr = localStorage.getItem('currentBranch');
      if (branchStr) {
        try {
          const branchData = JSON.parse(branchStr);
          if (!resolvedBranchId && branchData.id) resolvedBranchId = branchData.id;
          if (!resolvedBizId && branchData.business_id) resolvedBizId = branchData.business_id;
        } catch (e) {}
      }
    }

    if (resolvedBizId) setBusinessId(resolvedBizId);
    if (resolvedBranchId) setBranchId(resolvedBranchId);

    if (resolvedBizId && resolvedBranchId) {
      loadData(resolvedBizId, resolvedBranchId);
    } else {
      setLoading(false);
    }
  }, []);

  const loadData = async (bId: string, brId: string) => {
    setLoading(true);
    
    // 1. Cargar sucursales del negocio
    const { data: branchData } = await supabase.rpc('get_branches_by_business', { p_business_id: bId });
    if (branchData) {
      const others = branchData.filter((b: any) => b.id !== brId);
      setBranches(others);
      if (others.length > 0) setSelectedTargetBranch(others[0].id);
    }

    // 2. Cargar mis productos para enviar
    const { data: myProdData } = await supabase.rpc('get_products_by_branch', { p_branch_id: brId });
    setMyProducts(myProdData || []);

    // 3. Cargar historial de traslados
    const { data: transferData } = await supabase
      .from('inventory_transfers')
      .select('*, product:products(name), source:branches!source_branch_id(name), dest:branches!destination_branch_id(name)')
      .or(`source_branch_id.eq.${brId},destination_branch_id.eq.${brId}`)
      .order('created_at', { ascending: false });

    // 4. Cargar productos de otras sucursales para solicitar
    const { data: stockData } = await supabase.rpc('get_products_by_business_all', {
      p_business_id: bId
    });
    
    if (stockData) {
      const otherStock = stockData.filter((p: any) => p && p.branch_id !== brId);
      setOtherBranchesProducts(otherStock);
    }

    setTransfers(transferData || []);
    setLoading(false);
  };

  const handleSendTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductToSend || !sendQuantity || parseFloat(sendQuantity) <= 0 || !selectedTargetBranch) {
      showNotification('Selecciona un producto y una cantidad válida.', 'error');
      return;
    }

    const qty = parseFloat(sendQuantity);
    if (qty > selectedProductToSend.stock) {
      showNotification('La cantidad supera el stock disponible en inventario.', 'error');
      return;
    }

    const { error } = await supabase.from('inventory_transfers').insert({
      business_id: businessId,
      product_id: selectedProductToSend.id,
      source_branch_id: branchId,
      destination_branch_id: selectedTargetBranch,
      quantity: qty,
      status: 'pendiente'
    });

    if (!error) {
      showNotification('¡Envío de stock registrado correctamente y en tránsito!', 'success');
      setSelectedProductToSend(null);
      setSendQuantity('');
      loadData(businessId, branchId);
    } else {
      showNotification('Error al registrar traslado: ' + error.message, 'error');
    }
  };

  const handleCreateTransfer = async (product: any, qty: number) => {
    const { error } = await supabase.from('inventory_transfers').insert({
      business_id: businessId,
      product_id: product.id,
      source_branch_id: product.branch_id,
      destination_branch_id: branchId,
      quantity: qty,
      status: 'pendiente'
    });
    if (!error) {
      showNotification('¡Solicitud creada con éxito!', 'success');
      loadData(businessId, branchId);
    } else {
      showNotification('Error al solicitar: ' + error.message, 'error');
    }
  };

  const completeTransfer = async (transferId: string) => {
    const { error } = await supabase.rpc('complete_transfer', { transfer_id: transferId, current_biz_id: businessId });
    if (!error) {
      showNotification('¡Traslado aceptado, inventario actualizado y categoría sincronizada!', 'success');
      loadData(businessId, branchId);
    } else {
      showNotification('Error al completar: ' + error.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen p-8 bg-[#0f172a] text-white flex items-center justify-center">
        <p className="text-sm font-bold text-emerald-400 animate-pulse">🔄 Cargando módulo de traslados...</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen p-3 sm:p-4 md:p-8 bg-[#0f172a] text-white space-y-4 sm:space-y-6 relative">
      
      {/* Notificación Flotante Profesional (Toast) */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-[90%] sm:max-w-md px-4 sm:px-5 py-3 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-3 transition-all animate-bounce ${
          notification.type === 'success' 
            ? 'bg-emerald-950/95 text-emerald-300 border-emerald-500/50 shadow-emerald-900/40' 
            : 'bg-rose-950/95 text-rose-300 border-rose-500/50 shadow-rose-900/40'
        }`}>
          <span>{notification.type === 'success' ? '✅' : '⚠️'}</span>
          <p className="break-words">{notification.message}</p>
        </div>
      )}

      {/* Encabezado Responsivo */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-[#1e293b] p-4 sm:p-6 rounded-2xl border border-slate-700 shadow-xl">
        <div className="w-full xl:w-auto">
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => router.push('/pos')}
              className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              ← Volver al POS
            </button>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-emerald-400">🔄 Módulo Completo de Traslados</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">Envía mercancía a otras sucursales o solicita reabastecimiento interno de forma segura.</p>
        </div>
        
        {/* Pestañas de Navegación 100% Responsivas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 bg-[#0f172a] p-1.5 rounded-xl border border-slate-700 w-full xl:w-auto gap-1">
          <button 
            onClick={() => setActiveTab('enviar')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${activeTab === 'enviar' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            📤 Enviar Productos
          </button>
          <button 
            onClick={() => setActiveTab('solicitar')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${activeTab === 'solicitar' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            📥 Solicitar / Pedir
          </button>
          <button 
            onClick={() => setActiveTab('historial')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${activeTab === 'historial' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            📋 Historial y Estado
          </button>
        </div>
      </div>

      {/* CONTENIDO: ENVIAR PRODUCTOS */}
      {activeTab === 'enviar' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          
          {/* Formulario de Envío */}
          <div className="bg-[#1e293b] p-4 sm:p-6 rounded-2xl border border-slate-700 shadow-xl space-y-4 xl:col-span-1">
            <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Despachar a otra Sucursal</h2>
            
            <form onSubmit={handleSendTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Sucursal Destino (Recibe):</label>
                <select 
                  value={selectedTargetBranch} 
                  onChange={e => setSelectedTargetBranch(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white font-bold outline-none cursor-pointer"
                >
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className="bg-[#0f172a] p-3 rounded-xl border border-slate-700 space-y-1">
                <label className="block text-slate-400">Producto Seleccionado:</label>
                {selectedProductToSend ? (
                  <div className="flex justify-between items-center gap-2">
                    <div className="overflow-hidden">
                      <p className="font-bold text-white text-sm truncate">{selectedProductToSend.name}</p>
                      <p className="text-emerald-400 text-[11px]">Stock disponible: {selectedProductToSend.stock}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setSelectedProductToSend(null)} 
                      className="text-rose-400 hover:text-rose-300 font-bold px-2 py-1 bg-rose-500/10 rounded shrink-0 cursor-pointer"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <p className="text-amber-400 italic text-[11px]">⚠️ Selecciona una tarjeta de la derecha para elegir un producto.</p>
                )}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Cantidad a Enviar:</label>
                <input 
                  type="number"
                  placeholder="Ej. 5"
                  value={sendQuantity}
                  onChange={e => setSendQuantity(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white font-bold outline-none"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold text-white shadow transition-all mt-2 cursor-pointer"
              >
                🚀 Registrar Envío de Stock
              </button>
            </form>
          </div>

          {/* Tarjetas de Inventario Actual */}
          <div className="bg-[#1e293b] p-4 sm:p-6 rounded-2xl border border-slate-700 shadow-xl xl:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Inventario Actual de mi Sucursal (Selecciona para Enviar)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-1">
              {myProducts.length === 0 ? (
                <p className="col-span-full text-slate-500 text-center py-6">No hay productos en esta sucursal.</p>
              ) : (
                myProducts.map((p, index) => {
                  const isSelected = selectedProductToSend?.id === p.id;
                  return (
                    <div 
                      key={p.id ? `myprod-${p.id}` : `myprod-idx-${index}`}
                      onClick={() => setSelectedProductToSend(p)}
                      className={`p-3.5 sm:p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 text-xs ${
                        isSelected 
                          ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-900/20' 
                          : 'bg-[#0f172a] border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-sm text-white line-clamp-2">{p.name}</p>
                        <p className="text-slate-400 mt-1">Stock: <span className="text-emerald-400 font-bold">{p.stock}</span></p>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Q {p.price}</span>
                        <span className={`px-2.5 py-1 rounded font-bold ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                          {isSelected ? '✓ Seleccionado' : 'Seleccionar'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* CONTENIDO: SOLICITAR PRODUCTOS */}
      {activeTab === 'solicitar' && (
        <div className="bg-[#1e293b] p-4 sm:p-6 rounded-2xl border border-slate-700 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-blue-400 uppercase tracking-wider">Solicitar Productos a otras Sucursales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[550px] overflow-y-auto pr-1">
            {otherBranchesProducts.length === 0 ? (
              <p className="col-span-full text-slate-500 text-center py-8">No hay productos disponibles en otras sucursales.</p>
            ) : (
              otherBranchesProducts.map((p, index) => (
                <div 
                  key={p.id ? `other-${p.id}-${p.branch_id || 'br'}` : `other-idx-${index}`}
                  className="bg-[#0f172a] p-4 rounded-xl border border-slate-700 flex flex-col justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-sm text-white line-clamp-2">{p.name}</p>
                    <p className="text-slate-400 mt-1">Origen: <span className="text-blue-400 font-semibold truncate block">{p.branch_name || p.branch?.name}</span></p>
                    <p className="text-slate-400">Stock: <span className="text-emerald-400 font-bold">{p.stock}</span></p>
                  </div>
                  <button 
                    onClick={() => handleCreateTransfer(p, 1)}
                    className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded-lg font-bold text-white shadow cursor-pointer transition-colors"
                  >
                    📥 Solicitar 1 Unidad
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO: HISTORIAL */}
      {activeTab === 'historial' && (
        <div className="bg-[#1e293b] p-4 sm:p-6 rounded-2xl border border-slate-700 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Historial y Control de Traslados</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Origen (Sale)</th>
                  <th className="p-3">Destino (Recibe)</th>
                  <th className="p-3">Cantidad</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-500">No hay traslados registrados.</td></tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">{t.product?.name}</td>
                      <td className="p-3 text-slate-300">{t.source?.name}</td>
                      <td className="p-3 text-slate-300">{t.dest?.name}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">{t.quantity}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${t.status === 'pendiente' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                          {t.status === 'pendiente' ? 'En Tránsito' : t.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {t.status === 'pendiente' ? (
                          t.destination_branch_id === branchId ? (
                            <button onClick={() => completeTransfer(t.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold shadow text-xs cursor-pointer">
                              📥 Aceptar y Recibir
                            </button>
                          ) : (
                            <span className="text-amber-400 font-semibold italic text-xs">🚚 En tránsito</span>
                          )
                        ) : (
                          <span className="text-slate-500 italic text-xs">Completado</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}