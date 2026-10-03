import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shipment, Job, Profile } from '../types/database';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ShipmentDetailModal } from './ShipmentDetailModal';
import {
  Package,
  Plane,
  Anchor,
  Truck,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  X,
  Plus,
  Eye,
  Check,
  Ship,
  Flame,
  Zap,
} from 'lucide-react';

export const ShipmentsList: React.FC = () => {
  const { isDark } = useTheme();
  const { currentUser, isAdmin } = useAuth();
  const { t, language } = useLanguage();

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');

  // Selected shipment for modal
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  // New Shipment Modal (Admins only)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jobId, setJobId] = useState('');
  const [bookingNo, setBookingNo] = useState('');
  const [poNo, setPoNo] = useState('');
  const [awbBl, setAwbBl] = useState('');
  const [flightVessel, setFlightVessel] = useState('');
  const [descriptionOfGoods, setDescriptionOfGoods] = useState('');
  const [packageQty, setPackageQty] = useState('');
  const [supplier, setSupplier] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('Unithai Shipyard Laem Chabang');
  const [mode, setMode] = useState<'AIR' | 'SEA' | 'COURIER' | 'LAND'>('AIR');
  const [urgency, setUrgency] = useState<'CRITICAL' | 'URGENT' | 'NORMAL'>('NORMAL');
  const [eta, setEta] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [status, setStatus] = useState<'IN_TRANSIT' | 'ARRIVING_TODAY' | 'RECEIVED' | 'DELAYED'>('IN_TRANSIT');

  const loadData = async () => {
    try {
      setLoading(true);
      const jobsRes = await supabase.from('jobs').select('*');
      if (jobsRes.data) setJobs(jobsRes.data);

      if (isAdmin) {
        // Admin sees all shipments
        const { data } = await supabase.from('shipments').select('*').order('eta', { ascending: true });
        if (data) setShipments(data);
      } else if (currentUser?.id) {
        // SRM only sees shipments for assigned jobs
        const { data: assignments } = await supabase
          .from('job_assignments')
          .select('job_id')
          .eq('user_id', currentUser.id);

        const assignedJobIds = (assignments || []).map((a: any) => a.job_id);
        if (assignedJobIds.length > 0) {
          const { data } = await supabase
            .from('shipments')
            .select('*')
            .in('job_id', assignedJobIds)
            .order('eta', { ascending: true });
          if (data) setShipments(data);
        } else {
          setShipments([]);
        }
      }
    } catch (err) {
      console.error('Error loading shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser, isAdmin]);

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId || !awbBl.trim() || !supplier.trim()) return;

    await supabase.from('shipments').insert({
      job_id: jobId,
      booking_no: bookingNo.trim() || `BKG-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      po_no: poNo.trim() || `PO-${Math.floor(100000 + Math.random() * 900000)}`,
      awb_bl: awbBl.trim().toUpperCase(),
      flight_vessel: flightVessel.trim() || 'MV CARGO',
      description_of_goods: descriptionOfGoods.trim() || 'Ship Repair Spare Parts',
      package_qty: packageQty.trim() || '1 Crate',
      supplier: supplier.trim(),
      origin: origin.trim() || 'International',
      destination: destination.trim(),
      mode,
      urgency,
      eta: new Date(eta).toISOString(),
      status,
      received_date: status === 'RECEIVED' ? new Date().toISOString() : null,
    });

    setIsModalOpen(false);
    setAwbBl('');
    setBookingNo('');
    setPoNo('');
    setDescriptionOfGoods('');
    setFlightVessel('');
    setSupplier('');
    setOrigin('');
    setUrgency('NORMAL');
    await loadData();
  };

  const handleUpdateStatus = async (shipmentId: string, newStatus: any, e: React.MouseEvent | React.ChangeEvent<any>) => {
    e.stopPropagation();
    await supabase.from('shipments').update({
      status: newStatus,
      received_date: newStatus === 'RECEIVED' ? new Date().toISOString() : null,
      receiver_name: newStatus === 'RECEIVED' ? (currentUser?.full_name || 'SRM Officer') : null,
      receiver_notes: newStatus === 'RECEIVED' ? (language === 'th' ? 'ตรวจรับเข้าอู่เรือแล้ว' : 'Received into shipyard') : null,
    }).eq('id', shipmentId);
    await loadData();
  };

  const filtered = shipments.filter((s) => {
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchesUrgency = urgencyFilter === 'ALL' || (s.urgency || 'NORMAL') === urgencyFilter;
    const q = searchQuery.toLowerCase();
    const relatedJob = jobs.find((j) => j.id === s.job_id);
    const matchesSearch =
      s.awb_bl.toLowerCase().includes(q) ||
      (s.booking_no && s.booking_no.toLowerCase().includes(q)) ||
      (s.po_no && s.po_no.toLowerCase().includes(q)) ||
      (s.description_of_goods && s.description_of_goods.toLowerCase().includes(q)) ||
      s.supplier.toLowerCase().includes(q) ||
      (relatedJob && (relatedJob.job_no.toLowerCase().includes(q) || relatedJob.vessel.toLowerCase().includes(q)));
    return matchesStatus && matchesUrgency && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-cyan-700 dark:text-cyan-400" />
            <span>{isAdmin ? t.allConsignmentsTitle : t.myShipments}</span>
          </h2>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-0.5">
            {isAdmin ? t.allConsignmentsSub : t.incomingSparePartsSub}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border focus:outline-hidden ${
                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-950 shadow-xs'
              }`}
            />
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.newShipmentBtn}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Urgency Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        {/* Urgency Filter */}
        <div className="flex items-center gap-1 text-[11px] font-mono">
          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mr-1">
            {language === 'th' ? 'ระดับความด่วน:' : 'Urgency:'}
          </span>
          <button
            onClick={() => setUrgencyFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
              urgencyFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-950 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
          >
            {t.urgencyAll}
          </button>
          <button
            onClick={() => setUrgencyFilter('CRITICAL')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-black cursor-pointer transition-all flex items-center gap-1 ${
              urgencyFilter === 'CRITICAL'
                ? 'bg-red-600 text-white border-red-700 shadow-sm animate-pulse'
                : 'bg-red-100 dark:bg-red-950/50 text-red-950 dark:text-red-300 border-red-300 dark:border-red-800'
            }`}
          >
            <Flame className="w-3 h-3 text-red-600 dark:text-red-400" />
            <span>CRITICAL</span>
          </button>
          <button
            onClick={() => setUrgencyFilter('URGENT')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-black cursor-pointer transition-all flex items-center gap-1 ${
              urgencyFilter === 'URGENT'
                ? 'bg-amber-400 text-slate-950 border-amber-600 shadow-sm'
                : 'bg-amber-100 dark:bg-amber-950/50 text-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800'
            }`}
          >
            <Zap className="w-3 h-3 text-amber-700 dark:text-amber-400" />
            <span>{language === 'th' ? 'ด่วน' : 'URGENT'}</span>
          </button>
          <button
            onClick={() => setUrgencyFilter('NORMAL')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
              urgencyFilter === 'NORMAL'
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
          >
            <span>📦 {language === 'th' ? 'ปกติ' : 'NORMAL'}</span>
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
          {['ALL', 'ARRIVING_TODAY', 'IN_TRANSIT', 'DELAYED', 'RECEIVED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap font-bold ${
                statusFilter === st
                  ? 'bg-cyan-700 border-cyan-800 text-white shadow-xs'
                  : isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                  : 'bg-white border-slate-300 text-slate-800 hover:text-slate-950 shadow-xs'
              }`}
            >
              {st === 'ALL'
                ? (language === 'th' ? 'พัสดุทั้งหมด' : 'ALL SHIPMENTS')
                : st === 'ARRIVING_TODAY'
                ? (language === 'th' ? 'ถึงวันนี้' : 'Arriving')
                : st === 'RECEIVED'
                ? (language === 'th' ? 'รับแล้ว' : 'Received')
                : st === 'DELAYED'
                ? (language === 'th' ? 'ล่าช้า' : 'Delayed')
                : (language === 'th' ? 'กำลังส่ง' : 'Transit')}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table with High Contrast Friendly Colors */}
      <div
        className={`rounded-2xl border overflow-hidden transition-all shadow-md ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead
              className={`border-b text-[12px] font-extrabold uppercase font-sans ${
                isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-900'
              }`}
            >
              <tr>
                <th className="py-3.5 px-4 font-black">{t.colJobVessel}</th>
                <th className="py-3.5 px-4 font-black">BOOKING / PO</th>
                <th className="py-3.5 px-4 font-black">{t.colAwbBl}</th>
                <th className="py-3.5 px-4 font-black">{t.colSupplierOrigin}</th>
                <th className="py-3.5 px-4 font-black">{t.colMode}</th>
                <th className="py-3.5 px-4 font-black">{t.colEta}</th>
                <th className="py-3.5 px-4 font-black">{t.status}</th>
                <th className="py-3.5 px-4 font-black text-right">{language === 'th' ? 'การดำเนินการ' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-700 dark:text-slate-300">
                    <div className="inline-block w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="font-bold">{t.loading}</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-700 dark:text-slate-300">
                    <p className="font-bold text-sm">
                      {language === 'th' ? 'ไม่พบรายการพัสดุที่ตรงกับเงื่อนไข' : 'No shipments found matching current filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const job = jobs.find((j) => j.id === s.job_id);
                  const isReceived = s.status === 'RECEIVED';
                  const isCritical = s.urgency === 'CRITICAL';
                  const isUrgent = s.urgency === 'URGENT';

                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedShipment(s)}
                      className={`cursor-pointer transition-colors ${
                        isDark ? 'hover:bg-slate-800/80' : 'hover:bg-cyan-50/70'
                      }`}
                    >
                      {/* Job & Vessel */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-black text-xs text-slate-950 dark:text-white line-clamp-1">
                            {s.description_of_goods || job?.job_name || 'Marine Spare Part'}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="font-extrabold text-xs text-cyan-900 dark:text-cyan-300">
                              {job?.vessel || 'Vessel'}
                            </span>
                            <span className="font-mono font-bold text-[10px] text-slate-700 dark:text-slate-300">
                              ({job?.job_no || 'Job'})
                            </span>

                            {isCritical && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-red-600 text-white animate-pulse">
                                🚨 CRITICAL
                              </span>
                            )}
                            {isUrgent && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-400 text-slate-950 border border-amber-600">
                                ⚡ ด่วน
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Booking / PO */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-black text-blue-950 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded text-xs border border-blue-200 dark:border-blue-800">
                            {s.booking_no || 'BKG-2026-0914'}
                          </span>
                          <span className="font-mono font-black text-emerald-950 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded text-[11px] border border-emerald-200 dark:border-emerald-800">
                            {s.po_no || 'PO-770413'}
                          </span>
                        </div>
                      </td>

                      {/* AWB/BL */}
                      <td className="py-3.5 px-4 font-mono font-black text-xs text-slate-950 dark:text-slate-100 whitespace-nowrap">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                          {s.awb_bl}
                        </span>
                      </td>

                      {/* Supplier & Origin */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-950 dark:text-white text-xs">{s.supplier}</span>
                          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{s.origin}</span>
                        </div>
                      </td>

                      {/* Mode */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-black px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-950 dark:text-white">
                          {s.mode === 'AIR' && <Plane className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-400" />}
                          {s.mode === 'SEA' && <Anchor className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />}
                          {s.mode === 'LAND' && <Truck className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />}
                          {s.mode}
                        </span>
                      </td>

                      {/* ETA */}
                      <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-900 dark:text-slate-200 whitespace-nowrap">
                        {new Date(s.eta).toLocaleDateString()}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase shadow-2xs ${
                            s.status === 'ARRIVING_TODAY'
                              ? 'bg-cyan-100 text-cyan-950 border border-cyan-400 dark:bg-cyan-950/80 dark:text-cyan-200 dark:border-cyan-700'
                              : s.status === 'DELAYED'
                              ? 'bg-red-100 text-red-950 border border-red-400 dark:bg-red-950/80 dark:text-red-200 dark:border-red-700'
                              : s.status === 'RECEIVED'
                              ? 'bg-emerald-100 text-emerald-950 border border-emerald-400 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700'
                              : 'bg-blue-100 text-blue-950 border border-blue-400 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-700'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              s.status === 'RECEIVED'
                                ? 'bg-emerald-600 dark:bg-emerald-400'
                                : s.status === 'DELAYED'
                                ? 'bg-red-600 dark:bg-red-400'
                                : 'bg-cyan-600 dark:bg-cyan-400'
                            }`}
                          ></span>
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {!isReceived ? (
                            <button
                              type="button"
                              onClick={(e) => handleUpdateStatus(s.id, 'RECEIVED', e)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                              title={language === 'th' ? 'เปลี่ยนสถานะเป็นได้รับแล้ว' : 'Mark Received'}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{language === 'th' ? 'รับแล้ว' : 'Received'}</span>
                            </button>
                          ) : (
                            <span className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{language === 'th' ? 'รับแล้ว' : 'Received'}</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedShipment(s);
                            }}
                            className="p-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:text-cyan-700 hover:border-cyan-500 transition-colors cursor-pointer"
                            title={language === 'th' ? 'ดูรายละเอียด' : 'View Details'}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shipment Details & Status Change Modal */}
      {selectedShipment && (
        <ShipmentDetailModal
          shipment={selectedShipment}
          job={jobs.find((j) => j.id === selectedShipment.job_id)}
          onClose={() => setSelectedShipment(null)}
          onUpdated={loadData}
        />
      )}

      {/* New Shipment Modal for Admin */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div
            className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-950'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-black text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
                <span>{t.newShipmentBtn}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-900 dark:text-slate-100 font-bold mb-1">
                  {language === 'th' ? 'เลือกโครงการเรือเป้าหมาย' : 'Target Shipyard Job'}
                </label>
                <select
                  required
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className={`w-full p-2.5 text-xs font-semibold rounded-xl border focus:outline-hidden ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                  }`}
                >
                  <option value="">{language === 'th' ? '-- เลือกงานเรือ --' : '-- Select Vessel Job --'}</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.job_no} - {j.vessel}
                    </option>
                  ))}
                </select>
              </div>

              {/* Urgency selector */}
              <div>
                <label className="block text-slate-900 dark:text-slate-100 font-bold mb-1">
                  {language === 'th' ? 'ระดับความด่วน (Urgency)' : 'Urgency Level'}
                </label>
                <select
                  value={urgency}
                  onChange={(e: any) => setUrgency(e.target.value)}
                  className={`w-full p-2.5 text-xs font-black rounded-xl border focus:outline-hidden ${
                    urgency === 'CRITICAL'
                      ? 'bg-red-100 text-red-950 border-red-500 dark:bg-red-950 dark:text-red-200'
                      : urgency === 'URGENT'
                      ? 'bg-amber-100 text-amber-950 border-amber-500 dark:bg-amber-950 dark:text-amber-200'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-950'
                  }`}
                >
                  <option value="CRITICAL">🚨 CRITICAL (วิกฤต / ฉุกเฉิน)</option>
                  <option value="URGENT">⚡ URGENT (ด่วน)</option>
                  <option value="NORMAL">📦 NORMAL (ปกติ)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-900 dark:text-slate-100 font-bold mb-1">BOOKING NO.</label>
                  <input
                    type="text"
                    placeholder="BKG-2026-XXXX"
                    value={bookingNo}
                    onChange={(e) => setBookingNo(e.target.value)}
                    className={`w-full p-2 text-xs font-mono font-bold rounded-xl border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-900 dark:text-slate-100 font-bold mb-1">P/O NO. / SUPPLY</label>
                  <input
                    type="text"
                    placeholder="PO-XXXXXX"
                    value={poNo}
                    onChange={(e) => setPoNo(e.target.value)}
                    className={`w-full p-2 text-xs font-mono font-bold rounded-xl border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-900 dark:text-slate-100 font-bold mb-1">AWB / B/L NO. *</label>
                  <input
                    required
                    type="text"
                    placeholder="TG-XXXXXXX / BL-XXXX"
                    value={awbBl}
                    onChange={(e) => setAwbBl(e.target.value)}
                    className={`w-full p-2 text-xs font-mono font-bold rounded-xl border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-900 dark:text-slate-100 font-bold mb-1">FLIGHT / VESSEL</label>
                  <input
                    type="text"
                    placeholder="MV WAN HAI 312 / TG-920"
                    value={flightVessel}
                    onChange={(e) => setFlightVessel(e.target.value)}
                    className={`w-full p-2 text-xs font-bold rounded-xl border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-900 dark:text-slate-100 font-bold mb-1">
                  {language === 'th' ? 'รายการอะไหล่ / คำอธิบาย' : 'Description of Goods'}
                </label>
                <input
                  type="text"
                  placeholder="Main Engine Exhaust Valve Spindles & Gaskets"
                  value={descriptionOfGoods}
                  onChange={(e) => setDescriptionOfGoods(e.target.value)}
                  className={`w-full p-2 text-xs font-semibold rounded-xl border ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-900 dark:text-slate-100 font-bold mb-1">
                    {language === 'th' ? 'ผู้ผลิต (Supplier) *' : 'Supplier *'}
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="MAN Energy Solutions / Wärtsilä"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className={`w-full p-2 text-xs font-semibold rounded-xl border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-900 dark:text-slate-100 font-bold mb-1">
                    {language === 'th' ? 'ต้นทาง (Origin)' : 'Origin'}
                  </label>
                  <input
                    type="text"
                    placeholder="Copenhagen, Denmark"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className={`w-full p-2 text-xs rounded-xl border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-900 dark:text-slate-100 font-bold mb-1">
                    {language === 'th' ? 'ประเภทขนส่ง' : 'Mode'}
                  </label>
                  <select
                    value={mode}
                    onChange={(e: any) => setMode(e.target.value)}
                    className={`w-full p-2 text-xs font-bold rounded-xl border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                    }`}
                  >
                    <option value="AIR">AIR (ทางอากาศ)</option>
                    <option value="SEA">SEA (ทางเรือ)</option>
                    <option value="COURIER">COURIER (พัสดุด่วน)</option>
                    <option value="LAND">LAND (ทางบก)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-900 dark:text-slate-100 font-bold mb-1">
                    {language === 'th' ? 'กำหนดถึง (ETA)' : 'ETA'}
                  </label>
                  <input
                    type="date"
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                    className={`w-full p-2 text-xs font-mono font-bold rounded-xl border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-900 dark:text-slate-100 font-bold mb-1">
                    {language === 'th' ? 'สถานะเริ่มต้น' : 'Initial Status'}
                  </label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className={`w-full p-2 text-xs font-bold rounded-xl border ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-950'
                    }`}
                  >
                    <option value="IN_TRANSIT">IN TRANSIT</option>
                    <option value="ARRIVING_TODAY">ARRIVING TODAY</option>
                    <option value="DELAYED">DELAYED</option>
                    <option value="RECEIVED">RECEIVED</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-black text-xs shadow-md cursor-pointer"
                >
                  {language === 'th' ? 'บันทึกพัสดุ' : 'Create Shipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
