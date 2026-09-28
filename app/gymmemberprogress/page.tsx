'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function MemberProgressView() {
  const [businessId, setBusinessId] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [selectedMember, setSelectedMember] = useState<any | null>(null)
  const [progressList, setProgressList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  const [darkMode, setDarkMode] = useState(true)
  
  // Preferencias de Unidades
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg')
  const [measureUnit, setMeasureUnit] = useState<'cm' | 'in'>('cm')

  // Datos Clínicos y Antropométricos del Formulario
  const [weightVal, setWeightVal] = useState('')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [visceralFat, setVisceralFat] = useState('')
  const [muscleVal, setMuscleVal] = useState('')
  const [chestVal, setChestVal] = useState('')
  const [waistVal, setWaistVal] = useState('')
  const [hipsVal, setHipsVal] = useState('')
  const [armVal, setArmVal] = useState('')
  const [legVal, setLegVal] = useState('')

  // Perfil Médico / Clínico del Socio para el Plan
  const [gender, setGender] = useState('Masculino')
  const [birthDate, setBirthDate] = useState('')
  const [isHypertensive, setIsHypertensive] = useState(false)
  const [isDiabetic, setIsDiabetic] = useState(false)
  const [isGlutenAllergic, setIsGlutenAllergic] = useState(false)
  const [cheatDayAllowed, setCheatDayAllowed] = useState(true)

  const [goal, setGoal] = useState('Pérdida de Peso')
  const [mealPlan, setMealPlan] = useState('')
  const [clinicalAnalysis, setClinicalAnalysis] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [businessData, setBusinessData] = useState<{ name: string; phone: string; logo_url?: string }>({
    name: 'Gimnasio Oficial',
    phone: '',
    logo_url: ''
  })

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const router = useRouter()

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => { setToast(null) }, 4500)
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem('dashboard_theme')
    if (savedTheme === 'light') setDarkMode(false)

    const savedBiz = localStorage.getItem('currentBusiness')

    if (savedBiz) {
      try {
        const bizObj = JSON.parse(savedBiz)
        if (bizObj?.id) {
          setBusinessId(bizObj.id)
          setBusinessData({
            name: bizObj.name || bizObj.business_name || 'Gimnasio Oficial',
            phone: bizObj.phone || '',
            logo_url: bizObj.logo_url || bizObj.logo || ''
          })
          fetchMembers(bizObj.id)
        }
      } catch (e) {
        console.error("Error al leer currentBusiness:", e)
      }
    } else {
      showToast("No se encontró el negocio activo.", "error")
    }
  }, [])

  async function fetchMembers(bId: string) {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_gym_members_safe', { p_business_id: bId })
      if (error) throw error
      setMembers(data || [])
    } catch (err: any) {
      showToast("Error al cargar socios: " + err.message, "error")
    } finally {
      setLoading(false)
    }
  }

  async function selectMemberForProgress(m: any) {
    showToast("Cargando perfil del socio...", "info")
    
    const finalNumericId = parseInt(m.id, 10)

    setSelectedMember({ 
      ...m, 
      id: finalNumericId
    })

    const memberGender = m.gender || 'Masculino'
    const memberBirth = m.birth_date || ''

    setGender(memberGender)
    setBirthDate(memberBirth ? memberBirth.split('T')[0] : '')
    setIsHypertensive(m.is_hypertensive || false)
    setIsDiabetic(m.is_diabetic || false)
    setIsGlutenAllergic(m.is_gluten_allergic || false)
    
    if (!isNaN(finalNumericId)) {
      fetchProgressHistory(finalNumericId)
    }
  }

  async function fetchProgressHistory(memberId: any) {
    if (!memberId || !businessId) return
    
    const numericMemberId = parseInt(memberId, 10)
    if (isNaN(numericMemberId)) return

    try {
      const { data, error } = await supabase.rpc('get_member_progress_history', {
        p_business_id: businessId,
        p_member_id: numericMemberId
      })

      if (error) {
        setProgressList([])
        return
      }

      setProgressList(data || [])
      if (data && data.length > 0) {
        const last = data[data.length - 1]
        if (last.goal) setGoal(last.goal)
      } else {
        setProgressList([])
      }
    } catch (err: any) {
      setProgressList([])
    }
  }

  function calculateAge(bDate: string) {
    if (!bDate) return 0
    const today = new Date()
    const birth = new Date(bDate)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return Math.max(0, age)
  }

  function calculateMetabolicAge(chronologicalAge: number, fatPct: number, muscleKg: number) {
    if (!chronologicalAge) return 25
    if (!fatPct || !muscleKg) return chronologicalAge
    let metaAge = chronologicalAge
    if (fatPct > 25) metaAge += Math.round((fatPct - 20) * 0.6)
    if (muscleKg > 35) metaAge -= 3
    return Math.max(18, metaAge)
  }

  function generateFlexibleGuatemalanPlan(selectedGoal: string, diabetic: boolean, hypertensive: boolean, glutenAllergic: boolean, cheatDay: boolean) {
    let restrictions = []
    if (diabetic) restrictions.push("⚠️ DIABETES: Control estricto de carbohidratos simples, prioridad absoluta a fibra y bajo índice glucémico.")
    if (hypertensive) restrictions.push("⚠️ HIPERTENSIÓN: Restricción severa de sodio, sal añadida, embutidos y alimentos ultraprocesados.")
    if (glutenAllergic) restrictions.push("⚠️ CELÍACO: Alimentos 100% libres de gluten (maíz natural, arroz, papa).")

    let plan = `🇬🇹 GUÍA DE ALIMENTACIÓN FLEXIBLE Y PORCIONES (30 DÍAS)\n`
    plan += `META: ${selectedGoal.toUpperCase()}\n`
    if (restrictions.length > 0) {
      plan += `RESTRICCIONES CLÍNICAS:\n${restrictions.join('\n')}\n`
    }
    plan += `----------------------------------------------------\n\n`

    plan += `🥩 1. GRUPO DE CARNES Y PROTEÍNAS (Bajo en Sodio / Limpias):\n`
    if (hypertensive) {
      plan += `• 150g a 200g de pechuga de pollo o pavo cocinada con hierbas naturales (cero consomés de caja ni sopas instantáneas).\n`
      plan += `• 150g de carne magra de res fresca (lomito o bistec asado sin sal añadida).\n`
      plan += `• 1 a 2 filetes de pescado fresco (tilapia, pargo) sazonado con limón, ajo natural y pimienta (🚫 Evitar mariscos congelados procesados o carnes frías/embutidos).\n`
      plan += `• 3 claras de huevo + 1 huevo entero revuelto con mínimo aceite.\n\n`
    } else {
      plan += `• 150g de pechuga de pollo o pavo a la plancha.\n`
      plan += `• 150g de carne magra de res o bistec asado.\n`
      plan += `• 1 filete de pescado al horno o vapor.\n`
      plan += `• 2 huevos enteros revueltos o cocidos.\n\n`
    }

    plan += `🍚 2. GRUPO DE CARBOHIDRATOS (Energía y Salud Metabólica):\n`
    if (diabetic) {
      plan += `• 1 taza de ARROZ INTEGRAL o quinua cocida (🚫 Evitar arroz blanco refinado).\n`
      plan += `• 1 taza de frijol negro entero o volteado (preparado en casa sin azúcar, sin manteca y con bajo contenido de sal).\n`
      plan += `• Máximo 2 tortillas de maíz palmeadas naturales (🚫 CERO pan blanco, harinas refinadas o productos de repostería).\n`
      plan += `• 1 porción moderada de camote, yuca o plátano hervido.\n\n`
    } else {
      plan += `• 1 taza de arroz blanco o entero cocido.\n`
      plan += `• 1 taza de frijol negro.\n`
      plan += `• 2 a 3 tortillas de maíz o pan integral.\n`
      plan += `• 1 porción mediana de plátano cocido u horneado.\n\n`
    }

    plan += `🥗 3. GRUPO DE ENSALADAS Y VEGETALES (Cardioprotectores):\n`
    plan += `• Ensalada fresca abundante (lechuga, pepino, apio, rábanos) sazonada con limón y aceite de oliva virgen (🚫 CERO aderezos comerciales empacados ricos en sodio).\n`
    plan += `• Verduras al vapor de bajo almidón (güisquil, brócoli, coliflor, perulero).\n`
    plan += `• Chirmol o salsa casera natural preparada con tomate, cebolla y cilantro fresco (sin cubitos sazonadores).\n\n`

    plan += `🍎 4. GRUPO DE MERIENDAS (Estabilidad de Glucosa y Presión):\n`
    if (diabetic || hypertensive) {
      plan += `• 1 puño de pepitoria tostada, almendras o nueces SIN SAL añadida (aportan potasio y grasas saludables que cuidan el corazón y la glucosa).\n`
      plan += `• 1 taza de papaya en porción controlada o ½ manzana verde con cáscara.\n`
      plan += `• 1 yogur griego natural sin azúcares añadidos.\n\n`
    } else {
      plan += `• 1 fruta fresca y un puñado de semillas.\n`
      plan += `• 1 yogur natural.\n\n`
    }

    if (cheatDay) {
      plan += `🍔 5. COMIDA TRAMPA / DÍA LIBRE (Fin de Semana):\n`
      if (diabetic || hypertensive) {
        plan += `⚠️ PRECAUCIÓN CLÍNICA: Se autoriza 1 comida libre moderada. Evitar por completo bebidas azucaradas, comidas con exceso de sal procesada, embutidos y frituras de restaurante.\n\n`
      } else {
        plan += `• Se autoriza 1 comida libre a elección sin excederse.\n\n`
      }
    } else {
      plan += `🚫 DÍA LIBRE: NO AUTORIZADO (Mantener disciplina estricta este mes).\n\n`
    }

    plan += `💧 HIDRATACIÓN: Mínimo 2.5 a 3 litros de agua pura al día (indispensable para la presión arterial y el metabolismo muscular).`
    return plan
  }

  function handleGenerateClinicalAnalysis() {
    const age = calculateAge(birthDate)
    const fat = parseFloat(bodyFatPct) || 18
    const muscle = parseFloat(muscleVal) || 30
    const metaAge = calculateMetabolicAge(age, fat, muscle)

    let report = `📋 *INFORME CLÍNICO Y ANTROPOMÉTRICO*\n`
    report += `• Edad Real: ${age > 0 ? age + ' años' : 'No especificada'} | Sexo: ${gender}\n`
    report += `• 🧬 Edad Metabólica Estimada: *${metaAge} años*\n`
    
    let conds = []
    if (isHypertensive) conds.push("Hipertensión")
    if (isDiabetic) conds.push("Diabetes")
    if (isGlutenAllergic) conds.push("Alergia al Gluten")
    report += `• 🏥 Condiciones Médicas: ${conds.length > 0 ? conds.join(', ') : 'Ninguna reportada'}\n\n`

    report += `🎯 *Evaluación de Meta (${goal}):*\n`
    if (fat > 25) {
      report += `El porcentaje de grasa corporal está elevado. Se recomienda combinar porciones de carnes magras con carbohidratos complejos y ensaladas abundantes.`
    } else {
      report += `Excelente composición corporal. Mantén las porciones equilibradas para conservar tu nivel de energía y masa muscular.`
    }

    setClinicalAnalysis(report)
    setMealPlan(generateFlexibleGuatemalanPlan(goal, isDiabetic, isHypertensive, isGlutenAllergic, cheatDayAllowed))
    showToast("✅ ¡Guía de porciones y análisis generados con éxito!", "success")
  }

  async function handleSaveProgress(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMember || !selectedMember.id) {
      showToast("Por favor selecciona un socio válido.", "error")
      return
    }

    if (!businessId) {
      showToast("No se encontró el negocio activo.", "error")
      return
    }

    setIsSaving(true)
    try {
      const age = calculateAge(birthDate)
      const fat = parseFloat(bodyFatPct) || 18
      const muscle = parseFloat(muscleVal) || 30
      const metaAge = calculateMetabolicAge(age, fat, muscle)

      const { data, error } = await supabase.rpc('save_member_progress_safe_v6', {
        p_business_id: businessId,
        p_member_id: String(selectedMember.id),
        p_weight_kg: weightVal ? parseFloat(weightVal) : null,
        p_weight_unit: weightUnit,
        p_measure_unit: measureUnit,
        p_body_fat_pct: bodyFatPct ? parseFloat(bodyFatPct) : null,
        p_visceral_fat: visceralFat ? parseInt(visceralFat) : null,
        p_muscle_mass_kg: muscleVal ? parseFloat(muscleVal) : null,
        p_chest_cm: chestVal ? parseFloat(chestVal) : null,
        p_waist_cm: waistVal ? parseFloat(waistVal) : null,
        p_hips_cm: hipsVal ? parseFloat(hipsVal) : null,
        p_arms_cm: armVal ? parseFloat(armVal) : null,
        p_legs_cm: legVal ? parseFloat(legVal) : null,
        p_goal: goal,
        p_metabolic_age: metaAge,
        p_clinical_analysis: clinicalAnalysis,
        p_nutrition_notes: mealPlan,
        p_evaluation_date: new Date().toISOString().split('T')[0]
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.message)

      showToast("✅ ¡Evaluación guardada con éxito!", "success")
      fetchProgressHistory(selectedMember.id)
    } catch (err: any) {
      showToast("Error al guardar: " + err.message, "error")
    } finally {
      setIsSaving(false)
    }
  }

  function handlePrintReport(progItem: any) {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return showToast("Habilita las ventanas emergentes en tu navegador.", "error")

    const pWeight = progItem?.weight_kg || weightVal || 'N/A'
    const pUnit = progItem?.weight_unit || weightUnit || 'kg'
    const pFat = progItem?.body_fat_pct || bodyFatPct || 'N/A'
    const pVisceral = progItem?.visceral_fat || visceralFat || 'N/A'
    const pMuscle = progItem?.muscle_mass_kg || muscleVal || 'N/A'
    const pGoal = progItem?.goal || goal || 'General'
    const pDate = progItem?.evaluation_date || new Date().toISOString().split('T')[0]
    const pAnalysis = progItem?.clinical_analysis || clinicalAnalysis || 'Sin diagnóstico registrado.'
    const pMeal = progItem?.nutrition_notes || mealPlan || 'Sin guía nutricional asignada.'

    const age = calculateAge(birthDate)
    const metaAge = progItem?.metabolic_age || calculateMetabolicAge(age, parseFloat(pFat), parseFloat(pMuscle))

    const brandHeader = `
      <div style="display: flex; align-items: center; gap: 12px;">
        ${businessData.logo_url ? `<img src="${businessData.logo_url}" style="height: 45px; object-fit: contain;" />` : `<div style="font-size: 22px;">🏋️‍♂️</div>`}
        <div>
          <div style="font-size: 16px; font-weight: bold; color: #0f172a; text-transform: uppercase;">${businessData.name}</div>
          <div style="font-size: 11px; color: #0284c7; font-weight: bold; text-transform: uppercase;">Reporte de Evolución Antropométrica y Nutrición</div>
        </div>
      </div>
    `

    const photoTag = selectedMember.photo_url 
      ? `<img src="${selectedMember.photo_url}" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2px solid #0284c7;" />`
      : `<div style="width: 70px; height: 70px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte de Evolución y Guía Nutricional - ${selectedMember.customer_name}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 30px; color: #1e293b; font-size: 12px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
          .member-card { display: flex; align-items: center; gap: 15px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 20px; }
          .section { margin-bottom: 18px; }
          .section-title { font-size: 13px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
          .grid-item { background: #ffffff; border: 1px solid #cbd5e1; padding: 10px; text-align: center; border-radius: 6px; }
          .analysis-box { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px; border-radius: 4px; white-space: pre-wrap; font-size: 11px; }
          .meal-box { background: #fffbeb; border-left: 4px solid #d97706; padding: 12px; border-radius: 4px; white-space: pre-wrap; font-family: monospace; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>${brandHeader}</div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">Fecha de Emisión: ${pDate}</div>
        </div>

        <div class="member-card">
          ${photoTag}
          <div>
            <div style="font-size: 15px; font-weight: bold; color: #0f172a;">${selectedMember.customer_name}</div>
            <div style="color: #475569; font-size: 11px; margin-top: 2px;">
              Código: <strong>${selectedMember.access_code || 'N/A'}</strong> | 
              Edad: <strong>${age > 0 ? age + ' años' : 'N/A'}</strong> | 
              Sexo: <strong>${gender}</strong> | 
              Meta: <strong style="color: #0284c7;">${pGoal}</strong>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📊 Mediciones Antropométricas y Edad Metabólica</div>
          <div style="margin-bottom: 8px; font-weight: bold; color: #d97706;">
            🧬 Edad Metabólica Estimada: ${metaAge} años
          </div>
          <div class="grid">
            <div class="grid-item"><strong>Peso</strong><br/><span style="font-size: 14px; font-weight: bold;">${pWeight} ${pUnit}</span></div>
            <div class="grid-item"><strong>% Grasa</strong><br/><span style="font-size: 14px; font-weight: bold;">${pFat}%</span></div>
            <div class="grid-item"><strong>Grasa Visceral</strong><br/><span style="font-size: 14px; font-weight: bold;">${pVisceral}</span></div>
            <div class="grid-item"><strong>Masa Muscular</strong><br/><span style="font-size: 14px; font-weight: bold;">${pMuscle} ${pUnit}</span></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">🤖 Diagnóstico y Análisis Clínico de Evolución</div>
          <div class="analysis-box">${pAnalysis}</div>
        </div>

        <div class="section">
          <div class="section-title">🥗 Guía de Porciones y Alimentos (Gastronomía de Guatemala)</div>
          <div class="meal-box">${pMeal}</div>
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  function handlePrintWorkoutPlan(progItem: any) {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return showToast("Habilita las ventanas emergentes en tu navegador.", "error")

    const pGoal = progItem?.goal || goal || 'Pérdida de Peso'
    const pDate = progItem?.evaluation_date || new Date().toISOString().split('T')[0]
    const age = calculateAge(birthDate)

    const brandHeader = `
      <div style="display: flex; align-items: center; gap: 12px;">
        ${businessData.logo_url ? `<img src="${businessData.logo_url}" style="height: 45px; object-fit: contain;" />` : `<div style="font-size: 22px;">🏋️‍♂️</div>`}
        <div>
          <div style="font-size: 16px; font-weight: bold; color: #0f172a; text-transform: uppercase;">${businessData.name}</div>
          <div style="font-size: 11px; color: #16a34a; font-weight: bold; text-transform: uppercase;">Plan de Entrenamiento y Rutinas Personalizadas</div>
        </div>
      </div>
    `

    const photoTag = selectedMember.photo_url 
      ? `<img src="${selectedMember.photo_url}" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2px solid #16a34a;" />`
      : `<div style="width: 70px; height: 70px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>`

    // ADVERTENCIAS MÉDICAS DINÁMICAS PARA LA RUTINA
    let clinicalWarnings = []
    if (isHypertensive) {
      clinicalWarnings.push("⚠️ PRECAUCIÓN POR HIPERTENSIÓN: Evitar por completo la maniobra de Valsalva (contener la respiración al hacer fuerza). Exhale durante el esfuerzo y mantenga descansos activos.")
    }
    if (isDiabetic) {
      clinicalWarnings.push("⚠️ PRECAUCIÓN POR DIABETES: Monitorear niveles de glucosa antes y después de la sesión. Lleve una fuente de carbohidratos rápidos por prevención de hipoglucemia.")
    }

    let workoutContent = ''
    if (pGoal.includes('Pérdida')) {
      workoutContent = `
        <div class="day-box">
          <strong>DÍA 1 (LUNES): TREN SUPERIOR + CARDIO MODERADO EN ELÍPTICA Y CAMINADORA</strong><br/>
          • Calentamiento: 10 min en caminadora (ritmo suave, controlando pulsaciones).<br/>
          • Press de pecho en máquina: 3 series x 12-15 repeticiones.<br/>
          • Remo sentado en máquina: 3 series x 12-15 repeticiones.<br/>
          • Elevaciones laterales con mancuernas: 3 series x 15 repeticiones.<br/>
          • Cardio final: 20 minutos continuos en Elíptica o Caminadora (intensidad moderada).
        </div>
        <div class="day-box">
          <strong>DÍA 2 (MARTES): TREN INFERIOR (MÁQUINAS SEGURAS) + BICI</strong><br/>
          • Prensa de pierna inclinada: 3 series x 12 repeticiones (Evitar pesos máximos que fuercen la presión arterial).<br/>
          • Curl femoral sentado en máquina: 3 series x 12 repeticiones.<br/>
          • Extensiones de cuádriceps: 3 series x 12 repeticiones.<br/>
          • Cardio final: 25 minutos en Bicicleta Estática a ritmo constante.
        </div>
        <div class="day-box">
          <strong>DÍA 3 (MIÉRCOLES): CIRCUITO CARDIOVASCULAR Y CORE CONTROLADO</strong><br/>
          • Cardio inicial: 15 min en Caminadora.<br/>
          • Press militar ligero en máquina: 3 series x 12 repeticiones.<br/>
          • Plancha abdominal isométrica (3 series de 30 segundos, sin aguantar la respiración).<br/>
          • Elíptica final: 15 minutos continuos.
        </div>
        <div class="day-box">
          <strong>DÍA 4 (JUEVES): ESPALDA Y BÍCEPS</strong><br/>
          • Jalón al pecho en polea: 3 series x 12 repeticiones.<br/>
          • Remo en máquina sentado: 3 series x 12 repeticiones.<br/>
          • Curl de bíceps con mancuernas sentado: 3 series x 12 repeticiones.<br/>
          • Cardio final: 25 minutos en Bicicleta o Caminadora.
        </div>
        <div class="day-box">
          <strong>DÍA 5 (VIERNES): PIERNAS Y QUEMA CALÓRICA</strong><br/>
          • Sentadilla en máquina Smith (peso moderado): 3 series x 12 repeticiones.<br/>
          • Peso muerto rumano con mancuernas ligeras: 3 series x 12 repeticiones.<br/>
          • Elíptica o Caminadora: 20 minutos de cardio constante.<br/>
          • Estiramientos completos.
        </div>
        <div class="day-box optional-day">
          <strong>SÁBADO Y DOMINGO (OPCIONALES):</strong><br/>
          • <em>Opción 1:</em> 30-45 minutos de caminata suave al aire libre o caminadora.<br/>
          • <em>Opción 2:</em> Descanso total de recuperación muscular.
        </div>
      `
    } else {
      workoutContent = `
        <div class="day-box">
          <strong>DÍA 1 (LUNES): PECHO Y TRÍCEPS (HIPERTROFIA SEGURA)</strong><br/>
          • Calentamiento: 8 min en bicicleta estática.<br/>
          • Press de banca plano con mancuernas (rango 10-12 reps, sin llegar al fallo forzado): 4 series.<br/>
          • Press inclinado en máquina: 3 series x 10 repeticiones.<br/>
          • Extensiones de tríceps en polea: 3 series x 12 repeticiones.
        </div>
        <div class="day-box">
          <strong>DÍA 2 (MARTES): ESPALDA Y BÍCEPS</strong><br/>
          • Jalón al pecho en polea: 4 series x 10 repeticiones.<br/>
          • Remo en máquina: 4 series x 10 repeticiones.<br/>
          • Curl de bíceps con mancuernas alternado: 3 series x 12 repeticiones.
        </div>
        <div class="day-box">
          <strong>DÍA 3 (MIÉRCOLES): PIERNAS (HIPERTROFIA CONTROLADA)</strong><br/>
          • Prensa de pierna inclinada: 4 series x 10 repeticiones.<br/>
          • Curl femoral sentado en máquina: 3 series x 12 repeticiones.<br/>
          • Elevación de talones para pantorrillas: 4 series x 15 repeticiones.
        </div>
        <div class="day-box">
          <strong>DÍA 4 (JUEVES): HOMBROS Y TRAPECIO</strong><br/>
          • Press militar con mancuernas sentado: 3 series x 10 repeticiones.<br/>
          • Elevaciones laterales con mancuernas: 3 series x 12 repeticiones.<br/>
          • Cardio moderado final: 15 minutos en elíptica.
        </div>
        <div class="day-box">
          <strong>DÍA 5 (VIERNES): TREN INFERIOR Y CORE</strong><br/>
          • Sentadilla hack o en máquina Smith (peso moderado-alto controlado): 3 series x 10 repeticiones.<br/>
          • Extensiones de cuádriceps: 3 series x 12 repeticiones.<br/>
          • Crunch abdominal en máquina: 3 series x 15 repeticiones.
        </div>
        <div class="day-box optional-day">
          <strong>SÁBADO Y DOMINGO (OPCIONALES):</strong><br/>
          • <em>Opción 1:</em> 20 minutos de cardio suave en bicicleta para flujo sanguíneo.<br/>
          • <em>Opción 2:</em> Descanso absoluto para síntesis proteica.
        </div>
      `
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Plan de Entrenamiento - ${selectedMember.customer_name}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 30px; color: #1e293b; font-size: 12px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #16a34a; padding-bottom: 12px; margin-bottom: 20px; }
          .member-card { display: flex; align-items: center; gap: 15px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 8px; margin-bottom: 20px; }
          .section-title { font-size: 13px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; }
          .day-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #16a34a; padding: 10px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 11px; }
          .optional-day { border-left: 4px solid #0284c7; background: #f0f9ff; }
          .warnings-box { background: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 6px; font-size: 11px; margin-bottom: 15px; color: #991b1b; }
          .tips-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px; border-radius: 6px; font-size: 11px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>${brandHeader}</div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">Fecha: ${pDate}</div>
        </div>

        <div class="member-card">
          ${photoTag}
          <div>
            <div style="font-size: 15px; font-weight: bold; color: #0f172a;">${selectedMember.customer_name}</div>
            <div style="color: #475569; font-size: 11px; margin-top: 2px;">
              Edad: <strong>${age > 0 ? age + ' años' : 'N/A'}</strong> | Sexo: <strong>${gender}</strong> | Objetivo: <strong style="color: #16a34a;">${pGoal}</strong>
            </div>
          </div>
        </div>

        ${clinicalWarnings.length > 0 ? `<div class="warnings-box"><strong>Consideraciones Médicas y de Seguridad Aplicadas:</strong><br/>${clinicalWarnings.join('<br/>')}</div>` : ''}

        <div class="section-title">📅 Rutina Semanal Adaptada (Control Cardíaco y Metabólico)</div>
        ${workoutContent}

        <div class="tips-box">
          <strong>💡 Indicaciones Generales:</strong><br/>
          • Nunca contenga la respiración durante los levantamientos de peso (respire de forma fluida para proteger su presión arterial).<br/>
          • Realice calentamiento previo y mantenga hidratación constante.<br/>
          • Si experimenta mareos, fatiga extrema o visión borrosa, detenga el ejercicio inmediatamente.
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  function handleSendWhatsApp(prog: any) {
    if (!selectedMember?.customer_phone) return showToast("El socio no tiene teléfono registrado.", "error")
    const cleanPhone = selectedMember.customer_phone.replace(/[^0-9]/g, '')
    let msg = `🥗 *Reporte Nutricional y Entrenamiento - ${businessData.name}*\n`
    msg += `Hola *${selectedMember.customer_name}*, aquí tienes tu evaluación y guía (${prog.evaluation_date}):\n\n`
    msg += `🧬 Edad Metabólica: *${prog.metabolic_age || 'N/A'} años*\n`
    msg += `⚖️ Peso: *${prog.weight_kg || 'N/A'} ${prog.weight_unit}*\n\n`
    msg += `📋 *Guía de Alimentos y Rutinas asignadas en sucursal.*`
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank')
  }

  const themeBg = darkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = darkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const inputBg = darkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-slate-50 text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-3 sm:p-6 flex flex-col notranslate relative w-full ${themeBg}`} translate="no">
      
      {toast && (
        <div className="fixed top-5 right-5 z-[99999] animate-bounce max-w-[90vw]">
          <div className={`px-4 py-3 rounded-xl shadow-2xl border font-bold text-sm flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' :
            toast.type === 'info' ? 'bg-cyan-600 text-white border-cyan-400' :
            'bg-red-600 text-white border-red-400'
          }`}>
            <span>{toast.type === 'success' ? '✅' : toast.type === 'info' ? 'ℹ️' : '⚠️'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <div className="w-full space-y-4 sm:space-y-6">
        
        <div className={`p-4 rounded-xl shadow flex justify-between items-center border ${panelBg}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow">
              ← Volver
            </button>
            <h1 className="text-base sm:text-lg font-bold text-cyan-400">🥗 Control Clínico, Nutrición y Edad Metabólica</h1>
          </div>
          <div className="flex gap-2 text-xs">
            <select value={weightUnit} onChange={e => setWeightUnit(e.target.value as any)} className={`border p-1.5 rounded-lg font-bold ${inputBg}`}>
              <option value="kg">Kilogramos (kg)</option>
              <option value="lbs">Libras (lbs)</option>
            </select>
            <select value={measureUnit} onChange={e => setMeasureUnit(e.target.value as any)} className={`border p-1.5 rounded-lg font-bold ${inputBg}`}>
              <option value="cm">Centímetros (cm)</option>
              <option value="in">Pulgadas (in)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          <div className={`p-4 rounded-xl border shadow lg:col-span-1 space-y-3 ${panelBg}`}>
            <h3 className="text-sm font-bold text-emerald-400 uppercase">👥 Seleccionar Socio</h3>
            <div className="max-h-[70vh] overflow-y-auto space-y-2">
              {loading ? (
                <p className="text-xs opacity-75 text-center">Cargando socios...</p>
              ) : members.length === 0 ? (
                <p className="text-xs opacity-75 text-center py-4">No hay socios registrados.</p>
              ) : members.map((m) => (
                <div 
                  key={m.id}
                  onClick={() => selectMemberForProgress(m)}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between ${selectedMember?.id === m.id ? 'border-cyan-500 bg-cyan-950/30' : 'border-slate-700'}`}
                >
                  <div className="flex items-center gap-2.5">
                    {m.photo_url ? (
                      <img src={m.photo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-cyan-400" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">👤</div>
                    )}
                    <span className="font-bold text-xs text-cyan-300">{m.customer_name}</span>
                  </div>
                  <span className="text-xs font-bold text-cyan-400">Seleccionar ➔</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {!selectedMember ? (
              <div className={`p-12 rounded-xl border text-center opacity-75 ${panelBg}`}>
                <p className="text-sm font-semibold">Selecciona un socio para generar su análisis y guía de porciones.</p>
              </div>
            ) : (
              <div className="space-y-4">
                
                <form onSubmit={handleSaveProgress} className={`p-4 sm:p-5 rounded-xl border shadow space-y-4 ${panelBg}`}>
                  <div className="flex items-center justify-between border-b pb-3 border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-cyan-400 bg-slate-800 flex items-center justify-center flex-shrink-0 shadow">
                        {selectedMember.photo_url ? (
                          <img src={selectedMember.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">🏋️‍♂️</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-cyan-400">{selectedMember.customer_name}</h3>
                        <p className="text-xs text-slate-400 font-mono">Código: {selectedMember.access_code || 'S/C'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs items-end">
                    <div>
                      <label className="block font-semibold mb-1">Sexo</label>
                      <select value={gender} onChange={e => setGender(e.target.value)} className={`w-full border p-2 rounded-xl ${inputBg}`}>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Fecha de Nacimiento</label>
                      <input type="date" value={birthDate} disabled className={`w-full border p-2 rounded-xl opacity-80 cursor-not-allowed ${inputBg}`} />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-1 pb-1">
                    <span className="font-semibold text-amber-400 text-xs">Edad Calculada:</span>
                    <strong className="text-sm text-white">{calculateAge(birthDate) > 0 ? calculateAge(birthDate) + ' años' : 'No especificada'}</strong>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs bg-slate-900/40 p-3 rounded-xl border border-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={isHypertensive} onChange={e => setIsHypertensive(e.target.checked)} className="accent-cyan-500 w-4 h-4" />
                      <span>Hipertenso</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={isDiabetic} onChange={e => setIsDiabetic(e.target.checked)} className="accent-cyan-500 w-4 h-4" />
                      <span>Diabético</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={isGlutenAllergic} onChange={e => setIsGlutenAllergic(e.target.checked)} className="accent-cyan-500 w-4 h-4" />
                      <span>Alergico al Gluten (Celíaco)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={cheatDayAllowed} onChange={e => setCheatDayAllowed(e.target.checked)} className="accent-cyan-500 w-4 h-4" />
                      <span className="text-emerald-400">Permitir Día Libre / Trampa</span>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-xs text-amber-400 uppercase">🎯 Meta del Socio</label>
                    <select value={goal} onChange={e => setGoal(e.target.value)} className={`w-full border p-2.5 rounded-xl font-semibold text-xs ${inputBg}`}>
                      <option value="Pérdida de Peso">🔥 Pérdida de Peso / Definición</option>
                      <option value="Ganancia Muscular (Hipertrofia)">💪 Ganancia Muscular (Hipertrofia)</option>
                      <option value="Recomposición Corporal">🔄 Recomposición Corporal</option>
                      <option value="Mantenimiento y Salud">⭐ Mantenimiento / Salud General</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold mb-1">Peso ({weightUnit})</label>
                      <input type="number" step="0.01" value={weightVal} onChange={e => setWeightVal(e.target.value)} placeholder="Ej. 75.50" className={`w-full border p-2 rounded-xl ${inputBg}`} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">% Grasa Corporal</label>
                      <input type="number" step="0.01" value={bodyFatPct} onChange={e => setBodyFatPct(e.target.value)} placeholder="Ej. 18.5" className={`w-full border p-2 rounded-xl ${inputBg}`} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Grasa Visceral</label>
                      <input type="number" step="1" value={visceralFat} onChange={e => setVisceralFat(e.target.value)} placeholder="Ej. 6" className={`w-full border p-2 rounded-xl ${inputBg}`} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Masa Muscular ({weightUnit})</label>
                      <input type="number" step="0.01" value={muscleVal} onChange={e => setMuscleVal(e.target.value)} placeholder="Ej. 38.2" className={`w-full border p-2 rounded-xl ${inputBg}`} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Pecho ({measureUnit})</label>
                      <input type="number" step="0.1" value={chestVal} onChange={e => setChestVal(e.target.value)} placeholder="0.0" className={`w-full border p-2 rounded-xl ${inputBg}`} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Cintura ({measureUnit})</label>
                      <input type="number" step="0.1" value={waistVal} onChange={e => setWaistVal(e.target.value)} placeholder="0.0" className={`w-full border p-2 rounded-xl ${inputBg}`} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Cadera ({measureUnit})</label>
                      <input type="number" step="0.1" value={hipsVal} onChange={e => setHipsVal(e.target.value)} placeholder="0.0" className={`w-full border p-2 rounded-xl ${inputBg}`} />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Brazos / Piernas ({measureUnit})</label>
                      <div className="flex gap-1">
                        <input type="number" step="0.1" value={armVal} onChange={e => setArmVal(e.target.value)} placeholder="Brazo" className={`w-1/2 border p-2 rounded-xl ${inputBg}`} />
                        <input type="number" step="0.1" value={legVal} onChange={e => setLegVal(e.target.value)} placeholder="Pierna" className={`w-1/2 border p-2 rounded-xl ${inputBg}`} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button type="button" onClick={handleGenerateClinicalAnalysis} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-black text-xs shadow">
                      ⚡ Generar Análisis Clínico, Edad Metabólica y Guía de Porciones (Guatemala)
                    </button>
                  </div>

                  {clinicalAnalysis && (
                    <div className="space-y-3 pt-2">
                      <div className="bg-cyan-950/30 border border-cyan-500 p-3 rounded-xl text-xs space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-cyan-400">🤖 Diagnóstico y Edad Metabólica:</p>
                            <pre className="whitespace-pre-wrap font-sans text-white">{clinicalAnalysis}</pre>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-cyan-800/60">
                          <button type="button" onClick={() => handlePrintReport(null)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-3 rounded-xl font-bold text-xs shadow">
                            📄 Imprimir PDF Nutrición
                          </button>
                          <button type="button" onClick={() => handlePrintWorkoutPlan(null)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3 rounded-xl font-bold text-xs shadow">
                            🏋️‍♂️ Ver Rutina de Entrenamiento (2da Hoja)
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-xs text-emerald-400 uppercase">🥗 Guía de Porciones Intercambiables (Campo editable):</label>
                        <textarea rows={10} value={mealPlan} onChange={e => setMealPlan(e.target.value)} className={`w-full border p-3 rounded-xl font-mono text-xs ${inputBg}`} />
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={isSaving} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black text-xs shadow disabled:opacity-50">
                    {isSaving ? 'Guardando...' : '💾 Guardar Evaluación Completa'}
                  </button>
                </form>

                {progressList.length >= 2 && (() => {
                  const first = progressList[0]
                  const last = progressList[progressList.length - 1]
                  const weightDiff = (last.weight_kg - first.weight_kg).toFixed(1)
                  const fatDiff = ((last.body_fat_pct || 0) - (first.body_fat_pct || 0)).toFixed(1)
                  const metaDiff = (last.metabolic_age - first.metabolic_age)

                  const isWeightLoss = goal.includes('Pérdida')
                  const isGoodProgress = isWeightLoss ? Number(weightDiff) <= 0 : Number(weightDiff) >= 0

                  return (
                    <div className={`p-4 rounded-xl border shadow space-y-4 ${panelBg}`}>
                      <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                        <h4 className="font-bold text-sm text-cyan-400 uppercase">📈 Análisis de Tendencia y Progreso hacia la Meta</h4>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${isGoodProgress ? 'bg-emerald-950 text-emerald-400 border border-emerald-500' : 'bg-amber-950 text-amber-400 border border-amber-500'}`}>
                          {isGoodProgress ? '🎯 ¡Excelente Progreso!' : '⚠️ En Fase de Ajuste'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-700">
                          <span className="text-slate-400 block text-[10px]">CAMBIO DE PESO</span>
                          <strong className={`text-sm ${Number(weightDiff) < 0 ? 'text-emerald-400' : Number(weightDiff) > 0 ? 'text-amber-400' : 'text-white'}`}>
                            {Number(weightDiff) > 0 ? `+${weightDiff}` : weightDiff} kg
                          </strong>
                        </div>
                        <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-700">
                          <span className="text-slate-400 block text-[10px]">CAMBIO DE GRASA</span>
                          <strong className={`text-sm ${Number(fatDiff) < 0 ? 'text-emerald-400' : Number(fatDiff) > 0 ? 'text-amber-400' : 'text-white'}`}>
                            {Number(fatDiff) > 0 ? `+${fatDiff}` : fatDiff}%
                          </strong>
                        </div>
                        <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-700">
                          <span className="text-slate-400 block text-[10px]">EDAD METABÓLICA</span>
                          <strong className={`text-sm ${metaDiff < 0 ? 'text-emerald-400' : metaDiff > 0 ? 'text-amber-400' : 'text-white'}`}>
                            {metaDiff > 0 ? `+${metaDiff}` : metaDiff} años
                          </strong>
                        </div>
                      </div>

                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[11px] text-slate-400 font-semibold">
                          <span>Evolución del Peso (Historial)</span>
                          <span>{progressList.length} evaluaciones registradas</span>
                        </div>
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 relative h-36 flex items-end">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100">
                            <line x1="0" y1="20" x2="300" y2="20" stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1="0" y1="60" x2="300" y2="60" stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1="0" y1="90" x2="300" y2="90" stroke="#334155" strokeWidth="1" />

                            {(() => {
                              const weights = progressList.map(p => p.weight_kg)
                              const minW = Math.min(...weights) * 0.95
                              const maxW = Math.max(...weights) * 1.05
                              const rangeW = maxW - minW || 1

                              const points = progressList.map((p, idx) => {
                                const x = (idx / (progressList.length - 1 || 1)) * 280 + 10
                                const y = 90 - ((p.weight_kg - minW) / rangeW) * 70
                                return { x, y, weight: p.weight_kg, date: p.evaluation_date }
                              })

                              const pathD = points.reduce((acc, pt, i) => i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`, '')

                              return (
                                <>
                                  <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" />
                                  {points.map((pt, i) => (
                                    <g key={i}>
                                      <circle cx={pt.x} cy={pt.y} r="4.5" fill="#0f172a" stroke="#06b6d4" strokeWidth="2.5" />
                                      <text x={pt.x} y={pt.y - 10} fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">{pt.weight}kg</text>
                                    </g>
                                  ))}
                                </>
                              )
                            })()}
                          </svg>
                        </div>
                      </div>

                    </div>
                  )
                })()}

                <div className={`p-4 rounded-xl border shadow space-y-3 ${panelBg}`}>
                  <h4 className="font-bold text-sm text-emerald-400 uppercase">📜 Historial de Evaluaciones Clínicas</h4>
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                    {progressList.length === 0 ? (
                      <p className="text-xs opacity-75 italic text-center py-4">No hay registros previos para este socio.</p>
                    ) : progressList.slice().reverse().map((prog) => (
                      <div key={prog.id} className="p-3 rounded-xl border border-slate-700 bg-slate-900/60 space-y-2 text-xs">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                          <span className="font-bold text-cyan-300">📅 {prog.evaluation_date} | Edad Metabólica: {prog.metabolic_age || 'N/A'} años</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handlePrintReport(prog)} className="bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded text-[11px] font-bold text-white shadow">📄 PDF Nutrición</button>
                            <button type="button" onClick={() => handlePrintWorkoutPlan(prog)} className="bg-emerald-600 hover:bg-emerald-500 px-2 py-1 rounded text-[11px] font-bold text-white shadow">🏋️‍♂️ Rutina</button>
                            <button type="button" onClick={() => handleSendWhatsApp(prog)} className="bg-cyan-700 hover:bg-cyan-600 px-2 py-1 rounded text-[11px] font-bold text-white shadow">📱 WhatsApp</button>
                          </div>
                        </div>
                        <p className="font-mono text-slate-300">Peso: {prog.weight_kg} {prog.weight_unit} | Grasa: {prog.body_fat_pct}%</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}