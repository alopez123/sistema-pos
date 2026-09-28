'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function GymMembersView({ currentBusiness, currentBranch, darkMode: initialDarkMode }: any) {
  const [businessId, setBusinessId] = useState(currentBusiness?.id || '')
  const [branchId, setBranchId] = useState(currentBranch?.id || '')
  const [branches, setBranches] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Estado local para el modo oscuro / claro con contraste
  const [darkMode, setDarkMode] = useState<boolean>(initialDarkMode !== false)
  
  const [businessData, setBusinessData] = useState<{ name: string; logo: string; phone: string }>({
    name: 'Gimnasio Oficial',
    logo: '',
    phone: ''
  })
  
  const [selectedMember, setSelectedMember] = useState<any | null>(null)
  const [memberClasses, setMemberClasses] = useState<any[]>([])
  const [membershipFee, setMembershipFee] = useState(0)
  const [badgeMember, setBadgeMember] = useState<any | null>(null)
  const [editMember, setEditMember] = useState<any | null>(null)

  // Lista de planes configurados para edición
  const [availablePlans, setAvailablePlans] = useState<any[]>([])

  // Estados para Estado de Cuenta y Pagos
  const [accountStatementMember, setAccountStatementMember] = useState<any | null>(null)
  const [installments, setInstallments] = useState<any[]>([])
  const [selectedInstallment, setSelectedInstallment] = useState<any | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)

  // Estados para Modal de Cancelación con Penalización y Cobro
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelType, setCancelType] = useState<'membership' | 'class'>('membership')
  const [targetClassToCancel, setTargetClassToCancel] = useState<any | null>(null)
  const [penaltyAmount, setPenaltyAmount] = useState(0)
  const [penaltyPercentUsed, setPenaltyPercentUsed] = useState(10)
  const [pendingInstallmentsTotal, setPendingInstallmentsTotal] = useState(0)

  // Campos de Pago Detallado (Efectivo, Tarjeta, Mixto)
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'mixto'>('efectivo')
  const [voucherNumber, setVoucherNumber] = useState('')
  const [cashGiven, setCashGiven] = useState('')
  const [cardAmountMixed, setCardAmountMixed] = useState('')
  const [cashAmountMixed, setCashAmountMixed] = useState('')
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)

  // Edición
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editBirthDate, setEditBirthDate] = useState('')
  const [editExpiry, setEditExpiry] = useState('')
  const [editStatus, setEditStatus] = useState('Activo')
  const [editMembershipType, setEditMembershipType] = useState('')
  const [editEmergencyName, setEditEmergencyName] = useState('')
  const [editEmergencyRelation, setEditEmergencyRelation] = useState('')
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const router = useRouter()

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => { setToast(null) }, 4500)
  }

  useEffect(() => {
    let bId = currentBusiness?.id;
    let bName = currentBusiness?.name;
    let bPhone = currentBusiness?.phone || '';
    let bLogo = currentBusiness?.logo_url || currentBusiness?.logo || currentBusiness?.image_url;
    let brId = currentBranch?.id || '';
    
    const savedBiz = localStorage.getItem('currentBusiness');
    if (savedBiz) {
      try {
        const bizObj = JSON.parse(savedBiz);
        if (bizObj?.id) bId = bizObj.id;
        if (bizObj?.name) bName = bizObj.name;
        if (bizObj?.phone) bPhone = bizObj.phone;
        if (bizObj?.logo_url || bizObj?.logo || bizObj?.image_url) {
          bLogo = bizObj.logo_url || bizObj.logo || bizObj.image_url;
        }
      } catch (e) {
        console.error("Error al leer currentBusiness:", e);
      }
    }

    const savedBranch = localStorage.getItem('currentBranch');
    if (savedBranch) {
      try {
        const branchObj = JSON.parse(savedBranch);
        if (branchObj?.id) brId = branchObj.id;
      } catch (e) {
        console.error("Error al leer currentBranch:", e);
      }
    }

    setBusinessData({
      name: bName || 'Gimnasio Oficial',
      logo: bLogo || '',
      phone: bPhone || ''
    });

    if (bId) {
      setBusinessId(bId);
      fetchGymMembers(bId);
      fetchBranches(bId, brId);
      fetchPlans(bId);
    } else {
      setLoading(false);
    }
  }, [currentBusiness, currentBranch]);

  async function fetchBranches(bId: string, initialBrId: string) {
    try {
      const { data, error } = await supabase.from('branches').select('*').eq('business_id', bId);
      if (error) throw error;
      if (data && data.length > 0) {
        setBranches(data);
        const targetBranch = data.find((b: any) => b.id === initialBrId) || data[0];
        if (targetBranch) {
          setBranchId(targetBranch.id);
          localStorage.setItem('currentBranch', JSON.stringify(targetBranch));
        }
      }
    } catch (err) {
      console.error("Error al cargar sucursales:", err);
    }
  }

  async function fetchPlans(bId: string) {
    try {
      const { data, error } = await supabase.rpc('get_gym_membership_plans', { p_business_id: bId });
      if (!error && data) {
        setAvailablePlans(data);
      }
    } catch (err) {
      console.error("Error al cargar planes de membresía:", err);
    }
  }

  async function fetchGymMembers(bId: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_gym_members_safe', { p_business_id: bId });
      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      console.error("Error al cargar socios:", err);
      showToast("Error al cargar socios: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function openMemberDetail(m: any) {
    setSelectedMember(m);
    setMemberClasses([]);
    setMembershipFee(0);
    try {
      const { data, error } = await supabase.rpc('get_gym_member_detail', { p_member_id: m.id });
      if (!error && data && data.success) {
        setMemberClasses(data.fixed_classes || []);
        setMembershipFee(Number(data.membership_fee || 0));
      }
    } catch (err) {
      console.error("Error al cargar detalle de clases:", err);
    }
  }

  async function openAccountStatement(m: any) {
    setAccountStatementMember(m);
    setInstallments([]);

    try {
      let { data: existing, error: fetchErr } = await supabase
        .from('member_installments')
        .select('*')
        .eq('member_id', m.id)
        .order('installment_number', { ascending: true });

      if (fetchErr) throw fetchErr;

      if (!existing || existing.length === 0) {
        let baseFee = 0;
        let classesFee = 0;

        try {
          const { data: detailData } = await supabase.rpc('get_gym_member_detail', { p_member_id: m.id });
          if (detailData && detailData.success) {
            baseFee = Number(detailData.membership_fee || 0);
            classesFee = (detailData.fixed_classes || [])
              .filter((c: any) => c.status === 'Activo')
              .reduce((sum: number, c: any) => sum + Number(c.fee_charged || 0), 0);
          }
        } catch (e) {
          console.error("Error al calcular tarifas:", e);
        }

        const monthlyTotal = (baseFee + classesFee) > 0 ? (baseFee + classesFee) : 150.00;
        const enrollmentFee = 150.00;
        const newInstallmentsPayload = [];

        newInstallmentsPayload.push({
          business_id: businessId,
          member_id: m.id,
          installment_number: 0,
          title: 'Inscripción Inicial',
          amount: enrollmentFee,
          due_date: new Date().toISOString().split('T')[0],
          status: 'Pendiente'
        });

        const today = new Date();
        for (let i = 1; i <= 12; i++) {
          const dueDateObj = new Date(today.getFullYear(), today.getMonth() + (i - 1), 1);
          newInstallmentsPayload.push({
            business_id: businessId,
            member_id: m.id,
            installment_number: i,
            title: `Cuota Mensual #${i}`,
            amount: monthlyTotal,
            due_date: dueDateObj.toISOString().split('T')[0],
            status: 'Pendiente'
          });
        }

        await supabase.from('member_installments').insert(newInstallmentsPayload);

        const { data: refetched } = await supabase
          .from('member_installments')
          .select('*')
          .eq('member_id', m.id)
          .order('installment_number', { ascending: true });

        setInstallments(refetched || []);
      } else {
        setInstallments(existing);
      }
    } catch (err: any) {
      showToast("Error al cargar cuotas: " + err.message, "error");
    }
  }

  async function handlePayInstallment() {
    if (!selectedInstallment) return;

    const targetAmount = Number(selectedInstallment.amount);

    if (paymentMethod === 'tarjeta' && !voucherNumber.trim()) {
      return showToast("Ingresa el número de voucher de la tarjeta.", 'error');
    }
    if (paymentMethod === 'efectivo') {
      const given = parseFloat(cashGiven) || 0;
      if (given < targetAmount) {
        return showToast("El pago no cubre el monto de la cuota.", 'error');
      }
    }
    if (paymentMethod === 'mixto') {
      const card = parseFloat(cardAmountMixed) || 0;
      const cash = parseFloat(cashAmountMixed) || 0;
      const totalEntered = card + cash;
      if (totalEntered < targetAmount || Math.abs(totalEntered - targetAmount) > 0.05) {
        return showToast("El pago no cubre el monto de la cuota.", 'error');
      }
      if (!voucherNumber.trim()) {
        return showToast("Ingresa el número de voucher para el pago mixto con tarjeta.", 'error');
      }
    }

    setIsProcessingPayment(true);
    try {
      const ticketNum = Math.floor(1000 + Math.random() * 9000);

      const { error: saleErr } = await supabase.from('sales').insert({
        business_id: businessId,
        branch_id: branchId || branches[0]?.id,
        total_amount: targetAmount,
        status: 'Completada',
        payment_method: paymentMethod,
        voucher_number: voucherNumber.trim() || null,
        order_number: ticketNum,
        created_at: new Date().toISOString()
      });
      if (saleErr) throw saleErr;

      const { error: updateErr } = await supabase
        .from('member_installments')
        .update({ status: 'Pagada' })
        .eq('id', selectedInstallment.id);

      if (updateErr) throw updateErr;

      showToast("✅ ¡Pago de cuota registrado con éxito!", "success");
      setPaymentModalOpen(false);
      setSelectedInstallment(null);
      setVoucherNumber('');
      setCashGiven('');
      setCardAmountMixed('');
      setCashAmountMixed('');

      if (accountStatementMember) {
        openAccountStatement(accountStatementMember);
      }
    } catch (err: any) {
      showToast("Error al procesar pago: " + err.message, "error");
    } finally {
      setIsProcessingPayment(false);
    }
  }

  async function prepareCancelMembership() {
    if (!selectedMember) return;
    try {
      const { data: bizData } = await supabase
        .from('businesses')
        .select('cancellation_penalty_percent')
        .eq('id', businessId)
        .single();

      const penaltyPct = Number(bizData?.cancellation_penalty_percent ?? 10);
      setPenaltyPercentUsed(penaltyPct);

      let { data: instData } = await supabase
        .from('member_installments')
        .select('amount, status')
        .eq('member_id', selectedMember.id);

      if (!instData || instData.length === 0) {
        await openAccountStatement(selectedMember);
        const { data: freshInst } = await supabase
          .from('member_installments')
          .select('amount, status')
          .eq('member_id', selectedMember.id);
        instData = freshInst || [];
      }

      const totalPending = instData
        .filter((i: any) => i.status === 'Pendiente')
        .reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0);

      setPendingInstallmentsTotal(totalPending);

      const calculatedPenalty = (totalPending * penaltyPct) / 100;
      setPenaltyAmount(calculatedPenalty);

      setCancelType('membership');
      setTargetClassToCancel(null);
      setCancelModalOpen(true);
    } catch (err: any) {
      showToast("Error al calcular penalización: " + err.message, "error");
    }
  }

  async function prepareCancelClass(mc: any) {
    if (!selectedMember) return;
    try {
      const { data: bizData } = await supabase
        .from('businesses')
        .select('cancellation_penalty_percent')
        .eq('id', businessId)
        .single();

      const penaltyPct = Number(bizData?.cancellation_penalty_percent ?? 10);
      setPenaltyPercentUsed(penaltyPct);

      let { data: instData } = await supabase
        .from('member_installments')
        .select('status')
        .eq('member_id', selectedMember.id)
        .eq('status', 'Pendiente');

      const pendingMonthsCount = (instData || []).length > 0 ? (instData || []).length : 12;
      const classFeeMonthly = Number(mc.fee_charged || 75);
      const totalClassPending = classFeeMonthly * pendingMonthsCount;

      setPendingInstallmentsTotal(totalClassPending);

      const calculatedPenalty = (totalClassPending * penaltyPct) / 100;
      setPenaltyAmount(calculatedPenalty);

      setCancelType('class');
      setTargetClassToCancel(mc);
      setCancelModalOpen(true);
    } catch (err: any) {
      showToast("Error al calcular penalización de clase: " + err.message, "error");
    }
  }

  async function handleProcessCancellationPayment() {
    if (!selectedMember) return;

    if (paymentMethod === 'tarjeta' && !voucherNumber.trim()) {
      return showToast("Ingresa el número de voucher de la tarjeta.", 'error');
    }
    if (paymentMethod === 'efectivo') {
      const given = parseFloat(cashGiven) || 0;
      if (given < penaltyAmount) {
        return showToast("El pago no cubre el monto de la penalización.", 'error');
      }
    }
    if (paymentMethod === 'mixto') {
      const card = parseFloat(cardAmountMixed) || 0;
      const cash = parseFloat(cashAmountMixed) || 0;
      const totalEntered = card + cash;
      if (totalEntered < penaltyAmount || Math.abs(totalEntered - penaltyAmount) > 0.05) {
        return showToast("El pago no cubre el monto de la penalización.", 'error');
      }
      if (!voucherNumber.trim()) {
        return showToast("Ingresa el número de voucher para el pago mixto con tarjeta.", 'error');
      }
    }

    setIsProcessingPayment(true);
    try {
      const ticketNum = Math.floor(1000 + Math.random() * 9000);

      if (penaltyAmount > 0) {
        const { error: saleErr } = await supabase.from('sales').insert({
          business_id: businessId,
          branch_id: branchId || branches[0]?.id,
          total_amount: penaltyAmount,
          status: 'Completada',
          payment_method: paymentMethod,
          voucher_number: voucherNumber.trim() || null,
          order_number: ticketNum,
          created_at: new Date().toISOString()
        });
        if (saleErr) throw saleErr;
      }

      if (cancelType === 'membership') {
        const { data, error } = await supabase.rpc('cancel_gym_membership', {
          p_member_id: selectedMember.id,
          p_business_id: businessId
        });
        if (error) throw error;
        if (!data.success) throw new Error(data.message);
        setSelectedMember({ ...selectedMember, status: 'Inactivo' });
        showToast("✅ Membresía cancelada y cobro de penalización registrado con éxito", "success");
      } else if (cancelType === 'class' && targetClassToCancel) {
        const { data, error } = await supabase.rpc('cancel_member_special_class', {
          p_assignment_id: targetClassToCancel.assignment_id,
          p_business_id: businessId
        });
        if (error) throw error;
        if (!data.success) throw new Error(data.message);
        openMemberDetail(selectedMember);
        showToast("✅ Clase fija cancelada con éxito", "success");
      }

      fetchGymMembers(businessId);
      setCancelModalOpen(false);
      setVoucherNumber('');
      setCashGiven('');
      setCardAmountMixed('');
      setCashAmountMixed('');
    } catch (err: any) {
      showToast("Error al procesar cancelación: " + err.message, "error");
    } finally {
      setIsProcessingPayment(false);
    }
  }

  async function handlePrintContract(m: any) {
    const expiryStr = m.expiry_date ? new Date(m.expiry_date).toLocaleDateString() : 'N/A';
    const startStr = m.start_date ? new Date(m.start_date).toLocaleDateString() : new Date().toLocaleDateString();

    const printWindow = window.open('', '_blank');
    if (!printWindow) return showToast("Habilita las ventanas emergentes.", "error");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Contrato de Membresía - ${m.customer_name}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 25px 40px; 
            color: #111; 
            line-height: 1.4; 
            font-size: 12px; 
          }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
          .title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-top: 5px; }
          .section { margin-bottom: 14px; }
          .box { background: #f9f9f9; border: 1px solid #ddd; padding: 10px; border-radius: 6px; margin-top: 4px; }
          .clauses { font-size: 10.5px; text-align: justify; color: #444; line-height: 1.35; }
          .clauses p { margin-bottom: 6px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 75px; text-align: center; page-break-inside: avoid; }
          .sig-line { border-top: 1px solid #333; width: 220px; margin: 0 auto; padding-top: 5px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${businessData.name}</h2>
          <div class="title">Contrato de Prestación de Servicios y Membresía Deportiva (${m.membership_type || 'General'})</div>
        </div>

        <div class="section">
          <strong>1. Datos Generales del Socio:</strong>
          <div class="box">
            <table width="100%" cellpadding="2" style="font-size: 12px;">
              <tr>
                <td><strong>Nombre:</strong> ${m.customer_name}</td>
                <td><strong>Teléfono:</strong> ${m.customer_phone || 'N/A'}</td>
              </tr>
              <tr>
                <td><strong>Código de Acceso:</strong> ${m.access_code || 'N/A'}</td>
                <td><strong>Vigencia:</strong> Del ${startStr} al <strong>${expiryStr}</strong></td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top: 4px;"><strong>Contacto de Emergencia:</strong> ${m.emergency_contact_name || 'N/A'} (${m.emergency_contact_relation || 'N/A'}) - Tel: ${m.emergency_contact_phone || 'N/A'}</td>
              </tr>
            </table>
          </div>
        </div>

        <div class="section">
          <strong>2. Términos y Condiciones del Servicio:</strong>
          <div class="clauses">
            <p><strong>PRIMERA (Del Servicio):</strong> El establecimiento se compromete a otorgar al socio el derecho de uso de las instalaciones y equipos del gimnasio bajo los horarios establecidos y de acuerdo con el plan contratado.</p>
            <p><strong>SEGUNDA (De los Pagos y Cuotas):</strong> El socio se compromete a realizar sus pagos puntualmente conforme al estado de cuenta acordado. El atraso o incumplimiento de las cuotas mensuales podrá derivar en la suspensión temporal del servicio de acceso.</p>
            <p><strong>TERCERA (De las Cancelaciones y Penalizaciones):</strong> La cancelación anticipada de la membresía o de clases especiales fijas estará sujeta a las políticas administrativas vigentes del establecimiento y al cobro de la penalización correspondiente calculada sobre el saldo pendiente.</p>
            <p><strong>CUARTA (De la Responsabilidad y Salud):</strong> El socio declara encontrarse en óptimas condiciones de salud para la práctica de actividad física, liberando al gimnasio de cualquier responsabilidad por accidentes derivados de la omisión de condiciones médicas preexistentes.</p>
          </div>
        </div>

        <div class="signatures">
          <div>
            <div class="sig-line">Firma del Socio</div>
            <p style="font-size: 11px; margin-top: 4px;">${m.customer_name}</p>
          </div>
          <div>
            <div class="sig-line">Autorizado por / Gimnasio</div>
            <p style="font-size: 11px; margin-top: 4px;">${businessData.name}</p>
          </div>
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
  
  function handleSendWhatsApp(m: any) {
    if (!m.customer_phone) return showToast("El socio no tiene teléfono.", "error");
    const cleanPhone = m.customer_phone.replace(/[^0-9]/g, '');
    const message = `Hola *${m.customer_name}*, te saludamos de *${businessData.name}*. Tu membresía con código *${m.access_code}* está activa. ¡Te esperamos! 💪`;
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
  }

  function handleSendPaymentReminderWhatsApp(m: any, ins: any) {
    if (!m.customer_phone) return showToast("El socio no tiene teléfono registrado.", "error");
    const cleanPhone = m.customer_phone.replace(/[^0-9]/g, '');
    const message = `Hola *${m.customer_name}*, te saludamos cordialmente de *${businessData.name}*. Te recordamos que tienes pendiente el pago de la cuota *${ins.title}* por un monto de *Q ${Number(ins.amount).toFixed(2)}*, con fecha de vencimiento el *${ins.due_date}*. Agradecemos tu pronta gestión para mantener tu membresía al día. ¡Muchas gracias! 🏋️‍♂️`;
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
  }

  async function compressImage(file: File, maxWidth = 400, maxHeight = 400, quality = 0.75): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          if (width > height) {
            if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
          } else {
            if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; }
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('Compresión fallida')); return }
            const compressedFile = new File([blob], file.name.split('.')[0] + ".jpg", { type: 'image/jpeg' })
            resolve(compressedFile)
          }, 'image/jpeg', quality)
        }
      }
      reader.onerror = (error) => reject(error)
    })
  }

  function openEditModal(m: any) {
    setEditMember(m);
    setEditName(m.customer_name || '');
    setEditPhone(m.customer_phone || '');
    setEditBirthDate(m.birth_date ? m.birth_date.split('T')[0] : '');
    setEditExpiry(m.expiry_date ? m.expiry_date.split('T')[0] : '');
    setEditStatus(m.status || 'Activo');
    setEditMembershipType(m.membership_type || '');
    setEditEmergencyName(m.emergency_contact_name || '');
    setEditEmergencyRelation(m.emergency_contact_relation || '');
    setEditEmergencyPhone(m.emergency_contact_phone || '');
    setEditImageFile(null);
  }

  async function handleUpdateMember(e: React.FormEvent) {
    e.preventDefault();
    if (!editMember || !editName.trim()) return showToast("El nombre es obligatorio.", "error");

    setIsUpdating(true);
    try {
      let photoUrl = editMember.photo_url;
      if (editImageFile) {
        const optimizedFile = await compressImage(editImageFile);
        const fileName = `gym_edit_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('products').upload(fileName, optimizedFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('products').getPublicUrl(fileName);
        photoUrl = data.publicUrl;
      }

      const cleanBirthDate = editBirthDate && editBirthDate.trim() !== '' ? editBirthDate : null;
      const cleanExpiry = editExpiry && editExpiry.trim() !== '' ? editExpiry : null;

      const { error } = await supabase.rpc('update_gym_member_v2', {
        p_member_id: editMember.id,
        p_business_id: businessId,
        p_full_name: editName.trim(),
        p_phone: editPhone.trim() || null,
        p_birth_date: cleanBirthDate,
        p_expiry_date: cleanExpiry,
        p_photo_url: photoUrl,
        p_status: editStatus,
        p_membership_type: editMembershipType.trim() || null,
        p_emergency_name: editEmergencyName.trim() || null,
        p_emergency_relation: editEmergencyRelation.trim() || null,
        p_emergency_phone: editEmergencyPhone.trim() || null
      });

      if (error) throw error;
      
      showToast("✅ Socio actualizado con éxito", "success");
      setEditMember(null);
      fetchGymMembers(businessId);
    } catch (err: any) {
      console.error("Error al actualizar socio:", err);
      showToast("Error al actualizar: " + err.message, "error");
    } finally {
      setIsUpdating(false);
    }
  }

  const filteredMembers = members.filter(m => 
    (m.customer_name && m.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (m.customer_phone && m.customer_phone.includes(searchTerm)) ||
    (m.access_code && m.access_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeCount = members.filter(m => m.status !== 'Inactivo').length;
  const inactiveCount = members.filter(m => m.status === 'Inactivo').length;

  const themeBg = darkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = darkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-lg'
  const inputBg = darkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-slate-50 text-slate-900 border-slate-300'

  const totalInstallmentsAmount = installments.reduce((sum, ins) => sum + Number(ins.amount || 0), 0);
  const cardMixedNum = parseFloat(cardAmountMixed) || 0;
  const cashMixedNum = parseFloat(cashAmountMixed) || 0;
  const totalMixedEntered = cardMixedNum + cashMixedNum;
  
  const targetInstallmentAmount = selectedInstallment ? Number(selectedInstallment.amount) : 0;
  const remainingMixedInstallment = targetInstallmentAmount - totalMixedEntered;
  const remainingMixedPenalty = penaltyAmount - totalMixedEntered;

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className={`min-h-screen p-3 sm:p-6 flex flex-col notranslate relative w-full ${themeBg}`} translate="no">
      
      {toast && (
        <div className="fixed top-5 right-5 z-[99999] animate-bounce max-w-[90vw]">
          <div className={`px-4 py-3 rounded-xl shadow-2xl border font-bold text-sm flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-red-600 text-white border-red-400'
          }`}>
            <span>{toast.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <div className="w-full space-y-4 sm:space-y-6">
        
        <div className={`p-4 rounded-xl shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border ${panelBg}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => router.push('/dashboard')} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow">
              ← Volver
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-cyan-400">🏋️‍♂️ Control de Socios y Membresías</h1>
              <p className="text-[11px] sm:text-xs opacity-75">Administración general de miembros del gimnasio</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition-all ${
                darkMode ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30' : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
              title="Cambiar tema claro u oscuro"
            >
              {darkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
            </button>

            <button onClick={() => router.push('/gyminscriptions')} className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow text-center">
              + Inscribir Nuevo Socio
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className={`p-4 rounded-xl border shadow flex items-center gap-4 ${panelBg}`}>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-black">
              🟢
            </div>
            <div>
              <p className="text-[11px] opacity-75 font-semibold uppercase">Socios Activos</p>
              <h3 className="text-xl font-black text-emerald-400">{activeCount}</h3>
            </div>
          </div>

          <div className={`p-4 rounded-xl border shadow flex items-center gap-4 ${panelBg}`}>
            <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center text-xl font-black">
              🔴
            </div>
            <div>
              <p className="text-[11px] opacity-75 font-semibold uppercase">Socios Inactivos</p>
              <h3 className="text-xl font-black text-red-400">{inactiveCount}</h3>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-xl shadow border flex gap-3 ${panelBg}`}>
          <input 
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="🔍 Buscar socio por nombre, teléfono o código..."
            className={`border px-4 py-2.5 rounded-xl text-xs sm:text-sm outline-none w-full ${inputBg}`}
          />
        </div>

        <div className={`rounded-xl shadow overflow-hidden border ${panelBg}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className={`border-b text-xs ${darkMode ? 'border-slate-700 opacity-75' : 'border-slate-200 bg-slate-50 text-slate-700 font-bold'}`}>
                <tr>
                  <th className="p-4">Nombre Completo</th>
                  <th className="p-4">Teléfono</th>
                  <th className="p-4">Código / Carnet</th>
                  <th className="p-4">Vencimiento</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center opacity-75">Cargando socios...</td></tr>
                ) : filteredMembers.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center opacity-75">No hay socios registrados.</td></tr>
                ) : (
                  filteredMembers.map((m) => (
                    <tr key={m.id} className={`border-b text-sm ${darkMode ? 'border-slate-700/50 hover:bg-slate-800/40' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <td className="p-4 font-semibold text-cyan-500 flex items-center gap-3">
                        {m.photo_url ? (
                          <img src={m.photo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-cyan-500" />
                        ) : (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800'}`}>👤</div>
                        )}
                        {m.customer_name}
                      </td>
                      <td className="p-4 opacity-85">{m.customer_phone || 'N/A'}</td>
                      <td className="p-4 font-mono text-amber-500 font-bold">{m.access_code || 'S/C'}</td>
                      <td className="p-4">{m.expiry_date ? new Date(m.expiry_date).toLocaleDateString() : 'Sin fecha'}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          m.status === 'Inactivo' ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-600'
                        }`}>
                          {m.status || 'Activo'}
                        </span>
                      </td>
                      <td className="p-4 text-center space-x-1.5">
                        <button onClick={() => openMemberDetail(m)} className="bg-cyan-600 hover:bg-cyan-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow">
                          📋 Ficha
                        </button>
                        <button onClick={() => openAccountStatement(m)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow">
                          💳 Estado de Cuenta
                        </button>
                        <button onClick={() => handlePrintContract(m)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow">
                          📄 Contrato
                        </button>
                        <button onClick={() => handleSendWhatsApp(m)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow">
                          📱 WhatsApp
                        </button>
                        <button onClick={() => openEditModal(m)} className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow">
                          ✏️ Editar
                        </button>
                        <button onClick={() => setBadgeMember(m)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow">
                          🖨️ Gafete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {selectedMember && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className={`p-4 sm:p-6 rounded-2xl border border-cyan-500 w-full max-w-lg shadow-2xl space-y-4 my-8 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-slate-700">
              <h3 className="text-sm font-bold text-cyan-400">📋 Ficha Integral y Contrato</h3>
              <button onClick={() => setSelectedMember(null)} className="font-bold text-lg">✕</button>
            </div>

            <div className="space-y-4 py-1 text-xs max-h-[75vh] overflow-y-auto pr-1">
              
              <div className={`p-3.5 rounded-xl border flex items-center gap-4 ${darkMode ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-cyan-400 shadow bg-slate-800 flex-shrink-0 flex items-center justify-center">
                  {selectedMember.photo_url ? <img src={selectedMember.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl">🏋️‍♂️</span>}
                </div>
                <div>
                  <h4 className={`text-sm sm:text-base font-extrabold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedMember.customer_name}</h4>
                  <p className="text-cyan-500 font-mono font-bold mt-0.5">{selectedMember.access_code || 'S/C'}</p>
                  <p className="text-amber-500 font-semibold text-[11px] mt-0.5">Plan: {selectedMember.membership_type || 'General'}</p>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                    selectedMember.status === 'Inactivo' ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-600'
                  }`}>
                    {selectedMember.status || 'Activo'}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => { setSelectedMember(null); openAccountStatement(selectedMember); }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-3 rounded-xl font-bold text-xs shadow flex items-center justify-center gap-2"
              >
                💳 Ver Estado de Cuenta a 12 Cuotas + Inscripción
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button onClick={() => handlePrintContract(selectedMember)} className="bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-3 rounded-xl font-bold text-xs shadow flex items-center justify-center gap-2">
                  📄 Imprimir Contrato PDF
                </button>
                <button onClick={() => handleSendWhatsApp(selectedMember)} className="bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-3 rounded-xl font-bold text-xs shadow flex items-center justify-center gap-2">
                  📱 Enviar por WhatsApp
                </button>
              </div>

              <div className={`grid grid-cols-2 gap-2 p-3 rounded-xl border ${darkMode ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <span className="opacity-60 block text-[10px] uppercase">Teléfono / WhatsApp</span>
                  <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedMember.customer_phone || 'No registrado'}</span>
                </div>
                <div>
                  <span className="opacity-60 block text-[10px] uppercase">Vencimiento</span>
                  <span className="font-bold text-amber-500">{selectedMember.expiry_date ? new Date(selectedMember.expiry_date).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>

              <div className={`border p-3.5 rounded-xl space-y-2 ${darkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <h5 className="font-extrabold text-cyan-400 uppercase tracking-wide text-[11px]">💳 Desglose Base y Clases</h5>
                  {selectedMember.status !== 'Inactivo' && (
                    <button onClick={() => prepareCancelMembership()} className="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-[10px] font-bold">
                      ❌ Cancelar Membresía
                    </button>
                  )}
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="opacity-80">Membresía Mensual Base:</span>
                  <span className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`} translate="no">Q {membershipFee.toFixed(2)}</span>
                </div>

                <div className="space-y-1 pt-1">
                  <span className="opacity-80 block font-semibold text-[10px] uppercase text-amber-500">Clases Fijas y Costos Extra:</span>
                  {memberClasses.length === 0 ? (
                    <p className="opacity-60 italic text-[11px]">Sin clases fijas asignadas.</p>
                  ) : (
                    memberClasses.map((mc: any) => (
                      <div key={mc.assignment_id} className="flex justify-between items-center pl-2 py-0.5 text-[11px]">
                        <span className="text-amber-500">• {mc.class_name} ({mc.status})</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-emerald-500" translate="no">Q {mc.fee_charged}</span>
                          {mc.status === 'Activo' && (
                            <button onClick={() => prepareCancelClass(mc)} className="bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 rounded text-[9px] font-bold">
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-red-950/20 border border-red-500/30 p-3.5 rounded-xl space-y-2">
                <h5 className="font-extrabold text-red-500 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                  🚨 Contacto en Caso de Emergencia
                </h5>
                <div className="grid grid-cols-1 gap-1 text-xs pt-0.5">
                  <p>👤 Nombre: <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedMember.emergency_contact_name || 'No registrado'}</span></p>
                  <p>🤝 Parentesco: <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedMember.emergency_contact_relation || 'No registrado'}</span></p>
                  <p>📞 Teléfono: <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedMember.emergency_contact_phone || 'No registrado'}</span></p>
                </div>
              </div>

            </div>

            <button onClick={() => setSelectedMember(null)} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl font-bold text-xs">
              Cerrar Ficha
            </button>
          </div>
        </div>
      )}

      {paymentModalOpen && selectedInstallment && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-3 sm:p-4 z-[99999]">
          <div className={`p-4 sm:p-6 rounded-2xl border border-emerald-500 w-full max-w-md shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-slate-700">
              <h3 className="text-sm font-bold text-emerald-400">💳 Registrar Pago de Cuota</h3>
              <button onClick={() => setPaymentModalOpen(false)} className="font-bold text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`p-3 rounded-xl border space-y-1 ${darkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <p className="font-bold text-cyan-500 text-sm">{selectedInstallment.title}</p>
                <p className="opacity-75">Vencimiento: {selectedInstallment.due_date}</p>
                <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                  <span className="font-extrabold">Monto a Cobrar:</span>
                  <span className="text-base font-black text-emerald-500" translate="no">Q {Number(selectedInstallment.amount).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Método de Pago</label>
                <select 
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className={`w-full border p-2.5 rounded-xl outline-none font-semibold ${inputBg}`}
                >
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="tarjeta">💳 Tarjeta de Crédito / Débito</option>
                  <option value="mixto">🔄 Mixto (Tarjeta + Efectivo)</option>
                </select>
              </div>

              {paymentMethod === 'tarjeta' && (
                <div>
                  <label className="block font-semibold mb-1 text-amber-500">Número de Voucher *</label>
                  <input 
                    type="text"
                    value={voucherNumber}
                    onChange={e => setVoucherNumber(e.target.value)}
                    placeholder="Ej. VOU-987654"
                    className={`w-full border p-2.5 rounded-xl outline-none font-mono ${inputBg}`}
                    required
                  />
                </div>
              )}

              {paymentMethod === 'efectivo' && (
                <div className="space-y-1">
                  <label className="block font-semibold mb-1 text-emerald-500">Efectivo Recibido (Q)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={cashGiven}
                    onChange={e => setCashGiven(e.target.value)}
                    placeholder="0.00"
                    className={`w-full border p-2.5 rounded-xl outline-none font-bold ${inputBg}`}
                  />
                  {cashGiven && (
                    <div className="text-right pt-1 font-bold">
                      {parseFloat(cashGiven) >= Number(selectedInstallment.amount) ? (
                        <span className="text-emerald-500">Vuelto a entregar: Q {(parseFloat(cashGiven) - Number(selectedInstallment.amount)).toFixed(2)}</span>
                      ) : (
                        <span className="text-red-500">⚠️ El pago no cubre el monto de la cuota</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'mixto' && (
                <div className={`space-y-2 border p-3 rounded-xl ${darkMode ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                  <div>
                    <label className="block font-semibold mb-1">Monto Tarjeta (Q)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={cardAmountMixed}
                      onChange={e => setCardAmountMixed(e.target.value)}
                      placeholder="0.00"
                      className={`w-full border p-2 rounded outline-none ${inputBg}`}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Número de Voucher *</label>
                    <input 
                      type="text"
                      value={voucherNumber}
                      onChange={e => setVoucherNumber(e.target.value)}
                      placeholder="Voucher..."
                      className={`w-full border p-2 rounded outline-none font-mono ${inputBg}`}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Monto Efectivo (Q)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={cashAmountMixed}
                      onChange={e => setCashAmountMixed(e.target.value)}
                      placeholder="0.00"
                      className={`w-full border p-2 rounded outline-none ${inputBg}`}
                    />
                  </div>
                  <div className="pt-2 border-t border-slate-700 text-right font-bold">
                    {Math.abs(remainingMixedInstallment) <= 0.05 ? (
                      <span className="text-emerald-500">✅ Monto exacto cubierto</span>
                    ) : remainingMixedInstallment > 0 ? (
                      <span className="text-red-500">⚠️ El pago no cubre el monto de la cuota</span>
                    ) : (
                      <span className="text-amber-500">⚠️ Ingresaste de más por: Q {Math.abs(remainingMixedInstallment).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-700">
              <button 
                onClick={handlePayInstallment}
                disabled={isProcessingPayment}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black text-xs shadow disabled:opacity-50"
              >
                {isProcessingPayment ? 'Procesando...' : '✅ Confirmar y Registrar Pago'}
              </button>
              <button onClick={() => setPaymentModalOpen(false)} className="bg-slate-700 text-white px-4 py-3 rounded-xl font-bold text-xs">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-3 sm:p-4 z-[9999]">
          <div className={`p-4 sm:p-6 rounded-2xl border border-red-500 w-full max-w-md shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-slate-700">
              <h3 className="text-sm font-bold text-red-400">
                {cancelType === 'membership' ? '⚠️ Cancelación Anticipada de Membresía' : '⚠️ Cancelación de Clase Especial'}
              </h3>
              <button onClick={() => setCancelModalOpen(false)} className="font-bold text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`p-3 rounded-xl border space-y-1.5 ${darkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                {cancelType === 'membership' ? (
                  <>
                    <div className="flex justify-between">
                      <span className="opacity-80">Suma Total de Cuotas Pendientes:</span>
                      <span className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`} translate="no">Q {pendingInstallmentsTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-80">Penalización Configurada:</span>
                      <span className="font-bold text-amber-500">{penaltyPercentUsed}%</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="opacity-80">Costo Clase x Meses Pendientes:</span>
                      <span className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`} translate="no">Q {pendingInstallmentsTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-80">Penalización Configurada:</span>
                      <span className="font-bold text-amber-500">{penaltyPercentUsed}%</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                  <span className="font-extrabold text-red-400">Total Penalización a Cobrar:</span>
                  <span className="text-base font-black text-emerald-500" translate="no">Q {penaltyAmount.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Método de Pago de Penalización</label>
                <select 
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className={`w-full border p-2.5 rounded-xl outline-none font-semibold ${inputBg}`}
                >
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="tarjeta">💳 Tarjeta de Crédito / Débito</option>
                  <option value="mixto">🔄 Mixto (Tarjeta + Efectivo)</option>
                </select>
              </div>

              {paymentMethod === 'tarjeta' && (
                <div>
                  <label className="block font-semibold mb-1 text-amber-500">Número de Voucher *</label>
                  <input 
                    type="text"
                    value={voucherNumber}
                    onChange={e => setVoucherNumber(e.target.value)}
                    placeholder="Ej. VOU-987654"
                    className={`w-full border p-2.5 rounded-xl outline-none font-mono ${inputBg}`}
                    required
                  />
                </div>
              )}

              {paymentMethod === 'efectivo' && (
                <div className="space-y-1">
                  <label className="block font-semibold mb-1 text-emerald-500">Efectivo Recibido (Q)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={cashGiven}
                    onChange={e => setCashGiven(e.target.value)}
                    placeholder="0.00"
                    className={`w-full border p-2.5 rounded-xl outline-none font-bold ${inputBg}`}
                  />
                  {cashGiven && (
                    <div className="text-right pt-1 font-bold">
                      {parseFloat(cashGiven) >= penaltyAmount ? (
                        <span className="text-emerald-500">Vuelto a entregar: Q {(parseFloat(cashGiven) - penaltyAmount).toFixed(2)}</span>
                      ) : (
                        <span className="text-red-500">⚠️ El pago no cubre el monto de la penalización</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'mixto' && (
                <div className={`space-y-2 border p-3 rounded-xl ${darkMode ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                  <div>
                    <label className="block font-semibold mb-1">Monto Tarjeta (Q)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={cardAmountMixed}
                      onChange={e => setCardAmountMixed(e.target.value)}
                      placeholder="0.00"
                      className={`w-full border p-2 rounded outline-none ${inputBg}`}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Número de Voucher *</label>
                    <input 
                      type="text"
                      value={voucherNumber}
                      onChange={e => setVoucherNumber(e.target.value)}
                      placeholder="Voucher..."
                      className={`w-full border p-2 rounded outline-none font-mono ${inputBg}`}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Monto Efectivo (Q)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={cashAmountMixed}
                      onChange={e => setCashAmountMixed(e.target.value)}
                      placeholder="0.00"
                      className={`w-full border p-2 rounded outline-none ${inputBg}`}
                    />
                  </div>
                  <div className="pt-2 border-t border-slate-700 text-right font-bold">
                    {Math.abs(remainingMixedPenalty) <= 0.05 ? (
                      <span className="text-emerald-500">✅ Monto exacto cubierto</span>
                    ) : remainingMixedPenalty > 0 ? (
                      <span className="text-red-500">⚠️ El pago no cubre el monto de la penalización</span>
                    ) : (
                      <span className="text-amber-500">⚠️ Ingresaste de más por: Q {Math.abs(remainingMixedPenalty).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-700">
              <button 
                onClick={handleProcessCancellationPayment}
                disabled={isProcessingPayment}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-black text-xs shadow disabled:opacity-50"
              >
                {isProcessingPayment ? 'Procesando...' : '✅ Pagar Penalización y Cancelar'}
              </button>
              <button onClick={() => setCancelModalOpen(false)} className="bg-slate-700 text-white px-4 py-3 rounded-xl font-bold text-xs">
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {accountStatementMember && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className={`p-4 sm:p-6 rounded-2xl border border-emerald-500 w-full max-w-2xl shadow-2xl space-y-4 my-8 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-slate-700">
              <div>
                <h3 className="text-sm font-bold text-emerald-400">💳 Estado de Cuenta Detallado (Inscripción + 12 Cuotas)</h3>
                <p className="text-xs opacity-75">Socio: <span className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{accountStatementMember.customer_name}</span></p>
              </div>
              <button onClick={() => setAccountStatementMember(null)} className="font-bold text-lg opacity-75 hover:opacity-100">✕</button>
            </div>

            <div className={`p-3.5 rounded-xl border flex justify-between items-center ${darkMode ? 'bg-slate-900/80 border-emerald-500/40' : 'bg-emerald-50 border-emerald-200'}`}>
              <div>
                <span className="text-[11px] uppercase tracking-wider opacity-75 block">Total General del Plan</span>
                <span className="text-xs font-semibold text-cyan-500">Inscripción Inicial + 12 Mensualidades</span>
              </div>
              <span className="text-base sm:text-lg font-black text-emerald-600" translate="no">Q {totalInstallmentsAmount.toFixed(2)}</span>
            </div>

            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {installments.length === 0 ? (
                <p className="text-center py-6 text-xs opacity-75 animate-pulse">Cargando o generando cuotas del socio...</p>
              ) : (
                installments.map((ins) => {
                  const isOverdue = ins.status !== 'Pagada' && ins.due_date && ins.due_date < todayStr;
                  return (
                    <div key={ins.id} className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${
                      ins.status === 'Pagada' 
                        ? (darkMode ? 'bg-emerald-950/20 border-emerald-500/30 opacity-75' : 'bg-emerald-50 border-emerald-200') 
                        : isOverdue
                          ? (darkMode ? 'bg-red-950/30 border-red-500/50' : 'bg-red-50 border-red-300')
                          : (darkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200')
                    }`}>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-cyan-500">
                            {ins.installment_number === 0 ? '🎯 Inscripción Inicial' : `#${ins.installment_number} - ${ins.title}`}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ins.status === 'Pagada' ? 'bg-emerald-500/20 text-emerald-600' : isOverdue ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-amber-500/20 text-amber-600'
                          }`}>
                            {ins.status === 'Pagada' ? 'Pagada' : isOverdue ? '⚠️ Atrasado' : 'Pendiente'}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-75 mt-0.5">Vencimiento: {ins.due_date}</p>
                      </div>

                      <div className="flex items-center justify-between w-full sm:w-auto gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-slate-700 flex-wrap">
                        <span className="font-black text-emerald-600 text-sm" translate="no">Q {Number(ins.amount).toFixed(2)}</span>
                        <div className="flex gap-1.5">
                          {ins.status !== 'Pagada' && isOverdue && (
                            <button 
                              onClick={() => handleSendPaymentReminderWhatsApp(accountStatementMember, ins)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow flex items-center gap-1"
                              title="Enviar recordatorio de pago por WhatsApp"
                            >
                              📱 WhatsApp
                            </button>
                          )}
                          {ins.status !== 'Pagada' && (
                            <button 
                              onClick={() => { setSelectedInstallment(ins); setPaymentModalOpen(true); }}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow"
                            >
                              💳 Cobrar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <button onClick={() => setAccountStatementMember(null)} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl font-bold text-xs">
              Cerrar Estado de Cuenta
            </button>
          </div>
        </div>
      )}

      {editMember && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <form onSubmit={handleUpdateMember} className={`p-4 sm:p-6 rounded-2xl border border-amber-500 w-full max-w-lg shadow-2xl space-y-4 my-8 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-slate-700">
              <h3 className="text-sm font-bold text-amber-500">✏️ Editar Expediente y Membresía del Socio</h3>
              <button type="button" onClick={() => setEditMember(null)} className="font-bold text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="block font-semibold mb-1">Nombre Completo *</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className={`w-full border p-2.5 rounded-xl outline-none text-sm ${inputBg}`}
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Teléfono / WhatsApp</label>
                <input 
                  type="text" 
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className={`w-full border p-2.5 rounded-xl outline-none text-sm ${inputBg}`}
                  placeholder="Ej. 50230294506"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Fecha de Nacimiento</label>
                <input 
                  type="date" 
                  value={editBirthDate}
                  onChange={e => setEditBirthDate(e.target.value)}
                  className={`w-full border p-2.5 rounded-xl outline-none text-sm ${inputBg}`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-cyan-500">Tipo de Plan / Membresía</label>
                <select
                  value={editMembershipType}
                  onChange={e => setEditMembershipType(e.target.value)}
                  className={`w-full border p-2.5 rounded-xl outline-none text-sm font-semibold ${inputBg}`}
                >
                  <option value="">-- Seleccione un Plan Configurado --</option>
                  {availablePlans.map((p: any) => (
                    <option key={p.id} value={p.plan_name}>
                      {p.plan_name} (Q {Number(p.monthly_fee).toFixed(2)}/mes)
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-slate-700 pt-3 mt-3">
                <h4 className="font-bold text-amber-500 mb-2 uppercase tracking-wide">🚨 Contacto de Emergencia</h4>
                
                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold mb-1">Nombre del Contacto</label>
                    <input 
                      type="text" 
                      value={editEmergencyName}
                      onChange={e => setEditEmergencyName(e.target.value)}
                      className={`w-full border p-2.5 rounded-xl outline-none text-sm ${inputBg}`}
                      placeholder="Ej. Nancy Mariela"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Parentesco</label>
                    <input 
                      type="text" 
                      value={editEmergencyRelation}
                      onChange={e => setEditEmergencyRelation(e.target.value)}
                      className={`w-full border p-2.5 rounded-xl outline-none text-sm ${inputBg}`}
                      placeholder="Ej. Esposa"
                    />
                  </div>

                  <div>
  <label className="block font-semibold mb-1">Teléfono de Emergencia</label>
  <input 
    type="text" 
    value={editEmergencyPhone}
    onChange={e => setEditEmergencyPhone(e.target.value)}
    className={`w-full border p-2.5 rounded-xl outline-none text-sm ${inputBg}`}
    placeholder="Ej. 12345678"
  />
</div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-700">
              <button type="submit" disabled={isUpdating} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-xl font-bold text-xs shadow">
                {isUpdating ? 'Guardando...' : '💾 Guardar Cambios'}
              </button>
              <button type="button" onClick={() => setEditMember(null)} className="bg-slate-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {badgeMember && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-white text-slate-900 p-6 rounded-2xl w-full max-w-sm shadow-2xl space-y-4 text-center border-4 border-slate-800">
            {businessData.logo && (
              <img src={businessData.logo} alt="Logo" className="w-16 h-16 mx-auto object-contain rounded-full shadow-md mb-1" />
            )}
            <h2 className="text-xl font-black">{businessData.name}</h2>
            <hr className="border-slate-300 my-2" />
            <h3 className="text-lg font-extrabold uppercase text-slate-800">{badgeMember.customer_name}</h3>
            <p className="font-mono text-sm font-bold text-cyan-700 bg-cyan-50 py-1 px-3 rounded-lg inline-block">
              CÓDIGO: {badgeMember.access_code ? badgeMember.access_code.replace('COD-', '') : 'S/C'}
            </p>
            <div className="flex justify-center p-2 bg-slate-50 border border-slate-200 rounded-xl">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(badgeMember.access_code ? badgeMember.access_code.replace('COD-', '') : 'SIN-CODE')}`} 
                alt="QR" 
                className="w-40 h-40 mx-auto"
              />
            </div>
            <button onClick={() => setBadgeMember(null)} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold w-full transition">
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  )
}