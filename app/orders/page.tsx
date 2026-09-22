'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Quote {
  id: string;
  business_id: string;
  branch_id: string;
  customer_id?: string;
  created_at: string;
  total_amount: number;
  status: string;
  customer_name?: string;
  nit?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('Todas');

  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [quoteItems, setQuoteItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);
  const [branchName, setBranchName] = useState<string>('Sucursal Principal');
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);

  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    async function fetchQuotesAndBranch() {
      try {
        setLoading(true);
        
        const storedStaff = localStorage.getItem('currentStaff');
        let branchId = '';

        if (storedStaff) {
          try {
            const staffData = JSON.parse(storedStaff);
            branchId = staffData.branch_id;
            if (staffData.branch_name) setBranchName(staffData.branch_name);
          } catch (e) {}
        }

        if (!branchId) {
          setLoading(false);
          return;
        }

        const { data: logoData } = await supabase.rpc('get_business_logo_info', {
          p_branch_id: branchId,
          p_business_name: null
        });
        if (logoData && logoData.length > 0 && logoData[0].logo_url) {
          setBusinessLogo(logoData[0].logo_url);
        }

        // CONSUMO DE LA FUNCIÓN RPC SEGURA PARA EVITAR BLOQUEO DE RLS
        const { data, error } = await supabase.rpc('get_quotes_secure', {
          p_branch_id: branchId
        });

        if (error) {
          console.error('Error al cargar cotizaciones:', error.message);
        } else {
          setQuotes(data || []);
        }
      } catch (err) {
        console.error('Error inesperado:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchQuotesAndBranch();
  }, []);

  const checkIfExpired = (createdAt: string, status: string) => {
    const st = (status || '').toLowerCase();
    if (st.includes('acept') || st.includes('aprob')) return false;
    const createdTime = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const diffHours = (now - createdTime) / (1000 * 60 * 60);
    return diffHours > 24 || st.includes('venc');
  };

  const getQuoteStatusInfo = (quote: Quote) => {
    const st = (quote.status || '').toLowerCase();
    if (st.includes('acept') || st.includes('aprob')) {
      return { label: 'Aceptada', color: 'bg-emerald-500/20 text-emerald-400' };
    }
    if (checkIfExpired(quote.created_at, quote.status)) {
      return { label: 'Vencida', color: 'bg-red-500/20 text-red-400' };
    }
    return { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-400' };
  };

  async function handleSelectQuote(quote: Quote) {
    setSelectedQuote(quote);
    setMobileView('detail');
    setLoadingItems(true);

    // CONSUMO DE LA FUNCIÓN RPC SEGURA PARA LOS ÍTEMS
    const { data: itemsData, error: itemsError } = await supabase.rpc('get_quote_items_secure', {
      p_quote_id: quote.id
    });

    if (itemsError || !itemsData) {
      setQuoteItems([]);
      setLoadingItems(false);
      return;
    }

    const productIds = itemsData.map((i: any) => i.product_id).filter(Boolean);
    let prodMap: any = {};
    if (productIds.length > 0) {
      const { data: prodData } = await supabase
        .from('products')
        .select('id, name, stock, image_url')
        .in('id', productIds);
      
      if (prodData) {
        prodData.forEach((p: any) => {
          prodMap[p.id] = p;
        });
      }
    }

    const formatted = itemsData.map((item: any) => {
      const prodInfo = prodMap[item.product_id] || {};
      const currentStock = prodInfo.stock ?? 99;
      const requestedQty = Number(item.quantity || 1);
      
      return {
        ...item,
        id: item.product_id,
        name: prodInfo.name || 'Artículo Personalizado',
        price: item.price_at_quote,
        stock: currentStock,
        image_url: prodInfo.image_url || null,
        hasStockIssue: typeof currentStock === 'number' && requestedQty > currentStock
      };
    });

    setQuoteItems(formatted);
    setLoadingItems(false);
  }

  const handleLoadToPOS = async () => {
    if (!selectedQuote) return;

    try {
      await supabase
        .from('quotes')
        .update({ status: 'Aceptada' })
        .eq('id', selectedQuote.id);

      setQuotes(prevQuotes =>
        prevQuotes.map(q =>
          q.id === selectedQuote.id ? { ...q, status: 'Aceptada' } : q
        )
      );
      setSelectedQuote(prev => prev ? { ...prev, status: 'Aceptada' } : null);

      const posPayload = {
        customer: {
          id: selectedQuote.customer_id || '',
          nit: selectedQuote.nit || 'CF',
          name: selectedQuote.customer_name || 'Consumidor Final',
          address: selectedQuote.address || '',
          phone: selectedQuote.phone || '',
          email: selectedQuote.email || ''
        },
        cart: quoteItems.map(item => ({
          id: item.product_id,
          name: item.product_name || item.name,
          price: Number(item.price_at_quote || item.price || 0),
          quantity: Number(item.quantity || 1),
          notes: item.notes || '',
          eventDate: item.event_date || null,
          stock: item.stock ?? 99,
          hasStockIssue: item.hasStockIssue || false
        })),
        quoteReference: selectedQuote.id
      };

      localStorage.setItem('pos_loaded_quote', JSON.stringify(posPayload));
      router.push('/pos');

    } catch (err: any) {
      console.error(err);
      alert("Error al cargar al POS: " + err.message);
    }
  };

  const handlePrintSelectedQuote = () => {
    if (!selectedQuote) return;
    const logoToPrint = businessLogo || '';

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      let rowsHtml = '';
      for (const item of quoteItems) {
        const subtotal = Number(item.price_at_quote || item.price || 0) * Number(item.quantity || 1);
        const priceU = Number(item.price_at_quote || item.price || 0);
        rowsHtml += '<tr>';
        rowsHtml += '<td><b>' + item.quantity + '</b></td>';
        rowsHtml += '<td><div>' + (item.product_name || item.name) + '</div>';
        if (item.notes) {
          rowsHtml += '<div style="font-size:10px; color:#444;">📝 <b>Notas:</b> ' + item.notes + '</div>';
        }
        if (item.event_date) {
          rowsHtml += '<div style="font-size:10px; color:#444;">📅 <b>Entrega:</b> ' + new Date(item.event_date).toLocaleString() + '</div>';
        }
        rowsHtml += '</td>';
        rowsHtml += '<td style="text-align: right;">Q ' + priceU.toFixed(2) + '</td>';
        rowsHtml += '<td style="text-align: right;"><b>Q ' + subtotal.toFixed(2) + '</b></td>';
        rowsHtml += '</tr>';
      }

      doc.open();
      doc.write('<!DOCTYPE html><html><head><title>Cotizacion</title><style>');
      doc.write('body { font-family: Arial, sans-serif; padding: 20px; color: #000; }');
      doc.write('table { width: 100%; border-collapse: collapse; margin-top: 10px; }');
      doc.write('th, td { border-bottom: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: left; }');
      doc.write('th { border-bottom: 2px solid #000; }');
      doc.write('.total { text-align: right; font-weight: bold; margin-top: 15px; font-size: 14px; }');
      doc.write('</style></head><body>');
      doc.write('<div style="text-align: center; margin-bottom: 15px;">');
      if (logoToPrint) {
        doc.write('<img src="' + logoToPrint + '" style="height: 50px; object-fit: contain;" crossorigin="anonymous" />');
      }
      doc.write('<h1 style="font-size: 16px; margin: 5px 0;">' + branchName + '</h1>');
      doc.write('</div>');
      doc.write('<h2 style="font-size: 13px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px;">COTIZACIÓN / PROFORMA</h2>');
      doc.write('<div style="font-size: 11px; background: #f9f9f9; padding: 8px; border: 1px solid #ddd; margin-bottom: 15px;">');
      doc.write('<div><b>Ref:</b> #' + selectedQuote.id + '</div>');
      doc.write('<div><b>NIT:</b> ' + (selectedQuote.nit || 'C/F') + '</div>');
      doc.write('<div><b>Cliente:</b> ' + (selectedQuote.customer_name || 'Consumidor Final') + '</div>');
      if (selectedQuote.address) doc.write('<div><b>Dirección:</b> ' + selectedQuote.address + '</div>');
      if (selectedQuote.phone) doc.write('<div><b>Teléfono:</b> ' + selectedQuote.phone + '</div>');
      doc.write('<div><b>Fecha:</b> ' + new Date(selectedQuote.created_at).toLocaleString() + '</div>');
      doc.write('</div>');
      doc.write('<table><thead><tr><th>Cant.</th><th>Descripción</th><th style="text-align: right;">Precio U.</th><th style="text-align: right;">Subtotal</th></tr></thead><tbody>');
      doc.write(rowsHtml);
      doc.write('</tbody></table>');
      doc.write('<div class="total">Total Cotización: Q ' + Number(selectedQuote.total_amount || 0).toFixed(2) + '</div>');
      doc.write('</body></html>');
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 800);
    }
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = searchTerm === '' || 
      quote.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (quote.customer_name && quote.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (quote.nit && quote.nit.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    const isExpired = checkIfExpired(quote.created_at, quote.status);
    const st = (quote.status || '').toLowerCase();
    const isAccepted = st.includes('acept') || st.includes('aprob');

    if (activeTab === 'Todas') return true;
    if (activeTab === 'Pendiente') return !isExpired && !isAccepted;
    if (activeTab === 'Aceptada') return isAccepted;
    if (activeTab === 'Vencida') return isExpired;

    return true;
  });

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6 max-w-7xl mx-auto text-slate-100 notranslate pb-24 lg:pb-6" translate="no">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-emerald-500">Gestión de Cotizaciones y Proformas</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Control de vigencia, re-impresión y carga directa al POS.</p>
        </div>
        <Link 
          href="/pos" 
          className="inline-flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium rounded-xl border border-slate-700 transition-colors w-fit shadow-sm"
        >
          ← Regresar al POS
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        
        <div className={`lg:col-span-7 flex flex-col gap-4 ${mobileView === 'detail' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <input
              type="text"
              placeholder="Buscar por # cotización, NIT o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-72 px-3 sm:px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 text-xs sm:text-sm text-slate-100 placeholder-slate-500"
            />
            
            <div className="flex flex-wrap gap-1.5">
              {['Todas', 'Pendiente', 'Aceptada', 'Vencida'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">Cargando cotizaciones...</div>
          ) : filteredQuotes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[calc(100vh-260px)] sm:max-h-[68vh] pr-1">
              {filteredQuotes.map((quote) => {
                const statusInfo = getQuoteStatusInfo(quote);
                return (
                  <div 
                    key={quote.id} 
                    onClick={() => handleSelectQuote(quote)}
                    className={`bg-slate-900 border rounded-xl p-3.5 sm:p-4 shadow-sm cursor-pointer transition-all flex flex-col justify-between ${
                      selectedQuote?.id === quote.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] font-mono text-emerald-400 font-bold">Ref: #{quote.id.slice(0, 8)}</span>
                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-100 mb-0.5 line-clamp-1">
                        {quote.customer_name || 'Consumidor Final'}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mb-2">
                        NIT: <span className="text-emerald-400">{quote.nit || 'CF'}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-slate-500 text-[11px]">{new Date(quote.created_at).toLocaleDateString()} {new Date(quote.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-emerald-400 font-extrabold" translate="no">Q {Number(quote.total_amount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
              <p className="text-slate-400 text-sm">No se encontraron cotizaciones.</p>
            </div>
          )}
        </div>

        <div className={`lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 flex flex-col justify-between shadow-md lg:h-[78vh] ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'} min-h-[75vh] lg:min-h-0`}>
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobileView('list')}
                  className="lg:hidden text-emerald-400 text-xs font-bold bg-slate-800 px-2 py-1 rounded-lg border border-slate-700"
                >
                  ← Volver
                </button>
                <h2 className="text-sm font-bold text-emerald-500">📄 Vista Previa y Alertas de Stock</h2>
              </div>

              {selectedQuote && (
                <button
                  onClick={handlePrintSelectedQuote}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-slate-700 flex items-center gap-1"
                >
                  <span>🖨️</span> Re-imprimir
                </button>
              )}
            </div>

            {selectedQuote ? (
              <div className="space-y-4 text-xs overflow-y-auto max-h-[calc(100vh-320px)] lg:max-h-[50vh] pr-1">
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1">
                  <p><span className="text-slate-400">Referencia:</span> <span className="font-mono text-emerald-400 font-bold">#{selectedQuote.id}</span></p>
                  <p><span className="text-slate-400">Cliente:</span> <span className="font-semibold text-slate-200">{selectedQuote.customer_name}</span></p>
                  <p><span className="text-slate-400">NIT:</span> <span className="font-mono text-emerald-400">{selectedQuote.nit || 'CF'}</span></p>
                  {selectedQuote.address && <p><span className="text-slate-400">Dirección:</span> {selectedQuote.address}</p>}
                  {selectedQuote.phone && <p><span className="text-slate-400">Teléfono:</span> {selectedQuote.phone}</p>}
                  {selectedQuote.email && <p><span className="text-slate-400">Correo:</span> {selectedQuote.email}</p>}
                  <p><span className="text-slate-400">Fecha:</span> {new Date(selectedQuote.created_at).toLocaleString()}</p>
                </div>

                <div>
                  <p className="font-bold text-slate-300 mb-2">Artículos Cotizados y Validación de Stock:</p>
                  {loadingItems ? (
                    <p className="text-center py-6 text-slate-500">Cargando detalle...</p>
                  ) : quoteItems.length === 0 ? (
                    <p className="text-center py-6 text-slate-500">No hay productos en esta cotización.</p>
                  ) : (
                    <div className="space-y-2">
                      {quoteItems.map((item, idx) => (
                        <div key={idx} className={`p-2.5 rounded-lg border flex justify-between items-start gap-2 ${item.hasStockIssue ? 'bg-red-950/30 border-red-500/50' : 'bg-slate-950/40 border-slate-800'}`}>
                          <div>
                            <p className="font-bold text-slate-200">{item.quantity}x {item.product_name || item.name}</p>
                            <p className="text-[10px] text-slate-400">Stock Actual en Inventario: <span className={item.hasStockIssue ? 'text-red-400 font-bold' : 'text-emerald-400'}>{item.stock}</span></p>
                            {item.hasStockIssue && (
                              <p className="text-[10px] text-red-400 font-bold mt-1 bg-red-950/80 px-2 py-0.5 rounded border border-red-800">
                                ⚠️ Alerta: Stock insuficiente para cubrir esta cantidad.
                              </p>
                            )}
                            {item.notes && <p className="text-[10px] text-emerald-400 mt-0.5">📝 {item.notes}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-emerald-400" translate="no">Q {(Number(item.price_at_quote || item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</span>
                            <p className="text-[10px] text-slate-500">Q {Number(item.price_at_quote || item.price || 0).toFixed(2)} c/u</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-28 sm:py-32 text-slate-500 text-xs sm:text-sm">
                Selecciona una cotización del listado para gestionarla.
              </div>
            )}
          </div>

          {selectedQuote && (
            <div className="pt-3 border-t border-slate-800 space-y-2 mt-4 lg:mt-0">
              <div className="flex justify-between items-center font-bold text-sm">
                <span className="text-slate-300">Total Cotización:</span>
                <span className="text-emerald-400 text-base" translate="no">Q {Number(selectedQuote.total_amount || 0).toFixed(2)}</span>
              </div>

              <button 
                onClick={handleLoadToPOS}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-xs shadow transition-colors flex items-center justify-center gap-1.5"
              >
                <span>🛒</span> Cargar al POS (Contado / Crédito)
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}