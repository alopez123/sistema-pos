'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function GlobalReportPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [businessId, setBusinessId] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    const bizStr = localStorage.getItem('currentBusiness')
    if (bizStr) {
      const biz = JSON.parse(bizStr)
      setBusinessId(biz.id)
      loadStock(biz.id, '')
    } else {
      router.push('/')
    }
  }, [router])

  async function loadStock(bId: string, query: string) {
    const { data, error } = await supabase.rpc('search_global_stock_safe', {
      p_business_id: bId,
      p_search_query: query
    })

    if (error) {
      console.error("Error al buscar stock:", error.message)
    } else {
      // Si Supabase devuelve el JSON directamente, lo asignamos
      setResults(data || [])
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (businessId) loadStock(businessId, searchTerm)
  }

  return (
    <div className="min-h-screen bg-[#0f172a] p-8 text-white">
      <div className="max-w-5xl mx-auto">
        <header className="bg-[#1e293b] p-6 rounded-lg shadow mb-8 flex justify-between items-center border border-slate-700">
          <h1 className="text-2xl font-bold">Reporte Global y Buscador de Stock</h1>
          <button onClick={() => router.push('/dashboard')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded font-semibold">
            Volver al POS
          </button>
        </header>

        {/* Buscador */}
        <form onSubmit={handleSearch} className="bg-[#1e293b] p-6 rounded-lg shadow mb-6 flex gap-4 border border-slate-700">
          <input 
            type="text" 
            placeholder="Buscar producto por nombre..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-[#0f172a] border border-slate-600 p-3 rounded flex-1 text-white outline-none focus:border-emerald-500"
          />
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded font-bold">
            Buscar Ubicación
          </button>
        </form>

        {/* Resultados */}
        <div className="bg-[#1e293b] rounded-lg shadow overflow-hidden border border-slate-700">
          <table className="w-full text-left">
            <thead className="bg-slate-700 text-slate-300 font-bold border-b border-slate-600">
              <tr>
                <th className="p-4">Producto</th>
                <th className="p-4">Precio</th>
                <th className="p-4">Sucursal</th>
                <th className="p-4">Stock en Sucursal</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {results.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-slate-400">No se encontraron productos.</td></tr>
              ) : (
                results.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="p-4 font-semibold">{item.product_name}</td>
                    <td className="p-4" translate="no">Q {item.price}</td>
                    <td className="p-4 text-emerald-400 font-medium">{item.branch_name}</td>
                    <td className="p-4 font-bold">{item.stock} unidades</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}