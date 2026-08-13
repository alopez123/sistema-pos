'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'

export default function TransfersModule({ businessId, branchId }: { businessId: string, branchId: string }) {
 
  const [transfers, setTransfers] = useState<any[]>([]);
  const [otherBranchesProducts, setOtherBranchesProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [branchId]);

  const loadData = async () => {
    // 1. Cargar traslados (entrantes y salientes)
    const { data: transferData } = await supabase
      .from('inventory_transfers')
      .select('*, product:products(name), source:branches!source_branch_id(name), dest:branches!destination_branch_id(name)')
      .or(`source_branch_id.eq.${branchId},destination_branch_id.eq.${branchId}`)
      .order('created_at', { ascending: false });

    // 2. Cargar productos de otras sucursales
    const { data: stockData } = await supabase
      .from('products')
      .select('*, branch:branches(name)')
      .neq('branch_id', branchId)
      .eq('business_id', businessId);

    setTransfers(transferData || []);
    setOtherBranchesProducts(stockData || []);
    setLoading(false);
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
    if (!error) loadData();
  };

  const completeTransfer = async (transferId: string) => {
    const { error } = await supabase.rpc('complete_transfer', { transfer_id: transferId, current_biz_id: businessId });
    if (!error) loadData();
  };

  return (
    <div className="p-6 bg-slate-900 rounded-xl text-white">
      <h2 className="text-xl font-bold mb-4">Módulo de Traslados</h2>

      {/* Sección: Buscar productos en otras tiendas */}
      <div className="mb-8">
        <h3 className="text-sm text-slate-400 mb-2">Solicitar producto a otra sucursal:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {otherBranchesProducts.map((p) => (
            <div key={p.id} className="bg-slate-800 p-3 rounded flex justify-between items-center">
              <div>
                <p className="font-bold">{p.name}</p>
                <p className="text-xs text-slate-400">Sucursal: {p.branch?.name} | Stock: {p.stock}</p>
              </div>
              <button 
                onClick={() => handleCreateTransfer(p, 1)}
                className="bg-emerald-600 px-3 py-1 rounded text-sm hover:bg-emerald-500"
              >
                Solicitar 1
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sección: Tabla de estado de traslados */}
      <table className="w-full text-left">
        <thead>
          <tr className="text-slate-400 border-b border-slate-700">
            <th className="p-2">Producto</th>
            <th className="p-2">De</th>
            <th className="p-2">Cantidad</th>
            <th className="p-2">Acción</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t) => (
            <tr key={t.id} className="border-b border-slate-800">
              <td className="p-2">{t.product?.name}</td>
              <td className="p-2">{t.source?.name}</td>
              <td className="p-2">{t.quantity}</td>
              <td className="p-2">
                {t.status === 'pendiente' && t.source_branch_id === branchId ? (
                  <button onClick={() => completeTransfer(t.id)} className="text-blue-400 hover:underline">
                    Aceptar y Enviar
                  </button>
                ) : (
                  <span className="text-slate-500 text-sm">{t.status}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}