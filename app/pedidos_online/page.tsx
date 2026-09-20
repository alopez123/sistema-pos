'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function PedidosOnlinePOSView() {
  const [isMounted, setIsMounted] = useState(false)
  const [business, setBusiness] = useState<any>(null)
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [isStaff, setIsStaff] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  const [subTab, setSubTab] = useState<'pendientes' | 'despachados' | 'historial'>('pendientes')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
    loadPOSSession()
  }, [])

  async function loadPOSSession() {
    setLoading(true)
    try {
      const savedStaff = localStorage.getItem('currentStaff')
      let bizId = ''
      let branchId = ''

      if (savedStaff) {
        const staff = JSON.parse(savedStaff)
        bizId = staff.business_id || staff.busines_id
        branchId = staff.branch_id
      }

      if (!bizId) {
        const savedBiz = localStorage.getItem('business') || localStorage.getItem('marketuser')
        let bizData = savedBiz ? JSON.parse(savedBiz) : null

        if (!bizData?.id) {
          const { data: defaultBiz } = await supabase.from('businesses').select('*').limit(1).single()
          bizData = defaultBiz
        }
        bizId = bizData?.id
      }

      if (bizId) {
        const { data: bizData } = await supabase.from('businesses').select('*').eq('id', bizId).single()
        setBusiness(bizData)

        const { data: branchData } = await supabase
          .from('branches')
          .select('*')
          .eq('business_id', bizId)

        if (branchData && branchData.length > 0) {
          if (savedStaff && branchId) {
            setIsStaff(true)
            const assignedBranch = branchData.find(b => b.id === branchId) || branchData[0]
            setBranches([assignedBranch])
            setSelectedBranchId(assignedBranch.id)
            fetchOrders(bizId, assignedBranch.id)
          } else {
            setBranches(branchData)
            const targetBranch = branchData[0].id
            setSelectedBranchId(targetBranch)
            fetchOrders(bizId, targetBranch)
          }
        }
      }
    } catch (err) {
      console.error('Error cargando sesión POS:', err)
    } finally {
      setLoading(false)
    }
  }

  // CONSULTA DIRECTA Y SEGURA DE PEDIDOS (Evita bloqueos de RPC)
  async function fetchOrders(bizId: string, branchId: string) {
    if (!bizId) return
    setLoading(true)
    
    // Filtramos estrictamente por el business_id del negocio activo ("20c4b0fd...") 
    // pero traemos todos los pedidos para que las pestañas los clasifiquen bien
    const { data, error } = await supabase
      .from('marketguate_orders')
      .select('*')
      .eq('business_id', bizId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Error al cargar pedidos:", error.message)
      setOrders([])
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }

  function handleBranchChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (isStaff) return
    const newBranchId = e.target.value
    setSelectedBranchId(newBranchId)
    if (business?.id) {
      fetchOrders(business.id, newBranchId)
    }
  }

  // 1. DESPACHAR PEDIDO (Rebaja stock y cambia estatus a 'despachado')
  async function handleFulfillOrder(order: any) {
    const targetBranchId = getTargetBranchId();
    if (!targetBranchId) return;

    if (!order || order.id === undefined) {
      alert("Error: No se encontró el ID del pedido.");
      return;
    }

    const { error: updateErr } = await supabase
      .from('marketguate_orders')
      .update({ status: 'despachado' })
      .eq('id', order.id);

    if (updateErr) {
      alert("Error al actualizar el estado del pedido: " + updateErr.message);
      return;
    }

    const items = Array.isArray(order.cart_items) ? order.cart_items : [];
    for (const item of items) {
      const productId = item.id;
      const quantity = Number(item.quantity) || 0;

      if (productId && quantity > 0) {
        await supabase.rpc('add_stock_to_product', {
          p_branch_id: targetBranchId,
          p_product_id: productId,
          p_quantity: -quantity
        });

        await supabase.from('inventory_movements').insert({
          business_id: order.business_id,
          branch_id: targetBranchId,
          product_id: productId,
          quantity: -quantity,
          movement_type: 'venta_online',
          created_at: new Date().toISOString()
        });
      }
    }

    setToastMessage("✅ ¡Pedido despachado! Stock rebajado y estatus actualizado.");
    setTimeout(() => setToastMessage(null), 3500);
    refreshOrders(order.business_id, targetBranchId);
  }

  // 2. CONFIRMAR ENTREGA (Cambia estatus a 'entregado')
  async function handleMarkAsDelivered(order: any) {
    const { error } = await supabase
      .from('marketguate_orders')
      .update({ status: 'entregado' })
      .eq('id', order.id);

    if (error) {
      alert("Error al actualizar el estado: " + error.message);
      return;
    }

    setToastMessage("🟢 ¡Pedido marcado como entregado con éxito!");
    setTimeout(() => setToastMessage(null), 3500);
    refreshOrders(order.business_id, getTargetBranchId());
  }

  // 3. MARCAR COMO DEVUELTO / RECHAZADO (Restaura stock y cambia estatus a 'devuelto')
  async function handleReturnOrder(order: any) {
    if (!confirm("¿El cliente rechazó o devolvió el pedido? Esto devolverá los artículos al inventario.")) return;

    const targetBranchId = getTargetBranchId();
    if (!targetBranchId) return;

    const { error: updateErr } = await supabase
      .from('marketguate_orders')
      .update({ status: 'devuelto' })
      .eq('id', order.id);

    if (updateErr) {
      alert("Error al registrar la devolución: " + updateErr.message);
      return;
    }

    const items = Array.isArray(order.cart_items) ? order.cart_items : [];
    for (const item of items) {
      const productId = item.id;
      const quantity = Number(item.quantity) || 0;

      if (productId && quantity > 0) {
        await supabase.rpc('add_stock_to_product', {
          p_branch_id: targetBranchId,
          p_product_id: productId,
          p_quantity: quantity 
        });

        await supabase.from('inventory_movements').insert({
          business_id: order.business_id,
          branch_id: targetBranchId,
          product_id: productId,
          quantity: quantity,
          movement_type: 'devolucion',
          created_at: new Date().toISOString()
        });
      }
    }

    setToastMessage("🔄 Pedido devuelto. Stock restaurado al inventario.");
    setTimeout(() => setToastMessage(null), 3500);
    refreshOrders(order.business_id, targetBranchId);
  }

  // 4. CANCELAR ORDEN
  async function handleCancelOrder(order: any) {
    if (!confirm("¿Estás seguro de que deseas cancelar este pedido?")) return;

    const { error: updateErr } = await supabase
      .from('marketguate_orders')
      .update({ status: 'cancelado' })
      .eq('id', order.id);

    if (updateErr) {
      alert("Error al cancelar el pedido: " + updateErr.message);
      return;
    }

    setToastMessage("❌ Pedido cancelado correctamente.");
    setTimeout(() => setToastMessage(null), 3500);
    refreshOrders(order.business_id, getTargetBranchId());
  }

  function getTargetBranchId() {
    const savedStaff = localStorage.getItem('currentStaff');
    let targetBranchId = "";
    if (savedStaff) {
      try {
        const staff = JSON.parse(savedStaff);
        targetBranchId = staff.branch_id;
      } catch (e) {}
    }
    if (!targetBranchId) targetBranchId = selectedBranchId;
    if (!targetBranchId || targetBranchId.length < 10) {
      alert("⚠️ Error: No se encontró un ID de sucursal válido.");
      return null;
    }
    return targetBranchId;
  }

  function refreshOrders(bizId: string, branchId: string) {
    const finalBizId = business?.id || bizId;
    if (finalBizId && branchId) {
      fetchOrders(finalBizId, branchId);
    }
  }

  const printOrderTicket = (order: any) => {
    const printWindow = window.open('', '_blank', 'width=500,height=700');
    if (!printWindow) return;

    const items = Array.isArray(order.cart_items) ? order.cart_items : [];
    const itemsHtml = items.map((i: any) => `
      <tr>
        <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: center;">${i.quantity}</td>
        <td style="padding: 6px 0; border-bottom: 1px solid #eee;">${i.name}</td>
        <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: right;">Q ${Number(i.price).toFixed(2)}</td>
        <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: right;">Q ${Number(i.price * i.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Comprobante Pedido #${order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 0; padding: 15px; }
            h3 { margin: 0 0 5px 0; font-size: 15px; text-align: left; border-bottom: 2px solid #000; padding-bottom: 5px; }
            p { margin: 3px 0; font-size: 11px; }
            .section { margin-top: 10px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; }
            th { border-bottom: 2px solid #000; text-align: left; font-size: 11px; padding-bottom: 4px; }
            th.center, td.center { text-align: center; }
            th.right, td.right { text-align: right; }
            .total-box { margin-top: 15px; border-top: 2px solid #000; padding-top: 5px; text-align: right; font-size: 14px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h3>MARKETGUATE - COMPROBANTE DE PEDIDO</h3>
          <div class="section">
            <p><strong>Fecha:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            <p><strong>Pedido ID:</strong> #${order.id}</p>
          </div>
          <div class="section">
            <p><strong>Datos del Cliente:</strong></p>
            <p><strong>Nombre:</strong> ${order.customer_name || 'N/A'}</p>
            <p><strong>Teléfono:</strong> ${order.customer_phone || 'N/A'}</p>
            <p><strong>Dirección:</strong> ${order.customer_address || 'N/A'}</p>
          </div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th class="center">Cant.</th>
                  <th>Descripción</th>
                  <th class="right">Precio</th>
                  <th class="right">Subtotal</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          </div>
          <div class="total-box">TOTAL: Q ${Number(order.total).toFixed(2)}</div>
          <script>window.onload = function() { window.focus(); setTimeout(() => { window.print(); }, 400); }</script>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!isMounted || loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-[#070b12] text-white' : 'bg-slate-100 text-slate-900'} flex items-center justify-center`} suppressHydrationWarning>
        <p className="text-cyan-500 font-bold text-sm animate-pulse">Cargando Pedidos Online de Quantika POS...</p>
      </div>
    )
  }

  const currentBranchObj = branches.find(b => b.id === selectedBranchId);
  const currentBranchName = currentBranchObj ? currentBranchObj.name : (business?.name || 'Comercio');
  
  const filteredOrders = orders.filter(o => {
    const st = (o.status || 'pendiente').toLowerCase().trim();
    if (subTab === 'pendientes') return st === 'pendiente';
    if (subTab === 'despachados') return st === 'despachado';
    if (subTab === 'historial') return st === 'entregado' || st === 'devuelto' || st === 'cancelado';
    return true;
  });

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#070b12] text-white' : 'bg-slate-100 text-slate-900'} font-sans p-4 sm:p-8 transition-colors`} suppressHydrationWarning>
      
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl text-xs font-black animate-bounce">
          {toastMessage}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className={`${darkMode ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-300 shadow-lg'} border rounded-3xl p-6 flex flex-col md:flex-row justify-between items-center gap-4`}>
          <div className="space-y-1 text-center md:text-left">
            <span className="bg-cyan-500/25 text-cyan-400 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border border-cyan-500/30">
              Quantika POS — Panel de Cocina / Mostrador
            </span>
            <h1 className="text-xl sm:text-2xl font-black">{currentBranchName}</h1>
            <p className="text-xs text-slate-400">Administra, imprime y despacha los pedidos entrantes de MarketGuate en tiempo real.</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-center md:justify-end">
            {branches.length > 0 && (
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <label htmlFor="branch-select" className="text-[10px] font-bold text-slate-400">Seleccionar Sucursal:</label>
                <select 
                  id="branch-select"
                  value={selectedBranchId}
                  onChange={handleBranchChange}
                  disabled={isStaff}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border outline-none disabled:opacity-75 disabled:cursor-not-allowed ${darkMode ? 'bg-[#070b12] border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'}`}
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2 mt-4 md:mt-5">
              <button 
                onClick={() => {
                  if (business?.id && selectedBranchId) {
                    fetchOrders(business.id, selectedBranchId)
                    setToastMessage("🔄 Pedidos actualizados")
                    setTimeout(() => setToastMessage(null), 2000)
                  }
                }}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow"
              >
                🔄 Actualizar
              </button>

              <button 
                onClick={() => router.push('/pos')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"
              >
                👈 Regresar al POS
              </button>
            </div>
          </div>
        </div>

        {/* PESTAÑAS DE NAVEGACIÓN */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 bg-[#111827] p-1.5 rounded-2xl border border-slate-800 max-w-lg">
            <button 
              onClick={() => setSubTab('pendientes')}
              className={`py-2 rounded-xl font-bold text-xs transition-all ${subTab === 'pendientes' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              🟡 Pendientes ({orders.filter(o => (o.status || 'pendiente').toLowerCase().trim() === 'pendiente').length})
            </button>
            <button 
              onClick={() => setSubTab('despachados')}
              className={`py-2 rounded-xl font-bold text-xs transition-all ${subTab === 'despachados' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              🚚 Despachados ({orders.filter(o => (o.status || '').toLowerCase().trim() === 'despachado').length})
            </button>
            <button 
              onClick={() => setSubTab('historial')}
              className={`py-2 rounded-xl font-bold text-xs transition-all ${subTab === 'historial' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              📂 Historial ({orders.filter(o => {
                const s = (o.status || '').toLowerCase().trim();
                return s === 'entregado' || s === 'devuelto' || s === 'cancelado';
              }).length})
            </button>
          </div>

          {filteredOrders.length === 0 ? (
            <div className={`text-center py-24 ${darkMode ? 'bg-[#111827] border-slate-800 text-slate-400' : 'bg-white border-slate-300 shadow-md text-slate-600'} border rounded-3xl text-xs`}>
              No hay pedidos en esta sección.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredOrders.map((order: any) => {
                const items = Array.isArray(order.cart_items) ? order.cart_items : []
                const status = (order.status || 'pendiente').toLowerCase().trim();
                
                return (
                  <div 
                    key={`pos-order-${order.id}`}
                    className={`${darkMode ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-300 shadow-lg'} border rounded-3xl p-6 space-y-4 transition-all`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4 border-slate-300 dark:border-slate-800">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 px-3 py-0.5 rounded-full text-[10px] font-black uppercase">
                            Pedido MarketGuate #{order.id}
                          </span>
                          <span className="text-xs text-slate-400">📅 {new Date(order.created_at).toLocaleString()}</span>
                        </div>
                        <h3 className="text-base font-black pt-1">👤 {order.customer_name}</h3>
                      </div>
                      <div className="text-right flex items-center justify-between sm:justify-end gap-6">
                        <div className="text-xs space-y-0.5">
                          <p className="font-bold">NIT: {order.customer_nit || 'CF'}</p>
                          <p className="text-slate-400">Tel: {order.customer_phone || 'N/A'}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-cyan-600 dark:text-cyan-400 font-mono font-black text-lg block">
                            Q {Number(order.total).toFixed(2)}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            status === 'entregado' ? 'bg-emerald-500/20 text-emerald-400' :
                            status === 'despachado' ? 'bg-blue-500/20 text-blue-400' :
                            status === 'devuelto' ? 'bg-purple-500/20 text-purple-400' :
                            status === 'cancelado' ? 'bg-red-500/20 text-red-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400">🍽️ Detalle de Artículos Solicitados:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {items.map((item: any, i: number) => (
                          <div key={`pos-item-${i}`} className={`p-3 rounded-2xl border text-xs flex justify-between items-center ${darkMode ? 'bg-[#070b12] border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                            <span className="font-semibold pr-2">✨ {item.quantity}x {item.name}</span>
                            <span className="font-mono font-bold shrink-0 text-cyan-500">Q {item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-300 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                      <p className="text-slate-400">📍 <strong>Dirección de Entrega:</strong> {order.customer_address || 'N/A'}</p>
                      
                      <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                        <button 
                          onClick={() => printOrderTicket(order)}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow text-xs"
                        >
                          🖨️ Imprimir Ticket
                        </button>

                        {/* ACCIONES PARA PENDIENTES */}
                        {status === 'pendiente' && (
                          <>
                            <button 
                              onClick={() => handleCancelOrder(order)}
                              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow text-xs"
                            >
                              ❌ Cancelar
                            </button>
                            <button 
                              onClick={() => handleFulfillOrder(order)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow text-xs"
                            >
                              🚚 Despachar (Rebajar Stock)
                            </button>
                          </>
                        )}

                        {/* ACCIONES PARA DESPACHADOS */}
                        {status === 'despachado' && (
                          <>
                            <button 
                              onClick={() => handleReturnOrder(order)}
                              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow text-xs"
                            >
                              🔄 Marcar como Devuelto / Rechazado
                            </button>
                            <button 
                              onClick={() => handleMarkAsDelivered(order)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow text-xs"
                            >
                              ✅ Confirmar Entrega (Entregado)
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}