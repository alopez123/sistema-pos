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
  const [productRatings, setProductRatings] = useState<{ [key: string]: number }>({})
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  
  const [mainTab, setMainTab] = useState<'pedidos' | 'galeria'>('pedidos')
  const [subTab, setSubTab] = useState<'pendientes' | 'despachados' | 'historial'>('pendientes')
  
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [extraImages, setExtraImages] = useState<any[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)

  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
    loadPOSSession()
  }, [])

  useEffect(() => {
    if (selectedProduct?.id) {
      fetchExtraImages(selectedProduct.id)
    }
  }, [selectedProduct])

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
            fetchBranchProducts(assignedBranch.id)
          } else {
            setBranches(branchData)
            const targetBranch = branchData[0].id
            setSelectedBranchId(targetBranch)
            fetchOrders(bizId, targetBranch)
            fetchBranchProducts(targetBranch)
          }
        }
      }
    } catch (err) {
      console.error('Error cargando sesión POS:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchOrders(bizId: string, branchId: string) {
    if (!bizId) return
    setLoading(true)
    
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
      fetchProductRatings(data || [])
    }
    setLoading(false)
  }

  async function fetchProductRatings(ordersList: any[]) {
    const orderIds = ordersList.map(o => o.id).filter(Boolean)
    if (orderIds.length === 0) return

    const { data, error } = await supabase
      .from('product_ratings')
      .select('*')
      .in('order_id', orderIds)

    if (!error && data) {
      const ratingsMap: { [key: string]: number } = {}
      data.forEach((r: any) => {
        ratingsMap[`${r.order_id}-${r.product_name}`] = r.rating
      })
      setProductRatings(ratingsMap)
    }
  }

  async function fetchBranchProducts(branchId: string) {
    if (!branchId) return
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('branch_id', branchId)

    if (data) setProducts(data)
  }

  async function fetchExtraImages(productId: string) {
    if (!productId) return

    const { data, error } = await supabase.rpc('get_product_extras', {
      p_product_id: productId
    })

    if (!error && data) {
      setExtraImages(data)
    } else {
      console.error("Error al obtener imágenes extra por RPC:", error?.message)
      setExtraImages([])
    }
  }

  function handleBranchChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (isStaff) return
    const newBranchId = e.target.value
    setSelectedBranchId(newBranchId)
    if (business?.id) {
      fetchOrders(business.id, newBranchId)
      fetchBranchProducts(newBranchId)
      setSelectedProduct(null)
      setExtraImages([])
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedProduct) return

    if (extraImages.length >= 4) {
      setToastMessage("⚠️ Máximo 4 fotos extra (5 en total con la principal).")
      setTimeout(() => setToastMessage(null), 3000)
      return
    }

    if (file.size > 4 * 1024 * 1024) {
      setToastMessage("⚠️ La imagen es demasiado pesada. El límite es 4MB.")
      setTimeout(() => setToastMessage(null), 3000)
      return
    }

    setUploadingImage(true)

    try {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = async (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = async () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 800
          const MAX_HEIGHT = 800
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)

          const fileName = `extra_${selectedProduct.id}_${Date.now()}.jpg`
          const filePath = `products/${fileName}`

          const res = await fetch(dataUrl)
          const blob = await res.blob()

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, blob, { upsert: true })

          let finalImageUrl = dataUrl

          if (!uploadError) {
            const { data: publicURLData } = supabase.storage
              .from('product-images')
              .getPublicUrl(filePath)
            if (publicURLData?.publicUrl) {
              finalImageUrl = publicURLData.publicUrl
            }
          }

          const targetBranchId = getTargetBranchId();
          const targetBizId = business?.id;

          const { error: rpcError } = await supabase.rpc('insert_product_extra', {
            p_product_id: selectedProduct.id,
            p_business_id: targetBizId,
            p_branch_id: targetBranchId,
            p_image_url: finalImageUrl,
            p_display_order: extraImages.length + 1
          })

          if (!rpcError) {
            await fetchExtraImages(selectedProduct.id)
            setToastMessage("✅ ¡Foto extra cargada y guardada correctamente!")
            setTimeout(() => setToastMessage(null), 3000)
          } else {
            alert('Error al guardar en base de datos: ' + rpcError.message)
          }
          setUploadingImage(false)
        }
      }
    } catch (err: any) {
      console.error(err)
      alert('Error al procesar la imagen')
      setUploadingImage(false)
    }
  }

  async function handleDeleteExtraImage(img: any) {
    if (!confirm("¿Estás seguro de eliminar esta foto? Se borrará de la tienda y del almacenamiento.")) return

    try {
      // 1. Eliminar archivo del Storage si aplica
      if (img.image_url && img.image_url.includes('products/')) {
        const urlParts = img.image_url.split('/products/')
        if (urlParts.length > 1) {
          const filePath = `products/${urlParts[1].split('?')[0]}`
          await supabase.storage.from('product-images').remove([filePath])
        }
      }

      // 2. Eliminar registro usando la función RPC con el ID exacto del registro
      const { error } = await supabase.rpc('delete_product_extra', {
        p_extra_id: String(img.id)
      })

      if (error) {
        alert('Error al eliminar el registro: ' + error.message)
        return
      }

      // 3. Actualizar el estado local inmediatamente
      setExtraImages(prev => prev.filter(item => item.id !== img.id))

      setToastMessage("🗑️ Foto eliminada del sistema y del Storage.")
      setTimeout(() => setToastMessage(null), 3000)

    } catch (err) {
      console.error(err)
      alert('Ocurrió un error al intentar eliminar la imagen')
    }
  }

  // ACCIONES DE PEDIDOS
  async function handleFulfillOrder(order: any) {
    const targetBranchId = getTargetBranchId();
    if (!targetBranchId) return;

    const { error: updateErr } = await supabase
      .from('marketguate_orders')
      .update({ status: 'despachado' })
      .eq('id', order.id);

    if (updateErr) {
      alert("Error al actualizar el estado: " + updateErr.message);
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
            <p><strong>Dirección e Instrucciones:</strong> ${order.customer_address || 'N/A'}</p>
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
        <p className="text-cyan-500 font-bold text-sm animate-pulse">Cargando Módulo de Pedidos y Galería en Quantika POS...</p>
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
              Quantika POS — Panel de Órdenes y Galería MarketGuate
            </span>
            <h1 className="text-xl sm:text-2xl font-black">{currentBranchName}</h1>
            <p className="text-xs text-slate-400">Gestiona pedidos en línea y administra hasta 5 fotografías por producto para la tienda virtual.</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-center md:justify-end">
            {branches.length > 0 && (
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <label htmlFor="branch-select" className="text-[10px] font-bold text-slate-400">Sucursal:</label>
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
                onClick={() => router.push('/pos')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"
              >
                👈 Regresar al POS
              </button>
            </div>
          </div>
        </div>

        {/* SELECTOR DE PESTAÑA PRINCIPAL */}
        <div className="flex bg-[#111827] p-1.5 rounded-2xl border border-slate-800 max-w-md gap-2">
          <button 
            onClick={() => setMainTab('pedidos')}
            className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${mainTab === 'pedidos' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            📦 Pedidos en Línea ({orders.filter(o => (o.status || 'pendiente').toLowerCase().trim() === 'pendiente').length})
          </button>
          <button 
            onClick={() => setMainTab('galeria')}
            className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${mainTab === 'galeria' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            🖼️ Galería de Fotos (3-5)
          </button>
        </div>

        {/* VISTA 1: PEDIDOS EN LÍNEA */}
        {mainTab === 'pedidos' ? (
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

                      {/* DIRECCIÓN E INSTRUCCIONES DEL CLIENTE */}
                      <div className="bg-[#070b12] p-4 rounded-2xl border border-slate-800 text-xs space-y-1">
                        <span className="font-bold text-cyan-400 uppercase tracking-wide block">📍 Dirección e Instrucciones de Entrega:</span>
                        <p className="text-slate-200 leading-relaxed font-medium">{order.customer_address || 'Sin instrucciones adicionales'}</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-400">🍽️ Detalle de Artículos Solicitados y Calificación del Cliente:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {items.map((item: any, i: number) => {
                            const ratingKey = `${order.id}-${item.name}`
                            const stars = productRatings[ratingKey] || 0

                            return (
                              <div key={`pos-item-${i}`} className={`p-3 rounded-2xl border text-xs flex flex-col justify-between gap-2 ${darkMode ? 'bg-[#070b12] border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                                <div className="flex justify-between items-center w-full">
                                  <span className="font-semibold pr-2">✨ {item.quantity}x {item.name}</span>
                                  <span className="font-mono font-bold shrink-0 text-cyan-500">Q {item.price * item.quantity}</span>
                                </div>
                                
                                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                                  <span className="text-slate-400">Calificación:</span>
                                  <div className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <span key={s} className={s <= stars ? 'text-amber-400 text-sm' : 'text-slate-700 text-sm'}>
                                        ★
                                      </span>
                                    ))}
                                    <span className="ml-1.5 font-mono text-xs font-bold text-amber-400">{stars > 0 ? `${stars}.0` : 'Sin calificar'}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-300 dark:border-slate-800 flex justify-end items-center gap-2 flex-wrap">
                        <button 
                          onClick={() => printOrderTicket(order)}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow text-xs"
                        >
                          🖨️ Imprimir Ticket
                        </button>

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

                        {status === 'despachado' && (
                          <>
                            <button 
                              onClick={() => handleReturnOrder(order)}
                              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow text-xs"
                            >
                              🔄 Devolución / Rechazado
                            </button>
                            <button 
                              onClick={() => handleMarkAsDelivered(order)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow text-xs"
                            >
                              ✅ Confirmar Entrega
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* VISTA 2: GESTIÓN DE GALERÍA Y FOTOS EXTRAS */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-3xl p-4 space-y-3 h-[72vh] overflow-y-auto">
              <h3 className="text-xs font-bold text-cyan-400 px-2 uppercase tracking-wider">Selecciona un Producto ({products.length}):</h3>
              <div className="space-y-2">
                {products.map(prod => (
                  <div 
                    key={prod.id}
                    onClick={() => setSelectedProduct(prod)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${selectedProduct?.id === prod.id ? 'bg-cyan-600/20 border-cyan-500 text-white' : 'bg-[#070b12] border-slate-800 text-slate-300 hover:border-slate-700'}`}
                  >
                    {prod.image_url ? (
                      <img src={prod.image_url} alt={prod.name} className="w-10 h-10 object-cover rounded-xl border border-slate-700 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-[9px] text-slate-500 shrink-0">Sin foto</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs truncate">{prod.name}</h4>
                      <p className="text-cyan-400 font-mono text-xs font-black">Q {prod.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
              {selectedProduct ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full font-bold uppercase">Producto Activo</span>
                      <h3 className="text-xl font-black text-white mt-1">{selectedProduct.name}</h3>
                    </div>
                    <span className="text-sm font-mono text-cyan-400 font-bold">Q {selectedProduct.price}</span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">1. Imagen Principal (Usada en el POS rápido):</label>
                    <div className="flex items-center gap-4 bg-[#070b12] border border-slate-800 p-4 rounded-2xl">
                      {selectedProduct.image_url ? (
                        <img src={selectedProduct.image_url} alt="Principal" className="w-16 h-16 object-cover rounded-xl border border-slate-700 shadow" />
                      ) : (
                        <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500">Sin asignar</div>
                      )}
                      <p className="text-xs text-slate-400">Esta es la imagen oficial que se sincroniza directamente con tu punto de venta rápido en Quantika POS.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-400 uppercase">2. Fotografías Extra para MarketGuate ({extraImages.length} de 4):</label>
                      <span className="text-[10px] text-cyan-400 font-mono">Total en tienda: {extraImages.length + 1} fotos</span>
                    </div>

                    {/* BOTÓN PARA SELECCIONAR IMAGEN */}
                    {extraImages.length < 4 && (
                      <div className="space-y-2">
                        <label className={`block w-full bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-3.5 rounded-2xl text-xs font-black transition-all shadow-lg text-center cursor-pointer uppercase tracking-wider ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          {uploadingImage ? '⏳ Comprimiendo y Subiendo...' : '📁 Seleccionar Imagen de Archivo (Optimizada)'}
                          <input 
                            type="file" 
                            accept="image/*"
                            disabled={uploadingImage}
                            onChange={handleFileUpload}
                            className="hidden" 
                          />
                        </label>
                        <p className="text-[10px] text-slate-500">Puedes cargar hasta 4 fotografías adicionales desde tu dispositivo. Se redimensionan automáticamente (máx 800px) y se comprimen para ocupar poco espacio.</p>
                      </div>
                    )}

                    {/* CUADRÍCULA DE FOTOGRAFÍAS EXTRAS YA CARGADAS */}
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-bold text-slate-400 uppercase block">Fotografías Extra Registradas:</span>
                      {extraImages.length === 0 ? (
                        <div className="bg-[#070b12] border border-slate-800 p-4 rounded-2xl text-center text-xs text-slate-500">
                          No hay fotos extra cargadas para este producto todavía.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {extraImages.map((img) => (
                            <div key={img.id} className="relative group bg-[#070b12] border border-slate-800 rounded-2xl overflow-hidden aspect-square flex items-center justify-center p-1 shadow-md">
                              <img src={img.image_url} alt="Extra" className="w-full h-full object-cover rounded-xl" />
                              <button 
                                onClick={() => handleDeleteExtraImage(img)}
                                className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg transition-transform hover:scale-110"
                                title="Eliminar foto extra"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-40 text-slate-500 text-xs">
                  👈 Selecciona un producto de la lista izquierda para administrar su galería de imágenes.
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  )
}